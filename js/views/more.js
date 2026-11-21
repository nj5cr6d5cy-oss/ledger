import { $, esc, emit, toast, uid, modal, confirmDialog } from '../util.js';
import { put, putMany, del, getAll, getMeta, setMeta, clearStores } from '../db.js';
import { state, ensureDefaults, loadRefs, loadUsage } from '../state.js';
import { setCurrency } from '../money.js';
import { EMOJIS, COLORS } from '../defaults.js';
import { makeSampleTransactions, makeSampleExtras } from '../sample.js';
import { setTitle } from './common.js';
import { renderBudgets } from './budgets.js';
import { renderRecurring } from './recurringView.js';
import { renderGoals } from './goals.js';
import { showYear } from './statement.js';
import { exportJSON, exportCSV, importBackup, validateBackup } from '../backup.js';
import { hasPin, choosePin, pinPad, checkPin, clearPin } from '../lock.js';
import { dayLabel } from '../dates.js';

export async function renderMore(main, sub = []) {
  if (sub[0] === 'categories') return renderItems(main, 'category', sub[1] === 'income' ? 'income' : 'expense');
  if (sub[0] === 'methods') return renderItems(main, 'method');
  if (sub[0] === 'budgets') return renderBudgets(main);
  if (sub[0] === 'recurring') return renderRecurring(main);
  if (sub[0] === 'goals') return renderGoals(main);
  if (sub[0] === 'backup') return renderBackup(main);
  setTitle('More');
  const pinOn = await hasPin();
  main.innerHTML = `
    <div class="section-title">Planning</div>
    <div class="menu">
      <a href="#/more/budgets" class="chev"><span>🎯</span><span class="grow">Budgets</span></a>
      <a href="#/more/recurring" class="chev"><span>🔁</span><span class="grow">Recurring transactions</span></a>
      <a href="#/more/goals" class="chev"><span>🐷</span><span class="grow">Savings goals</span></a>
      <button class="chev" data-a="year"><span>📊</span><span class="grow">Yearly summary</span></button>
    </div>
    <div class="section-title">Setup</div>
    <div class="menu">
      <a href="#/more/categories" class="chev"><span>🏷️</span><span class="grow">Categories</span></a>
      <a href="#/more/methods" class="chev"><span>💳</span><span class="grow">Payment methods</span></a>
      <label><span>💲</span><span class="grow">Currency symbol</span><input type="text" id="cur" maxlength="4" value="${esc(await getMeta('currency', '$'))}"></label>
    </div>
    <div class="section-title">Security & data</div>
    <div class="menu">
      <button data-a="pin"><span>🔒</span><span class="grow">App lock (PIN)</span><span class="muted">${pinOn ? 'On' : 'Off'}</span></button>
      <a href="#/more/backup" class="chev"><span>💾</span><span class="grow">Backup & restore</span></a>
    </div>
    <div class="menu">
      <button data-a="sample"><span>✨</span><span class="grow">Load sample data</span></button>
      <button data-a="clear" class="danger-text"><span>🗑️</span><span class="grow">Clear all data</span></button>
    </div>
    <p class="muted" style="font-size:13px;text-align:center;margin-top:24px">Ledger · all data stays on this device</p>`;
  $('#cur').onchange = async (e) => { const v = e.target.value.trim() || '$'; await setMeta('currency', v); setCurrency(v); toast(`Currency set to ${v}`); emit('changed'); };
  main.querySelector('[data-a=sample]').onclick = loadSample;
  main.querySelector('[data-a=clear]').onclick = clearAll;
  main.querySelector('[data-a=year]').onclick = showYear;
  main.querySelector('[data-a=pin]').onclick = async () => {
    if (!pinOn) { if (await choosePin()) toast('App lock is on'); }
    else {
      const ok = await pinPad({ title: 'Enter current PIN', sub: 'to turn off App lock', onPin: checkPin });
      if (ok) { await clearPin(); toast('App lock is off'); }
    }
    renderMore(main);
  };
}

