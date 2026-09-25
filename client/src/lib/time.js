// Availability windows are stored in UTC (dayOfWeek + "HH:mm") — the backend
// compares bookings against them in UTC and keeps no per-user timezone (see
// server/src/models/TeacherAvailability.js). Every screen shows and edits them
// in the viewer's local time, converting at the edges with these helpers.

const MIN_PER_DAY = 1440;

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Minutes to add to local time to get UTC (e.g. -330 in Sri Lanka).
const utcOffsetMinutes = () => new Date().getTimezoneOffset();

const shift = (day, minutes, delta) => {
  let m = minutes + delta;
  let d = day;
  if (m < 0) {
    m += MIN_PER_DAY;
    d = (d + 6) % 7;
  } else if (m >= MIN_PER_DAY) {
    m -= MIN_PER_DAY;
    d = (d + 1) % 7;
  }
  return { day: d, minutes: m };
};

/**
 * Local window → UTC window for POST /api/availability. Returns null when the
 * window would cross midnight UTC (e.g. before 5:30 am in Sri Lanka), since a
 * stored window must sit within a single UTC day.
 */
export const localWindowToUtc = (dayOfWeek, startTime, endTime) => {
  const start = shift(dayOfWeek, toMinutes(startTime), utcOffsetMinutes());
  const end = shift(dayOfWeek, toMinutes(endTime), utcOffsetMinutes());
  if (start.day !== end.day || end.minutes <= start.minutes) return null;
  return { dayOfWeek: start.day, startTime: toHHmm(start.minutes), endTime: toHHmm(end.minutes) };
};

/** UTC window (as returned by the API) → the same window in local time. */
export const utcWindowToLocal = (w) => {
  const start = shift(w.dayOfWeek, toMinutes(w.startTime), -utcOffsetMinutes());
  // End = start + duration, clamped to the same local day (windows created
  // through this app never cross local midnight).
  const duration = toMinutes(w.endTime) - toMinutes(w.startTime);
  const end = Math.min(start.minutes + duration, MIN_PER_DAY - 1);
  return { ...w, dayOfWeek: start.day, startTime: toHHmm(start.minutes), endTime: toHHmm(end) };
};

export const toLocalWindows = (windows = []) => windows.map(utcWindowToLocal);
