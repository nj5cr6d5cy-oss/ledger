// Default categories & payment methods. Stable ids make sample data and imports simple.
export const DEFAULT_CATEGORIES = [
  ['exp-food', 'expense', 'Food & Drinks', '🍜', '#f97316'],
  ['exp-transport', 'expense', 'Transport', '🚇', '#3b82f6'],
  ['exp-shopping', 'expense', 'Shopping', '🛍️', '#ec4899'],
  ['exp-entertainment', 'expense', 'Entertainment', '🎬', '#a855f7'],
  ['exp-bills', 'expense', 'Bills & Utilities', '💡', '#eab308'],
  ['exp-rent', 'expense', 'Rent', '🏠', '#64748b'],
  ['exp-health', 'expense', 'Health', '💊', '#ef4444'],
  ['exp-education', 'expense', 'Education', '📚', '#0ea5e9'],
  ['exp-sports', 'expense', 'Sports/Gym', '🏋️', '#22c55e'],
  ['exp-subs', 'expense', 'Subscriptions', '🔁', '#8b5cf6'],
  ['exp-gifts', 'expense', 'Gifts', '🎁', '#f43f5e'],
  ['exp-other', 'expense', 'Other', '📦', '#94a3b8'],
  ['inc-salary', 'income', 'Salary', '💼', '#059669'],
  ['inc-tutoring', 'income', 'Part-time/Tutoring', '🧑‍🏫', '#0d9488'],
  ['inc-coaching', 'income', 'Coaching', '🏅', '#14b8a6'],
  ['inc-investment', 'income', 'Investment', '📈', '#10b981'],
  ['inc-gifts', 'income', 'Gifts', '🎁', '#84cc16'],
  ['inc-other', 'income', 'Other', '💰', '#65a30d'],
].map(([id, type, name, icon, color], i) => ({ id, type, name, icon, color, order: i, archived: false }));

export const DEFAULT_METHODS = [
  ['m-cash', 'Cash', '💵'],
  ['m-octopus', 'Octopus', '🐙'],
  ['m-card', 'Credit card', '💳'],
  ['m-fps', 'FPS', '⚡'],
  ['m-payme', 'PayMe', '📱'],
  ['m-bank', 'Bank transfer', '🏦'],
].map(([id, name, icon], i) => ({ id, name, icon, order: i, archived: false }));

export const EMOJIS = ['🍜','🍔','☕','🍺','🛒','🚇','🚕','⛽','✈️','🛍️','👕','💄','🎬','🎮','🎵','📺','💡','💧','📶','🏠','🔧','💊','🩺','🦷','📚','🎓','🏋️','⚽','🏸','🔁','🎁','👶','🐶','💈','📦','💼','🧑‍🏫','🏅','📈','💰','💵','🐙','💳','⚡','📱','🏦','🧾','❤️'];
export const COLORS = ['#f97316','#eab308','#22c55e','#059669','#14b8a6','#0ea5e9','#3b82f6','#8b5cf6','#a855f7','#ec4899','#f43f5e','#ef4444','#64748b','#94a3b8'];
