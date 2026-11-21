// Recurring transactions. A rule's k-th occurrence is computed from its start date
// (not from the previous occurrence), so "31st monthly" gives Jan 31, Feb 28, Mar 31…
import { addDays, daysInMonth, addMonths, today } from './dates.js';
import { getAll, put, putMany } from './db.js';

const pad = (n) => String(n).padStart(2, '0');

export function occurrence(rule, k) {
  const start = rule.startDate, day = Number(start.slice(8, 10));
  if (rule.frequency === 'weekly') return addDays(start, 7 * k);
  if (rule.frequency === 'yearly') {
    const y = Number(start.slice(0, 4)) + k, mk = `${y}-${start.slice(5, 7)}`;
    return `${mk}-${pad(Math.min(day, daysInMonth(mk)))}`;
  }
  const mk = addMonths(start.slice(0, 7), k); // monthly
  return `${mk}-${pad(Math.min(day, daysInMonth(mk)))}`;
}

/** Occurrences not yet generated (index >= rule.count) that fall on or before upTo. */
export function dueOccurrences(rule, upTo) {
  const dates = [];
  let k = rule.count || 0;
  if (rule.active === false) return { dates, count: k };
  for (;;) {
    const d = occurrence(rule, k);
    if (d > upTo || (rule.endDate && d > rule.endDate)) break;
    dates.push(d);
    k++;
    if (dates.length > 1000) break; // safety
  }
  return { dates, count: k };
}

export function nextDate(rule) {
  const d = occurrence(rule, rule.count || 0);
  return rule.endDate && d > rule.endDate ? null : d;
}

/** Number of occurrences strictly before `date` (used when a schedule is edited). */
export function countBefore(rule, date) {
  let k = 0;
  while (occurrence(rule, k) < date && k < 5000) k++;
  return k;
}

export const txFromRule = (rule, date) => ({
  id: `rec-${rule.id}-${date}`, type: rule.type, amount: rule.amount, categoryId: rule.categoryId,
  methodId: rule.methodId, date, note: rule.note || '', recurringId: rule.id, createdAt: Date.now(),
});

/** Adds any due recurring transactions to the database. Returns how many were added. */
export async function processRecurring(upTo = today()) {
  let added = 0;
  for (const rule of await getAll('recurring')) {
    const { dates, count } = dueOccurrences(rule, upTo);
    if (!dates.length) continue;
    await putMany('transactions', dates.map((d) => txFromRule(rule, d)));
    await put('recurring', { ...rule, count });
    added += dates.length;
  }
  return added;
}
