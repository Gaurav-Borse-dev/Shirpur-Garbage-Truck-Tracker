import { create } from "zustand";

export type Lang = "en" | "hi" | "mr";

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const getSavedLanguage = (): Lang => {
  // SSR safety check
  if (typeof window === "undefined") {
    return "en";
  }

  const saved = localStorage.getItem("language");

  if (saved === "hi" || saved === "mr" || saved === "en") {
    return saved;
  }

  return "en";
};

export const useI18n = create<I18nState>((set) => ({
  lang: getSavedLanguage(),

  setLang: (lang) => {
    // save only in browser
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }

    set({
      lang,
    });
  },
}));
