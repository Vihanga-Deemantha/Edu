import rateLimit from "express-rate-limit";

/**
 * Auth rate limiter — applied to /login and /register.
 * Limits each IP to 10 requests per 15-minute window.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many attempts from this IP. Please try again after 15 minutes.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
});

/**
 * OTP send rate limiter — applied to /resend-otp.
 * Max 3 OTP send requests per IP per 15-minute window.
 * Note: 60-second per-user cooldown is also enforced inside otp.service.js
 * as a belt-and-suspenders measure.
 */
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many OTP requests. Please wait 15 minutes before trying again.",
      code: "OTP_RATE_LIMIT_EXCEEDED",
    },
  },
});

// Keep a default export for any code that still imports this way
export default authRateLimiter;
