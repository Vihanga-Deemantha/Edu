import { Router } from "express";
import * as authController from "./auth.controller.js";
import {
  registerValidation,
  loginValidation,
  registerChildValidation,
  verifyOtpValidation,
  resendOtpValidation,
  googleAuthValidation,
  completeProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "./auth.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import { authRateLimiter, otpSendLimiter, otpVerifyLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// ─── Public routes ───────────────────────────────────────────────────────────

// Registration — rate limited; returns userId + verification status, no tokens
router.post("/register", authRateLimiter, registerValidation, authController.register);

// Login — rate limited; blocked until both channels verified
router.post("/login", authRateLimiter, loginValidation, authController.login);

// OTP verification (signup flow) — rate limited to slow scripted guessing
router.post("/verify-otp", otpVerifyLimiter, verifyOtpValidation, authController.verifyOtp);

// OTP resend — OTP send rate limiter (3/15min per IP)
router.post("/resend-otp", otpSendLimiter, resendOtpValidation, authController.resendOtp);

// Token refresh — reads from httpOnly cookie
router.post("/refresh", authController.refresh);

// Forgot/reset password — reuses the same OTP infrastructure (purpose: password_reset)
router.post("/forgot-password", otpSendLimiter, forgotPasswordValidation, authController.forgotPassword);
router.post("/reset-password", otpVerifyLimiter, resetPasswordValidation, authController.resetPassword);

// ─── Google Sign-In (feature-flagged) ───────────────────────────────────────
// Route is only registered when GOOGLE_SIGNIN_ENABLED=true in .env
// This prevents crashes when GOOGLE_CLIENT_ID is not configured.
if (process.env.GOOGLE_SIGNIN_ENABLED === "true") {
  router.post("/google", googleAuthValidation, authController.googleAuth);
}

// ─── Protected routes ────────────────────────────────────────────────────────

router.post(
  "/register-child",
  authenticate,
  authorize("parent"),
  registerChildValidation,
  authController.registerChild
);

// Complete profile — only for Google Sign-In users who have no role/phone yet
router.patch(
  "/complete-profile",
  authenticate,
  completeProfileValidation,
  authController.completeProfile
);

router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);

export default router;
