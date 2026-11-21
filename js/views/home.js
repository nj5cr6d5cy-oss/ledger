import { $, esc } from '../util.js';
import { txBetween, getAll, getMeta, setMeta, firstTxDate } from '../db.js';
import { buildStatement, statementBannerMonth, goalPlan, backupDue } from '../stats.js';
import { catById } from '../state.js';
import { fmt } from '../money.js';
import { thisMonth, monthRange, monthLabel, addDays, addMonths, today, daysInMonth } from '../dates.js';
import { donutSVG, lineSVG, attachHover, SERIES } from '../charts.js';
import { showStatement } from './statement.js';
import { setTitle, groupByDay, dayGroupsHTML, sortTx } from './common.js';
import { loadSample } from './more.js';
import { budgetUsage, budgetRowHTML, TOTAL } from './budgets.js';
import { exportJSON } from '../backup.js';

const LAST = '#8e8e93';
let trendMode = 'daily';
try { trendMode = localStorage.getItem('trendMode') || 'daily'; } catch {}

export async function renderHome(main) {
  const mk = thisMonth(), prevMk = addMonths(mk, -1), td = today();
  setTitle(monthLabel(mk));
  const [txs, prevTxs, goals, recentAll, first] = await Promise.all([
    txBetween(...monthRange(mk)), txBetween(...monthRange(prevMk)), getAll('goals'),
    txBetween(addDays(td, -45), '9999-12-31'), firstTxDate(),
  ]);
  let inc = 0, exp = 0;
  for (const t of txs) t.type === 'income' ? (inc += t.amount) : (exp += t.amount);
  const recent = recentAll.sort(sortTx).slice(0, 5);
  const { budgets, spent } = await budgetUsage(mk);

  if (!first) {
    main.innerHTML = `<div id="banner"></div><div class="empty"><div class="big">👋</div>Welcome! Tap <b>+</b> to log your first spending —<br>it takes about 3 seconds.<br><br>Or explore with demo data first:<br><br><button class="btn" id="sample">Load sample data</button></div>`;
    $('#sample').onclick = loadSample;
    return;
  }

  // spending by category (top 6 + Other), colour follows the category
  const byCat = new Map();
  for (const t of txs) if (t.type === 'expense') byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
  let segs = [...byCat].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ id, value, label: catById(id).name, icon: catById(id).icon, color: catById(id).color }));
  if (segs.length > 7) {
    const rest = segs.slice(6);
    segs = [...segs.slice(0, 6), { id: '', value: rest.reduce((s, x) => s + x.value, 0), label: `Other (${rest.length})`, icon: '⋯', color: '#a1a1aa' }];
  }

  const budgetIds = [...budgets.keys()].filter((id) => id === TOTAL || !catById(id).archived)
    .sort((a, b) => (spent.get(b) || 0) / budgets.get(b) - (spent.get(a) || 0) / budgets.get(a)).slice(0, 4);

  main.innerHTML = `
    <div id="banner"></div><div id="banner2"></div>
    <div class="kpis">
      <div class="kpi wide"><div class="lbl">Remaining this month</div><div class="val num ${inc - exp < 0 ? 'exp' : ''}">${fmt(inc - exp)}</div></div>
      <div class="kpi"><div class="lbl">Income</div><div class="val num inc">${fmt(inc)}</div></div>
      <div class="kpi"><div class="lbl">Spending</div><div class="val num">${fmt(exp)}</div></div>
    </div>
    ${budgetIds.length ? `<div class="card budgets"><div class="card-h"><h3>Budgets</h3><a href="#/more/budgets">All ›</a></div>${budgetIds.map((id) => budgetRowHTML(id, spent.get(id) || 0, budgets.get(id))).join('')}</div>`
      : '<a class="card hint" href="#/more/budgets">🎯 Set monthly budgets to get warnings at 80% and 100% ›</a>'}
    ${exp ? `<div class="card"><div class="card-h"><h3>Spending by category</h3></div>
      <div class="donut-wrap">${donutSVG(segs)}</div>
      <div class="legend">${segs.map((s, i) => `<button data-i="${i}"><i style="background:${s.color}"></i><span class="grow">${s.icon} ${esc(s.label)}</span><span class="num">${fmt(s.value, { noCents: true })}</span><span class="pct num">${Math.round((s.value / exp) * 100)}%</span></button>`).join('')}</div></div>` : ''}
    <div class="card"><div class="card-h"><h3>Spending trend</h3>
      <div class="seg mini"><button data-m="daily" class="${trendMode === 'daily' ? 'on' : ''}">Daily</button><button data-m="cumulative" class="${trendMode === 'cumulative' ? 'on' : ''}">Cumulative</button></div></div>
      <div class="chart-wrap" id="trend"></div>
      <div class="key"><span><i style="background:${SERIES.exp}"></i>${monthLabel(mk, true).split(' ')[0]}</span><span><i class="dash" style="border-color:${LAST}"></i>${monthLabel(prevMk, true).split(' ')[0]}</span></div></div>
    ${goals.length ? `<div class="card"><div class="card-h"><h3>Savings goals</h3><a href="#/more/goals">All ›</a></div>${goals.slice(0, 3).map((g) => goalMini(g, td)).join('')}</div>` : ''}
    <div class="section-title">Recent <a href="#/list" style="float:right;text-transform:none;color:var(--accent);text-decoration:none">See all ›</a></div>
    ${dayGroupsHTML(groupByDay(recent))}`;

  // donut interaction: tap a slice or legend row to see it in the centre
  const val = main.querySelector('.d-val'), lbl = main.querySelector('.d-lbl');
  let sel = null;
  const pick = (i) => {
    sel = sel === i ? null : i;
    main.querySelectorAll('.donut .seg').forEach((c, k) => c.classList.toggle('dim', sel !== null && k !== sel));
    main.querySelectorAll('.legend [data-i]').forEach((b, k) => b.classList.toggle('on', k === sel));
    if (val) { val.textContent = fmt(sel === null ? exp : segs[sel].value, { noCents: true }); lbl.textContent = sel === null ? 'Total spent' : segs[sel].label; }
  };
  if (val) val.textContent = fmt(exp, { noCents: true });
  main.querySelectorAll('.donut .seg, .legend [data-i]').forEach((el) => el.addEventListener('click', () => pick(Number(el.dataset.i))));

  drawTrend(mk, prevMk, txs, prevTxs);
  main.querySelectorAll('.seg.mini [data-m]').forEach((b) => (b.onclick = () => {
    trendMode = b.dataset.m;
    try { localStorage.setItem('trendMode', trendMode); } catch {}
    main.querySelectorAll('.seg.mini [data-m]').forEach((x) => x.classList.toggle('on', x === b));
    drawTrend(mk, prevMk, txs, prevTxs);
  }));

  // banners: statement at the start of the month, backup reminder
  const bannerMonth = statementBannerMonth(td, await getMeta('statementSeen'));
  if (bannerMonth) await renderStatementBanner($('#banner'), bannerMonth);
  const due = backupDue({ today: td, lastBackup: await getMeta('lastBackup'), firstUse: await getMeta('initialized'), snoozeUntil: await getMeta('backupSnooze') });
  if (due !== null) renderBackupBanner($('#banner2'), due);
}

