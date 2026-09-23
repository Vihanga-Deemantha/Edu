import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import { registerAndVerify } from "../../../test/helpers.js";

const validTeacherAd = () => ({
  type: "teacher_ad",
  subject: "Mathematics",
  grade: "Grade 10",
  medium: "english",
  description: "Experienced tutor offering individual maths classes.",
});

const validStudentAd = (overrides = {}) => ({
  type: "student_ad",
  subject: "Science",
  grade: "Grade 9",
  medium: "english",
  description: "Looking for a science tutor for weekend classes.",
  ...overrides,
});

const registerChild = async (parentToken) => {
  const res = await request(app)
    .post("/api/auth/register-child")
    .set("Authorization", `Bearer ${parentToken}`)
    .send({ name: "Little Kid", grade: "Grade 9", attestedGuardianship: true });
  return res.body.data.child._id;
};

describe("POST /api/listings", () => {
  it("lets a teacher create a teacher_ad", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    expect(res.status).toBe(201);
    expect(res.body.data.listing.type).toBe("teacher_ad");
    expect(res.body.data.listing.status).toBe("active");
  });

  it("rejects a student trying to create a teacher_ad", async () => {
    const { accessToken } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_MISMATCH");
  });

  it("lets a student create their own student_ad", async () => {
    const { accessToken, userId } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validStudentAd());

    expect(res.status).toBe(201);
    expect(res.body.data.listing.ownerId).toBe(userId);
  });

  it("lets a parent create a student_ad for a linked child", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });
    const childId = await registerChild(parentToken);

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(validStudentAd({ targetUserId: childId }));

    expect(res.status).toBe(201);
    expect(res.body.data.listing.ownerId).toBe(childId);
  });

  it("requires targetUserId when a parent posts a student_ad", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(validStudentAd());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TARGET_USER_REQUIRED");
  });

  it("blocks a parent from posting a student_ad for a non-linked user", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });
    const { userId: strangerId } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(validStudentAd({ targetUserId: strangerId }));

    expect(res.status).toBe(403);
  });

  it("denormalizes location from the owner's TeacherProfile at creation time", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        subjects: ["Mathematics"],
        grades: ["Grade 10"],
        medium: ["english"],
        classType: ["individual"],
        location: { type: "Point", coordinates: [79.86, 6.93] },
      });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    expect(res.status).toBe(201);
    expect(res.body.data.listing.location.coordinates).toEqual([79.86, 6.93]);
  });

  it("respects an explicit location: null instead of denormalizing the profile's location", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        subjects: ["Mathematics"],
        grades: ["Grade 10"],
        medium: ["english"],
        classType: ["individual"],
        location: { type: "Point", coordinates: [79.86, 6.93] },
      });

    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTeacherAd(), location: null });

    expect(res.status).toBe(201);
    expect(res.body.data.listing.location).toBeFalsy();
  });
});

describe("GET /api/listings/:id — visibility", () => {
  it("shows a teacher_ad to a guest with no auth header", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    const res = await request(app).get(`/api/listings/${createRes.body.data.listing._id}`);

    expect(res.status).toBe(200);
  });

  it("hides a student_ad from a guest — 404, not 403", async () => {
    const { accessToken } = await registerAndVerify({ role: "student" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validStudentAd());

    const res = await request(app).get(`/api/listings/${createRes.body.data.listing._id}`);

    expect(res.status).toBe(404);
  });

  it("hides a student_ad from another (non-owner) student — 404", async () => {
    const { accessToken: ownerToken } = await registerAndVerify({ role: "student" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(validStudentAd());

    const { accessToken: otherToken } = await registerAndVerify({ role: "student" });
    const res = await request(app)
      .get(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it("shows a student_ad to any authenticated teacher", async () => {
    const { accessToken: ownerToken } = await registerAndVerify({ role: "student" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(validStudentAd());

    const { accessToken: teacherToken } = await registerAndVerify({ role: "teacher" });
    const res = await request(app)
      .get(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
  });

  it("shows the owner their own closed listing, but hides it from everyone else", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());
    const listingId = createRes.body.data.listing._id;

    await request(app).delete(`/api/listings/${listingId}`).set("Authorization", `Bearer ${accessToken}`);

    const ownerRes = await request(app)
      .get(`/api/listings/${listingId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const guestRes = await request(app).get(`/api/listings/${listingId}`);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.listing.status).toBe("closed");
    expect(guestRes.status).toBe(404);
  });

  it("returns 422, not 500, for a malformed id", async () => {
    const res = await request(app).get("/api/listings/not-a-valid-id");
    expect(res.status).toBe(422);
  });

  it("returns 404 for a well-formed but nonexistent id", async () => {
    const res = await request(app).get("/api/listings/64b000000000000000000000");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/listings/mine", () => {
  it("includes a linked child's listings for a parent", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });
    const childId = await registerChild(parentToken);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(validStudentAd({ targetUserId: childId }));

    const res = await request(app).get("/api/listings/mine").set("Authorization", `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].ownerId).toBe(childId);
  });

  it("includes the caller's own closed listings", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());
    await request(app)
      .delete(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app).get("/api/listings/mine").set("Authorization", `Bearer ${accessToken}`);

    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.listings[0].status).toBe("closed");
  });
});

describe("PATCH /api/listings/:id", () => {
  it("lets the owner update fields", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    const res = await request(app)
      .patch(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ description: "Updated description, still long enough to pass validation." });

    expect(res.status).toBe(200);
    expect(res.body.data.listing.description).toBe(
      "Updated description, still long enough to pass validation."
    );
    expect(res.body.data.listing.subject).toBe("Mathematics");
  });

  it("lets a parent update a linked child's listing", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });
    const childId = await registerChild(parentToken);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${parentToken}`)
      .send(validStudentAd({ targetUserId: childId }));

    const res = await request(app)
      .patch(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ grade: "Grade 10" });

    expect(res.status).toBe(200);
    expect(res.body.data.listing.grade).toBe("Grade 10");
  });

  it("blocks a non-owner from updating", async () => {
    const { accessToken: ownerToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(validTeacherAd());

    const { accessToken: otherToken } = await registerAndVerify({ role: "teacher" });
    const res = await request(app)
      .patch(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ subject: "Physics" });

    expect(res.status).toBe(403);
  });

  it("rejects changing type after creation", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    const res = await request(app)
      .patch(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ type: "student_ad" });

    expect(res.status).toBe(422);
  });

  it("rejects setting status to 'flagged' via the owner-facing route", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    const res = await request(app)
      .patch(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "flagged" });

    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/listings/:id (soft close)", () => {
  it("closes the listing instead of removing it", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherAd());

    const res = await request(app)
      .delete(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.listing.status).toBe("closed");
  });

  it("blocks a non-owner from closing", async () => {
    const { accessToken: ownerToken } = await registerAndVerify({ role: "teacher" });
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(validTeacherAd());

    const { accessToken: otherToken } = await registerAndVerify({ role: "teacher" });
    const res = await request(app)
      .delete(`/api/listings/${createRes.body.data.listing._id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
