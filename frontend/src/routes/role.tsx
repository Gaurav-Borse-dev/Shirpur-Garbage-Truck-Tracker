import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { MobileFrame } from "@/components/MobileFrame";
import { useAuth, detectRoleAsync, loadDriversFromDb, type Role } from "@/store/auth";
import { loginWithPhone } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";
import { SuccessShieldIllustration } from "@/components/AuthIllustrations";
import { LoginImageSlider } from "@/components/LoginImageSlider";

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

type Step = "phone" | "redirecting";

function UnifiedLoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuth((s) => s.session);
  const setSession = useAuth((s) => s.setSession);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  // Detected role info for smooth redirect display
  const [detectedRoleInfo, setDetectedRoleInfo] = useState<{
    role: Role;
    title: string;
    subtitle: string;
    targetRoute: string;
  } | null>(null);

  const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
  const isPhoneValid = /^\d{10}$/.test(cleanPhone);

  useEffect(() => {
    void loadDriversFromDb();
  }, []);

  // If already authenticated, redirect to appropriate role dashboard
  useEffect(() => {
    if (session?.role === "resident") {
      navigate({ to: "/resident", replace: true });
    } else if (session?.role === "driver") {
      navigate({ to: "/driver", replace: true });
    } else if (session?.role === "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [session, navigate]);

  // Direct Sign-In Handler (No OTP enter page required)
  async function handleSignIn() {
    if (!isPhoneValid || signingIn) {
      if (!isPhoneValid) {
        setError(t("Please enter a valid 10-digit mobile number"));
      }
      return;
    }

    setSigningIn(true);
    setError("");

    try {
      // 1. Detect role (async ensures drivers table in DB is checked)
      const detected = await detectRoleAsync(cleanPhone);

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

      // 2. Direct server login (sets session cookie, authoritative role resolution)
      const res = await loginWithPhone({ data: { phone: cleanPhone } });
      if (!res.ok) {
        setError(t("Unable to sign in. Please try again."));
        setSigningIn(false);
        return;
      }

      const finalRole = res.resolvedRole || detected.role;

      // 3. Save user session in local store
      if (finalRole === "admin") {
        setSession({ role: "admin", username: "admin" });
      } else if (finalRole === "driver") {
        const driverName = detected.driver?.name || res.driverInfo?.name || "Driver";
        const truckId = detected.driver?.truckId || res.driverInfo?.truckId || "";
        setSession({
          role: "driver",
          phone: cleanPhone,
          driverName,
          truckId,
        });
      } else {
        setSession({
          role: "resident",
          phone: cleanPhone,
          city: "Shirpur",
        });
      }

      // 4. Synchronously prime the query cache with the newly authenticated session
      const serverSessionData = {
        role: finalRole,
        phone: cleanPhone,
        ...(finalRole === "admin" ? { username: "admin" } : {}),
      };
      queryClient.setQueryData(["server-session"], serverSessionData);
      void queryClient.invalidateQueries({ queryKey: ["server-session"] });

      // 5. Move to Step 2: Role Detected & Smooth Redirection
      setStep("redirecting");

      // Auto redirect after a pleasant transition
      setTimeout(() => {
        navigate({ to: targetRoute as any });
      }, 1000);
    } catch (err: any) {
      setError(err?.message || t("Unable to sign in. Please try again."));
      setSigningIn(false);
    }
  }

  return (
    <MobileFrame>
      <div className="flex-1 flex flex-col p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {/* ================= STEP 1: ENTER MOBILE NUMBER & DIRECT SIGN IN ================= */}
          {step === "phone" && (
            <motion.div
              key="step-phone"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col gap-3.5"
            >
              {/* ── 1. UPPER SIDE: Municipal Logo & Name Box ── */}
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

              {/* ── 4. BELOW: Mobile Number Enter Card ── */}
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
                          void handleSignIn();
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

                {/* Direct Sign-In Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={!isPhoneValid || signingIn}
                  onClick={() => void handleSignIn()}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-600/20 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {signingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("Signing in…")}</span>
                    </>
                  ) : (
                    <span>{t("Sign In")}</span>
                  )}
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 pt-0.5">
                  <svg
                    className="w-3.5 h-3.5 text-neutral-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{t("Your data is secure with us")}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 2: ROLE DETECTED & REDIRECT ================= */}
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
    </MobileFrame>
  );
}
