import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import connectDB from "./config/db.js";
import { startNotificationWorker } from "./queues/notification.worker.js";

// Standalone process, separate from the API (src/server.js) — run alongside
// it with `npm run worker` (or `npm run worker:dev` for nodemon). The API
// only ever enqueues jobs (queues/notification.queue.js); this process is
// the only thing that consumes them.
const start = async () => {
  await connectDB();

  const worker = startNotificationWorker();
  worker.on("completed", (job) => console.log(`Notification job ${job.id} (${job.name}) completed`));
  worker.on("failed", (job, err) => console.error(`Notification job ${job?.id} (${job?.name}) failed:`, err.message));

  console.log("Notification worker started, waiting for jobs…");
};

start();
