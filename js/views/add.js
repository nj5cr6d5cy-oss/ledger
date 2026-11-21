// Quick-add sheet: built-in keypad (always visible, no waiting for the iOS keyboard),
// most-used categories first, last category/method pre-selected.
import { $, esc, emit, toast, uid, confirmDialog } from '../util.js';
import { put, del, setMeta } from '../db.js';
import { state, catsByUsage, activeMethods, catById, bumpUsage } from '../state.js';
import { fmt, parseToCents, currency } from '../money.js';
import { today, dayLabel } from '../dates.js';
import { budgetAlert } from './budgets.js';

let st = null;
const sheet = () => $('#sheet');

function centsToInput(c) {
  const w = Math.floor(c / 100), f = c % 100;
  return f ? `${w}.${String(f).padStart(2, '0')}` : String(w);
}
function pickCat(type, preferred) {
  const list = catsByUsage(type);
  return (list.find((c) => c.id === preferred) || list[0])?.id;
}

export function openAdd(existing = null) {
  const type = existing?.type || 'expense';
  const methods = activeMethods();
  st = {
    id: existing?.id || null,
    type,
    amt: existing ? centsToInput(existing.amount) : '',
    categoryId: existing ? existing.categoryId : pickCat(type, state.last[type]),
    methodId: existing ? existing.methodId : (methods.find((m) => m.id === state.last.method) || methods[0])?.id,
    date: existing?.date || today(),
    note: existing?.note || '',
    orig: existing,
    fresh: !!existing, // editing: first digit typed replaces the old amount
  };
  render();
  const el = sheet();
  el.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  document.addEventListener('keydown', onKey);
}

export function closeAdd() {
  const el = sheet();
  el.classList.remove('open');
  document.removeEventListener('keydown', onKey);
  setTimeout(() => { if (!el.classList.contains('open')) { el.hidden = true; el.innerHTML = ''; } }, 300);
  st = null;
}

function render() {
  const el = sheet();
  el.innerHTML = `
    <div class="add-head">
      <button class="icon-btn" data-a="close" aria-label="Close">✕</button>
      <div class="seg"><button data-type="expense">Expense</button><button data-type="income">Income</button></div>
      ${st.id ? '<button class="icon-btn" data-a="delete" aria-label="Delete">🗑️</button>' : '<span style="width:44px"></span>'}
    </div>
    <div class="amount num" id="amt"></div>
    <div class="add-body">
      <div class="cat-grid" id="cats"></div>
      <div class="chips" id="methods"></div>
      <div class="add-meta">
        <label class="chip">📅 <span id="dateLbl"></span><input type="date" id="dateIn" required></label>
        <input class="note" id="note" placeholder="Note (optional)" maxlength="120" enterkeyhint="done" autocomplete="off">
      </div>
    </div>
    <div class="keypad">
      ${['1', '2', '3', 'del', '4', '5', '6', 'save', '7', '8', '9', '.', '0', '00'].map((k) =>
        k === 'save' ? `<button class="save" data-a="save">${st.id ? 'Update' : 'Save'}</button>`
        : k === 'del' ? '<button class="fn" data-k="del" aria-label="Delete digit">⌫</button>'
        : `<button data-k="${k}">${k}</button>`).join('')}
    </div>`;
  $('#note', el).value = st.note;
  $('#dateIn', el).value = st.date;
  el.onclick = onClick;
  $('#note', el).oninput = (e) => { st.note = e.target.value; };
  $('#note', el).onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  $('#dateIn', el).onchange = (e) => { st.date = e.target.value || today(); paintDate(); };
  paintType(); paintAmount(); paintCats(); paintMethods(); paintDate();
}

