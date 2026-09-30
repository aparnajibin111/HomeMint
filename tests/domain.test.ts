import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  balances,
  makeDemo,
  money,
  splitEvenly,
  validateExpense,
  type Expense,
} from '../lib/domain';

test('equal splits preserve every paisa, including indivisible amounts', () => {
  assert.deepEqual(splitEvenly(100, ['a', 'b', 'c']), { a: 33.34, b: 33.33, c: 33.33 });
  assert.deepEqual(splitEvenly(0.01, ['a', 'b']), { a: 0.01, b: 0 });
  assert.throws(() => splitEvenly(10, []));
  assert.throws(() => splitEvenly(-1, ['a']));
  assert.match(money(33.34, 'INR'), /33\.34/);
});
test('custom splits must match the total and only use household members', () => {
  const expense: Expense = {
    id: '1',
    title: 'Groceries',
    date: '2026-09-30',
    amount: 100,
    owner_id: 'a',
    category: 'Groceries',
    visibility: 'shared',
    splits: { a: 60, b: 40 },
    recurring: false,
  };
  assert.doesNotThrow(() => validateExpense(expense, ['a', 'b']));
  assert.throws(
    () => validateExpense({ ...expense, splits: { a: 50, b: 40 } }, ['a', 'b']),
    /add up/,
  );
  assert.throws(
    () => validateExpense({ ...expense, splits: { a: 60, c: 40 } }, ['a', 'b']),
    /people/,
  );
  assert.throws(
    () => validateExpense({ ...expense, visibility: 'private' }, ['a', 'b']),
    /Private/,
  );
  assert.doesNotThrow(() =>
    validateExpense({ ...expense, visibility: 'private', splits: { a: 100 } }, ['a', 'b']),
  );
});
test('net balances sum to zero and exclude private expenses', () => {
  const data = makeDemo();
  const result = balances(data.expenses, ['you', 'sam']);
  assert.equal(result.you + result.sam, 0);
  assert.deepEqual(
    result,
    balances(
      data.expenses.filter((e) => e.visibility === 'shared'),
      ['you', 'sam'],
    ),
  );
  for (const expense of data.expenses) validateExpense(expense, ['you', 'sam']);
});
