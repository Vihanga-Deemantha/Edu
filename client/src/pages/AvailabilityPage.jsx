import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { PageLoader, Spinner } from "../components/ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { availabilityApi, bookingsApi } from "../api/endpoints.js";
import { localWindowToUtc, toLocalWindows, toMinutes } from "../lib/time.js";
import { apiError } from "../lib/format.js";

// Grid is shown Monday-first; values are JS getDay() numbers (0 = Sunday).
const DAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"],
];
const H0 = 7;
const H1 = 22;
const HOURS = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);

const key = (day, hour) => `${day}-${hour}`;
const hourLabel = (h) => `${h % 12 || 12} ${h >= 12 ? "pm" : "am"}`;
const pad = (h) => `${String(h).padStart(2, "0")}:00`;

/** Grid cells → contiguous local windows per day. */
const gridToWindows = (cells) =>
  DAYS.flatMap(([day]) => {
    const out = [];
    let start = null;
    for (let h = H0; h <= H1; h += 1) {
      const on = h < H1 && cells[key(day, h)];
      if (on && start === null) start = h;
      if (!on && start !== null) {
        out.push({ dayOfWeek: day, startTime: pad(start), endTime: pad(h) });
        start = null;
      }
    }
    return out;
  });

const windowsToGrid = (windows) => {
  const cells = {};
  windows.forEach((w) => {
    HOURS.forEach((h) => {
      if (toMinutes(w.startTime) < (h + 1) * 60 && toMinutes(w.endTime) > h * 60) cells[key(w.dayOfWeek, h)] = true;
    });
  });
  return cells;
};

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const AvailabilityPage = () => {
  const { user } = useAuth();
  const { data, loading, reload } = useAsync(() => availabilityApi.forTeacher(user._id), [user._id]);
  const { data: bookingData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);
  const stored = useMemo(() => toLocalWindows(data?.availability || []), [data]);
  const savedGrid = useMemo(() => windowsToGrid(stored), [stored]);
  const [cells, setCells] = useState(savedGrid);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);

  // Re-seed the editable grid whenever the saved availability reloads.
  const [seededFrom, setSeededFrom] = useState(savedGrid);
  if (seededFrom !== savedGrid) {
    setSeededFrom(savedGrid);
    setCells(savedGrid);
    setDirty(false);
  }

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // This week's confirmed bookings, shown on top of the grid (not editable here).
  const booked = useMemo(() => {
    const out = {};
    const from = startOfWeek();
    const to = new Date(from);
    to.setDate(from.getDate() + 7);
    (bookingData?.bookings || [])
      .filter((b) => b.status === "confirmed" && new Date(b.startTime) >= from && new Date(b.startTime) < to)
      .forEach((b) => {
        const s = new Date(b.startTime);
        const e = new Date(b.endTime);
        for (let h = s.getHours(); h < e.getHours() + (e.getMinutes() ? 1 : 0); h += 1) {
          out[key(s.getDay(), h)] = b.student?.name || "Booked";
        }
      });
    return out;
  }, [bookingData]);

  const paint = (k, mode) => {
    if (booked[k]) return;
    setCells((c) => {
      const next = { ...c };
      if (mode === "add") next[k] = true;
      else delete next[k];
      return next;
    });
    setDirty(true);
  };

  const setAll = (next) => {
    setCells(next);
    setDirty(true);
  };

  const save = async () => {
    const desired = gridToWindows(cells);
    const same = (a, b) => a.dayOfWeek === b.dayOfWeek && a.startTime === b.startTime && a.endTime === b.endTime;
    const toDelete = stored.filter((w) => !desired.some((d) => same(d, w)));
    const toCreate = desired.filter((d) => !stored.some((w) => same(d, w)));
    const utc = toCreate.map((w) => ({ w, utc: localWindowToUtc(w.dayOfWeek, w.startTime, w.endTime) }));
    const invalid = utc.filter((x) => !x.utc);
    if (invalid.length) {
      toast.error("Some times cross midnight UTC and can't be saved. Remove very early or very late hours.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(toDelete.map((w) => availabilityApi.remove(w._id)));
      await Promise.all(utc.map((x) => availabilityApi.create(x.utc)));
      toast.success("Availability saved. Students see the update now.");
      await reload();
    } catch (err) {
      toast.error(apiError(err, "Couldn't save all of your availability."));
      reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const isOn = (k) => Boolean(cells[k] || booked[k]);
  const openHours = Object.keys(cells).filter((k) => !booked[k]).length;
  const bookedHours = Object.keys(booked).length;
  const summary = DAYS.map(([day, label]) => {
    const ranges = gridToWindows(cells).filter((w) => w.dayOfWeek === day);
    return { label, text: ranges.map((r) => `${hourLabel(toMinutes(r.startTime) / 60).replace(" ", "")}–${hourLabel(toMinutes(r.endTime) / 60).replace(" ", "")}`).join(", ") };
  }).filter((s) => s.text);
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="shell flex flex-col gap-6 pb-32 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-2">
          <span className="eyebrow">Teacher</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>Weekly availability</h1>
          <p className="serif text-[17px] leading-normal text-ink-2">
            Students with an accepted interest can book any open slot — nothing outside these times can be booked. Click or drag across the grid to mark when you're free.
          </p>
        </div>
        <Link to="/bookings" className="btn btn-outline">View bookings</Link>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        <section className="card flex min-w-0 flex-col gap-4 rounded-[18px] p-[22px]" style={{ flex: "999 1 620px" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-[13px] text-ink-2">
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-primary" />Available</span>
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-ink" />Booked this week</span>
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border border-line bg-line-soft" />Not available</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => {
                const next = { ...cells };
                DAYS.slice(0, 5).forEach(([d]) => { for (let h = 16; h < 20; h += 1) next[key(d, h)] = true; });
                setAll(next);
              }}>Weekday evenings</button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => {
                const next = { ...cells };
                [6, 0].forEach((d) => { for (let h = 8; h < 17; h += 1) next[key(d, h)] = true; });
                setAll(next);
              }}>Weekends</button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setAll({})}>Clear all</button>
            </div>
          </div>

          <div className="select-none overflow-x-auto" onMouseLeave={() => (drag.current = null)}>
            <div className="grid min-w-[620px] gap-x-1.5" style={{ gridTemplateColumns: "64px repeat(7, minmax(72px, 1fr))" }}>
              <span />
              {DAYS.map(([day, label], i) => {
                const n = HOURS.filter((h) => isOn(key(day, h))).length;
                return (
                  <div key={day} className="flex flex-col items-center gap-1 pb-2.5">
                    <span className="text-[13px] font-bold">{label}</span>
                    <span className="text-[11px] text-ink-2">{n ? `${n} h` : "—"}</span>
                    <button
                      type="button"
                      title="Copy this day to all weekdays"
                      className="border-0 bg-transparent p-0 text-[11px] font-semibold text-primary"
                      style={{ visibility: i < 5 && n ? "visible" : "hidden" }}
                      onClick={() => {
                        const next = { ...cells };
                        DAYS.slice(0, 5).forEach(([d]) => {
                          if (d === day) return;
                          HOURS.forEach((h) => {
                            if (booked[key(d, h)]) return;
                            if (cells[key(day, h)]) next[key(d, h)] = true;
                            else delete next[key(d, h)];
                          });
                        });
                        setAll(next);
                        toast.success(`Copied ${label} to all weekdays`);
                      }}
                    >
                      Copy →
                    </button>
                  </div>
                );
              })}
              {HOURS.map((h) => (
                <div key={h} className="contents">
                  <span className="-translate-y-[7px] pr-1.5 text-right text-[11px] text-ink-2">{hourLabel(h)}</span>
                  {DAYS.map(([day, dayLabel]) => {
                    const k = key(day, h);
                    const b = booked[k];
                    const on = isOn(k);
                    const up = isOn(key(day, h - 1));
                    const dn = isOn(key(day, h + 1));
                    const sameUp = on && up && Boolean(b) === Boolean(booked[key(day, h - 1)]);
                    const sameDn = on && dn && Boolean(b) === Boolean(booked[key(day, h + 1)]);
                    const firstOfBooking = b && booked[key(day, h - 1)] !== b;
                    return (
                      <div
                        key={k}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        aria-label={`${dayLabel} ${hourLabel(h)}${b ? ", booked" : on ? ", available" : ""}`}
                        title={b ? `Booked: ${b}` : `${dayLabel} ${hourLabel(h)}–${hourLabel(h + 1)}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (b) return;
                          drag.current = cells[k] ? "remove" : "add";
                          paint(k, drag.current);
                        }}
                        onMouseEnter={() => drag.current && paint(k, drag.current)}
                        onKeyDown={(e) => {
                          if ((e.key === " " || e.key === "Enter") && !b) {
                            e.preventDefault();
                            paint(k, cells[k] ? "remove" : "add");
                          }
                        }}
                        className="flex h-[30px] items-center justify-center text-[10px] font-bold tracking-[.04em] text-white transition-colors"
                        style={{
                          marginBottom: sameDn ? 0 : 3,
                          borderRadius: on ? `${sameUp ? 0 : 7}px ${sameUp ? 0 : 7}px ${sameDn ? 0 : 7}px ${sameDn ? 0 : 7}px` : 4,
                          background: b ? "var(--ink)" : on ? "var(--primary)" : "var(--line-soft)",
                          cursor: b ? "not-allowed" : "pointer",
                        }}
                      >
                        {firstOfBooking ? b.split(" ")[0].toUpperCase() : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <span className="text-xs text-ink-2">
            Times are in your local time ({tz}). Booked slots can't be removed here — cancel them from Bookings.
          </span>
        </section>

        <aside className="sticky top-[104px] flex flex-col gap-4" style={{ flex: "1 1 300px", maxWidth: 380 }}>
          <div className="card-dark flex flex-col gap-3.5 rounded-[18px] p-[22px]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-[22px]">This week</span>
              <span className="text-[13px] text-lavender">
                {weekStart.toLocaleDateString("en-GB", { day: "numeric" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/[.07] p-3.5"><div className="serif text-[30px] leading-none">{openHours}</div><div className="mt-1.5 text-xs text-lavender">Open hours / week</div></div>
              <div className="rounded-xl bg-white/[.07] p-3.5"><div className="serif text-[30px] leading-none">{bookedHours}</div><div className="mt-1.5 text-xs text-lavender">Booked hours</div></div>
            </div>
            <div className="flex flex-col gap-1.5">
              {summary.map((s) => (
                <div key={s.label} className="flex justify-between gap-3 text-[13px]">
                  <span className="w-9 flex-none text-lavender">{s.label}</span>
                  <span className="text-right">{s.text}</span>
                </div>
              ))}
              {summary.length === 0 && <span className="text-[13px] text-lavender">No open slots yet. Drag across the grid to add some.</span>}
            </div>
          </div>
          <div className="card flex flex-col gap-3 rounded-[18px] p-[22px] text-sm leading-relaxed text-ink-2">
            <span className="serif text-lg font-bold text-ink">How booking works</span>
            <span>Once you accept an interest, the student (or their parent) can book a trial of 30 minutes to 2 hours inside these windows.</span>
            <span>Two bookings can never overlap — EduLink blocks double-booking automatically.</span>
            <span>Your public profile shows a summary of these times so families can plan.</span>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-line" style={{ background: "rgba(251,250,253,.96)", backdropFilter: "blur(10px)" }}>
        <div className="shell flex flex-wrap items-center gap-3.5 py-3.5">
          <span className="flex items-center gap-2 text-sm text-ink-2" style={{ flex: "1 1 240px" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: dirty ? "var(--blue)" : "var(--primary)" }} />
            {dirty ? "Unsaved changes to your availability" : "All changes saved"}
          </span>
          <button type="button" className="btn btn-soft" disabled={!dirty || saving} onClick={() => { setCells(savedGrid); setDirty(false); }}>Discard</button>
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving && <Spinner dark={false} />} {saving ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityPage;
