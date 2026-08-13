import { useT } from "@/lib/i18n";

/**
 * Modern CleanTrack Shirpur Branding Icon:
 * Leaf (Green Environment) + Recycle Loop + Smart Garbage Truck + IoT Signal
 */
function CleanTrackLogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Outer Eco Ring */}
      <circle cx="20" cy="20" r="18" fill="url(#ctGradient)" stroke="#16A34A" strokeWidth="1.5" strokeOpacity="0.25" />

      {/* Eco Leaf Curve */}
      <path
        d="M24.5 9.5C18 9.5 13 14 13 20.5C13 24 15 27 18 29C16.8 25 18 20 22 17C25 14.8 28.5 13.8 30 13.5C29.5 11.2 27.2 9.5 24.5 9.5Z"
        fill="#22C55E"
      />

      {/* Recycle Motion Arrow Arc */}
      <path
        d="M12 24.5C12.8 28.8 16 32 20.5 32C25.5 32 29.5 28 29.8 23"
        stroke="#15803D"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="28 28"
      />
      <path d="M31.5 24.5L29.5 21.5L27.5 24.5" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Smart Truck Body */}
      <path
        d="M14.5 25H22V20H18.5L16.5 22H14.5V25Z"
        fill="#15803D"
      />
      <rect x="22" y="20.5" width="4.5" height="4.5" rx="1" fill="#0EA5E9" />
      <circle cx="17" cy="26" r="1.5" fill="#0F172A" />
      <circle cx="23.5" cy="26" r="1.5" fill="#0F172A" />

      {/* Smart Tech Signal Beacon */}
      <circle cx="29" cy="11.5" r="2.5" fill="#0EA5E9" />
      <circle cx="29" cy="11.5" r="1" fill="#FFFFFF" />

      <defs>
        <linearGradient id="ctGradient" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0FDF4" />
          <stop offset="1" stopColor="#DCFCE7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 56 }: { size?: number }) {
  const tr = useT();
  const iconSize = Math.round(size * 0.55);

  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      <div
        className="grid place-items-center rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100/80 border border-emerald-200/80 shadow-[0_4px_12px_rgba(22,163,74,0.12)] shrink-0"
        style={{ width: size, height: size }}
      >
        <CleanTrackLogoIcon size={iconSize} />
      </div>
      <div className="flex flex-col justify-center">
        <div className="font-extrabold text-xl tracking-tight text-neutral-900 leading-none flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-emerald-700">Clean</span>
          <span className="text-neutral-900">Track</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
        </div>
        <span className="text-[10px] font-semibold tracking-wider text-emerald-800/80 uppercase mt-0.5 whitespace-nowrap">
          {tr("Shirpur Municipal Corp")}
        </span>
      </div>
    </div>
  );
}

export default Logo;