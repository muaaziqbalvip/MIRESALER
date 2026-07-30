'use strict';
import { ref, set, get, update, remove, push, onValue } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { DEFAULT_PAYMENT_METHODS, ADMIN_EMAIL } from './config.js';
import { db, googleLogin, watchAuthState, logout as authLogout } from './auth.js';
import { uploadToImgBB } from './imgbb.js';
import { mountLocationPicker, getGPSLocation } from './location-picker.js';
import { groqChat } from './groq-ai.js';
import './pwa-install.js';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---- Real auth gate ----
// Google Sign-In (matched against ADMIN_EMAIL) is now the ACTUAL access
// control — a real Firebase Auth session, checked on every load via
// onAuthStateChanged. The 4-digit PIN below is only a fast local re-lock
// for convenience on a device that's already authenticated; it can never
// grant access on its own.
const PIN_KEY = 'mi_admin_pin_v1';
let savedPIN = localStorage.getItem(PIN_KEY) || '1234';
let pBuf = '', RES = {}, CLIENTS = {}, REQS = {}, PRODUCTS = {}, chatWith = null, chatUnsub = null;
let aiHistoryMini = [], aiHistoryLong = [], aiModel = 'mini';
let paymentMethods = JSON.parse(JSON.stringify(DEFAULT_PAYMENT_METHODS));
let adminAuthed = false; // true only once Firebase confirms the real admin session

// ---- Theme ----
const THEME_NAMES = { 't-green': 'Mi Green', 't-royal': 'Royal Purple', 't-ocean': 'Deep Ocean', 't-rose': 'Rose Fire', 't-gold': 'Gold' };
window.setTheme = t => { document.body.className = t; localStorage.setItem('mi_theme', t); document.querySelectorAll('.th-d').forEach(b => b.classList.toggle('on', b?.dataset?.t === t)); const el = document.getElementById('thNm'); if (el) el.textContent = THEME_NAMES[t] || t; };
window.setTheme(localStorage.getItem('mi_theme') || 't-green');

// ---- Toast ----
window.showToast = function (msg, type, ms) {
  const c = document.getElementById('toasts'), t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.innerHTML = '<span>' + ({ ok: '✅', err: '❌', info: 'ℹ️' }[type] || '•') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  playSound?.(type === 'ok' ? 'success' : type === 'err' ? 'error' : 'notify');
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms || 3000);
};
function toast(msg, type, ms) { window.showToast(msg, type, ms); }

window.oM = id => { playSound?.('click'); document.getElementById(id).classList.add('on'); };
window.cM = id => document.getElementById(id).classList.remove('on');
document.querySelectorAll('.mo-ov').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); }));

function esc(s) { const d = document.createElement('div'); d.appendChild(document.createTextNode(String(s ?? ''))); return d.innerHTML; }
function tAgo(ms) { if (!ms) return '—'; const d = Date.now() - ms, m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dd = Math.floor(d / 86400000); if (m < 1) return 'Abhi'; if (m < 60) return m + 'm'; if (h < 24) return h + 'h'; return dd + 'd'; }
function tFull(ms) { if (!ms) return '—'; return new Date(ms).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function gUID(p) { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return (p || 'RES') + '-' + r; }
window.arSz = el => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 88) + 'px'; };
window.cpTxt = (t, b) => { navigator.clipboard.writeText(t).then(() => { toast('📋 Copied!', 'ok', 1800); if (b) { const o = b.innerHTML; b.innerHTML = '✅'; b.classList.add('done'); setTimeout(() => { b.innerHTML = o; b.classList.remove('done'); }, 2000); } }).catch(() => toast('Copy error', 'err')); };

// ============ REAL AUTH STATE (Google Sign-In, admin-only) ============
// This is the actual gate: watchAuthState fires on every load/refresh with
// the current Firebase session (or null). Only a confirmed admin session
// unlocks the PIN screen's PIN-entry path at all — the PIN never works
// without this having fired true first.
const pinScreen = document.getElementById('pinOv');
watchAuthState((session, fbUser) => {
  if (session && session.role === 'admin') {
    adminAuthed = true;
    document.getElementById('perr').textContent = '';
    // Already-authenticated admin returning: show PIN quick-unlock instead
    // of forcing Google popup again (their Firebase session is still valid).
    if (!pinScreen.classList.contains('unlocked-once')) {
      pinScreen.classList.add('on');
    }
  } else {
    adminAuthed = false;
    pinScreen.classList.add('on');
    document.getElementById('perr').textContent = fbUser ? '⚠️ Yeh Google account admin nahi he.' : '';
  }
});

