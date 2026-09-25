import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import Icon from "../../components/ui/Icon.jsx";
import { Avatar, PageLoader, Segmented, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import { adminApi } from "../../api/endpoints.js";
import { formatMinorAmount, formatNumber, relativeTime } from "../../lib/format.js";

const RANGES = [
  [30, "Last 30 days"],
  [90, "Last 90 days"],
  [365, "This year"],
];

const monthLabel = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

/** Single-series monthly bar chart (one hue, per-bar hover tooltip, baseline-anchored rounded tops). */
const BarChart = ({ series, format }) => {
  const [hover, setHover] = useState(-1);
  const max = Math.max(1, ...series.map((s) => s.value));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const ticks = [nice, nice * 0.75, nice * 0.5, nice * 0.25, 0];
  const last = series.length - 1;
  return (
    <div className="flex flex-1 gap-2.5" style={{ minHeight: 220 }}>
      <div className="flex min-w-[40px] flex-col justify-between pb-[22px] text-right text-[11px] text-ink-2" aria-hidden="true">
        {ticks.map((t) => <span key={t}>{format(t, true)}</span>)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex flex-1 items-end gap-0.5 border-b border-line" role="img" aria-label={series.map((s) => `${monthLabel(s.month)}: ${format(s.value)}`).join(", ")}>
          {ticks.slice(0, -1).map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-line-soft" style={{ bottom: `${(t / nice) * 100}%` }} />
          ))}
          {series.map((s, i) => {
            const h = (s.value / nice) * 100;
            return (
              <div
                key={s.month}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
              >
                <div
                  className="relative w-[70%] rounded-t transition-[height]"
                  style={{ height: `${Math.max(h, s.value ? 1.5 : 0)}%`, background: i === last || hover === i ? "var(--primary)" : "var(--blue)" }}
                />
                {hover === i && (
                  <div className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white" style={{ bottom: `calc(${h}% + 8px)` }}>
                    {monthLabel(s.month)}: {format(s.value)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-0.5 pt-2">
          {series.map((s) => <span key={s.month} className="flex-1 text-center text-[11px] text-ink-2">{monthLabel(s.month)}</span>)}
        </div>
      </div>
    </div>
  );
};

/** Half-ring gauge: fully verified (dark) + ID-only (light) share of teacher profiles. */
const Gauge = ({ full, id }) => {
  const L = Math.PI * 85;
  return (
    <div className="relative mt-2.5" style={{ width: 210, height: 120 }}>
      <svg width="210" height="120" viewBox="0 0 210 120" aria-hidden="true">
        <path d="M 20 105 A 85 85 0 0 1 190 105" fill="none" stroke="var(--mist)" strokeWidth="22" strokeLinecap="round" />
        {id > 0 && (
          <path d="M 20 105 A 85 85 0 0 1 190 105" fill="none" stroke="var(--blue)" strokeWidth="22" strokeLinecap="round" strokeDasharray={`${(L * (full + id)) / 100} ${L}`} />
        )}
        {full > 0 && (
          <path d="M 20 105 A 85 85 0 0 1 190 105" fill="none" stroke="var(--primary)" strokeWidth="22" strokeLinecap="round" strokeDasharray={`${(L * full) / 100} ${L}`} />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-1.5 flex flex-col items-center gap-0.5">
        <span className="text-[11px] text-ink-2">Verified teachers</span>
        <span className="serif text-[32px] leading-none">{full + id}%</span>
      </div>
    </div>
  );
};

const Kpi = ({ icon, iconBg, iconFg, label, value, delta, deltaBad }) => (
  <div className="card flex items-start gap-3.5 px-5 py-[18px]">
    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-xl" style={{ background: iconBg, color: iconFg }}>
      <Icon name={icon} size={22} strokeWidth={1.5} />
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="serif text-[30px] leading-none">{value}</span>
      {delta && (
        <span className="mt-1 self-start whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-bold" style={{ background: deltaBad ? "var(--danger-soft)" : "var(--mist)", color: deltaBad ? "var(--danger)" : "var(--primary)" }}>
          {delta}
        </span>
      )}
    </div>
  </div>
);

const AdminDashboardPage = () => {
  const { queues } = useOutletContext();
  const [range, setRange] = useState(30);
  const [chart, setChart] = useState("bookings");
  const { data, loading } = useAsync(() => adminApi.stats({ rangeDays: range }), [range]);
  const { data: recentVer } = useAsync(() => adminApi.verifications({ status: "all", limit: 4 }), []);
  const { data: openReports } = useAsync(() => adminApi.reports({ status: "pending", limit: 3 }), []);

  if (loading && !data) return <PageLoader />;
  const s = data?.stats;
  if (!s) return null;

  const bookingSeries = s.bookings.monthly.map((m) => ({ month: m.month, value: m.count }));
  const depositSeries = s.deposits.monthly.map((m) => ({ month: m.month, value: m.amount }));
  const cur = s.deposits.currency;
  const thisMonthBookings = bookingSeries.at(-1)?.value || 0;
  const lastMonthBookings = bookingSeries.at(-2)?.value || 0;
  const bookingDelta = lastMonthBookings ? Math.round(((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100) : null;
  const thisMonthDeposits = depositSeries.at(-1)?.value || 0;
  const depositCount = s.deposits.monthly.at(-1)?.count || 0;
  const tp = s.verification.teacherProfiles || 0;
  const fullPct = tp ? Math.round((s.verification.fullyVerified / tp) * 100) : 0;
  const idPct = tp ? Math.round((s.verification.idVerified / tp) * 100) : 0;
  const totalUsers = s.users.teachers + s.users.students + s.users.parents || 1;

  return (
    <div className="rise flex flex-col gap-5">
      <div className="flex flex-wrap justify-end gap-2.5">
        <label className="flex h-[42px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold">
          <Icon name="calendar" size={17} />
          <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="border-0 bg-transparent text-sm font-semibold text-ink outline-none">
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <Kpi icon="cap" iconBg="var(--mist)" iconFg="var(--primary)" label="Teachers" value={formatNumber(s.users.teachers)} delta={`↑ ${s.users.newTeachers} new in ${range}d`} />
        <Kpi icon="users" iconBg="var(--primary)" iconFg="#fff" label="Students & parents" value={formatNumber(s.users.students + s.users.parents)} delta={s.users.suspended ? `${s.users.suspended} suspended` : null} deltaBad />
        <Kpi
          icon="book"
          iconBg="var(--ink)"
          iconFg="#fff"
          label="Bookings this month"
          value={formatNumber(thisMonthBookings)}
          delta={bookingDelta === null ? null : `${bookingDelta >= 0 ? "↑" : "↓"} ${Math.abs(bookingDelta)}% vs last month`}
          deltaBad={bookingDelta !== null && bookingDelta < 0}
        />
        <Kpi icon="wallet" iconBg="var(--lavender)" iconFg="var(--ink)" label="Deposits this month" value={formatMinorAmount(thisMonthDeposits, cur)} delta={`${depositCount} paid`} />
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        <section className="card flex min-w-0 flex-wrap rounded-[18px]" style={{ flex: "999 1 560px" }}>
          <div className="flex min-w-0 flex-col gap-4 p-[22px]" style={{ flex: "3 1 380px" }}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="serif text-[19px] font-bold">{chart === "bookings" ? "Bookings per month" : "Deposits per month"}</span>
              <Segmented options={[{ value: "bookings", label: "Bookings" }, { value: "deposits", label: "Deposits" }]} value={chart} onChange={setChart} />
            </div>
            <BarChart
              series={chart === "bookings" ? bookingSeries : depositSeries}
              format={(v, tick) => (chart === "bookings" ? formatNumber(Math.round(v)) : tick ? formatMinorAmount(v, cur).replace(/\.00$/, "") : formatMinorAmount(v, cur))}
            />
            <div className="grid grid-cols-3 border-t border-mist pt-3.5">
              {(chart === "bookings"
                ? [["This month", formatNumber(thisMonthBookings)], ["Upcoming confirmed", formatNumber(s.bookings.confirmed)], ["Completion rate", s.bookings.completionRate === null ? "—" : `${s.bookings.completionRate}%`]]
                : [["This month", formatMinorAmount(thisMonthDeposits, cur)], ["Paid deposits", formatNumber(depositCount)], ["12-month total", formatMinorAmount(depositSeries.reduce((n, x) => n + x.value, 0), cur)]]
              ).map(([l, v], i) => (
                <div key={l} className="flex flex-col gap-1 px-3" style={{ borderLeft: i ? "1px solid var(--mist)" : "none" }}>
                  <span className="text-xs text-ink-2">{l}</span>
                  <span className="serif text-[22px] leading-none">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-3.5 border-l border-mist p-[22px]" style={{ flex: "2 1 240px" }}>
            <span className="serif self-stretch text-[19px] font-bold">Trust score</span>
            <Gauge full={fullPct} id={idPct} />
            <span className="max-w-[240px] text-center text-[13px] leading-normal text-ink-2">Share of teacher profiles with at least ID verification. Fully verified shown in dark blue.</span>
            <div className="flex flex-wrap justify-center gap-3.5 text-xs text-ink-2">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Fully · {fullPct}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue" />ID only · {idPct}%</span>
            </div>
            <div className="flex-1" />
            <div className="grid grid-cols-2 gap-2 self-stretch">
              <div className="flex flex-col gap-[3px] rounded-xl bg-mist p-3">
                <span className="serif text-[22px] leading-none">{s.verification.avgReviewHours === null ? "—" : `${s.verification.avgReviewHours}h`}</span>
                <span className="text-[11px] text-ink-2">Avg. review time</span>
              </div>
              <div className="flex flex-col gap-[3px] rounded-xl bg-mist p-3">
                <span className="serif text-[22px] leading-none">{s.verification.rejectionRate === null ? "—" : `${s.verification.rejectionRate}%`}</span>
                <span className="text-[11px] text-ink-2">Rejection rate</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-5" style={{ flex: "1 1 280px" }}>
          <div className="card flex flex-col gap-3.5 rounded-[18px] p-5">
            <div className="flex items-baseline justify-between">
              <span className="serif text-[19px] font-bold">Queues</span>
              <span className="text-xs text-ink-2">Needs action</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                [queues.pendingVerifications ?? s.queues.pendingVerifications, "Pending verifications", "/admin/verification", "var(--primary)", "#fff"],
                [queues.pendingReports ?? s.queues.pendingReports, "Open reports", "/admin/reports", "var(--ink)", "#fff"],
                [queues.flaggedListings ?? s.queues.flaggedListings, "Flagged listings", "/admin/listings", "var(--mist)", "var(--primary)"],
              ].map(([n, label, to, bg, fg]) => (
                <Link key={label} to={to} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3.5 text-center hover:opacity-90" style={{ background: bg, color: fg }}>
                  <span className="serif text-[30px] leading-none">{n}</span>
                  <span className="text-[11px] font-semibold leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card flex flex-1 flex-col gap-3 rounded-[18px] p-5">
            <div className="flex items-center justify-between">
              <span className="serif text-[19px] font-bold">Recent verifications</span>
              <Link to="/admin/verification?status=all" className="text-[13px] font-semibold">See all</Link>
            </div>
            {(recentVer?.verifications || []).map((v) => (
              <Link key={v.userId} to={`/admin/verification?status=all&sel=${v.userId}`} className="flex items-center gap-3 rounded-xl border border-line-soft p-2.5 text-ink hover:border-lavender hover:text-ink">
                <Avatar name={v.name} size={38} square />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{v.name}</div>
                  <div className="truncate text-xs text-ink-2">{v.subjects.slice(0, 2).join(", ") || "No profile yet"}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-ink-2">{relativeTime(v.submittedAt)}</span>
                  <StatusBadge status={v.status} className="text-[11px]" />
                </div>
              </Link>
            ))}
            {recentVer?.verifications?.length === 0 && <span className="text-sm text-ink-2">No submissions yet.</span>}
          </div>
        </section>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="card flex flex-col gap-3.5 rounded-[18px] p-5">
          <div className="flex items-center justify-between">
            <span className="serif text-[19px] font-bold">Users</span>
            <Link to="/admin/users" className="text-[13px] font-semibold">View all →</Link>
          </div>
          <div className="grid grid-cols-3 text-center">
            {[[s.users.students, "Students"], [s.users.parents, "Parents"], [s.users.teachers, "Teachers"]].map(([n, l], i) => (
              <div key={l} className="flex flex-col gap-1 py-1.5" style={{ borderRight: i < 2 ? "1px solid var(--mist)" : "none" }}>
                <span className="serif text-[26px] leading-none">{formatNumber(n)}</span>
                <span className="text-xs text-ink-2">{l}</span>
              </div>
            ))}
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-md" aria-hidden="true">
            <div style={{ flex: s.users.students || 0.001, background: "var(--primary)" }} />
            <div style={{ flex: s.users.parents || 0.001, background: "var(--blue)" }} />
            <div style={{ flex: s.users.teachers || 0.001, background: "var(--lavender)" }} />
          </div>
          <span className="text-xs text-ink-2">{formatNumber(totalUsers)} accounts in total (child accounts excluded).</span>
        </section>

        <section className="card flex flex-col gap-3 rounded-[18px] p-5">
          <div className="flex items-center justify-between">
            <span className="serif text-[19px] font-bold">Listings</span>
            <Link to="/admin/listings" className="text-[13px] font-semibold">Moderate →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-mist p-3.5"><div className="serif text-[28px] leading-none">{formatNumber(s.listings.active)}</div><div className="mt-1.5 text-xs text-ink-2">Active listings</div></div>
            <div className="rounded-xl p-3.5" style={{ background: s.listings.flagged ? "var(--danger-soft)" : "var(--mist)" }}>
              <div className="serif text-[28px] leading-none" style={{ color: s.listings.flagged ? "var(--danger)" : "var(--ink)" }}>{formatNumber(s.listings.flagged)}</div>
              <div className="mt-1.5 text-xs text-ink-2">Flagged</div>
            </div>
          </div>
        </section>

        <section className="card flex flex-col gap-3 rounded-[18px] p-5">
          <div className="flex items-center justify-between">
            <span className="serif text-[19px] font-bold">Open reports</span>
            <Link to="/admin/reports" className="text-[13px] font-semibold">See all</Link>
          </div>
          {(openReports?.reports || []).map((r) => (
            <Link key={r._id} to="/admin/reports" className="flex items-center gap-3 rounded-xl border border-line-soft p-2.5 text-ink hover:border-lavender hover:text-ink">
              <span className="h-2 w-2 flex-none rounded-full bg-danger" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.reason}</div>
                <div className="text-xs capitalize text-ink-2">{r.targetType} · {relativeTime(r.createdAt)}</div>
              </div>
            </Link>
          ))}
          {openReports?.reports?.length === 0 && <span className="text-sm text-ink-2">No open reports. Nice.</span>}
        </section>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
