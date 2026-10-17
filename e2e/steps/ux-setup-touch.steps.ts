import { writeFile } from 'node:fs/promises';
import { expect, devices, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockTeamDataCatalogue, PERSISTED_STORE_KEY } from './browser-flow.helpers';
const { Given, When, Then, After } = createBdd();
const touchBrowsers = new WeakMap<Page, { context: BrowserContext; page: Page }>();
const touchPage = (owner: Page) => {
  const fixture = touchBrowsers.get(owner);
  if (!fixture) throw new Error('Touch setup fixture is not open');
  return fixture.page;
};
const swipeUp = async (mobile: Page, session: CDPSession, x: number, y: number) => {
  const distance = Math.min(180, y - 10);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let index = 1; index <= 12; index++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance * index / 12 }] });
    await mobile.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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


Given('the touch setup player list contains {int} saved players', async ({ page }, count: number) => {
  const mobile = touchPage(page);
  await mobile.evaluate(({ key, count }) => {
    const fixture = JSON.parse(localStorage.getItem(key) ?? '{}');
    fixture.state.players = Array.from({ length: count }, (_, index) => ({ id: `touch-${index}`, name: `Touch saved player ${index + 1}` }));
    localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: PERSISTED_STORE_KEY, count });
  await mobile.reload();
  await expect(mobile.getByRole('textbox', { name: 'Player name', exact: true })).toBeVisible();
});
When('the touch keyboard reduces only the visual viewport at offset {int}', async ({ page }, offset: number) => {
  const mobile = touchPage(page);
  await mobile.evaluate(() => {
    if (!window.visualViewport) throw new Error('Visual viewport is unavailable');
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 304 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, get: () => 0 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(mobile.getByTestId('SetupWizardContent')).toHaveCSS('overflow-y', 'visible');
  // Chrome can pan without another resize once the keyboard is open.
  await mobile.evaluate(offset => {
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, get: () => offset });
    window.visualViewport?.dispatchEvent(new Event('scroll'));
  }, offset);
  await expect(mobile.getByRole('textbox', { name: 'Player name', exact: true })).toBeFocused();
  expect(await mobile.evaluate(() => innerHeight)).toBe(623);
  await expect.poll(async () => {
    const box = await mobile.getByTestId('SetupWizardPageScroll').boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(offset + 304);
  await expect.poll(async () => (await mobile.getByTestId('SetupWizardPageScroll').boundingBox())?.y ?? -Infinity).toBeGreaterThanOrEqual(offset);
});
Then('trusted touch drags over the player list reveal Next without losing the input', async ({ page, $testInfo }) => {
  const mobile = touchPage(page);
  const outer = mobile.getByTestId('SetupWizardPageScroll');
  const list = mobile.getByTestId('SetupPlayersList');
  await list.evaluate(element => element.addEventListener('touchmove', event => {
    if (event.isTrusted) element.setAttribute('data-ux-trusted-drag', 'true');
  }, { capture: true }));
  const session = await mobile.context().newCDPSession(mobile);
  const trace: object[] = [];
  const visualTop = await mobile.evaluate(() => visualViewport?.offsetTop ?? 0);
  const visualBottom = visualTop + 304;
  try {
    // Reveal the list with a real drag over the outer scrollport's unoccupied edge.
    const outerBox = await outer.boundingBox();
    if (!outerBox) throw new Error('Outer touch scrollport is missing');
    const edgeX = outerBox.x + outerBox.width - 4;
    const edgeY = outerBox.y + outerBox.height - 12;
    await swipeUp(mobile, session, edgeX, edgeY);
    await expect.poll(() => outer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    for (let attempt = 0; attempt < 20; attempt++) {
      const box = await list.boundingBox();
      if (!box) throw new Error('Player list bounds are missing');
      const y = Math.min(box.y + box.height - 12, outerBox.y + outerBox.height - 12);
      const x = box.x + box.width / 2;
      expect(y).toBeGreaterThan(Math.max(box.y, outerBox.y));
      const before = await outer.evaluate(element => element.scrollTop);
      const start = await mobile.evaluate(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        const list = document.querySelector('[data-testid="SetupPlayersList"]');
        return { insideList: !!hit && !!list?.contains(hit), touchAction: hit ? getComputedStyle(hit).touchAction : null };
      }, { x, y });
      expect(start.insideList).toBe(true);
      await swipeUp(mobile, session, x, y);
      await expect.poll(() => outer.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
      const after = await outer.evaluate(element => element.scrollTop);
      trace.push({ attempt, start, before, after });
      const next = await mobile.getByRole('button', { name: 'Next', exact: true }).boundingBox();
      if (next && next.y >= visualTop && next.y + next.height <= visualBottom) break;
    }
    await expect(list).toHaveAttribute('data-ux-trusted-drag', 'true');
    const next = mobile.getByRole('button', { name: 'Next', exact: true });
    await expect(next).toBeInViewport({ ratio: 1 });
    const nextBox = await next.boundingBox();
    expect(nextBox!.y).toBeGreaterThanOrEqual(visualTop);
    expect(nextBox!.y + nextBox!.height).toBeLessThanOrEqual(visualBottom);
    const input = mobile.getByRole('textbox', { name: 'Player name', exact: true });
    await expect(input).toHaveAttribute('data-ux-original-input', 'true');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Touch pending player');
    const evidence = { trace, innerHeight: await mobile.evaluate(() => innerHeight), visualHeight: await mobile.evaluate(() => visualViewport?.height), visualTop, scrollOwner: await outer.evaluate(element => ({ top: element.scrollTop, clientHeight: element.clientHeight, contentHeight: element.scrollHeight })), next: nextBox };
    await writeFile($testInfo.outputPath('trusted-touch-scroll.json'), JSON.stringify(evidence));
    await $testInfo.attach('trusted-touch-scroll', { body: JSON.stringify(evidence), contentType: 'application/json' });
    const screenshot = $testInfo.outputPath('touch-scroll-next.png');
    await mobile.screenshot({ path: screenshot, clip: { x: 0, y: visualTop, width: 360, height: 304 }, scale: 'css' });
    await $testInfo.attach('touch-scroll-next', { path: screenshot, contentType: 'image/png' });
  } finally { await session.detach(); }
});
