import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import TeacherVerification from "../../../models/TeacherVerification.js";
import { registerAndVerify } from "../../../test/helpers.js";

const validTeacherProfile = () => ({
  subjects: ["Mathematics", "Physics"],
  grades: ["Grade 10", "Grade 11"],
  medium: ["english"],
  classType: ["individual", "online"],
  bio: "Experienced maths tutor.",
  experienceYears: 5,
});

describe("PUT /api/profiles/teacher", () => {
  it("creates a profile for a verified teacher", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherProfile());

    expect(res.status).toBe(200);
    expect(res.body.data.profile.subjects).toEqual(["Mathematics", "Physics"]);
    expect(res.body.data.profile.verificationStatus).toBe("none");
  });

  it("rejects a first-time submission missing a required field", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const { classType, ...incomplete } = validTeacherProfile();
    void classType;

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(incomplete);

    expect(res.status).toBe(422);
  });

  it("allows a partial update on an existing profile", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherProfile());

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Updated bio only." });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.bio).toBe("Updated bio only.");
    expect(res.body.data.profile.subjects).toEqual(["Mathematics", "Physics"]);
  });

  it("accepts bio_si and bio_ta as optional translated fields (Phase 19B)", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTeacherProfile(), bio_si: "Sinhala placeholder bio.", bio_ta: "Tamil placeholder bio." });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.bio_si).toBe("Sinhala placeholder bio.");
    expect(res.body.data.profile.bio_ta).toBe("Tamil placeholder bio.");
  });

  it("rejects a bio_si longer than 1000 characters", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTeacherProfile(), bio_si: "a".repeat(1001) });

    expect(res.status).toBe(422);
  });

  it("silently strips verificationStatus/avgRating/reviewCount even if somehow present", async () => {
    const { userId } = await registerAndVerify({ role: "teacher" });

    // express-validator rejects these outright at the HTTP layer (see next
    // test) — this test calls the service directly to exercise its own
    // strip as defense in depth, independent of the HTTP validation layer.
    const { upsertTeacherProfile } = await import("../profiles.service.js");

    const profile = await upsertTeacherProfile(userId, {
      ...validTeacherProfile(),
      verificationStatus: "fully_verified",
      avgRating: 5,
      reviewCount: 999,
    });

    expect(profile.verificationStatus).toBe("none");
    expect(profile.avgRating).toBe(0);
    expect(profile.reviewCount).toBe(0);
  });

  it("rejects a request body that includes verificationStatus at the HTTP layer", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTeacherProfile(), verificationStatus: "fully_verified" });

    expect(res.status).toBe(422);
  });

  it("rejects out-of-range coordinates", async () => {
    const { accessToken } = await registerAndVerify({ role: "teacher" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTeacherProfile(), location: { type: "Point", coordinates: [200, 100] } });

    expect(res.status).toBe(422);
  });

  it("picks up an existing verification tier on first profile creation", async () => {
    const { accessToken, userId } = await registerAndVerify({ role: "teacher" });

    await TeacherVerification.create({
      userId,
      nicNumber: "991234567V",
      nicDocumentUrl: "placeholder",
      selfieWithIdUrl: "placeholder",
      status: "approved",
      verificationTier: "id_verified",
    });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherProfile());

    expect(res.status).toBe(200);
    expect(res.body.data.profile.verificationStatus).toBe("id_verified");
  });

  it("rejects a non-teacher trying to create a teacher profile", async () => {
    const { accessToken } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherProfile());

    expect(res.status).toBe(403);
  });
});

describe("GET /api/profiles/teacher/:userId", () => {
  it("is readable with no auth header", async () => {
    const { accessToken, userId } = await registerAndVerify({ role: "teacher" });
    await request(app)
      .put("/api/profiles/teacher")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTeacherProfile());

    const res = await request(app).get(`/api/profiles/teacher/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.userId).toBe(userId);
  });

  it("returns 404, not 500, for a teacher with no profile yet", async () => {
    const { userId } = await registerAndVerify({ role: "teacher" });

    const res = await request(app).get(`/api/profiles/teacher/${userId}`);

    expect(res.status).toBe(404);
  });

  it("returns 422 for a malformed id instead of a 500", async () => {
    const res = await request(app).get("/api/profiles/teacher/not-a-valid-id");
    expect(res.status).toBe(422);
  });
});

describe("PUT /api/profiles/student", () => {
  it("lets a student create their own profile", async () => {
    const { accessToken, userId } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: userId, gradeOrLevel: "Grade 9", subjectsInterested: ["Mathematics"] });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.gradeOrLevel).toBe("Grade 9");
  });

  it("lets a parent create a profile for a linked child", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });

    const childRes = await request(app)
      .post("/api/auth/register-child")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ name: "Little Kid", grade: "Grade 4", attestedGuardianship: true });
    const childId = childRes.body.data.child._id;

    const res = await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ targetUserId: childId, gradeOrLevel: "Grade 4" });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.userId).toBe(childId);
  });

  it("blocks a parent from writing a profile for a non-linked user", async () => {
    const { accessToken: parentToken } = await registerAndVerify({ role: "parent" });
    const { userId: otherUserId } = await registerAndVerify({ role: "student" });

    const res = await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ targetUserId: otherUserId, gradeOrLevel: "Grade 9" });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/profiles/student/:userId", () => {
  it("lets a student read their own profile", async () => {
    const { accessToken, userId } = await registerAndVerify({ role: "student" });
    await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: userId, gradeOrLevel: "Grade 9" });

    const res = await request(app)
      .get(`/api/profiles/student/${userId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("blocks a student from reading another student's profile", async () => {
    const { accessToken: studentAToken } = await registerAndVerify({ role: "student" });
    const { accessToken: studentBToken, userId: studentBId } = await registerAndVerify({ role: "student" });
    await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${studentBToken}`)
      .send({ targetUserId: studentBId, gradeOrLevel: "Grade 9" });

    const res = await request(app)
      .get(`/api/profiles/student/${studentBId}`)
      .set("Authorization", `Bearer ${studentAToken}`);

    expect(res.status).toBe(403);
  });

  it("lets a teacher read any student's profile", async () => {
    const { accessToken: teacherToken } = await registerAndVerify({ role: "teacher" });
    const { accessToken: studentToken, userId: studentId } = await registerAndVerify({ role: "student" });
    await request(app)
      .put("/api/profiles/student")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ targetUserId: studentId, gradeOrLevel: "Grade 9" });

    const res = await request(app)
      .get(`/api/profiles/student/${studentId}`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
  });
});
