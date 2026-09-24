import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

/**
 * Dynamic imports, deliberately AFTER dotenv.config() above — and genuinely
 * evaluated at this exact point in program order, unlike a static `import`
 * declaration. ES modules hoist static imports: regardless of where an
 * `import app from "./app.js"` is textually written in this file, the ENTIRE
 * dependency graph it pulls in (every route, service, and config module app.js
 * imports, transitively) finishes evaluating before this file's own top-level
 * code runs — including the dotenv.config() call above, no matter that it's
 * written earlier in the source. That's not a hypothetical footgun: it's
 * exactly what silently broke two real things before this fix — REDIS_URL
 * (config/redis.js read process.env.REDIS_URL at its own top level, always
 * got undefined, and silently fell back to the hardcoded localhost default
 * regardless of what .env actually specified) and Google Sign-In
 * (auth.routes.js's `if (process.env.GOOGLE_SIGNIN_ENABLED === "true")` ran
 * at import time too, so the route could never be registered no matter the
 * .env setting). Neither surfaced in tests, since the test suite imports
 * app.js directly and never runs this file's dotenv.config() at all.
 * A dynamic import() is a real runtime operation, not hoisted, so it
 * genuinely waits for the line above it — the standard fix for this class of
 * bug in an ESM entrypoint that both loads env config and imports the app.
 */
const { default: connectDB } = await import("./config/db.js");
const { default: app } = await import("./app.js");
const { createHttpServer } = await import("./httpServer.js");
const { warmUpEmbeddingModel } = await import("./services/embedding.service.js");

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to DB first — fail fast if DB is unreachable
  await connectDB();

  // Loads Phase 16's embedding model once, up front, instead of on
  // whichever request happens to hit it first — that first load takes real
  // time (reading/decoding the ONNX weights), and nobody should have to be
  // the unlucky request that pays for it.
  warmUpEmbeddingModel().catch((err) => console.error("Embedding model warm-up failed (non-fatal):", err.message));

  // Only start accepting requests after DB is connected. Listening on the
  // wrapping httpServer (not app.listen directly) so Socket.io's chat
  // connections share the same port as the REST API.
  const { httpServer } = createHttpServer(app);
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
};

start();
