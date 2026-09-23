import * as bookingsService from "./bookings.service.js";

// ─── POST /api/bookings  (protected, either interest participant) ───────────
export const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingsService.createBooking({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      ...req.body,
    });
    res.status(201).json({ success: true, data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/bookings/mine  (protected) ─────────────────────────────────────
export const getMyBookings = async (req, res, next) => {
  try {
    const { bookings, pagination } = await bookingsService.getMyBookings(req.user.id, req.user.role, req.query);
    res.status(200).json({ success: true, data: { bookings, pagination } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/bookings/:id/cancel  (protected, either participant) ────────
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingsService.cancelBooking({
      bookingId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json({ success: true, data: { booking } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/bookings/:id/complete  (protected, either participant) ──────
export const completeBooking = async (req, res, next) => {
  try {
    const booking = await bookingsService.completeBooking({
      bookingId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json({ success: true, data: { booking } });
  } catch (err) {
    next(err);
  }
};
