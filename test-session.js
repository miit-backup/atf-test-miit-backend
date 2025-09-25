const axios = require('axios');

const BASE_URL = 'https://atf-backend.ddns.net/api';

async function testSession() {
    try {
        // console.log('🧪 Testing session functionality...\n');

        // 1. First, make a chat request to establish session and location
        // console.log('1. Making chat request to establish session...');
        const chatResponse = await axios.post(`${BASE_URL}/chat`, {
            text: "What's the weather like?",
            sessionId: "test-session-123"
        });

        // console.log('Chat response status:', chatResponse.status);
        // console.log('Session established\n');

        // 2. Check session data using debug endpoint
        // console.log('2. Checking session data...');
        const sessionResponse = await axios.get(`${BASE_URL}/debug/session/test-session-123`);
        // console.log('Session data:', JSON.stringify(sessionResponse.data, null, 2));
        // console.log('');

        // 3. Test location endpoint with session ID
        // console.log('3. Testing location endpoint with session ID...');
        const locationResponse = await axios.get(`${BASE_URL}/location`, {
            headers: {
                'X-Session-ID': 'test-session-123'
            }
        });
        // console.log('Location response:', JSON.stringify(locationResponse.data, null, 2));
        // console.log('');

        // 4. Test location endpoint without session ID
        // console.log('4. Testing location endpoint without session ID...');
        const locationResponse2 = await axios.get(`${BASE_URL}/location`);
        // console.log('Location response (no session):', JSON.stringify(locationResponse2.data, null, 2));

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testSession();