import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Shared ioredis connection for BullMQ — used by both the producer (Queue,
 * in the API process) and the consumer (Worker, in the separate worker
 * process; see src/worker.js). BullMQ requires maxRetriesPerRequest: null on
 * any connection it's given (its blocking commands are incompatible with
 * ioredis's default per-request retry limit) — set once here so neither side
 * has to remember it.
 */
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// ioredis throws an uncaught exception on an unhandled 'error' event by
// design — log-and-continue instead, matching this codebase's tolerance for
// non-critical infra being briefly unreachable (see email.service.js's dev
// fallback). A queue producer that can't reach Redis yet shouldn't crash the
// whole API process; enqueueNotificationJob already catches its own errors.
redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});