async function renderBackup(main) {
  setTitle('Backup & restore', { back: '#/more' });
  const last = await getMeta('lastBackup');
  const count = (await getAll('transactions')).length;
  main.innerHTML = `
    <div class="card"><p style="margin:0 0 6px"><b>Your data lives only on this phone.</b></p>
      <p class="muted small" style="margin:0">If you delete the app, lose the phone or clear Safari data, it's gone. Back up monthly and save the file to iCloud Drive or Files. You'll get a reminder every 30 days.</p>
      <p class="small" style="margin:10px 0 0">Last backup: <b>${last ? dayLabel(last.slice(0, 10)) : 'never'}</b> · ${count} records</p></div>
    <div class="menu">
      <button data-a="json"><span>💾</span><span class="grow">Back up everything (JSON)<div class="muted small">Full backup you can restore later</div></span></button>
      <button data-a="csv"><span>📄</span><span class="grow">Export records (CSV)<div class="muted small">Opens in Excel, Numbers, Google Sheets</div></span></button>
    </div>
    <div class="menu">
      <label style="cursor:pointer"><span>📥</span><span class="grow">Restore from backup (JSON)<div class="muted small">Replaces all data on this device</div></span><input type="file" id="file" accept=".json,application/json" hidden></label>
    </div>`;
  main.querySelector('[data-a=json]').onclick = async () => { await exportJSON(); renderBackup(main); };
  main.querySelector('[data-a=csv]').onclick = exportCSV;
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const info = validateBackup(obj);
      const when = info.exportedAt ? new Date(info.exportedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown date';
      if (!(await confirmDialog('Restore this backup?', `Backup from ${when} with ${info.transactions} records. This REPLACES everything currently on this device (${count} records).`, 'Restore', true))) return;
      await importBackup(obj);
      await loadRefs(); await loadUsage();
      emit('changed');
      toast(`Restored ${info.transactions} records`);
    } catch (err) {
      await confirmDialog("Couldn't restore", err.message || String(err), 'OK');
    }
  };
}

export async function loadSample() {
  const hasData = (await getAll('transactions')).some((t) => !t.sample);
  if (hasData && !(await confirmDialog('Add sample data?', 'You already have your own records. Sample records will be mixed in (they can be removed with "Clear all data").', 'Add samples'))) return;
  await putMany('transactions', makeSampleTransactions());
  const extra = makeSampleExtras();
  await putMany('budgets', extra.budgets);
  await putMany('goals', extra.goals);
  await putMany('recurring', extra.recurring);
  await loadUsage();
  emit('changed');
  toast('Sample data loaded');
}

async function clearAll() {
  if (!(await confirmDialog('Clear all data?', 'This permanently deletes every record, category, budget and setting on this device.', 'Continue', true))) return;
  if (!(await confirmDialog('Are you absolutely sure?', 'This cannot be undone. Consider exporting a backup first.', 'Delete everything', true))) return;
  await clearStores();
  await ensureDefaults();
  await loadRefs();
  await loadUsage();
  emit('changed');
  toast('All data cleared');
}

/* ---------- Categories & payment methods editor ---------- */
function renderItems(main, kind, type) {
  const isCat = kind === 'category';
  const items = isCat ? state.categories.filter((c) => c.type === type) : state.methods;
  setTitle(isCat ? 'Categories' : 'Payment methods', {
    back: '#/more',
    extra: isCat ? `<div class="seg full"><button class="${type === 'expense' ? 'on' : ''}" data-t="expense">Expense</button><button class="${type === 'income' ? 'on' : ''}" data-t="income">Income</button></div>` : '',
  });
  if (isCat) document.querySelectorAll('#topbar-extra [data-t]').forEach((b) => (b.onclick = () => (location.hash = `#/more/categories/${b.dataset.t}`)));
  main.innerHTML = `<div class="menu">${items.map((it, i) => `
      <div data-id="${it.id}">
        <span style="font-size:22px">${it.icon}</span>
        <span class="grow" data-edit>${esc(it.name)} ${it.archived ? '<span class="archived-tag">hidden</span>' : ''}</span>
        <span class="reorder"><button data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-mv="1" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span>
      </div>`).join('')}</div>
    <button class="btn block" id="addItem">+ Add ${isCat ? `${type} category` : 'payment method'}</button>
    <p class="muted" style="font-size:13px;text-align:center;margin-top:14px">Tap a row to rename, change its icon${isCat ? '/colour' : ''}, hide or delete it.</p>`;
  main.onclick = async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const idx = items.findIndex((x) => x.id === row.dataset.id);
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const j = idx + Number(mv.dataset.mv);
      if (j < 0 || j >= items.length) return;
      const a = items[idx], b = items[j];
      [a.order, b.order] = [b.order, a.order];
      if (a.order === b.order) b.order += Number(mv.dataset.mv) > 0 ? -1 : 1;
      await putMany(isCat ? 'categories' : 'methods', [a, b]);
      await loadRefs();
      renderItems(main, kind, type);
    } else editItem(kind, items[idx], type, () => renderItems(main, kind, type));
  };
  $('#addItem').onclick = () => editItem(kind, null, type, () => renderItems(main, kind, type));
}

