import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { MobileFrame } from "@/components/MobileFrame";
import { Logo } from "@/components/Logo";
import { ChevronLeft } from "@/components/icons";
import { useAuth, detectRole, type Role } from "@/store/auth";
import { sendOtp, verifyOtp, setFirebaseSession } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";
import {
  GarbageTruckIllustration,
  OtpPhoneIllustration,
  SuccessShieldIllustration,
} from "@/components/AuthIllustrations";
import { LoginImageSlider } from "@/components/LoginImageSlider";
import type { ConfirmationResult } from "firebase/auth";

export const Route = createFileRoute("/role")({
  head: () => ({
    meta: [
      { title: "Sign In — Shirpur Garbage Truck Tracker" },
      {
        name: "description",
        content:
          "Sign in to Shirpur's Smart Waste Collection System with your mobile number. Automatic role detection for Residents, Truck Drivers, and Municipal Admins.",
      },
      { property: "og:title", content: "Sign In — Shirpur Garbage Truck Tracker" },
      {
        property: "og:description",
        content: "Smart Waste Collection System for Clean & Green Shirpur.",
      },
      { property: "og:url", content: "https://street-scan-track.shirpur.app/role" },
    ],
    links: [{ rel: "canonical", href: "https://street-scan-track.shirpur.app/role" }],
  }),
  component: UnifiedLoginPage,
});

type Step = "phone" | "otp" | "redirecting";

function UnifiedLoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuth((s) => s.setSession);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // OTP state
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [timer, setTimer] = useState(45);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Firebase confirmation result (stored after sendOtp for non-admin phones)
  const firebaseConfirmRef = useRef<ConfirmationResult | null>(null);
  // Whether current OTP flow uses Firebase (true) or admin bypass (false)
  const [useFirebase, setUseFirebase] = useState(false);

  // Detected role info
  const [detectedRoleInfo, setDetectedRoleInfo] = useState<{
    role: Role;
    title: string;
    subtitle: string;
    targetRoute: string;
  } | null>(null);

  const isPhoneValid = /^\d{10}$/.test(phone);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (step !== "otp") return;
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  // Focus first input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 200);
    }
  }, [step]);

  // Send OTP handler
  async function handleSendOtp() {
    if (!isPhoneValid || sending) return;
    setSending(true);
    setError("");
    try {
      // 1. Ask server if this is an admin bypass or Firebase flow
      const res = await sendOtp({ data: { phone } });
      if (!res.ok) {
        setError((res as any).error || t("Failed to send OTP. Please check your mobile number."));
        setSending(false);
        return;
      }

      if (res.useFirebase) {
        // 2. Non-admin: Send OTP via Firebase Phone Auth (free for any Indian number)
        const { firebaseSendOtp, resetRecaptcha } = await import("@/lib/firebase");
        resetRecaptcha(); // Clear any previous reCAPTCHA
        const confirmation = await firebaseSendOtp(phone);
        firebaseConfirmRef.current = confirmation;
        setUseFirebase(true);
      } else {
        // 3. Admin bypass: no real SMS needed
        firebaseConfirmRef.current = null;
        setUseFirebase(false);
      }

      setSending(false);
      setTimer(45);
      setDigits(["", "", "", "", "", ""]);
      setStep("otp");
    } catch (err: any) {
      const msg = err?.code === "auth/too-many-requests"
        ? t("Too many attempts. Please try again later.")
        : err?.code === "auth/invalid-phone-number"
        ? t("Invalid phone number. Please check and try again.")
        : err?.message || t("Failed to send OTP. Please check your mobile number.");
      setError(msg);
      setSending(false);
    }
  }

  // Handle OTP digit changes
  function handleDigitChange(i: number, val: string) {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }

    // Support multi-character paste / autofill
    const chars = clean.split("").slice(0, 6 - i);
    const next = [...digits];
    chars.forEach((c, idx) => {
      next[i + idx] = c;
    });
    setDigits(next);

    const nextIndex = Math.min(5, i + chars.length);
    otpRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  // Submit OTP Verification
  async function handleVerifyOtp(codeToVerify?: string) {
    const code = codeToVerify || digits.join("");
    if (code.length !== 6 || verifying) return;

    setVerifying(true);
    setError("");

    const detected = detectRole(phone);
    const cleanPhone = phone.trim().replace(/\D/g, "");

    let roleTitle = t("Resident");
    let roleSubtitle = t("Opening live truck tracking & collection alerts…");
    let targetRoute = "/resident";

    if (detected.role === "admin") {
      roleTitle = t("Municipal Admin");
      roleSubtitle = t("Accessing fleet management dashboard…");
      targetRoute = "/admin";
    } else if (detected.role === "driver" && detected.driver) {
      roleTitle = `${t("Truck Driver")} (${detected.driver.name})`;
      roleSubtitle = `${t("Assigned Truck")}: ${detected.driver.truckId} · ${t("Starting duty…")}`;
      targetRoute = "/driver";
    }

    setDetectedRoleInfo({
      role: detected.role,
      title: roleTitle,
      subtitle: roleSubtitle,
      targetRoute,
    });

    try {
      if (code === "123456" || !useFirebase || !firebaseConfirmRef.current) {
        // ── Direct OTP (123456) Verification ──
        const res = await verifyOtp({
          data: {
            phone: cleanPhone,
            role: detected.role,
            code,
          },
        });

        if (!res.ok) {
          setError((res as any).error || t("Incorrect code. Please enter 123456."));
          setShake(true);
          setTimeout(() => setShake(false), 450);
          setTimeout(() => {
            setDigits(["", "", "", "", "", ""]);
            otpRefs.current[0]?.focus();
          }, 600);
          setVerifying(false);
          return;
        }
      } else {
        // ── Firebase OTP Verification ──
        const { firebaseVerifyOtp } = await import("@/lib/firebase");
        const firebaseUser = await firebaseVerifyOtp(firebaseConfirmRef.current, code);

        // Set server session after Firebase verification
        const sessionRes = await setFirebaseSession({
          data: {
            phone: cleanPhone,
            role: detected.role,
            firebaseUid: firebaseUser.uid,
          },
        });

        if (!sessionRes.ok) {
          setError(t("Failed to create session. Please try again."));
          setVerifying(false);
          return;
        }
      }

      // Save user session in local store
      if (detected.role === "admin") {
        setSession({ role: "admin", username: "admin" });
      } else if (detected.role === "driver" && detected.driver) {
        setSession({
          role: "driver",
          phone: cleanPhone,
          driverName: detected.driver.name,
          truckId: detected.driver.truckId,
        });
      } else {
        setSession({
          role: "resident",
          phone: cleanPhone,
          city: "Shirpur",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["server-session"] });

      // Move to Step 3: Success & Smooth Redirection
      setStep("redirecting");

      // Auto redirect after a pleasant transition
      setTimeout(() => {
        navigate({ to: targetRoute as any });
      }, 1200);
    } catch (err: any) {
      const msg = err?.code === "auth/invalid-verification-code"
        ? t("Incorrect code. Please check and try again.")
        : err?.code === "auth/code-expired"
        ? t("OTP expired. Please resend.")
        : err?.message || t("Unable to verify the code right now.");
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      setTimeout(() => {
        setDigits(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }, 600);
      setVerifying(false);
    }
  }

  // Auto-submit when all 6 digits are typed
  useEffect(() => {
    const code = digits.join("");
    if (code.length === 6 && step === "otp" && !verifying) {
      void handleVerifyOtp(code);
    }
  }, [digits, step]); // eslint-disable-line

  return (
    <MobileFrame>


      <div className="flex-1 flex flex-col p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {/* ================= STEP 1: ENTER MOBILE NUMBER ================= */}
          {step === "phone" && (
            <motion.div
              key="step-phone"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col gap-3.5"
            >
              {/* ── 1. UPPER SIDE: Increased Size Municipal Logo & Name Box ── */}
              <div className="w-full bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/40 rounded-3xl border border-emerald-200/90 p-4 sm:p-4.5 shadow-sm flex items-center gap-4">
                <img
                  src="/shirpur-logo.jpg"
                  alt="Shirpur Municipal Logo"
                  className="w-16 h-16 rounded-2xl border-2 border-emerald-300 object-cover shadow-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="flex flex-col gap-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-xs sm:text-sm font-extrabold w-fit border border-emerald-300/80 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                    <span className="tracking-wide">SHIRPUR-WARWADE</span>
                  </div>
                  <span className="text-xs font-bold text-neutral-500 tracking-wider uppercase pl-1">
                    SHIRPUR MUNICIPAL CORP
                  </span>
                </div>
              </div>

              {/* ── 2. BELOW: Sliding Photo Carousel ── */}
              <div className="w-full">
                <LoginImageSlider />
              </div>

              {/* ── 3. BELOW: Feature Badges (Live Tracking / Segregated Waste / Timely Pickup) ── */}
              <div className="grid grid-cols-3 gap-2.5 w-full">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 shadow-sm text-center">
                  <span className="text-2xl mb-1 select-none">🚛</span>
                  <span className="text-[11px] font-bold text-emerald-800 leading-tight">
                    {t("Live Tracking")}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 shadow-sm text-center">
                  <span className="text-2xl mb-1 select-none">♻️</span>
                  <span className="text-[11px] font-bold text-emerald-800 leading-tight">
                    {t("Segregated Waste")}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 shadow-sm text-center">
                  <span className="text-2xl mb-1 select-none">🗑️</span>
                  <span className="text-[11px] font-bold text-emerald-800 leading-tight">
                    {t("Timely Pickup")}
                  </span>
                </div>
              </div>

              {/* ── 4. BELOW: Mobile Number Enter Card (Moved up directly under feature badges) ── */}
              <div className="w-full bg-white rounded-3xl border border-neutral-200/90 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3.5">
                <div className="text-center">
                  <h2 className="text-xl font-extrabold text-emerald-600 tracking-tight">
                    {t("Welcome!")}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t("Enter your mobile number to continue")}
                  </p>
                </div>

                {/* Mobile Input Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50/70 p-1.5 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                    <div className="flex items-center gap-1.5 pl-3 pr-2 text-neutral-700 font-semibold text-sm border-r border-neutral-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isPhoneValid) {
                          void handleSendOtp();
                        }
                      }}
                      placeholder="9876543210"
                      className="flex-1 h-11 px-3 bg-transparent outline-none text-neutral-900 font-semibold text-base tracking-wider placeholder:text-neutral-400 placeholder:font-normal"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 py-1.5 px-3 rounded-xl mx-auto max-w-[280px]"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Send OTP Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={!isPhoneValid || sending}
                  onClick={() => void handleSendOtp()}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/20 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("Sending OTP…")}</span>
                    </>
                  ) : (
                    <span>{t("Send OTP")}</span>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 2: ENTER OTP ================= */}
          {step === "otp" && (
            <motion.div
              key="step-otp"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                {/* Back to Phone Button */}
                <div className="flex items-center mb-2">
                  <button
                    onClick={async () => {
                      setStep("phone");
                      setError("");
                      firebaseConfirmRef.current = null;
                      const { resetRecaptcha } = await import("@/lib/firebase");
                      resetRecaptcha();
                    }}
                    className="w-10 h-10 rounded-full hover:bg-neutral-100 grid place-items-center text-neutral-600 transition-colors cursor-pointer"
                    aria-label={t("Back")}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>

                {/* Heading */}
                <div className="text-center">
                  <h1 className="text-2xl font-extrabold text-neutral-900">{t("Verify OTP")}</h1>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t("Enter 6-digit OTP")} <span className="font-bold text-emerald-600">(123456)</span> {t("for")}
                  </p>
                  <p className="font-bold text-emerald-700 text-sm mt-0.5">
                    +91 {phone.replace(/(\d{5})(\d{5})/, "$1 $2")}
                  </p>
                </div>

                {/* OTP Phone Device Illustration */}
                <div className="my-4 flex justify-center">
                  <OtpPhoneIllustration className="w-24 h-24" />
                </div>

                {/* 6 Digit Input Boxes */}
                <div className={`flex justify-center gap-2 px-1 ${shake ? "ct-shake" : ""}`}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={`w-11 sm:w-12 h-14 text-center text-xl font-bold rounded-2xl border outline-none transition-all ${
                        digit
                          ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20"
                          : "border-neutral-200 bg-neutral-50/80 text-neutral-900 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                      }`}
                    />
                  ))}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 py-1.5 px-3 rounded-xl mx-auto max-w-[280px]"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Resend OTP Timer / Button */}
                <div className="mt-5 text-center">
                  {timer > 0 ? (
                    <p className="text-xs text-neutral-500">
                      {t("Resend OTP in")}{" "}
                      <span className="font-bold text-emerald-700">{timer}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={() => void handleSendOtp()}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      {t("Resend OTP")}
                    </button>
                  )}
                </div>
              </div>

              {/* Verify & Login Button & Security Note */}
              <div className="mt-6 space-y-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={digits.join("").length !== 6 || verifying}
                  onClick={() => void handleVerifyOtp()}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/20 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("Verifying…")}</span>
                    </>
                  ) : (
                    <span>{t("Verify & Login")}</span>
                  )}
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
                  <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{t("Your data is secure with us")}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 3: ROLE DETECTED & REDIRECT ================= */}
          {step === "redirecting" && (
            <motion.div
              key="step-redirecting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6"
            >
              {/* Success Shield Glow Illustration */}
              <SuccessShieldIllustration className="w-36 h-36" />

              <div>
                <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                  {t("Login Successful!")}
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  {t("Redirecting you to your dashboard...")}
                </p>
              </div>

              {/* Detected Role Card */}
              {detectedRoleInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="w-full max-w-[300px] bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 shadow-sm"
                >
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    ✓ {t("Role Detected")}
                  </div>
                  <div className="font-extrabold text-emerald-950 text-base">
                    {detectedRoleInfo.title}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1 font-medium">
                    {detectedRoleInfo.subtitle}
                  </div>
                </motion.div>
              )}

              {/* Modern Green Circular Spinner */}
              <div className="flex items-center justify-center pt-2">
                <svg
                  className="w-8 h-8 text-emerald-600 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-container" />
    </MobileFrame>
  );
}
