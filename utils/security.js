const { randomBytes } = require('crypto');

function generateActivationToken() {
  return randomBytes(32).toString('hex');
}

function generateOtpCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

function getExpiryFromNowMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getExpiryFromNowHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

module.exports = {
  generateActivationToken,
  generateOtpCode,
  getExpiryFromNowMinutes,
  getExpiryFromNowHours
};


