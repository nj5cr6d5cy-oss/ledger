import { $, esc } from '../util.js';
import { txBetween, firstTxDate } from '../db.js';
import { catById } from '../state.js';
import { fmt } from '../money.js';
import { thisMonth, monthRange, monthLabel, monthsBetween, monthOf, addMonths, today, parseDate, dayLabel } from '../dates.js';
import { buildStatement, yearlySummary } from '../stats.js';
import { barsSVG, attachHover, SERIES } from '../charts.js';
import { setTitle } from './common.js';
import { setListFilter } from './list.js';

let month = thisMonth();
let mode = 'month';
let year = Number(thisMonth().slice(0, 4));
export function showStatement(mk) { month = mk; mode = 'month'; location.hash = '#/statement'; }
export function showYear() { mode = 'year'; location.hash = '#/statement'; }
const modeSeg = () => `<div class="seg full modeseg"><button data-mode="month" class="${mode === 'month' ? 'on' : ''}">Monthly</button><button data-mode="year" class="${mode === 'year' ? 'on' : ''}">Yearly</button></div>`;
function bindModeSeg(main) {
  document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; main.scrollTop = 0; renderStatement(main); }));
}

const pctText = (p) => { const a = Math.abs(p); return `${a < 10 && a !== 0 ? a.toFixed(1) : Math.round(a)}%`; };
/** ↑/↓ badge. goodWhenUp: income rising is good, expenses rising is bad. */
function chg(cur, prev, pct, goodWhenUp) {
  if (pct === null) return cur ? '<span class="chg muted">new</span>' : '<span class="chg muted">—</span>';
  if (Math.abs(pct) < 0.05) return '<span class="chg muted">→ 0%</span>';
  const up = pct > 0;
  return `<span class="chg ${up === goodWhenUp ? 'good' : 'bad'}">${up ? '↑' : '↓'} ${pctText(pct)}</span>`;
}
const rate = (r) => (r === null ? '—' : `${r.toFixed(1)}%`);

