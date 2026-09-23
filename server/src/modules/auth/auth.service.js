import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../../models/User.js";
import RefreshToken from "../../models/RefreshToken.js";
import ApiError from "../../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../../utils/generateTokens.js";
import { createAndSendOtp, verifyOtp } from "../../services/otp.service.js";

const MAX_PLACEHOLDER_RETRIES = 3;

/**
 * User.email is `lowercase: true` on the schema, but that's a setter that
 * only fires on assignment/save — it does nothing to a query filter. Every
 * lookup-by-email site normalizes through this first, or a user who typed
 * "Jane.Doe@Gmail.com" once (stored as "jane.doe@gmail.com") silently fails
 * to match on a later login/reset attempt if they type it differently.
 */
const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * Issue and store a fresh token pair for a user, as a new session.
 * Each call creates a NEW RefreshToken document rather than overwriting a
 * single stored hash — this is what lets someone stay logged in on their
 * phone and laptop at the same time. Extracted here because multiple flows
 * (login, verify-otp, google, complete-profile refresh) all need to issue
 * tokens once verification is complete.
 */
const issueTokens = async (user, userAgent = null) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const decoded = jwt.decode(refreshToken);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    userAgent,
    expiresAt: new Date(decoded.exp * 1000),
  });

  return { accessToken, refreshToken };
};

/**
 * Shapes the public user object returned in responses.
 * Never includes passwordHash or adminNotes.
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
  profileComplete: user.profileComplete,
  createdAt: user.createdAt,
});

/**
 * Generates a random Sri Lankan-shaped phone number for accounts that don't
 * have a real one yet (new Google sign-ups before they complete their
 * profile). Fully random rather than a recognizable fixed prefix — an
 * earlier version used a fixed "+94700" prefix as a signal for "this is a
 * placeholder," but 070 is a real, commonly-issued Sri Lankan mobile prefix,
 * so a genuine user's real number could collide with that signal. Whether a
 * profile is complete is tracked explicitly via User.profileComplete now, so
 * this value no longer needs to be recognizable — just valid-shaped and
 * unlikely to collide (collision is still handled by the retry wrapper below).
 */
const generatePlaceholderPhone = () => `+94${crypto.randomInt(100000000, 999999999)}`;

const generateChildPlaceholderContact = () => ({
  email: `child.${crypto.randomBytes(8).toString("hex")}@nologin.local`,
  phone: generatePlaceholderPhone(),
});

// ─── REGISTRATION ────────────────────────────────────────────────────────────

/**
 * Register a new teacher, student, or parent account.
 * Does NOT issue tokens — user must verify email AND phone first.
 * Admin accounts are never created here — seed them directly in the DB.
 */
