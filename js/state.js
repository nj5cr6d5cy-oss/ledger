// In-memory cache of small reference data (categories, methods, settings).
import { getAll, putMany, getMeta, setMeta, txBetween } from './db.js';
import { DEFAULT_CATEGORIES, DEFAULT_METHODS } from './defaults.js';
import { addDays, today } from './dates.js';
import { setCurrency } from './money.js';

export const state = { categories: [], methods: [], usage: {}, methodUsage: {}, last: { expense: null, income: null, method: null } };
const byOrder = (a, b) => a.order - b.order;

export async function ensureDefaults() {
  if (await getMeta('initialized')) return;
  await putMany('categories', DEFAULT_CATEGORIES);
  await putMany('methods', DEFAULT_METHODS);
  await setMeta('currency', '$');
  await setMeta('initialized', Date.now());
}

export async function loadRefs() {
  state.categories = (await getAll('categories')).sort(byOrder);
  state.methods = (await getAll('methods')).sort(byOrder);
  setCurrency(await getMeta('currency', '$'));
  state.last = { expense: null, income: null, method: null, ...(await getMeta('last', {})) };
}

/** Usage counts over the last 90 days drive the "most used first" ordering. */
export async function loadUsage() {
  const txs = await txBetween(addDays(today(), -90), '9999-12-31');
  state.usage = {}; state.methodUsage = {};
  for (const t of txs) {
    state.usage[t.categoryId] = (state.usage[t.categoryId] || 0) + 1;
    state.methodUsage[t.methodId] = (state.methodUsage[t.methodId] || 0) + 1;
  }
}
export function bumpUsage(t) {
  state.usage[t.categoryId] = (state.usage[t.categoryId] || 0) + 1;
  state.methodUsage[t.methodId] = (state.methodUsage[t.methodId] || 0) + 1;
}

const UNKNOWN_CAT = { id: '?', name: 'Uncategorised', icon: '❔', color: '#94a3b8', type: 'expense' };
export const catById = (id) => state.categories.find((c) => c.id === id) || { ...UNKNOWN_CAT, id };
export const methodById = (id) => state.methods.find((m) => m.id === id) || { id, name: '—', icon: '' };
export const activeCats = (type) => state.categories.filter((c) => c.type === type && !c.archived);
export const activeMethods = () => state.methods.filter((m) => !m.archived);
export const catsByUsage = (type) => activeCats(type).sort((a, b) => (state.usage[b.id] || 0) - (state.usage[a.id] || 0) || a.order - b.order);
