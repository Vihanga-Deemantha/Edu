import { LANGUAGES, useLanguage } from "../../context/languageContext.js";

/** Three-way segmented toggle — landing header (light) and footers (onDark). */
export const LanguageToggle = ({ onDark = false }) => {
  const { lang, setLang } = useLanguage();
  return (
    <div
      className="flex flex-none rounded-full p-[3px] text-[13px] font-semibold"
      style={{ background: onDark ? "rgba(255,255,255,.08)" : "var(--mist)" }}
      role="radiogroup"
      aria-label="Language"
    >
      {LANGUAGES.map((l) => {
        const on = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={l.label}
            onClick={() => setLang(l.code)}
            className="rounded-full border-0 px-[11px] py-[5px]"
            style={{
              background: on ? "#fff" : "transparent",
              color: on ? (onDark ? "var(--ink)" : "var(--primary)") : onDark ? "var(--lavender)" : "var(--ink-2)",
              boxShadow: on && !onDark ? "0 1px 3px rgba(22,27,63,.15)" : "none",
            }}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
};

/** Compact pill for the signed-in header: cycles EN → සි → த. */
export const LanguagePill = () => {
  const { lang, setLang, current } = useLanguage();
  const next = () => {
    const i = LANGUAGES.findIndex((l) => l.code === lang);
    setLang(LANGUAGES[(i + 1) % LANGUAGES.length].code);
  };
  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Language: ${current.label}. Change language`}
      className="flex-none rounded-full border bg-transparent px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-primary"
      style={{ borderColor: "var(--lavender)" }}
    >
      {current.short} ▾
    </button>
  );
};
