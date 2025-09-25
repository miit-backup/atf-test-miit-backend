const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { responseMimeType: "application/json" }
});
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

/**
 * First AI call: Understands the user's query and extracts key information,
 * including if they are choosing a theme.
 */
async function extractIntent(userInput, history) {
    // console.log('[DEBUG] ===== GEMINI EXTRACT INTENT START =====');
    // console.log('[DEBUG] User input:', userInput);
    // console.log('[DEBUG] History length:', history?.length);

    // Build conversation context for better location resolution
    const recentContext = history && history.length > 0
        ? history.slice(-6).map(h => {
            if (h.role === 'user') {
                return `${h.role}: ${h.parts[0].text}`;
            } else {
                // Model responses are stored as JSON strings, extract location info if available
                try {
                    const modelData = JSON.parse(h.parts[0].text);
                    if (modelData.weather && modelData.weather.location && modelData.weather.location.name) {
                        return `${h.role}: Provided weather information for ${modelData.weather.location.name}`;
                    } else {
                        return `${h.role}: Provided response (theme/general conversation)`;
                    }
                } catch (e) {
                    return `${h.role}: ${h.parts[0].text}`;
                }
            }
        }).join('\n')
        : 'No previous conversation';

    const prompt = `
    You are a highly accurate entity extraction model for a themed chatbot.
    Your task is to analyze the user's input and respond ONLY with a JSON object.
    The user input can be in Japanese or English.

    CRITICAL: Respond with ONLY valid JSON. No additional text before or after.
    Do not add explanations, comments, or any text outside the JSON structure.

    IMPORTANT: Use the conversation context below to resolve referential terms like "there", "that place", "the city", etc.

    Recent Conversation Context:
    ${recentContext}

    Follow these rules strictly:
    1. "location": Find a city, country, or landmark. If the user says "there", "that place", "the city", etc., resolve it using the conversation context above. If none found, MUST be null.
    2. "date": Find a date reference ('today', 'tomorrow', "day after tomorrow", 'tonight', 'this evening', 'this weekend', etc.). If none, default to 'today'.
    3. "mood": Find a mood ('bored', 'tired', 'lazy' etc). If none, MUST be null.
    4. "requires_weather_data": Set to true if the user asks about weather, clothing, places to visit, activities to do, things to discover, recommendations, suggestions, or any request that would benefit from weather information. Also set to true if they mention activities like photography, sports, dining, shopping, etc.
    5. "is_greeting_or_smalltalk": Set to true for simple greetings like "hello", "hi", "good morning".
    6. "is_general_conversation": Set to true ONLY for pure conversational messages like simple thanks ("thanks", "thank you"), acknowledgments ("ok", "got it"), or casual chat that doesn't request any information or suggestions.
    7. "chosen_theme": ONLY set this if the user is explicitly choosing a theme as a single word/phrase response (like "Photography", "Sports", "Music") or clearly stating their choice (like "I choose photography", "I want sports theme"). Do NOT set this for requests like "I want to do photography" or "find photography places" - those are activity requests, not theme selection.
    8. "implied_theme": If the user mentions a specific activity or interest (like "photography", "sports", "cooking", "music") in their request but it's not an explicit theme choice, extract the theme name here. This helps detect themes from natural conversation.

    --- EXAMPLES ---
    Context: "user: I will be in Tokyo tomorrow"
    User Input: "What can I do there?"
    JSON Response:
    { "location": "Tokyo", "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null }

    User Input: "大阪の天気は？"
    JSON Response:
    { "location": "Osaka", "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null }

    User Input: "I choose sports"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": false, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": "sports" }

    Context: "user: I'm going to Paris next week"
    User Input: "What's the weather like there tomorrow?"
    JSON Response:
    { "location": "Paris", "date": "tomorrow", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null }

    Context: "user: How's the weather in London?\nmodel: Provided weather information for London"
    User Input: "What's the forecast for tomorrow?"
    JSON Response:
    { "location": null, "date": "tomorrow", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null }

    Context: "user: Weather in Tokyo today?\nmodel: Provided weather information for Tokyo"  
    User Input: "How about the day after tomorrow?"
    JSON Response:
    { "location": null, "date": "day after tomorrow", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null }

    User Input: "Thanks! I would want to discover places that I can do photography today or tomorrow"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "photography" }

    User Input: "I want to find good spots for taking pictures this weekend"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "photography" }

    User Input: "Where can I go for outdoor activities tomorrow?"
    JSON Response:
    { "location": null, "date": "tomorrow", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "outdoor activities" }

    User Input: "I want to go to places to do photography"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "photography" }

    User Input: "写真を撮るのに良い場所を教えて"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "photography" }

    User Input: "Okay! Thanks!"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": false, "is_greeting_or_smalltalk": false, "is_general_conversation": true, "chosen_theme": null, "implied_theme": null }

    User Input: "I want to find restaurants for tonight"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "food" }

    User Input: "Looking for some good jogging routes"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "sports" }

    User Input: "Photography"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": false, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": "photography", "implied_theme": null }

    User Input: "I choose photography"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": false, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": "photography", "implied_theme": null }

    User Input: "I want to go to do photography"
    JSON Response:
    { "location": null, "date": "today", "mood": null, "requires_weather_data": true, "is_greeting_or_smalltalk": false, "is_general_conversation": false, "chosen_theme": null, "implied_theme": "photography" }
    --- END OF EXAMPLES ---

    Current User Input: "${userInput}"

    REMINDER: Output ONLY the JSON object. No explanations or additional text.
    Respond ONLY with the JSON object.
  `;

    // console.log('[DEBUG] Sending request to Gemini AI...');
    const chat = model.startChat({ safetySettings });
    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();
    // console.log('[DEBUG] Gemini raw response:', responseText);

    try {
        const parsed = JSON.parse(responseText);
        // console.log('[DEBUG] Intent successfully parsed:', parsed);
        // console.log('[DEBUG] ===== GEMINI EXTRACT INTENT END =====');
        return parsed;
    } catch (error) {
        console.error('[DEBUG] Failed to parse Gemini intent response:', error);
        // console.log('[DEBUG] ===== GEMINI EXTRACT INTENT END (ERROR) =====');
        throw error;
    }
}

