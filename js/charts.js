// Hand-rolled SVG charts (no library = nothing to download, works offline).
import { fmtShort } from './money.js';

export const SERIES = { inc: '#0d9488', exp: '#ea580c' }; // validated for colour-blind separation, light & dark

function niceMax(v) {
  if (v <= 0) return 10000;
  const p = 10 ** Math.floor(Math.log10(v)), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Donut: segs [{label, value, color}]. Centre text is filled by the caller. */
export function donutSVG(segs, size = 180, thick = 26) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const R = (size - thick) / 2, C = 2 * Math.PI * R, c = size / 2;
  const gap = segs.length > 1 ? 2 : 0;
  let off = 0;
  const arcs = segs.map((s, i) => {
    const len = (s.value / total) * C, d = Math.max(len - gap, 0.6);
    const el = `<circle class="seg" data-i="${i}" r="${R}" cx="${c}" cy="${c}" fill="none" stroke="${s.color}" stroke-width="${thick}"
      stroke-dasharray="${d} ${C - d}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})"/>`;
    off += len;
    return el;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img">${arcs}
    <text x="${c}" y="${c - 6}" class="d-lbl" text-anchor="middle">Total spent</text>
    <text x="${c}" y="${c + 18}" class="d-val" text-anchor="middle"></text></svg>`;
}

const W = 340;
function frame(max, H, padL, padT, padB) {
  return [0, 0.5, 1].map((f) => {
    const y = padT + (1 - f) * (H - padT - padB);
    return `<line x1="${padL}" x2="${W - 4}" y1="${y}" y2="${y}" class="grid"/><text x="${padL - 6}" y="${y + 4}" class="axis" text-anchor="end">${fmtShort(max * f)}</text>`;
  }).join('');
}

/** Line chart. series: [{values:[cents|null], color, dashed}] ; labels: x tick labels ('' = no tick). */
export function lineSVG(series, labels, H = 170, { cap = null } = {}) {
  const padL = 44, padT = 12, padB = 22, n = labels.length;
  const peak = Math.max(0, ...series.flatMap((s) => s.values.filter((v) => v != null)));
  const max = niceMax(cap && cap < peak ? cap : peak);
  const x = (i) => padL + (i * (W - padL - 8)) / Math.max(1, n - 1);
  const y = (v) => padT + (1 - Math.min(v, max) / max) * (H - padT - padB);
  // values above the axis are clipped and flagged with ▲ (the tooltip still shows the real amount)
  const clipped = series.filter((s) => !s.dashed).flatMap((s) => s.values.map((v, i) => (v != null && v > max ? `<text x="${x(i)}" y="${padT - 2}" class="clip" text-anchor="middle" fill="${s.color}">▲</text>` : ''))).join('');
  const paths = series.map((s) => {
    let d = '', pen = false;
    s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="4 4" opacity=".75"' : ''}/>`;
  }).join('');
  const ticks = labels.map((l, i) => (l ? `<text x="${x(i)}" y="${H - 6}" class="axis" text-anchor="middle">${l}</text>` : '')).join('');
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${frame(max, H, padL, padT, padB)}${ticks}${paths}
      ${clipped}<line class="xh" y1="${padT}" y2="${H - padB}" visibility="hidden"/><g class="dots"></g></svg>`,
    n, x, y, W,
  };
}

/** Grouped bars. groups: [{label, values:[a,b]}], colors: [ca, cb] */
export function barsSVG(groups, colors, H = 190) {
  const padL = 44, padT = 10, padB = 22, n = groups.length;
  const max = niceMax(Math.max(0, ...groups.flatMap((g) => g.values)));
  const gw = (W - padL - 4) / n, bw = Math.max(3, (gw - 6) / 2 - 1);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB), base = H - padB;
  const bar = (bx, v, color) => {
    if (v <= 0) return '';
    const top = y(v), r = Math.min(3, bw / 2, base - top);
    return `<path fill="${color}" d="M${bx},${base}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + bw - r}Q${bx + bw},${top} ${bx + bw},${top + r}V${base}Z"/>`;
  };
  const xs = (i) => padL + i * gw + 3;
  const body = groups.map((g, i) => bar(xs(i), g.values[0], colors[0]) + bar(xs(i) + bw + 2, g.values[1], colors[1])
    + `<text x="${xs(i) + bw + 1}" y="${H - 6}" class="axis" text-anchor="middle">${g.label}</text>`).join('');
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${frame(max, H, padL, padT, padB)}
      <rect class="band" y="${padT}" height="${H - padT - padB}" width="${gw}" visibility="hidden"/>${body}</svg>`,
    n, x: (i) => padL + i * gw, gw, W,
  };
}

/** Tap / hover a chart to show a tooltip at the nearest index. */
export function attachHover(wrap, chart, html, { line = null } = {}) {
  const svg = wrap.querySelector('svg');
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  wrap.appendChild(tip);
  const xh = svg.querySelector('.xh'), band = svg.querySelector('.band'), dots = svg.querySelector('.dots');
  const show = (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * chart.W;
    let i;
    if (chart.gw) i = Math.floor((vx - chart.x(0)) / chart.gw);
    else { i = 0; for (let k = 1; k < chart.n; k++) if (Math.abs(chart.x(k) - vx) < Math.abs(chart.x(i) - vx)) i = k; }
    i = Math.max(0, Math.min(chart.n - 1, i));
    const content = html(i);
    if (!content) return hide();
    let cx;
    if (band) { band.setAttribute('x', chart.x(i)); band.setAttribute('visibility', 'visible'); cx = chart.x(i) + chart.gw / 2; }
    if (xh) {
      cx = chart.x(i);
      xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.setAttribute('visibility', 'visible');
      if (line && dots) dots.innerHTML = line.map((s) => (s.values[i] == null ? '' : `<circle cx="${cx}" cy="${chart.y(s.values[i])}" r="4" fill="${s.color}" class="dot"/>`)).join('');
    }
    tip.innerHTML = content;
    tip.hidden = false;
    const px = (cx / chart.W) * r.width, tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(r.width - tw, px - tw / 2))}px`;
  };
  const hide = () => { tip.hidden = true; xh?.setAttribute('visibility', 'hidden'); band?.setAttribute('visibility', 'hidden'); if (dots) dots.innerHTML = ''; };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  return hide;
}
