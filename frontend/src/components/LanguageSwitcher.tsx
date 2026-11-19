import { useEffect, useRef, useState } from "react";
import { useI18n, LANGS } from "@/store/i18n";
import { useT } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const lang = useI18n((s) => s.residentLang);
  const setLang = useI18n((s) => s.setLang);
  const t = useT();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Restore the saved language after mount so SSR markup and the first client
  // render always match (localStorage is unavailable on the server).

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={`fixed top-3 right-3 z-[1000] pointer-events-auto ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("Language")}
        className="bg-white/95 backdrop-blur border border-neutral-200 shadow-md rounded-full h-9 pl-2.5 pr-3 flex items-center gap-2 text-xs font-semibold text-ink hover:bg-white transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-neutral-900 text-white grid place-items-center text-[10px] font-bold">
          {current.flag}
        </span>
        <span>{current.native}</span>
        <svg
          viewBox="0 0 20 20"
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path
            d="M5.5 7.5l4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="mt-2 w-40 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden animate-fade-in">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
            {t("Language")}
          </div>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                lang === l.code ? "text-brand font-semibold" : "text-ink"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-neutral-100 grid place-items-center text-[10px] font-bold">
                {l.flag}
              </span>
              <span className="flex-1 text-left">{l.native}</span>
              {lang === l.code && (
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-brand"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
