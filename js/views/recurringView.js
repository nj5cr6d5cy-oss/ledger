import { $, esc, emit, toast, uid, modal, confirmDialog } from '../util.js';
import { getAll, put, del } from '../db.js';
import { state, catById, methodById, activeCats, activeMethods } from '../state.js';
import { fmt, parseToCents, currency } from '../money.js';
import { today, dayLabel } from '../dates.js';
import { nextDate, processRecurring, countBefore } from '../recurring.js';
import { setTitle } from './common.js';

const FREQ = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

export async function renderRecurring(main) {
  setTitle('Recurring', { back: '#/more' });
  const rules = (await getAll('recurring')).map((r) => ({ ...r, next: nextDate(r) }))
    .sort((a, b) => (a.active === false) - (b.active === false) || String(a.next || '9').localeCompare(String(b.next || '9')));
  main.innerHTML = `
    <p class="muted small" style="margin:0 4px 10px">Recurring items are added automatically on their date (when you next open the app).</p>
    ${rules.length ? `<div class="menu">${rules.map((r) => {
      const c = catById(r.categoryId);
      const when = r.active === false ? 'Paused' : r.next ? `next ${dayLabel(r.next)}` : 'Ended';
      return `<button data-id="${esc(r.id)}"><span class="tx-icon" style="background:${c.color}26">${c.icon}</span>
        <span class="grow"><div class="tx-title">${esc(r.note || c.name)}</div><div class="tx-sub">${FREQ[r.frequency]} · ${when} · ${esc(methodById(r.methodId).name)}</div></span>
        <span class="num tx-amt ${r.type === 'income' ? 'inc' : ''}">${fmt(r.amount)}</span></button>`;
    }).join('')}</div>` : '<div class="empty"><div class="big">🔁</div>No recurring items yet.<br>Add your salary, rent and subscriptions so they log themselves.</div>'}
    <button class="btn block" id="add">+ Add recurring item</button>`;
  main.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) editRule(rules.find((r) => r.id === b.dataset.id), () => renderRecurring(main)); };
  $('#add').onclick = () => editRule(null, () => renderRecurring(main));
}

function editRule(rule, refresh) {
  const isNew = !rule;
  const r = rule ? { ...rule } : { id: uid(), type: 'expense', amount: 0, categoryId: activeCats('expense')[0]?.id, methodId: activeMethods()[0]?.id, frequency: 'monthly', startDate: today(), endDate: '', note: '', count: 0, active: true };
  const catOptions = () => state.categories.filter((c) => c.type === r.type && (!c.archived || c.id === r.categoryId))
    .map((c) => `<option value="${c.id}" ${c.id === r.categoryId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');

  modal((box, close) => {
    box.innerHTML = `<h2>${isNew ? 'New' : 'Edit'} recurring item</h2>
      <div class="seg full" style="margin-bottom:14px"><button data-t="expense" class="${r.type === 'expense' ? 'on' : ''}">Expense</button><button data-t="income" class="${r.type === 'income' ? 'on' : ''}">Income</button></div>
      <label class="field"><span>Name / note</span><input id="note" maxlength="60" placeholder="e.g. Netflix, Salary, Rent" value="${esc(r.note)}"></label>
      <label class="field"><span>Amount (${esc(currency())})</span><input id="amt" inputmode="decimal" placeholder="0.00" value="${r.amount ? (r.amount / 100).toFixed(2) : ''}"></label>
      <label class="field"><span>Category</span><select id="cat">${catOptions()}</select></label>
      <label class="field"><span>Payment method</span><select id="meth">${state.methods.filter((m) => !m.archived || m.id === r.methodId).map((m) => `<option value="${m.id}" ${m.id === r.methodId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Repeats</span><select id="freq">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${k === r.frequency ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="two"><label class="field"><span>${isNew ? 'First date' : 'Starts'}</span><input id="start" type="date" value="${r.startDate}"></label>
      <label class="field"><span>Ends (optional)</span><input id="end" type="date" value="${r.endDate || ''}"></label></div>
      ${isNew ? '<p class="muted small" style="margin:-4px 4px 12px">If the first date is in the past, the missed entries are added now.</p>'
        : `<label class="switch"><input type="checkbox" id="active" ${r.active !== false ? 'checked' : ''}><span>Active</span></label>`}
      <div class="btn-row"><button class="btn secondary" data-a="cancel">Cancel</button><button class="btn" data-a="save">Save</button></div>
      ${isNew ? '' : '<div class="btn-row"><button class="btn danger" data-a="delete">Delete recurring item</button></div>'}`;
    box.onclick = async (e) => {
      const t = e.target.closest('[data-t]');
      if (t) {
        r.type = t.dataset.t;
        box.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b === t));
        r.categoryId = activeCats(r.type)[0]?.id;
        $('#cat', box).innerHTML = catOptions();
        return;
      }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') close();
      if (a === 'delete') {
        close();
        if (await confirmDialog('Delete this recurring item?', 'Entries already added stay in your records.', 'Delete', true)) { await del('recurring', r.id); toast('Recurring item deleted'); refresh(); }
      }
      if (a === 'save') {
        const amount = parseToCents($('#amt', box).value);
        if (amount <= 0) { $('#amt', box).focus(); return; }
        const updated = { ...r, amount, note: $('#note', box).value.trim(), categoryId: $('#cat', box).value, methodId: $('#meth', box).value,
          frequency: $('#freq', box).value, startDate: $('#start', box).value || today(), endDate: $('#end', box).value || '', active: isNew ? true : $('#active', box).checked };
        // Editing the schedule: don't back-fill the past again, continue from today.
        if (!isNew && (updated.frequency !== rule.frequency || updated.startDate !== rule.startDate)) updated.count = countBefore(updated, today());
        await put('recurring', updated);
        close();
        const added = await processRecurring();
        toast(added ? `Saved · added ${added} entr${added === 1 ? 'y' : 'ies'} up to today` : `Saved · next on ${dayLabel(nextDate(updated) || updated.startDate)}`);
        refresh();
        if (added) emit('changed');
      }
    };
  });
}
