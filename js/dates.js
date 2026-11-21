// Date helpers. All dates are local 'YYYY-MM-DD' strings and months are 'YYYY-MM',
// which sort correctly as text and avoid timezone surprises.
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); }
export const today = () => ymd(new Date());
export const monthOf = (s) => s.slice(0, 7);
export const thisMonth = () => monthOf(today());
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
export function addMonths(mk, n) {
  const [y, m] = mk.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}
export function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
export const monthRange = (mk) => [`${mk}-01`, `${mk}-${pad(daysInMonth(mk))}`];
export function monthLabel(mk, short = false) {
  return parseDate(`${mk}-01`).toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: 'numeric' });
}
export function dayLabel(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (s.slice(0, 4) !== t.slice(0, 4)) opts.year = 'numeric';
  return parseDate(s).toLocaleDateString('en-GB', opts);
}
/** Months from `from` to `to` inclusive (both 'YYYY-MM'). */
export function monthsBetween(from, to) {
  const out = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}
