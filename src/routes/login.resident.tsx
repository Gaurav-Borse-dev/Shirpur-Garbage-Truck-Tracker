import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { ChevronLeft } from "@/components/icons";

export const Route = createFileRoute("/login/resident")({
  component: ResidentLogin,
});

function ResidentLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const ok = /^\d{10}$/.test(phone);
  return (
    <MobileFrame>
      <div className="px-4 pt-4">
        <Link to="/role" className="inline-grid place-items-center w-10 h-10 rounded-full hover:bg-neutral-100">
          <ChevronLeft />
        </Link>
      </div>
      <div className="px-6 mt-4">
        <h1 className="text-2xl font-bold text-ink">Sign in as Resident</h1>
        <p className="mt-1 text-sm text-neutral-500">We'll send a one-time code to verify your number.</p>
      </div>
      <div className="px-6 mt-8 space-y-3">
        <label className="text-xs font-semibold text-neutral-500">Mobile number</label>
        <div className="flex items-center gap-2">
          <div className="h-14 px-4 grid place-items-center rounded-xl bg-neutral-50 font-semibold text-ink">+91</div>
          <input
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="98220 11003"
            className="flex-1 h-14 px-4 rounded-xl bg-neutral-50 outline-none text-ink text-lg tracking-wide focus:ring-2 focus:ring-ink/10"
          />
        </div>
        <button
          disabled={!ok}
          onClick={() => navigate({ to: "/otp", search: { phone, role: "resident" } })}
          className="w-full h-14 rounded-xl bg-ink text-white font-semibold disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
        >
          Send code
        </button>
        <p className="text-xs text-neutral-400 text-center pt-2">By continuing you agree to our Terms & Privacy.</p>
      </div>
    </MobileFrame>
  );
}