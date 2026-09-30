import { test, expect, type Page } from '@playwright/test';
async function navigate(page: Page, name: string) {
  await expect(page.locator('.topbar')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Add expense', exact: true }).first(),
  ).toBeEnabled();
});
test('dashboard is responsive, with no browser errors or horizontal overflow', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: /Good things grow here/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `test-results/${info.project.name}-overview.png`, fullPage: true });
  for (const screen of ['Expenses', 'Budgets', 'Savings goals', 'Household']) {
    await navigate(page, screen === 'Household' ? 'Household 2' : screen);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('private expense can be added, persisted, edited and deleted', async ({ page }) => {
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What was it for?').fill('Personal book');
  await dialog.getByLabel('Amount (INR)').fill('499.50');
  await dialog.getByRole('button', { name: /Only me/ }).click();
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await navigate(page, 'Expenses');
  await page.getByRole('button', { name: 'Only me', exact: true }).click();
  await expect(page.getByText('Personal book', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Personal book', exact: true }).click();
  await dialog.getByLabel('Amount (INR)').fill('599.50');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('−₹599.5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Personal book' }).click();
  await dialog.getByRole('button', { name: 'Delete expense', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete expense', exact: true })
    .click();
  await expect(page.getByText('Personal book', { exact: true })).not.toBeVisible();
});
test('rejects mismatched custom splits, then saves valid ones', async ({ page }) => {
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What was it for?').fill('Shared dinner');
  await dialog.getByLabel('Amount (INR)').fill('100');
  await dialog.getByRole('combobox', { name: 'Split method' }).selectOption('custom');
  await dialog.getByRole('spinbutton', { name: "Alex's share" }).fill('60');
  await dialog.getByRole('spinbutton', { name: "Sam's share" }).fill('30');
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('add up');
  await dialog.getByRole('spinbutton', { name: "Sam's share" }).fill('40');
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, 'Expenses');
  await page.getByRole('button', { name: 'Edit Shared dinner' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Split method' })).toHaveValue('custom');
  await expect(dialog.getByRole('spinbutton', { name: "Alex's share" })).toHaveValue('60');
});
test('household budgets and savings goals can be customized', async ({ page }) => {
  await navigate(page, 'Budgets');
  await page.getByRole('button', { name: 'Edit Groceries budget' }).click();
  await page.getByRole('dialog').getByLabel('Monthly budget (INR)').fill('12000');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await expect(page.getByText('/ ₹12,000', { exact: false })).toBeVisible();
  await navigate(page, 'Savings goals');
  await page.getByRole('button', { name: 'New goal', exact: true }).click();
  await page.getByLabel('What’s the dream?').fill('A new beginning');
  await page.getByLabel('Target (INR)').fill('50000');
  await page.getByLabel('Already saved').fill('1000');
  await page.getByRole('button', { name: 'Save your dream' }).click();
  await expect(page.getByRole('heading', { name: 'A new beginning' })).toBeVisible();
  await page.reload();
  await navigate(page, 'Savings goals');
  await expect(page.getByRole('heading', { name: 'A new beginning' })).toBeVisible();
});
test('search, month filtering, and CSV export work', async ({ page }) => {
  await navigate(page, 'Expenses');
  await page.getByRole('textbox', { name: 'Search expenses' }).fill('grocery');
  await expect(page.getByText('Weekly grocery run', { exact: true })).toBeVisible();
  await expect(page.getByText('Home sweet home', { exact: true })).not.toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export expenses as CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^homemint-expenses-\d{4}-\d{2}\.csv$/);
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'A fresh start' })).toBeVisible();
});
