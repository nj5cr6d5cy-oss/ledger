import { $, esc, emit, toast, modal } from '../util.js';
import { getAll, put, del, txBetween } from '../db.js';
import { activeCats, catById } from '../state.js';
import { fmt, parseToCents, currency } from '../money.js';
import { thisMonth, monthRange, monthLabel, daysInMonth, today } from '../dates.js';
import { budgetStatus, budgetCrossed } from '../stats.js';
import { monthOf } from '../dates.js';
import { setTitle } from './common.js';

export const TOTAL = '__total';

export async function budgetUsage(mk = thisMonth()) {
  const [budgets, txs] = await Promise.all([getAll('budgets'), txBetween(...monthRange(mk))]);
  const spent = new Map();
  let total = 0;
  for (const t of txs) if (t.type === 'expense') { spent.set(t.categoryId, (spent.get(t.categoryId) || 0) + t.amount); total += t.amount; }
  spent.set(TOTAL, total);
  return { budgets: new Map(budgets.map((b) => [b.categoryId, b.amount])), spent };
}

export function budgetRowHTML(id, spent, budget) {
  const c = id === TOTAL ? { icon: '📊', name: 'All spending' } : catById(id);
  const s = budgetStatus(spent, budget);
  const status = s.level === 'over' ? '<span class="lvl over">⛔ Over budget</span>' : s.level === 'warn' ? `<span class="lvl warn">⚠️ ${Math.floor(s.pct)}% used</span>` : '';
  return `<div class="budget" data-b="${esc(id)}">
    <div class="b-top"><span class="b-name">${c.icon} ${esc(c.name)}</span><span class="num b-amt">${fmt(spent, { noCents: true })} <span class="muted">/ ${fmt(budget, { noCents: true })}</span></span></div>
    <div class="bar ${s.level}"><i style="width:${Math.min(100, s.pct).toFixed(1)}%"></i></div>
    <div class="b-sub"><span>${s.left >= 0 ? `${fmt(s.left)} left` : `${fmt(-s.left)} over`}</span>${status}</div></div>`;
}

export async function renderBudgets(main) {
  setTitle('Budgets', { back: '#/more' });
  const mk = thisMonth();
  const { budgets, spent } = await budgetUsage(mk);
  const cats = activeCats('expense');
  const withB = [TOTAL, ...cats.map((c) => c.id)].filter((id) => budgets.has(id))
    .sort((a, b) => (a === TOTAL ? -1 : b === TOTAL ? 1 : (spent.get(b) || 0) / budgets.get(b) - (spent.get(a) || 0) / budgets.get(a)));
  const without = [TOTAL, ...cats.map((c) => c.id)].filter((id) => !budgets.has(id));
  const day = Number(today().slice(8)), dim = daysInMonth(mk);
  main.innerHTML = `
    <p class="muted small" style="margin:0 4px 10px">${monthLabel(mk)} · day ${day} of ${dim} (${Math.round((day / dim) * 100)}% of the month). You'll get a warning at 80% and 100%.</p>
    ${withB.length ? `<div class="card budgets">${withB.map((id) => budgetRowHTML(id, spent.get(id) || 0, budgets.get(id))).join('')}</div>` : '<div class="empty"><div class="big">🎯</div>No budgets yet. Pick a category below to set a monthly limit.</div>'}
    ${without.length ? `<div class="section-title">Set a budget</div><div class="menu">${without.map((id) => {
      const c = id === TOTAL ? { icon: '📊', name: 'All spending (overall)' } : catById(id);
      return `<button data-b="${esc(id)}"><span>${c.icon}</span><span class="grow">${esc(c.name)}</span><span class="muted small">${fmt(spent.get(id) || 0, { noCents: true })} spent</span></button>`;
    }).join('')}</div>` : ''}`;
  main.onclick = (e) => { const b = e.target.closest('[data-b]'); if (b) editBudget(b.dataset.b, budgets.get(b.dataset.b), () => renderBudgets(main)); };
}

export function editBudget(id, current, refresh) {
  const c = id === TOTAL ? { icon: '📊', name: 'All spending' } : catById(id);
  modal((box, close) => {
    box.innerHTML = `<h2>${c.icon} ${esc(c.name)}</h2>
      <label class="field"><span>Monthly budget (${esc(currency())})</span><input id="amt" inputmode="decimal" placeholder="0" value="${current ? (current / 100).toFixed(2).replace(/\.00$/, '') : ''}"></label>
      <div class="btn-row"><button class="btn secondary" data-a="cancel">Cancel</button><button class="btn" data-a="save">Save</button></div>
      ${current ? '<div class="btn-row"><button class="btn danger" data-a="remove">Remove budget</button></div>' : ''}`;
    const input = $('#amt', box);
    setTimeout(() => input.focus(), 50);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') close();
      if (a === 'save') {
        const amount = parseToCents(input.value);
        if (amount <= 0) { input.focus(); return; }
        await put('budgets', { categoryId: id, amount }); close(); toast(`Budget set: ${fmt(amount)}/month`); refresh(); emit('budgets');
      }
      if (a === 'remove') { await del('budgets', id); close(); toast('Budget removed'); refresh(); emit('budgets'); }
    };
  });
}

/** After saving an expense: a warning string if it pushed a budget past 80% / 100%. */
export async function budgetAlert(t, orig) {
  if (t.type !== 'expense') return null;
  const mk = monthOf(t.date);
  const { budgets, spent } = await budgetUsage(mk);
  const sameMonth = orig && orig.type === 'expense' && monthOf(orig.date) === mk;
  const alerts = [];
  for (const id of [t.categoryId, TOTAL]) {
    const budget = budgets.get(id);
    if (!budget) continue;
    const after = spent.get(id) || 0;
    const prevPart = sameMonth && (id === TOTAL || orig.categoryId === id) ? orig.amount : 0;
    const crossed = budgetCrossed(after - t.amount + prevPart, after, budget);
    if (crossed) {
      const name = id === TOTAL ? 'Monthly' : catById(id).name;
      alerts.push(crossed === 100 ? `⛔ ${name} budget exceeded (${fmt(after, { noCents: true })} of ${fmt(budget, { noCents: true })})` : `⚠️ ${name} budget ${Math.floor((after / budget) * 100)}% used`);
    }
  }
  return alerts.length ? alerts.join(' · ') : null;
}
