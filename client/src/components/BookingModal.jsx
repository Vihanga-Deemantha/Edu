import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Spinner } from "./ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import useNow from "../hooks/useNow.js";
import { availabilityApi, bookingsApi } from "../api/endpoints.js";
import { toLocalWindows, toMinutes } from "../lib/time.js";
import { apiError, formatClock, formatDate } from "../lib/format.js";

const DAYS_AHEAD = 21;
const STEP = 30; // minutes between offered start times
const DURATIONS = [30, 60, 90, 120];

const toHHmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Book a trial session on an accepted interest (spec §12.2). Only offers
 * dates/times inside the teacher's declared weekly availability, so an
 * invalid slot can't be picked in the first place; the server still
 * re-checks availability and conflicts on submit.
 */
const BookingModal = ({ open, onClose, interest, teacherId, teacherName, onBooked }) => {
  const now = useNow();
  const { data } = useAsync(() => availabilityApi.forTeacher(teacherId), [teacherId], { enabled: open && Boolean(teacherId) });
  const windows = useMemo(() => toLocalWindows(data?.availability || []), [data]);
  const [date, setDate] = useState(null);
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(null);

  const days = useMemo(() => {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS_AHEAD; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (windows.some((w) => w.dayOfWeek === d.getDay())) out.push(d);
    }
    return out;
  }, [windows]);

  const times = useMemo(() => {
    if (!date) return [];
    const out = [];
    windows
      .filter((w) => w.dayOfWeek === date.getDay())
      .forEach((w) => {
        for (let m = toMinutes(w.startTime); m + duration <= toMinutes(w.endTime); m += STEP) {
          const t = new Date(date);
          t.setHours(Math.floor(m / 60), m % 60, 0, 0);
          if (t.getTime() > now + 60 * 60 * 1000) out.push(toHHmm(m));
        }
      });
    return [...new Set(out)].sort();
  }, [date, windows, duration, now]);

  const submit = async () => {
    if (!date || !start) {
      setError("Pick a date and a start time.");
      return;
    }
    const startTime = new Date(date);
    const [h, m] = start.split(":").map(Number);
    startTime.setHours(h, m, 0, 0);
    setSaving(true);
    setError("");
    try {
      const { booking } = await bookingsApi.create({
        interestRequestId: interest._id,
        startTime: startTime.toISOString(),
        durationMinutes: duration,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setBooked(booking);
      onBooked?.(booking);
    } catch (err) {
      setError(apiError(err, "Couldn't book that slot."));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    onClose();
    setBooked(null);
    setStart("");
    setDate(null);
  };

  return (
    <Modal open={open} onClose={close} title={booked ? undefined : "Book a trial class"} width={560}>
      {booked ? (
        <div className="flex flex-col items-center gap-3.5 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-[28px] text-white">✓</div>
          <span className="serif text-[30px]">Booked</span>
          <span className="max-w-[380px] text-[15px] leading-normal text-ink-2">
            {formatDate(booked.startTime, { weekday: "long", day: "numeric", month: "long" })} at {formatClock(start)} with {teacherName || "your teacher"}.
            If a deposit is needed, you can pay it from Bookings.
          </span>
          <div className="mt-1.5 flex gap-2.5">
            <Link to="/bookings" className="btn btn-primary">Go to bookings</Link>
            <button type="button" className="btn btn-soft" onClick={close}>Done</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-6">
          {!data ? (
            <div className="flex items-center gap-2 text-sm text-ink-2"><Spinner /> Loading availability…</div>
          ) : days.length === 0 ? (
            <div className="rounded-xl bg-mist px-4 py-4 text-sm leading-relaxed">
              {teacherName || "This teacher"} hasn't published any weekly availability yet. Ask them in chat to add some times, then come back to book.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="field-label">Length</span>
                <div className="seg self-start">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" className={`seg-item ${duration === d ? "on" : ""}`} onClick={() => { setDuration(d); setStart(""); }}>
                      {d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? "s" : ""}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="field-label">Date</span>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {days.map((d) => {
                    const on = date && d.getTime() === date.getTime();
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => { setDate(d); setStart(""); setError(""); }}
                        className="flex w-[62px] flex-none flex-col items-center gap-0.5 rounded-xl border-[1.5px] py-2.5"
                        style={{ borderColor: on ? "var(--primary)" : "var(--line)", background: on ? "var(--primary)" : "#fff", color: on ? "#fff" : "var(--ink)" }}
                      >
                        <span className="text-[11px] font-bold opacity-80">{d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                        <span className="serif text-xl leading-none">{d.getDate()}</span>
                        <span className="text-[11px] opacity-80">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {date && (
                <div className="flex flex-col gap-2">
                  <span className="field-label">Start time</span>
                  {times.length === 0 ? (
                    <span className="text-sm text-ink-2">No {duration}-minute slots left on this day. Try a shorter length or another date.</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {times.map((t) => (
                        <button key={t} type="button" className={`chip ${start === t ? "on" : ""}`} onClick={() => { setStart(t); setError(""); }}>
                          {formatClock(t)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="field">
                <span className="field-label">Note for {teacherName?.split(" ")[0] || "the teacher"} (optional)</span>
                <textarea rows={2} maxLength={500} className="textarea min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to prepare, or topics to start with" />
              </label>
            </>
          )}
          {error && <span className="field-err">{error}</span>}
          <div className="flex justify-end gap-2.5">
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || !start}>
              {saving && <Spinner dark={false} />} Confirm booking
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BookingModal;
