import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import ApiError from "../../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../../utils/generateTokens.js";
import { createAndSendOtp, verifyOtp } from "../../services/otp.service.js";


/**
 * Issue and store a fresh token pair for a user.
 * Extracted here because multiple flows (verify-otp, google, complete-profile)
 * all need to issue tokens once verification is complete.
 */
const issueTokens = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
};

/**
 * Shapes the public user object returned in responses.
 * Never includes passwordHash, refreshTokenHash, or adminNotes.
 */
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  authProvider: user.authProvider,
  createdAt: user.createdAt,
});

// ─── REGISTRATION ────────────────────────────────────────────────────────────

/**
 * Register a new teacher, student, or parent account.
 * Does NOT issue tokens — user must verify email AND phone first.
 * Admin accounts are never created here — seed them directly in the DB.
 */
export const registerUser = async ({ name, email, phone, password, role }) => {
  // Check for existing email or phone
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    if (existing.email === email.toLowerCase()) {
      throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");
    }
    throw new ApiError(409, "An account with this phone number already exists", "PHONE_TAKEN");
  }

  const passwordHash = await bcrypt.hash(
    password,
    Number(process.env.BCRYPT_SALT_ROUNDS) || 10
  );

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role,
    emailVerified: false,
    phoneVerified: false,
    authProvider: "local",
  });

  // Dispatch OTPs — both channels, purpose 'signup'
  // Run in parallel to reduce latency; if either fails, let the error bubble
  await Promise.all([
    createAndSendOtp(user._id, "email", "signup"),
    createAndSendOtp(user._id, "phone", "signup"),
  ]);

  return { user };
};

// ─── OTP VERIFICATION ────────────────────────────────────────────────────────

/**
 * Verify one OTP code. If both channels are now verified, issue tokens (auto-login).
 * Returns { user, fullyVerified, accessToken?, refreshToken? }
 */
export const verifyOtpAndMaybeLogin = async ({ userId, channel, purpose, code }) => {
  const updatedUser = await verifyOtp(userId, channel, purpose, code);

  if (updatedUser.emailVerified && updatedUser.phoneVerified) {
    // Both channels verified — auto-login
    const { accessToken, refreshToken } = await issueTokens(updatedUser);
    return { user: updatedUser, fullyVerified: true, accessToken, refreshToken };
  }

  return { user: updatedUser, fullyVerified: false };
};

/**
 * Resend an OTP for the given channel.
 * Cooldown and throttle logic is enforced inside createAndSendOtp.
 */
export const resendOtp = async ({ userId, channel, purpose }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  await createAndSendOtp(userId, channel, purpose);
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────

/**
 * Log in with email + password.
 * Requires both emailVerified AND phoneVerified — returns specific 403 code if not.
 */
export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+passwordHash +refreshTokenHash");

  // Generic error — don't leak whether email exists or password is wrong
  const INVALID_CREDS = new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  if (!user) throw INVALID_CREDS;
  if (user.loginDisabled) throw INVALID_CREDS;

  // Google-only accounts have no password
  if (!user.passwordHash) throw INVALID_CREDS;

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) throw INVALID_CREDS;

  if (!user.isActive) {
    throw new ApiError(403, "Account has been suspended", "ACCOUNT_SUSPENDED");
  }

  // Verification gate — both channels must be verified
  if (!user.emailVerified || !user.phoneVerified) {
    throw new ApiError(
      403,
      "Account not fully verified. Please complete email and phone verification.",
      "ACCOUNT_NOT_VERIFIED"
    );
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  return { user, accessToken, refreshToken };
};

// ─── TOKEN REFRESH ───────────────────────────────────────────────────────────

/**
 * Refresh access + refresh tokens (rotation on every use).
 * Detects reuse of rotated-out tokens (theft signal).
 */
