import { Link } from "react-router-dom";

/** The "e" mark + EduLink wordmark. `onDark` swaps to the footer colourway. */
const Brand = ({ to = "/", onDark = false, mark = true, size = 25, suffix }) => (
  <Link to={to} className="flex flex-none items-center gap-2.5" style={{ color: onDark ? "#fff" : "var(--ink)" }}>
    {mark && (
      <span
        className="flex items-center justify-center rounded-lg bg-primary text-white"
        style={{ width: 34, height: 34, font: "italic 700 20px var(--font-display)" }}
      >
        e
      </span>
    )}
    <span className="flex flex-col leading-none">
      <span style={{ font: `700 ${size}px var(--font-display)`, letterSpacing: "-.01em" }}>
        Edu<span style={{ color: onDark ? "var(--blue)" : "var(--primary)" }}>Link</span>
      </span>
      {suffix && (
        <span className="mt-1 text-[10px] font-bold tracking-[.16em] text-ink-2">{suffix}</span>
      )}
    </span>
  </Link>
);

export default Brand;
