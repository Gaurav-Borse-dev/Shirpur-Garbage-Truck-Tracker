import { create } from "zustand";

export type Lang = "en" | "hi" | "mr";

interface I18nState {
  /** Resident-specific language preference. */
  residentLang: Lang;
  /** Driver-specific language preference. */
  driverLang: Lang;
  /** Set language for a specific role. Admin is always English. */
  setLang: (lang: Lang, role?: "resident" | "driver") => void;
  /** Get language for a specific role. Returns "en" for admin. */
  getLang: (role?: string | null) => Lang;

  // Legacy compat: single `lang` and `setLang` used by LanguageSwitcher on
  // /role page (before role is known). Writes to BOTH role stores so the
  // chosen language is picked up no matter which role is selected next.
  lang: Lang;
}

const LS_RESIDENT = "language_resident";
const LS_DRIVER = "language_driver";
// Legacy key written by old code – read once at boot for migration.
const LS_LEGACY = "language";

function readLang(key: string): Lang | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(key);
    if (v === "hi" || v === "mr" || v === "en") return v;
  } catch {}
  return null;
}

function getInitial(key: string): Lang {
  return readLang(key) ?? readLang(LS_LEGACY) ?? "en";
}

export const useI18n = create<I18nState>((set, get) => ({
  residentLang: getInitial(LS_RESIDENT),
  driverLang: getInitial(LS_DRIVER),

  // `lang` exposes a "generic" value used on /role page. It defaults to the
  // resident lang (arbitrary but consistent choice).
  get lang() {
    return get().residentLang;
  },

  setLang: (lang, role) => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        if (role === "driver") {
          localStorage.setItem(LS_DRIVER, lang);
        } else if (role === "resident") {
          localStorage.setItem(LS_RESIDENT, lang);
        } else {
          // No role specified (e.g. /role page) – write to both stores
          localStorage.setItem(LS_RESIDENT, lang);
          localStorage.setItem(LS_DRIVER, lang);
          localStorage.setItem(LS_LEGACY, lang);
        }
      } catch {}
    }

    if (role === "driver") {
      set({ driverLang: lang });
    } else if (role === "resident") {
      set({ residentLang: lang });
    } else {
      set({ residentLang: lang, driverLang: lang });
    }
  },

  getLang: (role) => {
    if (role === "driver") return get().driverLang;
    if (role === "resident") return get().residentLang;
    return "en"; // admin or unknown
  },
}));
