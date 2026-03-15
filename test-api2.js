const axios = require('axios');
const apiKey = 'c20a098acc9da8dab32a05d4aedeffef';
const apiHost = 'v3.football.api-sports.io';

async function testSivasMatches2() {
  try {
    const searchRes = await axios.get(`https://${apiHost}/teams?search=sivas`, {
      headers: { 'x-apisports-key': apiKey }
    });
    const teamId = searchRes.data.response[0].team.id;
    console.log('Sivas Team ID:', teamId);

    const liveRes = await axios.get(`https://${apiHost}/fixtures?live=all&team=${teamId}`, {
       headers: { 'x-apisports-key': apiKey }
    });
    console.log('Live Result:', JSON.stringify(liveRes.data, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
}
testSivasMatches2();
