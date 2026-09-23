import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { NOTIFICATION_QUEUE_NAME } from "./notification.queue.js";
import { processNotificationJob } from "../services/notification.service.js";

/**
 * Only ever imported by src/worker.js (the standalone worker process entry
 * point) — never by the API process (src/app.js / src/server.js) or by any
 * test, so instantiating this is the only thing in this codebase that
 * actually requires Redis to be reachable. The logic it runs
 * (processNotificationJob) is what's unit-tested directly; this file is
 * just BullMQ wiring around it.
 */
export const startNotificationWorker = () =>
  new Worker(NOTIFICATION_QUEUE_NAME, async (job) => processNotificationJob(job.data), {
    connection: redisConnection,
  });
