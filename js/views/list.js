import { $, esc } from '../util.js';
import { txBetween, firstTxDate } from '../db.js';
import { state, catById, methodById } from '../state.js';
import { fmt } from '../money.js';
import { thisMonth, monthRange, monthLabel, monthsBetween, monthOf } from '../dates.js';
import { setTitle, groupByDay, dayGroupsHTML, sortTx } from './common.js';

// Filters persist while the app is open.
const f = { month: thisMonth(), cat: '', method: '', q: '', limit: 150 };
let all = [];

export function setListFilter(patch) { Object.assign(f, { cat: '', method: '', q: '' }, patch); }

export async function renderList(main) {
  const first = await firstTxDate();
  const months = monthsBetween(first ? monthOf(first) : thisMonth(), thisMonth()).reverse();
  if (f.month !== 'all' && !months.includes(f.month)) months.unshift(f.month);
  const catOpts = (type, label) => `<optgroup label="${label}">${state.categories.filter((c) => c.type === type)
    .map((c) => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</optgroup>`;
  const chip = (on, label, select) => `<label class="fchip ${on ? 'on' : ''}">${label}${select}</label>`;

  setTitle('Records', {
    extra: `<input class="search" id="q" type="search" placeholder="Search notes, categories, amounts" value="${esc(f.q)}" autocomplete="off">
      <div class="filters">
        ${chip(true, f.month === 'all' ? 'All time' : monthLabel(f.month, true),
          `<select id="fMonth"><option value="all">All time</option>${months.map((m) => `<option value="${m}" ${m === f.month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>`)}
        ${chip(f.cat, f.cat ? esc(catById(f.cat).name) : 'Category',
          `<select id="fCat"><option value="">All categories</option>${catOpts('expense', 'Expenses')}${catOpts('income', 'Income')}</select>`)}
        ${chip(f.method, f.method ? esc(methodById(f.method).name) : 'Method',
          `<select id="fMethod"><option value="">All methods</option>${state.methods.map((m) => `<option value="${m.id}" ${f.method === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`)}
        ${f.cat || f.method || f.q ? '<button class="fchip" id="fClear" style="border:0">✕ Clear</button>' : ''}
      </div>`,
  });

  const [s, e] = f.month === 'all' ? ['0000-01-01', '9999-12-31'] : monthRange(f.month);
  all = (await txBetween(s, e)).sort(sortTx);

  main.innerHTML = '<div id="results"></div>';
  const rerender = () => renderList(main);
  $('#fMonth').onchange = (ev) => { f.month = ev.target.value; f.limit = 150; rerender(); };
  $('#fCat').onchange = (ev) => { f.cat = ev.target.value; rerender(); };
  $('#fMethod').onchange = (ev) => { f.method = ev.target.value; rerender(); };
  $('#fClear') && ($('#fClear').onclick = () => { f.cat = f.method = f.q = ''; rerender(); });
  let timer;
  $('#q').oninput = (ev) => { clearTimeout(timer); timer = setTimeout(() => { f.q = ev.target.value; f.limit = 150; paint(); }, 150); };
  paint();
}

function matches(t, q) {
  if (!q) return true;
  const hay = `${t.note} ${catById(t.categoryId).name} ${methodById(t.methodId).name} ${fmt(t.amount)} ${(t.amount / 100).toFixed(2)}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function paint() {
  const res = $('#results');
  if (!res) return;
  const list = all.filter((t) => (!f.cat || t.categoryId === f.cat) && (!f.method || t.methodId === f.method) && matches(t, f.q));
  let inc = 0, exp = 0;
  for (const t of list) t.type === 'income' ? (inc += t.amount) : (exp += t.amount);
  if (!list.length) {
    res.innerHTML = `<div class="empty"><div class="big">🧾</div>${all.length ? 'No records match these filters.' : 'No records yet.<br>Tap <b>+</b> to add your first one.'}</div>`;
    return;
  }
  const shown = list.slice(0, f.limit);
  res.innerHTML = `<div class="summary-line"><span>${list.length} record${list.length > 1 ? 's' : ''}</span>
      <span class="num"><span class="inc">In ${fmt(inc)}</span> · Out ${fmt(exp)}</span></div>
    ${dayGroupsHTML(groupByDay(shown))}
    ${list.length > shown.length ? `<button class="btn secondary block" id="more" style="margin-top:14px">Show more (${list.length - shown.length} left)</button>` : ''}
    <p class="muted" style="text-align:center;font-size:13px;margin-top:16px">Swipe left on a record to edit or delete</p>`;
  const more = $('#more');
  if (more) more.onclick = () => { f.limit += 300; paint(); };
}
