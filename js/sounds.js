/* Mi Reseller Program — Sound Effects (Web Audio API) */
let audioCtx = null, soundOn = (localStorage.getItem('mi_sound') !== 'off');

function getCtx() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, type = 'sine', dur = .1, gain = .28, delay = 0) {
  if (!soundOn) return;
  const ctx = getCtx(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination); o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  g.gain.setValueAtTime(0, ctx.currentTime + delay);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + .01);
  g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + delay + dur);
  o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + dur + .05);
}
const SFX = {
  click: () => { tone(800, 'sine', .05, .2); tone(600, 'sine', .05, .12, .03); },
  nav: () => { tone(560, 'sine', .07, .13); tone(760, 'triangle', .05, .07, .04); },
  success: () => { tone(523, 'sine', .12, .25); tone(659, 'sine', .12, .25, .1); tone(784, 'sine', .15, .3, .2); tone(1047, 'sine', .12, .2, .33); },
  error: () => { tone(300, 'sawtooth', .12, .2); tone(220, 'sawtooth', .15, .25, .1); },
  notify: () => { tone(880, 'sine', .08, .2); tone(1100, 'sine', .1, .18, .06); },
  pin: () => { tone(700 + Math.random() * 200, 'triangle', .06, .18); },
  pinOk: () => { tone(784, 'sine', .1, .25); tone(988, 'sine', .1, .25, .1); },
  pinWrong: () => { tone(200, 'sawtooth', .15, .3); tone(150, 'sawtooth', .12, .25, .12); },
  send: () => { tone(600, 'sine', .08, .18); tone(900, 'sine', .06, .15, .07); },
  receive: () => { tone(880, 'sine', .07, .15); tone(1100, 'sine', .05, .12, .08); },
  logout: () => { tone(400, 'triangle', .15, .2); tone(300, 'triangle', .12, .15, .1); },
  deploy: () => { [0, .08, .16, .26].forEach((d, i) => tone([440, 550, 660, 880][i], 'sine', .1, .2, d)); },
  upload: () => { [0, .07, .14].forEach((d, i) => tone([500, 700, 950][i], 'sine', .08, .15, d)); },
  cart: () => { tone(650, 'sine', .06, .18); tone(950, 'sine', .08, .2, .05); },
  toggle: () => { tone(700, 'square', .04, .1); }
};
window.playSound = function (n) { if (SFX[n]) try { SFX[n](); } catch (e) { } };
window.toggleSound = function () {
  soundOn = !soundOn;
  localStorage.setItem('mi_sound', soundOn ? 'on' : 'off');
  const b = document.getElementById('sndBtn'); if (b) b.textContent = soundOn ? '🔊' : '🔇';
  if (window.showToast) window.showToast(soundOn ? '🔊 Sound On' : '🔇 Sound Off', 'info', 1500);
  return soundOn;
};
document.addEventListener('DOMContentLoaded', () => {
  const init = () => { getCtx(); document.removeEventListener('click', init); document.removeEventListener('touchstart', init); };
  document.addEventListener('click', init); document.addEventListener('touchstart', init, { passive: true });
  document.addEventListener('click', e => {
    const b = e.target.closest('.btn,button,.nav-btn,.bni,.pk,.th-d,.model-btn,.pay-opt,.prod-card');
    if (!b) return;
    if (b.classList.contains('bni')) playSound('nav');
    else if (b.classList.contains('pk')) return; // pin handles its own sound
    else if (b.classList.contains('bg-gold') || b.classList.contains('bg-cyan') || b.classList.contains('bg-purple')) playSound('click');
    else playSound('toggle');
  });
});
