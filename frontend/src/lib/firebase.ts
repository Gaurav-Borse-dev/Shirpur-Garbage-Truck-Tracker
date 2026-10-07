/**
 * Firebase Phone Auth — sends free SMS OTP to any Indian mobile number.
 * Google covers the SMS cost (10,000 free verifications per month on Spark plan).
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwxrPZR57OrHfgEWxf1LUHGBLztp2o6i8",
  authDomain: "trucktracker-959ec.firebaseapp.com",
  projectId: "trucktracker-959ec",
  storageBucket: "trucktracker-959ec.firebasestorage.app",
  messagingSenderId: "227104814169",
  appId: "1:227104814169:web:7b9b051b5c774fb191ad48",
  measurementId: "G-ENV24G18Y0",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/** Get or create the Firebase Auth instance (client-side only). */
export function getFirebaseAuth(): Auth {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
    // Use Indian locale for SMS messages
    auth.languageCode = "hi";
  }
  return auth;
}

/** Recaptcha verifier singleton — invisible reCAPTCHA. */
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Set up invisible reCAPTCHA on a DOM element.
 * Call this once after the login page mounts.
 */
export function setupRecaptcha(containerId = "recaptcha-container"): RecaptchaVerifier {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }
  if (typeof document !== "undefined") {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      document.body.appendChild(el);
    }
  }
  const firebaseAuth = getFirebaseAuth();
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved — allow signInWithPhoneNumber
    },
    "expired-callback": () => {
      resetRecaptcha();
    },
  });
  return recaptchaVerifier;
}

/**
 * Reset the reCAPTCHA verifier (needed after each OTP send attempt).
 */
export function resetRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // ignore
    }
    recaptchaVerifier = null;
  }
}

/**
 * Send OTP via Firebase Phone Auth.
 * Returns a ConfirmationResult that can be used to verify the code.
 */
export async function firebaseSendOtp(phone10Digit: string): Promise<ConfirmationResult> {
  const firebaseAuth = getFirebaseAuth();
  const verifier = setupRecaptcha();
  const formattedPhone = `+91${phone10Digit}`;

  try {
    const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, verifier);
    return result;
  } catch (err) {
    // Reset reCAPTCHA on failure so user can retry
    resetRecaptcha();
    throw err;
  }
}

/**
 * Verify the OTP code using the ConfirmationResult from firebaseSendOtp.
 * Returns the Firebase User on success.
 */
export async function firebaseVerifyOtp(confirmationResult: ConfirmationResult, code: string) {
  const credential = await confirmationResult.confirm(code);
  return credential.user;
}