function paintType() {
  sheet().querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === st.type));
  $('#amt').className = `amount num ${st.type}`;
}
function paintAmount() {
  const [i, f] = st.amt.split('.');
  const whole = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  $('#amt').innerHTML = `<span class="cur">${esc(currency())}</span>${whole}${f !== undefined ? '.' + f : ''}`;
}
function paintCats() {
  $('#cats').innerHTML = catsByUsage(st.type).map((c) =>
    `<button class="cat ${c.id === st.categoryId ? 'on' : ''}" data-cat="${c.id}"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}</span></button>`).join('');
}
function paintMethods() {
  $('#methods').innerHTML = activeMethods().map((m) =>
    `<button class="chip ${m.id === st.methodId ? 'on' : ''}" data-m="${m.id}">${m.icon} ${esc(m.name)}</button>`).join('');
}
function paintDate() { $('#dateLbl').textContent = dayLabel(st.date); }

function press(k) {
  if (st.fresh && k !== 'del') st.amt = '';
  st.fresh = false;
  let s = st.amt;
  if (k === 'del') s = s.slice(0, -1);
  else if (k === '.') { if (!s.includes('.')) s = (s || '0') + '.'; }
  else {
    const [i, f] = s.split('.');
    if (f !== undefined) { if (f.length >= 2) return; s += k.slice(0, 2 - f.length); }
    else {
      if (i.length + k.length > 9) return;
      s = s === '0' || s === '' ? (k === '00' ? '0' : k.replace(/^0(?=\d)/, '')) : s + k;
    }
  }
  st.amt = s;
  paintAmount();
}

function onKey(e) {
  if (!st || e.target.matches('input')) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === '.' || e.key === ',') press('.');
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter') save();
  else if (e.key === 'Escape') closeAdd();
  else return;
  e.preventDefault();
}

async function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.k) return press(b.dataset.k);
  if (b.dataset.cat) { st.categoryId = b.dataset.cat; return paintCats(); }
  if (b.dataset.m) { st.methodId = b.dataset.m; return paintMethods(); }
  if (b.dataset.type && b.dataset.type !== st.type) {
    st.type = b.dataset.type;
    st.categoryId = pickCat(st.type, st.orig?.type === st.type ? st.orig.categoryId : state.last[st.type]);
    paintType(); paintCats();
    return;
  }
  if (b.dataset.a === 'close') return closeAdd();
  if (b.dataset.a === 'save') return save();
  if (b.dataset.a === 'delete') {
    if (!(await confirmDialog('Delete this record?', `${fmt(st.orig.amount)} · ${catById(st.orig.categoryId).name}`, 'Delete', true))) return;
    await del('transactions', st.id);
    closeAdd();
    emit('changed');
    toast('Record deleted');
  }
}

async function save() {
  const orig = st.orig || null;
  const cents = parseToCents(st.amt);
  const amtEl = $('#amt');
  if (cents <= 0 || !st.categoryId) {
    amtEl.classList.remove('shake'); void amtEl.offsetWidth; amtEl.classList.add('shake');
    return;
  }
  const isNew = !st.id;
  const t = {
    ...(st.orig || {}),
    id: st.id || uid(),
    type: st.type,
    amount: cents,
    categoryId: st.categoryId,
    methodId: st.methodId || '',
    date: st.date || today(),
    note: st.note.trim(),
    createdAt: st.orig?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  delete t.sample;
  await put('transactions', t);
  if (isNew) {
    bumpUsage(t);
    state.last[t.type] = t.categoryId;
    state.last.method = t.methodId;
    setMeta('last', state.last);
    navigator.storage?.persist?.();
  }
  closeAdd();
  emit('changed');
  const alert = await budgetAlert(t, orig);
  const msg = `${isNew ? 'Saved' : 'Updated'} ${fmt(cents)} · ${catById(t.categoryId).name}${alert ? `\n${alert}` : ''}`;
  if (isNew) toast(msg, { ms: alert ? 6000 : 3200, actionLabel: 'Undo', onAction: async () => { await del('transactions', t.id); emit('changed'); } });
  else toast(msg, { ms: alert ? 6000 : 3200 });
}
