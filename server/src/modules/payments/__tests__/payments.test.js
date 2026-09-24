import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import Payment from "../../../models/Payment.js";
import { getStripeClient } from "../../../config/stripe.js";
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

const createListing = async (token) => {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "teacher_ad",
      subject: "Mathematics",
      grade: "Grade 10",
      medium: "english",
      description: "A perfectly reasonable listing description for testing.",
    });
  return res.body.data.listing;
};

const sendInterest = (token, body) =>
  request(app).post("/api/interests").set("Authorization", `Bearer ${token}`).send(body);

const respond = (token, interestId, status) =>
  request(app).patch(`/api/interests/${interestId}/respond`).set("Authorization", `Bearer ${token}`).send({ status });

const addAvailability = (teacherToken, overrides = {}) =>
  request(app)
    .post("/api/availability")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({ dayOfWeek: 1, startTime: "16:00", endTime: "20:00", ...overrides });

const nextOccurrence = (dayOfWeek, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const result = new Date();
  result.setUTCHours(h, m, 0, 0);
  let diff = (dayOfWeek - result.getUTCDay() + 7) % 7;
  if (diff === 0 && result.getTime() <= Date.now()) diff = 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
};

/** Teacher + student, accepted interest, one availability window, one confirmed booking. */
const setUpConfirmedBooking = async () => {
  const teacher = await newTeacher();
  const student = await newStudent();
  const listing = await createListing(teacher.accessToken);
  const sendRes = await sendInterest(student.accessToken, { listingId: listing._id, message: "Hi." });
  const interestId = sendRes.body.data.interestRequest._id;
  await respond(teacher.accessToken, interestId, "accepted");
  await addAvailability(teacher.accessToken, { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" });
  const bookingRes = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${student.accessToken}`)
    .send({
      interestRequestId: interestId,
      startTime: nextOccurrence(1, "17:00").toISOString(),
      durationMinutes: 60,
    });
  return { teacher, student, bookingId: bookingRes.body.data.booking._id };
};

const checkout = (token, bookingId) =>
  request(app).post("/api/payments/checkout").set("Authorization", `Bearer ${token}`).send({ bookingId });

const sendWebhook = (eventBody) =>
  request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("stripe-signature", "test-signature")
    .send(JSON.stringify(eventBody));

const completedEventFor = (stripeSessionId) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  type: "checkout.session.completed",
  data: { object: { id: stripeSessionId } },
});

describe("POST /api/payments/checkout", () => {
  it("creates a checkout session for the student side of a confirmed booking", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();

    const res = await checkout(student.accessToken, bookingId);

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toContain("checkout.stripe.com");

    const payment = await Payment.findOne({ bookingId });
    expect(payment.status).toBe("pending");
    expect(payment.amount).toBe(1000);
    expect(payment.currency).toBe("usd");
  });

  it("respects an explicit TRIAL_DEPOSIT_AMOUNT_CENTS=0 as a genuine free deposit (regression: `|| 1000` used to treat 0 as missing)", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    const original = process.env.TRIAL_DEPOSIT_AMOUNT_CENTS;
    process.env.TRIAL_DEPOSIT_AMOUNT_CENTS = "0";

    const res = await checkout(student.accessToken, bookingId);

    process.env.TRIAL_DEPOSIT_AMOUNT_CENTS = original;
    expect(res.status).toBe(201);
    const payment = await Payment.findOne({ bookingId });
    expect(payment.amount).toBe(0);
  });

  it("lets a parent pay on behalf of their linked child's booking", async () => {
    const teacher = await newTeacher();
    const { parent, childId } = await newParentWithChild();
    const listing = await createListing(teacher.accessToken);
    const sendRes = await sendInterest(parent.accessToken, {
      listingId: listing._id,
      targetUserId: childId,
      message: "For my child.",
    });
    const interestId = sendRes.body.data.interestRequest._id;

    // Child-linked accept needs a fully_verified teacher (Phase 10B rule).
    const TeacherVerification = (await import("../../../models/TeacherVerification.js")).default;
    await TeacherVerification.create({
      userId: teacher.userId,
      nicNumber: "199912345678",
      nicDocumentUrl: "https://example.com/nic.jpg",
      selfieWithIdUrl: "https://example.com/selfie.jpg",
      verificationTier: "fully_verified",
    });
    await respond(teacher.accessToken, interestId, "accepted");
    await addAvailability(teacher.accessToken, { dayOfWeek: 2, startTime: "10:00", endTime: "12:00" });
    const bookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${parent.accessToken}`)
      .send({
        interestRequestId: interestId,
        startTime: nextOccurrence(2, "10:00").toISOString(),
        durationMinutes: 30,
      });

    const res = await checkout(parent.accessToken, bookingRes.body.data.booking._id);

    expect(res.status).toBe(201);
    const payment = await Payment.findOne({ bookingId: bookingRes.body.data.booking._id });
    expect(String(payment.payerId)).toBe(parent.userId);
  });

  it("rejects the teacher side trying to pay its own booking's deposit", async () => {
    const { teacher, bookingId } = await setUpConfirmedBooking();

    const res = await checkout(teacher.accessToken, bookingId);

    expect(res.status).toBe(403);
  });

  it("rejects a requester who isn't a participant in the booking", async () => {
    const { bookingId } = await setUpConfirmedBooking();
    const stranger = await newStudent();

    const res = await checkout(stranger.accessToken, bookingId);

    expect(res.status).toBe(403);
  });

  it("rejects starting checkout for a cancelled booking", async () => {
    const { teacher, student, bookingId } = await setUpConfirmedBooking();
    await request(app).patch(`/api/bookings/${bookingId}/cancel`).set("Authorization", `Bearer ${teacher.accessToken}`);

    const res = await checkout(student.accessToken, bookingId);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATE");
  });

  it("rejects starting a new checkout once the deposit has already been paid", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);
    const payment = await Payment.findOne({ bookingId });
    await sendWebhook(completedEventFor(payment.stripeSessionId));

    const res = await checkout(student.accessToken, bookingId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_PAID");
  });
});

