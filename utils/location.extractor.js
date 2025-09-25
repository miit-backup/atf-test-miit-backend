/**
 * A simple, reliable regex-based extractor to find city names as a backup to the AI.
 * It looks for patterns like "[City]の天気は？" or "weather in [City]".
 * @param {string} text The user's input text.
 * @returns {string|null} The extracted city name or null if no match.
 */
function extractLocationWithRegex(text) {
    // console.log('[DEBUG] ===== LOCATION EXTRACTOR - REGEX EXTRACTION =====');
    // console.log('[DEBUG] Input text:', text);

    if (!text) {
        // console.log('[DEBUG] No text provided');
        return null;
    }

    // Pattern 1: Japanese - "〇〇の天気" (e.g., 東京の天気) - Updated to include Japanese characters
    // console.log('[DEBUG] Testing Japanese pattern...');
    const japanesePattern = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uFF00-\uFFEFA-Za-z\s]+?)(?:の天気|はどんな天気)/;
    const jaMatch = text.match(japanesePattern);
    if (jaMatch && jaMatch[1]) {
        // console.log('[DEBUG] Regex Extractor: Found Japanese location ->', jaMatch[1].trim());
        return jaMatch[1].trim();
    }

    // Pattern 2: English - "weather in/for [City]"
    // console.log('[DEBUG] Testing English "weather in/for" pattern...');
    const englishPattern = /weather\s+(?:in|for)\s+([A-Za-z\s]+)/i;
    const enMatch = text.match(englishPattern);
    if (enMatch && enMatch[1]) {
        // console.log('[DEBUG] Regex Extractor: Found English location ->', enMatch[1].trim());
        return enMatch[1].trim();
    }

    // Pattern 3: English - "[City]'s weather"
    // console.log('[DEBUG] Testing English possessive pattern...');
    const englishPossessivePattern = /([A-Za-z\s]+)'s\s+weather/i;
    const enPossessiveMatch = text.match(englishPossessivePattern);
    if (enPossessiveMatch && enPossessiveMatch[1]) {
        // console.log('[DEBUG] Regex Extractor: Found English location ->', enPossessiveMatch[1].trim());
        return enPossessiveMatch[1].trim();
    }

    // console.log('[DEBUG] No location pattern matched');
    return null;
}

module.exports = { extractLocationWithRegex };