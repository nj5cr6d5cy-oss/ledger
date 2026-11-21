export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Tiny event bus: views listen for 'changed' to re-render after data edits.
const listeners = {};
export const on = (ev, fn) => ((listeners[ev] ||= []).push(fn));
export const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

let toastTimer;
export function toast(msg, { actionLabel, onAction, ms = 3200 } = {}) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  const hide = () => { el.hidden = true; };
  if (actionLabel) el.querySelector('button').onclick = () => { hide(); onAction?.(); };
  toastTimer = setTimeout(hide, ms);
}

/** Bottom-sheet modal. `render(box, close)` fills it. Returns close(). */
export function modal(render) {
  const m = $('#modal');
  m.innerHTML = '<div class="modal-box"></div>';
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ''; };
  m.onclick = (e) => { if (e.target === m) close(); };
  render(m.firstChild, close);
  return close;
}

/** Promise-based confirm dialog styled like the app. */
export function confirmDialog(title, message, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    modal((box, close) => {
      box.innerHTML = `<h2>${esc(title)}</h2><p class="muted" style="text-align:center;margin:-4px 8px 18px">${esc(message)}</p>
        <div class="btn-row"><button class="btn secondary" data-v="0">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(okLabel)}</button></div>`;
      box.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { close(); resolve(b.dataset.v === '1'); } };
    });
  });
}
