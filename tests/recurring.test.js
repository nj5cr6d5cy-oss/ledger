import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrence, dueOccurrences, nextDate, countBefore, txFromRule } from '../js/recurring.js';

const rule = (o) => ({ id: 'r1', type: 'expense', amount: 1250000, categoryId: 'rent', methodId: 'm', frequency: 'monthly', startDate: '2026-01-31', count: 0, active: true, ...o });

test('monthly on the 31st clamps to short months without drifting', () => {
  const r = rule();
  assert.deepEqual([0, 1, 2, 3].map((k) => occurrence(r, k)), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('yearly on Feb 29 falls back to Feb 28 in non-leap years', () => {
  const r = rule({ frequency: 'yearly', startDate: '2028-02-29' });
  assert.deepEqual([0, 1, 4].map((k) => occurrence(r, k)), ['2028-02-29', '2029-02-28', '2032-02-29']);
});

test('weekly', () => {
  const r = rule({ frequency: 'weekly', startDate: '2026-11-03' });
  assert.deepEqual(dueOccurrences(r, '2026-11-24').dates, ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
});

test('due entries are generated once: count advances, re-running adds nothing', () => {
  const r = rule({ startDate: '2026-09-25' });
  const first = dueOccurrences(r, '2026-11-21');
  assert.deepEqual(first.dates, ['2026-09-25', '2026-10-25']);
  assert.equal(first.count, 2);
  const again = dueOccurrences({ ...r, count: first.count }, '2026-11-21');
  assert.deepEqual(again.dates, []);
  assert.equal(nextDate({ ...r, count: first.count }), '2026-11-25');
  // on the day itself it becomes due
  assert.deepEqual(dueOccurrences({ ...r, count: 2 }, '2026-11-25').dates, ['2026-11-25']);
});

test('end date, paused rules and future start dates', () => {
  assert.deepEqual(dueOccurrences(rule({ startDate: '2026-01-01', endDate: '2026-03-15' }), '2026-12-31').dates, ['2026-01-01', '2026-02-01', '2026-03-01']);
  assert.equal(nextDate(rule({ startDate: '2026-01-01', endDate: '2026-03-15', count: 3 })), null);
  assert.deepEqual(dueOccurrences(rule({ active: false, startDate: '2026-01-01' }), '2026-12-31').dates, []);
  assert.deepEqual(dueOccurrences(rule({ startDate: '2026-12-01' }), '2026-11-21').dates, []);
});

test('generated transactions have stable ids (no duplicates) and keep integer cents', () => {
  const r = rule();
  const t = txFromRule(r, '2026-02-28');
  assert.equal(t.id, 'rec-r1-2026-02-28');
  assert.equal(t.amount, 1250000);
  assert.equal(t.recurringId, 'r1');
  assert.equal(countBefore(rule({ startDate: '2026-01-15' }), '2026-04-15'), 3);
});
