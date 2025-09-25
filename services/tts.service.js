const textToSpeech = require('@google-cloud/text-to-speech');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_BASE64 env variable not set.");
}

const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8')
);

const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });

/**
 * Converts text to speech using Google Cloud Text-to-Speech API
 * Automatically detects language and uses appropriate voice
 * @param {string} text - The text to convert to speech
 * @param {string} languageHint - Optional language hint ('ja' for Japanese, 'en' for English)
 * @returns {Promise<Buffer>} - Audio data as MP3 buffer
 */
async function convertTextToSpeech(text, languageHint = null) {
    // console.log('[DEBUG] ===== TTS SERVICE - CONVERT TEXT TO SPEECH START =====');
    // console.log('[DEBUG] Text length:', text?.length);
    // console.log('[DEBUG] Language hint:', languageHint);
    // console.log('[DEBUG] Text preview:', text?.substring(0, 100) + '...');

    if (!text || text.trim().length === 0) {
        throw new Error('No text provided for TTS conversion');
    }

    // Detect language and select appropriate voice
    const { languageCode, voiceName, ssmlGender } = selectVoiceConfig(text, languageHint);
    // console.log('[DEBUG] Selected voice config:', { languageCode, voiceName, ssmlGender });

    const request = {
        input: { text: text },
        voice: {
            languageCode: languageCode,
            name: voiceName,
            ssmlGender: ssmlGender,
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
        },
    };

    try {
        // console.log('[DEBUG] Sending request to Google Text-to-Speech API...');
        const [response] = await ttsClient.synthesizeSpeech(request);
        // console.log('[DEBUG] TTS API responded successfully');
        // console.log('[DEBUG] Audio content length:', response.audioContent?.length);

        // console.log('[DEBUG] ===== TTS SERVICE - CONVERT TEXT TO SPEECH END =====');
        return response.audioContent;
    } catch (error) {
        console.error('[DEBUG] ERROR in Google Text-to-Speech:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        // console.log('[DEBUG] ===== TTS SERVICE - CONVERT TEXT TO SPEECH END (ERROR) =====');
        throw new Error('Failed to convert text to speech: ' + error.message);
    }
}

/**
 * Selects appropriate voice configuration based on text content and language hint
 * @param {string} text - The text to analyze
 * @param {string} languageHint - Optional language hint
 * @returns {object} - Voice configuration object
 */
function selectVoiceConfig(text, languageHint) {
    // console.log('[DEBUG] ===== TTS SERVICE - SELECT VOICE CONFIG =====');

    let languageCode, voiceName, ssmlGender;

    // If language hint is provided, use it
    if (languageHint) {
        if (languageHint.toLowerCase().includes('ja') || languageHint.toLowerCase() === 'japanese') {
            // console.log('[DEBUG] Using Japanese voice based on hint');
            return {
                languageCode: 'ja-JP',
                voiceName: 'ja-JP-Neural2-B',
                ssmlGender: 'FEMALE'
            };
        } else if (languageHint.toLowerCase().includes('en') || languageHint.toLowerCase() === 'english') {
            // console.log('[DEBUG] Using English voice based on hint');
            return {
                languageCode: 'en-US',
                voiceName: 'en-US-Neural2-F',
                ssmlGender: 'FEMALE'
            };
        }
    }

    // Auto-detect language based on text content
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);

    if (hasJapanese && !hasEnglish) {
        // Pure Japanese text
        // console.log('[DEBUG] Detected Japanese text');
        languageCode = 'ja-JP';
        voiceName = 'ja-JP-Neural2-B';
        ssmlGender = 'FEMALE';
    } else if (hasEnglish && !hasJapanese) {
        // Pure English text
        // console.log('[DEBUG] Detected English text');
        languageCode = 'en-US';
        voiceName = 'en-US-Neural2-F';
        ssmlGender = 'FEMALE';
    } else if (hasJapanese && hasEnglish) {
        // Mixed language - prioritize Japanese for this app
        // console.log('[DEBUG] Detected mixed language, using Japanese voice');
        languageCode = 'ja-JP';
        voiceName = 'ja-JP-Neural2-B';
        ssmlGender = 'FEMALE';
    } else {
        // Default to English
        // console.log('[DEBUG] No clear language detected, defaulting to English');
        languageCode = 'en-US';
        voiceName = 'en-US-Neural2-F';
        ssmlGender = 'FEMALE';
    }

    // console.log('[DEBUG] Final voice selection:', { languageCode, voiceName, ssmlGender });
    return { languageCode, voiceName, ssmlGender };
}

/**
 * Converts text to speech with specific language
 * @param {string} text - Text to convert
 * @param {string} language - 'japanese' or 'english'
 * @returns {Promise<Buffer>} - Audio data as MP3 buffer
 */
async function convertTextToSpeechWithLanguage(text, language) {
    // console.log('[DEBUG] ===== TTS SERVICE - CONVERT WITH SPECIFIC LANGUAGE =====');
    // console.log('[DEBUG] Target language:', language);

    const languageHint = language.toLowerCase() === 'japanese' ? 'ja' : 'en';
    return await convertTextToSpeech(text, languageHint);
}

/**
 * Converts both Japanese and English responses to speech
 * @param {string} japaneseText - Japanese text
 * @param {string} englishText - English text
 * @returns {Promise<object>} - Object containing both audio buffers
 */
async function convertBothLanguagesToSpeech(japaneseText, englishText) {
    // console.log('[DEBUG] ===== TTS SERVICE - CONVERT BOTH LANGUAGES =====');

    try {
        const [japaneseAudio, englishAudio] = await Promise.all([
            convertTextToSpeech(japaneseText, 'ja'),
            convertTextToSpeech(englishText, 'en')
        ]);

        return {
            japanese: japaneseAudio,
            english: englishAudio
        };
    } catch (error) {
        console.error('[DEBUG] ERROR converting both languages:', error);
        throw error;
    }
}

module.exports = {
    convertTextToSpeech,
    convertTextToSpeechWithLanguage,
    convertBothLanguagesToSpeech
};