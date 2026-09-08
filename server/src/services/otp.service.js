import crypto from "crypto";
import OtpCode from "../models/OtpCode.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { sendOtpEmail } from "./email.service.js";
import { sendOtpSms } from "./sms.service.js";

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically random 6-digit OTP.
 * Uses crypto.randomInt to avoid modulo bias.
 */
export const generateOtp = () => {
  return String(crypto.randomInt(100000, 999999));
};

/**
 * Create a new OTP code and dispatch it via the appropriate channel.
 *
 * - Invalidates (deletes) any existing unexpired codes for this user/channel/purpose.
 * - Enforces 60-second cooldown: if the most recent code was created less than
 *   60 seconds ago, throws 429 — belt-and-suspenders on top of the rate limiter.
 * - Hashes the raw code with SHA-256 before storing.
 *
 * @param {string} userId
 * @param {'email'|'phone'} channel
 * @param {'signup'|'login'|'password_reset'} purpose
 */
export const createAndSendOtp = async (userId, channel, purpose) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  // Cooldown check — look for the most recent OTP for this user/channel/purpose
  const mostRecent = await OtpCode.findOne(
    { userId, channel, purpose },
    null,
    { sort: { createdAt: -1 } }
  );

  if (mostRecent) {
    const secondsSinceLastSend = (Date.now() - mostRecent.createdAt.getTime()) / 1000;
    if (secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
      throw new ApiError(
        429,
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
        "OTP_COOLDOWN"
      );
    }
  }

  // Invalidate all existing codes for this user/channel/purpose
  await OtpCode.deleteMany({ userId, channel, purpose });

  const rawCode = generateOtp();
  const codeHash = OtpCode.hashCode(rawCode);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OtpCode.create({ userId, channel, purpose, codeHash, expiresAt });

  // Dispatch via the appropriate channel
  if (channel === "email") {
    await sendOtpEmail({ to: user.email, code: rawCode, purpose });
  } else {
    await sendOtpSms({ phone: user.phone, code: rawCode, purpose });
  }
};

/**
 * Verify a submitted OTP code against the stored hash.
 *
 * On success:
 *   - Marks user.emailVerified or user.phoneVerified = true
 *   - Deletes the used OTP document
 *   - Returns the updated user
 *
 * On failure:
 *   - Increments the attempts counter
 *   - Throws 400 (wrong code) or 429 (too many attempts)
 *
 * @param {string} userId
 * @param {'email'|'phone'} channel
 * @param {'signup'|'login'|'password_reset'} purpose
 * @param {string} submittedCode - The raw 6-digit code the user entered
 * @returns {Promise<User>} - Updated user document
 */
export const verifyOtp = async (userId, channel, purpose, submittedCode) => {
  // Find the latest non-expired code (TTL index keeps expired ones cleaned up,
  // but we also check expiresAt explicitly for the race-condition window)
  const otpDoc = await OtpCode.findOne(
    { userId, channel, purpose, expiresAt: { $gt: new Date() } },
    "+codeHash" // select the normally-hidden field
  ).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new ApiError(
      400,
      "Verification code expired or not found. Please request a new one.",
      "OTP_NOT_FOUND"
    );
  }

  if (otpDoc.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "Too many failed attempts. Please request a new verification code.",
      "OTP_MAX_ATTEMPTS"
    );
  }

  const submittedHash = OtpCode.hashCode(submittedCode);
  const isMatch = submittedHash === otpDoc.codeHash;

  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    throw new ApiError(400, "Incorrect verification code.", "OTP_INVALID");
  }

  // Code is correct — update the user's verified flag
  const updateField = channel === "email" ? "emailVerified" : "phoneVerified";
  const user = await User.findByIdAndUpdate(
    userId,
    { [updateField]: true },
    { new: true }
  );

  // Delete the used OTP
  await OtpCode.deleteOne({ _id: otpDoc._id });

  return user;
};