// ============ PIN (local quick-unlock, only meaningful after real auth) ============
const PK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
document.getElementById('pgrid').innerHTML = PK_KEYS.map(k => `<button class="pk${k === '⌫' ? ' del' : k === '✓' ? ' ok' : ''}" data-k="${k}">${k}</button>`).join('');
document.getElementById('pgrid').addEventListener('click', e => { const k = e.target.closest('.pk')?.dataset.k; if (k) doPIN(k); });
function doPIN(k) { playSound('pin'); if (k === '⌫') pBuf = pBuf.slice(0, -1); else if (k === '✓') { chkPIN(); return; } else if (pBuf.length < 4) pBuf += k; updDots(); if (pBuf.length === 4) setTimeout(chkPIN, 120); }
function updDots() { for (let i = 0; i < 4; i++) { const d = document.getElementById('pd' + i); if (d) { d.classList.toggle('on', i < pBuf.length); d.classList.remove('er'); } } }
function chkPIN() {
  if (!adminAuthed) { playSound('pinWrong'); document.getElementById('perr').textContent = '❌ Pehle Google se admin login karein.'; pBuf = ''; updDots(); return; }
  if (pBuf === savedPIN) { playSound('pinOk'); pinScreen.classList.remove('on'); pinScreen.classList.add('unlocked-once'); initAdmin(); }
  else { playSound('pinWrong'); for (let i = 0; i < 4; i++) { const d = document.getElementById('pd' + i); if (d) { d.classList.add('er'); d.classList.remove('on'); } } document.getElementById('perr').textContent = '❌ Galat PIN'; pBuf = ''; setTimeout(() => { updDots(); document.getElementById('perr').textContent = ''; }, 1200); }
}
window.changePIN = () => { const np = document.getElementById('set_pin').value.trim(); if (np.length !== 4 || isNaN(np)) { toast('4 digit PIN daalo', 'err'); return; } savedPIN = np; localStorage.setItem(PIN_KEY, np); toast('✅ PIN updated!', 'ok'); document.getElementById('set_pin').value = ''; cM('moSet'); };

window.doGoogleAdminLogin = async () => {
  try {
    const user = await googleLogin();
    if (user.email === ADMIN_EMAIL) {
      adminAuthed = true; playSound('pinOk');
      pinScreen.classList.remove('on'); pinScreen.classList.add('unlocked-once');
      toast('✅ Welcome Admin Muaaz!', 'ok', 2000);
      setTimeout(initAdmin, 300);
    } else {
      playSound('pinWrong');
      toast('❌ Sirf admin email allowed. Yeh account admin nahi he.', 'err', 3500);
      document.getElementById('perr').textContent = '⚠️ Sirf admin Google account allowed.';
    }
  } catch (e) { playSound('error'); toast('Google error: ' + e.message, 'err'); }
};

window.doAdminLogout = () => { playSound('logout'); authLogout(); adminAuthed = false; setTimeout(() => location.reload(), 200); };

// ============ INIT ============
async function initAdmin() {
  document.getElementById('ldr').classList.add('hide');
  const ck = () => document.getElementById('clk').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  ck(); setInterval(ck, 30000);
  window.addEventListener('online', () => document.getElementById('netDot').style.background = 'var(--gr2)');
  window.addEventListener('offline', () => document.getElementById('netDot').style.background = 'var(--r)');

  onValue(ref(db, 'resellers'), s => { RES = s.val() || {}; updHome(); rndRes(); buildRselBtns(); updMonitor(); });
  onValue(ref(db, 'master_users'), s => { CLIENTS = s.val() || {}; updHome(); updMonitor(); });
  onValue(ref(db, 'reseller_requests'), s => { REQS = s.val() || {}; updHome(); rndReqs(); rndDashReqs(); updRDot(); });
  onValue(ref(db, 'products'), s => { PRODUCTS = s.val() || {}; updHome(); rndProdAdmin(); });
  onValue(ref(db, 'settings/payment_methods'), s => { if (s.exists()) { paymentMethods = s.val(); fillPaymentForm(); } });

  addAIMsg("Assalam o Alaikum Admin Muaaz! Main **Mi AI** hoon 🧠\nReseller management, marketplace, analytics — kuch bhi poochho!");
}

// ============ HOME STATS ============
function updHome() {
  const rc = Object.keys(RES).length, cc = Object.keys(CLIENTS).length;
  const paid = Object.values(CLIENTS).filter(c => c.status === 'Paid').length;
  const pReq = Object.values(REQS).filter(r => r.status === 'pending').length;
  const prodCount = Object.values(PRODUCTS).filter(p => p.status !== 'removed').length;
  const sellerCount = new Set(Object.values(PRODUCTS).filter(p => p.status !== 'removed').map(p => p.sellerId)).size;
  document.getElementById('hR').textContent = rc; document.getElementById('hC').textContent = cc;
  document.getElementById('hP').textContent = paid; document.getElementById('hRQ').textContent = pReq;
  document.getElementById('hProd').textContent = prodCount; document.getElementById('hSellers').textContent = sellerCount;
  document.getElementById('hRevM').textContent = 'Rs ' + (paid * 300).toLocaleString();
  document.getElementById('hRevS').textContent = 'Rs ' + (cc * 100).toLocaleString();
  document.getElementById('hRevT').textContent = 'Rs ' + (paid * 300 + cc * 100).toLocaleString();
  let topRid = null, topCnt = 0;
  Object.entries(RES).forEach(([rid]) => { const cnt = Object.values(CLIENTS).filter(c => c.reseller_id === rid).length; if (cnt > topCnt) { topCnt = cnt; topRid = rid; } });
  if (topRid && topCnt > 0) { const r = RES[topRid]; document.getElementById('topResCard').style.display = 'block'; document.getElementById('topResNm').textContent = r.name || topRid; document.getElementById('topResSub').textContent = (r.number || '') + (r.city ? ' · ' + r.city : '') + ' — ' + topCnt + ' clients'; }
}
function updRDot() { const n = Object.values(REQS).filter(r => r.status === 'pending').length; const d = document.getElementById('rdot'); if (d) d.style.display = n > 0 ? 'block' : 'none'; }

