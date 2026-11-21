import { $, esc, toast, uid, modal, confirmDialog } from '../util.js';
import { getAll, put, del } from '../db.js';
import { fmt, parseToCents, currency } from '../money.js';
import { today, parseDate } from '../dates.js';
import { goalPlan } from '../stats.js';
import { setTitle } from './common.js';

const ICONS = ['🎯', '🗾', '✈️', '🏠', '🚗', '💻', '📱', '💍', '🎓', '🛟', '👶', '🏖️', '🎸', '🚲', '🐶', '💰'];
const fmtDate = (d) => parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export async function renderGoals(main) {
  setTitle('Savings goals', { back: '#/more' });
  const td = today();
  const goals = (await getAll('goals')).sort((a, b) => (a.saved >= a.target) - (b.saved >= b.target) || String(a.deadline || '9').localeCompare(String(b.deadline || '9')));
  main.innerHTML = `${goals.length ? goals.map((g) => {
    const p = goalPlan(g, td), done = g.saved >= g.target;
    return `<div class="card goal" data-id="${esc(g.id)}">
      <div class="b-top"><span class="b-name" style="font-size:17px">${g.icon || '🎯'} ${esc(g.name)}</span><button class="icon-btn small" data-a="edit" aria-label="Edit">✎</button></div>
      <div class="goal-amt num"><b>${fmt(g.saved)}</b> <span class="muted">of ${fmt(g.target)}</span></div>
      <div class="bar goal ${done ? 'done' : ''}"><i style="width:${p.pct.toFixed(1)}%"></i></div>
      <div class="b-sub"><span>${done ? '🎉 Goal reached!' : `${Math.floor(p.pct)}% · ${fmt(p.remaining)} to go`}</span>
        <span>${g.deadline ? (p.overdue && !done ? `⚠️ was due ${fmtDate(g.deadline)}` : `by ${fmtDate(g.deadline)}`) : ''}</span></div>
      ${!done && p.perMonth ? `<p class="muted small" style="margin:8px 0 0">Save <b>${fmt(Math.ceil(p.perMonth / 100) * 100, { noCents: true })}</b> a month for ${p.monthsLeft} month${p.monthsLeft === 1 ? '' : 's'} to make it.</p>` : ''}
      <div class="btn-row"><button class="btn secondary" data-a="add">+ Add money</button><button class="btn secondary" data-a="take">− Withdraw</button></div></div>`;
  }).join('') : '<div class="empty"><div class="big">🐷</div>No goals yet.<br>Saving for a trip, a laptop or an emergency fund?</div>'}
    <button class="btn block" id="add">+ New goal</button>`;
  const refresh = () => renderGoals(main);
  main.onclick = (e) => {
    const card = e.target.closest('[data-id]'), a = e.target.closest('[data-a]')?.dataset.a;
    if (!card || !a) return;
    const g = goals.find((x) => x.id === card.dataset.id);
    if (a === 'edit') editGoal(g, refresh);
    else contribute(g, a === 'add' ? 1 : -1, refresh);
  };
  $('#add').onclick = () => editGoal(null, refresh);
}

function contribute(g, sign, refresh) {
  modal((box, close) => {
    box.innerHTML = `<h2>${sign > 0 ? 'Add to' : 'Withdraw from'} ${esc(g.name)}</h2>
      <label class="field"><span>Amount (${esc(currency())})</span><input id="amt" inputmode="decimal" placeholder="0.00"></label>
      <div class="btn-row"><button class="btn secondary" data-a="cancel">Cancel</button><button class="btn" data-a="ok">${sign > 0 ? 'Add' : 'Withdraw'}</button></div>`;
    const input = $('#amt', box);
    setTimeout(() => input.focus(), 50);
    box.onclick = async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') close();
      if (a === 'ok') {
        const v = parseToCents(input.value);
        if (v <= 0) return input.focus();
        const delta = sign * Math.min(v, sign < 0 ? g.saved : Infinity);
        const wasDone = g.saved >= g.target;
        const upd = { ...g, saved: g.saved + delta, history: [...(g.history || []), { date: today(), amount: delta }] };
        await put('goals', upd);
        close();
        toast(!wasDone && upd.saved >= upd.target ? `🎉 You reached “${g.name}”!` : `${sign > 0 ? 'Added' : 'Withdrew'} ${fmt(Math.abs(delta))}`);
        refresh();
      }
    };
  });
}

function editGoal(goal, refresh) {
  const isNew = !goal;
  const g = goal ? { ...goal } : { id: uid(), name: '', icon: '🎯', target: 0, saved: 0, deadline: '', createdAt: Date.now(), history: [] };
  modal((box, close) => {
    box.innerHTML = `<h2>${isNew ? 'New' : 'Edit'} savings goal</h2>
      <label class="field"><span>Name</span><input id="nm" maxlength="40" placeholder="e.g. Japan trip" value="${esc(g.name)}"></label>
      <div class="field"><span>Icon</span><div class="emoji-grid">${ICONS.map((i) => `<button data-e="${i}" class="${i === g.icon ? 'on' : ''}">${i}</button>`).join('')}</div></div>
      <div class="two"><label class="field"><span>Target (${esc(currency())})</span><input id="target" inputmode="decimal" value="${g.target ? (g.target / 100).toFixed(2).replace(/\.00$/, '') : ''}"></label>
      <label class="field"><span>Saved so far</span><input id="saved" inputmode="decimal" value="${g.saved ? (g.saved / 100).toFixed(2).replace(/\.00$/, '') : ''}" placeholder="0"></label></div>
      <label class="field"><span>Deadline (optional)</span><input id="dl" type="date" value="${g.deadline || ''}"></label>
      <div class="btn-row"><button class="btn secondary" data-a="cancel">Cancel</button><button class="btn" data-a="save">Save</button></div>
      ${isNew ? '' : '<div class="btn-row"><button class="btn danger" data-a="delete">Delete goal</button></div>'}`;
    if (isNew) setTimeout(() => $('#nm', box).focus(), 50);
    box.onclick = async (e) => {
      const em = e.target.closest('[data-e]');
      if (em) { g.icon = em.dataset.e; box.querySelectorAll('[data-e]').forEach((b) => b.classList.toggle('on', b === em)); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') close();
      if (a === 'delete') { close(); if (await confirmDialog(`Delete “${g.name}”?`, 'This only removes the goal, not any records.', 'Delete', true)) { await del('goals', g.id); refresh(); } }
      if (a === 'save') {
        g.name = $('#nm', box).value.trim(); g.target = parseToCents($('#target', box).value); g.saved = Math.max(0, parseToCents($('#saved', box).value)); g.deadline = $('#dl', box).value;
        if (!g.name) return $('#nm', box).focus();
        if (g.target <= 0) return $('#target', box).focus();
        await put('goals', g); close(); toast('Goal saved'); refresh();
      }
    };
  });
}
