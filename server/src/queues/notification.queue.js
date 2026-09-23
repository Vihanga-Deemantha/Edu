import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const NOTIFICATION_QUEUE_NAME = "notifications";

const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, { connection: redisConnection });

/**
 * Enqueue a notification job — the entry point any module (Phase 10B's
 * interest accept/decline, Phase 11B's review post, ...) calls to fan a
 * user-facing notification + email out to the worker process, without
 * waiting on either. Same fire-and-forget contract as
 * services/event.service.js's logEvent: never awaited in a request handler,
 * and a queueing failure (e.g. Redis briefly unreachable) must not break the
 * request that triggered it.
 */
export const enqueueNotificationJob = async ({ userId, type, payload = {} }) => {
  try {
    await notificationQueue.add(type, { userId, type, payload });
  } catch (err) {
    console.error("Failed to enqueue notification job (non-fatal):", err.message);
  }
};

export default notificationQueue;
