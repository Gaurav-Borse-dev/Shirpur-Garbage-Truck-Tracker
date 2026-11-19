import { ChevronLeft } from "@/components/icons";
import { useT } from "@/lib/i18n";

export function PrivacyView({ onBack }: { onBack?: () => void }) {
  const tr = useT();

  return (
    <div className="absolute inset-0 overflow-y-auto bg-neutral-50 pb-16">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            aria-label={tr("Back to profile")}
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 grid place-items-center text-neutral-700 transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-wider uppercase font-extrabold text-emerald-700">
            {tr("Shirpur–Varwade Nagarparishad")}
          </div>
          <h1 className="text-lg font-bold text-neutral-900 truncate leading-tight">
            {tr("Privacy Policy")}
          </h1>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-5 max-w-2xl mx-auto space-y-4">
        {/* Badge Banner */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
            Official Municipal Utility
          </div>
          <h2 className="text-xl font-bold mt-1">CleanTrack Shirpur</h2>
          <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
            Smart Waste Collection & Garbage Truck Tracking System for citizens of Shirpur-Varwade
            Municipal Council (District Dhule, Maharashtra).
          </p>
          <div className="mt-3 pt-3 border-t border-emerald-400/40 flex items-center justify-between text-[11px] text-emerald-100">
            <span>Version: 1.0</span>
            <span>Effective Date: October 2026</span>
          </div>
        </div>

        {/* Section 1: Overview */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              1
            </span>
            Introduction & Scope
          </h3>
          <p className="text-xs text-neutral-600 leading-relaxed">
            This Privacy Policy explains how <strong>CleanTrack Shirpur</strong> collects, uses, and
            safeguards personal information when you use our mobile application and web platform.
            The system is operated under the auspices of the{" "}
            <strong>Shirpur-Varwade Nagarparishad</strong> to facilitate transparent, timely municipal
            waste collection.
          </p>
        </div>

        {/* Section 2: Data We Collect */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              2
            </span>
            Data We Collect
          </h3>

          <div className="space-y-2 text-xs text-neutral-600">
            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <strong className="text-neutral-800 block mb-0.5">📱 Mobile Phone Number</strong>
              We use your 10-digit mobile number strictly for user sign-in and authentication.
              No permanent passwords or social profiles are stored.
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <strong className="text-neutral-800 block mb-0.5">📍 Location Information</strong>
              <ul className="list-disc list-inside space-y-1 text-neutral-600 pl-1">
                <li>
                  <strong>For Residents:</strong> When permitted, your location is used strictly in
                  the foreground to display your home relative to oncoming trucks and trigger
                  proximity alerts within your chosen distance (100m, 250m, 500m, 1km). We do{" "}
                  <strong>not</strong> track or log resident locations in the background.
                </li>
                <li>
                  <strong>For Truck Drivers:</strong> GPS coordinates are broadcast during duty
                  shifts so residents on the route can view truck arrival times. Driver tracking
                  stops completely once marked off-duty.
                </li>
              </ul>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <strong className="text-neutral-800 block mb-0.5">🔔 Push Notifications Token</strong>
              Firebase Cloud Messaging (FCM) tokens are saved so we can alert your device when a
              garbage vehicle is near your street or when a dustbin booking status changes.
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <strong className="text-neutral-800 block mb-0.5">🗑️ Dustbin Booking Information</strong>
              When requesting community dustbins for marriages or events, we collect event name,
              contact number, and delivery street address to fulfill the service.
            </div>
          </div>
        </div>

        {/* Section 3: How We Use Data */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              3
            </span>
            How We Use Your Information
          </h3>
          <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1 leading-relaxed pl-1">
            <li>Display live truck positions on the municipal ward map.</li>
            <li>Send timely bell rings and push notifications before collection vehicles arrive.</li>
            <li>Process and dispatch community dustbin delivery requests.</li>
            <li>Enable municipal supervisors to monitor route coverage and bin clearance.</li>
            <li>We do <strong>NOT</strong> sell, rent, or monetize your personal data.</li>
          </ul>
        </div>

        {/* Section 4: Data Security */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              4
            </span>
            Data Security & Storage
          </h3>
          <p className="text-xs text-neutral-600 leading-relaxed">
            All data transmitted between the app and our servers is secured with HTTPS/TLS
            encryption. Database storage is protected using Row Level Security (RLS) on enterprise-grade
            cloud infrastructure (Supabase). Temporary GPS logs are automatically pruned.
          </p>
        </div>

        {/* Section 5: User Rights & Deletion */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              5
            </span>
            Your Rights & Account Deletion
          </h3>
          <p className="text-xs text-neutral-600 leading-relaxed">
            You can revoke location or notification permissions at any time via your device
            settings. You may also request complete removal of your phone number and booking history
            by emailing our support team at{" "}
            <a
              href="mailto:trucktracker27@gmail.com"
              className="text-emerald-700 font-semibold underline"
            >
              trucktracker27@gmail.com
            </a>
            . Deletion requests are fulfilled within 48 hours.
          </p>
        </div>

        {/* Section 6: Contact & Grievances */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black">
              6
            </span>
            Contact & Grievance Redressal
          </h3>
          <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 text-xs text-neutral-600 space-y-1">
            <div>
              <strong className="text-neutral-800">Support Email:</strong>{" "}
              <a
                href="mailto:trucktracker27@gmail.com"
                className="text-emerald-700 font-medium hover:underline"
              >
                trucktracker27@gmail.com
              </a>
            </div>
            <div>
              <strong className="text-neutral-800">Municipal Authority:</strong> Shirpur-Varwade
              Nagarparishad
            </div>
            <div>
              <strong className="text-neutral-800">Address:</strong> Administrative Headquarters,
              Main Road, Shirpur, Dist. Dhule, Maharashtra — 425405
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-neutral-400">
            © {new Date().getFullYear()} Shirpur-Varwade Nagarparishad · CleanTrack Shirpur
          </p>
        </div>
      </div>
    </div>
  );
}
