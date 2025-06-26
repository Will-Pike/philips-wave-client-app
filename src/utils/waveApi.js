const fetch = require('node-fetch');

const WAVE_API_URL = 'https://api.wave.ppds.com/graphql';
const WAVE_API_KEY = 'Basic a2V5OmpDZTlWMmdpYWdIVEFXcWcxYVFuTlE2REVUZnJySWc1OHQ3';

async function waveGraphQL(query, variables = {}) {
    const response = await fetch(WAVE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': WAVE_API_KEY,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
        throw new Error(`Wave API error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.errors) {
        throw new Error(`Wave API GraphQL error: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
}

module.exports = { waveGraphQL };