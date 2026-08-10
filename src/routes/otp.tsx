import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { MobileFrame } from "@/components/MobileFrame";
import { ChevronLeft } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { verifyOtp } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";

const search = z.object({
  phone: z.string().regex(/^\d{10}$/),
  role: z.enum(["resident", "driver"]),
});

export const Route = createFileRoute("/otp")({
  validateSearch: (s) => search.parse(s),
  component: Otp,
});

function Otp() {
  const tr = useT();
  const { phone, role } = Route.useSearch();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const findDriver = useAuth((s) => s.findDriverByPhone);
  const queryClient = useQueryClient();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean) {
      const n = [...digits]; n[i] = ""; setDigits(n);
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
        setTimeout(() => { setDigits(["", "", "", "", "", ""]); refs.current[0]?.focus(); }, 600);
      };
      try {
        const res = await verifyOtp({ data: { phone, role, code } });
        if (cancelled) return;
        if (!res.ok) return reject(tr("Incorrect code. Please try again."));
        await queryClient.invalidateQueries({ queryKey: ["server-session"] });
        if (role === "driver") {
          const driver = findDriver(phone);
          if (!driver) {
            navigate({ to: "/login/driver", search: { denied: 1 } as never });
            setError(tr("Access denied. Contact your municipal administrator."));
            return;
          }
          setSession({ role: "driver", phone, driverName: driver.name, truckId: driver.truckId });
          navigate({ to: "/driver" });
        } else {
          setSession({ role: "resident", phone, city: "Shirpur" });
          navigate({ to: "/resident" });
        }
      } catch {
        reject(tr("Unable to verify the code right now."));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [digits]); // eslint-disable-line

  return (
    <MobileFrame>
      <div className="px-4 pt-4">
        <Link to={role === "driver" ? "/login/driver" : "/login/resident"} className="inline-grid place-items-center w-10 h-10 rounded-full hover:bg-neutral-100">
          <ChevronLeft />
        </Link>
      </div>
      <div className="px-6 mt-4">
        <h1 className="text-2xl font-bold text-ink">{tr("Enter the 6-digit code")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{tr("Sent to")} +91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</p>
      </div>
      <div className={`px-6 mt-8 flex justify-between gap-2 ${shake ? "ct-shake" : ""}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            inputMode="numeric"
            maxLength={6}
            className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/20"
          />
        ))}
      </div>
      {error && <div className="px-6 mt-4 text-sm text-red-600 text-center">{error}</div>}
      <div className="px-6 mt-6 text-center text-xs text-neutral-400">
        {tr("Enter the 6-digit verification code sent to your mobile number.")}
      </div>
    </MobileFrame>
  );
}