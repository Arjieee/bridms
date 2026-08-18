import express from 'express';
import { login, logout, forgotPassword, resetPassword, verifyEmail, resendVerificationToken } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { loginBruteForceLimiter, otpRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', loginBruteForceLimiter, login);
router.post('/logout', requireAuth, logout);
router.post('/forgot-password', otpRateLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', otpRateLimiter, resendVerificationToken);

export default router;