export const registerUser = async ({ name, email, phone, password, role }) => {
  const normalizedEmail = normalizeEmail(email);

  // Check for existing email or phone
  const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone }] });
  if (existing) {
    if (existing.email === normalizedEmail) {
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
    email: normalizedEmail,
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
export const verifyOtpAndMaybeLogin = async ({ userId, channel, purpose, code, userAgent }) => {
  const updatedUser = await verifyOtp(userId, channel, purpose, code);

  if (updatedUser.emailVerified && updatedUser.phoneVerified) {
    // Both channels verified — auto-login
    const { accessToken, refreshToken } = await issueTokens(updatedUser, userAgent);
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
export const loginUser = async ({ email, password, userAgent }) => {
  const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash");

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

  // Verification gate — both channels must be verified.
  // Carries userId in the error's data so the frontend can jump straight to
  // /verify-otp for THIS account — previously this response gave no way for
  // the client to know who to verify, which was a dead end in the UI.
  if (!user.emailVerified || !user.phoneVerified) {
    throw new ApiError(
      403,
      "Account not fully verified. Please complete email and phone verification.",
      "ACCOUNT_NOT_VERIFIED",
      { userId: user._id }
    );
  }

  const { accessToken, refreshToken } = await issueTokens(user, userAgent);
  return { user, accessToken, refreshToken };
};

// ─── TOKEN REFRESH ───────────────────────────────────────────────────────────

/**
 * Refresh access + refresh tokens (rotation on every use).
 * Detects reuse of rotated-out tokens (theft signal) by checking against the
 * RefreshToken collection instead of a single stored hash — this also means
 * a user's other active sessions (other devices) are untouched by a normal
 * refresh on this one.
 *
 * Two different "no active session" cases have to be told apart here:
 *   - the token was already rotated away by an earlier refresh, and this is
 *     a REPLAY of it → real reuse/theft signal → revoke every session
 *   - there's simply no record of this token at all (never issued, or its
 *     session was ended by an ordinary logout) → NOT a theft signal, just an
 *     invalid session; an earlier version of this function treated both
 *     cases identically, so logging out on one device silently logged out
 *     every other device the next time each tried to refresh
 * A rotated token is therefore marked `used` and kept (not deleted) so a
 * later lookup can distinguish "rotated, now being replayed" from "was
 * logged out" — logout still hard-deletes its session document outright,
 * since a logged-out token being reused later carries no reuse signal.
 *
 * The claim below (findOneAndUpdate filtered on used:false) is atomic —
 * only one concurrent request can flip a given token from used:false to
 * true. An earlier version read `stored.used`, decided, and wrote
 * `stored.used = true` as two separate steps, which let two near-simultaneous
 * refresh calls on the same token (e.g. two browser tabs racing right after
 * their access tokens expired) both pass the check before either write
 * landed, silently minting two sessions from one rotation. Now the second of
 * two racing requests finds the atomic claim already lost and is treated as
 * reuse — the standard, intentionally fail-closed behavior for rotating
 * refresh tokens (forces a fresh login on the rare race, rather than
 * silently allowing a double-spend).
 */
export const refreshTokens = async (rawRefreshToken, userAgent) => {
  if (!rawRefreshToken) {
    throw new ApiError(401, "No refresh token", "NO_REFRESH_TOKEN");
  }

  let decoded;
  try {
    decoded = jwt.verify(rawRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const incomingHash = hashToken(rawRefreshToken);

  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: incomingHash, used: false },
    { $set: { used: true } },
    { new: false }
  );

  if (!claimed) {
    // Either never existed, or existed but was already claimed (by a prior
    // rotation, or by the other side of the race this atomic claim closes).
    const existing = await RefreshToken.findOne({ tokenHash: incomingHash });
    if (existing) {
      await RefreshToken.deleteMany({ userId: existing.userId });
      throw new ApiError(401, "Token reuse detected. Please log in again.", "TOKEN_REUSE");
    }
    throw new ApiError(401, "Session not found. Please log in again.", "INVALID_REFRESH_TOKEN");
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, "User not found", "USER_NOT_FOUND");
  }
  // Without this, a user suspended (Phase 14) after already logging in
  // could keep refreshing this same session for up to the refresh token's
  // full lifetime (7 days by default) — isActive alone, checked only at
  // login, would block a NEW login but not an already-issued session from
  // renewing. suspendUser also revokes every RefreshToken immediately, so
  // this is defense in depth, not the only thing making suspension work.
  if (!user.isActive) {
    throw new ApiError(403, "Account has been suspended", "ACCOUNT_SUSPENDED");
  }

  const { accessToken, refreshToken } = await issueTokens(user, userAgent ?? claimed.userAgent);

  return { user, accessToken, refreshToken };
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

/**
 * Logs out the CURRENT session only (the device this refresh-token cookie
 * belongs to) — other devices the user is logged in on stay logged in.
 */
export const logoutUser = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  await RefreshToken.deleteOne({ tokenHash: hashToken(rawRefreshToken) });
};

// ─── CHILD REGISTRATION ──────────────────────────────────────────────────────

const createChildWithRetry = async ({ name, grade, parentId }, attempt = 0) => {
  const { email, phone } = generateChildPlaceholderContact();
  try {
    return await User.create({
      name,
      role: "student",
      // Placeholder email/phone — random, not derived from anything
      // predictable, so concurrent sibling registrations don't collide.
      email,
      phone,
      passwordHash: null,
      loginDisabled: true,
      parentId,
      emailVerified: false,
      phoneVerified: false,
      grade: grade || null,
      attestedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000 && attempt < MAX_PLACEHOLDER_RETRIES) {
      return createChildWithRetry({ name, grade, parentId }, attempt + 1);
    }
    throw err;
  }
};

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

  const child = await createChildWithRetry({ name, grade, parentId });

  await User.findByIdAndUpdate(parentId, {
    $push: { linkedChildIds: child._id },
  });

  return child;
};

// ─── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────

const createGoogleUserWithRetry = async ({ name, email, sub, emailVerified }, attempt = 0) => {
  try {
    return await User.create({
      name,
      email,
      phone: generatePlaceholderPhone(),
      passwordHash: null,
      authProvider: "google",
      googleId: sub,
      emailVerified: emailVerified || false,
      phoneVerified: false,
      // role is required at the schema level, so a placeholder value is
      // stored here — but it is NOT what gates the complete-profile step.
      // profileComplete: false is. See the User model comment on that field.
      role: "student",
      profileComplete: false,
    });
  } catch (err) {
    if (err.code === 11000 && attempt < MAX_PLACEHOLDER_RETRIES) {
      return createGoogleUserWithRetry({ name, email, sub, emailVerified }, attempt + 1);
    }
    throw err;
  }
};

/**
 * Google Sign-In — verify idToken, find-or-create user.
 *
 * Returns one of three states:
 *   1. { user, tokens } — fully set up, tokens issued
 *   2. { user, profileIncomplete: true, reason: 'profile_incomplete' } — brand-new
 *      Google user, needs role + phone (completeProfile handles both together)
 *   3. { user, profileIncomplete: true, reason: 'phone_unverified' } — profile is
 *      complete (role + phone set) but the phone OTP hasn't been verified yet
 */
export const googleAuth = async (idToken, userAgent) => {
  if (process.env.GOOGLE_SIGNIN_ENABLED !== "true") {
    throw new ApiError(404, "Google Sign-In is not enabled.", "GOOGLE_SIGNIN_DISABLED");
  }

  // Dynamic import — only loaded when feature is enabled
  const { verifyGoogleIdToken } = await import("../../services/google.service.js");
  const { email: rawEmail, name, sub, email_verified } = await verifyGoogleIdToken(idToken);
  const email = normalizeEmail(rawEmail);

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
    // New user — create with Google provider, no password, profile incomplete.
    user = await createGoogleUserWithRetry({ name, email, sub, emailVerified: email_verified });
  }

  // Determine what the frontend should do next
  if (!user.profileComplete) {
    return { user, profileIncomplete: true, reason: "profile_incomplete" };
  }

  if (!user.phoneVerified) {
    return { user, profileIncomplete: true, reason: "phone_unverified" };
  }

  // Fully set up — issue tokens
  const { accessToken, refreshToken } = await issueTokens(user, userAgent);
  return { user, profileIncomplete: false, accessToken, refreshToken };
};

/**
 * Complete profile for a Google Sign-In user who has no role or phone yet.
 * Protected route — only the owning user can call this. Only usable once:
 * gated on User.profileComplete rather than guessing from the shape of the
 * stored phone number (see the User model comment on that field for why the
 * earlier phone-prefix approach was unsafe).
 */
export const completeProfile = async ({ userId, role, phone }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  if (user.profileComplete) {
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
  user.profileComplete = true;
  await user.save();

  // Send phone OTP
  await createAndSendOtp(userId, "phone", "signup");

  return user;
};

// ─── FORGOT / RESET PASSWORD ─────────────────────────────────────────────────

/**
 * Request a password-reset code. Always behaves the same whether or not the
 * email belongs to an account (and whether that account even has a password
 * to reset, e.g. Google-only accounts) — this is what keeps the endpoint
 * from being usable to enumerate registered emails. It only actually sends
 * an OTP when there's a real local-auth account behind the address.
 */
export const forgotPassword = async (email) => {
  // passwordHash is select:false on the schema — without selecting it
  // explicitly here, user.passwordHash is always undefined and this would
  // silently skip sending a reset code for every account, including ones
  // that genuinely have a password.
  const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash");
  if (user && user.passwordHash) {
    await createAndSendOtp(user._id, "email", "password_reset");
  }
};

/**
 * Complete a password reset: verify the emailed code, set the new password,
 * and end every existing session (a password reset is exactly the moment you
 * want any stolen/forgotten session on another device logged out too).
 */
export const resetPassword = async ({ email, code, newPassword }) => {
  const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash");
  if (!user || !user.passwordHash) {
    throw new ApiError(400, "Invalid or expired reset code.", "INVALID_RESET");
  }

  // Throws (400/429) on a wrong/expired/exhausted code — purpose
  // 'password_reset' means this does NOT also flip emailVerified as a
  // side effect, it only confirms the caller controls the inbox right now.
  await verifyOtp(user._id, "email", "password_reset", code);

  user.passwordHash = await bcrypt.hash(
    newPassword,
    Number(process.env.BCRYPT_SALT_ROUNDS) || 10
  );
  await user.save();

  await RefreshToken.deleteMany({ userId: user._id });
};

// Named export for shaping public user — used by controller
export { publicUser };
