import { useI18n, type Lang } from "@/store/i18n";
import * as common from "@/lib/i18n-dicts/common";
import * as resident from "@/lib/i18n-dicts/resident";
import * as driver from "@/lib/i18n-dicts/driver";
import * as admin from "@/lib/i18n-dicts/admin";

type Dict = Record<string, string>;

// English is canonical: keys ARE the English copy, so `en` needs no entries and
// any missing translation degrades to readable English instead of a raw key.
const en: Dict = {};
const hi: Dict = { ...common.hi, ...resident.hi, ...driver.hi, ...admin.hi };
const mr: Dict = { ...common.mr, ...resident.mr, ...driver.mr, ...admin.mr };

const DICTS: Record<Lang, Dict> = { en, hi, mr };

export function translate(key: string, lang: Lang): string {
  if (lang === "en") return key;
  return DICTS[lang][key] ?? key;
}

export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: string) => translate(key, lang);
}

export function useLang() {
  return useI18n((s) => s.lang);
}
