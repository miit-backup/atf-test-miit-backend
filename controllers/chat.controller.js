const { transcribeAudio } = require('../services/stt.service');
const { convertTextToSpeech, convertTextToSpeechWithLanguage, convertBothLanguagesToSpeech } = require('../services/tts.service');
const { getCityFromIp } = require('../services/location.service');
const { getWeather } = require('../services/weather.service');
const { extractIntent, generateFinalResponse, generateGeneralResponse } = require('../services/gemini.service');
const context = require('../utils/context.manager');
const { extractLocationWithRegex } = require('../utils/location.extractor');
const { detectCityInMessage, shouldSaveAsCurrentCity } = require('../utils/city.detector');

// --- HELPER FUNCTION TO FIND LAST LOCATION IN HISTORY ---
function findLastLocationInHistory(history) {
    // console.log('[DEBUG] Searching for location in history, entries:', history?.length);
    if (!history || history.length === 0) {
        // console.log('[DEBUG] No history available');
        return null;
    }

    // Loop backwards through history to find the most recent location mention
    for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];

        // Check model responses for weather data (existing logic)
        if (entry.role === 'model') {
            try {
                const modelResponse = JSON.parse(entry.parts[0].text);
                if (modelResponse.weather && modelResponse.weather.location && modelResponse.weather.location.name) {
                    // console.log('[DEBUG] Found location in model response:', modelResponse.weather.location.name);
                    return modelResponse.weather.location.name;
                }
            } catch (e) {
                // Ignore parsing errors for malformed history entries
                console.warn('[DEBUG] Could not parse a model response entry:', e.message);
            }
        }

        if (entry.role === 'user') {
            try {
                const userText = entry.parts[0].text;
                // console.log('[DEBUG] Checking user message for locations:', userText);

                // Use regex extraction to find locations in user messages
                const locationFromRegex = extractLocationWithRegex(userText);
                if (locationFromRegex) {
                    // console.log('[DEBUG] Found location in user message via regex:', locationFromRegex);
                    return locationFromRegex;
                }

                // Look for common location patterns in user messages
                const locationPatterns = [
                    /(?:in|to|from|at)\s+([A-Za-z\s]+?)(?:\s+(?:tomorrow|today|yesterday|next|last|this))/i,
                    /(?:going to|visiting|traveling to|will be in)\s+([A-Za-z\s]+)/i,
                    /([A-Za-z\s]+)\s+(?:weather|forecast|climate)/i
                ];

                for (const pattern of locationPatterns) {
                    const match = userText.match(pattern);
                    if (match && match[1] && match[1].trim().length > 2) {
                        const location = match[1].trim();
                        // console.log('[DEBUG] Found location in user message via pattern:', location);
                        return location;
                    }
                }
            } catch (e) {
                console.warn('[DEBUG] Error processing user message for location:', e.message);
            }
        }
    }

    // console.log('[DEBUG] No location found in history');
    return null;
}

// --- HELPER FUNCTION TO STRUCTURE WEATHER DATA ---
function formatWeatherData(weatherData) {
    // console.log('[DEBUG] Formatting weather data:', !!weatherData);
    if (!weatherData) {
        // console.log('[DEBUG] No weather data to format');
        return null;
    }

    // Safely extract today's and tomorrow's forecast
    const todayForecast = weatherData.forecast.forecastday[0]?.day;
    const tomorrowForecast = weatherData.forecast.forecastday[1]?.day;
    // console.log('[DEBUG] Today forecast available:', !!todayForecast);
    // console.log('[DEBUG] Tomorrow forecast available:', !!tomorrowForecast);

    const formatted = {
        location: {
            name: weatherData.location.name,
            region: weatherData.location.region,
            country: weatherData.location.country,
        },
        current: {
            temp_c: weatherData.current.temp_c,
            condition_text: weatherData.current.condition.text,
            condition_icon: weatherData.current.condition.icon,
            humidity: weatherData.current.humidity,
            wind_kph: weatherData.current.wind_kph,
        },
        forecast: {
            today: todayForecast ? {
                maxtemp_c: todayForecast.maxtemp_c,
                mintemp_c: todayForecast.mintemp_c,
                condition_text: todayForecast.condition.text,
                condition_icon: todayForecast.condition.icon,
                daily_chance_of_rain: todayForecast.daily_chance_of_rain,
            } : null,
            tomorrow: tomorrowForecast ? {
                maxtemp_c: tomorrowForecast.maxtemp_c,
                mintemp_c: tomorrowForecast.mintemp_c,
                condition_text: tomorrowForecast.condition.text,
                condition_icon: tomorrowForecast.condition.icon,
                daily_chance_of_rain: tomorrowForecast.daily_chance_of_rain,
            } : null,
        }
    };

    // console.log('[DEBUG] Weather data formatted successfully for:', formatted.location.name);
    return formatted;
}


