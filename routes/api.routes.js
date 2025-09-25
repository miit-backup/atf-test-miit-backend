const express = require('express');
const multer = require('multer');
const { handleChat, getRawWeather, convertToSpeech } = require('../controllers/chat.controller');
const { detectLocation } = require('../controllers/utility.controller');

const router = express.Router();

// Setup multer for in-memory file handling (for audio)
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @route   POST /api/chat
 * @desc    Main chat endpoint. Accepts text or audio file.
 * @access  Public
 *
 * Body can be:
 * 1. JSON: { "text": "...", "sessionId": "..." }
 * 2. FormData: audio (file), sessionId (text)
 */
router.post('/chat', upload.single('audio'), (req, res, next) => {
    // console.log('[DEBUG] ===== POST /api/chat - ROUTE START =====');
    // console.log('[DEBUG] Route handler called');
    // console.log('[DEBUG] Request headers:', req.headers);
    // console.log('[DEBUG] Has file:', !!req.file);
    // console.log('[DEBUG] Body keys:', Object.keys(req.body));
    handleChat(req, res, next);
});

/**
 * @route   GET /api/weather
 * @desc    Fetches raw weather data for a specific city.
 * @access  Public
 * @query   ?city=Tokyo
 */
router.get('/weather', (req, res, next) => {
    // console.log('[DEBUG] ===== GET /api/weather - ROUTE START =====');
    // console.log('[DEBUG] Route handler called');
    // console.log('[DEBUG] Query string:', req.url);
    getRawWeather(req, res, next);
});

/**
 * @route   GET /api/location
 * @desc    Detects user's location based on their IP address.
 * @access  Public
 */
router.get('/location', (req, res, next) => {
    // console.log('[DEBUG] ===== GET /api/location - ROUTE START =====');
    // console.log('[DEBUG] Route handler called');
    // console.log('[DEBUG] Query string:', req.url);
    detectLocation(req, res, next);
});

/**
 * @route   POST /api/tts
 * @desc    Converts text to speech using Google Cloud Text-to-Speech API
 * @access  Public
 *
 * Body options:
 * 1. Single text: { "text": "Hello", "language": "english" }
 * 2. Auto-detect: { "text": "こんにちは" }
 * 3. Both languages: { "mode": "both", "japaneseText": "こんにちは", "englishText": "Hello" }
 */
router.post('/tts', (req, res, next) => {
    // console.log('[DEBUG] ===== POST /api/tts - ROUTE START =====');
    // console.log('[DEBUG] Route handler called');
    // console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    convertToSpeech(req, res, next);
});

/**
 * @route   GET /api/debug/session/:sessionId
 * @desc    Debug endpoint to check session data
 * @access  Public
 */
router.get('/debug/session/:sessionId', (req, res) => {
    // console.log('[DEBUG] ===== GET /api/debug/session - ROUTE START =====');
    const { sessionId } = req.params;
    const context = require('../utils/context.manager');

    const sessionData = context.getSessionData(sessionId);
    const currentCity = context.getCurrentCityForSession(sessionId);

    res.json({
        sessionId,
        exists: !!sessionData,
        currentCity,
        historyLength: sessionData?.history?.length || 0,
        theme: sessionData?.theme || null,
        lastAccessed: sessionData?.lastAccessed ? new Date(sessionData.lastAccessed).toISOString() : null
    });
});

module.exports = router;