function editItem(kind, item, type, refresh) {
  const isCat = kind === 'category', store = isCat ? 'categories' : 'methods';
  const all = isCat ? state.categories : state.methods;
  const isNew = !item;
  const it = item ? { ...item } : { id: uid(), name: '', icon: isCat ? '📦' : '💳', order: Math.max(0, ...all.map((x) => x.order)) + 1, archived: false, ...(isCat ? { type, color: COLORS[all.length % COLORS.length] } : {}) };

  modal((box, close) => {
    box.innerHTML = `<h2>${isNew ? 'New' : 'Edit'} ${isCat ? `${type} category` : 'payment method'}</h2>
      <label class="field"><span>Name</span><input id="nm" maxlength="30" value="${esc(it.name)}" placeholder="Name"></label>
      <div class="field"><span>Icon</span><div class="emoji-grid">${EMOJIS.map((e) => `<button data-e="${e}" class="${e === it.icon ? 'on' : ''}">${e}</button>`).join('')}</div>
        <input id="em" placeholder="…or type any emoji" style="margin-top:8px" maxlength="8"></div>
      ${isCat ? `<div class="field"><span>Colour</span><div class="swatches">${COLORS.map((c) => `<button data-c="${c}" class="${c === it.color ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>` : ''}
      <div class="btn-row"><button class="btn secondary" data-a="cancel">Cancel</button><button class="btn" data-a="save">Save</button></div>
      ${isNew ? '' : `<div class="btn-row"><button class="btn danger" data-a="remove">${it.archived ? 'Unhide' : 'Hide / delete'}</button></div>`}`;
    const nm = $('#nm', box);
    if (isNew) setTimeout(() => nm.focus(), 50);
    $('#em', box).oninput = (e) => { const v = e.target.value.trim(); if (v) { it.icon = [...new Intl.Segmenter().segment(v)][0]?.segment || v; box.querySelectorAll('[data-e]').forEach((b) => b.classList.remove('on')); } };
    box.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.e) { it.icon = b.dataset.e; box.querySelectorAll('[data-e]').forEach((x) => x.classList.toggle('on', x === b)); }
      else if (b.dataset.c) { it.color = b.dataset.c; box.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }
      else if (b.dataset.a === 'cancel') close();
      else if (b.dataset.a === 'save') {
        it.name = nm.value.trim();
        if (!it.name) { nm.focus(); return; }
        await put(store, it); await loadRefs(); close(); refresh(); emit('refs');
      } else if (b.dataset.a === 'remove') {
        close();
        await removeItem(kind, it);
        await loadRefs(); refresh(); emit('refs');
      }
    };
  });
}

async function removeItem(kind, it) {
  const isCat = kind === 'category', store = isCat ? 'categories' : 'methods';
  if (it.archived) { it.archived = false; await put(store, it); toast(`${it.name} is visible again`); return; }
  const siblings = (isCat ? state.categories.filter((c) => c.type === it.type) : state.methods).filter((x) => !x.archived && x.id !== it.id);
  if (!siblings.length) { toast(`Keep at least one ${isCat ? 'category' : 'method'}`); return; }
  const used = (await getAll('transactions')).filter((t) => (isCat ? t.categoryId : t.methodId) === it.id).length;
  if (used) {
    if (!(await confirmDialog(`Hide “${it.name}”?`, `It's used by ${used} record${used > 1 ? 's' : ''}, so it will be hidden from Quick Add but kept in your history.`, 'Hide'))) return;
    it.archived = true; await put(store, it); toast(`${it.name} hidden`);
  } else {
    if (!(await confirmDialog(`Delete “${it.name}”?`, 'No records use it.', 'Delete', true))) return;
    await del(store, it.id); toast(`${it.name} deleted`);
  }
}
