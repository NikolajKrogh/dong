import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildHostRoomAccountRow, mockHostRoomServices, seedHostRoomAuthSession } from './browser-flow.helpers';
const { Given, When, Then } = createBdd();

Given('the accessibility Home fixture is open', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Start New Game', exact: true })).toBeVisible();
});
Then('the accessibility Home exposes one main and a descriptive title', async ({ page }) => {
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCSS('font-family', 'system-ui');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Home · DONG');
  await expect(page.getByRole('main').getByRole('main')).toHaveCount(0);
});
When('I keyboard activate the accessibility setup link', async ({ page }) => {
  const destination = page.getByRole('link', { name: 'Start New Game', exact: true });
  await expect(destination).toHaveAttribute('href', '/setupGame');
  await page.keyboard.press('Tab');
  await expect(destination).toBeFocused();
  await expect(destination).toHaveCSS('outline-style', 'solid');
  await expect(destination).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
});
Then('the accessibility setup destination opens once', async ({ page }) => {
  await expect(page).toHaveURL(/\/setupGame$/);
  await expect(page.getByTestId('SetupAddPlayerButton')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
Given('the accessibility account form is open', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
});
Then('the accessibility sign-in fields declare their purposes', async ({ page }) => {
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('autocomplete', 'username');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveJSProperty('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in or create account' })).toBeVisible();
});
When('I switch the accessibility form to registration and submit mismatched passwords', async ({ page }) => {
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toHaveAttribute('autocomplete', 'nickname');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('autocomplete', 'email');
  await page.getByLabel('Password', { exact: true }).fill('different-password');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
  await page.getByRole('button', { name: /Create account.*→/ }).click();
});
Then('the accessibility registration error is associated and announced', async ({ page }) => {
  const error = page.getByRole('alert');
  await expect(error).toHaveText("Passwords don't match.");
  await expect(error).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute('aria-describedby', await error.getAttribute('id') ?? 'missing-error-id');
});
When('I submit the accessibility sign-in form to a pending service', async ({ page }) => {
  await page.route('**/auth/v1/token**', async (route) => {
    await new Promise<void>((resolve) => page.once('close', () => resolve()));
    await route.abort().catch(() => undefined);
  });
  await page.getByLabel('Email address', { exact: true }).fill('fixture@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: /Sign in.*→/ }).click();
});
Then('the accessibility pending command is disabled', async ({ page }) => {
  const pending = page.getByRole('button', { name: 'Please wait…', exact: true });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute('aria-disabled', 'true');
  await expect(pending).toHaveJSProperty('tagName', 'BUTTON');
});

Given('the accessibility page {string} is open', async ({ page }, route: string) => {
  if (route === '/userPreferences/profile') {
    await mockHostRoomServices(page);
    await page.route('**/rest/v1/rpc/bootstrap_account', async (request) => {
      await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...buildHostRoomAccountRow(), username: 'Alice_Host' }) });
    });
    await seedHostRoomAuthSession(page);
  }
  await page.goto(route);
});
Then('the accessibility page has one main with heading {string} and title {string}', async ({ page }, heading: string, title: string) => {
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(title);
  await expect(page.getByText('DRINK!', { exact: true })).toHaveCount(0);
});
Then('the accessibility History recovery is inside main', async ({ page }) => {
  const main = page.getByRole('main');
  await expect(main).toHaveCount(1);
  await expect(main.getByRole('alert')).toHaveText('This game is unavailable on this device or account.');
  await expect(main.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/');
});
