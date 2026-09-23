import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import TeacherVerification from "../../../models/TeacherVerification.js";
import Conversation from "../../../models/Conversation.js";
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

describe("POST /api/interests", () => {
  it("lets a student send interest on a teacher_ad", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();

    const res = await sendInterest(student.accessToken, {
      listingId: listing._id,
      message: "I'd love to learn from you!",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.interestRequest.fromUserId).toBe(student.userId);
    expect(res.body.data.interestRequest.toUserId).toBe(teacher.userId);
    expect(res.body.data.interestRequest.status).toBe("pending");
  });

  it("lets a parent send interest on a teacher_ad on behalf of a linked child", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const { parent, childId } = await newParentWithChild();

    const res = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "Interested for my child.",
      targetUserId: childId,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.interestRequest.fromUserId).toBe(childId);
  });

  it("rejects a parent request with no targetUserId", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const parent = await registerAndVerify({ role: "parent" });

    const res = await sendInterest(parent.accessToken, { listingId: listing._id, message: "Interested." });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TARGET_USER_REQUIRED");
  });

  it("rejects a parent request for a user that isn't their linked child", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const parent = await registerAndVerify({ role: "parent" });
    const stranger = await newStudent();

    const res = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "Interested.",
      targetUserId: stranger.userId,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a teacher send interest on a student_ad", async () => {
    const student = await newStudent();
    const listing = await createListing(student.accessToken, { type: "student_ad" });
    const teacher = await newTeacher();

    const res = await sendInterest(teacher.accessToken, { listingId: listing._id, message: "I can teach this." });

    expect(res.status).toBe(201);
    expect(res.body.data.interestRequest.fromUserId).toBe(teacher.userId);
    expect(res.body.data.interestRequest.toUserId).toBe(student.userId);
  });

  it("rejects a teacher sending interest on a teacher_ad (wrong direction)", async () => {
    const teacherA = await newTeacher();
    const listing = await createListing(teacherA.accessToken);
    const teacherB = await newTeacher();

    const res = await sendInterest(teacherB.accessToken, { listingId: listing._id, message: "Hi." });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_MISMATCH");
  });

  it("404s (not 403) when a non-teacher tries to interest in a student_ad — visibility, not role, gates it", async () => {
    const studentA = await newStudent();
    const listing = await createListing(studentA.accessToken, { type: "student_ad" });
    const studentB = await newStudent();

    const res = await sendInterest(studentB.accessToken, { listingId: listing._id, message: "Hi." });

    expect(res.status).toBe(404);
  });

  it("rejects a duplicate pending interest for the same listing", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();

    await sendInterest(student.accessToken, { listingId: listing._id, message: "First try." });
    const res = await sendInterest(student.accessToken, { listingId: listing._id, message: "Second try." });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INTEREST_ALREADY_PENDING");
  });

  it("allows a new interest after a previous one was declined", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();

    const first = await sendInterest(student.accessToken, { listingId: listing._id, message: "First try." });
    await respond(teacher.accessToken, first.body.data.interestRequest._id, "declined");

    const second = await sendInterest(student.accessToken, { listingId: listing._id, message: "Trying again." });

    expect(second.status).toBe(201);
  });

  it("404s for a closed listing", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    await request(app).delete(`/api/listings/${listing._id}`).set("Authorization", `Bearer ${teacher.accessToken}`);
    const student = await newStudent();

    const res = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });

    expect(res.status).toBe(404);
  });

  it("rejects a request with no token", async () => {
    const res = await request(app)
      .post("/api/interests")
      .send({ listingId: "000000000000000000000000", message: "Hi." });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/interests/sent and /received", () => {
  it("lists a student's sent interests and a teacher's received interests", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();
    await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });

    const sentRes = await request(app)
      .get("/api/interests/sent")
      .set("Authorization", `Bearer ${student.accessToken}`);
    const receivedRes = await request(app)
      .get("/api/interests/received")
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(sentRes.body.data.interests).toHaveLength(1);
    expect(receivedRes.body.data.interests).toHaveLength(1);
  });

  it("includes a linked child's sent interests in a parent's /sent list", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const { parent, childId } = await newParentWithChild();
    await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "Interested.",
      targetUserId: childId,
    });

    const res = await request(app).get("/api/interests/sent").set("Authorization", `Bearer ${parent.accessToken}`);

    expect(res.body.data.interests).toHaveLength(1);
    expect(res.body.data.interests[0].fromUserId).toBe(childId);
  });

  it("paginates", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    for (let i = 0; i < 3; i += 1) {
      const listing = await createListing(teacher.accessToken, { subject: `Subject${i}` });
      await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
    }

    const res = await request(app)
      .get("/api/interests/sent")
      .query({ page: 1, limit: 2 })
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.body.data.interests).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
  });
});

