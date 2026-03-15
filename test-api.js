const axios = require('axios');
const apiKey = 'c20a098acc9da8dab32a05d4aedeffef';
const apiHost = 'v3.football.api-sports.io';

async function testSivasMatches() {
  try {
    const searchRes = await axios.get(`https://${apiHost}/teams?search=sivas`, {
      headers: { 'x-apisports-key': apiKey }
    });
    const teamId = searchRes.data.response[0].team.id;
    console.log('Sivas Team ID:', teamId);

    console.log('\n--- LIVE MATCHES ---');
    const liveRes = await axios.get(`https://${apiHost}/fixtures?live=all&team=${teamId}`, {
       headers: { 'x-apisports-key': apiKey }
    });
    
    // YENİ EK: Bugünün maçını bir de normal şekilde al
    const today = new Date().toISOString().split('T')[0];
    const todayRes = await axios.get(`https://${apiHost}/fixtures?date=${today}&team=${teamId}`, {
       headers: { 'x-apisports-key': apiKey }
    });

    console.log('Live matches length:', liveRes.data.response.length);
    console.log('Today matches length:', todayRes.data.response.length);
    if(todayRes.data.response.length > 0) {
      console.log('Today Match:', todayRes.data.response[0].teams);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}
testSivasMatches();
