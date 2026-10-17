import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildHostRoomAccountRow, buildHostRoomAuthSession, mockHostRoomServices, seedHostRoomAuthSession } from './browser-flow.helpers';
const { Given, When, Then } = createBdd();
Given('the Home shortcuts fixture is signed out', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Friends', exact: true })).toBeVisible();
});
Given('the Home shortcuts fixture is signed in', async ({ page }) => {
  await mockHostRoomServices(page);
  await page.route('**/rest/v1/rpc/bootstrap_account', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildHostRoomAccountRow()) });
  });
  await seedHostRoomAuthSession(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create Room', exact: true })).toBeVisible();
});
Then('the Home shortcuts are named destination links', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Friends', exact: true })).toHaveAttribute('href', '/friends');
  await expect(page.getByRole('link', { name: 'Game Stats, view history', exact: true })).toHaveAttribute('href', '/history');
  await expect(page.getByRole('link', { name: 'Game Stats, view history', exact: true }).getByText('Game Stats', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Game Stats, view history', exact: true }).getByText('Games Played', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/history"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('href', '/userPreferences');
});
When('I keyboard open History from the Game Stats card', async ({ page }) => {
  const link = page.getByRole('link', { name: 'Game Stats, view history', exact: true });
  await link.focus();
  await expect(link).toHaveCSS('outline-style', 'solid');
  await expect(link).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
});
Then('local History is available from the shortcut', async ({ page }) => {
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText(/No game history yet\./)).toBeVisible();
});
Then('the Home room entry remains available', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Join Room', exact: true })).toBeVisible();
});

Given('the Home Friends recovery services are mocked', async ({ page }) => {
  await mockHostRoomServices(page);
  await page.route('**/rest/v1/rpc/bootstrap_account', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...buildHostRoomAccountRow(), username: 'Alice_Host' }) });
  });
  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildHostRoomAuthSession()) });
  });
  await page.route('**/rest/v1/rpc/list_social_relationships', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], next_cursor: null }) });
  });
  for (const table of ['completed_session_summaries', 'early_leave_results']) {
    await page.route(`**/rest/v1/${table}**`, async (route) => { await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  }
});
When('I keyboard open Friends from the Home shortcut', async ({ page }) => {
  await page.getByRole('link', { name: 'Friends', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/friends$/);
});
When('I complete the Home Friends sign-in recovery', async ({ page }) => {
  await page.getByRole('link', { name: 'Sign in', exact: true }).or(page.getByRole('button', { name: 'Sign in', exact: true })).click();
  await expect(page).toHaveURL(/\/auth\?returnTo=%2Ffriends$/);
  await page.getByLabel('Email address', { exact: true }).fill('host-room@example.com');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: /Sign in.*→/ }).click();
});
Then('the Home Friends intended destination is restored', async ({ page }) => {
  await expect(page).toHaveURL(/\/friends$/);
  await expect(page.getByRole('heading', { name: 'Friends', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('Better games with friends', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).or(page.getByRole('button', { name: 'Sign in', exact: true }))).toHaveCount(0);
});
