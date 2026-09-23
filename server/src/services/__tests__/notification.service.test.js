import { describe, it, expect, vi, afterEach } from "vitest";
import Notification from "../../models/Notification.js";
import { registerAndVerify } from "../../test/helpers.js";

// Partial mock — registerAndVerify (used below to create test users) drives
// real OTP emails through this same module's sendOtpEmail/sendEmail, so
// replacing the whole module would break every test in this file, not just
// the ones about notification email. importOriginal keeps sendOtpEmail (and
// everything else) real and only swaps out sendEmail for a spy-able mock.
vi.mock("../email.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn().mockResolvedValue(undefined) };
});

import { sendEmail } from "../email.service.js";
import { processNotificationJob } from "../notification.service.js";

describe("processNotificationJob", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Notification document with the given userId/type/payload", async () => {
    const { userId } = await registerAndVerify({ role: "teacher" });

    const notification = await processNotificationJob({
      userId,
      type: "interest_received",
      payload: { fromName: "Amaya", subject: "Mathematics" },
    });

    expect(notification.userId.toString()).toBe(userId);
    expect(notification.type).toBe("interest_received");
    expect(notification.read).toBe(false);

    const stored = await Notification.findById(notification._id);
    expect(stored).toBeTruthy();
    expect(stored.payload.fromName).toBe("Amaya");
  });

  it("emails the target user using a subject/body derived from the notification type", async () => {
    const { userId, payload: userPayload } = await registerAndVerify({ role: "teacher" });

    await processNotificationJob({
      userId,
      type: "interest_received",
      payload: { fromName: "Amaya", subject: "Mathematics" },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toBe(userPayload.email);
    expect(call.subject).toMatch(/interest request/i);
    expect(call.html).toContain("Amaya");
  });

  it("still creates the Notification document when the email send fails (best-effort email)", async () => {
    sendEmail.mockRejectedValueOnce(new Error("simulated SMTP failure"));
    const { userId } = await registerAndVerify({ role: "student" });

    const notification = await processNotificationJob({ userId, type: "new_review", payload: { rating: 5 } });

    expect(notification).toBeTruthy();
    const stored = await Notification.findById(notification._id);
    expect(stored).toBeTruthy();
  });

  it("falls back to a generic subject/message for a type-payload combination it has no template detail for", async () => {
    const { userId } = await registerAndVerify({ role: "student" });

    await processNotificationJob({ userId, type: "listing_flagged", payload: {} });

    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toMatch(/flagged/i);
    expect(call.html).toContain("Your listing");
  });
});
