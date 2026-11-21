// Backup & restore. JSON = full backup (restorable). CSV = transactions for spreadsheets.
import { getAll, putMany, clearStores, setMeta, getMeta, STORES } from './db.js';
import { catById, methodById } from './state.js';
import { today } from './dates.js';
import { toast } from './util.js';

const PRIVATE_META = ['pinHash', 'pinSalt'];

export async function snapshot() {
  const data = {};
  for (const s of STORES) data[s] = await getAll(s);
  data.meta = data.meta.filter((m) => !PRIVATE_META.includes(m.key));
  return { app: 'ledger', version: 1, exportedAt: new Date().toISOString(), data };
}

/** On iPhone this opens the share sheet ("Save to Files", AirDrop…); elsewhere it downloads. */
async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}

export async function exportJSON() {
  const snap = await snapshot();
  const ok = await saveFile(`ledger-backup-${today()}.json`, JSON.stringify(snap), 'application/json');
  if (ok) { await setMeta('lastBackup', new Date().toISOString()); await setMeta('backupSnooze', null); toast(`Backup saved (${snap.data.transactions.length} records)`); }
  return ok;
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function exportCSV() {
  const txs = (await getAll('transactions')).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rows = [['Date', 'Type', 'Amount', 'Category', 'Payment method', 'Note', 'Recurring']];
  for (const t of txs) {
    const amt = `${t.type === 'expense' ? '-' : ''}${Math.floor(t.amount / 100)}.${String(t.amount % 100).padStart(2, '0')}`;
    rows.push([t.date, t.type, amt, catById(t.categoryId).name, methodById(t.methodId).name, t.note, t.recurringId ? 'yes' : '']);
  }
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  if (await saveFile(`ledger-transactions-${today()}.csv`, csv, 'text/csv')) toast(`Exported ${txs.length} records as CSV`);
}

export function validateBackup(obj) {
  if (!obj || obj.app !== 'ledger' || typeof obj.data !== 'object') throw new Error("This doesn't look like a Ledger backup file.");
  const d = obj.data;
  if (!Array.isArray(d.transactions) || !Array.isArray(d.categories)) throw new Error('Backup is missing transactions or categories.');
  for (const t of d.transactions) {
    if (!t.id || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isInteger(t.amount) || !['income', 'expense'].includes(t.type)) throw new Error(`Invalid record in backup: ${JSON.stringify(t).slice(0, 80)}`);
  }
  return { transactions: d.transactions.length, exportedAt: obj.exportedAt };
}

/** Replaces ALL data with the backup (keeps the current PIN). */
export async function importBackup(obj) {
  validateBackup(obj);
  const keep = [];
  for (const k of PRIVATE_META) { const v = await getMeta(k); if (v) keep.push({ key: k, value: v }); }
  await clearStores();
  for (const s of STORES) {
    const rows = (obj.data[s] || []).filter((r) => !(s === 'meta' && PRIVATE_META.includes(r.key)));
    if (rows.length) await putMany(s, rows);
  }
  if (keep.length) await putMany('meta', keep);
  if (!(await getMeta('initialized'))) await setMeta('initialized', Date.now());
}
