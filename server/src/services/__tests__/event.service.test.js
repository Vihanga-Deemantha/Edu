import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";
import Event from "../../models/Event.js";
import { logEvent, logEventFromRequest } from "../event.service.js";

describe("logEvent", () => {
  it("writes a well-formed event and is awaitable in tests", async () => {
    const listingId = new mongoose.Types.ObjectId();

    await logEvent({
      action: "view_listing",
      targetType: "listing",
      targetId: listingId,
      metadata: { subject: "Mathematics" },
    });

    const stored = await Event.findOne({ targetId: listingId });
    expect(stored).toBeTruthy();
    expect(stored.action).toBe("view_listing");
    expect(stored.metadata.subject).toBe("Mathematics");
    expect(stored.userId).toBeNull();
  });

  it("silently skips an unknown action instead of throwing", async () => {
    const result = await logEvent({ action: "not_a_real_action" });
    expect(result).toBeNull();
  });

  it("never rejects even when the write itself fails", async () => {
    const createSpy = vi.spyOn(Event, "create").mockRejectedValueOnce(new Error("simulated DB failure"));

    await expect(logEvent({ action: "search" })).resolves.toBeNull();

    createSpy.mockRestore();
  });
});

describe("logEventFromRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pulls userId from req.user and sessionId from the X-Session-Id header", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const fakeReq = {
      user: { id: userId, role: "student" },
      headers: { "x-session-id": "session-abc-123" },
    };

    await logEventFromRequest(fakeReq, { action: "search", metadata: { subject: "Physics" } });

    const stored = await Event.findOne({ sessionId: "session-abc-123" });
    expect(stored).toBeTruthy();
    expect(stored.userId.toString()).toBe(userId);
  });

  it("logs userId: null for a guest request (no req.user)", async () => {
    const fakeReq = { headers: {} };

    await logEventFromRequest(fakeReq, { action: "search", metadata: { subject: "GuestSearchMarker" } });

    const stored = await Event.findOne({ "metadata.subject": "GuestSearchMarker" });
    expect(stored).toBeTruthy();
    expect(stored.userId).toBeNull();
    expect(stored.sessionId).toBeNull();
  });
});
