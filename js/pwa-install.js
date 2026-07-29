/* Mi Reseller Program — PWA install prompt handler (shared across pages) */
let deferredPrompt = null;
let installed = (window.matchMedia('(display-mode: standalone)').matches) || localStorage.getItem('mi_installed') === '1';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!installed) showBanner();
  const pwaBtn = document.getElementById('pwaBtn');
  if (pwaBtn) pwaBtn.disabled = false;
});

window.addEventListener('appinstalled', () => {
  installed = true;
  localStorage.setItem('mi_installed', '1');
  hideBanner();
  const ok = document.getElementById('pwaOk'), btn = document.getElementById('pwaBtn');
  if (ok) ok.style.display = 'block';
  if (btn) btn.style.display = 'none';
  window.showToast?.('✅ App install ho gayi!', 'ok', 2500);
});

function showBanner() {
  if (document.getElementById('pwaBanner') || installed) return;
  const b = document.createElement('div');
  b.className = 'pwa-banner'; b.id = 'pwaBanner';
  b.innerHTML = `<img src="assets/logo.png" alt="Mi Reseller"><div class="pt"><b>Mi Reseller Program Install Karein</b><span>Fast, offline-ready home screen app</span></div>
    <button class="btn bg-gold bsm" id="pwaBannerBtn">Install</button>
    <button class="btn bg-ghost bsm" id="pwaBannerClose" style="padding:.33rem .5rem">✕</button>`;
  document.body.appendChild(b);
  requestAnimationFrame(() => b.classList.add('show'));
  document.getElementById('pwaBannerBtn').onclick = () => { window.doInstall?.(); };
  document.getElementById('pwaBannerClose').onclick = () => hideBanner();
}
function hideBanner() {
  const b = document.getElementById('pwaBanner');
  if (b) { b.classList.remove('show'); setTimeout(() => b.remove(), 400); }
}

window.doInstall = async function () {
  playSound?.('click');
  if (!deferredPrompt) {
    window.showToast?.('ℹ️ Browser menu se "Add to Home Screen" try karein', 'info', 3000);
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') { playSound?.('success'); }
  deferredPrompt = null;
  hideBanner();
};

document.addEventListener('DOMContentLoaded', () => {
  const ok = document.getElementById('pwaOk'), btn = document.getElementById('pwaBtn');
  if (installed) {
    if (ok) ok.style.display = 'block';
    if (btn) btn.style.display = 'none';
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