function updMonitor() {
  const rc = Object.keys(RES).length, cc = Object.keys(CLIENTS).length, paid = Object.values(CLIENTS).filter(c => c.status === 'Paid').length, rate = cc > 0 ? Math.round(paid / cc * 100) : 0;
  document.getElementById('monCard').innerHTML = `
    <div class="mon-row"><div style="flex:1"><div style="font-size:0.78rem;font-weight:600">Resellers</div><div class="mbar"><div class="mbar-fill" style="width:${Math.min(rc * 10, 100)}%"></div></div></div><div style="font-family:'Orbitron',monospace;font-size:0.9rem;color:var(--g)">${rc}</div></div>
    <div class="mon-row"><div style="flex:1"><div style="font-size:0.78rem;font-weight:600">Total Clients</div><div class="mbar"><div class="mbar-fill" style="width:${Math.min(cc * 4, 100)}%"></div></div></div><div style="font-family:'Orbitron',monospace;font-size:0.9rem;color:var(--c)">${cc}</div></div>
    <div class="mon-row"><div style="flex:1"><div style="font-size:0.78rem;font-weight:600">Paid Clients</div><div class="mbar"><div class="mbar-fill" style="width:${rate}%;background:linear-gradient(90deg,var(--g3),var(--gr2))"></div></div></div><div style="font-family:'Orbitron',monospace;font-size:0.9rem;color:var(--gr2)">${paid}</div></div>
    <div class="mon-row"><div><div style="font-size:0.78rem;font-weight:600">Paid Rate</div></div><div style="font-family:'Orbitron',monospace;font-size:0.9rem;color:var(--p)">${rate}%</div></div>
    <div class="mon-row"><div><div style="font-size:0.78rem;font-weight:600">Monthly Revenue</div></div><div style="font-family:'Orbitron',monospace;font-size:0.88rem;color:var(--g)">Rs ${(paid * 300).toLocaleString()}</div></div>
    <div class="mon-row"><div><div style="font-size:0.78rem;font-weight:600">Total Estimated</div></div><div style="font-family:'Orbitron',monospace;font-size:0.88rem;color:var(--g2)">Rs ${(paid * 300 + cc * 100).toLocaleString()}</div></div>`;
  const tops = Object.entries(RES).map(([rid, r]) => { const cnt = Object.values(CLIENTS).filter(c => c.reseller_id === rid).length; return { rid, r, cnt }; }).sort((a, b) => b.cnt - a.cnt).slice(0, 8);
  const tEl = document.getElementById('topList');
  if (!tops.length) { tEl.innerHTML = '<div class="empty"><div class="empty-i">📊</div><div>Koi reseller nahi</div></div>'; return; }
  tEl.innerHTML = tops.map(({ rid, r, cnt }, i) => `<div class="cli" style="animation-delay:${i * 0.04}s" onclick="openRD('${rid}')">
    <div class="cav cav-g" style="font-family:'Orbitron',monospace;font-size:0.7rem;font-weight:700;color:#04150a">${i + 1}</div>
    <div class="cinf"><div class="cnm">${esc(r.name || '—')}</div><div class="csub">${esc(r.number || '—')}${r.city ? ' · ' + esc(r.city) : ''}</div></div>
    <div class="cright"><span style="font-family:'Orbitron',monospace;font-size:0.82rem;color:var(--g)">${cnt}</span><span style="font-size:0.62rem;color:var(--t3)">clients</span></div></div>`).join('');
}

function rndDashReqs() {
  const el = document.getElementById('dashReqs');
  const pend = Object.entries(REQS).filter(([, r]) => r.status === 'pending').slice(0, 4);
  if (!pend.length) { el.innerHTML = '<div class="empty"><div class="empty-i">✅</div><div>Koi pending nahi</div></div>'; return; }
  el.innerHTML = pend.map(([id, r], i) => `<div class="cli" style="animation-delay:${i * 0.04}s">
    <div class="cav cav-c" style="${r.photo ? `background-image:url('${esc(r.photo)}')` : ''}">${r.photo ? '' : '📬'}</div>
    <div class="cinf"><div class="cnm">${esc(r.name || '—')}</div><div class="csub">${esc(r.phone || '—')}${r.city ? ' · ' + esc(r.city) : ''}${r.email ? ' · ' + esc(r.email) : ''}</div></div>
    <div class="cright"><button class="btn bg-green bsm" onclick="apReq('${id}')">✅</button><button class="btn bg-red bsm" onclick="rjReq('${id}')">❌</button></div></div>`).join('');
}

