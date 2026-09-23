import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";
import Event from "../../models/Event.js";
import { registerAndVerify, waitFor } from "../../test/helpers.js";

describe("event logging wired into real endpoints", () => {
  it("logs a search event on GET /api/listings/browse, guest included", async () => {
    await request(app).get("/api/listings/browse").query({ subject: "EventLogSearchMarker" });

    const stored = await waitFor(() => Event.findOne({ action: "search", "metadata.subject": "EventLogSearchMarker" }));
    expect(stored.userId).toBeNull();
  });

  it("logs a view_listing event with the right targetId, only after visibility passes", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "teacher_ad",
        subject: "EventLogViewMarker",
        grade: "Grade 10",
        medium: "english",
        description: "A listing used to test event logging wiring end to end.",
      });
    const listingId = createRes.body.data.listing._id;

    await request(app).get(`/api/listings/${listingId}`);

    const stored = await waitFor(() =>
      Event.findOne({ action: "view_listing", targetId: listingId })
    );
    expect(stored.metadata.subject).toBe("EventLogViewMarker");
  });

  it("does not log view_listing for a blocked (404) student_ad view", async () => {
    const { accessToken } = await registerAndVerify({ role: "student" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "student_ad",
        subject: "EventLogBlockedMarker",
        grade: "Grade 9",
        medium: "english",
        description: "A student ad that a guest should never be able to view.",
      });
    const listingId = createRes.body.data.listing._id;

    const res = await request(app).get(`/api/listings/${listingId}`);
    expect(res.status).toBe(404);

    // Give any (incorrect) write a moment to land, then confirm it didn't.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stored = await Event.findOne({ action: "view_listing", targetId: listingId });
    expect(stored).toBeNull();
  });

  it("logs a view_profile event and attributes it to a logged-in viewer", async () => {
    const { accessToken: teacherToken, userId: teacherId } = await registerAndVerify({ role: "teacher" });
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        subjects: ["Mathematics"],
        grades: ["Grade 10"],
        medium: ["english"],
        classType: ["individual"],
      });

    const { accessToken: viewerToken, userId: viewerId } = await registerAndVerify({ role: "student" });
    await request(app)
      .get(`/api/profiles/teacher/${teacherId}`)
      .set("Authorization", `Bearer ${viewerToken}`);

    const stored = await waitFor(() =>
      Event.findOne({ action: "view_profile", targetId: teacherId })
    );
    expect(stored.userId.toString()).toBe(viewerId);
    expect(stored.metadata.role).toBe("teacher");
  });
});
