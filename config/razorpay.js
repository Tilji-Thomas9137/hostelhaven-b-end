const Razorpay = require('razorpay');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: 'rzp_test_RVL3dTzHqSRYTV',
  key_secret: 'yc6ZIq8903j3dexTXX4Y51mL'
});

module.exports = razorpay;