export const refreshTokens = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    throw new ApiError(401, "No refresh token", "NO_REFRESH_TOKEN");
  }

  let decoded;
  try {
    decoded = jwt.verify(rawRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const user = await User.findById(decoded.sub).select("+refreshTokenHash");
  if (!user) {
    throw new ApiError(401, "User not found", "USER_NOT_FOUND");
  }

  const incomingHash = hashToken(rawRefreshToken);

  // Mismatch = token reuse (rotation attack signal) — invalidate everything
  if (incomingHash !== user.refreshTokenHash) {
    user.refreshTokenHash = null;
    await user.save();
    throw new ApiError(401, "Token reuse detected. Please log in again.", "TOKEN_REUSE");
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

  return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
};

// ─── CHILD REGISTRATION ──────────────────────────────────────────────────────

/**
 * Register a child (student) account managed by a parent.
 *
 * Requirements (Phase 0 upgrade, Part D):
 * - Parent must be fully verified (emailVerified && phoneVerified)
 * - attestedGuardianship must be true in the request
 * - Child gets no email/phone (placeholder values), no password, loginDisabled
 */
export const registerChild = async ({ name, grade, parentId, attestedGuardianship }) => {
  if (!attestedGuardianship) {
    throw new ApiError(
      400,
      "You must confirm that you are the parent or legal guardian of this child.",
      "ATTESTATION_REQUIRED"
    );
  }

  const parent = await User.findById(parentId);
  if (!parent) throw new ApiError(404, "Parent account not found", "USER_NOT_FOUND");

  if (!parent.emailVerified || !parent.phoneVerified) {
    throw new ApiError(
      403,
      "Your account must be fully verified before you can add child accounts.",
      "ACCOUNT_NOT_VERIFIED"
    );
  }

  const ts = Date.now();
  const child = await User.create({
    name,
    role: "student",
    // Placeholder email/phone — unique via timestamp so siblings don't collide
    email: `child.${parentId}.${ts}@nologin.local`,
    phone: `0${String(ts).slice(-9)}`,
    passwordHash: null,
    loginDisabled: true,
    parentId,
    emailVerified: false,
    phoneVerified: false,
    grade: grade || null,
    attestedAt: new Date(),
  });

  await User.findByIdAndUpdate(parentId, {
    $push: { linkedChildIds: child._id },
  });

  return child;
};

// ─── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────

/**
 * Google Sign-In — verify idToken, find-or-create user.
 *
 * Returns one of three states:
 *   1. { user, tokens } — fully set up, tokens issued
 *   2. { user, profileIncomplete: true, reason: 'phone_unverified' } — has role, needs phone OTP
 *   3. { user, profileIncomplete: true, reason: 'no_role' } — new user, needs role + phone
 */
export const googleAuth = async (idToken) => {
  if (process.env.GOOGLE_SIGNIN_ENABLED !== "true") {
    throw new ApiError(404, "Google Sign-In is not enabled.", "GOOGLE_SIGNIN_DISABLED");
  }

  // Dynamic import — only loaded when feature is enabled
  const { verifyGoogleIdToken } = await import("../../services/google.service.js");
  const { email, name, sub, email_verified } = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ $or: [{ googleId: sub }, { email }] });

  if (user) {
    // Existing account — link Google if not already linked
    if (!user.googleId) {
      user.googleId = sub;
    }
    if (email_verified && !user.emailVerified) {
      user.emailVerified = true;
    }
    await user.save();
  } else {
    // New user — create with Google provider, no password, no role yet
    // role is intentionally omitted — set in completeProfile.
    // We use a temporary placeholder for role to satisfy the required constraint
    // until completeProfile sets the real value.
    user = await User.create({
      name,
      email,
      // Temporary phone placeholder — replaced when user completes profile
      phone: `+94700${String(sub).slice(-6)}`,
      passwordHash: null,
      authProvider: "google",
      googleId: sub,
      emailVerified: email_verified || false,
      phoneVerified: false,
      role: "student", // placeholder — overwritten in completeProfile for new Google users
    });
  }

  // Determine what the frontend should do next
  if (!user.role) {
    return { user, profileIncomplete: true, reason: "no_role" };
  }

  if (!user.phoneVerified) {
    return { user, profileIncomplete: true, reason: "phone_unverified" };
  }

  // Fully set up — issue tokens
  const { accessToken, refreshToken } = await issueTokens(user);
  return { user, profileIncomplete: false, accessToken, refreshToken };
};

/**
 * Complete profile for a Google Sign-In user who has no role or phone yet.
 * Protected route — only the owning user can call this.
 */
export const completeProfile = async ({ userId, role, phone }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  if (user.role && user.phone && !user.phone.startsWith("+94700")) {
    throw new ApiError(409, "Profile already complete", "PROFILE_ALREADY_COMPLETE");
  }

  // Check phone isn't taken by another account
  const phoneExists = await User.findOne({ phone, _id: { $ne: userId } });
  if (phoneExists) {
    throw new ApiError(409, "An account with this phone number already exists", "PHONE_TAKEN");
  }

  user.role = role;
  user.phone = phone;
  user.phoneVerified = false;
  await user.save();

  // Send phone OTP
  await createAndSendOtp(userId, "phone", "signup");

  return user;
};

// Named export for shaping public user — used by controller
export { publicUser };
