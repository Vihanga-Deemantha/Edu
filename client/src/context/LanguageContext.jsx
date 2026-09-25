import { useCallback, useMemo, useState } from "react";
import { LANGUAGES, LanguageContext } from "./languageContext.js";

const STORAGE_KEY = "edulink.lang";

const readStored = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : "en";
  } catch {
    return "en";
  }
};

/**
 * Per-viewer language preference (spec §3.3) — a UI preference, so local
 * storage is the right home, not the account. Content fields with a
 * translation (description_si/_ta, bio_si/_ta) read it via `localized`.
 */
export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(readStored);

  const setLang = useCallback((code) => {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // storage unavailable (private mode) — the in-memory choice still applies
    }
  }, []);

  const value = useMemo(() => {
    /** Picks `${field}_${lang}` when present, else the base field; `fallback` flags the miss. */
    const localized = (obj, field) => {
      if (!obj) return { text: "", fallback: false };
      if (lang === "en") return { text: obj[field] || "", fallback: false };
      const translated = obj[`${field}_${lang}`];
      return translated ? { text: translated, fallback: false } : { text: obj[field] || "", fallback: true };
    };
    return { lang, setLang, localized, current: LANGUAGES.find((l) => l.code === lang) };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
