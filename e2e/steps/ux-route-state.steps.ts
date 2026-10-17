import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockTeamDataCatalogue } from './browser-flow.helpers';
const { Given, When, Then } = createBdd();
When('I advance UX setup through Matches and Common', async ({ page }) => {
  await page.goto('/setupGame');
  await expect(page.getByTestId('SetupWizardStep-players')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('SetupWizardNext').click();
  await expect(page.getByTestId('SetupWizardStep-matches')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('SetupWizardNext').click();
  await expect(page.getByTestId('SetupWizardStep-common')).toHaveAttribute('aria-selected', 'true');
});
When('I press the visible UX wizard Back action', async ({ page }) => { await page.getByTestId('SetupWizardBack').click(); });
Given(/^UX route fixtures contain (?:a|an) (valid|empty) saved solo setup$/, async ({ page }, kind: string) => {
  await mockTeamDataCatalogue(page);
  await page.route('**/v1/matches**', route => route.fulfill({ json: [] }));
  const fixture = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset(kind === 'empty' ? { playerNames: [], matches: [], commonMatchIndex: -1 } : {}));
  await page.addInitScript(value => { localStorage.setItem('hasLaunched', 'true'); if (!localStorage.getItem('ux-route-fixture')) {
    localStorage.setItem('dong-storage', JSON.stringify(value));
    localStorage.setItem('ux-route-fixture', 'true');
  } }, fixture);
});
Given('UX route fixtures contain one local completed game', async ({ page }) => {
  await mockTeamDataCatalogue(page);
  const fixture = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset());
  fixture.state.history = [{ id: 'ux-local-game', date: '2026-10-16T19:00:00.000Z', players: [{ id: 'p1', name: 'Local route player', drinksTaken: 2 }], matches: fixture.state.matches, commonMatchId: 'm1', playerAssignments: { p1: ['m1'] } }];
  await page.addInitScript(value => { localStorage.setItem('hasLaunched', 'true'); if (!localStorage.getItem('ux-route-fixture')) {
    localStorage.setItem('dong-storage', JSON.stringify(value));
    localStorage.setItem('ux-route-fixture', 'true');
  } }, fixture);
});
When('I visit the UX setup matches route', async ({ page }) => { await page.goto('/setupGame?step=matches'); await expect(page.getByTestId('SetupWizardStep-matches')).toHaveAttribute('aria-selected', 'true'); });
When('I choose the UX common step and refresh', async ({ page }) => { await page.getByTestId('SetupWizardStep-common').click(); await expect(page).toHaveURL(/step=common/); await page.reload(); });
Then('the UX {word} step is current', async ({ page }, key: string) => { await expect(page.getByTestId('SetupWizardStep-' + key)).toHaveAttribute('aria-selected', 'true'); });
When('I use browser Back for UX route state', async ({ page }) => { await page.goBack(); });
When('I use browser Forward for UX route state', async ({ page }) => { await page.goForward(); });
When('I visit an inaccessible UX assignment route', async ({ page }) => { await page.goto('/setupGame?step=assign'); });
Then('the UX players step explains its missing prerequisites', async ({ page }) => { await expect(page.getByTestId('SetupWizardStep-players')).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('alert')).toContainText('Complete this step'); await expect(page).not.toHaveURL(/step=assign/); });
When('I visit the UX players History route and refresh', async ({ page }) => { await page.goto('/history?tab=players&sort=goals&direction=asc'); await expect(page.getByTestId('HistoryTab-Players')).toHaveAttribute('aria-selected', 'true'); await page.reload(); });
Then('the UX {word} History tab is selected', async ({ page }, tab: string) => { await expect(page.getByRole('tab', { name: new RegExp(tab + '$') })).toHaveAttribute('aria-selected', 'true'); });
When('I open the UX game detail route and refresh', async ({ page }) => { await page.getByTestId('HistoryTab-Games').click(); await page.getByRole('button', { name: /Oct 16, 2026.*Local route player/ }).first().click(); await expect(page).toHaveURL(/gameId=ux-local-game/); await page.reload(); });
Then('the UX local game details are visible', async ({ page }) => { await expect(page.getByRole('button', { name: 'Close game details', exact: true })).toBeVisible(); await expect(page.getByText('Local route player', { exact: true }).last()).toBeVisible(); });
When('I visit an unavailable UX History detail', async ({ page }) => { await page.goto('/history?gameId=unavailable-on-this-device'); });
Then('UX History explains that the detail is unavailable', async ({ page }) => { await expect(page.getByRole('alert')).toContainText('unavailable on this device or account'); await expect(page).not.toHaveURL(/gameId=/); });
When('I visit an ambiguous UX History tab', async ({ page }) => { await page.goto('/history?tab=stats&tab=players&sort=obsolete'); });
When('I visit a signed-out UX comparison target', async ({ page }) => { await page.goto('/history?friendId=00000000-0000-4000-8000-000000000002'); });
Then('UX History requires sign-in for online statistics', async ({ page }) => { await expect(page.getByText('Sign in to see your online statistics.', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: /Compare with/ })).toHaveCount(0); });
When('I visit a direct UX game detail', async ({ page }) => { await page.goto('/history?gameId=ux-local-game'); });
When('I refresh the UX route page', async ({ page }) => { await page.reload(); });
When('I visit the UX Settings caller', async ({ page }) => { await page.goto('/userPreferences'); });
When('I close the UX game details', async ({ page }) => { await page.getByRole('button', { name: 'Close game details', exact: true }).click(); });
Then('the UX Settings caller is visible', async ({ page }) => { await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible(); });
Given('UX session storage is unavailable', async ({ page }) => { await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } }); }); });
