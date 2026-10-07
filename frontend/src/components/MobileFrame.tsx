import { type ReactNode } from "react";

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-neutral-100 flex justify-center">
      <div
        className="
          w-full 
          max-w-[420px] 
          h-dvh 
          bg-white 
          relative 
          shadow-[0_0_60px_rgba(0,0,0,0.08)]
          border-4
          border-black
          rounded-none
          overflow-hidden 
          flex 
          flex-col
        "
      >
        {children}
      </div>
    </div>
  );
}
