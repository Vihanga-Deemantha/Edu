import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "../ui/index.jsx";

/**
 * Split card from "EduLink Auth v2": the form on the left, a lavender aside
 * on the right whose headline changes per step. No site header on auth pages.
 */
const AuthLayout = ({ aside, children, banner }) => (
  <div
    className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6"
    style={{ background: "linear-gradient(160deg, #EDE8F5 0%, #F7F5FB 45%, #E2E7F6 100%)" }}
  >
    <div
      className="flex w-full max-w-[1120px] flex-wrap overflow-hidden rounded-[28px] bg-white"
      style={{ minHeight: 640, boxShadow: "0 40px 80px -40px rgba(22,27,63,.35), 0 2px 6px rgba(22,27,63,.04)" }}
    >
      <main className="relative z-[3] flex flex-col justify-center py-14" style={{ flex: "1 1 420px", paddingInline: "clamp(28px,6vw,88px)" }}>
        <div className="flex w-full max-w-[380px] flex-col gap-[26px]">
          <Link to="/" className="self-start text-[22px] font-bold tracking-[-.01em] text-blue serif">
            Edu<span className="text-primary">Link</span>
          </Link>
          {banner && (
            <div className="rise flex items-center gap-3 rounded-[10px] border bg-mist px-4 py-3.5 text-sm font-medium" style={{ borderColor: "var(--lavender)" }}>
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-primary text-xs text-white">✓</span>
              {banner}
            </div>
          )}
          {children}
        </div>
      </main>
      <aside className="relative hidden flex-col justify-between gap-6 bg-lavender px-11 py-12 md:flex" style={{ flex: "1 1 380px", minHeight: 420 }}>
        <div className="relative z-[2] flex max-w-[380px] flex-col gap-2.5">
          <h1 style={{ font: "400 clamp(30px,3vw,40px)/1.1 var(--font-display)", letterSpacing: "-.015em", textWrap: "balance" }}>{aside.title}</h1>
          <p className="serif text-[17px] leading-normal" style={{ color: "#2A3163", textWrap: "pretty" }}>{aside.sub}</p>
        </div>
        <AsideIllustration />
        <div className="pointer-events-none relative z-[2] flex flex-col gap-1.5 self-end rounded-[14px] bg-white px-[18px] py-3.5" style={{ boxShadow: "0 16px 30px -16px rgba(22,27,63,.35)" }}>
          {["Verified teachers", "Safe in-app chat", "Parent-managed child accounts"].map((t) => (
            <span key={t} className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="text-primary">✓</span>
              {t}
            </span>
          ))}
        </div>
      </aside>
    </div>
  </div>
);

// Stands in for the design's illustration slot: stacked "notice cards" in
// the brand palette, drawn in CSS so nothing needs to be fetched.
const AsideIllustration = () => (
  <div className="absolute z-[1]" style={{ left: "8%", right: "10%", top: "38%", bottom: "22%" }} aria-hidden="true">
    <div className="absolute rounded-2xl bg-white/60" style={{ inset: "10% 0 0 18%", transform: "rotate(4deg)" }} />
    <div className="absolute flex flex-col gap-3 rounded-2xl bg-white p-5" style={{ inset: "0 14% 12% 0", boxShadow: "0 20px 40px -20px rgba(22,27,63,.35)" }}>
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-full bg-mist" />
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="h-2.5 w-3/5 rounded bg-ink/80" />
          <span className="h-2 w-2/5 rounded bg-primary/60" />
        </div>
      </div>
      <span className="h-2 w-full rounded bg-mist" />
      <span className="h-2 w-4/5 rounded bg-mist" />
      <div className="mt-auto flex gap-2">
        <span className="h-6 w-16 rounded-full bg-mist" />
        <span className="h-6 w-20 rounded-full bg-primary" />
      </div>
    </div>
  </div>
);

export const AuthHeading = ({ eyebrow, title, sub }) => (
  <div className="flex flex-col gap-2">
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2 className="serif text-4xl font-bold leading-tight">{title}</h2>
    {sub && <span className="text-[15px] leading-normal text-ink-2">{sub}</span>}
  </div>
);

export const SubmitButton = ({ loading, children, loadingText }) => (
  <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
    {loading && <Spinner dark={false} />}
    {loading ? loadingText : children}
  </button>
);

export const Divider = ({ children }) => (
  <div className="flex items-center gap-3 text-[13px] text-ink-2">
    <div className="h-px flex-1 bg-line" />
    {children}
    <div className="h-px flex-1 bg-line" />
  </div>
);

/** Password input with the design's inline Show/Hide toggle. */
export const PasswordInput = forwardRef(({ error, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? "text" : "password"} className={`input pr-[60px] ${error ? "err" : ""}`} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3.5 top-[13px] border-0 bg-transparent p-0 text-[13px] font-semibold text-primary"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

const pwScore = (p) =>
  !p ? 0 : Math.min(4, (p.length >= 8) + (p.length >= 12) + (/[A-Z]/.test(p) && /[a-z]/.test(p)) + /\d|[^\w]/.test(p));

export const StrengthMeter = ({ password }) => {
  const score = pwScore(password || "");
  const color = score <= 1 ? "var(--danger)" : score === 2 ? "var(--periwinkle)" : "var(--primary)";
  return (
    <div className="flex items-center gap-1.5" aria-live="polite">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-1 flex-1 rounded-sm" style={{ background: i <= score ? color : "var(--line)" }} />
      ))}
      <span className="min-w-[56px] text-right text-xs font-semibold text-ink-2">{["", "Weak", "Fair", "Good", "Strong"][score]}</span>
    </div>
  );
};

/** Sri Lankan mobile field with the "LK" addon. */
export const PhoneInput = forwardRef(({ error, ...props }, ref) => (
  <div className={`input-group ${error ? "err" : ""}`}>
    <span className="addon">LK</span>
    <input ref={ref} type="tel" placeholder="077 123 4567" {...props} />
  </div>
));
PhoneInput.displayName = "PhoneInput";

export default AuthLayout;
