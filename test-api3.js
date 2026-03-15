const axios = require('axios');
const apiKey = 'c20a098acc9da8dab32a05d4aedeffef';
const apiHost = 'v3.football.api-sports.io';

async function searchMatch() {
  try {
    const searchRes = await axios.get(`https://${apiHost}/teams?search=sivas`, {
      headers: { 'x-apisports-key': apiKey }
    });
    const teamId = searchRes.data.response[0].team.id;
    console.log('Sivas Team ID:', teamId);

    const matchFound = await axios.get(`https://${apiHost}/fixtures?team=${teamId}&live=all`, {
       headers: { 'x-apisports-key': apiKey }
    });
    
    console.log("Maçı API'dan çekiyor mu?:", matchFound.data.response.length > 0 ? "EVET BİR MAÇ BULDU! ✅" : "HAYIR MAÇ BULAMADI ❌");
    if(matchFound.data.response.length > 0) {
       console.log("Ev Sahibi:", matchFound.data.response[0].teams.home.name);
       console.log("Deplasman:", matchFound.data.response[0].teams.away.name);
    }
  } catch(e) { console.error(e) }
}
searchMatch();
