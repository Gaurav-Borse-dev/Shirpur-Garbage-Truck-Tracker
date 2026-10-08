import { useI18n, type Lang } from "@/store/i18n";
import { useAuth } from "@/store/auth";
import { useLocation } from "@tanstack/react-router";
import * as common from "@/lib/i18n-dicts/common";
import * as resident from "@/lib/i18n-dicts/resident";
import * as driver from "@/lib/i18n-dicts/driver";

type Dict = Record<string, string>;

// English is canonical: keys ARE the English copy, so `en` needs no entries and
// any missing translation degrades to readable English instead of a raw key.
const en: Dict = {};
// Admin UI is English-only, so admin dicts are excluded.
const hi: Dict = { ...common.hi, ...resident.hi, ...driver.hi };
const mr: Dict = { ...common.mr, ...resident.mr, ...driver.mr };

const DICTS: Record<Lang, Dict> = { en, hi, mr };

function isCurrentAdminRoute(pathname?: string): boolean {
  if (pathname) {
    return pathname.startsWith("/admin") || pathname.startsWith("/login/admin");
  }
  if (typeof window !== "undefined") {
    return (
      window.location.pathname.startsWith("/admin") ||
      window.location.pathname.startsWith("/login/admin")
    );
  }
  return false;
}

export function translate(key: string, lang: Lang): string {
  if (lang === "en") return key;
  const role = useAuth.getState().session?.role;
  if (role === "admin" || isCurrentAdminRoute()) {
    return key;
  }
  return DICTS[lang][key] ?? key;
}

export function useT() {
  const lang = useI18n((s) => s.lang);
  const role = useAuth((s) => s.session?.role);
  let pathname = "";
  try {
    pathname = useLocation({ select: (l) => l.pathname });
  } catch {
    if (typeof window !== "undefined") {
      pathname = window.location.pathname;
    }
  }

  const isAdmin = role === "admin" || isCurrentAdminRoute(pathname);

  if (isAdmin) {
    return (key: string) => key;
  }

  return (key: string) => translate(key, lang);
}

export function useLang(): Lang {
  const lang = useI18n((s) => s.lang);
  const role = useAuth((s) => s.session?.role);
  let pathname = "";
  try {
    pathname = useLocation({ select: (l) => l.pathname });
  } catch {
    if (typeof window !== "undefined") {
      pathname = window.location.pathname;
    }
  }

  const isAdmin = role === "admin" || isCurrentAdminRoute(pathname);
  if (isAdmin) {
    return "en";
  }

  return lang;
}