// ============ RESELLERS ============
window.filterRes = rndRes;
function rndRes() {
  const el = document.getElementById('resList');
  const filter = (document.getElementById('resFilter')?.value || '').toLowerCase();
  let e = Object.entries(RES);
  if (filter) e = e.filter(([, r]) => (r.name || '').toLowerCase().includes(filter) || (r.number || '').includes(filter));
  if (!e.length) { el.innerHTML = '<div class="empty"><div class="empty-i">👤</div><div>Koi reseller nahi</div></div>'; return; }
  el.innerHTML = e.map(([rid, r], i) => {
    const cc = Object.values(CLIENTS).filter(c => c.reseller_id === rid).length;
    const active = r.active !== false;
    return `<div class="cli" style="animation-delay:${i * 0.04}s" onclick="openRD('${rid}')">
      <div class="cav ${active ? 'cav-g' : 'cav-r'}" style="${r.photo ? `background-image:url('${esc(r.photo)}')` : ''}">${r.photo ? '' : (active ? '🧑‍💼' : '🚫')}</div>
      <div class="cinf"><div class="cnm">${esc(r.name || '—')}</div><div class="csub">${esc(r.number || '—')} · ${cc} clients${r.city ? ' · ' + esc(r.city) : ''}</div></div>
      <div class="cright">
        <span class="badge ${active ? 'bp' : 'bb'}">${active ? 'Active' : 'Off'}</span>
        <div style="display:flex;gap:.3rem;margin-top:.15rem">
          ${r.location ? `<button class="btn bg-ghost bsm" onclick="event.stopPropagation();viewResLocation('${rid}')">📍</button>` : ''}
          <button class="btn bg-ghost bsm" onclick="event.stopPropagation();chatTo('${rid}','${esc(r.name || rid)}')">💬</button>
          <button class="btn bg-orange bsm" onclick="event.stopPropagation();openEdit('${rid}')">✏️</button>
        </div>
      </div></div>`;
  }).join('');
}

window.viewResLocation = async function (rid) {
  const r = RES[rid]; if (!r?.location) { toast('Location set nahi', 'info'); return; }
  oM('moRLoc');
  document.getElementById('rLocAddr').textContent = '📍 ' + (r.location.address || '');
  await mountLocationPicker(document.getElementById('mapRLocBox'), r.location, () => {});
};

