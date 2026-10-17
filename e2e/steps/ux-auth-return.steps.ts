import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildHostRoomAccountRow, buildHostRoomAuthSession, mockHostRoomServices } from './browser-flow.helpers';
const { Given, When, Then } = createBdd();
Given('the UX account recovery services are mocked', async ({ page }) => {
  await mockHostRoomServices(page);
  await page.route('**/rest/v1/rpc/bootstrap_account', route => route.fulfill({ json: { ...buildHostRoomAccountRow(), username: 'Alice_Host' } }));
  await page.route('**/auth/v1/token**', route => route.fulfill({ json: buildHostRoomAuthSession() }));
  await page.route('**/rest/v1/rpc/list_social_relationships', route => route.fulfill({ json: { items: [], next_cursor: null } }));
  for (const table of ['completed_session_summaries', 'early_leave_results']) {
    await page.route('**/rest/v1/' + table + '**', route => route.fulfill({ json: [] }));
  }
});
When('I open Friends recovery from Home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Friends', exact: true }).click();
  await expect(page).toHaveURL(/\/friends$/);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
});
When('I open a Requests recovery link', async ({ page }) => {
  await page.goto('/friends?tab=requests');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/returnTo=%2Ffriends%3Ftab%3Drequests/);
});
When('I sign in through the UX recovery form', async ({ page }) => {
  await page.getByLabel('Email address', { exact: true }).fill('host-room@example.com');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: /Sign in.*→/ }).click();
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toBeVisible();
});
When('I select Requests after UX sign-in', async ({ page }) => {
  await page.getByRole('tab', { name: 'Requests', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toHaveAttribute('aria-selected', 'true');
});
Then('the UX recovery Requests tab is selected', async ({ page }) => {
  await expect(page).toHaveURL(/\/friends\?tab=requests$/);
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toHaveAttribute('aria-selected', 'true');
});
When('I use the UX Friends header Back', async ({ page }) => { await page.getByRole('button', { name: 'Back', exact: true }).click(); });
Then('the UX account recovery Home caller is visible', async ({ page }) => {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Friends', exact: true })).toBeVisible();
});
