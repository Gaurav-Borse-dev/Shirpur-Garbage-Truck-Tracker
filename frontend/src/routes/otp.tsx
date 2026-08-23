import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { MobileFrame } from "@/components/MobileFrame";
import { ChevronLeft } from "@/components/icons";
import { useAuth, detectRole } from "@/store/auth";
import { verifyOtp } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";
import { OtpPhoneIllustration } from "@/components/AuthIllustrations";

const search = z.object({
  phone: z.string().regex(/^\d{10}$/),
  role: z.enum(["resident", "driver", "admin"]).optional(),
});

export const Route = createFileRoute("/otp")({
  validateSearch: (s) => search.parse(s),
  component: Otp,
});

function Otp() {
  const tr = useT();
  const searchParams = Route.useSearch();
  const phone = searchParams.phone;
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const queryClient = useQueryClient();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean) {
      const n = [...digits];
      n[i] = "";
      setDigits(n);
      return;
    }
    const chars = clean.split("").slice(0, 6 - i);
    const n = [...digits];
    chars.forEach((c, k) => (n[i + k] = c));
    setDigits(n);
    const focusAt = Math.min(5, i + chars.length);
    refs.current[focusAt]?.focus();
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  useEffect(() => {
    const code = digits.join("");
    if (code.length !== 6 || checking) return;
    let cancelled = false;
    setChecking(true);
    void (async () => {
      const reject = (msg: string) => {
        if (cancelled) return;
        setError(msg);
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setTimeout(() => {
          setDigits(["", "", "", "", "", ""]);
          refs.current[0]?.focus();
        }, 600);
      };
      try {
        const detected = detectRole(phone);
        const resolvedRole = searchParams.role || detected.role;
        const res = await verifyOtp({ data: { phone, role: resolvedRole, code } });
        if (cancelled) return;
        if (!res.ok) return reject(tr("Incorrect code. Please try again."));
        await queryClient.invalidateQueries({ queryKey: ["server-session"] });
        const cleanPhone = phone.trim().replace(/\D/g, "");

        if (resolvedRole === "admin") {
          setSession({ role: "admin", username: "admin" });
          navigate({ to: "/admin" });
        } else if (resolvedRole === "driver" && detected.driver) {
          setSession({
            role: "driver",
            phone: cleanPhone,
            driverName: detected.driver.name,
            truckId: detected.driver.truckId,
          });
          navigate({ to: "/driver" });
        } else {
          setSession({ role: "resident", phone: cleanPhone, city: "Shirpur" });
          navigate({ to: "/resident" });
        }
      } catch {
        reject(tr("Unable to verify the code right now."));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [digits]); // eslint-disable-line

  return (
    <MobileFrame>
      <div className="px-4 pt-4">
        <Link
          to="/role"
          className="inline-grid place-items-center w-10 h-10 rounded-full hover:bg-neutral-100 transition-colors"
          aria-label={tr("Back")}
        >
          <ChevronLeft />
        </Link>
      </div>

      <div className="px-6 mt-2 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">{tr("Verify OTP")}</h1>
        <p className="mt-1 text-xs text-neutral-500">{tr("We have sent a 6 digit OTP to")}</p>
        <p className="font-bold text-emerald-700 text-sm mt-0.5">
          +91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
        </p>
      </div>

      <div className="my-4 flex justify-center">
        <OtpPhoneIllustration className="w-24 h-24" />
      </div>

      <div className={`px-6 flex justify-center gap-2 ${shake ? "ct-shake" : ""}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            inputMode="numeric"
            maxLength={6}
            className={`w-11 sm:w-12 h-14 text-center text-xl font-bold rounded-2xl border outline-none transition-all ${
              d
                ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20"
                : "border-neutral-200 bg-neutral-50/80 text-neutral-900 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            }`}
          />
        ))}
      </div>

      {error && <div className="px-6 mt-4 text-xs font-semibold text-red-600 text-center">{error}</div>}

      <div className="px-6 mt-6 text-center text-xs text-neutral-400">
        {tr("Enter the 6-digit verification code sent to your mobile number.")}
      </div>
    </MobileFrame>
  );
}