import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { initials } from "../../lib/format.js";

// ─── Avatar ──────────────────────────────────────────────────────────────────
export const Avatar = ({ name, src, size = 40, solid = false, square = false, className = "" }) => (
  <span
    className={`avatar ${solid ? "avatar-solid" : ""} ${className}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.38), borderRadius: square ? 10 : "50%" }}
    aria-hidden="true"
  >
    {src ? <img src={src} alt="" /> : initials(name)}
  </span>
);

// ─── Verified badge (compact on cards, expanded on the profile page) ─────────
const TIER_LABEL = { fully_verified: "Fully verified", id_verified: "ID verified" };

export const VerifiedBadge = ({ tier, expanded = false }) => {
  if (!TIER_LABEL[tier]) return null;
  const full = tier === "fully_verified";
  if (!expanded) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            width: 14, height: 14, fontSize: 9,
            background: full ? "var(--primary)" : "#fff",
            color: full ? "#fff" : "var(--primary)",
            border: full ? 0 : "1.5px solid var(--primary)",
          }}
        >
          ✓
        </span>
        {TIER_LABEL[tier]}
      </span>
    );
  }
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4"
      style={{ background: full ? "var(--ink)" : "var(--mist)", color: full ? "#fff" : "var(--ink)" }}
    >
      <span
        className="flex flex-none items-center justify-center rounded-full font-bold"
        style={{ width: 32, height: 32, background: "var(--primary)", color: "#fff" }}
      >
        ✓
      </span>
      <div className="flex flex-col gap-1">
        <span className="serif text-lg">{TIER_LABEL[tier]}</span>
        <span className="text-[13px] leading-normal" style={{ color: full ? "var(--on-dark)" : "var(--ink-2)" }}>
          {full
            ? "Identity and police clearance checked by EduLink. Can teach child accounts."
            : "Identity document checked by EduLink. Can teach adult students."}
        </span>
      </div>
    </div>
  );
};

// ─── Status badge — one vocabulary for every status enum in the app ─────────
const STATUS = {
  pending: ["Pending", "status-soft"],
  pending_review: ["Under review", "status-soft"],
  accepted: ["Accepted", "status-solid"],
  confirmed: ["Confirmed", "status-solid"],
  active: ["Active", "status-solid"],
  approved: ["Approved", "status-solid"],
  paid: ["Paid", "status-solid"],
  completed: ["Completed", "status-outline"],
  resolved: ["Resolved", "status-outline"],
  declined: ["Declined", "status-muted"],
  cancelled: ["Cancelled", "status-muted"],
  closed: ["Closed", "status-muted"],
  dismissed: ["Dismissed", "status-muted"],
  not_submitted: ["Not submitted", "status-muted"],
  expired: ["Expired", "status-muted"],
  flagged: ["Flagged", "status-danger"],
  rejected: ["Rejected", "status-danger"],
  failed: ["Failed", "status-danger"],
  suspended: ["Suspended", "status-danger"],
  unpaid: ["Deposit unpaid", "status-soft"],
};

export const StatusBadge = ({ status, label, className = "" }) => {
  const [text, cls] = STATUS[status] || [status, "status-muted"];
  return <span className={`status ${cls} ${className}`}>{label || text}</span>;
};

// ─── Stars ───────────────────────────────────────────────────────────────────
export const Stars = ({ value = 0, size = 14 }) => (
  <span className="relative inline-block leading-none" style={{ fontSize: size, letterSpacing: 1 }} aria-label={`${value} out of 5`}>
    <span style={{ color: "var(--lavender)" }}>★★★★★</span>
    <span
      className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
      style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%`, color: "var(--primary)" }}
    >
      ★★★★★
    </span>
  </span>
);

export const RatingLine = ({ avgRating, reviewCount, extra }) => (
  <span className="flex items-center gap-1.5 text-sm text-ink-2">
    {reviewCount > 0 ? (
      <>
        <span className="text-primary">★</span>
        <b className="text-ink">{Number(avgRating).toFixed(1)}</b>({reviewCount})
      </>
    ) : (
      <span>No reviews yet</span>
    )}
    {extra && <span>· {extra}</span>}
  </span>
);

export const StarInput = ({ value, onChange, size = 30 }) => (
  <div className="flex gap-1" role="radiogroup" aria-label="Rating">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        role="radio"
        aria-checked={value === n}
        aria-label={`${n} star${n > 1 ? "s" : ""}`}
        onClick={() => onChange(n)}
        className="border-0 bg-transparent p-0 leading-none"
        style={{ fontSize: size, color: n <= value ? "var(--primary)" : "var(--lavender)" }}
      >
        ★
      </button>
    ))}
  </div>
);

