/* ============================================================
   MI RESELLER PROGRAM — Shared Config
   Muslim Islam Org | Muaaz Iqbal (Kasur, Punjab, Pakistan)
   ============================================================ */

// ---- Firebase (same project as before: ramadan-2385b) ----
export const FB = {
  apiKey: "AIzaSyBbnU8DkthpYQMHOLLyj6M0cc05qXfjMcw",
  authDomain: "ramadan-2385b.firebaseapp.com",
  databaseURL: "https://ramadan-2385b-default-rtdb.firebaseio.com",
  projectId: "ramadan-2385b",
  storageBucket: "ramadan-2385b.firebasestorage.app",
  messagingSenderId: "882828936310",
  appId: "1:882828936310:web:7f97b921031fe130fe4b57"
};

// ---- ImgBB (image hosting for profile pics + product images) ----
// NOTE: this key was shared in plain chat text, so it is PUBLIC now.
// Go to https://api.imgbb.com/ and generate a fresh key, then replace below.
export const IMGBB_KEY = "6bdb23b28e7581721b28e46ce313308b";
export const IMGBB_URL = "https://api.imgbb.com/1/upload";

// ---- Groq AI (client-side, rotate multiple keys to survive rate limits) ----
// SECURITY NOTE: any key placed here is visible to anyone who opens dev tools.
// Add your own key(s) below. Multiple keys = automatic rotation on 429s.
export const GROQ_KEYS = [
  "YOUR_GROQ_API_KEY_1"
  // ,"YOUR_GROQ_API_KEY_2"
];
// Fast/mini model — quick replies, low cost
export const GROQ_MODEL_MINI = "llama-3.1-8b-instant";
// Long/smart model — deep answers, more context
export const GROQ_MODEL_LONG = "llama-3.3-70b-versatile";

export const GROQ_SYSTEM_PROMPT = `You are Mi AI — the official assistant of Mi Reseller Program by Muslim Islam Org, founder Muaaz Iqbal (Kasur, Punjab, Pakistan).
Help resellers with: IPTV/M3U setup, client management, billing, marketplace listings, Firebase, app usage, payments (JazzCash/EasyPaisa), and general tech support.
Be concise, warm, and professional. Roman Urdu + English mix is completely fine and preferred.
Mi Reseller Program is a reseller platform where members manage clients, chat with admin/other resellers, sell products/services in the marketplace, and track earnings — all via a web portal / installable app.`;

// ---- Google Maps (for reseller location picker) ----
// Get a key from https://console.cloud.google.com/google/maps-apis and enable "Maps JavaScript API" + "Places API".
export const GOOGLE_MAPS_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

// ---- App identity ----
export const APP_NAME = "Mi Reseller Program";
export const APP_SHORT = "Mi Reseller";
export const APP_TAGLINE = "JOIN · EARN · GROW";
export const LOGO_PATH = "assets/logo.png";

// ---- Admin identity (used by real Firebase Auth session checks) ----
export const ADMIN_EMAIL = "muaaziqbal@gmail.com";

// ---- Payment destinations (admin edits these in Admin Panel → Settings, stored in Firebase) ----
export const DEFAULT_PAYMENT_METHODS = {
  jazzcash: { enabled: true, number: "03XX-XXXXXXX", name: "Muaaz Iqbal" },
  easypaisa: { enabled: true, number: "03XX-XXXXXXX", name: "Muaaz Iqbal" },
  bank: { enabled: false, iban: "", bankName: "", accountTitle: "" }
};
