const axios = require('axios');
const apiKey = 'c20a098acc9da8dab32a05d4aedeffef';
const apiHost = 'v3.football.api-sports.io';
const homeTeam = "SİVASSPOR".replace(/İ/g, 'I').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '');
console.log("Safe Search Term:", homeTeam);

async function testApi() {
  const result = await axios.get(`https://${apiHost}/teams?search=${encodeURIComponent(homeTeam)}`, {
    headers: { 'x-apisports-key': apiKey }
  });
  console.log(result.data.errors);
  console.log(result.data.response);
}
testApi();
