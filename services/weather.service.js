const axios = require('axios');

const BASE_URL = 'http://api.weatherapi.com/v1';

// The function now accepts a 'locationIdentifier' which can be a string (city)
// or an object ({ lat, lon }).
async function getWeather(locationIdentifier) {
    // console.log('[DEBUG] ===== WEATHER SERVICE - GET WEATHER START =====');
    // console.log('[DEBUG] Location identifier:', locationIdentifier);
    // console.log('[DEBUG] Identifier type:', typeof locationIdentifier);

    if (!locationIdentifier) {
        console.error('[DEBUG] No location identifier provided');
        throw new Error('Location identifier (city or coords) is required for weather lookup.');
    }

    // Format the query parameter based on the type of the identifier
    let locationQuery;
    if (typeof locationIdentifier === 'string') {
        // console.log('[DEBUG] Using string location identifier');
        locationQuery = locationIdentifier;
    } else if (typeof locationIdentifier === 'object' && locationIdentifier.lat && locationIdentifier.lon) {
        // console.log('[DEBUG] Using coordinate location identifier');
        locationQuery = `${locationIdentifier.lat},${locationIdentifier.lon}`;
    } else {
        console.error('[DEBUG] Invalid location identifier format');
        throw new Error('Invalid location identifier provided.');
    }

    // console.log('[DEBUG] Final location query:', locationQuery);

    try {
        const apiUrl = `${BASE_URL}/forecast.json`;
        const params = {
            key: process.env.WEATHER_API_KEY,
            q: locationQuery, // The query is now dynamic
            days: 3,
            aqi: 'no',
            alerts: 'no',
        };

        // console.log('[DEBUG] Making weather API request to:', apiUrl);
        // console.log('[DEBUG] Request params:', { ...params, key: '[HIDDEN]' });

        const response = await axios.get(apiUrl, { params });

        // console.log('[DEBUG] Weather API response status:', response.status);
        // console.log('[DEBUG] Weather location found:', response.data?.location?.name);
        // console.log('[DEBUG] Current temperature:', response.data?.current?.temp_c);
        // console.log('[DEBUG] ===== WEATHER SERVICE - GET WEATHER END =====');

        return response.data;
    } catch (error) {
        // console.log('[DEBUG] Weather API error occurred');
        // console.log('[DEBUG] Error status:', error.response?.status);
        // console.log('[DEBUG] Error message:', error.message);

        if (error.response && error.response.status === 400) {
            // console.log('[DEBUG] Bad request (400) - returning null for invalid location');
            // console.log('[DEBUG] ===== WEATHER SERVICE - GET WEATHER END (400) =====');
            return null;
        }

        console.error('[DEBUG] Unexpected weather API error:', error.message);
        console.error('[DEBUG] Error stack:', error.stack);
        // console.log('[DEBUG] ===== WEATHER SERVICE - GET WEATHER END (ERROR) =====');
        throw new Error('Could not fetch weather data.');
    }
}

module.exports = { getWeather };