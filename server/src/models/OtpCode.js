import mongoose from "mongoose";
import crypto from "crypto";

/**
 * OtpCode — stores hashed one-time passwords for email/phone verification.
 *
 * SECURITY NOTES:
 * - Raw OTP codes are NEVER stored — only a SHA-256 hash.
 * - TTL index on expiresAt: MongoDB auto-deletes expired documents, no cron needed.
 * - attempts counter prevents brute force: locked after 5 bad guesses.
 */
const otpCodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Which contact channel this code verifies
    channel: {
      type: String,
      enum: ["email", "phone"],
      required: true,
    },

    // SHA-256 hash of the 6-digit code — never stored in plaintext
    codeHash: {
      type: String,
      required: true,
      select: false, // never returned in queries unless explicitly requested
    },

    // Scopes code reuse — a 'signup' code won't validate a 'password_reset' flow
    purpose: {
      type: String,
      enum: ["signup", "login", "password_reset"],
      required: true,
    },

    // Time at which this code expires (now + 10 minutes on creation)
    expiresAt: {
      type: Date,
      required: true,
    },

    // Incremented on each failed verify; code locked after 5 attempts
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // only need createdAt
  }
);

// TTL index — MongoDB automatically removes documents after expiresAt
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookups by the fields we always query together
otpCodeSchema.index({ userId: 1, channel: 1, purpose: 1 });

/**
 * Hash a raw OTP code for safe storage/comparison.
 * Uses SHA-256 (not bcrypt) because OTPs are short-lived and randomly generated —
 * the threat model here is DB breach, not offline cracking of a chosen password.
 */
otpCodeSchema.statics.hashCode = (rawCode) => {
  return crypto.createHash("sha256").update(rawCode).digest("hex");
};

const OtpCode = mongoose.model("OtpCode", otpCodeSchema);

export default OtpCode;
