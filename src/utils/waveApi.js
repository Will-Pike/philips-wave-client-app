const fetch = require('node-fetch');

const WAVE_API_URL = 'https://api.wave.ppds.com/graphql';
const WAVE_API_KEY = process.env.WAVE_API_KEY;

if (!WAVE_API_KEY) {
    throw new Error('WAVE_API_KEY environment variable is required');
}

async function waveGraphQL(query, variables = {}) {
    const response = await fetch(WAVE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': WAVE_API_KEY,
        },
        body: JSON.stringify({ query, variables }),
        timeout: 45000, // 45 second timeout - reasonable for 25 device batches
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wave API error: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    if (data.errors) {
        console.error('Wave API GraphQL errors:', JSON.stringify(data.errors, null, 2));
        throw new Error(`Wave API GraphQL error: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
}

module.exports = { waveGraphQL };