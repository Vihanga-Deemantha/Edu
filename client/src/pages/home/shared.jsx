import { Link } from "react-router-dom";
import { Avatar, RatingLine, VerifiedBadge } from "../../components/ui/index.jsx";
import { firstName, formatPrice, greeting, todayEyebrow } from "../../lib/format.js";

export const Greeting = ({ name, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-5">
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold tracking-[.1em] text-ink-2">{todayEyebrow()}</span>
      <h1 className="h-page">
        {greeting()}, <em className="text-primary">{firstName(name)}</em>
      </h1>
    </div>
    {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
  </div>
);

/** Small summary tile: eyebrow + serif headline + body + link. `dark` = the ink "next class" tile. */
export const SummaryCard = ({ eyebrow, title, children, dark, footer }) => (
  <div
    className={`flex flex-col gap-3 rounded-2xl p-6 ${dark ? "bg-ink text-white" : "card"}`}
  >
    <span className="text-xs font-bold tracking-[.12em]" style={{ color: dark ? "var(--lavender)" : "var(--primary)" }}>{eyebrow}</span>
    <span className="serif text-[26px] leading-tight">{title}</span>
    {children}
    {footer && <div className="mt-auto flex flex-wrap gap-2.5 pt-1.5">{footer}</div>}
  </div>
);

/** Recommendation card (Home designs): teacher + subject + the backend's match reason. */
export const RecommendationCard = ({ rec }) => {
  const l = rec.listing;
  const owner = l.owner || {};
  return (
    <Link to={`/listings/${l._id}`} className="card card-hover flex flex-col gap-3 p-5 text-ink hover:text-ink">
      <div className="flex items-center gap-3">
        <Avatar name={owner.name} src={owner.photoUrl} size={52} />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="serif truncate text-lg font-bold">{owner.name}</span>
          <VerifiedBadge tier={owner.verificationStatus} />
        </div>
      </div>
      <span className="text-[15px] font-semibold">{l.subject} · {l.grade}</span>
      {rec.reason && <span className="rounded-lg bg-mist px-2.5 py-2 text-[13px] leading-snug text-primary">{rec.reason}</span>}
      <RatingLine avgRating={owner.avgRating} reviewCount={owner.reviewCount} />
      <div className="mt-auto flex items-center justify-between border-t border-mist pt-3">
        <span className="serif text-[19px]">{formatPrice(l.price) || "Fee on request"}</span>
        <span className="text-sm font-semibold text-primary">View →</span>
      </div>
    </Link>
  );
};

/** Mon–Sun strip for the current week; days with a booking are ringed. */
export const WeekStrip = ({ bookings }) => {
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const isToday = d.toDateString() === today.toDateString();
        const has = bookings.some((b) => new Date(b.startTime).toDateString() === d.toDateString());
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-2">{"MTWTFSS"[i]}</span>
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] text-sm font-semibold"
              style={{
                background: isToday ? "var(--ink)" : has ? "var(--mist)" : "#fff",
                color: isToday ? "#fff" : "var(--ink)",
                borderColor: has ? "var(--blue)" : isToday ? "var(--ink)" : "var(--line)",
              }}
            >
              {d.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const Section = ({ title, sub, link, children }) => (
  <section className="flex flex-col gap-[18px]">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="h-block">{title}</h2>
        {sub && <span className="text-sm text-ink-2">{sub}</span>}
      </div>
      {link && <Link to={link.to} className="text-sm font-semibold">{link.label} →</Link>}
    </div>
    {children}
  </section>
);
