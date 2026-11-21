// Optional 4-digit PIN. This is a privacy screen (stops casual snooping), not encryption.
import { getMeta, setMeta, clearStores } from './db.js';
import { uid, confirmDialog } from './util.js';

async function hash(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; for (const b of data) h = Math.imul(h ^ b, 16777619); // fallback when not on https
  return `fnv${(h >>> 0).toString(16)}`;
}
export const hasPin = async () => !!(await getMeta('pinHash'));
export async function setPin(pin) { const salt = uid(); await setMeta('pinSalt', salt); await setMeta('pinHash', await hash(pin, salt)); }
export async function checkPin(pin) { return (await hash(pin, await getMeta('pinSalt'))) === (await getMeta('pinHash')); }
export async function clearPin() { await setMeta('pinHash', null); await setMeta('pinSalt', null); }

/**
 * Full-screen PIN pad. onPin(pin) resolves true (done), false (wrong → shake) .
 * Returns a promise resolved when finished (true) or cancelled (false).
 */
export function pinPad({ title, sub = '', onPin, cancellable = true, forgot = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'lock';
    let pin = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', forgot ? 'forgot' : cancellable ? 'cancel' : '', '0', 'del'];
    el.innerHTML = `<div class="lock-top"><div class="lock-icon">🔒</div><h2 class="lock-title"></h2><p class="lock-sub"></p><div class="dots">${'<i></i>'.repeat(4)}</div></div>
      <div class="pinpad">${keys.map((k) => k === 'del' ? '<button data-k="del" aria-label="Delete">⌫</button>'
        : k === 'forgot' ? '<button data-k="forgot" class="txt">Forgot?</button>'
        : k === 'cancel' ? '<button data-k="cancel" class="txt">Cancel</button>'
        : k ? `<button data-k="${k}">${k}</button>` : '<span></span>').join('')}</div>`;
    const setText = (t, s) => { el.querySelector('.lock-title').textContent = t; el.querySelector('.lock-sub').textContent = s; };
    setText(title, sub);
    const paint = () => el.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const finish = (v) => { document.removeEventListener('keydown', onKey); el.remove(); resolve(v); };
    let busy = false;
    const press = async (k) => {
      if (busy) return;
      if (k === 'cancel') return finish(false);
      if (k === 'forgot') {
        if (await confirmDialog('Forgot your PIN?', 'The only way back in is to erase ALL data on this device. You can then restore from a backup file.', 'Erase everything', true)) {
          await clearStores(); location.reload();
        }
        return;
      }
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 4) pin += k;
      paint();
      if (pin.length === 4) {
        busy = true;
        const r = await onPin(pin, setText);
        busy = false;
        if (r === true) return finish(true);
        if (r === false) { const d = el.querySelector('.dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
        pin = ''; setTimeout(paint, 150);
      }
    };
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
    el.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
  });
}

let locked = false;
export async function lockNow() {
  if (locked || !(await hasPin())) return;
  locked = true;
  await pinPad({ title: 'Enter PIN', sub: 'Ledger is locked', cancellable: false, forgot: true, onPin: checkPin });
  locked = false;
}

/** Re-lock after the app has been in the background for more than `ms`. */
export function autoLock(ms = 30000) {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > ms) lockNow();
  });
}

/** Choose a new PIN (enter twice). */
export async function choosePin() {
  let first = null;
  return pinPad({
    title: 'Choose a 4-digit PIN', sub: "You'll need it every time you open Ledger",
    onPin: async (pin, setText) => {
      if (!first) { first = pin; setText('Confirm your PIN', 'Enter it once more'); return 'next'; }
      if (pin === first) { await setPin(pin); return true; }
      first = null; setText('PINs did not match', 'Choose a 4-digit PIN'); return false;
    },
  });
}
