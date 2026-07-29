# 🟢 Mi Reseller Program

**JOIN · EARN · GROW**
Official reseller portal — Muslim Islam Org | Muaaz Iqbal (Kasur, Punjab, Pakistan)

Upgraded from MITV Reseller → **Mi Reseller Program**, full redesign + new features.

---

## 📁 Files

```
mi-reseller/
├── index.html              → Login / Register (Google login + phone/password)
├── dashboard.html           → Reseller app (clients, marketplace, chat, AI, profile)
├── admin.html                → Admin panel (resellers, requests, marketplace, monitor, chat, AI, settings)
├── manifest.json             → PWA manifest (installable app)
├── sw.js                       → Service worker (offline caching)
├── assets/logo.png       → Your uploaded Mi Reseller Program logo
├── css/theme.css            → Shared design system (5 themes: Green/Royal/Ocean/Rose/Gold)
└── js/
    ├── config.js              → ⚠️ ALL YOUR API KEYS GO HERE
    ├── sounds.js              → Touch/click sound effects (Web Audio)
    ├── imgbb.js                → Image upload helper (ImgBB)
    ├── groq-ai.js             → Mi AI chat (mini + long model, key rotation)
    ├── location-picker.js  → Google Maps location picker
    ├── pwa-install.js       → "Install App" banner + button logic
    ├── dashboard-app.js  → Full reseller dashboard logic
    └── admin-app.js         → Full admin panel logic
```

---

## ⚠️ IMPORTANT — Before you deploy

### 1. Groq API key — REGENERATE IT NOW
The key you shared in chat (`gsk_...`) is now public. **Go to
[console.groq.com/keys](https://console.groq.com/keys), revoke that key, and
generate a new one.** Then open `js/config.js` and paste it into `GROQ_KEYS`.
You can add multiple keys — the app rotates automatically when one hits its
rate limit:
```js
export const GROQ_KEYS = [
  "gsk_your_new_key_1",
  "gsk_your_new_key_2"   // optional, for rotation
];
```
This key stays visible in browser dev tools (client-side chat, as you asked
for) — regenerating keys occasionally and using Groq's free-tier limits as a
natural cap is the practical way to manage that risk.

### 2. ImgBB key — also regenerate
Same reason — the key you pasted in chat is public now. Get a fresh one at
[api.imgbb.com](https://api.imgbb.com/) and update `IMGBB_KEY` in `js/config.js`.

### 3. Firebase config
Firebase project is unchanged (`ramadan-2385b`), but the `apiKey`,
`messagingSenderId`, and `appId` fields are still placeholders — pull the real
values from your Firebase Console → Project Settings and paste into
`js/config.js` → `FB`.

### 4. Google Maps API key (new — needed for location picker)
1. Go to [console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/google/maps-apis)
2. Enable **Maps JavaScript API** + **Geocoding API**
3. Create an API key, restrict it to your domain
4. Paste into `js/config.js` → `GOOGLE_MAPS_KEY`

Without this key, the location picker shows a friendly error instead of
breaking the app — everything else still works.

### 5. JazzCash / EasyPaisa numbers
Login as Admin → ⚙️ Settings → scroll to **Payment Methods** → enable
JazzCash/EasyPaisa/Bank, enter your account numbers, Save. These numbers then
appear to every reseller under Profile → 💳 Payment.

---

## ✨ What's new vs the old MITV build

- **Full rebrand**: MITV Network → Mi Reseller Program, new green/black theme
  matching your uploaded logo, 5 selectable color themes
- **Google Login** for both resellers and admin (existing feature, kept & wired up)
- **ImgBB image upload** — reseller profile photos, marketplace product photos,
  chat images (replacing the old Firebase Storage image chat)
- **Google Maps location picker** — resellers set their location by tapping/
  dragging a pin (used at registration + profile + visible to Admin)
- **Marketplace** (brand new) — resellers can list products/services with
  photos + price, browse others' listings, contact sellers via WhatsApp;
  Admin can moderate/remove any listing
- **Mi AI — Mini/Long model switch** — fast model for quick answers, smart
  model (70B) for deep answers, both via Groq with automatic key rotation
- **JazzCash + EasyPaisa + Bank payment options** — Admin sets account
  details once in Settings, resellers see a ready "Payment Options" screen
  with one-tap copy
- **PWA install banner** — auto-prompts on both web and once "installed"
  works fully offline for cached pages via the service worker
- **Touch/click sounds** on virtually every interactive element (nav, buttons,
  PIN pad, chat send, uploads, theme toggle, deploy actions)
- Every "project" (Reseller Dashboard vs Admin Panel vs Login) keeps its own
  distinct branding/labeling exactly as requested — e.g. "Mi Reseller
  Program" label on login, "MI RESELLER" topbar on dashboard, "MI RESELLER
  ADMIN" topbar on admin panel

---

## 🔥 Firebase structure (unchanged, extended)

```
resellers/{rid}            → name, number, password, email, city, credits,
                                          active, photo, location{lat,lng,address}
reseller_requests/{id}   → same + photo, location (pending approval)
clients/{rid}/{uid}          → client records per reseller
master_users/{uid}         → global client lookup
products/{pid}                → NEW: marketplace listings
                                          {title, price, desc, category, image,
                                           sellerId, sellerName, status}
settings/payment_methods → NEW: JazzCash/EasyPaisa/Bank details (admin-set)
chats/{rid}                     → reseller ↔ admin chat
r2r_chats/{ridA_ridB}     → reseller ↔ reseller chat
activity/{rid}                 → activity log per reseller
```

No Firebase Storage needed anymore — chat images and product images both go
through ImgBB now, which is simpler and free.

---

## 🚀 Deploy

Any static host works (Vercel, Netlify, GitHub Pages, Firebase Hosting).
Just upload the whole `mi-reseller/` folder as-is — no build step required.
