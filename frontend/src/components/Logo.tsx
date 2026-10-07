import { useT } from "@/lib/i18n";
import shirpurLogo from "@/assets/shirpur-nagarparishad-logo.png";

export function Logo({ size = 56 }: { size?: number }) {
  const tr = useT();

  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      {/* Shirpur Nagarparishad Logo */}
      <div
        className="
          grid 
          place-items-center 
          rounded-2xl 
          bg-white 
          border 
          border-emerald-200 
          shadow-[0_4px_12px_rgba(22,163,74,0.12)]
          shrink-0
          overflow-hidden
        "
        style={{
          width: size,
          height: size,
        }}
      >
        <img
          src={shirpurLogo}
          alt="Shirpur Varvade Nagarparishad"
          className="
            w-full
            h-full
            object-contain
            p-1
          "
        />
      </div>

      {/* Brand Text */}
      <div className="flex flex-col justify-center">
        {/* Highlight Name */}
        <div
          className="
            inline-flex
            items-center
            gap-2
            px-2
            py-1
            rounded-md
            bg-emerald-50
            border
            border-emerald-300
            shadow-sm
            w-fit
          "
        >
          <span
            className="
              text-[11px]
              font-extrabold
              tracking-wide
              text-emerald-700
              uppercase
              whitespace-nowrap
            "
          >
            Shirpur–Warwade
          </span>

          <span
            className="
              w-2
              h-2
              rounded-full
              bg-emerald-500
              animate-pulse
            "
          />
        </div>

        {/* Subtitle */}
        <span
          className="
            text-[10px]
            font-semibold
            tracking-wider
            text-gray-500
            uppercase
            mt-1
            whitespace-nowrap
          "
        >
          {tr("Shirpur Municipal Corp")}
        </span>
      </div>
    </div>
  );
}

export default Logo;
