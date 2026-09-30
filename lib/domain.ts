export const categories = [
  'Groceries',
  'Home & utilities',
  'Transport',
  'Health & insurance',
  'Food & dining',
  'Shopping',
  'Family & kids',
  'Entertainment',
  'Other',
] as const;
export type Category = (typeof categories)[number];
export type Member = { id: string; name: string; email: string; role: 'owner' | 'member' };
export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: Category;
  date: string;
  owner_id: string;
  visibility: 'shared' | 'private';
  splits: Record<string, number>;
  recurring: boolean;
};
export type Budget = { id: string; category: Category; amount: number };
export type Goal = { id: string; name: string; target: number; saved: number; emoji: string };
export type Household = { id: string; name: string; currency: string; monthly_income: number };
export type Data = {
  household: Household;
  members: Member[];
  expenses: Expense[];
  budgets: Budget[];
  goals: Goal[];
};
export const today = () => new Date().toLocaleDateString('en-CA');
export const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
export function splitEvenly(amount: number, ids: string[]): Record<string, number> {
  if (!ids.length || !Number.isFinite(amount) || amount <= 0)
    throw new Error('Choose at least one person and a positive amount.');
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / ids.length);
  return Object.fromEntries(
    ids.map((id, i) => [id, (base + (i < cents % ids.length ? 1 : 0)) / 100]),
  );
}
export function validateExpense(expense: Omit<Expense, 'id'>, memberIds: string[]) {
  if (!expense.title.trim() || expense.title.length > 120)
    throw new Error('Enter a description of up to 120 characters.');
  if (
    !Number.isFinite(expense.amount) ||
    expense.amount <= 0 ||
    expense.amount > 100000000 ||
    Math.abs(expense.amount * 100 - Math.round(expense.amount * 100)) > 0.00001
  )
    throw new Error('Enter a valid amount greater than zero, with at most two decimal places.');
  if (!categories.includes(expense.category)) throw new Error('Choose a valid category.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(expense.date) ||
    Number.isNaN(Date.parse(expense.date)) ||
    new Date(expense.date).toISOString().slice(0, 10) !== expense.date
  )
    throw new Error('Choose a valid date.');
  const splits = Object.entries(expense.splits);
  if (
    !splits.length ||
    splits.some(
      ([id, value]) =>
        !memberIds.includes(id) ||
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.00001,
    )
  )
    throw new Error('Check the people and amounts in your split.');
  if (Math.abs(splits.reduce((sum, [, value]) => sum + value, 0) - expense.amount) > 0.005)
    throw new Error('Split amounts must add up to the expense total.');
  if (
    expense.visibility === 'private' &&
    (splits.length !== 1 || splits[0][0] !== expense.owner_id)
  )
    throw new Error('Private expenses can only be assigned to you.');
}
export function balances(expenses: Expense[], memberIds: string[]) {
  const result: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  for (const expense of expenses.filter((e) => e.visibility === 'shared')) {
    result[expense.owner_id] = (result[expense.owner_id] || 0) + Math.round(expense.amount * 100);
    for (const [id, share] of Object.entries(expense.splits))
      result[id] = (result[id] || 0) - Math.round(share * 100);
  }
  return Object.fromEntries(Object.entries(result).map(([id, cents]) => [id, cents / 100]));
}
export function makeDemo(): Data {
  const month = monthKey();
  const date = (day: number) =>
    `${month}-${String(Math.min(day, new Date().getDate())).padStart(2, '0')}`;
  return {
    household: { id: 'demo', name: 'The Green family', currency: 'INR', monthly_income: 120000 },
    members: [
      { id: 'you', name: 'Alex', email: 'alex@example.com', role: 'owner' },
      { id: 'sam', name: 'Sam', email: 'sam@example.com', role: 'member' },
    ],
    expenses: [
      {
        id: 'e1',
        title: 'Weekly grocery run',
        amount: 2840,
        category: 'Groceries',
        date: date(28),
        owner_id: 'you',
        visibility: 'shared',
        splits: { you: 1420, sam: 1420 },
        recurring: false,
      },
      {
        id: 'e2',
        title: 'A little coffee break',
        amount: 380,
        category: 'Food & dining',
        date: date(27),
        owner_id: 'you',
        visibility: 'private',
        splits: { you: 380 },
        recurring: false,
      },
      {
        id: 'e3',
        title: 'Home sweet home',
        amount: 22000,
        category: 'Home & utilities',
        date: date(1),
        owner_id: 'you',
        visibility: 'shared',
        splits: { you: 11000, sam: 11000 },
        recurring: true,
      },
      {
        id: 'e4',
        title: 'Family health cover',
        amount: 4500,
        category: 'Health & insurance',
        date: date(5),
        owner_id: 'sam',
        visibility: 'shared',
        splits: { you: 2250, sam: 2250 },
        recurring: true,
      },
      {
        id: 'e5',
        title: 'School supplies',
        amount: 1650,
        category: 'Family & kids',
        date: date(23),
        owner_id: 'sam',
        visibility: 'shared',
        splits: { you: 825, sam: 825 },
        recurring: false,
      },
      {
        id: 'e6',
        title: 'Fresh finds at the market',
        amount: 3260,
        category: 'Groceries',
        date: date(15),
        owner_id: 'sam',
        visibility: 'shared',
        splits: { you: 1630, sam: 1630 },
        recurring: false,
      },
      {
        id: 'e7',
        title: 'Fuel for the week',
        amount: 2400,
        category: 'Transport',
        date: date(19),
        owner_id: 'you',
        visibility: 'shared',
        splits: { you: 1200, sam: 1200 },
        recurring: false,
      },
      {
        id: 'e8',
        title: 'Friday pizza night',
        amount: 1460,
        category: 'Food & dining',
        date: date(20),
        owner_id: 'sam',
        visibility: 'shared',
        splits: { you: 730, sam: 730 },
        recurring: false,
      },
      {
        id: 'e9',
        title: 'Electricity & internet',
        amount: 3250,
        category: 'Home & utilities',
        date: date(12),
        owner_id: 'you',
        visibility: 'shared',
        splits: { you: 1625, sam: 1625 },
        recurring: true,
      },
    ],
    budgets: [
      { id: 'b1', category: 'Groceries', amount: 10000 },
      { id: 'b2', category: 'Home & utilities', amount: 30000 },
      { id: 'b3', category: 'Transport', amount: 5000 },
      { id: 'b4', category: 'Health & insurance', amount: 6000 },
      { id: 'b5', category: 'Food & dining', amount: 4000 },
      { id: 'b6', category: 'Family & kids', amount: 5000 },
    ],
    goals: [
      { id: 'g1', name: 'Our next adventure', target: 100000, saved: 64000, emoji: '🌴' },
      { id: 'g2', name: 'A little peace of mind', target: 300000, saved: 135000, emoji: '🏡' },
    ],
  };
}
