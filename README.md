# 🟢 Mi Reseller Program

**JOIN · EARN · GROW**
Official reseller portal — Muslim Islam Org | Muaaz Iqbal (Kasur, Punjab, Pakistan)

---

## 🆕 v2 Update — Performance, Real Auth, GPS, Admin Full Control

### 1. Scroll hang — fixed
The old build had `backdrop-filter: blur(24px)` + `will-change: transform`
on **every card** (often 10-15+ per page), plus a `blur(90px)` animated
background layer with no compositor isolation. On mid-range Android this
pins huge GPU layers and repaints them every scroll frame — that's what was
hanging.

Fixed by: removing `will-change` from `.card`/`.btn` (was pinning a
permanent GPU layer per element), cutting blur radii roughly in half
site-wide, isolating the background orbs into their own `contain:strict`
layer so they never repaint during scroll, and adding `contain` to the
scroll container/topbar/bottom nav. Visuals are still 3D/smooth — glow and
blur are just no longer fighting the scroll thread.

### 2. Real Google Authentication + Forgot Password
- **`js/auth.js`** is now the single source of truth for auth — real
  `onAuthStateChanged` session persistence (not a one-time localStorage
  flag), so a session actually respects Firebase token expiry/refresh
  instead of just staying "logged in" forever in local storage.
- **Admin panel**: Google Sign-In (matched against `ADMIN_EMAIL` in
  `js/config.js`) is now the **actual access gate**. The 4-digit PIN is only
  a fast local re-lock for a device that's *already* authenticated — it can
  no longer grant admin access on its own like it silently did before.
- **Forgot Password**: real Firebase `sendPasswordResetEmail` flow on the
  login page ("Password bhool gaye?" link). This works for accounts linked
  to Firebase Auth (Google sign-in). Phone/password-only resellers (the
  original simple login) aren't Firebase Auth accounts, so reset emails
  don't apply to them — that login path still works exactly as before,
  unaffected.

### 3. Admin — full listing edit control
Previously Admin could only **remove** a reseller's marketplace listing.
Now Admin can fully **edit** title, price, description, category, and swap
the product image on *any* reseller's listing (Marketplace tab → tap a
listing → ✏️ Edit). Edited listings are flagged `edited_by_admin: true` in
Firebase so you can tell they were admin-modified if needed.

### 4. GPS direct location (in addition to Maps tap-to-pick)
Registration and reseller Profile now both have a **"📡 GPS Se Location
Lein"** button next to the Maps picker. It asks the browser for the
device's real coordinates directly (no map interaction needed) and
reverse-geocodes them into a readable address. Falls back to raw lat/lng if
the Maps API key isn't configured — GPS itself still works even without the
Maps key.

### 5. Chat image sharing (ImgBB)
Already built into both reseller and admin chat (🖼️ button next to the chat
input) — confirmed still fully wired in this update.

### 6. Vercel deploy config
Added `vercel.json` (cache headers, clean URLs, security headers) plus
`robots.txt` / `sitemap.xml`. Honest note: `dashboard.html` and
`admin.html` are login-gated app screens, not public content — they're
correctly excluded from the sitemap and disallowed for crawlers. Only the
public login page is meant to be indexed; there's no real SEO value in a
search engine indexing a locked reseller dashboard.

---

## 📁 Files

```
mi-reseller/
├── index.html              → Login / Register (real Google Auth + phone/password + Forgot Password)
├── dashboard.html           → Reseller app (clients, marketplace, chat, AI, profile, GPS+Maps location)
├── admin.html                → Admin panel (real Google Auth gate, resellers, requests, marketplace FULL edit, monitor, chat, AI, settings)
├── manifest.json             → PWA manifest (installable app)
├── sw.js                       → Service worker (offline caching)
├── vercel.json                → Deploy config (cache headers, security headers)
├── robots.txt / sitemap.xml → Search engine config (public login page only)
├── assets/logo.png       → Your uploaded Mi Reseller Program logo
├── css/theme.css            → Shared design system — perf-tuned (5 themes)
└── js/
    ├── config.js              → ⚠️ ALL YOUR API KEYS GO HERE
    ├── auth.js                 → Real Firebase Auth (Google, email/password, Forgot Password, session persistence)
    ├── sounds.js              → Touch/click sound effects (Web Audio)
    ├── imgbb.js                → Image upload helper (ImgBB) — profile pics, products, chat images
    ├── groq-ai.js             → Mi AI chat (mini + long model, key rotation)
    ├── location-picker.js  → Google Maps location picker + direct GPS lookup
    ├── pwa-install.js       → "Install App" banner + button logic
    ├── dashboard-app.js  → Full reseller dashboard logic (boots off real auth session)
    └── admin-app.js         → Full admin panel logic (Google Auth is the real gate; full listing edit)
```

---

## ⚠️ IMPORTANT — Before you deploy

### 1. Groq API key — REGENERATE IT NOW
The key you shared in chat earlier is now public. **Go to
[console.groq.com/keys](https://console.groq.com/keys), revoke that key, and
generate a new one.** Then open `js/config.js` and paste it into `GROQ_KEYS`.
You can add multiple keys — the app rotates automatically when one hits its
rate limit.

### 2. ImgBB key — also regenerate
Same reason. Get a fresh one at [api.imgbb.com](https://api.imgbb.com/) and
update `IMGBB_KEY` in `js/config.js`.

### 3. Firebase config — and enable Auth providers
Firebase project is unchanged (`ramadan-2385b`), but `apiKey`,
`messagingSenderId`, and `appId` fields are still placeholders — pull the
real values from Firebase Console → Project Settings → paste into
`js/config.js` → `FB`.

**New requirement for real auth**: in Firebase Console → Authentication →
Sign-in method, make sure **Google** and **Email/Password** providers are
both enabled, or Google login / Forgot Password will fail with a
provider-disabled error.

### 4. Google Maps API key
1. [console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/google/maps-apis)
2. Enable **Maps JavaScript API** + **Geocoding API**
3. Create an API key, restrict it to your domain
4. Paste into `js/config.js` → `GOOGLE_MAPS_KEY`

Without this key, the Maps picker shows a friendly error but GPS location
still works independently (falls back to raw coordinates).

### 5. JazzCash / EasyPaisa numbers
Login as Admin → ⚙️ Settings → **Payment Methods** → enable
JazzCash/EasyPaisa/Bank, enter account numbers, Save.

---

## 🔥 Firebase structure

```
resellers/{rid}            → name, number, password, email, city, credits,
                                          active, photo, location{lat,lng,address}
reseller_requests/{id}   → same + photo, location (pending approval)
clients/{rid}/{uid}          → client records per reseller
master_users/{uid}         → global client lookup
products/{pid}                → marketplace listings
                                          {title, price, desc, category, image,
                                           sellerId, sellerName, status,
                                           edited_by_admin?}
settings/payment_methods → JazzCash/EasyPaisa/Bank details (admin-set)
chats/{rid}                     → reseller ↔ admin chat (text + ImgBB images)
r2r_chats/{ridA_ridB}     → reseller ↔ reseller chat
activity/{rid}                 → activity log per reseller
```

---

## 🚀 Deploy to Vercel

```bash
npm i -g vercel      # if not already installed
cd mi-reseller
vercel --prod
```

Or connect the folder in the Vercel dashboard — `vercel.json` is already
set up for clean static hosting, no build step required. After deploying,
update `robots.txt` and `sitemap.xml` with your real domain.
