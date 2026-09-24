import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import TeacherVerification from "../../../models/TeacherVerification.js";
import { registerAndVerify } from "../../../test/helpers.js";

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

const sendInterest = (token, body) =>
  request(app).post("/api/interests").set("Authorization", `Bearer ${token}`).send(body);

const respond = (token, interestId, status) =>
  request(app).patch(`/api/interests/${interestId}/respond`).set("Authorization", `Bearer ${token}`).send({ status });

// A child-linked accept is gated to a fully_verified teacher (Phase 10B) —
// needed here since the parent-books-for-child test's accept involves a child.
const setFullyVerified = (userId) =>
  TeacherVerification.create({
    userId,
    nicNumber: "199912345678",
    nicDocumentUrl: "https://example.com/nic.jpg",
    selfieWithIdUrl: "https://example.com/selfie.jpg",
    verificationTier: "fully_verified",
  });

/** Teacher posts a listing, studentToken's owner sends interest, teacher accepts. */
const createAcceptedInterest = async (teacher, studentToken) => {
  const listing = await createListing(teacher.accessToken);
  const sendRes = await sendInterest(studentToken, { listingId: listing._id, message: "Hi." });
  const interestId = sendRes.body.data.interestRequest._id;
  await respond(teacher.accessToken, interestId, "accepted");
  return interestId;
};

const addAvailability = (teacherToken, overrides = {}) =>
  request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({ dayOfWeek: 1, startTime: "16:00", endTime: "20:00", ...overrides });

/** Next UTC date matching dayOfWeek (0=Sun) at "HH:mm", guaranteed to be in the future. */
const nextOccurrence = (dayOfWeek, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date();
  result.setUTCHours(h, m, 0, 0);
  let diff = (dayOfWeek - result.getUTCDay() + 7) % 7;
  if (diff === 0 && result.getTime() <= Date.now()) diff = 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
};

const createBooking = (token, body) =>
  request(app).post("/api/bookings").set("Authorization", `Bearer ${token}`).send(body);

describe("POST /api/bookings", () => {
  it("books a trial session that fits the teacher's declared availability", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" });

    const res = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe("confirmed");
    expect(res.body.data.booking.teacherId).toBe(teacher.userId);
    expect(res.body.data.booking.studentId).toBe(student.userId);
  });

  it("also lets the teacher side create the booking, not just the student side", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" });

    const res = await createBooking(teacher.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(2, "09:30").toISOString(),
      durationMinutes: 30,
    });

    expect(res.status).toBe(201);
  });

  it("lets a parent book on behalf of their linked child", async () => {
    const teacher = await newTeacher();
    await setFullyVerified(teacher.userId);
    const { parent, childId } = await newParentWithChild();
    const listing = await createListing(teacher.accessToken);
    const sendRes = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      targetUserId: childId,
      message: "For my child.",
    });
    const interestId = sendRes.body.data.interestRequest._id;
    const acceptRes = await respond(teacher.accessToken, interestId, "accepted");
    expect(acceptRes.status).toBe(200);
    await addAvailability(teacher.accessToken, { dayOfWeek: 4, startTime: "14:00", endTime: "16:00" });

    const res = await createBooking(parent.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(4, "14:30").toISOString(),
      durationMinutes: 45,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.booking.studentId).toBe(childId);
  });

  it("rejects booking against an interest that hasn't been accepted yet", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const listing = await createListing(teacher.accessToken);
    const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });

    const res = await createBooking(student.accessToken, {
      interestRequestId: sendRes.body.data.interestRequest._id,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects a requester who isn't a participant in the interest request", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" });
    const stranger = await newStudent();

    const res = await createBooking(stranger.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60,
    });

    expect(res.status).toBe(403);
  });

  it("rejects a time outside the teacher's declared availability", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "18:00" });

    const res = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "20:00").toISOString(), // outside the 16:00-18:00 window
      durationMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OUTSIDE_AVAILABILITY");
  });

  it("under two concurrent requests for the same overlapping slot, exactly one booking survives confirmed", async () => {
    // Regression test for a real race: the pre-create hasConflict check is a
    // plain read, not an atomic guard, so two requests that both read
    // "no conflict" before either commits could previously both create a
    // "confirmed" booking for the same teacher at overlapping times.
    // Promise.all genuinely interleaves these two HTTP requests' internal
    // awaits — but even if a given run happens not to race (fully
    // serialized), the assertion below still holds: the pre-existing
    // pre-check alone correctly rejects the second one in that case too.
    // Either way, the invariant under test — never two confirmed
    // overlapping bookings for one teacher — must hold.
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 3, startTime: "10:00", endTime: "14:00" });
    const startTime = nextOccurrence(3, "11:00").toISOString();

    const [resA, resB] = await Promise.all([
      createBooking(student.accessToken, { interestRequestId: interestId, startTime, durationMinutes: 60 }),
      createBooking(student.accessToken, { interestRequestId: interestId, startTime, durationMinutes: 60 }),
    ]);

    expect([resA.status, resB.status].sort()).toEqual([201, 409]);
  });

  it("rejects a time overlapping an existing confirmed booking for the same teacher", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" });
    await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60, // 17:00-18:00
    });

    const res = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:30").toISOString(), // overlaps 17:00-18:00
      durationMinutes: 60,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_CONFLICT");
  });

  it("allows a back-to-back, non-overlapping slot right after an existing booking", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" });
    await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60, // 17:00-18:00
    });

    const res = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "18:00").toISOString(), // starts exactly when the first ends
      durationMinutes: 60,
    });

    expect(res.status).toBe(201);
  });

  it("rejects a startTime in the past", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);

    const res = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_START_TIME");
  });
});

