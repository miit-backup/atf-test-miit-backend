const cuid = require('cuid');

// In-memory store. Each session now holds history, a theme, and a lastAccessed timestamp.
const conversations = new Map();
const MAX_HISTORY_LENGTH = 8; // Keep the last 4 user/model turns
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Retrieves a session's data and updates its lastAccessed timestamp to mark it as active.
 * @param {string} sessionId The ID of the session to retrieve.
 * @returns {object|null} The session object or null if not found.
 */
function getSessionData(sessionId) {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - GET SESSION DATA =====');
    // console.log('[DEBUG] Requested sessionId:', sessionId);
    // console.log('[DEBUG] Total sessions in store:', conversations.size);

    if (!sessionId || !conversations.has(sessionId)) {
        // console.log('[DEBUG] Session not found or invalid sessionId');
        return null;
    }

    const session = conversations.get(sessionId);
    // console.log('[DEBUG] Session found - theme:', session.theme);
    // console.log('[DEBUG] Session history length:', session.history?.length);

    // CRITICAL: Update the timestamp on every interaction to keep the session alive.
    session.lastAccessed = Date.now();
    conversations.set(sessionId, session);
    // console.log('[DEBUG] Session timestamp updated');

    return session;
}

function updateHistory(sessionId, userMessage, modelResponse) {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - UPDATE HISTORY =====');
    // console.log('[DEBUG] SessionId:', sessionId);
    // console.log('[DEBUG] User message length:', userMessage?.length);
    // console.log('[DEBUG] Model response keys:', Object.keys(modelResponse || {}));

    const session = getSessionData(sessionId); // This automatically updates the timestamp
    if (!session) {
        // console.log('[DEBUG] Session not found, cannot update history');
        return;
    }

    // console.log('[DEBUG] Current history length before update:', session.history.length);

    session.history.push({ role: 'user', parts: [{ text: userMessage }] });
    session.history.push({ role: 'model', parts: [{ text: JSON.stringify(modelResponse) }] });

    // console.log('[DEBUG] History length after adding new entries:', session.history.length);

    while (session.history.length > MAX_HISTORY_LENGTH) {
        const removed = session.history.shift();
        // console.log('[DEBUG] Removed oldest history entry, role:', removed.role);
    }

    // console.log('[DEBUG] Final history length:', session.history.length);
    conversations.set(sessionId, session);
}

function setThemeForSession(sessionId, theme) {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - SET THEME =====');
    // console.log('[DEBUG] SessionId:', sessionId);
    // console.log('[DEBUG] New theme:', theme);

    const session = getSessionData(sessionId); // This automatically updates the timestamp
    if (session) {
        const oldTheme = session.theme;
        session.theme = theme;
        conversations.set(sessionId, session);
        // console.log('[DEBUG] Theme updated from', oldTheme, 'to', theme);
    } else {
        // console.log('[DEBUG] Session not found, cannot set theme');
    }
}

function createSession() {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - CREATE SESSION =====');
    const sessionId = cuid();
    const newSession = {
        history: [],
        theme: null,
        currentCity: null, // Store the most recently mentioned city
        lastAccessed: Date.now()
    };

    conversations.set(sessionId, newSession);
    // console.log('[DEBUG] New session created:', sessionId);
    // console.log('[DEBUG] Total sessions now:', conversations.size);

    return sessionId;
}

/**
 * The cleanup function that will be run periodically by our cron job.
 * It iterates over all sessions and removes any that have been inactive for too long.
 */
function cleanupInactiveSessions() {
    const now = Date.now();
    // console.log(`[Session Cleanup] Running cleanup task. Current sessions: ${conversations.size}`);
    for (const [sessionId, session] of conversations.entries()) {
        const inactiveDuration = now - session.lastAccessed;
        if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
            conversations.delete(sessionId);
            // console.log(`[Session Cleanup] Removed inactive session ${sessionId}. Was inactive for ${Math.round(inactiveDuration / 60000)} minutes.`);
        }
    }
    // console.log(`[Session Cleanup] Finished. Remaining sessions: ${conversations.size}`);
}

function setCurrentCityForSession(sessionId, city) {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - SET CURRENT CITY =====');
    // console.log('[DEBUG] SessionId:', sessionId);
    // console.log('[DEBUG] New city:', city);

    const session = getSessionData(sessionId); // This automatically updates the timestamp
    if (session) {
        const oldCity = session.currentCity;
        session.currentCity = city;
        conversations.set(sessionId, session);
        // console.log('[DEBUG] Current city updated from', oldCity, 'to', city);
    } else {
        // console.log('[DEBUG] Session not found, cannot set current city');
    }
}

function getCurrentCityForSession(sessionId) {
    // console.log('[DEBUG] ===== CONTEXT MANAGER - GET CURRENT CITY =====');
    // console.log('[DEBUG] SessionId:', sessionId);

    const session = getSessionData(sessionId);
    if (session && session.currentCity) {
        // console.log('[DEBUG] Current city found:', session.currentCity);
        return session.currentCity;
    }

    // console.log('[DEBUG] No current city found in session');
    return null;
}

module.exports = {
    getSessionData,
    updateHistory,
    createSession,
    setThemeForSession,
    setCurrentCityForSession,
    getCurrentCityForSession,
    cleanupInactiveSessions,
};