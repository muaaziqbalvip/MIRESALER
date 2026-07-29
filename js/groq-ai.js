/* Mi Reseller Program — Groq AI (mini + long models, auto key rotation) */
import { GROQ_KEYS, GROQ_MODEL_MINI, GROQ_MODEL_LONG, GROQ_SYSTEM_PROMPT } from './config.js';

let ki = 0, slowMode = false;

/**
 * @param {{role:string,content:string}[]} history
 * @param {{model?:'mini'|'long', max_tokens?:number, temperature?:number}} [opts]
 */
export async function groqChat(history, opts = {}) {
  const model = opts.model === 'long' ? GROQ_MODEL_LONG : GROQ_MODEL_MINI;
  const maxTry = Math.max(GROQ_KEYS.length * 2, 4);

  for (let i = 0; i < maxTry; i++) {
    const key = GROQ_KEYS[ki % GROQ_KEYS.length];
    if (!key || key.startsWith('YOUR_')) {
      return '⚠️ Groq API key set nahi hui. js/config.js me GROQ_KEYS array me apni key(s) daalein — https://console.groq.com/keys se free key milti hai.';
    }
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model,
          max_tokens: opts.max_tokens || (opts.model === 'long' ? 2000 : 800),
          temperature: opts.temperature || 0.72,
          messages: [{ role: 'system', content: GROQ_SYSTEM_PROMPT }, ...history]
        })
      });
      if (r.status === 429) { ki = (ki + 1) % GROQ_KEYS.length; slowMode = i >= GROQ_KEYS.length; await sleep(700); continue; }
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
      const d = await r.json();
      slowMode = false;
      return d.choices?.[0]?.message?.content || '⚠️ Khali response mila.';
    } catch (e) {
      if (e.message?.includes('429') || e.message?.includes('rate')) { ki = (ki + 1) % GROQ_KEYS.length; await sleep(800); continue; }
      if (i >= maxTry - 1) return `⚠️ AI abhi available nahi: ${e.message}. Thodi der baad try karein.`;
      ki = (ki + 1) % GROQ_KEYS.length; await sleep(400);
    }
  }
  return '⚠️ Sab keys rate-limited hain. 1 minute baad try karein.';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