describe("GET /api/bookings/mine", () => {
  it("returns the booking for both the teacher and the student side", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 5, startTime: "10:00", endTime: "12:00" });
    await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(5, "10:00").toISOString(),
      durationMinutes: 30,
    });

    const teacherView = await request(app)
      .get("/api/bookings/mine")
      .set("Authorization", `Bearer ${teacher.accessToken}`);
    const studentView = await request(app)
      .get("/api/bookings/mine")
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(teacherView.body.data.bookings).toHaveLength(1);
    expect(studentView.body.data.bookings).toHaveLength(1);
  });
});

describe("PATCH /api/bookings/:id/cancel", () => {
  const setUpConfirmedBooking = async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 6, startTime: "09:00", endTime: "11:00" });
    const bookingRes = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(6, "09:00").toISOString(),
      durationMinutes: 30,
    });
    return { teacher, student, bookingId: bookingRes.body.data.booking._id, startTime: nextOccurrence(6, "09:00") };
  };

  it("lets either participant cancel, freeing the slot for a new booking at the same time", async () => {
    const { teacher, student, bookingId, startTime } = await setUpConfirmedBooking();

    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.booking.status).toBe("cancelled");

    // Freshly re-derive an accepted interest + book the identical slot again —
    // this only succeeds if the cancelled booking no longer counts as a conflict.
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    const rebook = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: startTime.toISOString(),
      durationMinutes: 30,
    });
    expect(rebook.status).toBe(201);
  });

  it("rejects a non-participant trying to cancel", async () => {
    const { bookingId } = await setUpConfirmedBooking();
    const stranger = await newStudent();

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects cancelling an already-cancelled booking", async () => {
    const { teacher, bookingId } = await setUpConfirmedBooking();
    await request(app).patch(`/api/bookings/${bookingId}/cancel`).set("Authorization", `Bearer ${teacher.accessToken}`);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });
});

describe("PATCH /api/bookings/:id/complete", () => {
  it("lets either participant mark a confirmed booking completed", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 0, startTime: "13:00", endTime: "15:00" });
    const bookingRes = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(0, "13:00").toISOString(),
      durationMinutes: 30,
    });

    const res = await request(app)
      .patch(`/api/bookings/${bookingRes.body.data.booking._id}/complete`)
      .set("Authorization", `Bearer ${student.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("completed");
  });

  it("rejects completing a booking that was already cancelled", async () => {
    const teacher = await newTeacher();
    const student = await newStudent();
    const interestId = await createAcceptedInterest(teacher, student.accessToken);
    await addAvailability(teacher.accessToken, { dayOfWeek: 0, startTime: "13:00", endTime: "15:00" });
    const bookingRes = await createBooking(student.accessToken, {
      interestRequestId: interestId,
      startTime: nextOccurrence(0, "13:30").toISOString(),
      durationMinutes: 30,
    });
    await request(app)
      .patch(`/api/bookings/${bookingRes.body.data.booking._id}/cancel`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    const res = await request(app)
      .patch(`/api/bookings/${bookingRes.body.data.booking._id}/complete`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });
});
