import mongoose from "mongoose";

/**
 * RefreshToken — one document per active session, instead of a single
 * refreshTokenHash on the User document.
 *
 * WHY: a single hash-on-User means logging in on a second device silently
 * invalidates the first device's session (each login overwrites the one
 * stored hash). Multiple people using this platform on both a phone and a
 * laptop is the normal case, not an edge case, so sessions are tracked
 * independently here — one row per device/browser, each individually
 * rotatable and revocable.
 */
const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // SHA-256 hash of the refresh token JWT — never store the raw token.
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },

  // Best-effort device label for a future "manage your sessions" UI — not security-critical.
  userAgent: {
    type: String,
    default: null,
  },

  // Set on rotation (a refresh consumed this token to mint a new one) — the
  // document is kept, not deleted, specifically so a later replay of this
  // exact token can be recognized as reuse. Logout deletes its session
  // document outright instead of marking it used — see auth.service.js for
  // why those two "gone" states need to mean different things.
  used: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  // Mirrors the JWT's own expiry so Mongo can clean up dead sessions automatically.
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index — MongoDB removes a session document once its refresh token would have expired anyway.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
