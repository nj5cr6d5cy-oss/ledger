// Pure calculation functions (no DOM / DB) so they can be unit-tested in Node.
// All amounts are integer cents.

export const sumByType = (txs) => txs.reduce((a, t) => { a[t.type] += t.amount; return a; }, { income: 0, expense: 0 });

/** % change from prev to cur; null when there is no base to compare against. */
export function pctChange(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function sumByCategory(txs, type) {
  const m = new Map();
  for (const t of txs) if (t.type === type) m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
  return m;
}

function section(cur, prev, type) {
  const c = sumByCategory(cur, type), p = sumByCategory(prev, type);
  const ids = new Set([...c.keys(), ...p.keys()]);
  const lines = [...ids].map((categoryId) => {
    const amount = c.get(categoryId) || 0, before = p.get(categoryId) || 0;
    return { categoryId, amount, prev: before, change: pctChange(amount, before) };
  }).sort((a, b) => b.amount - a.amount || b.prev - a.prev);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const prevTotal = lines.reduce((s, l) => s + l.prev, 0);
  return { lines, total, prevTotal, change: pctChange(total, prevTotal) };
}

/**
 * Income-statement style summary for one month.
 * @param cur  transactions in the month
 * @param prev transactions in the previous month (for comparison)
 */
export function buildStatement(cur, prev = []) {
  const income = section(cur, prev, 'income');
  const expense = section(cur, prev, 'expense');
  const net = income.total - expense.total;
  const prevNet = income.prevTotal - expense.prevTotal;
  const rate = (inc, n) => (inc > 0 ? (n / inc) * 100 : null);
  const top5 = cur.filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount || (a.date < b.date ? -1 : 1))
    .slice(0, 5);
  return {
    income, expense, net, prevNet,
    netChange: pctChange(net, prevNet),
    savingsRate: rate(income.total, net),
    prevSavingsRate: rate(income.prevTotal, prevNet),
    top5,
    count: cur.length,
  };
}

/**
 * Which month's statement banner to show on Home, or null.
 * Shown from the 1st of the month (and for the first week, in case the app
 * isn't opened on the 1st) until the user dismisses or opens it.
 */
export function statementBannerMonth(todayStr, seenMonth, graceDays = 7) {
  const day = Number(todayStr.slice(8, 10));
  if (day > graceDays) return null;
  const [y, m] = todayStr.slice(0, 7).split('-').map(Number);
  const last = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  return seenMonth === last ? null : last;
}

/** Budget usage: level 'ok' | 'warn' (>= 80%) | 'over' (>= 100%). */
export function budgetStatus(spent, budget) {
  if (!budget || budget <= 0) return { pct: 0, level: 'none', left: 0 };
  const pct = (spent / budget) * 100;
  return { pct, level: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok', left: budget - spent };
}
/** Which threshold (80 / 100) was crossed by going from `before` to `after` spend, or null. */
export function budgetCrossed(before, after, budget) {
  if (!budget) return null;
  const b = (before / budget) * 100, a = (after / budget) * 100;
  if (b < 100 && a >= 100) return 100;
  if (b < 80 && a >= 80) return 80;
  return null;
}

/** 12-month summary for `year` ('YYYY'). */
export function yearlySummary(txs, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, income: 0, expense: 0, net: 0 }));
  const byCat = new Map();
  for (const t of txs) {
    if (t.date.slice(0, 4) !== String(year)) continue;
    const m = months[Number(t.date.slice(5, 7)) - 1];
    m[t.type] += t.amount;
    const key = `${t.type}:${t.categoryId}`;
    byCat.set(key, (byCat.get(key) || 0) + t.amount);
  }
  months.forEach((m) => (m.net = m.income - m.expense));
  const income = months.reduce((s, m) => s + m.income, 0), expense = months.reduce((s, m) => s + m.expense, 0);
  const cats = (type) => [...byCat].filter(([k]) => k.startsWith(type + ':')).map(([k, amount]) => ({ categoryId: k.slice(type.length + 1), amount })).sort((a, b) => b.amount - a.amount);
  return { months, income, expense, net: income - expense, savingsRate: income > 0 ? ((income - expense) / income) * 100 : null, expenseByCategory: cats('expense'), incomeByCategory: cats('income') };
}

/** Savings goal plan: how much per month is needed to hit the target by the deadline. */
export function goalPlan(goal, todayStr) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
  if (!goal.deadline) return { remaining, pct, monthsLeft: null, perMonth: null };
  const [ty, tm, td] = todayStr.split('-').map(Number), [dy, dm, dd] = goal.deadline.split('-').map(Number);
  let monthsLeft = (dy - ty) * 12 + (dm - tm) + (dd >= td ? 0 : -1);
  monthsLeft = Math.max(0, monthsLeft);
  const overdue = goal.deadline < todayStr;
  return { remaining, pct, monthsLeft, overdue, perMonth: remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, monthsLeft)) };
}

/**
 * Days since last backup if a reminder is due (>= 30 days, or never backed up after
 * 30 days of use), else null. Infinity = never backed up.
 */
export function backupDue({ today, lastBackup, firstUse, snoozeUntil, every = 30 }) {
  if (snoozeUntil && today < snoozeUntil) return null;
  const days = (from) => Math.floor((Date.parse(today) - Date.parse(from)) / 86400000);
  if (lastBackup) { const d = days(lastBackup.slice(0, 10)); return d >= every ? d : null; }
  if (!firstUse) return null;
  const start = new Date(firstUse).toISOString().slice(0, 10);
  return days(start) >= every ? Infinity : null;
}
