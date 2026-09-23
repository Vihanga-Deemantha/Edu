import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock() factories are hoisted above every other statement in this file,
// including `const` declarations (which stay in their temporal dead zone
// until their own line runs) — a factory that closes over a plain top-level
// const throws "Cannot access before initialization". vi.hoisted() runs
// alongside vi.mock's hoisting instead, so mockAdd is already initialized by
// the time the factory below needs it.
const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: mockAdd })),
}));

// Real config/redis.js constructs a live ioredis connection at import time —
// mocked out here so this test never attempts a real Redis connection.
vi.mock("../../config/redis.js", () => ({
  redisConnection: {},
}));

import { enqueueNotificationJob, NOTIFICATION_QUEUE_NAME } from "../notification.queue.js";

describe("enqueueNotificationJob", () => {
  beforeEach(() => {
    mockAdd.mockClear();
  });

  it("adds a job named after the notification type, carrying userId/type/payload", async () => {
    await enqueueNotificationJob({
      userId: "user-123",
      type: "interest_received",
      payload: { fromName: "Amaya" },
    });

    expect(mockAdd).toHaveBeenCalledWith("interest_received", {
      userId: "user-123",
      type: "interest_received",
      payload: { fromName: "Amaya" },
    });
  });

  it("defaults payload to an empty object when omitted", async () => {
    await enqueueNotificationJob({ userId: "user-123", type: "new_review" });

    expect(mockAdd).toHaveBeenCalledWith("new_review", {
      userId: "user-123",
      type: "new_review",
      payload: {},
    });
  });

  it("never throws when the queue itself fails — fire-and-forget, same as event logging", async () => {
    mockAdd.mockRejectedValueOnce(new Error("Redis unreachable"));

    await expect(
      enqueueNotificationJob({ userId: "user-123", type: "new_review" })
    ).resolves.toBeUndefined();
  });

  it("names the queue 'notifications' (must match queues/notification.worker.js)", () => {
    expect(NOTIFICATION_QUEUE_NAME).toBe("notifications");
  });
});
