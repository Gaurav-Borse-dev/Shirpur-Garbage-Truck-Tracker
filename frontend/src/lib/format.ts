import { useI18n, type Lang } from "@/store/i18n";

const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

const UNITS: Record<Lang, { m: string; km: string; min: string; mins: string }> = {
  en: { m: "m", km: "km", min: "min", mins: "min" },
  hi: { m: "मी", km: "किमी", min: "मिनट", mins: "मिनट" },
  mr: { m: "मी", km: "किमी", min: "मिनिट", mins: "मिनिटे" },
};

/** Localized number (grouping + digits per locale). */
export function formatNumber(n: number, lang: Lang, opts?: Intl.NumberFormatOptions) {
  try {
    return new Intl.NumberFormat(LOCALE[lang], opts).format(n);
  } catch {
    return String(n);
  }
}

/** Localized distance: metres under 1 km, else km with one decimal. */
export function formatDistance(meters: number, lang: Lang) {
  const u = UNITS[lang];
  if (meters < 1000) return `${formatNumber(Math.round(meters), lang)} ${u.m}`;
  return `${formatNumber(meters / 1000, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${u.km}`;
}

/** Localized ETA derived from distance @ ~20 km/h. */
export function formatEta(meters: number, lang: Lang) {
  const mins = Math.max(1, Math.round(meters / 333));
  const u = UNITS[lang];
  return `${formatNumber(mins, lang)} ${mins === 1 ? u.min : u.mins}`;
}

/** Localized duration in seconds (used for backend/OSRM travel times). */
export function formatDuration(seconds: number, lang: Lang) {
  const mins = Math.max(1, Math.round(seconds / 60));
  const u = UNITS[lang];
  return `${formatNumber(mins, lang)} ${mins === 1 ? u.min : u.mins}`;
}

/** Localized clock time. */
export function formatTime(d: Date | number, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return new Date(d).toISOString().slice(11, 16);
  }
}

/** Localized date. */
export function formatDate(d: Date | number | string, lang: Lang) {
  const date = typeof d === "string" ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return new Date(date).toDateString();
  }
}

/** Hook giving all formatters bound to the active language. */
export function useFormat() {
  const lang = useI18n((s) => s.lang);
  return {
    lang,
    number: (n: number, o?: Intl.NumberFormatOptions) => formatNumber(n, lang, o),
    distance: (m: number) => formatDistance(m, lang),
    eta: (m: number) => formatEta(m, lang),
    duration: (s: number) => formatDuration(s, lang),
    time: (d: Date | number) => formatTime(d, lang),
    date: (d: Date | number | string) => formatDate(d, lang),
  };
}
