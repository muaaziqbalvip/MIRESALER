'use strict';
import { ref, set, get, update, remove, push, onValue } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { DEFAULT_PAYMENT_METHODS } from './config.js';
import { db, watchAuthState, logout as authLogout } from './auth.js';
import { uploadToImgBB, wireImageUpload } from './imgbb.js';
import { mountLocationPicker, getGPSLocation } from './location-picker.js';
import { groqChat } from './groq-ai.js';
import './pwa-install.js';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---- Session check (real Firebase Auth session, with legacy phone/password fallback) ----
let SESSION = null, RID = null, RNAME = 'Reseller', sessionReady = false;
const bootPromise = new Promise((resolve) => {
  watchAuthState((session) => {
    if (!session || !session.id) { location.replace('index.html'); return; }
    if (session.role === 'admin') { location.replace('admin.html'); return; }
    SESSION = session; RID = SESSION.id; RNAME = SESSION.name || 'Reseller';
    if (!sessionReady) { sessionReady = true; resolve(); }
    else if (window.__miRefreshSessionUI) window.__miRefreshSessionUI();
  });
});

// ---- Theme ----
const THEME_NAMES = { 't-green': 'Mi Green', 't-royal': 'Royal Purple', 't-ocean': 'Deep Ocean', 't-rose': 'Rose Fire', 't-gold': 'Gold' };
window.setTheme = t => { document.body.className = t; localStorage.setItem('mi_theme', t); document.querySelectorAll('.th-d,.th-btn').forEach(b => b.classList.toggle('on', b?.dataset?.t === t)); const el = document.getElementById('themeLabel'); if (el) el.textContent = THEME_NAMES[t] || t; };
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
function gUID(p) { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)]; return (p || 'MIR') + '-' + r; }
window.arSz = el => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 88) + 'px'; };
window.cpTxt = (text, btn) => { navigator.clipboard.writeText(text).then(() => { toast('📋 Copy!', 'ok', 1800); if (btn) { const o = btn.innerHTML; btn.innerHTML = '✅'; btn.classList.add('done'); setTimeout(() => { btn.innerHTML = o; btn.classList.remove('done'); }, 2000); } }).catch(() => toast('Copy error', 'err')); };
function waPost(nm, ph, m3u, uid) { return `🌟 MI RESELLER PROGRAM 🌟\n✅ Account Active!\n\nAssalam o Alaikum!\n*${nm}* aapka account ready hai! 🎉\n\n👤 ${nm}\n📞 ${ph}\n🆔 ${uid}\n🔗 M3U:\n${m3u}\n\n🏢 MUSLIM ISLAM ORG | 👑 Muaaz Iqbal\nShukriya! ❤️`; }

// ============ PIN ============
// PIN key is per-reseller (RID), so it's set up once the real Firebase Auth
// session has resolved — see bootPromise.then() near the bottom of this file.
let PIN_K = null, pBuf = '', savedPIN = null;
const PK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
document.getElementById('pgrid').innerHTML = PK_KEYS.map(k => `<button class="pk${k === '⌫' ? ' del' : k === '✓' ? ' ok' : ''}" data-k="${k}">${k}</button>`).join('');
document.getElementById('pgrid').addEventListener('click', e => { const k = e.target.closest('.pk')?.dataset.k; if (k) doPIN(k); });
function doPIN(k) { playSound('pin'); if (k === '⌫') pBuf = pBuf.slice(0, -1); else if (k === '✓') { chkPIN(); return; } else if (pBuf.length < 4) pBuf += k; updDots(); if (pBuf.length === 4) setTimeout(chkPIN, 120); }
function updDots() { for (let i = 0; i < 4; i++) { const d = document.getElementById('pd' + i); if (d) { d.classList.toggle('on', i < pBuf.length); d.classList.remove('er'); } } }
function chkPIN() {
  if (pBuf === savedPIN) { playSound('pinOk'); document.getElementById('pinOv').classList.remove('on'); initApp(); }
  else { playSound('pinWrong'); for (let i = 0; i < 4; i++) { const d = document.getElementById('pd' + i); if (d) { d.classList.add('er'); d.classList.remove('on'); } } document.getElementById('perr').textContent = '❌ Galat PIN'; pBuf = ''; setTimeout(() => { updDots(); document.getElementById('perr').textContent = ''; }, 1200); }
}
window.skipP = () => { if (!savedPIN) { document.getElementById('pinOv').classList.remove('on'); initApp(); } };

// Once the real Firebase Auth session resolves, set up the per-reseller PIN
// gate and profile avatar wiring (both need RID/SESSION which aren't known
// until this point), then either show the PIN screen or boot straight in.
bootPromise.then(() => {
  PIN_K = 'mi_pin_' + RID;
  savedPIN = localStorage.getItem(PIN_K);
  wireProfileAvatarUpload();
  if (savedPIN) document.getElementById('pinOv').classList.add('on');
  else initApp();
});

// ============ STATE ============
let ALL = {}, aiHistoryMini = [], aiHistoryLong = [], aiModel = 'mini', clientFilter = 'all', chatMode = 'admin', chatWith = null, chatUnsub = null, lastMsgCount = 0, allResellers = {};
let ALL_PRODUCTS = {}, MY_PRODUCTS = {}, marketFilter = '';
let paymentMethods = DEFAULT_PAYMENT_METHODS;

