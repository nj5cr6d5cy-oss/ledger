// Thin promise wrapper around IndexedDB. All stores are created up front so
// later features never need a schema migration.
const NAME = 'ledger-db', VERSION = 1;
export const STORES = ['transactions', 'categories', 'methods', 'budgets', 'recurring', 'goals', 'meta'];
let dbp;

const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

export function openDB() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      const mk = (n, o) => (d.objectStoreNames.contains(n) ? null : d.createObjectStore(n, o));
      const t = mk('transactions', { keyPath: 'id' });
      if (t) { t.createIndex('date', 'date'); t.createIndex('recurringId', 'recurringId'); }
      mk('categories', { keyPath: 'id' });
      mk('methods', { keyPath: 'id' });
      mk('budgets', { keyPath: 'categoryId' });
      mk('recurring', { keyPath: 'id' });
      mk('goals', { keyPath: 'id' });
      mk('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const os = async (name, mode = 'readonly') => (await openDB()).transaction(name, mode).objectStore(name);

export const get = async (store, key) => wrap((await os(store)).get(key));
export const getAll = async (store) => wrap((await os(store)).getAll());
export const put = async (store, val) => { await wrap((await os(store, 'readwrite')).put(val)); return val; };
export const del = async (store, key) => wrap((await os(store, 'readwrite')).delete(key));
export async function putMany(store, vals) {
  const t = (await openDB()).transaction(store, 'readwrite');
  const s = t.objectStore(store);
  vals.forEach((v) => s.put(v));
  return done(t);
}
export async function clearStores(names = STORES) {
  const t = (await openDB()).transaction(names, 'readwrite');
  names.forEach((n) => t.objectStore(n).clear());
  return done(t);
}
/** Transactions with start <= date <= end (inclusive, 'YYYY-MM-DD'). */
export const txBetween = async (start, end) => wrap((await os('transactions')).index('date').getAll(IDBKeyRange.bound(start, end)));
export async function firstTxDate() {
  const s = await os('transactions');
  return new Promise((res) => { const c = s.index('date').openCursor(); c.onsuccess = () => res(c.result ? c.result.key : null); c.onerror = () => res(null); });
}
export const getMeta = async (key, fallback = null) => { const r = await get('meta', key); return r ? r.value : fallback; };
export const setMeta = (key, value) => put('meta', { key, value });
