import { create } from "zustand";

export type Lang = "en" | "hi" | "mr";

type State = {
  lang: Lang;
  hydrated: boolean;
  setLang: (l: Lang) => void;
  hydrate: () => void;
};

const KEY = "ct.lang";

function read(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(KEY) as Lang | null;
    return v === "hi" || v === "mr" || v === "en" ? v : "en";
  } catch {
    return "en";
  }
}

export const useI18n = create<State>((set, get) => ({
  // Always "en" on first render so SSR markup matches the client, then hydrate().
  lang: "en",
  hydrated: false,
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(KEY, lang);
        document.documentElement.setAttribute("lang", lang);
      } catch {}
    }
    set({ lang, hydrated: true });
  },
  hydrate: () => {
    if (get().hydrated) return;
    const lang = read();
    if (typeof document !== "undefined") document.documentElement.setAttribute("lang", lang);
    set({ lang, hydrated: true });
  },
}));
