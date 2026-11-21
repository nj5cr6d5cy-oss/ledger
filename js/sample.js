// Deterministic demo data: ~12 months of realistic Hong Kong-style spending & income.
// Ids are stable, so loading twice overwrites rather than duplicates.
import { today, addDays, addMonths, monthOf, parseDate } from './dates.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeSampleTransactions(end = today(), months = 12) {
  const rnd = mulberry32(20261121);
  const r = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const out = [];
  const add = (date, type, categoryId, dollars, methodId, note = '') =>
    out.push({ id: `sample-${date}-${out.length}`, type, amount: Math.round(dollars * 100), categoryId, methodId, date, note, createdAt: Date.parse(date) + out.length, sample: true });

  for (let d = `${addMonths(monthOf(end), -(months - 1))}-01`; d <= end; d = addDays(d, 1)) {
    const dt = parseDate(d), dow = dt.getDay(), dom = dt.getDate(), mon = dt.getMonth() + 1, weekday = dow > 0 && dow < 6;
    add(d, 'expense', 'exp-food', r(28, 68), pick(['m-octopus', 'm-payme', 'm-cash', 'm-card']), pick(['Lunch', 'Breakfast', 'Cha chaan teng', 'Noodles', 'Lunch set']));
    if (chance(0.6)) add(d, 'expense', 'exp-food', r(45, 220), pick(['m-card', 'm-payme', 'm-octopus']), pick(['Dinner', 'Hotpot', 'Sushi', 'Dim sum', 'Takeaway']));
    if (chance(0.3)) add(d, 'expense', 'exp-food', r(25, 45), 'm-octopus', pick(['Coffee', 'Bubble tea']));
    if (weekday) add(d, 'expense', 'exp-transport', r(9, 24), 'm-octopus', 'MTR');
    if (weekday && chance(0.5)) add(d, 'expense', 'exp-transport', r(5, 12), 'm-octopus', pick(['Bus', 'Minibus']));
    if (chance(0.08)) add(d, 'expense', 'exp-transport', r(60, 140), 'm-cash', 'Taxi');
    if (chance(0.12)) add(d, 'expense', 'exp-shopping', r(80, 900), pick(['m-card', 'm-payme']), pick(['Uniqlo', 'HKTVmall', 'Groceries', 'Taobao', 'IKEA', 'Sneakers']));
    if (dow === 6 && chance(0.6)) add(d, 'expense', 'exp-entertainment', r(100, 450), pick(['m-card', 'm-payme']), pick(['Movie', 'Karaoke', 'Concert', 'Board game café']));
    if (chance(0.04)) add(d, 'expense', 'exp-health', r(150, 600), pick(['m-card', 'm-cash']), pick(['Clinic', 'Pharmacy', 'Dentist']));
    if (chance(0.025)) add(d, 'expense', 'exp-education', r(200, 1200), 'm-card', pick(['Books', 'Online course']));
    if (chance(0.03)) add(d, 'expense', 'exp-gifts', r(150, 800), pick(['m-card', 'm-fps']), pick(['Birthday gift', 'Wedding gift', 'Farewell gift']));
    if (chance(0.03)) add(d, 'expense', 'exp-other', r(30, 300), 'm-cash', pick(['Haircut', 'Laundry', 'Stationery']));
    if (dom === 1) add(d, 'expense', 'exp-rent', 12500, 'm-bank', 'Monthly rent');
    if (dom === 3) add(d, 'expense', 'exp-sports', 498, 'm-card', 'Gym membership');
    if (dom === 5) add(d, 'expense', 'exp-subs', 93, 'm-card', 'Netflix');
    if (dom === 12) add(d, 'expense', 'exp-subs', 69, 'm-card', 'Spotify');
    if (dom === 20) add(d, 'expense', 'exp-subs', 23, 'm-card', 'iCloud+');
    if (dom === 15) add(d, 'expense', 'exp-bills', r(450, 780), 'm-bank', 'Electricity & water');
    if (dom === 18) add(d, 'expense', 'exp-bills', 198, 'm-card', 'Mobile plan');
    if (dom === 25) add(d, 'income', 'inc-salary', 32000, 'm-bank', 'Monthly salary');
    if ((dow === 2 || dow === 4) && chance(0.8)) add(d, 'income', 'inc-tutoring', 450, 'm-fps', 'Tutoring – Ethan');
    if (dow === 0 && chance(0.7)) add(d, 'income', 'inc-coaching', 800, 'm-payme', 'Badminton coaching');
    if (dom === 10 && mon % 3 === 0) add(d, 'income', 'inc-investment', 1250, 'm-bank', 'Dividend');
    if (chance(0.006)) add(d, 'income', 'inc-gifts', r(200, 1000), 'm-cash', 'Lai see');
  }
  return out;
}

/** Sample budgets, goals and recurring rules. Rules start at their NEXT date so they don't duplicate the sample history. */
export function makeSampleExtras(td = today()) {
  const next = (day) => {
    const mk = monthOf(td), d = `${mk}-${String(day).padStart(2, '0')}`;
    return d > td ? d : `${addMonths(mk, 1)}-${String(day).padStart(2, '0')}`;
  };
  const rule = (id, type, categoryId, dollars, methodId, note, day) => ({ id: `sample-rec-${id}`, type, categoryId, amount: dollars * 100, methodId, note, frequency: 'monthly', startDate: next(day), endDate: '', count: 0, active: true });
  return {
    budgets: [
      { categoryId: '__total', amount: 2500000 }, { categoryId: 'exp-food', amount: 450000 }, { categoryId: 'exp-transport', amount: 70000 },
      { categoryId: 'exp-shopping', amount: 150000 }, { categoryId: 'exp-entertainment', amount: 100000 },
    ],
    goals: [
      { id: 'sample-goal-japan', name: 'Japan trip', icon: '🗾', target: 3000000, saved: 1850000, deadline: '2027-04-30', createdAt: Date.now(), history: [] },
      { id: 'sample-goal-emergency', name: 'Emergency fund', icon: '🛟', target: 10000000, saved: 4200000, deadline: '2027-12-31', createdAt: Date.now(), history: [] },
      { id: 'sample-goal-laptop', name: 'New laptop', icon: '💻', target: 1200000, saved: 1200000, deadline: '', createdAt: Date.now(), history: [] },
    ],
    recurring: [
      rule('salary', 'income', 'inc-salary', 32000, 'm-bank', 'Monthly salary', 25),
      rule('rent', 'expense', 'exp-rent', 12500, 'm-bank', 'Monthly rent', 1),
      rule('gym', 'expense', 'exp-sports', 498, 'm-card', 'Gym membership', 3),
      rule('netflix', 'expense', 'exp-subs', 93, 'm-card', 'Netflix', 5),
      rule('spotify', 'expense', 'exp-subs', 69, 'm-card', 'Spotify', 12),
      rule('mobile', 'expense', 'exp-bills', 198, 'm-card', 'Mobile plan', 18),
    ],
  };
}
