import { Link } from "react-router-dom";
import { useState } from "react";

/**
 * The logo mark + EduLink wordmark. `onDark` swaps to the footer colourway.
 * Uses the optimized mark (client/public/design/logo-mark.webp)
 * into client/public/design/) with a CSS "e" square as the fallback.
 */
const Brand = ({ to = "/", onDark = false, mark = true, size = 25, suffix }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
  <Link to={to} className="flex flex-none items-center gap-2.5" style={{ color: onDark ? "#fff" : "var(--ink)" }}>
    {mark && !logoFailed && (
      <img src="/design/logo-mark.webp" alt="" width="43" height="32" decoding="async" onError={() => setLogoFailed(true)} className="h-7 w-auto flex-none sm:h-8" />
    )}
    {mark && logoFailed && (
      <span
        className="flex items-center justify-center rounded-lg bg-primary text-white"
        style={{ width: 34, height: 34, font: "italic 700 20px var(--font-display)" }}
      >
        e
      </span>
    )}
    <span className="flex flex-col leading-none">
      <span style={{ font: `700 clamp(21px, 5.8vw, ${size}px) var(--font-display)`, letterSpacing: "-.01em" }}>
        Edu<span style={{ color: onDark ? "var(--blue)" : "var(--primary)" }}>Link</span>
      </span>
      {suffix && (
        <span className="mt-1 text-[10px] font-bold tracking-[.16em] text-ink-2">{suffix}</span>
      )}
    </span>
  </Link>
  );
};

export default Brand;
