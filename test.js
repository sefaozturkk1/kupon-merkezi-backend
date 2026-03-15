const axios = require('axios');
axios.get('http://localhost:3000/api/football/today').then(res => console.log(res.status, res.data.length)).catch(err => console.error(err.message, err.response?.data));

axios.get('http://localhost:3000/api/coupons/my-coupons', { headers: { Authorization: 'Bearer test' } }).then(res => console.log(res.status)).catch(err => console.error('coupons fetch err', err.message, err.response?.data));
