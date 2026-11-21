// Money is always stored as integer cents. Only formatting touches decimals.
let symbol = '$';
export const setCurrency = (s) => { symbol = s || '$'; };
export const currency = () => symbol;

/** "1,234.5" -> 123450. Never uses floating point maths. */
export function parseToCents(input) {
  const s = String(input ?? '').replace(/[^0-9.\-]/g, '');
  if (!s || s === '-' || s === '.') return 0;
  const neg = s.startsWith('-');
  const [i = '0', f = ''] = s.replace(/-/g, '').split('.');
  const cents = parseInt(i || '0', 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
  return neg ? -cents : cents;
}

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 123456 -> "$1,234.56". opts.sign adds +/-; opts.noCents drops ".00". */
export function fmt(cents, { sign = false, noCents = false } = {}) {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100), frac = abs % 100;
  const body = `${symbol}${group(whole)}${noCents && frac === 0 ? '' : '.' + String(frac).padStart(2, '0')}`;
  return (neg ? '−' : sign && cents > 0 ? '+' : '') + body;
}

/** Short form for chart labels: $950, $12.3k, $1.2M */
export function fmtShort(cents) {
  const v = Math.abs(cents) / 100, neg = cents < 0 ? '−' : '';
  if (v >= 1e6) return `${neg}${symbol}${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${neg}${symbol}${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${neg}${symbol}${Math.round(v)}`;
}