async function initApp() {
  document.getElementById('ldr').classList.add('hide');
  document.getElementById('tbU').textContent = RNAME;
  document.getElementById('hWel').textContent = RNAME;
  document.getElementById('abN').textContent = RNAME;
  document.getElementById('abI').textContent = RID;
  document.getElementById('abP').textContent = SESSION.number || SESSION.phone || '—';
  document.getElementById('abEM').textContent = SESSION.email || '—';
  document.getElementById('abCR').textContent = SESSION.credits || '0';
  document.getElementById('stCR').textContent = SESSION.credits || '0';
  document.getElementById('abLoc').textContent = SESSION.location?.address || 'Set nahi';
  if (SESSION.photo) setAvatarImg(document.getElementById('aboutAvatar'), SESSION.photo);

  const ck = () => document.getElementById('hClk').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  ck(); setInterval(ck, 30000);
  window.addEventListener('online', () => document.getElementById('netDot').style.background = 'var(--gr2)');
  window.addEventListener('offline', () => document.getElementById('netDot').style.background = 'var(--r)');

  onValue(ref(db, 'resellers'), snap => { allResellers = snap.val() || {}; });
  onValue(ref(db, 'clients/' + RID), snap => { ALL = snap.val() || {}; updStats(); rndRecent(); rndAll(); updActivity(); });
  onValue(ref(db, 'products'), snap => { ALL_PRODUCTS = snap.val() || {}; rndMarket(); rndMyListings(); });
  onValue(ref(db, 'settings/payment_methods'), snap => { if (snap.exists()) paymentMethods = snap.val(); });

  initChat('admin');
  onValue(ref(db, 'chats/' + RID), snap => {
    const count = snap.size || 0;
    const newMsgs = count - lastMsgCount;
    if (newMsgs > 0 && lastMsgCount > 0) { const b = document.getElementById('chatBadge'); if (b) { b.textContent = newMsgs > 9 ? '9+' : newMsgs; b.style.display = 'flex'; playSound('receive'); } }
    lastMsgCount = count;
  });

  addAIMsg("Assalam o Alaikum! Main **Mi AI** hoon 🧠\nClient management, IPTV, marketplace, payments — kuch bhi poochho! ⚡ Mini model fast hai, Long model deep answers deta hai.");
}

// ============ PROFILE AVATAR ============
function setAvatarImg(box, url) {
  let img = box.querySelector('img');
  if (!img) { img = document.createElement('img'); box.insertBefore(img, box.firstChild); const span = box.querySelector('span'); if (span) span.style.display = 'none'; }
  img.src = url;
}
function wireProfileAvatarUpload() {
  wireImageUpload(document.getElementById('proAvatar'), async (url) => {
    setAvatarImg(document.getElementById('proAvatar'), url);
    setAvatarImg(document.getElementById('aboutAvatar'), url);
    await update(ref(db, 'resellers/' + RID), { photo: url, updated_at: Date.now() });
    SESSION.photo = url; localStorage.setItem('mi_s', JSON.stringify(SESSION)); sessionStorage.setItem('ms', JSON.stringify(SESSION));
  }, SESSION.photo);
}

// ============ PROFILE LOCATION ============
let proLocation = null, proMapMounted = false, proMapHandle = null;
window.openProLocation = async () => {
  window.oM('moLocPro');
  if (!proMapMounted) { proMapMounted = true; proMapHandle = await mountLocationPicker(document.getElementById('mapProBox'), SESSION.location, (pos) => { proLocation = pos; }); }
};
window.confirmProLocation = () => {
  if (proLocation) document.getElementById('proLocPreview').textContent = '📍 ' + proLocation.address;
  window.cM('moLocPro');
};
window.useGPSLocationPro = async () => {
  const btn = document.getElementById('gpsBtnPro');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin-sm"></span>GPS...'; }
  try {
    const pos = await getGPSLocation();
    proLocation = pos;
    document.getElementById('proLocPreview').textContent = '📍 ' + pos.address + ' (GPS)';
    playSound('success'); toast('✅ GPS location mil gayi!', 'ok', 2000);
    if (proMapHandle) proMapHandle.setPosition(pos);
  } catch (e) { playSound('error'); toast('❌ ' + e.message, 'err', 3000); }
  if (btn) { btn.disabled = false; btn.innerHTML = '📡 GPS Se'; }
};

// ============ STATS ============
function updStats() {
  const vs = Object.values(ALL), t = vs.length, p = vs.filter(c => c.status === 'Paid').length, b = t - p;
  const m = p * 300, tot = m + t * 100, rate = t > 0 ? Math.round(p / t * 100) : 0;
  document.getElementById('stT').textContent = t; document.getElementById('stP').textContent = p; document.getElementById('stB').textContent = b;
  document.getElementById('rM').textContent = 'Rs ' + m.toLocaleString(); document.getElementById('rS').textContent = 'Rs ' + (t * 100).toLocaleString(); document.getElementById('rT').textContent = 'Rs ' + tot.toLocaleString();
  document.getElementById('abRM').textContent = 'Rs ' + m.toLocaleString(); document.getElementById('abRS').textContent = 'Rs ' + (t * 100).toLocaleString(); document.getElementById('abRT').textContent = 'Rs ' + tot.toLocaleString();
  document.getElementById('scoreNum').textContent = rate + '%';
  document.getElementById('scoreFill').style.width = rate + '%';
  document.getElementById('scoreLbl').textContent = rate >= 80 ? '🏆 Excellent! Top reseller performance' : rate >= 50 ? '👍 Acha chal raha hai!' : '💪 Aur clients add karo!';
}

