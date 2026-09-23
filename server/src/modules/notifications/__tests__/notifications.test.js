import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import Notification from "../../../models/Notification.js";
import { registerAndVerify } from "../../../test/helpers.js";

// There's no POST /api/notifications route — production notifications only
// ever come from services/notification.service.js's processNotificationJob,
// run by the worker. Seeding directly via the model for these REST-layer
// tests mirrors the precedent already set in
// scripts/__tests__/migrateLegacyUserFields.test.js (direct model access for
// data a test needs to set up but no endpoint creates).
const seedNotification = (userId, overrides = {}) =>
  Notification.create({ userId, type: "interest_received", payload: {}, read: false, ...overrides });

describe("GET /api/notifications", () => {
  it("returns only the caller's own notifications, unread-first", async () => {
    const userA = await registerAndVerify({ role: "teacher" });
    const userB = await registerAndVerify({ role: "teacher" });

    await seedNotification(userA.userId, { read: true, type: "new_review" });
    await seedNotification(userA.userId, { read: false, type: "interest_received" });
    await seedNotification(userA.userId, { read: false, type: "interest_accepted" });
    await seedNotification(userB.userId, { read: false });

    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(3);
    expect(res.body.data.notifications.every((n) => String(n.userId) === userA.userId)).toBe(true);
    expect(res.body.data.notifications[0].read).toBe(false);
    expect(res.body.data.notifications[1].read).toBe(false);
    expect(res.body.data.notifications[2].read).toBe(true);
  });

  it("reports unreadCount separately from the page total", async () => {
    const user = await registerAndVerify({ role: "student" });
    await seedNotification(user.userId, { read: false });
    await seedNotification(user.userId, { read: false });
    await seedNotification(user.userId, { read: true });

    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("paginates", async () => {
    const user = await registerAndVerify({ role: "student" });
    for (let i = 0; i < 3; i += 1) {
      await seedNotification(user.userId);
    }

    const res = await request(app)
      .get("/api/notifications")
      .query({ page: 1, limit: 2 })
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  it("marks the caller's own notification read", async () => {
    const user = await registerAndVerify({ role: "student" });
    const notification = await seedNotification(user.userId, { read: false });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notification.read).toBe(true);

    const stored = await Notification.findById(notification._id);
    expect(stored.read).toBe(true);
  });

  it("404s for a notification belonging to someone else", async () => {
    const owner = await registerAndVerify({ role: "student" });
    const requester = await registerAndVerify({ role: "student" });
    const notification = await seedNotification(owner.userId, { read: false });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set("Authorization", `Bearer ${requester.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("404s for a well-formed id that doesn't exist", async () => {
    const user = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .patch("/api/notifications/000000000000000000000000/read")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("rejects a request with no token", async () => {
    const user = await registerAndVerify({ role: "student" });
    const notification = await seedNotification(user.userId);

    const res = await request(app).patch(`/api/notifications/${notification._id}/read`);
    expect(res.status).toBe(401);
  });
});