// ─── Empty / loading / error states ──────────────────────────────────────────
export const EmptyState = ({ icon = "info", title, children, action }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <span className="flex items-center justify-center rounded-full bg-mist text-primary" style={{ width: 56, height: 56 }}>
      <Icon name={icon} size={24} />
    </span>
    <span className="serif text-[22px]">{title}</span>
    {children && <p className="max-w-md text-sm leading-relaxed text-ink-2">{children}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const Spinner = ({ dark = true, size = 16 }) => (
  <span className={`spinner ${dark ? "spinner-dark" : ""}`} style={{ width: size, height: size }} />
);

export const PageLoader = ({ label = "Loading…" }) => (
  <div className="flex flex-1 items-center justify-center gap-3 py-24 text-sm text-ink-2" role="status">
    <Spinner size={20} /> {label}
  </div>
);

export const ErrorState = ({ title = "Something went wrong", children, action }) => (
  <div className="card mx-auto my-16 flex max-w-lg flex-col items-center gap-3 p-10 text-center">
    <span className="flex items-center justify-center rounded-full bg-mist text-primary" style={{ width: 56, height: 56 }}>
      <Icon name="alert" size={24} />
    </span>
    <h1 className="serif text-3xl">{title}</h1>
    {children && <p className="text-[15px] leading-relaxed text-ink-2">{children}</p>}
    {action || (
      <Link to="/" className="btn btn-primary mt-2">
        Back to EduLink
      </Link>
    )}
  </div>
);

export const Skeleton = ({ className = "", style }) => <div className={`skeleton ${className}`} style={style} />;

// ─── Form field ──────────────────────────────────────────────────────────────
export const Field = ({ label, error, hint, children, aside, className = "" }) => (
  <label className={`field ${className}`}>
    {(label || aside) && (
      <span className="flex items-center justify-between gap-3">
        {label && <span className="field-label">{label}</span>}
        {aside}
      </span>
    )}
    {children}
    {error ? <span className="field-err">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const Button = ({ loading, children, variant = "primary", className = "", disabled, ...props }) => (
  <button type="button" className={`btn btn-${variant} ${className}`} disabled={disabled || loading} {...props}>
    {loading && <Spinner dark={variant !== "primary"} />}
    {children}
  </button>
);

// ─── Segmented control ───────────────────────────────────────────────────────
export const Segmented = ({ options, value, onChange, className = "" }) => (
  <div className={`seg ${className}`} role="tablist">
    {options.map((o) => {
      const opt = typeof o === "string" ? { value: o, label: o } : o;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`seg-item ${value === opt.value ? "on" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="ml-1.5 opacity-70">{opt.count}</span>}
        </button>
      );
    })}
  </div>
);

// ─── Chip multi-select ───────────────────────────────────────────────────────
export const ChipSelect = ({ options, value = [], onChange, single = false }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const opt = typeof o === "string" ? { value: o, label: o } : o;
      const on = single ? value === opt.value : value.includes(opt.value);
      return (
        <button
          key={opt.value}
          type="button"
          aria-pressed={on}
          className={`chip ${on ? "on" : ""}`}
          onClick={() =>
            single ? onChange(on ? "" : opt.value) : onChange(on ? value.filter((v) => v !== opt.value) : [...value, opt.value])
          }
        >
          {on && !single && <Icon name="check" size={13} strokeWidth={2.4} />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ─── Tag input (free text, Enter/comma to add) ───────────────────────────────
export const TagInput = ({ value = [], onChange, placeholder, suggestions = [] }) => {
  const listId = useId();
  const add = (raw) => {
    const v = raw.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
  };
  return (
    <div className="input-group flex-wrap items-center gap-1.5 p-1.5" style={{ minHeight: 46 }}>
      {value.map((v) => (
        <span key={v} className="tag gap-1.5" style={{ fontSize: 13 }}>
          {v}
          <button type="button" className="border-0 bg-transparent p-0 text-primary" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
            <Icon name="x" size={12} strokeWidth={2.4} />
          </button>
        </span>
      ))}
      <input
        list={suggestions.length ? listId : undefined}
        placeholder={value.length ? "" : placeholder}
        style={{ height: 32, minWidth: 140 }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(e.currentTarget.value);
            e.currentTarget.value = "";
          } else if (e.key === "Backspace" && !e.currentTarget.value && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={(e) => {
          add(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
};

// ─── Modal ───────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, width = 520, labelledBy }) => {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
        className="modal rise outline-none"
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-mist px-6 py-5">
            <h2 id={titleId} className="serif text-2xl">
              {title}
            </h2>
            <button type="button" className="btn btn-ghost p-2" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

// ─── Pagination ──────────────────────────────────────────────────────────────
export const Pagination = ({ page, limit, total, onChange }) => {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 20)));
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1
  );
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button type="button" className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Icon name="chevronLeft" size={16} /> Prev
      </button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-2">…</span>}
          <button
            type="button"
            aria-current={n === page ? "page" : undefined}
            className={`btn btn-sm ${n === page ? "btn-primary" : "btn-soft"}`}
            style={{ minWidth: 40 }}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        </span>
      ))}
      <button type="button" className="btn btn-soft btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
};

// ─── Section heading ─────────────────────────────────────────────────────────
export const SectionHead = ({ title, sub, link, action }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3">
    <div className="flex flex-col gap-1">
      <h2 className="h-block">{title}</h2>
      {sub && <span className="text-sm text-ink-2">{sub}</span>}
    </div>
    {link && (
      <Link to={link.to} className="link">
        {link.label} →
      </Link>
    )}
    {action}
  </div>
);

// ─── Page header (eyebrow + serif title + actions) ───────────────────────────
export const PageHeader = ({ eyebrow, title, sub, actions, back }) => (
  <div className="flex flex-wrap items-end justify-between gap-5">
    <div className="flex flex-col gap-2">
      {back && (
        <Link to={back.to} className="link flex items-center gap-1.5 self-start">
          <Icon name="arrowLeft" size={16} /> {back.label}
        </Link>
      )}
      {eyebrow && <span className="text-[13px] font-semibold tracking-[.1em] text-ink-2">{eyebrow}</span>}
      <h1 className="h-page">{title}</h1>
      {sub && <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
  </div>
);