function updActivity() {
  const el = document.getElementById('activityLog');
  get(ref(db, 'activity/' + RID)).then(snap => {
    if (!snap.exists()) { el.innerHTML = '<div class="empty"><div class="empty-i">📊</div><div>Koi activity nahi</div></div>'; return; }
    const acts = []; snap.forEach(c => acts.push(c.val())); acts.sort((a, b) => b.ts - a.ts);
    el.innerHTML = acts.slice(0, 10).map(a => `
      <div class="track-row">
        <div class="track-dot td-${a.type || 'sys'}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.78rem;font-weight:600">${esc(a.msg || '—')}</div>
          <div style="font-size:0.64rem;color:var(--t3)">${tFull(a.ts)}</div>
        </div>
      </div>`).join('');
  }).catch(() => {});
}
async function logActivity(type, msg) { try { await push(ref(db, 'activity/' + RID), { type, msg, ts: Date.now() }); } catch (e) {} }

// ============ CLIENTS ============
function rndRows(elId, entries) {
  const el = document.getElementById(elId);
  if (!entries.length) { el.innerHTML = '<div class="empty"><div class="empty-i">📭</div><div>Koi client nahi.<br><button class="btn bg-gold bsm" onclick="gp(\'add\')" style="margin-top:0.5rem">➕ Add Client</button></div></div>'; return; }
  el.innerHTML = entries.map(([uid, c], i) => { const paid = c.status === 'Paid'; return `
    <div class="cli" style="animation-delay:${i * 0.04}s" onclick="openDet('${uid}')">
      <div class="cav ${paid ? 'cav-g' : 'cav-r'}">${paid ? '✅' : '🚫'}</div>
      <div class="cinf">
        <div class="cnm">${esc(c.name || '—')}</div>
        <div class="csub">${esc(c.phone || '—')}${c.notes ? ' · ' + esc(c.notes) : ''}</div>
      </div>
      <div class="cright">
        <span class="badge ${paid ? 'bp' : 'bb'}">${paid ? 'Paid' : 'Block'}</span>
        <span style="font-family:'Fira Code',monospace;font-size:0.58rem;color:var(--t3)">${uid}</span>
      </div>
    </div>`; }).join('');
}
function rndRecent() { rndRows('recList', Object.entries(ALL).sort((a, b) => (b[1].time || 0) - (a[1].time || 0)).slice(0, 5)); }
window.fC = () => rndAll(document.getElementById('cF').value.toLowerCase());
window.setFilter = f => { clientFilter = f; ['all', 'paid', 'block'].forEach(x => { const b = document.getElementById('fb-' + x); if (b) b.className = 'bsm btn ' + (x === f ? 'bg-gold' : 'bg-ghost'); }); rndAll(); };
function rndAll(search) {
  let e = Object.entries(ALL);
  const f = search !== undefined ? search : (document.getElementById('cF').value || '').toLowerCase();
  if (f) e = e.filter(([uid, c]) => (c.name || '').toLowerCase().includes(f) || (c.phone || '').toLowerCase().includes(f) || uid.toLowerCase().includes(f));
  if (clientFilter === 'paid') e = e.filter(([, c]) => c.status === 'Paid');
  else if (clientFilter === 'block') e = e.filter(([, c]) => c.status !== 'Paid');
  rndRows('allList', e);
}

window.openDet = function (uid) {
  const c = ALL[uid]; if (!c) return;
  const m3u = 'https://mitv-tan.vercel.app/api/m3u?user=' + uid, paid = c.status === 'Paid';
  document.getElementById('moDB').innerHTML = `
    <div class="dr"><div class="dl">Name</div><div class="dv">${esc(c.name || '—')}</div></div>
    <div class="dr"><div class="dl">Phone</div><div class="dv">${esc(c.phone || '—')}</div></div>
    <div class="dr"><div class="dl">UID</div><div class="dv mono">${uid}</div></div>
    <div class="dr"><div class="dl">Notes</div><div class="dv" style="color:var(--t2)">${esc(c.notes || '—')}</div></div>
    <div class="dr"><div class="dl">Status</div><div class="dv"><span class="badge ${paid ? 'bp' : 'bb'}">${paid ? '✅ Paid' : '🚫 Blocked'}</span></div></div>
    <div class="dr"><div class="dl">Added</div><div class="dv" style="font-size:0.78rem;color:var(--t2)">${tFull(c.time)}</div></div>
    <div class="dr"><div class="dl">M3U</div><div class="dv">
      <div class="m3u-box"><span class="m3u-t">${m3u}</span><button class="cp-btn" onclick="cpTxt('${m3u}',this)">📋</button></div>
    </div></div>`;
  const waNum = (c.phone || '').replace(/\D/g, ''), post = waPost(c.name || '', c.phone || '', m3u, uid);
  document.getElementById('moDFt').innerHTML = `
    <button class="btn bg-ghost bsm" onclick="cM('moD')">Close</button>
    <button class="btn bg-orange bsm" onclick="openEditClient('${uid}');cM('moD')">✏️ Edit</button>
    <button class="btn ${paid ? 'bg-red' : 'bg-green'} bsm" onclick="togCli('${uid}','${c.status}')">${paid ? '🔴 Block' : '🟢 Unblock'}</button>
    <a class="btn bg-green bsm" href="https://wa.me/${waNum}?text=${encodeURIComponent(post)}" target="_blank">📲 WA</a>
    <button class="btn bg-red bsm" onclick="delCli('${uid}')">🗑</button>`;
  oM('moD');
};