export async function renderStatement(main) {
  if (mode === 'year') return renderYear(main);
  const first = await firstTxDate();
  const months = monthsBetween(first ? monthOf(first) : thisMonth(), thisMonth()).reverse();
  if (!months.includes(month)) months.push(month);
  const prevMk = addMonths(month, -1);
  const prevName = monthLabel(prevMk, true).split(' ')[0];

  setTitle('Statement', {
    right: '<button class="icon-btn" id="pdfTop" aria-label="Export as PDF"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button>',
    extra: `${modeSeg()}<div class="month-nav">
      <button data-d="-1" aria-label="Previous month">‹</button>
      <label class="mlabel">${monthLabel(month)} ▾<select id="mSel">${months.map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>
      <button data-d="1" aria-label="Next month" ${month >= thisMonth() ? 'disabled' : ''}>›</button></div>`,
  });

  const [cur, prev] = await Promise.all([txBetween(...monthRange(month)), txBetween(...monthRange(prevMk))]);
  const s = buildStatement(cur, prev);
  const [start, end] = monthRange(month);
  const isCurrent = month === thisMonth();
  const periodEnd = isCurrent ? today() : end;
  const fmtD = (d, y) => parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) });

  const lineRows = (sec, goodWhenUp) => sec.lines.map((l) => {
    const c = catById(l.categoryId);
    return `<tr class="line" data-cat="${esc(l.categoryId)}">
      <td><span class="ci">${c.icon}</span>${esc(c.name)}</td>
      <td class="num r">${fmt(l.amount)}<div class="prev">${prevName} ${fmt(l.prev)}</div></td>
      <td class="r">${chg(l.amount, l.prev, l.change, goodWhenUp)}</td></tr>`;
  }).join('') || '<tr><td colspan="3" class="muted none">None this month</td></tr>';

  const rateDiff = s.savingsRate !== null && s.prevSavingsRate !== null ? s.savingsRate - s.prevSavingsRate : null;
  const surplus = s.net >= 0;

  main.innerHTML = `
    <article class="stmt card">
      <header class="stmt-head">
        <div class="kicker">Monthly statement</div>
        <h2>${monthLabel(month)}</h2>
        <div class="muted small">${fmtD(start)} – ${fmtD(periodEnd, true)}${isCurrent ? ' · month to date' : ''} · ${s.count} record${s.count === 1 ? '' : 's'}</div>
      </header>
      <div class="stmt-kpis">
        <div><div class="lbl">Net ${surplus ? 'surplus' : 'deficit'}</div><div class="big num ${surplus ? 'inc' : 'exp'}">${fmt(s.net, { sign: true })}</div></div>
        <div><div class="lbl">Savings rate</div><div class="big num">${rate(s.savingsRate)}</div></div>
      </div>
      <table class="stmt-table">
        <thead><tr><th></th><th class="r">${monthLabel(month, true).split(' ')[0]}</th><th class="r">vs ${prevName}</th></tr></thead>
        <tbody>
          <tr class="sec"><td colspan="3">Income</td></tr>
          ${lineRows(s.income, true)}
          <tr class="total"><td>Total income</td><td class="num r inc">${fmt(s.income.total)}<div class="prev">${prevName} ${fmt(s.income.prevTotal)}</div></td><td class="r">${chg(s.income.total, s.income.prevTotal, s.income.change, true)}</td></tr>
          <tr class="sec"><td colspan="3">Expenses</td></tr>
          ${lineRows(s.expense, false)}
          <tr class="total"><td>Total expenses</td><td class="num r">${fmt(s.expense.total)}<div class="prev">${prevName} ${fmt(s.expense.prevTotal)}</div></td><td class="r">${chg(s.expense.total, s.expense.prevTotal, s.expense.change, false)}</td></tr>
          <tr class="net"><td>Net income<div class="prev">${surplus ? 'Surplus' : 'Deficit'}</div></td><td class="num r ${surplus ? 'inc' : 'exp'}">${fmt(s.net, { sign: true })}<div class="prev">${prevName} ${fmt(s.prevNet, { sign: true })}</div></td>
            <td class="r">${chg(s.net, s.prevNet, s.netChange, true)}</td></tr>
          <tr class="rate"><td>Savings rate</td><td class="num r">${rate(s.savingsRate)}<div class="prev">${prevName} ${rate(s.prevSavingsRate)}</div></td>
            <td class="r">${rateDiff === null ? '<span class="chg muted">—</span>' : `<span class="chg ${rateDiff >= 0 ? 'good' : 'bad'}">${rateDiff >= 0 ? '↑' : '↓'} ${Math.abs(rateDiff).toFixed(1)} pts</span>`}</td></tr>
        </tbody>
      </table>
      <h3 class="stmt-h3">Top 5 largest expenses</h3>
      ${s.top5.length ? `<ol class="top5">${s.top5.map((t) => { const c = catById(t.categoryId); return `<li data-id="${esc(t.id)}">
          <span class="ci">${c.icon}</span><div class="grow"><div>${esc(t.note || c.name)}</div><div class="prev">${dayLabel(t.date)} · ${esc(c.name)}</div></div><span class="num">${fmt(t.amount)}</span></li>`; }).join('')}</ol>`
        : '<p class="muted none">No expenses this month.</p>'}
      <footer class="stmt-foot">Compared with ${monthLabel(prevMk)}. Generated by Ledger on ${fmtD(today(), true)}.</footer>
    </article>
    <button class="btn block no-print" id="pdf">Export as PDF</button>
    <p class="muted small no-print" style="text-align:center;margin-top:10px">Tap a category to see its records.</p>`;

  const go = (d) => { const m = addMonths(month, d); if (m <= thisMonth()) { month = m; renderStatement(main); } };
  document.querySelectorAll('.month-nav [data-d]').forEach((b) => (b.onclick = () => go(Number(b.dataset.d))));
  $('#mSel').onchange = (e) => { month = e.target.value; renderStatement(main); };
  bindModeSeg(main);
  $('#pdf').onclick = $('#pdfTop').onclick = exportPdf;
  main.onclick = (e) => {
    const row = e.target.closest('tr.line');
    if (row) { setListFilter({ month, cat: row.dataset.cat }); location.hash = '#/list'; }
  };

  // swipe left/right on the statement to change month
  let x0 = null;
  main.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  main.ontouchend = (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 80) go(dx < 0 ? 1 : -1); };
}

function exportPdf() {
  const t = document.title;
  document.title = mode === 'year' ? `Annual summary ${year}` : `Statement ${monthLabel(month)}`; // becomes the PDF file name
  window.print();
  setTimeout(() => (document.title = t), 1000);
}