describe("PATCH /api/interests/:id/respond", () => {
  const createAndSend = async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();
    const res = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
    return { teacher, student, listing, interestId: res.body.data.interestRequest._id };
  };

  it("lets the teacher accept, revealing both sides' real contact info", async () => {
    const { teacher, student, interestId } = await createAndSend();

    const res = await respond(teacher.accessToken, interestId, "accepted");

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("accepted");
    expect(res.body.data.interestRequest.fromContact.email).toBe(student.payload.email);
    expect(res.body.data.interestRequest.toContact.email).toBe(teacher.payload.email);
  });

  it("still accepts (200, status persisted) even if chat conversation creation fails", async () => {
    // Regression test: accept saves interestRequest.status = "accepted"
    // BEFORE conversation creation is attempted, so a failure there must
    // not turn an already-committed accept into a client-visible error —
    // that would leave the client thinking accept failed while the server
    // considers it done, and a retry would only 400 (INVALID_STATE) with no
    // way to ever get a conversation afterwards.
    const { teacher, student, interestId } = await createAndSend();
    const createSpy = vi.spyOn(Conversation, "create").mockRejectedValueOnce(new Error("simulated DB error"));

    const res = await respond(teacher.accessToken, interestId, "accepted");

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("accepted");
    expect(res.body.data.conversationId).toBeNull();
    // The fallback channel (contact info) still works even though chat didn't.
    expect(res.body.data.interestRequest.fromContact.email).toBe(student.payload.email);

    createSpy.mockRestore();
  });

  it("lets the teacher decline, revealing no contact info", async () => {
    const { teacher, interestId } = await createAndSend();

    const res = await respond(teacher.accessToken, interestId, "declined");

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("declined");
    expect(res.body.data.interestRequest.fromContact).toBeUndefined();
  });

  it("rejects a respondent who isn't the toUserId", async () => {
    const { interestId } = await createAndSend();
    const stranger = await newTeacher();

    const res = await respond(stranger.accessToken, interestId, "accepted");

    expect(res.status).toBe(403);
  });

  it("rejects responding to an already-responded request", async () => {
    const { teacher, interestId } = await createAndSend();
    await respond(teacher.accessToken, interestId, "accepted");

    const res = await respond(teacher.accessToken, interestId, "declined");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects an invalid status value", async () => {
    const { teacher, interestId } = await createAndSend();

    const res = await respond(teacher.accessToken, interestId, "maybe");

    expect(res.status).toBe(422);
  });

  it("rejects a request with no token", async () => {
    const { interestId } = await createAndSend();
    const res = await request(app).patch(`/api/interests/${interestId}/respond`).send({ status: "accepted" });
    expect(res.status).toBe(401);
  });

  it("rejects accepting a child-linked request when the teacher isn't fully verified", async () => {
    const { parent, childId } = await newParentWithChild();
    const listing = await createListing(parent.accessToken, {
      type: "student_ad",
      subject: "Chemistry",
      targetUserId: childId,
    });
    const teacher = await newTeacher(); // no TeacherVerification record at all

    const sendRes = await sendInterest(teacher.accessToken, { listingId: listing._id, message: "I can help." });

    const res = await respond(parent.accessToken, sendRes.body.data.interestRequest._id, "accepted");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TEACHER_NOT_FULLY_VERIFIED");
  });

  it("allows accepting a child-linked request once the teacher is fully verified, revealing the parent's contact (not the child's placeholder)", async () => {
    const { parent, childId } = await newParentWithChild();
    const listing = await createListing(parent.accessToken, {
      type: "student_ad",
      subject: "Physics",
      targetUserId: childId,
    });
    const teacher = await newTeacher();
    await setFullyVerified(teacher.userId);

    const sendRes = await sendInterest(teacher.accessToken, { listingId: listing._id, message: "I can help." });
    const res = await respond(parent.accessToken, sendRes.body.data.interestRequest._id, "accepted");

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.toContact.email).toBe(parent.payload.email);
  });

  it("gates and reveals the parent's contact when the child is on the FROM side instead (parent sent interest for a child)", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken, { subject: "Biology" });
    const { parent, childId } = await newParentWithChild();

    const sendRes = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "For my child.",
      targetUserId: childId,
    });
    const interestId = sendRes.body.data.interestRequest._id;

    const blocked = await respond(teacher.accessToken, interestId, "accepted");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("TEACHER_NOT_FULLY_VERIFIED");

    await setFullyVerified(teacher.userId);

    const accepted = await respond(teacher.accessToken, interestId, "accepted");
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.interestRequest.fromContact.email).toBe(parent.payload.email);
  });
});

describe("PATCH /api/interests/:id/complete", () => {
  const createAcceptedInterest = async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();
    const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
    const interestId = sendRes.body.data.interestRequest._id;
    await respond(teacher.accessToken, interestId, "accepted");
    return { teacher, student, interestId };
  };

  it("lets the fromUserId side mark an accepted request completed", async () => {
    const { student, interestId } = await createAcceptedInterest();

    const res = await request(app)
      .patch(`/api/interests/${interestId}/complete`)
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("completed");
  });

  it("lets the toUserId side mark an accepted request completed", async () => {
    const { teacher, interestId } = await createAcceptedInterest();

    const res = await request(app)
      .patch(`/api/interests/${interestId}/complete`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("completed");
  });

  it("rejects completing a still-pending request", async () => {
    const teacher = await newTeacher();
    const listing = await createListing(teacher.accessToken);
    const student = await newStudent();
    const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });

    const res = await request(app)
      .patch(`/api/interests/${sendRes.body.data.interestRequest._id}/complete`)
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects a non-participant", async () => {
    const { interestId } = await createAcceptedInterest();
    const stranger = await newStudent();

    const res = await request(app)
      .patch(`/api/interests/${interestId}/complete`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("lets a parent complete on behalf of a linked-child participant", async () => {
    const teacher = await newTeacher();
    await setFullyVerified(teacher.userId); // this interest is child-linked, so accepting it requires this
    const listing = await createListing(teacher.accessToken);
    const { parent, childId } = await newParentWithChild();
    const sendRes = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      message: "For my child.",
      targetUserId: childId,
    });
    const interestId = sendRes.body.data.interestRequest._id;
    await respond(teacher.accessToken, interestId, "accepted");

    const res = await request(app)
      .patch(`/api/interests/${interestId}/complete`)
      .set("Authorization", `Bearer ${parent.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.interestRequest.status).toBe("completed");
  });

  it("rejects a request with no token", async () => {
    const { interestId } = await createAcceptedInterest();
    const res = await request(app).patch(`/api/interests/${interestId}/complete`);
    expect(res.status).toBe(401);
  });
});
