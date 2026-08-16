import { create } from "zustand";

type Language = "en" | "hi" | "mr";

interface LanguageStore {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
    language:
        (localStorage.getItem("language") as Language) || "en",

    setLanguage: (lang) => {
        localStorage.setItem("language", lang);

        set({
            language: lang,
        });
    },
}));