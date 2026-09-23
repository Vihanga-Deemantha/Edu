import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import TeacherVerification from "../../../models/TeacherVerification.js";
import TeacherProfile from "../../../models/TeacherProfile.js";
import { registerAndVerify } from "../../../test/helpers.js";

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

const newTeacher = async () => registerAndVerify({ role: "teacher" });
const newStudent = async () => registerAndVerify({ role: "student" });

/**
 * recomputeTeacherRating updates an EXISTING TeacherProfile — it
 * deliberately doesn't upsert one into existence (that would need to
 * satisfy TeacherProfile's required subjects/grades/medium/classType with
 * nothing meaningful to fill them with). A teacher who advertises without
 * ever building a profile is a real but narrow gap the roadmap doesn't ask
 * this phase to solve; tests that assert on avgRating give the teacher a
 * profile first, matching the natural real-world order of operations.
 */
const givenTeacherProfile = (token) =>
  request(app)
    .put("/api/profiles/teacher")
    .set("Authorization", `Bearer ${token}`)
    .send({ subjects: ["Mathematics"], grades: ["Grade 10"], medium: ["english"], classType: ["online"] });

const newParentWithChild = async () => {
  const parent = await registerAndVerify({ role: "parent" });
  const childRes = await request(app)
    .post("/api/auth/register-child")
    .set("Authorization", `Bearer ${parent.accessToken}`)
    .send({ name: "Little Kid", grade: "Grade 10", attestedGuardianship: true });
  return { parent, childId: childRes.body.data.child._id };
};

const setFullyVerified = (userId) =>
  TeacherVerification.create({
    userId,
    nicNumber: "199912345678",
    nicDocumentUrl: "https://example.com/nic.jpg",
    selfieWithIdUrl: "https://example.com/selfie.jpg",
    verificationTier: "fully_verified",
  });

const sendInterest = (token, body) =>
  request(app).post("/api/interests").set("Authorization", `Bearer ${token}`).send(body);
const respond = (token, interestId, status) =>
  request(app)
    .patch(`/api/interests/${interestId}/respond`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status });
const complete = (token, interestId) =>
  request(app).patch(`/api/interests/${interestId}/complete`).set("Authorization", `Bearer ${token}`);
const postReview = (token, body) => request(app).post("/api/reviews").set("Authorization", `Bearer ${token}`).send(body);

/** The common path: student -> teacher_ad, accepted, completed by the student. */
const createCompletedEngagement = async () => {
  const teacher = await newTeacher();
  await givenTeacherProfile(teacher.accessToken);
  const listing = await createListing(teacher.accessToken);
  const student = await newStudent();
  const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
  const interestId = sendRes.body.data.interestRequest._id;
  await respond(teacher.accessToken, interestId, "accepted");
  await complete(student.accessToken, interestId);
  return { teacher, student, interestId };
};

