
const express = require('express');

const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/* =====================================================
   Authentication Routes
   ===================================================== */

// Register a new user
router.post(
  '/register',
  authController.register
);

// Login
router.post(
  '/login',
  authController.login
);

// Verify email using OTP
router.post(
  '/verify',
  authController.verifyEmail
);

// Resend email verification OTP
router.post(
  '/resend-otp',
  authController.resendOtp
);

// Forgot password
router.post(
  '/forgot-password',
  authController.forgotPassword
);

// Change password
// Requires a valid authentication token
router.put(
  '/change-password',
  verifyToken,
  authController.changePassword
);

module.exports = router;

