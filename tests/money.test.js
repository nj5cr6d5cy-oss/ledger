import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToCents, fmt, fmtShort } from '../js/money.js';
import { addMonths, monthRange, monthsBetween, addDays } from '../js/dates.js';

test('parseToCents never uses floats', () => {
  assert.equal(parseToCents('0.1'), 10);
  assert.equal(parseToCents('0.29'), 29);
  assert.equal(parseToCents('1,234.567'), 123456);
  assert.equal(parseToCents('12'), 1200);
  assert.equal(parseToCents('-5.5'), -550);
  assert.equal(parseToCents(''), 0);
  // 0.1 + 0.2 style sums stay exact in cents
  assert.equal(parseToCents('0.1') + parseToCents('0.2'), parseToCents('0.3'));
});

test('fmt formats cents', () => {
  assert.equal(fmt(123456), '$1,234.56');
  assert.equal(fmt(-500), '−$5.00');
  assert.equal(fmt(500, { sign: true }), '+$5.00');
  assert.equal(fmt(0), '$0.00');
  assert.equal(fmtShort(1234500), '$12k');
});

test('date helpers', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.deepEqual(monthRange('2028-02'), ['2028-02-01', '2028-02-29']);
  assert.deepEqual(monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});
