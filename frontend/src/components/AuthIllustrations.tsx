import React from "react";

/**
 * High-fidelity vector illustration of the Shirpur Green Garbage Truck
 * with city skyline, trees, and clean road as shown in the design specification.
 */
export function GarbageTruckIllustration({
  className = "w-full max-w-[280px] h-auto",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Sky & City Skyline */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0FDF4" stopOpacity="0.8" />
          <stop stopColor="#DCFCE7" stopOpacity="0.3" />
          <stop stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="truckBodyGrad"
          x1="50"
          y1="50"
          x2="230"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#22C55E" />
          <stop stopColor="#16A34A" />
        </linearGradient>
        <linearGradient
          id="cabGrad"
          x1="180"
          y1="70"
          x2="260"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4ADE80" />
          <stop stopColor="#22C55E" />
        </linearGradient>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#166534" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Sky background aura */}
      <ellipse cx="160" cy="110" rx="140" ry="60" fill="url(#skyGrad)" />

      {/* Distant City Buildings Silhouette */}
      <g opacity="0.35" fill="#86EFAC">
        <rect x="75" y="70" width="18" height="60" rx="2" />
        <rect x="98" y="55" width="22" height="75" rx="2" />
        <rect x="125" y="65" width="16" height="65" rx="2" />
        <rect x="195" y="58" width="20" height="72" rx="2" />
        <rect x="220" y="72" width="18" height="58" rx="2" />
        <rect x="242" y="62" width="24" height="68" rx="2" />
        {/* Windows */}
        <circle cx="106" cy="65" r="2" fill="#BBF7D0" />
        <circle cx="114" cy="65" r="2" fill="#BBF7D0" />
        <circle cx="106" cy="75" r="2" fill="#BBF7D0" />
        <circle cx="114" cy="75" r="2" fill="#BBF7D0" />
        <circle cx="202" cy="68" r="2" fill="#BBF7D0" />
        <circle cx="210" cy="68" r="2" fill="#BBF7D0" />
      </g>

      {/* Background Trees */}
      <g opacity="0.85">
        <circle cx="50" cy="115" r="16" fill="#86EFAC" />
        <circle cx="65" cy="118" r="12" fill="#4ADE80" />
        <rect x="48" y="125" width="4" height="18" fill="#15803D" rx="2" />
        <rect x="63" y="126" width="3" height="17" fill="#15803D" rx="1.5" />

        <circle cx="270" cy="116" r="15" fill="#86EFAC" />
        <circle cx="285" cy="118" r="11" fill="#4ADE80" />
        <rect x="268" y="125" width="4" height="18" fill="#15803D" rx="2" />
        <rect x="283" y="126" width="3" height="17" fill="#15803D" rx="1.5" />
      </g>

      {/* Road / Ground base */}
      <ellipse cx="160" cy="154" rx="145" ry="14" fill="#E2E8F0" />
      <ellipse cx="160" cy="153" rx="130" ry="9" fill="#F1F5F9" />
      <path d="M50 152 Q 160 158 270 152" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="8 6" />

      {/* Garbage Truck Container */}
      <g filter="url(#softShadow)">
        {/* Main Tipper Box (Left side container) */}
        <path
          d="M 52 72 
             C 52 67, 56 63, 61 63 
             L 175 63 
             C 180 63, 184 67, 184 72 
             L 184 132 
             C 184 134, 182 136, 180 136 
             L 56 136 
             C 54 136, 52 134, 52 132 
             Z"
          fill="url(#truckBodyGrad)"
        />

        {/* Diagonal accents on container top */}
        <path d="M 54 75 L 182 75" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />

        {/* White Recycling Symbol in Center of Truck Container */}
        <g transform="translate(118, 98) scale(1.15)">
          <path d="M 0 -14 L 3 -8 L -3 -8 Z" fill="#FFFFFF" />
          <path d="M -1 -8 C 5 -8, 10 -4, 12 1 L 9 2 C 8 -2, 4 -5, -1 -5 Z" fill="#FFFFFF" />
          <path d="M 14 3 L 14 10 L 8 7 Z" fill="#FFFFFF" />
          <path d="M 10 5 C 12 9, 10 14, 6 17 L 4 14 C 7 12, 8 8, 7 5 Z" fill="#FFFFFF" />
          <path d="M -11 8 L -14 2 L -8 3 Z" fill="#FFFFFF" />
          <path d="M -8 5 C -12 2, -13 -3, -11 -7 L -9 -5 C -10 -2, -9 2, -6 4 Z" fill="#FFFFFF" />
        </g>

        {/* Connecting Chassis Part */}
        <rect x="180" y="92" width="14" height="42" fill="#0F172A" rx="2" />

        {/* Truck Front Cabin */}
        <path
          d="M 188 84 
             C 188 80, 191 76, 195 76 
             L 220 76 
             C 224 76, 236 90, 244 100 
             L 250 108 
             C 253 112, 253 116, 253 120 
             L 253 133 
             C 253 135, 251 137, 249 137 
             L 188 137 
             Z"
          fill="url(#cabGrad)"
        />

        {/* Cabin Window Glass */}
        <path
          d="M 194 82 
             L 218 82 
             L 236 103 
             L 194 103 
             Z"
          fill="#E0F2FE"
        />
        {/* Window Reflection */}
        <path d="M 204 84 L 214 84 L 202 101 L 196 101 Z" fill="#BAE6FD" opacity="0.7" />

        {/* Front Headlight */}
        <rect x="250" y="118" width="5" height="10" rx="2" fill="#FEF08A" />
        <rect x="251" y="120" width="3" height="6" rx="1" fill="#FFFFFF" />

        {/* Front Bumper */}
        <rect x="246" y="130" width="11" height="8" rx="2" fill="#334155" />

        {/* Chassis Lower Frame */}
        <rect x="58" y="134" width="190" height="6" fill="#1E293B" rx="3" />

        {/* Wheels (4 Wheels: 2 Rear, 1 Middle, 1 Front) */}
        {/* Rear Wheel 1 */}
        <circle cx="78" cy="144" r="14" fill="#1E293B" />
        <circle cx="78" cy="144" r="7" fill="#64748B" />
        <circle cx="78" cy="144" r="3" fill="#F8FAFC" />

        {/* Rear Wheel 2 */}
        <circle cx="112" cy="144" r="14" fill="#1E293B" />
        <circle cx="112" cy="144" r="7" fill="#64748B" />
        <circle cx="112" cy="144" r="3" fill="#F8FAFC" />

        {/* Front Wheel */}
        <circle cx="224" cy="144" r="14" fill="#1E293B" />
        <circle cx="224" cy="144" r="7" fill="#64748B" />
        <circle cx="224" cy="144" r="3" fill="#F8FAFC" />

        {/* Small details */}
        <circle cx="196" cy="116" r="2" fill="#166534" />
      </g>
    </svg>
  );
}

