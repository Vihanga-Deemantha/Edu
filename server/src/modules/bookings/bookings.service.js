import Booking from "../../models/Booking.js";
import InterestRequest from "../../models/InterestRequest.js";
import TeacherAvailability from "../../models/TeacherAvailability.js";
import Listing from "../../models/Listing.js";
import Payment from "../../models/Payment.js";
import { summarizeUsers, summarizeTeachers } from "../../utils/presenters.js";
import ApiError from "../../utils/ApiError.js";
import { resolveInterestSides, resolveActingSide } from "../interests/interests.service.js";
import { resolveOwnedUserIds } from "../../utils/familyAccess.js";

const minutesSinceMidnightUTC = (date) => date.getUTCHours() * 60 + date.getUTCMinutes();
const parseHHmm = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * A booking must fall entirely within a single declared availability window
 * on the same UTC day-of-week. A duration long enough to cross midnight can
 * never satisfy "same day, fully contained" against any window (every
 * window is itself within one calendar day), so that case is rejected here
 * without needing to special-case it separately.
 */
const fitsAvailability = async (teacherId, startTime, endTime) => {
  if (startTime.getUTCDay() !== endTime.getUTCDay()) return false;

  const startMinutes = minutesSinceMidnightUTC(startTime);
  const endMinutes = minutesSinceMidnightUTC(endTime);
  const windows = await TeacherAvailability.find({ teacherId, dayOfWeek: startTime.getUTCDay() });
  return windows.some((w) => parseHHmm(w.startTime) <= startMinutes && endMinutes <= parseHHmm(w.endTime));
};

/**
 * Any existing CONFIRMED booking for this teacher whose [startTime, endTime)
 * interval overlaps the requested one — standard interval-overlap test.
 * Cancelled bookings free the slot back up; completed ones are always in the
 * past relative to any new booking anyway.
 */
