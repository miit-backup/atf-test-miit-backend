/**
 * Comprehensive city detection utility that finds city mentions in user messages
 * and determines if a new city has been mentioned that should be saved to memory.
 */

const { extractLocationWithRegex } = require('./location.extractor');

/**
 * Detects if a user message contains a city mention and extracts it.
 * Uses multiple approaches: regex patterns, common phrases, and AI intent.
 * @param {string} userInput - The user's message
 * @param {object} intent - The extracted intent from AI
 * @returns {string|null} - The detected city name or null
 */
function detectCityInMessage(userInput, intent) {
    // console.log('[DEBUG] ===== CITY DETECTOR - DETECT CITY =====');
    // console.log('[DEBUG] User input:', userInput);
    // console.log('[DEBUG] Intent location:', intent?.location);

    // Priority 1: Use AI-detected location from intent
    if (intent?.location && typeof intent.location === 'string') {
        // console.log('[DEBUG] City detected from AI intent:', intent.location);
        return intent.location.trim();
    }

    // Priority 2: Use regex extraction
    const regexLocation = extractLocationWithRegex(userInput);
    if (regexLocation) {
        // console.log('[DEBUG] City detected from regex:', regexLocation);
        return regexLocation.trim();
    }

    // Priority 3: Enhanced pattern matching for various city mention formats
    const cityPatterns = [
        // Travel/movement patterns (English)
        /(?:going to|traveling to|visiting|will be in|am in|i'll be in|heading to|flying to)\s+([A-Za-z\s]+?)(?:\s+(?:tomorrow|today|yesterday|next|last|this|for|on|\.|,|$))/i,

        // Japanese travel/movement patterns - "〇〇に行きます", "〇〇へ行く", etc.
        /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uFF00-\uFFEFA-Za-z\s]+?)(?:に行きます|に行く|へ行きます|へ行く|に向かいます|に向かう)/i,

        // Location-based patterns  
        /(?:in|at|from)\s+([A-Za-z\s]+?)(?:\s+(?:tomorrow|today|yesterday|weather|forecast|climate|city|place|\.|,|$))/i,

        // Weather-specific patterns
        /([A-Za-z\s]+?)\s+(?:weather|forecast|climate|temperature)/i,

        // General city reference patterns
        /(?:city of|town of|place called)\s+([A-Za-z\s]+)/i,

        // Japanese patterns - Updated to include Japanese characters
        /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uFF00-\uFFEFA-Za-z\s]+?)(?:の天気|はどんな天気|で天気|にいます|にいる)/i,

        // Japanese location patterns - "私は〇〇にいます" (I am in ...)
        /私は([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uFF00-\uFFEFA-Za-z\s]+?)(?:にいます|にいる|です)/i,

        // Simple city name patterns (be more careful with these)
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:please|weather|\?|$)/i
    ];

    for (let i = 0; i < cityPatterns.length; i++) {
        const pattern = cityPatterns[i];
        const match = userInput.match(pattern);

        if (match && match[1]) {
            const potentialCity = match[1].trim();

            // Filter out common non-city words
            if (isLikelyCity(potentialCity)) {
                // console.log('[DEBUG] City detected from pattern', i + 1, ':', potentialCity);
                return potentialCity;
            }
        }
    }

    // console.log('[DEBUG] No city detected in message');
    return null;
}

/**
 * Validates if a string is likely to be a city name
 * @param {string} text - The text to validate
 * @returns {boolean} - True if likely a city name
 */
function isLikelyCity(text) {
    if (!text || text.length < 2 || text.length > 50) return false;

    // Exclude common non-city words
    const excludeWords = [
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'weather', 'today', 'tomorrow', 'yesterday', 'there', 'here', 'this', 'that',
        'good', 'bad', 'nice', 'great', 'okay', 'fine', 'well', 'very', 'really',
        'going', 'coming', 'will', 'can', 'could', 'would', 'should', 'must',
        'please', 'thank', 'thanks', 'sorry', 'hello', 'hi', 'hey'
    ];

    const lowerText = text.toLowerCase();
    if (excludeWords.includes(lowerText)) return false;

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(text)) return false;

    // Shouldn't be all uppercase (unless it's an acronym)
    if (text === text.toUpperCase() && text.length > 4) return false;

    return true;
}

/**
 * Determines if a detected city should be saved as the new current city
 * @param {string} detectedCity - The newly detected city
 * @param {string} currentCity - The currently saved city
 * @param {string} userInput - The user's message for context
 * @returns {boolean} - True if should save the new city
 */
function shouldSaveAsCurrentCity(detectedCity, currentCity, userInput) {
    // console.log('[DEBUG] ===== CITY DETECTOR - SHOULD SAVE CITY =====');
    // console.log('[DEBUG] Detected city:', detectedCity);
    // console.log('[DEBUG] Current city:', currentCity);
    // console.log('[DEBUG] User input:', userInput);

    // Always save if no current city is set
    if (!currentCity) {
        // console.log('[DEBUG] No current city set, should save');
        return true;
    }

    // Don't save if it's the same city
    if (detectedCity.toLowerCase() === currentCity.toLowerCase()) {
        // console.log('[DEBUG] Same city as current, no need to save');
        return false;
    }

    // Save if it's a clear travel/movement statement
    const travelKeywords = ['going to', 'traveling to', 'will be in', 'heading to', 'flying to', 'visiting'];
    const japaneseTravelKeywords = ['に行きます', 'に行く', 'へ行きます', 'へ行く', 'に向かいます', 'に向かう'];

    const containsTravelKeyword = travelKeywords.some(keyword =>
        userInput.toLowerCase().includes(keyword.toLowerCase())
    ) || japaneseTravelKeywords.some(keyword =>
        userInput.includes(keyword)
    );

    if (containsTravelKeyword) {
        // console.log('[DEBUG] Travel keyword detected, should save new city');
        return true;
    }

    // Save if it's a direct weather query for a different city
    const weatherKeywords = ['weather', 'forecast', 'climate', 'temperature'];
    const containsWeatherKeyword = weatherKeywords.some(keyword =>
        userInput.toLowerCase().includes(keyword.toLowerCase())
    );

    if (containsWeatherKeyword) {
        // console.log('[DEBUG] Weather query for different city, should save');
        return true;
    }

    // Default: don't change the current city for ambiguous mentions
    // console.log('[DEBUG] Ambiguous mention, keeping current city');
    return false;
}

module.exports = {
    detectCityInMessage,
    shouldSaveAsCurrentCity
};