describe("POST /api/reviews", () => {
  it("lets the student post a review, recomputing the teacher's avgRating/reviewCount", async () => {
    const { teacher, student, interestId } = await createCompletedEngagement();

    const res = await postReview(student.accessToken, { linkedRequestId: interestId, rating: 5, comment: "Great!" });

    expect(res.status).toBe(201);
    expect(res.body.data.review.teacherId).toBe(teacher.userId);
    expect(res.body.data.review.reviewerId).toBe(student.userId);

    const profile = await TeacherProfile.findOne({ userId: teacher.userId });
    expect(profile.avgRating).toBe(5);
    expect(profile.reviewCount).toBe(1);
  });

  it("averages correctly across multiple reviews for the same teacher", async () => {
    const teacher = await newTeacher();
    await givenTeacherProfile(teacher.accessToken);

    const listingA = await createListing(teacher.accessToken, { subject: "SubjectA" });
    const studentA = await newStudent();
    const sendA = await sendInterest(studentA.accessToken, { listingId: listingA._id, message: "Hi." });
    await respond(teacher.accessToken, sendA.body.data.interestRequest._id, "accepted");
    await complete(studentA.accessToken, sendA.body.data.interestRequest._id);
    await postReview(studentA.accessToken, { linkedRequestId: sendA.body.data.interestRequest._id, rating: 5 });

    const listingB = await createListing(teacher.accessToken, { subject: "SubjectB" });
    const studentB = await newStudent();
    const sendB = await sendInterest(studentB.accessToken, { listingId: listingB._id, message: "Hi." });
    await respond(teacher.accessToken, sendB.body.data.interestRequest._id, "accepted");
    await complete(studentB.accessToken, sendB.body.data.interestRequest._id);
    await postReview(studentB.accessToken, { linkedRequestId: sendB.body.data.interestRequest._id, rating: 3 });

    const profile = await TeacherProfile.findOne({ userId: teacher.userId });
    expect(profile.avgRating).toBe(4);
    expect(profile.reviewCount).toBe(2);
  });

  it("rejects a review against a request that isn't completed yet", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();
    const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
    await respond(teacher.accessToken, sendRes.body.data.interestRequest._id, "accepted"); // never completed

    const res = await postReview(student.accessToken, {
      linkedRequestId: sendRes.body.data.interestRequest._id,
      rating: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects a reviewer who wasn't a participant in the engagement", async () => {
    const { interestId } = await createCompletedEngagement();
    const stranger = await newStudent();

    const res = await postReview(stranger.accessToken, { linkedRequestId: interestId, rating: 5 });

    expect(res.status).toBe(403);
  });

  it("rejects a duplicate review for the same engagement", async () => {
    const { student, interestId } = await createCompletedEngagement();
    await postReview(student.accessToken, { linkedRequestId: interestId, rating: 5 });

    const res = await postReview(student.accessToken, { linkedRequestId: interestId, rating: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_REVIEWED");
  });

  it("lets a parent review on behalf of a linked child's completed engagement", async () => {
    const teacher = await newTeacher();
    await setFullyVerified(teacher.userId); // child-linked, so accepting requires this
    const listing = await createListing(teacher.accessToken);
    const { parent, childId } = await newParentWithChild();
    const sendRes = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "For my child.",
      targetUserId: childId,
    });
    const interestId = sendRes.body.data.interestRequest._id;
    await respond(teacher.accessToken, interestId, "accepted");
    await complete(parent.accessToken, interestId);

    const res = await postReview(parent.accessToken, { linkedRequestId: interestId, rating: 4 });

    expect(res.status).toBe(201);
    expect(res.body.data.review.reviewerId).toBe(childId);
  });

  it("resolves teacherId correctly when the teacher initiated the request (student_ad direction)", async () => {
    const student = await newStudent();
    const listing = await createListing(student.accessToken, { type: "student_ad" });
    const teacher = await newTeacher();
    const sendRes = await sendInterest(teacher.accessToken, { listingId: listing._id, message: "I can help." });
    const interestId = sendRes.body.data.interestRequest._id;
    await respond(student.accessToken, interestId, "accepted");
    await complete(teacher.accessToken, interestId);

    const res = await postReview(student.accessToken, { linkedRequestId: interestId, rating: 4 });

    expect(res.status).toBe(201);
    expect(res.body.data.review.teacherId).toBe(teacher.userId);
    expect(res.body.data.review.reviewerId).toBe(student.userId);
  });

  it("rejects an out-of-range rating", async () => {
    const { student, interestId } = await createCompletedEngagement();

    const res = await postReview(student.accessToken, { linkedRequestId: interestId, rating: 6 });

    expect(res.status).toBe(422);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ linkedRequestId: "000000000000000000000000", rating: 5 });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/reviews/teacher/:teacherId", () => {
  it("lists a teacher's reviews publicly without exposing reviewerId", async () => {
    const { teacher, student, interestId } = await createCompletedEngagement();
    await postReview(student.accessToken, { linkedRequestId: interestId, rating: 5, comment: "Excellent" });

    const res = await request(app).get(`/api/reviews/teacher/${teacher.userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].rating).toBe(5);
    expect(res.body.data.reviews[0].reviewerId).toBeUndefined();
  });

  it("returns an empty array for a teacher with no reviews", async () => {
    const teacher = await newTeacher();
    const res = await request(app).get(`/api/reviews/teacher/${teacher.userId}`);
    expect(res.body.data.reviews).toEqual([]);
  });

  it("paginates", async () => {
    const teacher = await newTeacher();
    for (let i = 0; i < 3; i += 1) {
      const listing = await createListing(teacher.accessToken, { subject: `Subject${i}` });
      const student = await newStudent();
      const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
      await respond(teacher.accessToken, sendRes.body.data.interestRequest._id, "accepted");
      await complete(student.accessToken, sendRes.body.data.interestRequest._id);
      await postReview(student.accessToken, { linkedRequestId: sendRes.body.data.interestRequest._id, rating: 4 });
    }

    const res = await request(app).get(`/api/reviews/teacher/${teacher.userId}`).query({ page: 1, limit: 2 });

    expect(res.body.data.reviews).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });
});
