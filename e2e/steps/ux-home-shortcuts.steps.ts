import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildHostRoomAccountRow, mockHostRoomServices, seedHostRoomAuthSession } from './browser-flow.helpers';
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
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveAttribute('href', '/history');
  await expect(page.locator('a[href="/history"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('href', '/userPreferences');
});
When('I keyboard open History from the Home shortcut', async ({ page }) => {
  const link = page.getByRole('link', { name: 'History', exact: true });
  await link.focus();
  await page.keyboard.press('Enter');
});
Then('local History is available from the shortcut', async ({ page }) => {
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText(/No game history yet\./)).toBeVisible();
});
Then('the Home room entry remains available', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Join Room', exact: true })).toBeVisible();
});
