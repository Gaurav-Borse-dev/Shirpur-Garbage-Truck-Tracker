import { create } from "zustand";

export type Lang = "en" | "hi" | "mr";

type State = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const KEY = "ct.lang";

function initial(): Lang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(KEY) as Lang | null;
  return v === "hi" || v === "mr" || v === "en" ? v : "en";
}

export const useI18n = create<State>((set) => ({
  lang: initial(),
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(KEY, lang);
        document.documentElement.setAttribute("lang", lang);
      } catch {}
    }
    set({ lang });
  },
}));