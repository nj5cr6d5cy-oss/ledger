import { $, esc, emit, toast } from '../util.js';
import { get, put, del } from '../db.js';
import { catById, methodById } from '../state.js';
import { fmt } from '../money.js';
import { dayLabel } from '../dates.js';
import { openAdd } from './add.js';

export function setTitle(title, { back = '', right = '', extra = '' } = {}) {
  $('#title').innerHTML = back ? `<a class="back" href="${back}" style="color:#fff;text-decoration:none">‹ ${esc(title)}</a>` : esc(title);
  $('#topbar-right').innerHTML = right;
  $('#topbar-extra').innerHTML = extra;
}

export const sortTx = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0));

export function groupByDay(txs) {
  const groups = [];
  let cur = null;
  for (const t of [...txs].sort(sortTx)) {
    if (!cur || cur.date !== t.date) groups.push((cur = { date: t.date, items: [], net: 0 }));
    cur.items.push(t);
    cur.net += t.type === 'income' ? t.amount : -t.amount;
  }
  return groups;
}

export function txRowHTML(t) {
  const c = catById(t.categoryId), m = methodById(t.methodId);
  const sub = [t.note, m.name].filter(Boolean).map(esc).join(' · ') + (t.recurringId ? ' · 🔁' : '');
  return `<div class="swipe-row" data-id="${esc(t.id)}">
    <div class="actions"><button class="act-edit">Edit</button><button class="act-del">Delete</button></div>
    <div class="front"><div class="tx">
      <div class="tx-icon" style="background:${c.color}26">${c.icon}</div>
      <div class="tx-main"><div class="tx-title">${esc(c.name)}</div><div class="tx-sub">${sub}</div></div>
      <div class="tx-amt num ${t.type === 'income' ? 'inc' : ''}">${fmt(t.amount)}</div>
    </div></div></div>`;
}

export function dayGroupsHTML(groups) {
  return groups.map((g) => `<div class="day-head"><span>${dayLabel(g.date)}</span><span class="num">${fmt(g.net, { sign: true })}</span></div>
    <div class="group">${g.items.map(txRowHTML).join('')}</div>`).join('');
}

export async function editTx(id) { const t = await get('transactions', id); if (t) openAdd(t); }
export async function deleteTx(id) {
  const t = await get('transactions', id);
  if (!t) return;
  await del('transactions', id);
  emit('changed');
  toast(`Deleted ${fmt(t.amount)} · ${catById(t.categoryId).name}`, { actionLabel: 'Undo', onAction: async () => { await put('transactions', t); emit('changed'); } });
}

/** Swipe-left on a row reveals Edit / Delete. Tap a row to edit. */
const ACT = 152;
export function bindTxList(root) {
  let drag = null, openRow = null, suppress = false;
  const front = (row) => row.querySelector('.front');
  const setX = (row, x) => { front(row).style.transform = x ? `translateX(${x}px)` : ''; };
  const closeOpen = () => { if (openRow) { setX(openRow, 0); openRow = null; } };

  root.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.swipe-row');
    if (!row || e.target.closest('.actions')) return;
    if (openRow && openRow !== row) closeOpen();
    drag = { row, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: row === openRow ? -ACT : 0, dx: 0, active: false };
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) {
        drag.active = true;
        front(drag.row).classList.add('dragging');
        try { drag.row.setPointerCapture(e.pointerId); } catch {}
      } else if (Math.abs(my) > 10) { drag = null; return; } else return;
    }
    drag.dx = Math.max(-ACT - 30, Math.min(0, drag.base + mx));
    setX(drag.row, drag.dx);
  });
  const finish = (cancelled) => {
    if (drag?.active) {
      front(drag.row).classList.remove('dragging');
      const open = cancelled ? drag.base !== 0 : drag.dx < -ACT / 2;
      setX(drag.row, open ? -ACT : 0);
      openRow = open ? drag.row : openRow === drag.row ? null : openRow;
      suppress = true;
      setTimeout(() => (suppress = false), 60);
    }
    drag = null;
  };
  root.addEventListener('pointerup', () => finish(false));
  root.addEventListener('pointercancel', () => finish(true));
  root.addEventListener('click', (e) => {
    if (suppress) { e.stopPropagation(); return; }
    const row = e.target.closest('.swipe-row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.act-del')) { closeOpen(); deleteTx(id); }
    else if (e.target.closest('.act-edit')) { closeOpen(); editTx(id); }
    else if (openRow) closeOpen();
    else editTx(id);
  });
}
