import { expect, devices, type BrowserContext, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockTeamDataCatalogue, PERSISTED_STORE_KEY } from './browser-flow.helpers';
const { Given, When, Then, After } = createBdd();
const touchBrowsers = new WeakMap<Page, { context: BrowserContext; page: Page }>();
const touchPage = (owner: Page) => {
  const fixture = touchBrowsers.get(owner);
  if (!fixture) throw new Error('Touch setup fixture is not open');
  return fixture.page;
};
After({ tags: '@ux-setup-touch' }, async ({ page }) => {
  await touchBrowsers.get(page)?.context.close();
  touchBrowsers.delete(page);
});
Given('an empty solo setup is open in a touch browser through {word}', async ({ page, browser, $testInfo }, entry: string) => {
  const context = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 623 }, baseURL: $testInfo.project.use.baseURL, hasTouch: true, isMobile: true });
  const mobile = await context.newPage();
  touchBrowsers.set(page, { context, page: mobile });
  await mockTeamDataCatalogue(mobile);
  await mobile.route('**/v1/matches**', route => route.fulfill({ json: [] }));
  const fixture = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset({ playerNames: [], matches: [], commonMatchIndex: -1 }));
  await mobile.addInitScript(({ fixture, key }) => {
    localStorage.setItem('hasLaunched', 'true');
    if (!localStorage.getItem('ux-touch-ready')) {
      localStorage.setItem(key, JSON.stringify(fixture));
      localStorage.setItem('ux-touch-ready', 'true');
    }
  }, { fixture, key: PERSISTED_STORE_KEY });
  await mobile.goto(entry === 'Home' ? '/' : '/setupGame');
  if (entry === 'Home') await mobile.getByRole('link', { name: 'Start New Game', exact: true }).tap();
  await expect(mobile.getByRole('textbox', { name: 'Player name', exact: true })).toHaveValue('');
});
When('I tap the touch player input and type a pending name', async ({ page }) => {
  const mobile = touchPage(page);
  expect(await mobile.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  const input = mobile.getByRole('textbox', { name: 'Player name', exact: true });
  await input.tap();
  await expect(input).toBeFocused();
  await mobile.keyboard.type('Touch pending player');
  await expect(input).toHaveValue('Touch pending player');
  await input.evaluate(element => element.setAttribute('data-ux-original-input', 'true'));
});
When('the touch viewport shrinks and expands around the keyboard threshold', async ({ page, $testInfo }) => {
  const mobile = touchPage(page);
  const input = mobile.getByRole('textbox', { name: 'Player name', exact: true });
  for (const height of [360, 623]) {
    await mobile.setViewportSize({ width: 360, height });
    await expect(mobile.getByTestId('SetupWizardContent')).toHaveCSS('overflow-y', height < 480 ? 'visible' : 'auto');
    await expect(input).toHaveAttribute('data-ux-original-input', 'true');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Touch pending player');
    const screenshot = $testInfo.outputPath(`touch-input-height-${height}.png`);
    await mobile.screenshot({ path: screenshot });
    await $testInfo.attach(`touch-input-height-${height}`, { path: screenshot, contentType: 'image/png' });
  }
});
Then('touch Next adds the pending player once and advances to Matches', async ({ page }) => {
  const mobile = touchPage(page);
  await mobile.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(mobile.getByRole('tab', { name: 'Matches, step 2 of 4', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => mobile.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key) ?? '{}');
    return state.state?.players?.map((player: { name: string }) => player.name);
  }, PERSISTED_STORE_KEY)).toEqual(['Touch pending player']);
  await mobile.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(mobile.getByRole('textbox', { name: 'Player name', exact: true })).toHaveValue('');
  await expect(mobile.getByText('Touch pending player', { exact: true }).filter({ visible: true })).toHaveCount(1);
});