function drawTrend(mk, prevMk, txs, prevTxs) {
  const el = $('#trend');
  if (!el) return;
  const n = daysInMonth(mk), pn = daysInMonth(prevMk), todayDay = mk === thisMonth() ? Number(today().slice(8)) : n;
  const daily = (list, len) => { const a = Array(len).fill(0); for (const t of list) if (t.type === 'expense') a[Number(t.date.slice(8)) - 1] += t.amount; return a; };
  const cum = (a) => { let s = 0; return a.map((v) => (s += v)); };
  let cur = daily(txs, n), prev = daily(prevTxs, pn);
  if (trendMode === 'cumulative') { cur = cum(cur); prev = cum(prev); }
  const curV = cur.map((v, i) => (i < todayDay ? v : null));
  const prevV = Array.from({ length: n }, (_, i) => (i < pn ? prev[i] : null));
  const series = [{ values: prevV, color: LAST, dashed: true }, { values: curV, color: SERIES.exp }];
  const labels = Array.from({ length: n }, (_, i) => ([0, 7, 14, 21, 28].includes(i) ? String(i + 1) : ''));
  // Daily mode: scale the axis to typical days so one big payment (e.g. rent) doesn't flatten everything
  let cap = null;
  if (trendMode === 'daily') {
    const vals = [...curV, ...prevV].filter((v) => v > 0).sort((a, b) => a - b);
    if (vals.length >= 5) { const p90 = vals[Math.floor(vals.length * 0.9)]; if (vals[vals.length - 1] > p90 * 2) cap = p90 * 1.5; }
  }
  const chart = lineSVG(series, labels, 170, { cap });
  el.innerHTML = chart.svg;
  const m1 = monthLabel(mk, true).split(' ')[0], m0 = monthLabel(prevMk, true).split(' ')[0];
  attachHover(el, chart, (i) => `<b>${m1} ${i + 1}</b>: ${curV[i] == null ? '—' : fmt(curV[i])}<br><span class="muted">${m0} ${i + 1}: ${prevV[i] == null ? '—' : fmt(prevV[i])}</span>`, { line: series });
}