/**
 * Second AI call: Generates a final, themed response based on the chosen persona.
 */
async function generateFinalResponse(userInput, intent, weatherData, theme) {
    // console.log('[DEBUG] ===== GEMINI GENERATE FINAL RESPONSE START =====');
    // console.log('[DEBUG] User input:', userInput);
    // console.log('[DEBUG] Intent:', intent);
    // console.log('[DEBUG] Weather data available:', !!weatherData);
    // console.log('[DEBUG] Theme:', theme);

    const locationName = weatherData ? weatherData.location.name : (intent.location || 'your location');
    // console.log('[DEBUG] Location name for response:', locationName);

    // This is the new, dynamic persona instruction.
    const personaInstructions = `
      You are a creative and helpful AI assistant specialized in providing location-based suggestions. Your current theme is "${theme}".
      Your main purpose is to suggest specific places, activities, or recommendations related to "${theme}" that are appropriate for the current weather and location.
      
      When users ask for places or activities:
      - Provide SPECIFIC location recommendations when possible (parks, landmarks, districts, venues)
      - Consider the weather conditions to suggest appropriate timing and preparation
      - Give actionable advice that the user can immediately act upon
      - Be creative and think beyond obvious suggestions

      Examples of good responses for different themes and weather:
      - Photography + Sunny weather: "Visit the riverside park during golden hour (6-7 PM), the lighting will be perfect for portraits. The cherry blossom trees near the main bridge create beautiful natural frames."
      - Photography + Overcast: "Perfect lighting for urban photography! Try the historic district - the soft light eliminates harsh shadows and brings out architectural details beautifully."
      - Sports + Hot weather: "Early morning is ideal - try the lakeside jogging path before 8 AM, or visit the indoor climbing gym downtown which has great air conditioning."
      - Food + Rainy: "Perfect weather for hot ramen! The covered market district has several authentic shops, and you can stay dry while exploring."
    `;

    const prompt = `
      ${personaInstructions}

      Here is the context:
      - The user's original input was: "${userInput}"
      - Your analysis of their intent is: ${JSON.stringify(intent)}
      - The weather data is for the city of: "${locationName}".
      - Full weather data: ${JSON.stringify(weatherData)}
  
      CRITICAL: Respond with ONLY valid JSON. No additional text before or after.
      Do not add explanations, comments, or any text outside the JSON structure.

      Follow these instructions to generate your response:
      1. **Acknowledge the Weather**: If weather data is available, briefly mention the current weather conditions in "${locationName}".
      2. **Provide Specific Recommendations**: Give concrete, actionable suggestions for places to visit or activities to do related to "${theme}". Include specific location names, timing recommendations, or practical tips when possible.
      3. **Weather-Appropriate Advice**: If weather data is available, explain how the current weather makes your suggestions particularly good choices.
      4. **No Location Available**: If no weather data is provided, give general but helpful suggestions for "${theme}" activities and ask the user to share their location for more specific recommendations.
      5. **Practical Details**: Include timing, what to bring, or how to prepare when relevant.
      6. **Language**: Be conversational, enthusiastic, and helpful in both languages.

      The user asked: "${userInput}"
      Make sure your suggestions directly address what they're looking for, whether it's places to visit, activities to do, or specific recommendations related to their theme.

      Provide your response in a JSON format containing ONLY the following three keys:
      1. "japaneseResponse": The full, creative response in natural Japanese.
      2. "englishResponse": The full response, translated accurately into English.
      3. "suggestion": A short, actionable summary of your recommendation.

      REMINDER: Output ONLY the JSON object. No explanations or additional text.
    `;

    // console.log('[DEBUG] Sending final response request to Gemini AI...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // console.log('[DEBUG] Gemini final response raw:', responseText);

    try {
        const parsed = JSON.parse(responseText);
        // console.log('[DEBUG] Final response successfully parsed');
        // console.log('[DEBUG] Japanese response length:', parsed.japaneseResponse?.length);
        // console.log('[DEBUG] English response length:', parsed.englishResponse?.length);
        // console.log('[DEBUG] Suggestion:', parsed.suggestion);
        // console.log('[DEBUG] ===== GEMINI GENERATE FINAL RESPONSE END =====');
        return parsed;
    } catch (error) {
        console.error('[DEBUG] Failed to parse Gemini final response:', error);
        console.error('[DEBUG] Raw response text:', responseText);
        console.error('[DEBUG] Response length:', responseText.length);
        console.error('[DEBUG] First 500 chars:', responseText.substring(0, 500));
        console.error('[DEBUG] Last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));
        
        // Return a fallback response instead of crashing
        return {
            japaneseResponse: "申し訳ございませんが、応答の生成中にエラーが発生しました。もう一度お試しください。",
            englishResponse: "Sorry, there was an error generating the response. Please try again.",
            suggestion: "Please try your request again."
        };
    }
}


/**
 * Third AI call: Generates a natural conversational response for general messages.
 */
async function generateGeneralResponse(userInput, history, theme) {
    // console.log('[DEBUG] ===== GEMINI GENERATE GENERAL RESPONSE START =====');
    // console.log('[DEBUG] User input:', userInput);
    // console.log('[DEBUG] History length:', history?.length);
    // console.log('[DEBUG] Theme:', theme);

    // Get context from recent conversation history
    const recentHistory = history ? history.slice(-6) : []; // Last 3 exchanges
    const historyContext = recentHistory.map(h => {
        if (h.role === 'user') {
            return `${h.role}: ${h.parts[0].text}`;
        } else {
            // Handle JSON model responses more gracefully
            try {
                const modelData = JSON.parse(h.parts[0].text);
                if (modelData.englishResponse) {
                    return `${h.role}: ${modelData.englishResponse.substring(0, 100)}...`;
                } else {
                    return `${h.role}: [response provided]`;
                }
            } catch (e) {
                return `${h.role}: ${typeof h.parts[0].text === 'string' ? h.parts[0].text : '[response provided]'}`;
            }
        }
    }).join('\n');

    const themeContext = theme ? `The user has chosen "${theme}" as their theme, but this is casual conversation that doesn't require theme-based suggestions.` : `No specific theme has been chosen yet.`;

    const prompt = `
      You are a friendly, natural AI assistant having a casual conversation with a user.
      
      Context:
      - User's current message: "${userInput}"
      - ${themeContext}
      - Recent conversation history:
      ${historyContext}

      CRITICAL: Respond with ONLY valid JSON. No additional text before or after.
      Do not add explanations, comments, or any text outside the JSON structure.

      Instructions:
      1. Respond naturally and conversationally to the user's message
      2. Keep responses friendly and engaging
      3. Don't force weather or theme-related suggestions unless naturally relevant
      4. Acknowledge what the user said appropriately
      5. You can ask follow-up questions or make friendly comments
      6. Keep responses concise but warm
      7. If the user says thanks, acknowledge it gracefully
      8. If appropriate, you can gently guide toward asking about suggestions or weather

      Provide your response in JSON format with these keys:
      1. "japaneseResponse": Natural conversational response in Japanese
      2. "englishResponse": Natural conversational response in English  
      3. "suggestion": A brief, friendly follow-up suggestion (can be general or theme-related if appropriate)

      Example responses:
      - For "Thanks!": Acknowledge gratefully and offer to help with anything else
      - For "How are you?": Respond positively and show interest in helping
      - For casual comments: Engage naturally and keep conversation flowing

      REMINDER: Output ONLY the JSON object. No explanations or additional text.
    `;

    // console.log('[DEBUG] Sending general response request to Gemini AI...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // console.log('[DEBUG] Gemini general response raw:', responseText);

    try {
        const parsed = JSON.parse(responseText);
        // console.log('[DEBUG] General response successfully parsed');
        // console.log('[DEBUG] Japanese response length:', parsed.japaneseResponse?.length);
        // console.log('[DEBUG] English response length:', parsed.englishResponse?.length);
        // console.log('[DEBUG] Suggestion:', parsed.suggestion);
        // console.log('[DEBUG] ===== GEMINI GENERATE GENERAL RESPONSE END =====');
        return parsed;
    } catch (error) {
        console.error('[DEBUG] Failed to parse Gemini general response:', error);
        console.error('[DEBUG] Raw response text:', responseText);
        console.error('[DEBUG] Response length:', responseText.length);
        console.error('[DEBUG] First 500 chars:', responseText.substring(0, 500));
        console.error('[DEBUG] Last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));
        
        // Return a fallback response instead of crashing
        return {
            japaneseResponse: "申し訳ございませんが、応答の生成中にエラーが発生しました。もう一度お試しください。",
            englishResponse: "Sorry, there was an error generating the response. Please try again.",
            suggestion: "Please try your request again."
        };
    }
}


module.exports = { extractIntent, generateFinalResponse, generateGeneralResponse };