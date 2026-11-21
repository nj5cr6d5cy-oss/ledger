import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatement, pctChange } from '../js/stats.js';

let n = 0;
const tx = (type, categoryId, amount, date = '2026-10-15', note = '') => ({ id: String(n++), type, categoryId, amount, date, note, methodId: 'm' });

const oct = [
  tx('income', 'salary', 3200000),
  tx('income', 'tutoring', 45000),
  tx('income', 'tutoring', 45000),
  tx('expense', 'rent', 1250000),
  tx('expense', 'food', 4550),
  tx('expense', 'food', 12010),
  tx('expense', 'transport', 1230),
  tx('expense', 'gifts', 80000),
];
const sep = [
  tx('income', 'salary', 3200000, '2026-09-25'),
  tx('expense', 'rent', 1250000, '2026-09-01'),
  tx('expense', 'food', 20000, '2026-09-10'),
  tx('expense', 'health', 30000, '2026-09-12'),
];

test('totals add up per section and per category', () => {
  const s = buildStatement(oct, sep);
  assert.equal(s.income.total, 3290000);
  assert.equal(s.expense.total, 1250000 + 4550 + 12010 + 1230 + 80000);
  assert.equal(s.net, s.income.total - s.expense.total);
  const food = s.expense.lines.find((l) => l.categoryId === 'food');
  assert.equal(food.amount, 16560); // 45.50 + 120.10, exact in cents
  const tut = s.income.lines.find((l) => l.categoryId === 'tutoring');
  assert.equal(tut.amount, 90000);
  // lines are sorted largest first
  assert.equal(s.expense.lines[0].categoryId, 'rent');
});

test('month-over-month comparison', () => {
  const s = buildStatement(oct, sep);
  const food = s.expense.lines.find((l) => l.categoryId === 'food');
  assert.equal(food.prev, 20000);
  assert.ok(Math.abs(food.change - -17.2) < 1e-9); // 165.60 vs 200.00 → −17.2%
  const salary = s.income.lines.find((l) => l.categoryId === 'salary');
  assert.equal(salary.change, 0);
  // new category this month has no base → null (shown as "new")
  assert.equal(s.expense.lines.find((l) => l.categoryId === 'gifts').change, null);
  // category only in previous month still appears with amount 0 (−100%)
  const health = s.expense.lines.find((l) => l.categoryId === 'health');
  assert.equal(health.amount, 0);
  assert.equal(health.change, -100);
  assert.equal(s.prevNet, 3200000 - 1250000 - 20000 - 30000);
});

test('savings rate and deficit', () => {
  const s = buildStatement(oct, sep);
  assert.ok(Math.abs(s.savingsRate - (s.net / 3290000) * 100) < 1e-9);
  const deficit = buildStatement([tx('income', 'salary', 1000), tx('expense', 'food', 1500)]);
  assert.equal(deficit.net, -500);
  assert.equal(deficit.savingsRate, -50);
  assert.equal(buildStatement([tx('expense', 'food', 100)]).savingsRate, null); // no income
});

test('top 5 largest expenses', () => {
  const s = buildStatement(oct, sep);
  assert.deepEqual(s.top5.map((t) => t.amount), [1250000, 80000, 12010, 4550, 1230]);
  assert.ok(s.top5.every((t) => t.type === 'expense'));
});

test('empty month', () => {
  const s = buildStatement([], []);
  assert.equal(s.income.total, 0);
  assert.equal(s.expense.total, 0);
  assert.equal(s.net, 0);
  assert.equal(s.savingsRate, null);
  assert.deepEqual(s.top5, []);
});

test('pctChange', () => {
  assert.equal(pctChange(150, 100), 50);
  assert.equal(pctChange(50, 100), -50);
  assert.equal(pctChange(100, 0), null);
  assert.equal(pctChange(-50, -100), 50); // deficit shrank
});

import { statementBannerMonth } from '../js/stats.js';
test('statement banner shows last month at the start of a month until seen', () => {
  assert.equal(statementBannerMonth('2026-12-01', null), '2026-11');
  assert.equal(statementBannerMonth('2027-01-01', '2026-11'), '2026-12'); // year rollover
  assert.equal(statementBannerMonth('2026-12-01', '2026-11'), null); // already dismissed
  assert.equal(statementBannerMonth('2026-12-15', null), null); // past the first week
});

import { budgetStatus, budgetCrossed, yearlySummary, goalPlan } from '../js/stats.js';
test('budget thresholds at 80% and 100%', () => {
  assert.equal(budgetStatus(7900, 10000).level, 'ok');
  assert.equal(budgetStatus(8000, 10000).level, 'warn');
  assert.equal(budgetStatus(10000, 10000).level, 'over');
  assert.equal(budgetCrossed(7000, 8500, 10000), 80);
  assert.equal(budgetCrossed(8500, 10100, 10000), 100);
  assert.equal(budgetCrossed(7000, 12000, 10000), 100);
  assert.equal(budgetCrossed(8500, 9000, 10000), null);
});

test('yearly summary totals by month', () => {
  const y = yearlySummary([
    { type: 'income', categoryId: 's', amount: 100000, date: '2026-01-25' },
    { type: 'expense', categoryId: 'f', amount: 30000, date: '2026-01-03' },
    { type: 'expense', categoryId: 'f', amount: 20000, date: '2026-12-31' },
    { type: 'expense', categoryId: 'r', amount: 99999, date: '2025-12-31' }, // other year: ignored
  ], 2026);
  assert.equal(y.months[0].net, 70000);
  assert.equal(y.months[11].expense, 20000);
  assert.equal(y.income, 100000);
  assert.equal(y.expense, 50000);
  assert.equal(y.savingsRate, 50);
  assert.deepEqual(y.expenseByCategory, [{ categoryId: 'f', amount: 50000 }]);
});

test('goal plan', () => {
  const p = goalPlan({ target: 1200000, saved: 600000, deadline: '2027-05-21' }, '2026-11-21');
  assert.equal(p.monthsLeft, 6);
  assert.equal(p.perMonth, 100000);
  assert.equal(p.pct, 50);
  assert.equal(goalPlan({ target: 1000, saved: 1500 }, '2026-11-21').remaining, 0);
});

import { backupDue } from '../js/stats.js';
test('monthly backup reminder', () => {
  assert.equal(backupDue({ today: '2026-11-21', lastBackup: '2026-11-01' }), null);
  assert.equal(backupDue({ today: '2026-11-21', lastBackup: '2026-10-20' }), 32);
  assert.equal(backupDue({ today: '2026-11-21', lastBackup: '2026-10-20', snoozeUntil: '2026-11-25' }), null);
  assert.equal(backupDue({ today: '2026-11-21', firstUse: Date.parse('2026-10-01') }), Infinity);
  assert.equal(backupDue({ today: '2026-11-21', firstUse: Date.parse('2026-11-10') }), null);
});
