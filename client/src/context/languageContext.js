import { createContext, useContext } from "react";

export const LanguageContext = createContext(null);

export const LANGUAGES = [
  { code: "en", short: "EN", label: "English" },
  { code: "si", short: "සි", label: "සිංහල" },
  { code: "ta", short: "த", label: "தமிழ்" },
];

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return context;
};
