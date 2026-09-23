/**
 * Shared CORS origin check — the same "is this origin on the allowed list"
 * decision used by Express's cors() middleware (app.js) and Socket.io's own
 * cors option (httpServer.js), since Socket.io's config accepts the exact
 * same (origin, callback) function shape. CORS_ORIGIN accepts a
 * comma-separated list (e.g. local dev + staging + prod) — a single value
 * still works unchanged since split(",") on a string with no comma just
 * returns a one-element array.
 *
 * A function (not a precomputed list) so the env-var read happens at
 * request/connection time, not at import time — avoids the ESM
 * import-hoisting problem where a static import runs before
 * dotenv.config() has populated process.env.
 */
export const corsOriginCheck = (requestOrigin, callback) => {
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
    callback(null, true);
  } else {
    callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
  }
};
