import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * jsonwebtoken's HS256 signing is deterministic — the same payload signed
 * within the same second (the resolution of the `iat` claim it auto-adds)
 * produces the exact same JWT string. Without something per-token in the
 * payload, two genuine logins for the same user within the same second
 * (perfectly normal — someone logging in on their phone right after their
 * laptop) would mint byte-identical refresh tokens, colliding on
 * RefreshToken's unique tokenHash index. `jti` exists exactly for this.
 */
const randomJti = () => crypto.randomUUID();

/**
 * Generates a short-lived access token (JWT).
 * Sent in the response body — the client stores it in memory, NOT localStorage.
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { sub: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY }
  );
};

/**
 * Generates a long-lived refresh token (JWT).
 * NEVER sent in the response body — only ever set as an httpOnly cookie.
 * This prevents XSS from stealing the refresh token.
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { sub: user._id, jti: randomJti() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY }
  );
};

/**
 * Hashes a refresh token using SHA-256 for secure storage.
 * We store the hash (not the raw token) so that even if the DB is
 * compromised, stolen hashes can't be used as valid refresh tokens.
 */
export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Sets the refresh token as an httpOnly, sameSite=strict cookie.
 * In production, the 'secure' flag ensures it only travels over HTTPS.
 */
export const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

/**
 * Clears the refresh token cookie (used on logout).
 */
export const clearRefreshTokenCookie = (res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};
