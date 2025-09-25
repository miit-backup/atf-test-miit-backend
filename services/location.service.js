const axios = require('axios');

async function getCityFromIp(ip) {
    // console.log('[DEBUG] ===== LOCATION SERVICE - GET CITY FROM IP START =====');
    // console.log('[DEBUG] Input IP:', ip);

    // For local testing, '::1' or '127.0.0.1' won't work. We'll default to a sample city.
    if (ip === '::1' || ip === '127.0.0.1') {
        // console.log('[DEBUG] Local IP detected, returning default city');
        return 'Tokyo'; // Default for local development
    }

    try {
        const apiUrl = `${process.env.IP_GEOLOCATION_API}${ip}`;
        // console.log('[DEBUG] Making API request to:', apiUrl);

        const response = await axios.get(apiUrl);
        // console.log('[DEBUG] API response status:', response.status);
        // console.log('[DEBUG] API response data:', response.data);

        if (response.data && response.data.status === 'success') {
            // console.log('[DEBUG] Successfully retrieved city:', response.data.city);
            // console.log('[DEBUG] ===== LOCATION SERVICE - GET CITY FROM IP END =====');
            return response.data.city;
        }

        // console.log('[DEBUG] API response not successful or invalid format');
        // console.log('[DEBUG] ===== LOCATION SERVICE - GET CITY FROM IP END =====');
        return null;
    } catch (error) {
        console.error('[DEBUG] ERROR fetching location from IP:', error.message);
        console.error('[DEBUG] Error stack:', error.stack);
        // console.log('[DEBUG] ===== LOCATION SERVICE - GET CITY FROM IP END (ERROR) =====');
        return null; // Return null on failure
    }
}

module.exports = { getCityFromIp };