window.openEditClient = function (uid) {
  const c = ALL[uid]; if (!c) return;
  document.getElementById('ec_uid').value = uid;
  document.getElementById('ec_nm').value = c.name || '';
  document.getElementById('ec_ph').value = c.phone || '';
  document.getElementById('ec_nt').value = c.notes || '';
  document.getElementById('ec_st').value = c.status || 'Paid';
  oM('moEC');
};

window.saveClientEdit = async function () {
  const uid = document.getElementById('ec_uid').value;
  const nm = document.getElementById('ec_nm').value.trim();
  const ph = document.getElementById('ec_ph').value.trim();
  const nt = document.getElementById('ec_nt').value.trim();
  const st = document.getElementById('ec_st').value;
  const eEl = document.getElementById('ecErr');
  if (!nm || !ph) { eEl.textContent = 'Naam aur phone zaroori.'; eEl.classList.add('on'); return; }
  try {
    const upd = { name: nm, phone: ph, notes: nt, status: st, updated_at: Date.now() };
    await update(ref(db, 'clients/' + RID + '/' + uid), upd);
    await update(ref(db, 'master_users/' + uid), { name: nm, phone: ph, status: st, updated_at: Date.now() });
    toast('✅ Client updated!', 'ok'); cM('moEC'); eEl.classList.remove('on');
    await logActivity('pay', 'Client edit: ' + nm + ' (' + uid + ')');
  } catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
};

window.togCli = async (uid, cur) => { const ns = cur === 'Paid' ? 'Blocked' : 'Paid'; await update(ref(db, 'clients/' + RID + '/' + uid), { status: ns }); await update(ref(db, 'master_users/' + uid), { status: ns, updated_at: Date.now() }); toast(uid + ' → ' + ns, 'ok'); playSound(ns === 'Paid' ? 'success' : 'error'); cM('moD'); await logActivity(ns === 'Paid' ? 'pay' : 'del', 'Status change: ' + uid + ' → ' + ns); };

window.delCli = async uid => {
  if (!confirm('Delete karein? Yeh undo nahi ho ga!')) return;
  const c = ALL[uid];
  await remove(ref(db, 'clients/' + RID + '/' + uid));
  await remove(ref(db, 'master_users/' + uid));
  await remove(ref(db, 'active_playlists/' + uid));
  cM('moD'); toast('Client deleted.', 'info'); playSound('error');
  await logActivity('del', 'Client deleted: ' + (c?.name || uid));
};

