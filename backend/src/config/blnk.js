const axios = require('axios');

const blnkClient = axios.create({
  baseURL: process.env.BLNK_URL || 'http://blnk:5001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

blnkClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message;
    const status = error.response?.status || 500;
    const err = new Error(message);
    err.status = status;
    return Promise.reject(err);
  }
);

module.exports = blnkClient;