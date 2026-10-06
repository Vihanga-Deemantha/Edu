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
 * Cookie attributes must match the deployment topology. In production the
 * frontend (Vercel) and API (Render) are different sites, so SameSite=Strict
 * causes browsers to reject or withhold the refresh cookie. SameSite=None is
 * required for that credentialed cross-site request and, by browser rule,
 * must be paired with Secure. Local development stays Lax over HTTP.
 */
const refreshCookieSecurity = () => {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
  };
};

export const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    ...refreshCookieSecurity(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

/**
 * Clears the refresh token cookie (used on logout).
 */
export const clearRefreshTokenCookie = (res) => {
  // Clearing must use the same security attributes as setting; otherwise the
  // browser treats it as a different cookie and logout leaves the real one.
  res.clearCookie("refreshToken", refreshCookieSecurity());
};
