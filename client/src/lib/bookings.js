// Booking list helpers shared by the Home dashboards.

/** Confirmed bookings in the current Monday–Sunday week, soonest first. */
export const thisWeek = (bookings, now = Date.now()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return bookings
    .filter((b) => b.status === "confirmed" && new Date(b.startTime) >= start && new Date(b.startTime) < end)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
};

/** Confirmed bookings that haven't started yet, soonest first. */
export const upcoming = (bookings, now = Date.now()) =>
  bookings
    .filter((b) => b.status === "confirmed" && new Date(b.startTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