function goalMini(g, td) {
  const p = goalPlan(g, td);
  return `<a class="goal-mini" href="#/more/goals"><div class="b-top"><span class="b-name">${g.icon || '🎯'} ${esc(g.name)}</span><span class="num b-amt">${Math.floor(p.pct)}%</span></div>
    <div class="bar goal"><i style="width:${p.pct.toFixed(1)}%"></i></div>
    <div class="b-sub"><span>${fmt(g.saved, { noCents: true })} of ${fmt(g.target, { noCents: true })}</span>${p.perMonth ? `<span>${fmt(Math.ceil(p.perMonth / 100) * 100, { noCents: true })}/mo to reach it</span>` : ''}</div></a>`;
}

/** Card summarising last month, shown at the start of each month until dismissed. */
export async function renderStatementBanner(el, mk) {
  const [cur, prev] = await Promise.all([txBetween(...monthRange(mk)), txBetween(...monthRange(addMonths(mk, -1)))]);
  if (!cur.length) return;
  const s = buildStatement(cur, prev);
  const name = monthLabel(mk).split(' ')[0];
  el.innerHTML = `<div class="banner">
    <button class="x" aria-label="Dismiss">✕</button>
    <h3>📄 Your ${name} statement is ready</h3>
    <div class="row num">
      <span>Income<b>${fmt(s.income.total)}</b></span>
      <span>Spent<b>${fmt(s.expense.total)}</b></span>
      <span>${s.net >= 0 ? 'Saved' : 'Deficit'}<b>${fmt(s.net, { sign: true })}</b></span>
      ${s.savingsRate !== null ? `<span>Rate<b>${s.savingsRate.toFixed(0)}%</b></span>` : ''}
    </div>
    <button class="btn block">View ${name} statement</button></div>`;
  el.querySelector('.x').onclick = async () => { await setMeta('statementSeen', mk); el.innerHTML = ''; };
  el.querySelector('.btn').onclick = async () => { await setMeta('statementSeen', mk); showStatement(mk); };
}

export function renderBackupBanner(el, days) {
  el.innerHTML = `<div class="banner warn-banner">
    <h3>💾 Time to back up</h3>
    <p style="margin:0;font-size:14px">${days === Infinity ? "You haven't backed up yet." : `Last backup was ${days} days ago.`} Your data lives only on this phone — save a copy to Files or iCloud Drive.</p>
    <div class="btn-row"><button class="btn" data-a="now">Back up now</button><button class="btn ghost" data-a="later">Remind me in a week</button></div></div>`;
  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'now') { if (await exportJSON()) el.innerHTML = ''; }
    if (a === 'later') { await setMeta('backupSnooze', addDays(today(), 7)); el.innerHTML = ''; }
  };
}