window.addCli = async function () {
  const nm = document.getElementById('nn').value.trim(), ph = document.getElementById('np').value.trim(), note = document.getElementById('nnote').value.trim();
  const eEl = document.getElementById('addErr'), btn = document.getElementById('addBtn');
  eEl.classList.remove('on');
  if (!nm || !ph) { eEl.textContent = '⚠️ Naam aur phone zaroori.'; eEl.classList.add('on'); playSound('error'); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spin-sm"></span>Deploy...'; playSound('click');
  try {
    const uid = gUID('MIR'), ts = Date.now(), m3u = 'https://mitv-tan.vercel.app/api/m3u?user=' + uid;
    let src = ['https://mitvnet.vercel.app/default.m3u'];
    try { const ls = await get(ref(db, 'playlist_library')); if (ls.exists()) { src = []; ls.forEach(c => { if (c.val()?.url) src.push(c.val().url); }); } } catch (e) {}
    await set(ref(db, 'master_users/' + uid), { name: nm, phone: ph, status: 'Paid', reseller_id: RID, notes: note, created_at: ts, updated_at: ts });
    await set(ref(db, 'active_playlists/' + uid), { sources: src, warningVideo: 'https://mitvnet.vercel.app/mipay.mp4', assigned_by: 'Reseller_' + RID, lastUpdate: ts });
    await set(ref(db, 'clients/' + RID + '/' + uid), { uid, name: nm, phone: ph, m3u, status: 'Paid', notes: note, time: ts });
    await logActivity('add', 'New client: ' + nm + ' (' + uid + ')');
    playSound('deploy');
    const post = waPost(nm, ph, m3u, uid), waNum = ph.replace(/\D/g, '');
    document.getElementById('moSB').innerHTML = `
      <div class="dr"><div class="dl">UID</div><div class="dv mono">${uid}</div></div>
      <div class="dr"><div class="dl">Name</div><div class="dv">${esc(nm)}</div></div>
      <div class="dr"><div class="dl">Phone</div><div class="dv">${esc(ph)}</div></div>
      <div class="dr"><div class="dl">M3U</div><div class="dv"><div class="m3u-box"><span class="m3u-t">${m3u}</span><button class="cp-btn" onclick="cpTxt('${m3u}',this)">📋</button></div></div></div>
      <div style="margin-top:0.75rem"><div class="cost-t" style="margin-bottom:0.4rem">WHATSAPP MSG</div><div class="wa-box">${esc(post)}</div><button class="btn bg-ghost bsm bfull" style="margin-top:0.5rem" onclick="cpTxt(${JSON.stringify(post)})">📋 Copy</button></div>`;
    document.getElementById('waBtn').onclick = () => window.open('https://wa.me/' + waNum + '?text=' + encodeURIComponent(post), '_blank');
    document.getElementById('nn').value = ''; document.getElementById('np').value = ''; document.getElementById('nnote').value = '';
    oM('moS'); toast('✅ Client deployed!', 'ok');
  } catch (e) { eEl.textContent = '❌ ' + e.message; eEl.classList.add('on'); playSound('error'); }
  btn.disabled = false; btn.innerHTML = '⚡ DEPLOY CLIENT';
};

// ============ MARKETPLACE ============
let prodImgUrl = '';
wireImageUpload(document.getElementById('prodImgUp'), (url) => { prodImgUrl = url; });

window.openNewProduct = function () {
  document.getElementById('prodModalTtl').textContent = '🛍️ New Listing';
  document.getElementById('pd_id').value = '';
  document.getElementById('pd_title').value = '';
  document.getElementById('pd_price').value = '';
  document.getElementById('pd_desc').value = '';
  document.getElementById('pd_cat').value = 'IPTV Subscription';
  prodImgUrl = '';
  const box = document.getElementById('prodImgUp'); const img = box.querySelector('img'); if (img) img.remove(); const span = box.querySelector('span'); if (span) span.style.display = 'flex';
  oM('moProd');
};

window.openEditProduct = function (pid) {
  const p = ALL_PRODUCTS[pid]; if (!p) return;
  document.getElementById('prodModalTtl').textContent = '✏️ Edit Listing';
  document.getElementById('pd_id').value = pid;
  document.getElementById('pd_title').value = p.title || '';
  document.getElementById('pd_price').value = p.price || '';
  document.getElementById('pd_desc').value = p.desc || '';
  document.getElementById('pd_cat').value = p.category || 'Other';
  prodImgUrl = p.image || '';
  const box = document.getElementById('prodImgUp');
  if (prodImgUrl) { let img = box.querySelector('img'); if (!img) { img = document.createElement('img'); box.appendChild(img); } img.src = prodImgUrl; const span = box.querySelector('span'); if (span) span.style.display = 'none'; }
  cM('moProdD'); oM('moProd');
};

window.saveProduct = async function () {
  const pid = document.getElementById('pd_id').value;
  const title = document.getElementById('pd_title').value.trim();
  const price = parseFloat(document.getElementById('pd_price').value);
  const desc = document.getElementById('pd_desc').value.trim();
  const cat = document.getElementById('pd_cat').value;
  const eEl = document.getElementById('prodErr'); eEl.classList.remove('on');
  if (!title || !price) { eEl.textContent = '⚠️ Title aur price zaroori.'; eEl.classList.add('on'); playSound('error'); return; }
  try {
    const data = { title, price, desc, category: cat, image: prodImgUrl, sellerId: RID, sellerName: RNAME, updated_at: Date.now() };
    if (pid) { await update(ref(db, 'products/' + pid), data); toast('✅ Listing updated!', 'ok'); }
    else { data.created_at = Date.now(); data.status = 'active'; await push(ref(db, 'products'), data); toast('✅ Listing add ho gayi!', 'ok'); playSound('deploy'); }
    cM('moProd');
  } catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
};

function productCard(pid, p) {
  return `<div class="prod-card" onclick="openProductDetail('${pid}')">
    ${p.image ? `<img src="${esc(p.image)}" class="prod-img">` : `<div class="prod-img" style="display:flex;align-items:center;justify-content:center;font-size:1.8rem">🛍️</div>`}
    <div class="prod-body">
      <div class="prod-title">${esc(p.title)}</div>
      <div class="prod-price">Rs ${Number(p.price).toLocaleString()}</div>
      <div class="prod-seller">👤 ${esc(p.sellerName || '—')}</div>
    </div>
  </div>`;
}

function rndMarket() {
  const grid = document.getElementById('marketGrid');
  let entries = Object.entries(ALL_PRODUCTS).filter(([, p]) => p.status !== 'removed');
  if (marketFilter) entries = entries.filter(([, p]) => (p.title || '').toLowerCase().includes(marketFilter) || (p.category || '').toLowerCase().includes(marketFilter));
  entries.sort((a, b) => (b[1].created_at || 0) - (a[1].created_at || 0));
  if (!entries.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-i">🛍️</div><div>Koi listing nahi mili</div></div>`; return; }
  grid.innerHTML = entries.map(([pid, p]) => productCard(pid, p)).join('');
}
window.fMarket = () => { marketFilter = document.getElementById('mF').value.toLowerCase(); rndMarket(); };

function rndMyListings() {
  const el = document.getElementById('myListings');
  const mine = Object.entries(ALL_PRODUCTS).filter(([, p]) => p.sellerId === RID && p.status !== 'removed');
  if (!mine.length) { el.innerHTML = '<div class="empty"><div class="empty-i">📭</div><div>Koi listing nahi<br><button class="btn bg-gold bsm" onclick="openNewProduct()" style="margin-top:0.5rem">➕ Sell Karein</button></div></div>'; return; }
  el.innerHTML = mine.map(([pid, p]) => `
    <div class="cli" onclick="openProductDetail('${pid}')">
      <div class="cav cav-g" style="background-image:url('${esc(p.image || '')}')">${p.image ? '' : '🛍️'}</div>
      <div class="cinf"><div class="cnm">${esc(p.title)}</div><div class="csub">Rs ${Number(p.price).toLocaleString()} · ${esc(p.category || '')}</div></div>
      <div class="cright"><span class="badge bp">Active</span></div>
    </div>`).join('');
}

window.openProductDetail = function (pid) {
  const p = ALL_PRODUCTS[pid]; if (!p) return;
  const isMine = p.sellerId === RID;
  document.getElementById('moProdDB').innerHTML = `
    ${p.image ? `<img src="${esc(p.image)}" style="width:100%;border-radius:12px;margin-bottom:1rem;max-height:220px;object-fit:cover">` : ''}
    <div class="dr"><div class="dl">Title</div><div class="dv">${esc(p.title)}</div></div>
    <div class="dr"><div class="dl">Price</div><div class="dv" style="color:var(--g);font-weight:700">Rs ${Number(p.price).toLocaleString()}</div></div>
    <div class="dr"><div class="dl">Category</div><div class="dv">${esc(p.category || '—')}</div></div>
    <div class="dr"><div class="dl">Details</div><div class="dv" style="color:var(--t2)">${esc(p.desc || '—')}</div></div>
    <div class="dr"><div class="dl">Seller</div><div class="dv">${esc(p.sellerName || '—')}</div></div>`;
  const sellerPhone = (allResellers[p.sellerId]?.number || allResellers[p.sellerId]?.phone || '').replace(/\D/g, '');
  let footBtns = `<button class="btn bg-ghost bsm" onclick="cM('moProdD')">Close</button>`;
  if (isMine) {
    footBtns += `<button class="btn bg-orange bsm" onclick="openEditProduct('${pid}')">✏️ Edit</button>
      <button class="btn bg-red bsm" onclick="removeProduct('${pid}')">🗑 Remove</button>`;
  } else if (sellerPhone) {
    const msg = encodeURIComponent(`Assalam o Alaikum! Mujhe "${p.title}" (Rs ${p.price}) chahiye — Mi Reseller Program se contact kar raha hoon.`);
    footBtns += `<a class="btn bg-green bsm" href="https://wa.me/${sellerPhone}?text=${msg}" target="_blank">📲 Contact Seller</a>`;
  }
  document.getElementById('moProdDFt').innerHTML = footBtns;
  oM('moProdD');
};

window.removeProduct = async function (pid) {
  if (!confirm('Listing remove karein?')) return;
  await update(ref(db, 'products/' + pid), { status: 'removed' });
  cM('moProdD'); toast('Listing removed.', 'info'); playSound('error');
};

// ============ PAYMENTS ============
window.openPaymentModal = function () {
  const rows = [];
  if (paymentMethods.jazzcash?.enabled) rows.push(`
    <div class="pay-opt on">
      <div class="pico pay-jc">📱</div>
      <div style="flex:1"><div style="font-weight:700;font-size:.84rem">JazzCash</div><div style="font-size:.72rem;color:var(--t2)">${esc(paymentMethods.jazzcash.name || '')}</div></div>
      <div style="text-align:right"><div class="dv mono" style="font-size:.85rem">${esc(paymentMethods.jazzcash.number || '—')}</div><button class="cp-btn" onclick="cpTxt('${esc(paymentMethods.jazzcash.number || '')}',this)">📋 Copy</button></div>
    </div>`);
  if (paymentMethods.easypaisa?.enabled) rows.push(`
    <div class="pay-opt on">
      <div class="pico pay-ep">💚</div>
      <div style="flex:1"><div style="font-weight:700;font-size:.84rem">EasyPaisa</div><div style="font-size:.72rem;color:var(--t2)">${esc(paymentMethods.easypaisa.name || '')}</div></div>
      <div style="text-align:right"><div class="dv mono" style="font-size:.85rem">${esc(paymentMethods.easypaisa.number || '—')}</div><button class="cp-btn" onclick="cpTxt('${esc(paymentMethods.easypaisa.number || '')}',this)">📋 Copy</button></div>
    </div>`);
  if (paymentMethods.bank?.enabled) rows.push(`
    <div class="pay-opt on">
      <div class="pico pay-bk">🏦</div>
      <div style="flex:1"><div style="font-weight:700;font-size:.84rem">${esc(paymentMethods.bank.bankName || 'Bank')}</div><div style="font-size:.72rem;color:var(--t2)">${esc(paymentMethods.bank.accountTitle || '')}</div></div>
      <div style="text-align:right"><div class="dv mono" style="font-size:.78rem">${esc(paymentMethods.bank.iban || '—')}</div><button class="cp-btn" onclick="cpTxt('${esc(paymentMethods.bank.iban || '')}',this)">📋 Copy</button></div>
    </div>`);
  document.getElementById('moPayB').innerHTML = rows.length ? `
    <div style="font-size:.75rem;color:var(--t2);margin-bottom:1rem;line-height:1.6">Payment karne ke baad screenshot Admin ko chat mein bhej dein taake fori confirm ho jaye.</div>
    ${rows.join('')}` : `<div class="empty"><div class="empty-i">💳</div><div>Admin ne abhi payment methods set nahi kiye.</div></div>`;
  oM('moPay');
};

// ============ CHAT SYSTEM ============
function buildChatMsg(m, isAdmin) {
  const self = (isAdmin ? m.from === 'admin' : m.from !== 'admin');
  const d = document.createElement('div');
  d.className = 'msg' + (self ? ' self' : '');
  d.dataset.msgid = m.id || '';
  let content = '<div class="bubble">';
  if (m.type === 'image' && m.url) { content += `<img src="${esc(m.url)}" class="chat-img" onclick="window.open('${esc(m.url)}','_blank')">`; }
  else if (m.type === 'voice' && m.url) { content += `<audio controls style="max-width:180px;height:28px"><source src="${esc(m.url)}"></audio>`; }
  else { content += esc(m.text || '').replace(/\n/g, '<br>'); }
  if (m.edited) content += `<span style="font-size:0.56rem;color:var(--t3);margin-left:4px">(edited)</span>`;
  content += `</div>`;
  const senderLbl = self ? (isAdmin ? 'Muaaz' : 'Me') : (isAdmin ? 'Reseller' : 'Admin Muaaz');
  content += `<div class="mmeta">${senderLbl} · ${tAgo(m.ts)}`;
  if (self && m.ts) content += `<span class="msg-status"> ✓✓</span>`;
  content += `</div>`;
  d.innerHTML = `<div class="mav ${self ? (isAdmin ? 'mav-g' : 'mav-c') : (isAdmin ? 'mav-c' : 'mav-g')}">${self ? (isAdmin ? '👑' : '🧑‍💼') : (isAdmin ? '🧑‍💼' : '👑')}</div><div>${content}</div>`;
  return d;
}

function initChat(mode) {
  chatMode = mode;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  const el = document.getElementById('chatMsgs');
  el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:2rem;font-size:0.8rem">' + (mode === 'admin' ? 'Admin ko message karo 👋' : 'Reseller select karo 💬') + '</div>';
  if (mode === 'admin') {
    chatUnsub = onValue(ref(db, 'chats/' + RID), snap => {
      const msgs = []; snap.forEach(c => { const v = c.val(); v.id = c.key; msgs.push(v); }); msgs.sort((a, b) => a.ts - b.ts);
      el.innerHTML = '';
      if (!msgs.length) { el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:2rem;font-size:0.8rem">Admin ko pehla message bhejo 👋</div>'; return; }
      msgs.forEach(m => el.appendChild(buildChatMsg(m, false)));
      el.scrollTop = el.scrollHeight;
      const b = document.getElementById('chatBadge'); if (b) b.style.display = 'none';
    });
  }
}

window.switchChatType = function (type) {
  document.getElementById('ct-admin').classList.toggle('on', type === 'admin');
  if (type === 'admin') {
    document.getElementById('chatHdrNm').textContent = 'Admin — Muaaz Iqbal';
    document.getElementById('chatHdrSub').textContent = 'Kasur, Punjab · Realtime Chat';
    document.getElementById('chatHdrAv').textContent = '👑';
    document.getElementById('chatHdrAv').className = 'mav mav-g';
    document.getElementById('chatIn').placeholder = 'Admin ko message...';
    chatMode = 'admin'; chatWith = null;
    initChat('admin');
  }
};

window.openR2R = function () {
  const e = Object.entries(allResellers).filter(([id]) => id !== RID);
  if (!e.length) { toast('Koi dusra reseller nahi.', 'info'); return; }
  document.getElementById('r2rList').innerHTML = e.map(([rid, r]) => `
    <div class="cli" onclick="startR2R('${rid}','${esc(r.name || rid)}')">
      <div class="cav cav-c" style="${r.photo ? `background-image:url('${esc(r.photo)}')` : ''}">${r.photo ? '' : '🧑‍💼'}</div>
      <div class="cinf"><div class="cnm">${esc(r.name || rid)}</div><div class="csub">${esc(r.number || '—')}${r.city ? ' · ' + esc(r.city) : ''}</div></div>
      <div class="cright"><span style="font-size:0.7rem;color:var(--g)">Chat →</span></div>
    </div>`).join('');
  oM('moR2R');
};

window.startR2R = function (rid, name) {
  cM('moR2R');
  chatMode = 'r2r'; chatWith = rid;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  document.getElementById('ct-admin').classList.remove('on');
  document.getElementById('chatHdrNm').textContent = name;
  document.getElementById('chatHdrSub').textContent = 'Reseller to Reseller · Realtime';
  document.getElementById('chatHdrAv').textContent = '🧑‍💼';
  document.getElementById('chatHdrAv').className = 'mav mav-c';
  document.getElementById('chatIn').placeholder = name + ' ko message...';
  const chatPath = 'r2r_chats/' + [RID, rid].sort().join('_');
  const el = document.getElementById('chatMsgs'); el.innerHTML = '';
  chatUnsub = onValue(ref(db, chatPath), snap => {
    const msgs = []; snap.forEach(c => { const v = c.val(); v.id = c.key; msgs.push(v); }); msgs.sort((a, b) => a.ts - b.ts);
    el.innerHTML = '';
    if (!msgs.length) { el.innerHTML = '<div style="text-align:center;color:var(--t2);padding:2rem;font-size:0.8rem">Pehla message bhejo 👋</div>'; return; }
    msgs.forEach(m => {
      const self = m.from === RID;
      const d = document.createElement('div'); d.className = 'msg' + (self ? ' self' : '');
      let content = `<div class="bubble">${esc(m.text || '').replace(/\n/g, '<br>')}`;
      if (m.edited) content += `<span style="font-size:0.56rem;color:var(--t3);margin-left:4px">(edited)</span>`;
      content += `</div><div class="mmeta">${self ? 'Me' : esc(name)} · ${tAgo(m.ts)}</div>`;
      d.innerHTML = `<div class="mav ${self ? 'mav-c' : 'mav-p'}">${self ? '🧑‍💼' : '🧑'}</div><div>${content}</div>`;
      el.appendChild(d);
    });
    el.scrollTop = el.scrollHeight;
  });
  gp('chat');
};

window.sChat = async () => {
  const inp = document.getElementById('chatIn'), txt = inp.value.trim(); if (!txt) return;
  inp.value = ''; inp.style.height = 'auto'; playSound('send');
  if (chatMode === 'admin') { await push(ref(db, 'chats/' + RID), { text: txt, from: 'reseller', type: 'text', ts: Date.now() }); }
  else if (chatMode === 'r2r' && chatWith) { const chatPath = 'r2r_chats/' + [RID, chatWith].sort().join('_'); await push(ref(db, chatPath), { text: txt, from: RID, senderName: RNAME, type: 'text', ts: Date.now() }); }
};
window.ckSend = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sChat(); } };

window.sendChatImg = async function () {
  const file = document.getElementById('chatImgUp').files[0]; if (!file) return;
  if (chatMode !== 'admin') { toast('Image sirf Admin chat mein', 'info'); return; }
  toast('📤 Upload ho raha he...', 'info');
  try {
    const res = await uploadToImgBB(file);
    await push(ref(db, 'chats/' + RID), { url: res.url, from: 'reseller', type: 'image', ts: Date.now() });
    playSound('send'); toast('✅ Image bhaij di!', 'ok');
  } catch (e) { toast('❌ Image error: ' + e.message, 'err'); }
  document.getElementById('chatImgUp').value = '';
};

// ============ PROFILE SAVE ============
window.saveProfile = async function () {
  const em = document.getElementById('pro_em').value.trim();
  const pw = document.getElementById('pro_pw').value.trim();
  const pin = document.getElementById('pro_pin').value.trim();
  const eEl = document.getElementById('proErr'); eEl.classList.remove('on');
  try {
    const upd = { updated_at: Date.now() };
    if (em) upd.email = em;
    if (pw.length >= 4) upd.password = pw;
    if (proLocation) upd.location = proLocation;
    await update(ref(db, 'resellers/' + RID), upd);
    if (em) { SESSION.email = em; document.getElementById('abEM').textContent = em; }
    if (proLocation) { SESSION.location = proLocation; document.getElementById('abLoc').textContent = proLocation.address; }
    localStorage.setItem('mi_s', JSON.stringify(SESSION)); sessionStorage.setItem('ms', JSON.stringify(SESSION));
    if (pin.length === 4) { localStorage.setItem(PIN_K, pin); savedPIN = pin; }
    toast('✅ Profile updated!', 'ok'); cM('moPro');
  } catch (e) { eEl.textContent = 'Error: ' + e.message; eEl.classList.add('on'); playSound('error'); }
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
  d.innerHTML = `<div class="mav ${self ? 'mav-c' : 'mav-p'}">${self ? '🧑‍💼' : '🧠'}</div><div><div class="bubble">${text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div></div>`;
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
  thD.remove();
  addAIMsg(reply);
  hist.push({ role: 'assistant', content: reply });
  playSound('receive');
};
window.clrAI = () => { aiHistoryMini = []; aiHistoryLong = []; document.getElementById('aiMsgs').innerHTML = ''; addAIMsg('Clear! Poochho kuch bhi 😊'); };
window.akSend = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sAI(); } };

// ============ NAVIGATION ============
window.gp = function (name) {
  playSound('nav');
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on')); document.querySelectorAll('.bni').forEach(b => b.classList.remove('on'));
  document.getElementById('pg-' + name)?.classList.add('on'); document.querySelector('.bni[data-pg="' + name + '"]')?.classList.add('on');
  if (name === 'chat') { const b = document.getElementById('chatBadge'); if (b) b.style.display = 'none'; }
  const sc = document.getElementById('scrl'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
};

window.doLogout = () => { playSound('logout'); authLogout(); setTimeout(() => location.replace('index.html'), 200); };

window.addEventListener('load', () => setTimeout(() => document.getElementById('ldr').classList.add('hide'), 500));