const hasConflict = async (teacherId, startTime, endTime) =>
  Boolean(
    await Booking.findOne({
      teacherId,
      status: "confirmed",
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).select("_id")
  );

/**
 * POST /api/bookings. Either participant of an ACCEPTED interest can book a
 * trial session — mirrors completeInterestRequest's "either side" rule,
 * since picking a slot the teacher already published as available IS the
 * confirmation; there's no separate propose/accept round-trip the way a
 * fresh InterestRequest needs one.
 */
export const createBooking = async ({
  interestRequestId,
  requesterId,
  requesterRole,
  startTime,
  durationMinutes,
  notes,
}) => {
  const interestRequest = await InterestRequest.findById(interestRequestId);
  if (!interestRequest) {
    throw new ApiError(404, "Interest request not found", "INTEREST_NOT_FOUND");
  }
  if (interestRequest.status !== "accepted") {
    throw new ApiError(400, "You can only book a trial session for an accepted interest request.", "INVALID_STATE");
  }
  if (!(await resolveActingSide(requesterId, requesterRole, interestRequest))) {
    throw new ApiError(403, "You are not a participant in this interest request.", "FORBIDDEN");
  }

  const start = new Date(startTime);
  if (start.getTime() <= Date.now()) {
    throw new ApiError(400, "startTime must be in the future.", "INVALID_START_TIME");
  }
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const { teacherUser, nonTeacherUser } = await resolveInterestSides(interestRequest);
  if (!teacherUser || !nonTeacherUser) {
    throw new ApiError(400, "This request has no teacher/student pairing to book against.", "INVALID_STATE");
  }

  if (!(await fitsAvailability(teacherUser._id, start, end))) {
    throw new ApiError(
      400,
      "The requested time is outside this teacher's declared availability.",
      "OUTSIDE_AVAILABILITY"
    );
  }
  if (await hasConflict(teacherUser._id, start, end)) {
    throw new ApiError(409, "This teacher already has a booking that overlaps this time.", "BOOKING_CONFLICT");
  }

  const booking = await Booking.create({
    interestRequestId,
    teacherId: teacherUser._id,
    studentId: nonTeacherUser._id,
    startTime: start,
    endTime: end,
    notes,
  });

  // The hasConflict check above is a plain read, not an atomic guard — two
  // concurrent requests for the same teacher's overlapping slot can both
  // pass it before either has actually committed, and both create a
  // "confirmed" booking (MongoDB has no range-exclusion constraint to catch
  // this at the index level the way a unique index would). This re-check
  // runs AFTER this document is durably persisted, against any OTHER
  // confirmed, overlapping booking created earlier (smaller _id — ObjectIds
  // are monotonic within this one server process). If one exists, this
  // request lost the race: back out the booking just created and report the
  // same conflict a same-timed pre-check would have. Whichever create()
  // actually lands in Mongo first survives; the other always finds it here
  // and self-cancels — so exactly one confirmed booking survives regardless
  // of how close the timing was.
  const olderConflict = await Booking.findOne({
    teacherId: teacherUser._id,
    status: "confirmed",
    _id: { $lt: booking._id },
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).select("_id");

  if (olderConflict) {
    booking.status = "cancelled";
    await booking.save();
    throw new ApiError(409, "This teacher already has a booking that overlaps this time.", "BOOKING_CONFLICT");
  }

  return booking;
};

/** GET /api/bookings/mine — the caller's own, as either teacher or student side. */
export const getMyBookings = async (requesterId, requesterRole, { page = 1, limit = 20 } = {}) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = { $or: [{ teacherId: { $in: userIds } }, { studentId: { $in: userIds } }] };
  const [bookings, total] = await Promise.all([
    Booking.find(filter).sort({ startTime: -1 }).skip(skip).limit(limitNum),
    Booking.countDocuments(filter),
  ]);
  return { bookings: await presentBookings(bookings), pagination: { page: pageNum, limit: limitNum, total } };
};

/**
 * Display context for a bookings list: both parties' names, the subject the
 * underlying interest was about, and the deposit's payment status (latest
 * Payment for the booking, or null if no checkout was ever started) — all
 * batch-resolved for the page rather than per row.
 */
const presentBookings = async (bookings) => {
  if (bookings.length === 0) return [];
  const bookingIds = bookings.map((b) => b._id);
  const partyIds = bookings.flatMap((b) => [b.teacherId, b.studentId]);

  const [users, teachers, interests, payments] = await Promise.all([
    summarizeUsers(partyIds),
    summarizeTeachers(bookings.map((b) => b.teacherId)),
    InterestRequest.find({ _id: { $in: bookings.map((b) => b.interestRequestId) } }).select("listingId"),
    Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).select("bookingId status amount currency paidAt"),
  ]);
  const listings = await Listing.find({ _id: { $in: interests.map((i) => i.listingId) } }).select(
    "subject grade medium"
  );

  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const listingByInterestId = new Map(interests.map((i) => [String(i._id), listingById.get(String(i.listingId))]));
  const paymentByBookingId = new Map();
  for (const payment of payments) {
    // Sorted newest-first, so the first one seen per booking is the latest.
    if (!paymentByBookingId.has(String(payment.bookingId))) paymentByBookingId.set(String(payment.bookingId), payment);
  }

  return bookings.map((booking) => {
    const teacher = users.get(String(booking.teacherId));
    const teacherProfile = teachers.get(String(booking.teacherId));
    const listing = listingByInterestId.get(String(booking.interestRequestId));
    const payment = paymentByBookingId.get(String(booking._id));
    return {
      ...booking.toObject(),
      teacher: teacher ? { ...teacher, photoUrl: teacherProfile?.photoUrl ?? null } : null,
      student: users.get(String(booking.studentId)) || null,
      listing: listing ? { _id: listing._id, subject: listing.subject, grade: listing.grade, medium: listing.medium } : null,
      payment: payment
        ? { status: payment.status, amount: payment.amount, currency: payment.currency, paidAt: payment.paidAt }
        : null,
    };
  });
};

/**
 * Reuses interests.service.js's resolveActingSide — identical "which side,
 * accounting for a parent acting for a linked child" logic, just applied to
 * Booking's teacherId/studentId instead of InterestRequest's fromUserId/
 * toUserId. Translated to "teacher"/"student" here purely for readability at
 * the call sites below. Exported for Phase 18B's payments.service.js, which
 * needs the same "which side is this requester" check restricted to the
 * student side only (a teacher never pays a trial deposit).
 */
export const resolveBookingSide = async (requesterId, requesterRole, booking) => {
  const side = await resolveActingSide(requesterId, requesterRole, {
    fromUserId: booking.teacherId,
    toUserId: booking.studentId,
  });
  if (side === "from") return "teacher";
  if (side === "to") return "student";
  return null;
};

const transitionBooking = async ({ bookingId, requesterId, requesterRole, nextStatus }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }
  if (!(await resolveBookingSide(requesterId, requesterRole, booking))) {
    throw new ApiError(403, "You do not have permission to modify this booking.", "FORBIDDEN");
  }
  if (booking.status !== "confirmed") {
    throw new ApiError(400, `This booking has already been ${booking.status}.`, "INVALID_STATE");
  }
  booking.status = nextStatus;
  await booking.save();
  return booking;
};

/** PATCH /api/bookings/:id/cancel — either participant. */
export const cancelBooking = (args) => transitionBooking({ ...args, nextStatus: "cancelled" });

/** PATCH /api/bookings/:id/complete — either participant, confirmed → completed only. */
export const completeBooking = (args) => transitionBooking({ ...args, nextStatus: "completed" });