async function handleChat(req, res) {
    // console.log('[DEBUG] ===== CHAT HANDLER START =====');
    // console.log('[DEBUG] Request body:', req.body);
    // console.log('[DEBUG] File uploaded:', !!req.file);

    try {
        let { text: userInput, sessionId, latitude, longitude } = req.body;
        // console.log('[DEBUG] Initial userInput:', userInput);
        // console.log('[DEBUG] SessionId:', sessionId);
        // console.log('[DEBUG] Coordinates - lat:', latitude, 'lon:', longitude);

        if (!sessionId) {
            // console.log('[DEBUG] No sessionId provided, creating new session...');
            sessionId = context.createSession();
            // console.log('[DEBUG] New sessionId created:', sessionId);
        }
        // getSessionData now also updates the 'lastAccessed' timestamp
        const session = context.getSessionData(sessionId);
        // console.log('[DEBUG] Session data retrieved:', session ? 'SUCCESS' : 'FAILED');
        // console.log('[DEBUG] Session theme:', session?.theme);
        // console.log('[DEBUG] Session history length:', session?.history?.length);

        if (req.file) {
            console.log('[DEBUG] Audio file detected, transcribing...');
            console.log('[DEBUG] Audio file size:', req.file.buffer.length);
            console.log('[DEBUG] Request body keys:', Object.keys(req.body));
            console.log('[DEBUG] LocationContext in body:', req.body.locationContext);
            console.log('[DEBUG] SessionId before processing:', sessionId);
            
            userInput = await transcribeAudio(req.file.buffer);
            console.log('[DEBUG] Transcription result:', userInput);
            if (!userInput) {
                console.log('[DEBUG] Transcription failed - no text returned');
                return res.status(400).json({ error: "Could not understand audio." });
            }
            
            // Check if locationContext was provided and should be appended
            const locationContext = req.body.locationContext;
            if (locationContext) {
                // Check if we should add location context:
                // 1. No sessionId (truly first message), OR
                // 2. SessionId exists but no city saved in memory yet
                const shouldAddLocationContext = !sessionId || !context.getCurrentCityForSession(sessionId);
                
                if (shouldAddLocationContext) {
                    console.log('[DEBUG] Adding location context to audio message');
                    console.log('[DEBUG] Original userInput:', userInput);
                    console.log('[DEBUG] LocationContext to append:', locationContext);
                    userInput = `${userInput}. ${locationContext}`;
                    console.log('[DEBUG] Combined userInput:', userInput);
                } else {
                    console.log('[DEBUG] Location context not added - session already has saved city');
                }
            } else {
                console.log('[DEBUG] No locationContext provided in request');
            }
        }
        if (!userInput) {
            // console.log('[DEBUG] No input provided after all checks');
            return res.status(400).json({ error: "No input provided." });
        }

        // console.log('[DEBUG] Processing input:', userInput);
        const history = session.history;
        // console.log('[DEBUG] Getting intent extraction...');
        const intent = await extractIntent(userInput, history);
        // console.log('[DEBUG] Intent extracted:', intent);

        // --- COORDINATES-BASED CITY UPDATE ---
        // If coordinates are provided, resolve them to a city and store immediately
        if (latitude && longitude) {
            // console.log('[DEBUG] Coordinates provided, resolving to city name...');
            try {
                const tempWeatherData = await getWeather({ lat: latitude, lon: longitude });
                if (tempWeatherData && tempWeatherData.location && tempWeatherData.location.name) {
                    const resolvedCity = tempWeatherData.location.name;
                    // console.log('[DEBUG] Coordinates resolved to city:', resolvedCity);
                    // console.log('[DEBUG] Storing resolved city in session:', resolvedCity);
                    context.setCurrentCityForSession(sessionId, resolvedCity);
                } else {
                    // console.log('[DEBUG] Could not resolve coordinates to city name');
                }
            } catch (error) {
                // console.log('[DEBUG] Error resolving coordinates to city:', error.message);
            }
        }

        // --- CITY MEMORY SYSTEM ---
        // NOTE: Disabled redundant city detection as intent.location already handles this
        // and the regex-based detection was causing parsing errors
        /*
        const detectedCity = detectCityInMessage(userInput, intent);
        console.log('[DEBUG] City detector found:', detectedCity);
        if (detectedCity) {
            const currentCity = context.getCurrentCityForSession(sessionId);
            console.log('[DEBUG] Current city before city detector:', currentCity);
            const shouldSave = shouldSaveAsCurrentCity(detectedCity, currentCity, userInput);
            console.log('[DEBUG] Should save city from detector:', shouldSave);
            if (shouldSave) {
                console.log('[DEBUG] Saving new city to memory via detector:', detectedCity);
                context.setCurrentCityForSession(sessionId, detectedCity);
            }
        }
        */

        // --- THEME LOGIC ---

        // Case 1: The user is actively choosing a theme.
        if (intent.chosen_theme) {
            // console.log('[DEBUG] Theme chosen:', intent.chosen_theme);
            const theme = intent.chosen_theme.toLowerCase();
            context.setThemeForSession(sessionId, theme);
            // console.log('[DEBUG] Theme set for session:', theme);
            const confirmationResponse = {
                japaneseResponse: `承知いたしました！「${theme}」をテーマに提案させていただきますね。${theme}に関する場所や活動について何でもお聞きください！`,
                englishResponse: `Perfect! I'll be your "${theme}" advisor from now on. Feel free to ask me about places to visit or activities related to ${theme}!`,
                suggestion: `Ask me about ${theme} places or activities in your area!`,
                action_required: null // Clear any pending actions
            };
            context.updateHistory(sessionId, userInput, confirmationResponse);
            // console.log('[DEBUG] Theme confirmation response prepared, returning...');
            return res.json({ sessionId, ...confirmationResponse });
        }

        // Case 1.5: No theme set yet, but user mentioned a specific activity/interest - auto-set theme
        if (!session.theme && intent.implied_theme) {
            // console.log('[DEBUG] No theme set but implied theme detected:', intent.implied_theme);
            const theme = intent.implied_theme.toLowerCase();
            context.setThemeForSession(sessionId, theme);
            // console.log('[DEBUG] Auto-set theme from implied:', theme);
            // Don't return confirmation - continue with the request processing
        }

        // Case 2: No theme has been set yet for this session. The prompt is now more open.
        // Re-fetch session to get the most current theme state
        const currentSession = context.getSessionData(sessionId);
        if (!currentSession.theme) {
            // console.log('[DEBUG] No theme set, prompting user to choose...');
            const themePromptResponse = {
                // CHANGED HERE
                japaneseResponse: "こんにちは！まず、どのようなテーマで場所や活動を提案してほしいですか？例えば、「写真撮影」「スポーツ」「グルメ」「読書」など、何でもどうぞ！",
                // CHANGED HERE
                englishResponse: "Hello! First, what theme would you like for location and activity suggestions? For example: 'Photography', 'Sports', 'Food', 'Reading', or anything else you're interested in!",
                suggestion: "Choose a theme to get personalized recommendations!",
                action_required: "choose_theme" // A flag for the frontend
            };
            // console.log('[DEBUG] Theme prompt response returned');
            return res.json({ sessionId, ...themePromptResponse });
        }

        // Case 3: General conversation handling
        if (intent.is_general_conversation) {
            // console.log('[DEBUG] General conversation detected, generating conversational response...');
            const generalResponse = await generateGeneralResponse(userInput, history, session.theme);
            // console.log('[DEBUG] General response generated:', !!generalResponse);

            // Create response without weather data
            const finalResponse = {
                ...generalResponse,
                weather: null, // No weather data for general conversation
                action_required: null // Clear any pending actions
            };

            // console.log('[DEBUG] Updating conversation history for general message...');
            context.updateHistory(sessionId, userInput, finalResponse);
            // console.log('[DEBUG] General conversation response prepared, returning...');
            return res.json({ sessionId, ...finalResponse });
        }

        // Case 4: A theme is set, proceed with the normal weather/suggestion flow.
        // console.log('[DEBUG] Theme is set:', session.theme, '- proceeding with weather flow...');
        let weatherData = null;
        let finalLocationIdentifier = null;

        if (intent.requires_weather_data) {
            // console.log('[DEBUG] Weather data required, determining location...');
            let explicitLocation = intent.location || extractLocationWithRegex(userInput);
            // console.log('[DEBUG] Explicit location from intent/regex:', explicitLocation);

            if (explicitLocation) {
                // console.log('[DEBUG] Using explicit location:', explicitLocation);
                finalLocationIdentifier = explicitLocation;
            } else {
                // Priority 2: Check city memory (most recently mentioned city)
                const savedCity = context.getCurrentCityForSession(sessionId);
                // console.log('[DEBUG] Saved city from memory:', savedCity);

                if (savedCity) {
                    // console.log('[DEBUG] Using saved city from memory:', savedCity);
                    finalLocationIdentifier = savedCity;
                } else {
                    // console.log('[DEBUG] No saved city, checking history...');
                    const locationFromHistory = findLastLocationInHistory(history);
                    // console.log('[DEBUG] Location from history:', locationFromHistory);
                    if (locationFromHistory) {
                        finalLocationIdentifier = locationFromHistory;
                    } else if (latitude && longitude) {
                        // console.log('[DEBUG] No location in history, using provided coordinates:', latitude, longitude);
                        finalLocationIdentifier = { lat: latitude, lon: longitude };
                    } else {
                        // console.log('[DEBUG] No location in history or coordinates, using IP geolocation...');
                        const clientIp = req.ip;
                        // console.log('[DEBUG] Client IP:', clientIp);
                        finalLocationIdentifier = await getCityFromIp(clientIp);
                        // console.log('[DEBUG] Location from IP:', finalLocationIdentifier);
                    }
                }
            }

            if (finalLocationIdentifier) {
                // console.log('[DEBUG] Getting weather for:', finalLocationIdentifier);
                weatherData = await getWeather(finalLocationIdentifier);
                // console.log('[DEBUG] Weather data received:', !!weatherData);

                if (weatherData && weatherData.location && weatherData.location.name) {
                    const resolvedCityName = weatherData.location.name;
                    // console.log('[DEBUG] Weather API resolved location to city:', resolvedCityName);

                    // Always update the stored city when we get a valid weather response
                    // This ensures the session remembers the most recent valid location
                    const currentStoredCity = context.getCurrentCityForSession(sessionId);
                    // console.log('[DEBUG] Current stored city in session:', currentStoredCity);

                    if (currentStoredCity !== resolvedCityName) {
                        // console.log('[DEBUG] Updating stored city in session from', currentStoredCity, 'to', resolvedCityName);
                        context.setCurrentCityForSession(sessionId, resolvedCityName);
                    } else {
                        // console.log('[DEBUG] Resolved city matches stored city, no update needed');
                    }
                } else {
                    console.warn(`[DEBUG] Weather data not found for identifier: ${JSON.stringify(finalLocationIdentifier)}. The city may be invalid.`);
                }
            } else {
                // console.log('[DEBUG] No location identifier found - proceeding without weather');
            }
        } else {
            // console.log('[DEBUG] Weather data not required for this intent');
        }

        // Pass the current session's theme to the final response generator
        // console.log('[DEBUG] Generating final AI response...');
        const aiTextResponse = await generateFinalResponse(userInput, intent, weatherData, currentSession.theme);
        // console.log('[DEBUG] AI response generated:', !!aiTextResponse);
        const structuredWeather = formatWeatherData(weatherData);
        // console.log('[DEBUG] Weather data formatted:', !!structuredWeather);

        const finalResponse = {
            ...aiTextResponse,
            weather: structuredWeather,
        };

        // console.log('[DEBUG] Updating conversation history...');
        context.updateHistory(sessionId, userInput, finalResponse);
        // console.log('[DEBUG] Final response prepared, sending to client...');

        res.json({ sessionId, ...finalResponse });

    } catch (error) {
        console.error('[DEBUG] ERROR in chat controller:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
    // console.log('[DEBUG] ===== CHAT HANDLER END =====');
}

async function getRawWeather(req, res) {
    // console.log('[DEBUG] ===== RAW WEATHER HANDLER START =====');
    // console.log('[DEBUG] Query params:', req.query);

    try {
        const { city } = req.query;
        // console.log('[DEBUG] Requested city:', city);

        if (!city) {
            // console.log('[DEBUG] No city provided in query params');
            return res.status(400).json({ error: "City query parameter is required." });
        }

        // console.log('[DEBUG] Fetching weather data for:', city);
        const weatherData = await getWeather(city);
        // console.log('[DEBUG] Weather data received:', !!weatherData);

        if (!weatherData) {
            // console.log('[DEBUG] Weather data not found for city:', city);
            return res.status(404).json({ error: `Weather data for city '${city}' not found.` });
        }

        // console.log('[DEBUG] Returning weather data for:', weatherData.location?.name);
        res.json(weatherData);
    } catch (error) {
        console.error('[DEBUG] ERROR in getRawWeather:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch weather data.' });
    }
    // console.log('[DEBUG] ===== RAW WEATHER HANDLER END =====');
}

async function convertToSpeech(req, res) {
    // console.log('[DEBUG] ===== TTS HANDLER START =====');
    // console.log('[DEBUG] Request body:', req.body);

    try {
        const { text, language, japaneseText, englishText, mode } = req.body;
        // console.log('[DEBUG] Mode:', mode);
        // console.log('[DEBUG] Language:', language);
        // console.log('[DEBUG] Text length:', text?.length);
        // console.log('[DEBUG] Japanese text length:', japaneseText?.length);
        // console.log('[DEBUG] English text length:', englishText?.length);

        let audioData;
        let contentType = 'audio/mpeg';
        let filename = 'speech.mp3';

        if (mode === 'both' && japaneseText && englishText) {
            // Convert both languages and return both audio files
            // console.log('[DEBUG] Converting both Japanese and English text');
            const bothAudio = await convertBothLanguagesToSpeech(japaneseText, englishText);

            // For simplicity, return JSON with base64 encoded audio
            return res.json({
                success: true,
                audio: {
                    japanese: bothAudio.japanese.toString('base64'),
                    english: bothAudio.english.toString('base64')
                },
                contentType: 'audio/mpeg'
            });

        } else if (text && language) {
            // Convert single text with specific language
            // console.log('[DEBUG] Converting text with specific language');
            audioData = await convertTextToSpeechWithLanguage(text, language);
            filename = `speech_${language}.mp3`;

        } else if (text) {
            // Convert text with auto-detection
            // console.log('[DEBUG] Converting text with auto-detection');
            audioData = await convertTextToSpeech(text);

        } else {
            // console.log('[DEBUG] Invalid request - missing required parameters');
            return res.status(400).json({
                error: "Missing required parameters. Provide 'text' or both 'japaneseText' and 'englishText'"
            });
        }

        // Set headers for audio response
        res.set({
            'Content-Type': contentType,
            'Content-Length': audioData.length,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache'
        });

        // console.log('[DEBUG] Sending audio response, length:', audioData.length);
        res.send(audioData);

    } catch (error) {
        console.error('[DEBUG] ERROR in convertToSpeech:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to convert text to speech: ' + error.message });
    }
    // console.log('[DEBUG] ===== TTS HANDLER END =====');
}

module.exports = { handleChat, getRawWeather, convertToSpeech };