window.openRD = function (rid) {
  const r = RES[rid]; if (!r) return;
  const cc = Object.values(CLIENTS).filter(c => c.reseller_id === rid);
  const active = r.active !== false, paid = cc.filter(c => c.status === 'Paid').length;
  document.getElementById('moRDB').innerHTML = `
    ${r.photo ? `<div style="text-align:center;margin-bottom:1rem"><img src="${esc(r.photo)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--bdg)"></div>` : ''}
    <div class="dr"><div class="dl">Name</div><div class="dv">${esc(r.name || '—')}</div></div>
    <div class="dr"><div class="dl">Phone</div><div class="dv">${esc(r.number || '—')}</div></div>
    <div class="dr"><div class="dl">Password</div><div class="dv mono">${esc(r.password || '—')}</div></div>
    <div class="dr"><div class="dl">Email</div><div class="dv">${esc(r.email || '—')}</div></div>
    <div class="dr"><div class="dl">City</div><div class="dv">${esc(r.city || '—')}</div></div>
    <div class="dr"><div class="dl">Location</div><div class="dv">${r.location ? `<span style="color:var(--bl);cursor:pointer" onclick="viewResLocation('${rid}')">📍 ${esc(r.location.address)}</span>` : '—'}</div></div>
    <div class="dr"><div class="dl">ID</div><div class="dv mono" style="font-size:0.72rem">${rid}</div></div>
    <div class="dr"><div class="dl">Credits</div><div class="dv" style="color:var(--c)">${r.credits || 0}</div></div>
    <div class="dr"><div class="dl">Clients</div><div class="dv">${cc.length} total · ${paid} paid</div></div>
    <div class="dr"><div class="dl">Revenue</div><div class="dv" style="color:var(--g);font-family:'Orbitron',monospace;font-size:0.78rem">Rs ${(paid * 300 + cc.length * 100).toLocaleString()}</div></div>
    <div class="dr"><div class="dl">Status</div><div class="dv"><span class="badge ${active ? 'bp' : 'bb'}">${active ? '✅ Active' : '🚫 Off'}</span></div></div>
    <div class="dr"><div class="dl">Joined</div><div class="dv" style="font-size:0.78rem;color:var(--t2)">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-PK') : '—'}</div></div>
    <div style="margin-top:0.65rem">
      <div style="font-family:'Orbitron',monospace;font-size:0.52rem;letter-spacing:2px;color:var(--t2);margin-bottom:0.4rem">CLIENT LIST (${cc.length})</div>
      ${cc.slice(0, 6).map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid var(--bd);font-size:0.78rem"><span>${esc(c.name || '—')}</span><span class="badge ${c.status === 'Paid' ? 'bp' : 'bb'}">${c.status}</span></div>`).join('') || '<div style="font-size:0.76rem;color:var(--t2)">Koi client nahi</div>'}
      ${cc.length > 6 ? `<div style="font-size:0.7rem;color:var(--t3);padding-top:0.3rem">+${cc.length - 6} more</div>` : ''}
    </div>`;
  document.getElementById('moRDF').innerHTML = `
    <button class="btn bg-ghost bsm" onclick="cM('moRD')">Close</button>
    <button class="btn bg-orange bsm" onclick="openEdit('${rid}');cM('moRD')">✏️ Edit</button>
    <button class="btn ${active ? 'bg-red' : 'bg-green'} bsm" onclick="togRes('${rid}',${active})">${active ? 'Block' : 'Enable'}</button>
    <button class="btn bg-ghost bsm" onclick="chatTo('${rid}','${esc(r.name || rid)}');cM('moRD')">💬 Chat</button>
    <button class="btn bg-red bsm" onclick="delRes('${rid}','${esc(r.name || '')}')">🗑</button>`;
  oM('moRD');
};

window.openEdit = function (rid) {
  const r = RES[rid]; if (!r) return;
  document.getElementById('er_n').value = r.name || ''; document.getElementById('er_p').value = r.number || '';
  document.getElementById('er_em').value = r.email || ''; document.getElementById('er_c').value = r.city || '';
  document.getElementById('er_w').value = ''; document.getElementById('er_cr').value = r.credits || 0;
  document.getElementById('er_st').value = String(r.active !== false);
  document.getElementById('er_id').value = rid; oM('moER');
};

window.saveEditRes = async function () {
  const rid = document.getElementById('er_id').value;
  const n = document.getElementById('er_n').value.trim(), p = document.getElementById('er_p').value.trim();
  const em = document.getElementById('er_em').value.trim(), c = document.getElementById('er_c').value.trim();
  const w = document.getElementById('er_w').value.trim(), cr = parseInt(document.getElementById('er_cr').value) || 0;
  const act = document.getElementById('er_st').value === 'true';
  const eEl = document.getElementById('erE'), btn = document.getElementById('erBtn');
  if (!n || !p) { eEl.textContent = 'Naam aur phone zaroori.'; eEl.classList.add('on'); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spin-sm"></span>Saving...';
  try { const upd = { name: n, number: p, email: em, city: c, credits: cr, active: act, updated_at: Date.now() }; if (w.length >= 4) upd.password = w; await update(ref(db, 'resellers/' + rid), upd); toast('✅ Reseller updated!', 'ok'); cM('moER'); eEl.classList.remove('on'); }
  catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
  btn.disabled = false; btn.innerHTML = '💾 Save';
};

window.addRes = async function () {
  const n = document.getElementById('ar_n').value.trim(), p = document.getElementById('ar_p').value.trim(), c = document.getElementById('ar_c').value.trim(), w = document.getElementById('ar_w').value.trim(), em = document.getElementById('ar_em').value.trim(), cr = parseInt(document.getElementById('ar_cr').value) || 50;
  const eEl = document.getElementById('arE'), btn = document.getElementById('arBtn');
  if (!n || !p || !w) { eEl.textContent = 'Naam, phone, password zaroori.'; eEl.classList.add('on'); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spin-sm"></span>Adding...';
  try {
    const rid = gUID('RES');
    await set(ref(db, 'resellers/' + rid), { name: n, number: p, email: em, city: c, password: w, credits: cr, active: true, created_at: Date.now() });
    playSound('success'); toast('✅ ' + n + ' added! ID: ' + rid, 'ok', 5000); cM('moAR');
    ['ar_n', 'ar_p', 'ar_c', 'ar_w', 'ar_em'].forEach(id => document.getElementById(id).value = ''); eEl.classList.remove('on');
  } catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
  btn.disabled = false; btn.innerHTML = '✅ Add';
};

window.togRes = async (rid, cur) => { await update(ref(db, 'resellers/' + rid), { active: !cur }); toast('Reseller ' + (cur ? 'blocked' : 'enabled') + '.', 'info'); cM('moRD'); };
window.delRes = async (rid, nm) => { if (!confirm((nm || rid) + ' delete karein?')) return; await remove(ref(db, 'resellers/' + rid)); toast('Deleted.', 'info'); cM('moRD'); playSound('error'); };

// ============ REQUESTS ============
function rndReqs() {
  const el = document.getElementById('reqList');
  const e = Object.entries(REQS).reverse();
  if (!e.length) { el.innerHTML = '<div class="empty"><div class="empty-i">✅</div><div>Koi request nahi</div></div>'; return; }
  el.innerHTML = e.map(([id, r], i) => `<div class="cli" style="animation-delay:${i * 0.04}s">
    <div class="cav cav-c" style="${r.photo ? `background-image:url('${esc(r.photo)}')` : ''}">${r.photo ? '' : '📬'}</div>
    <div class="cinf"><div class="cnm">${esc(r.name || '—')}</div><div class="csub">${esc(r.phone || '—')}${r.city ? ' · ' + esc(r.city) : ''}${r.email ? ' · ' + esc(r.email) : ''}</div>
      ${r.location ? `<div class="csub" style="color:var(--bl)">📍 ${esc(r.location.address || '')}</div>` : ''}
      <div class="csub" style="font-size:0.64rem;color:var(--t3)">${tFull(r.requested_at)}</div></div>
    <div class="cright"><span class="badge ${r.status === 'approved' ? 'bp' : r.status === 'pending' ? 'bpend' : 'bb'}">${r.status}</span>
    ${r.status === 'pending' ? `<div style="display:flex;gap:0.3rem;margin-top:0.2rem"><button class="btn bg-green bsm" onclick="apReq('${id}')">✅</button><button class="btn bg-red bsm" onclick="rjReq('${id}')">❌</button></div>` : ''}</div></div>`).join('');
}
window.apReq = async id => {
  const r = REQS[id]; if (!r) return;
  const rid = gUID('RES');
  await set(ref(db, 'resellers/' + rid), { name: r.name, number: r.phone, email: r.email || '', city: r.city || '', password: r.password, photo: r.photo || '', location: r.location || null, credits: 50, active: true, created_at: Date.now() });
  await update(ref(db, 'reseller_requests/' + id), { status: 'approved', reseller_id: rid, approved_at: Date.now() });
  playSound('success'); toast('✅ ' + r.name + ' approved! ID: ' + rid, 'ok', 6000);
};
window.rjReq = async id => { if (!confirm('Reject karein?')) return; await update(ref(db, 'reseller_requests/' + id), { status: 'rejected' }); toast('Rejected.', 'info'); };

// ============ MARKETPLACE MODERATION ============
let prodFilterTxt = '';
window.filterProd = () => { prodFilterTxt = document.getElementById('prodFilter').value.toLowerCase(); rndProdAdmin(); };
function rndProdAdmin() {
  const el = document.getElementById('prodAdminList');
  let e = Object.entries(PRODUCTS).filter(([, p]) => p.status !== 'removed');
  if (prodFilterTxt) e = e.filter(([, p]) => (p.title || '').toLowerCase().includes(prodFilterTxt) || (p.sellerName || '').toLowerCase().includes(prodFilterTxt));
  e.sort((a, b) => (b[1].created_at || 0) - (a[1].created_at || 0));
  if (!e.length) { el.innerHTML = '<div class="empty"><div class="empty-i">🛍️</div><div>Koi listing nahi</div></div>'; return; }
  el.innerHTML = e.map(([pid, p], i) => `<div class="cli" style="animation-delay:${i * 0.04}s" onclick="openProdAdmin('${pid}')">
    <div class="cav cav-g" style="${p.image ? `background-image:url('${esc(p.image)}')` : ''}">${p.image ? '' : '🛍️'}</div>
    <div class="cinf"><div class="cnm">${esc(p.title)}</div><div class="csub">Rs ${Number(p.price).toLocaleString()} · ${esc(p.sellerName || '—')}</div></div>
    <div class="cright"><span class="badge bp">Active</span></div></div>`).join('');
}
window.openProdAdmin = function (pid) {
  const p = PRODUCTS[pid]; if (!p) return;
  document.getElementById('moProdAB').innerHTML = `
    ${p.image ? `<img src="${esc(p.image)}" style="width:100%;border-radius:12px;margin-bottom:1rem;max-height:220px;object-fit:cover">` : ''}
    <div class="dr"><div class="dl">Title</div><div class="dv">${esc(p.title)}</div></div>
    <div class="dr"><div class="dl">Price</div><div class="dv" style="color:var(--g);font-weight:700">Rs ${Number(p.price).toLocaleString()}</div></div>
    <div class="dr"><div class="dl">Category</div><div class="dv">${esc(p.category || '—')}</div></div>
    <div class="dr"><div class="dl">Details</div><div class="dv" style="color:var(--t2)">${esc(p.desc || '—')}</div></div>
    <div class="dr"><div class="dl">Seller</div><div class="dv">${esc(p.sellerName || '—')}</div></div>
    <div class="dr"><div class="dl">Posted</div><div class="dv" style="font-size:0.78rem;color:var(--t2)">${tFull(p.created_at)}</div></div>`;
  document.getElementById('moProdAF').innerHTML = `<button class="btn bg-ghost bsm" onclick="cM('moProdA')">Close</button><button class="btn bg-orange bsm" onclick="openAdminProductEdit('${pid}')">✏️ Edit</button><button class="btn bg-red bsm" onclick="adminRemoveProduct('${pid}')">🗑 Remove</button>`;
  oM('moProdA');
};
window.adminRemoveProduct = async function (pid) {
  if (!confirm('Yeh listing remove karein?')) return;
  await update(ref(db, 'products/' + pid), { status: 'removed', removed_by: 'admin', removed_at: Date.now() });
  toast('Listing removed.', 'info'); playSound('error'); cM('moProdA');
};

// ---- Admin FULL EDIT of any reseller's listing (title/price/desc/category/image) ----
let peImgUrl = '';
function wirePeImgUpload() {
  const box = document.getElementById('peImgUp');
  if (box.dataset.wired) return; // only wire the file input once
  box.dataset.wired = '1';
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  box.appendChild(input);
  box.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    const localUrl = URL.createObjectURL(file);
    let img = box.querySelector('img');
    if (!img) { img = document.createElement('img'); box.appendChild(img); }
    img.src = localUrl;
    const span = box.querySelector('span'); if (span) span.style.display = 'none';
    try {
      const res = await uploadToImgBB(file);
      peImgUrl = res.url;
      toast('✅ Image updated!', 'ok', 1600); playSound('upload');
    } catch (e) { toast('❌ ' + e.message, 'err', 2500); }
  });
}
window.openAdminProductEdit = function (pid) {
  const p = PRODUCTS[pid]; if (!p) return;
  cM('moProdA');
  wirePeImgUpload();
  document.getElementById('pe_id').value = pid;
  document.getElementById('pe_title').value = p.title || '';
  document.getElementById('pe_price').value = p.price || '';
  document.getElementById('pe_desc').value = p.desc || '';
  document.getElementById('pe_cat').value = p.category || 'Other';
  document.getElementById('pe_seller').value = (p.sellerName || '—') + ' (' + (p.sellerId || '—') + ')';
  peImgUrl = p.image || '';
  const box = document.getElementById('peImgUp');
  let img = box.querySelector('img');
  if (peImgUrl) { if (!img) { img = document.createElement('img'); box.appendChild(img); } img.src = peImgUrl; const span = box.querySelector('span'); if (span) span.style.display = 'none'; }
  else { if (img) img.remove(); const span = box.querySelector('span'); if (span) span.style.display = 'flex'; }
  document.getElementById('peErr').classList.remove('on');
  oM('moProdE');
};
window.saveAdminProductEdit = async function () {
  const pid = document.getElementById('pe_id').value;
  const title = document.getElementById('pe_title').value.trim();
  const price = parseFloat(document.getElementById('pe_price').value);
  const desc = document.getElementById('pe_desc').value.trim();
  const cat = document.getElementById('pe_cat').value;
  const eEl = document.getElementById('peErr'); eEl.classList.remove('on');
  if (!title || !price) { eEl.textContent = '⚠️ Title aur price zaroori.'; eEl.classList.add('on'); playSound('error'); return; }
  try {
    await update(ref(db, 'products/' + pid), { title, price, desc, category: cat, image: peImgUrl, edited_by_admin: true, updated_at: Date.now() });
    playSound('success'); toast('✅ Listing admin ne update kar di!', 'ok'); cM('moProdE');
  } catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
};

// ============ PAYMENT METHODS SETTINGS ============
function fillPaymentForm() {
  document.getElementById('pm_jc_on').checked = !!paymentMethods.jazzcash?.enabled;
  document.getElementById('pm_jc_num').value = paymentMethods.jazzcash?.number || '';
  document.getElementById('pm_jc_name').value = paymentMethods.jazzcash?.name || '';
  document.getElementById('pm_ep_on').checked = !!paymentMethods.easypaisa?.enabled;
  document.getElementById('pm_ep_num').value = paymentMethods.easypaisa?.number || '';
  document.getElementById('pm_ep_name').value = paymentMethods.easypaisa?.name || '';
  document.getElementById('pm_bk_on').checked = !!paymentMethods.bank?.enabled;
  document.getElementById('pm_bk_bank').value = paymentMethods.bank?.bankName || '';
  document.getElementById('pm_bk_title').value = paymentMethods.bank?.accountTitle || '';
  document.getElementById('pm_bk_iban').value = paymentMethods.bank?.iban || '';
}
window.savePaymentMethods = async function () {
  const data = {
    jazzcash: { enabled: document.getElementById('pm_jc_on').checked, number: document.getElementById('pm_jc_num').value.trim(), name: document.getElementById('pm_jc_name').value.trim() },
    easypaisa: { enabled: document.getElementById('pm_ep_on').checked, number: document.getElementById('pm_ep_num').value.trim(), name: document.getElementById('pm_ep_name').value.trim() },
    bank: { enabled: document.getElementById('pm_bk_on').checked, bankName: document.getElementById('pm_bk_bank').value.trim(), accountTitle: document.getElementById('pm_bk_title').value.trim(), iban: document.getElementById('pm_bk_iban').value.trim() }
  };
  try { await set(ref(db, 'settings/payment_methods'), data); toast('✅ Payment methods saved!', 'ok'); playSound('success'); }
  catch (e) { toast('Error: ' + e.message, 'err'); playSound('error'); }
};
document.addEventListener('DOMContentLoaded', fillPaymentForm);

// ============ CHAT (Admin full control) ============
function buildRselBtns() {
  const el = document.getElementById('rselBtns');
  const e = Object.entries(RES);
  if (!e.length) { el.innerHTML = '<span style="font-size:0.72rem;color:var(--t2);padding:0.3rem 0.5rem">Koi reseller nahi</span>'; return; }
  el.innerHTML = e.map(([rid, r]) => `<button class="rsel-btn ${chatWith === rid ? 'on' : ''}" onclick="chatTo('${rid}','${esc(r.name || rid)}')">${esc(r.name || rid)}</button>`).join('');
}
window.chatTo = function (rid, name) {
  chatWith = rid;
  document.getElementById('chatHdrNm').textContent = name;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  document.querySelectorAll('.rsel-btn').forEach(b => b.classList.toggle('on', b.textContent === name));
  const el = document.getElementById('chatMsgs'); el.innerHTML = '';
  chatUnsub = onValue(ref(db, 'chats/' + rid), snap => {
    const msgs = []; snap.forEach(c => { const v = c.val(); v._key = c.key; msgs.push(v); }); msgs.sort((a, b) => a.ts - b.ts);
    el.innerHTML = '';
    if (!msgs.length) { el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:2.5rem;font-size:0.78rem">Pehla message bhejo 👋</div>'; return; }
    msgs.forEach(m => {
      const self = m.from === 'admin';
      const d = document.createElement('div'); d.className = 'msg' + (self ? ' self' : '');
      const chatPath = 'chats/' + rid + '/' + m._key;
      let content = `<div class="bubble">`;
      if (m.type === 'image' && m.url) { content += `<img src="${esc(m.url)}" class="chat-img" onclick="window.open('${esc(m.url)}','_blank')">`; }
      else if (m.type === 'voice' && m.url) { content += `<audio controls style="max-width:180px;height:28px"><source src="${esc(m.url)}"></audio>`; }
      else { content += esc(m.text || '').replace(/\n/g, '<br>'); }
      if (m.edited) content += `<span style="font-size:0.52rem;color:var(--t3);margin-left:4px">(edited)</span>`;
      content += `</div>`;
      content += `<div class="mmeta">${self ? 'Admin (Muaaz)' : 'Reseller'} · ${tAgo(m.ts)}</div>`;
      content += `<div class="msg-acts">
        <button class="ma-btn" onclick="openMsgEdit('${chatPath}','${esc((m.text || '').replace(/'/g, "\\'"))}')">✏️ Edit</button>
        <button class="ma-btn" onclick="quickDelMsg('${chatPath}')">🗑</button>
      </div>`;
      d.innerHTML = `<div class="mav ${self ? 'mav-g' : 'mav-c'}">${self ? '👑' : '🧑‍💼'}</div><div>${content}</div>`;
      el.appendChild(d);
    });
    el.scrollTop = el.scrollHeight;
  });
  gp('chat');
};
window.openMsgEdit = function (path, txt) {
  document.getElementById('em_path').value = path;
  document.getElementById('em_txt').value = txt.replace(/\\'/g, "'");
  document.getElementById('emE').classList.remove('on');
  oM('moEM');
};
window.saveMsgEdit = async function () {
  const path = document.getElementById('em_path').value;
  const txt = document.getElementById('em_txt').value.trim();
  const eEl = document.getElementById('emE');
  if (!txt) { eEl.textContent = 'Message khali nahi ho sakta.'; eEl.classList.add('on'); return; }
  try { await update(ref(db, path), { text: txt, edited: true, edited_at: Date.now() }); toast('✅ Message edited!', 'ok'); cM('moEM'); }
  catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); }
};
window.delMsg = async function () {
  const path = document.getElementById('em_path').value;
  if (!confirm('Message delete karein?')) return;
  try { await remove(ref(db, path)); toast('Message deleted.', 'info'); cM('moEM'); }
  catch (e) { toast('Error: ' + e.message, 'err'); }
};
window.quickDelMsg = async function (path) {
  if (!confirm('Delete?')) return;
  try { await remove(ref(db, path)); toast('Deleted.', 'info'); } catch (e) { toast('Error', 'err'); }
};
window.sChat = async () => {
  if (!chatWith) { toast('Reseller select karo.', 'info'); return; }
  const inp = document.getElementById('chatIn'), txt = inp.value.trim(); if (!txt) return;
  inp.value = ''; inp.style.height = 'auto'; playSound('send');
  await push(ref(db, 'chats/' + chatWith), { text: txt, from: 'admin', type: 'text', ts: Date.now() });
};
window.ckSend = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sChat(); } };
window.sendImg = async function () {
  const file = document.getElementById('imgUp').files[0]; if (!file || !chatWith) return;
  toast('📤 Upload ho raha he...', 'info');
  try {
    const res = await uploadToImgBB(file);
    await push(ref(db, 'chats/' + chatWith), { url: res.url, from: 'admin', type: 'image', ts: Date.now() });
    playSound('send'); toast('✅ Image bhaij di!', 'ok');
  } catch (e) { toast('❌ Image error: ' + e.message, 'err'); }
  document.getElementById('imgUp').value = '';
};

// ============ AI (mini/long model) ============
window.setAIModel = function (m) {
  aiModel = m; playSound('toggle');
  document.getElementById('mdl-mini').classList.toggle('on', m === 'mini');
  document.getElementById('mdl-long').classList.toggle('on', m === 'long');
  document.getElementById('aiModelLbl').textContent = m === 'mini' ? 'Groq · Mini Model (Fast)' : 'Groq · Long Model (Smart)';
};
function addAIMsg(text, self) {
  const el = document.getElementById('aiMsgs'), d = document.createElement('div'); d.className = 'msg' + (self ? ' self' : ' ai-m');
  d.innerHTML = `<div class="mav ${self ? 'mav-g' : 'mav-p'}">${self ? '👑' : '🧠'}</div><div><div class="bubble">${text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div></div>`;
  el.appendChild(d); el.scrollTop = el.scrollHeight; return d.querySelector('.bubble');
}
window.sAI = async function () {
  const inp = document.getElementById('aiIn'), txt = inp.value.trim(); if (!txt) return;
  inp.value = ''; inp.style.height = 'auto'; playSound('send'); addAIMsg(esc(txt), true);
  const hist = aiModel === 'mini' ? aiHistoryMini : aiHistoryLong;
  hist.push({ role: 'user', content: txt }); if (hist.length > 24) hist.splice(0, hist.length - 24);
  const el = document.getElementById('aiMsgs');
  const thD = document.createElement('div'); thD.className = 'msg ai-m';
  thD.innerHTML = '<div class="mav mav-p">🧠</div><div><div class="bubble"><div class="think"><span></span><span></span><span></span></div></div></div>';
  el.appendChild(thD); el.scrollTop = el.scrollHeight;
  const reply = await groqChat(hist.slice(-14), { model: aiModel });
  thD.remove(); addAIMsg(reply); hist.push({ role: 'assistant', content: reply }); playSound('receive');
};
window.clrAI = () => { aiHistoryMini = []; aiHistoryLong = []; document.getElementById('aiMsgs').innerHTML = ''; addAIMsg('Clear! Poochho kuch bhi 😊'); };
window.akSend = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sAI(); } };

// ============ NAV ============
window.gp = function (name) {
  playSound('nav');
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on')); document.querySelectorAll('.bni').forEach(b => b.classList.remove('on'));
  document.getElementById('pg-' + name)?.classList.add('on'); document.querySelector('.bni[data-pg="' + name + '"]')?.classList.add('on');
  const sc = document.getElementById('scrl'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
};

window.addEventListener('load', () => setTimeout(() => document.getElementById('ldr').classList.add('hide'), 500));