describe("GET /api/payments/booking/:bookingId", () => {
  it("reflects pending, then paid, for either side of the booking", async () => {
    const { teacher, student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);

    const beforeRes = await request(app)
      .get(`/api/payments/booking/${bookingId}`)
      .set("Authorization", `Bearer ${teacher.accessToken}`);
    expect(beforeRes.body.data.payment.status).toBe("pending");

    const payment = await Payment.findOne({ bookingId });
    await sendWebhook(completedEventFor(payment.stripeSessionId));

    const afterRes = await request(app)
      .get(`/api/payments/booking/${bookingId}`)
      .set("Authorization", `Bearer ${student.accessToken}`);
    expect(afterRes.body.data.payment.status).toBe("paid");
  });

  it("rejects a non-participant reading the payment status", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);
    const stranger = await newStudent();

    const res = await request(app)
      .get(`/api/payments/booking/${bookingId}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/payments/webhook", () => {
  it("marks the payment paid on checkout.session.completed", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);
    const payment = await Payment.findOne({ bookingId });

    const res = await sendWebhook(completedEventFor(payment.stripeSessionId));

    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id)).status).toBe("paid");
  });

  it("is idempotent — processing the same completed event twice doesn't error", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);
    const payment = await Payment.findOne({ bookingId });
    const event = completedEventFor(payment.stripeSessionId);

    await sendWebhook(event);
    const secondRes = await sendWebhook(event);

    expect(secondRes.status).toBe(200);
    expect((await Payment.findById(payment._id)).status).toBe("paid");
  });

  it("ignores an event type it doesn't handle, without erroring or changing state", async () => {
    const { student, bookingId } = await setUpConfirmedBooking();
    await checkout(student.accessToken, bookingId);
    const payment = await Payment.findOne({ bookingId });

    const res = await sendWebhook({
      id: "evt_irrelevant",
      type: "payment_intent.created",
      data: { object: { id: payment.stripeSessionId } },
    });

    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id)).status).toBe("pending");
  });

  it("rejects a request whose signature verification fails", async () => {
    const stripe = getStripeClient();
    stripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("simulated invalid signature");
    });

    const res = await sendWebhook({ type: "checkout.session.completed", data: { object: { id: "cs_whatever" } } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });
});
