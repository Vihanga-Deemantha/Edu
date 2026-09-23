import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import RecommendationCache from "../../../models/RecommendationCache.js";
import { registerAndVerify } from "../../../test/helpers.js";

// Colombo-ish coordinates, ~a few km apart — same fixtures browse.test.js
// uses for its geo tests.
const COLOMBO = [79.8612, 6.9271];
const NEARBY = [79.8712, 6.9371]; // roughly 1.5km away
const FAR_AWAY = [80.6337, 7.2906]; // Kandy — ~100km away, beyond MAX_RELEVANT_DISTANCE_KM

const createListing = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "teacher_ad",
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      description: "A perfectly reasonable listing description for testing.",
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createListing failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.listing;
};

const setTeacherProfile = async (token, overrides = {}) => {
  const res = await request(app)
    .put("/api/profiles/teacher")
    .set("Authorization", `Bearer ${token}`)
    .send({
      subjects: ["Mathematics"],
      grades: ["Grade 10"],
      medium: ["english"],
      classType: ["online"],
      ...overrides,
    });
  if (res.status !== 200) {
    throw new Error(`setTeacherProfile failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.profile;
};

const setStudentProfile = async (token, targetUserId, overrides = {}) => {
  const res = await request(app)
    .put("/api/profiles/student")
    .set("Authorization", `Bearer ${token}`)
    .send({
      targetUserId,
      subjectsInterested: ["Mathematics"],
      gradeOrLevel: "Grade 10",
      medium: ["english"],
      ...overrides,
    });
  if (res.status !== 200) {
    throw new Error(`setStudentProfile failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.profile;
};

const newTeacher = async () => registerAndVerify({ role: "teacher" });
const newStudent = async () => registerAndVerify({ role: "student" });

describe("GET /api/recommendations/teachers", () => {
  it("ranks a teacher listing matching the student's profile above a non-matching one", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    const matchingTeacher = await newTeacher();
    await createListing(matchingTeacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });

    const mismatchedTeacher = await newTeacher();
    await createListing(mismatchedTeacher.accessToken, { subject: "History", grade: "Grade 5", medium: "tamil" });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(2);
    const [first, second] = res.body.data.recommendations;
    expect(first.listing.subject).toBe("Mathematics");
    expect(first.score).toBeGreaterThan(second.score);
    // Phase 16's "why this match" explainer — template-generated from the
    // same factors that produced the score above, not an LLM call.
    expect(first.reason).toMatch(/subject/i);
    expect(first.reason).toMatch(/grade/i);
  });

  it("still returns a ranked list for a student with no profile or wanted-ad (graceful degradation, not an error)", async () => {
    const student = await newStudent();
    const teacher = await newTeacher();
    await createListing(teacher.accessToken);

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(1);
    // Regression check: locationScore/priceFitScore both return 0.5 as
    // their "no data to compare" fallback — with no profile at all, that's
    // exactly what this candidate gets for both factors. The explainer
    // must not mistake that neutral filler for a genuine "nearby"/"within
    // budget" match and fabricate a reason from it.
    expect(res.body.data.recommendations[0].reason).toBeNull();
  });

  it("returns an empty array when there are no active teacher listings yet", async () => {
    const student = await newStudent();

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toEqual([]);
  });

  it("excludes a closed listing", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });
    await request(app).delete(`/api/listings/${listing._id}`).set("Authorization", `Bearer ${teacher.accessToken}`);

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(0);
  });

  it("respects the limit query parameter", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    for (let i = 0; i < 3; i += 1) {
      const teacher = await newTeacher();
      await createListing(teacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });
    }

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .query({ limit: 2 })
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
  });

  it("lets a parent get recommendations for a linked child", async () => {
    const parent = await registerAndVerify({ role: "parent" });
    const childRes = await request(app)
      .post("/api/auth/register-child")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({ name: "Little Kid", grade: "Grade 10", attestedGuardianship: true });
    const childId = childRes.body.data.child._id;

    const teacher = await newTeacher();
    await createListing(teacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .query({ targetUserId: childId })
      .set("Authorization", `Bearer ${parent.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(1);
  });

  it("rejects a parent request with no targetUserId", async () => {
    const parent = await registerAndVerify({ role: "parent" });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${parent.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TARGET_USER_REQUIRED");
  });

  it("rejects a parent request for a user that isn't their linked child", async () => {
    const parent = await registerAndVerify({ role: "parent" });
    const stranger = await newStudent();

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .query({ targetUserId: stranger.userId })
      .set("Authorization", `Bearer ${parent.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("ignores a student-supplied targetUserId and always uses the caller's own criteria", async () => {
    const student = await newStudent();
    const otherStudent = await newStudent();

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .query({ targetUserId: otherStudent.userId })
      .set("Authorization", `Bearer ${student.accessToken}`);

    // Not a 403 — a student role always gets their own recommendations
    // regardless of what targetUserId is supplied, so there's nothing to reject.
    expect(res.status).toBe(200);
  });

  it("ranks a nearer teacher listing above a farther one when subject/grade/medium are otherwise tied", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId, {
      location: { type: "Point", coordinates: COLOMBO },
    });

    const nearTeacher = await newTeacher();
    await setTeacherProfile(nearTeacher.accessToken, { location: { type: "Point", coordinates: NEARBY } });
    const nearListing = await createListing(nearTeacher.accessToken, {
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
    });

    const farTeacher = await newTeacher();
    await setTeacherProfile(farTeacher.accessToken, { location: { type: "Point", coordinates: FAR_AWAY } });
    await createListing(farTeacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
    const [first, second] = res.body.data.recommendations;
    expect(String(first.listing._id)).toBe(String(nearListing._id));
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("ranks a within-budget teacher listing above an over-budget one when subject/grade/medium are otherwise tied", async () => {
    const student = await newStudent();
    await createListing(student.accessToken, {
      type: "student_ad",
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      price: { amount: 2000, unit: "hour" },
    });

    const affordableTeacher = await newTeacher();
    const affordableListing = await createListing(affordableTeacher.accessToken, {
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      price: { amount: 1800, unit: "hour" },
    });

    const expensiveTeacher = await newTeacher();
    await createListing(expensiveTeacher.accessToken, {
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      price: { amount: 5000, unit: "hour" },
    });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
    const [first, second] = res.body.data.recommendations;
    expect(String(first.listing._id)).toBe(String(affordableListing._id));
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/recommendations/teachers");
    expect(res.status).toBe(401);
  });

  it("rejects a teacher calling the student-facing endpoint", async () => {
    const teacher = await newTeacher();
    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${teacher.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/recommendations/students", () => {
  it("ranks a student listing matching the teacher's profile above a non-matching one", async () => {
    const teacher = await newTeacher();
    await setTeacherProfile(teacher.accessToken, {
      subjects: ["Mathematics"],
      grades: ["Grade 10"],
      medium: ["english"],
      classType: ["online"],
    });

    const matchingStudent = await newStudent();
    await createListing(matchingStudent.accessToken, {
      type: "student_ad",
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
    });

    const mismatchedStudent = await newStudent();
    await createListing(mismatchedStudent.accessToken, {
      type: "student_ad",
      subject: "Art",
      grade: "Grade 3",
      medium: "sinhala",
    });

    const res = await request(app)
      .get("/api/recommendations/students")
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(2);
    const [first, second] = res.body.data.recommendations;
    expect(first.listing.subject).toBe("Mathematics");
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("still returns a ranked list for a teacher with no profile yet (graceful degradation, not an error)", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    await createListing(student.accessToken, { type: "student_ad", subject: "Mathematics", grade: "Grade 10", medium: "english" });

    const res = await request(app)
      .get("/api/recommendations/students")
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toHaveLength(1);
  });

  it("rejects a student calling the teacher-facing endpoint", async () => {
    const student = await newStudent();
    const res = await request(app)
      .get("/api/recommendations/students")
      .set("Authorization", `Bearer ${student.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Phase 12 — collaborative-filtering blend", () => {
  it("ranks a candidate with a higher CF score above one with a lower CF score, content score tied", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    const favoredTeacher = await newTeacher();
    const favoredListing = await createListing(favoredTeacher.accessToken, {
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
    });

    const otherTeacher = await newTeacher();
    await createListing(otherTeacher.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });

    // Simulates what ml-jobs/'s offline ALS job would have written — never
    // run in this test, so a direct model write matches the established
    // "seed the state no endpoint produces" pattern used all session.
    await RecommendationCache.create({
      userId: student.userId,
      recommendations: [{ targetUserId: favoredTeacher.userId, score: 90 }],
      computedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
    const [first] = res.body.data.recommendations;
    expect(String(first.listing._id)).toBe(String(favoredListing._id));
  });

  it("ignores a stale (>7 day old) CF cache entry — both candidates score identically, as if it didn't exist", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    const teacherA = await newTeacher();
    await createListing(teacherA.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });
    const teacherB = await newTeacher();
    await createListing(teacherB.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await RecommendationCache.create({
      userId: student.userId,
      recommendations: [{ targetUserId: teacherA.userId, score: 90 }],
      computedAt: eightDaysAgo,
    });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
    const [first, second] = res.body.data.recommendations;
    expect(first.score).toBe(second.score);
  });

  it("falls back to pure content score for a candidate the cache has no entry for, even though the user has a cache document", async () => {
    const student = await newStudent();
    await setStudentProfile(student.accessToken, student.userId);

    const teacherWithCfScore = await newTeacher();
    await createListing(teacherWithCfScore.accessToken, { subject: "Mathematics", grade: "Grade 10", medium: "english" });
    const teacherWithNoCfEntry = await newTeacher();
    await createListing(teacherWithNoCfEntry.accessToken, {
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
    });

    await RecommendationCache.create({
      userId: student.userId,
      recommendations: [{ targetUserId: teacherWithCfScore.userId, score: 20 }], // lower than the tied content score alone would be
      computedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/recommendations/teachers")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.recommendations).toHaveLength(2);
    // The candidate with no cache entry keeps its pure content score; the
    // one with a low CF score gets pulled down by the 0.4 blend weight —
    // so the no-entry candidate should now rank first.
    const [first] = res.body.data.recommendations;
    expect(String(first.listing.ownerId)).toBe(teacherWithNoCfEntry.userId);
  });
});
