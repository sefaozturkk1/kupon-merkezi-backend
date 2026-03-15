const axios = require('axios');
require('dotenv').config({ path: '.env' });

const apiKey = process.env.API_FOOTBALL_KEY || 'c20a098acc9da8dab32a05d4aedeffef';
const apiHost = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';

async function testApi() {
  try {
    const searchRes = await axios.get(`https://${apiHost}/teams?search=sivas`, {
      headers: { 'x-apisports-key': apiKey }
    });
    console.log('Search Results:', JSON.stringify(searchRes.data.response, null, 2));

    if (searchRes.data.response.length > 0) {
      const teamId = searchRes.data.response[0].team.id;
      console.log('Using Team ID:', teamId);

      const today = new Date().toISOString().split('T')[0];
      const todayRes = await axios.get(`https://${apiHost}/fixtures?team=${teamId}&date=${today}`, {
        headers: { 'x-apisports-key': apiKey }
      });
      console.log('Today Matches:', JSON.stringify(todayRes.data.response.map(f => ({
        id: f.fixture.id,
        date: f.fixture.date,
        home: f.teams.home.name,
        away: f.teams.away.name,
        status: f.fixture.status.short
      })), null, 2));

      // Also check if there's any matches currently live for this team
      const liveRes = await axios.get(`https://${apiHost}/fixtures?live=all&team=${teamId}`, {
         headers: { 'x-apisports-key': apiKey }
      });
      console.log('Live Matches explicitly:', JSON.stringify(liveRes.data.response, null, 2));
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApi();