/**
 * Illustration of smartphone with verification message for Step 2 (Enter OTP).
 */
export function OtpPhoneIllustration({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background Soft Green Aura */}
      <div className="absolute inset-0 rounded-full bg-emerald-100/70 animate-pulse" />
      <div className="relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200/60 flex items-center justify-center shadow-sm">
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12"
        >
          {/* Smartphone outline */}
          <rect
            x="18"
            y="10"
            width="28"
            height="44"
            rx="6"
            stroke="#15803D"
            strokeWidth="2.5"
            fill="#FFFFFF"
          />
          {/* Top speaker notch */}
          <line
            x1="28"
            y1="14"
            x2="36"
            y2="14"
            stroke="#86EFAC"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Bottom home bar */}
          <line
            x1="29"
            y1="50"
            x2="35"
            y2="50"
            stroke="#CBD5E1"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Green chat bubble on top */}
          <g transform="translate(24, 20)">
            <rect x="0" y="0" width="24" height="16" rx="4" fill="#16A34A" />
            {/* Chat tail */}
            <path d="M 4 16 L 2 20 L 8 16 Z" fill="#16A34A" />
            {/* 3 OTP dots */}
            <circle cx="6" cy="8" r="1.5" fill="#FFFFFF" />
            <circle cx="12" cy="8" r="1.5" fill="#FFFFFF" />
            <circle cx="18" cy="8" r="1.5" fill="#FFFFFF" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * Illustration of Shield with checkmark & sparkles for Step 3 (Success & Role Detected).
 */
export function SuccessShieldIllustration({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Glow pulse background */}
      <div className="absolute inset-0 rounded-full bg-emerald-200/50 blur-xl animate-pulse" />

      {/* Sparkles around */}
      <div className="absolute top-1 left-3 text-emerald-400 text-sm animate-bounce font-bold">
        ✦
      </div>
      <div className="absolute top-2 right-4 text-emerald-500 text-xs animate-pulse font-bold">
        ★
      </div>
      <div className="absolute bottom-3 left-4 text-emerald-500 text-xs animate-pulse font-bold">
        ★
      </div>
      <div className="absolute bottom-2 right-3 text-emerald-400 text-sm animate-bounce font-bold">
        ✦
      </div>

      {/* Shield container */}
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-b from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-600/10">
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-14 h-14"
        >
          {/* Shield path */}
          <path
            d="M 32 8 
               L 48 15 
               C 48 30, 42 45, 32 54 
               C 22 45, 16 30, 16 15 
               Z"
            fill="url(#shieldGrad)"
            stroke="#16A34A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Checkmark */}
          <path
            d="M 25 31 L 30 36 L 40 24"
            stroke="#15803D"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient
              id="shieldGrad"
              x1="32"
              y1="8"
              x2="32"
              y2="54"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#DCFCE7" />
              <stop stopColor="#BBF7D0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
