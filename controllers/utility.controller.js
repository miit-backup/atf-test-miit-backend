const { getCityFromIp } = require('../services/location.service');
const { getWeather } = require('../services/weather.service');
const context = require('../utils/context.manager');

// This function's primary purpose is now REVERSE GEOCODING
async function detectLocation(req, res) {
    // console.log('[DEBUG] ===== DETECT LOCATION HANDLER START =====');
    // console.log('[DEBUG] Query params:', req.query);
    // console.log('[DEBUG] Client IP:', req.ip);
    // console.log('[DEBUG] X-Forwarded-For:', req.headers['x-forwarded-for']);
    // console.log('[DEBUG] X-Real-IP:', req.headers['x-real-ip']);
    // console.log('[DEBUG] Connection remote address:', req.connection.remoteAddress);
    // console.log('[DEBUG] Socket remote address:', req.socket.remoteAddress);

    try {
        const { lat, lon } = req.query;
        // console.log('[DEBUG] Coordinates provided - lat:', lat, 'lon:', lon);

        if (lat && lon) {
            // console.log('[DEBUG] Using coordinates for reverse geocoding...');
            // If lat/lon are provided, use them to find the city name
            const weatherData = await getWeather({ lat, lon });
            // console.log('[DEBUG] Weather service response:', !!weatherData);

            if (weatherData && weatherData.location && weatherData.location.name) {
                // console.log('[DEBUG] Successfully found city:', weatherData.location.name);
                return res.json({ city: weatherData.location.name });
            } else {
                // console.log('[DEBUG] Could not find city for coordinates');
                return res.status(404).json({ error: "Could not find a city for the provided coordinates." });
            }
        } else {
            // console.log('[DEBUG] No coordinates provided, falling back to IP-based location...');

            // Get the real client IP, considering various proxy headers
            let clientIp = req.ip;

            // Check for forwarded IP headers (common with reverse proxies like nginx)
            if (req.headers['x-forwarded-for']) {
                const forwardedIps = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
                clientIp = forwardedIps[0]; // Get the first (original client) IP
                // console.log('[DEBUG] Using X-Forwarded-For IP:', clientIp);
            } else if (req.headers['x-real-ip']) {
                clientIp = req.headers['x-real-ip'];
                // console.log('[DEBUG] Using X-Real-IP:', clientIp);
            }

            // console.log('[DEBUG] Final client IP to use:', clientIp);

            const city = await getCityFromIp(clientIp);
            // console.log('[DEBUG] IP geolocation result:', city);

            if (city) {
                // console.log('[DEBUG] Successfully detected city from IP:', city);
                res.json({ city });
            } else {
                // console.log('[DEBUG] Could not determine location from IP');
                res.status(404).json({ error: "Could not determine location from IP address." });
            }
        }
    } catch (error) {
        console.error('[DEBUG] ERROR in detectLocation:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
    // console.log('[DEBUG] ===== DETECT LOCATION HANDLER END =====');
}

module.exports = { detectLocation };