import { DAYS_SHORT, formatClock } from "../lib/format.js";
import { toLocalWindows } from "../lib/time.js";

// Monday-first display order; backend dayOfWeek is 0 = Sunday.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const PARTS = [
  ["Mor", 0, 12],
  ["Aft", 12, 17],
  ["Eve", 17, 24],
];

const hour = (hhmm) => Number(hhmm.split(":")[0]) + Number(hhmm.split(":")[1]) / 60;

/**
 * Compact weekly grid (morning / afternoon / evening per day) — a planning
 * signal on profiles and listings, not a booking surface. Each cell lights
 * up when any declared window overlaps that part of the day; the exact
 * windows are listed in the cell's tooltip.
 */
const AvailabilityWeek = ({ windows: utcWindows = [] }) => {
  const windows = toLocalWindows(utcWindows);
  return (
  <div className="card grid gap-2 p-[18px]" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
    {ORDER.map((day) => {
      const dayWindows = windows.filter((w) => w.dayOfWeek === day);
      return (
        <div key={day} className="flex flex-col items-stretch gap-1.5">
          <span className="text-center text-xs font-bold text-ink-2">{DAYS_SHORT[day]}</span>
          {PARTS.map(([label, from, to]) => {
            const hits = dayWindows.filter((w) => hour(w.startTime) < to && hour(w.endTime) > from);
            const on = hits.length > 0;
            return (
              <div
                key={label}
                title={on ? hits.map((w) => `${formatClock(w.startTime)} – ${formatClock(w.endTime)}`).join(", ") : undefined}
                className="flex h-[30px] items-center justify-center rounded-md text-[11px] font-semibold text-white"
                style={{ background: on ? "var(--primary)" : "var(--line-soft)" }}
              >
                {on ? label : ""}
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
  );
};

export default AvailabilityWeek;
