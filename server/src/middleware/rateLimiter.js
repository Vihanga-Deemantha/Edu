import rateLimit from "express-rate-limit";

/**
 * Automated tests drive these routes far harder, far faster, and all from
 * the same loopback "IP" than any real user would — without this, the
 * in-memory per-IP counters trip partway through a normal test run and every
 * test after that point fails with a 429 that has nothing to do with what
 * it's actually testing. Rate limiting is an HTTP-layer concern the test
 * suite deliberately bypasses, not a behavior under test itself.
 */
const skipInTest = () => process.env.NODE_ENV === "test";

/**
 * Auth rate limiter — applied to /login and /register.
 * Limits each IP to 10 requests per 15-minute window.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
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
  skip: skipInTest,
  message: {
    success: false,
    error: {
      message: "Too many OTP requests. Please wait 15 minutes before trying again.",
      code: "OTP_RATE_LIMIT_EXCEEDED",
    },
  },
});

/**
 * OTP verify limiter — applied to /verify-otp itself.
 * The 5-attempt lock in otp.service.js caps guesses against a single code,
 * but nothing previously capped how fast those 5 guesses (or repeated
 * requests for fresh codes via resend) could be fired at the endpoint.
 * A generous ceiling — legitimate users fat-finger codes and retry.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    success: false,
    error: {
      message: "Too many verification attempts. Please wait a few minutes before trying again.",
      code: "OTP_VERIFY_RATE_LIMIT",
    },
  },
});

// Keep a default export for any code that still imports this way
export default authRateLimiter;