async function renderYear(main) {
  const first = await firstTxDate();
  const minY = first ? Number(first.slice(0, 4)) : year, maxY = Number(thisMonth().slice(0, 4));
  year = Math.min(Math.max(year, minY), maxY);
  setTitle('Statement', {
    right: '<button class="icon-btn" id="pdfTop" aria-label="Export as PDF"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button>',
    extra: `${modeSeg()}<div class="month-nav"><button data-d="-1" ${year <= minY ? 'disabled' : ''} aria-label="Previous year">‹</button><span class="mlabel">${year}</span><button data-d="1" ${year >= maxY ? 'disabled' : ''} aria-label="Next year">›</button></div>`,
  });
  const y = yearlySummary(await txBetween(`${year}-01-01`, `${year}-12-31`), year);
  const ml = (m) => monthLabel(m, true).split(' ')[0];
  const chart = barsSVG(y.months.map((m) => ({ label: ml(m.month)[0], values: [m.income, m.expense] })), [SERIES.inc, SERIES.exp]);
  const active = y.months.filter((m) => m.income || m.expense);
  const avgExp = active.length ? Math.round(y.expense / active.length) : 0;
  const surplus = y.net >= 0;

  main.innerHTML = `
    <article class="stmt card">
      <header class="stmt-head"><div class="kicker">Annual summary</div><h2>${year}</h2>
        <div class="muted small">${active.length} month${active.length === 1 ? '' : 's'} with records${year === maxY ? ' · year to date' : ''}</div></header>
      <div class="stmt-kpis">
        <div><div class="lbl">Total income</div><div class="big num">${fmt(y.income, { noCents: true })}</div></div>
        <div><div class="lbl">Total expenses</div><div class="big num">${fmt(y.expense, { noCents: true })}</div></div>
        <div><div class="lbl">Net ${surplus ? 'surplus' : 'deficit'}</div><div class="big num ${surplus ? 'inc' : 'exp'}">${fmt(y.net, { sign: true, noCents: true })}</div></div>
        <div><div class="lbl">Savings rate</div><div class="big num">${y.savingsRate === null ? '—' : y.savingsRate.toFixed(1) + '%'}</div></div>
      </div>
      <h3 class="stmt-h3">Income vs expenses by month</h3>
      <div class="key"><span><i style="background:${SERIES.inc}"></i>Income</span><span><i style="background:${SERIES.exp}"></i>Expenses</span></div>
      <div class="chart-wrap" id="ybars">${chart.svg}</div>
      <table class="stmt-table ytable">
        <thead><tr><th></th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Net</th></tr></thead>
        <tbody>${y.months.map((m) => `<tr class="line" data-m="${m.month}"><td>${ml(m.month)}</td><td class="num r">${m.income ? fmt(m.income, { noCents: true }) : '—'}</td><td class="num r">${m.expense ? fmt(m.expense, { noCents: true }) : '—'}</td>
          <td class="num r ${m.net < 0 ? 'exp' : m.net > 0 ? 'inc' : ''}">${m.income || m.expense ? fmt(m.net, { sign: true, noCents: true }) : '—'}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td class="num r">${fmt(y.income, { noCents: true })}</td><td class="num r">${fmt(y.expense, { noCents: true })}</td><td class="num r ${surplus ? 'inc' : 'exp'}">${fmt(y.net, { sign: true, noCents: true })}</td></tr>
        </tbody></table>
      <p class="muted small">Average monthly spending: <b>${fmt(avgExp)}</b></p>
      <h3 class="stmt-h3">Where the money went</h3>
      <table class="stmt-table"><tbody>${y.expenseByCategory.map((l) => { const c = catById(l.categoryId); const pct = y.expense ? (l.amount / y.expense) * 100 : 0;
        return `<tr><td><span class="ci">${c.icon}</span>${esc(c.name)}<div class="sharebar"><i style="width:${pct.toFixed(1)}%;background:${c.color}"></i></div></td><td class="num r">${fmt(l.amount, { noCents: true })}<div class="prev">${pct.toFixed(1)}%</div></td></tr>`; }).join('') || '<tr><td class="muted none">No expenses</td></tr>'}</tbody></table>
      <h3 class="stmt-h3">Income sources</h3>
      <table class="stmt-table"><tbody>${y.incomeByCategory.map((l) => { const c = catById(l.categoryId);
        return `<tr><td><span class="ci">${c.icon}</span>${esc(c.name)}</td><td class="num r">${fmt(l.amount, { noCents: true })}<div class="prev">${y.income ? ((l.amount / y.income) * 100).toFixed(1) : 0}%</div></td></tr>`; }).join('') || '<tr><td class="muted none">No income</td></tr>'}</tbody></table>
      <footer class="stmt-foot">Generated by Ledger on ${parseDate(today()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</footer>
    </article>
    <button class="btn block no-print" id="pdf">Export as PDF</button>
    <p class="muted small no-print" style="text-align:center;margin-top:10px">Tap a month to open its statement.</p>`;

  attachHover($('#ybars'), chart, (i) => { const m = y.months[i]; return m.income || m.expense ? `<b>${monthLabel(m.month)}</b><br>Income ${fmt(m.income)}<br>Expenses ${fmt(m.expense)}<br>Net ${fmt(m.net, { sign: true })}` : ''; });
  document.querySelectorAll('.month-nav [data-d]').forEach((b) => (b.onclick = () => { year += Number(b.dataset.d); renderYear(main); }));
  bindModeSeg(main);
  $('#pdf').onclick = $('#pdfTop').onclick = exportPdf;
  main.onclick = (e) => { const r = e.target.closest('tr[data-m]'); if (r) { main.scrollTop = 0; showStatement(r.dataset.m); renderStatement(main); } };
  main.ontouchstart = main.ontouchend = null;
}
