const axios = require('axios');
require('dotenv').config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('API key yok');
    return;
  }
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: "Merhaba, bana JSON olarak { \"status\": \"ok\" } dön." }
            ]
          }
        ]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('BAŞARILI:', JSON.stringify(response.data.candidates[0].content, null, 2));
  } catch (error) {
    console.error('HATA:', error.response?.data || error.message);
  }
}

testGemini();
