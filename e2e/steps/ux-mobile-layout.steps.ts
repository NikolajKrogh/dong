import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildHostRoomAccountRow, buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockConfigureStartGameServices, mockHostRoomServices, PERSISTED_STORE_KEY, seedHostRoomAuthSession } from './browser-flow.helpers';
const { Given, When, Then } = createBdd();
Given('the compact setup fixture has {int} matches at {int} by {int} with text scale {int}', async ({ page }, rows: number, width: number, height: number, scale: number) => {
 await page.setViewportSize({ width, height });
 await mockConfigureStartGameServices(page);
 const dataset = createSetupJourneyDataset({ matches: Array.from({ length: rows }, (_, index) => ({ homeTeam: `Long home club name ${index + 1}`, awayTeam: `Long away club name ${index + 1}` })) });
 const state = buildPersistedBrowserStateFromSetupDataset(dataset);
 await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: PERSISTED_STORE_KEY, state });
 await page.goto('/setupGame?step=matches');
 await expect(page.getByTestId('SetupMatchScheduleToggle')).toBeVisible();
 await expect(page.getByTestId(`SetupPoolMatch-m${rows}`)).toBeAttached();
 if (scale === 2) {
   await page.evaluate(() => {
     const labels = Array.from(document.querySelectorAll('body *')).filter((node): node is HTMLElement => node instanceof HTMLElement && Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()));
     const sizes = labels.map(node => ({ node, size: parseFloat(getComputedStyle(node).fontSize) }));
     for (const { node, size } of sizes) node.style.fontSize = `${size * 2}px`;
   });
 }
});
Then('the compact schedule title and badges do not overlap', async ({ page }) => {
 const title = page.getByTestId('SetupMatchScheduleTitle');
 const badges = page.getByTestId('SetupMatchScheduleBadges');
 await title.scrollIntoViewIfNeeded();
 const titleBox = await title.boundingBox();
 const badgeBox = await badges.boundingBox();
 expect(titleBox).not.toBeNull(); expect(badgeBox).not.toBeNull();
 if (!titleBox || !badgeBox) throw new Error('Schedule geometry missing');
 expect(titleBox.y + titleBox.height <= badgeBox.y + 1 || titleBox.x + titleBox.width <= badgeBox.x + 1 || badgeBox.x + badgeBox.width <= titleBox.x + 1).toBe(true);
});
Then('the compact setup has no horizontal page overflow', async ({ page, $testInfo }) => {
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 const root = await page.getByTestId('SetupWizardRoot').boundingBox();
 expect(root).not.toBeNull();
 expect(root!.x + root!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
 const screenshotPath = $testInfo.outputPath('compact-setup.png');
 await page.screenshot({ path: screenshotPath });
 await $testInfo.attach('compact-setup', { path: screenshotPath, contentType: 'image/png' });
});
Then('the compact setup last match and navigation are reachable', async ({ page, $testInfo }) => {
 const last = page.locator('[data-testid^="SetupPoolMatch-m"]').last();
 await last.scrollIntoViewIfNeeded();
 await expect(last).toBeInViewport();
 const owners = await last.evaluate((element) => {
   const owners: string[] = [];
   let ancestor = element.parentElement;
   while (ancestor) {
     const style = getComputedStyle(ancestor);
     if (/(auto|scroll)/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) owners.push(ancestor.getAttribute('data-testid') ?? ancestor.tagName);
     ancestor = ancestor.parentElement;
   }
   return owners;
 });
 expect(owners.length).toBeGreaterThan(0);
 const geometry = JSON.stringify({ viewport: page.viewportSize(), owners, lastMatch: await last.getAttribute('data-testid') });
 await writeFile($testInfo.outputPath('scroll-owners.json'), geometry);
 await $testInfo.attach('scroll-owners', { body: geometry, contentType: 'application/json' });
 const next = page.getByTestId('SetupWizardNext');
 await next.scrollIntoViewIfNeeded();
 await expect(next).toBeInViewport();
 const boundary = await last.boundingBox();
 if (boundary) { await page.mouse.move(boundary.x + Math.min(20, boundary.width / 2), Math.min(page.viewportSize()!.height - 20, boundary.y + boundary.height / 2)); await page.mouse.wheel(0, 600); }
 await expect(next).toBeInViewport();
 const navigation = page.getByTestId('SetupWizardNavigation');
 await expect(navigation.getByText('Back', { exact: true })).toBeVisible();
 await expect(navigation.getByText('Next', { exact: true })).toBeVisible();
 const navigationGeometry = await navigation.evaluate(bar => {
   const rect = (element: Element) => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; };
   return { bar: rect(bar), clientWidth: bar.clientWidth, scrollWidth: bar.scrollWidth,
     actions: Array.from(bar.querySelectorAll('[role="button"]')).map(button => ({
       name: button.getAttribute('aria-label'), bounds: rect(button),
       contents: Array.from(button.querySelectorAll('*')).map(element => ({ tag: element.tagName, text: element.textContent, visible: element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), bounds: rect(element) })),
     })) };
 });
 await writeFile($testInfo.outputPath('navigation-bounds.json'), JSON.stringify(navigationGeometry, null, 2));
 expect(navigationGeometry.actions.map(action => action.name)).toEqual(['Back', 'Next']);
 expect(navigationGeometry.scrollWidth).toBeLessThanOrEqual(navigationGeometry.clientWidth + 1);
 for (const action of navigationGeometry.actions) {
   expect(action.bounds.x).toBeGreaterThanOrEqual(0);
   expect(action.bounds.y).toBeGreaterThanOrEqual(0);
   expect(action.bounds.x + action.bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
   expect(action.bounds.y + action.bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
   expect(action.bounds.x).toBeGreaterThanOrEqual(navigationGeometry.bar.x);
   expect(action.bounds.x + action.bounds.width).toBeLessThanOrEqual(navigationGeometry.bar.x + navigationGeometry.bar.width);
   expect(action.contents.length).toBeGreaterThanOrEqual(2);
   for (const content of action.contents) {
     expect(content.visible).toBe(true);
     expect(content.bounds.width).toBeGreaterThan(0);
     expect(content.bounds.height).toBeGreaterThan(0);
     expect(content.bounds.y).toBeGreaterThanOrEqual(action.bounds.y);
     expect(content.bounds.y + content.bounds.height).toBeLessThanOrEqual(action.bounds.y + action.bounds.height);
     expect(content.bounds.x).toBeGreaterThanOrEqual(action.bounds.x);
     expect(content.bounds.x + content.bounds.width).toBeLessThanOrEqual(action.bounds.x + action.bounds.width);
   }
 }
 const [backBounds, nextBounds] = navigationGeometry.actions.map(action => action.bounds);
 const gap = Math.max(nextBounds.x - backBounds.x - backBounds.width, nextBounds.y - backBounds.y - backBounds.height);
 expect(gap).toBeGreaterThanOrEqual(8);
 const scrollOffsets = await page.evaluate(() => Array.from(document.querySelectorAll('*'))
   .filter((element): element is HTMLElement => element instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1)
   .map(element => ({ testId: element.getAttribute('data-testid'), scrollTop: element.scrollTop, viewport: element.clientHeight, content: element.scrollHeight })));
 const afterScrollPath = $testInfo.outputPath('compact-setup-after-scroll.png');
 await page.screenshot({ path: afterScrollPath });
 await $testInfo.attach('compact-setup-after-scroll', { path: afterScrollPath, contentType: 'image/png' });
 await writeFile($testInfo.outputPath('scroll-offsets.json'), JSON.stringify({ viewport: page.viewportSize(), scrollOffsets, next: await next.boundingBox() }));
});
When('reduced motion is requested in compact setup', async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
Then('the compact schedule can expand and collapse', async ({ page }) => {
 const schedule = page.getByRole('button', { name: 'Match schedule', exact: true });
 await schedule.click();
 await expect(page.getByRole('button', { name: 'Match date', exact: true })).toBeVisible();
 await schedule.click();
 await expect(page.getByRole('button', { name: 'Match date', exact: true })).toHaveCount(0);
});

const longHome = 'The exceptionally long home club name from the local fixture';
const longAway = 'The exceptionally long away club name from the local fixture';
When('I select long custom team names in compact setup', async ({ page }) => {
 for (const [side, name] of [['Home', longHome], ['Away', longAway]]) {
   await page.getByRole('button', { name: `${side} Team`, exact: true }).click();
   await page.getByPlaceholder(`Search ${side.toLowerCase()}`, { exact: true }).fill(name);
   await page.getByText(`Add "${name}"`, { exact: true }).click();
   await expect(page.getByTestId(`Setup${side}TeamModal`)).toBeHidden();
 }
});
Then('the compact selected team names wrap without clipping', async ({ page, $testInfo }) => {
 for (const [side, name] of [['Home', longHome], ['Away', longAway]]) {
   const control = page.getByRole('button', { name: `${side} Team: ${name}`, exact: true });
   const text = control.getByText(name, { exact: true });
   await text.scrollIntoViewIfNeeded();
   await expect(text).toBeInViewport();
   expect(await text.evaluate((element) => element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1)).toBe(true);
   await expect(control.getByRole('button')).toHaveCount(0);
   await expect(page.getByRole('button', { name: `Clear ${side} Team`, exact: true })).toBeVisible();
 }
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 const screenshotPath = $testInfo.outputPath('long-team-names.png');
 await page.screenshot({ path: screenshotPath });
 await $testInfo.attach('long-team-names', { path: screenshotPath, contentType: 'image/png' });
});

Given('the compact History fixture has {int} games at {int} by {int}', async ({ page, $testInfo }, rows: number, width: number, height: number) => {
 await page.setViewportSize({ width, height });
 const state = buildPersistedBrowserStateFromSetupDataset(createSetupJourneyDataset());
 state.state.history = Array.from({ length: rows }, (_, index) => ({
   id: `layout-history-${index + 1}`, date: new Date(Date.UTC(2026, 9, 17) - index * 86400000).toISOString(),
   players: state.state.players.map(player => ({ ...player, drinksTaken: 1 })), matches: state.state.matches,
   playerAssignments: state.state.playerAssignments, commonMatchId: state.state.commonMatchId, matchesPerPlayer: 1,
 }));
 await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: PERSISTED_STORE_KEY, state });
 $testInfo.annotations.push({ type: 'uxHistoryRows', description: String(rows) });
 await page.goto('/history');
 await expect(page.getByTestId('HistoryGameItem-layout-history-1')).toBeVisible();
});
Then('the compact History last game and Back control are reachable', async ({ page, $testInfo }) => {
 const viewport = page.getByTestId('HistoryContentViewport');
 const scrollToBottom = () => viewport.evaluate((panel) => {
   const scrollers = [panel, ...panel.querySelectorAll('*')].filter((node): node is HTMLElement => node instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1);
   for (const node of scrollers) node.scrollTop = node.scrollHeight;
   return scrollers.map(node => ({ tag: node.tagName, scrollTop: node.scrollTop, height: node.clientHeight, contentHeight: node.scrollHeight }));
 });
 const rows = Number($testInfo.annotations.find(item => item.type === 'uxHistoryRows')?.description);
 const last = page.getByTestId(`HistoryGameItem-layout-history-${rows}`);
 await expect(async () => {
   await scrollToBottom();
   await expect(last).toBeInViewport({ timeout: 500 });
 }).toPass({ timeout: 15000, intervals: [100, 250, 500] });
 const metrics = await scrollToBottom();
 await expect(last).toBeInViewport();
 await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeInViewport();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 expect(metrics.length).toBeLessThanOrEqual(1);
 await writeFile($testInfo.outputPath('history-scroll.json'), JSON.stringify({ viewport: page.viewportSize(), metrics }));
 const screenshotPath = $testInfo.outputPath('history-last-row.png');
 await page.screenshot({ path: screenshotPath });
});
Given('the compact Friends fixture has {int} friends at {int} by {int}', async ({ page }, rows: number, width: number, height: number) => {
 await page.setViewportSize({ width, height });
 await mockHostRoomServices(page);
 await page.route('**/rest/v1/rpc/bootstrap_account', async (route) => {
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...buildHostRoomAccountRow(), username: 'Alice_Host' }) });
 });
 await page.route('**/rest/v1/rpc/list_social_relationships', async (route) => {
   const body = route.request().postDataJSON();
   const start = body.cursor ? 50 : 0;
   const items = body.kind === 'friends' ? Array.from({ length: Math.min(50, Math.max(0, rows - start)) }, (_, offset) => ({ account_id: `00000000-0000-4000-8000-${String(start + offset + 1).padStart(12, '0')}`, username: `fixture_friend_${String(start + offset + 1).padStart(3, '0')}`, relationship: 'friends', request_id: null })) : [];
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, next_cursor: rows > 50 && !body.cursor ? 'page-2' : null }) });
 });
 await seedHostRoomAuthSession(page);
 await page.goto('/friends');
 await expect(page.getByText('fixture_friend_001', { exact: true })).toBeVisible();
 if (rows > 50) await page.getByRole('button', { name: 'Load more', exact: true }).click();
 await expect(page.getByText(`fixture_friend_${String(rows).padStart(3, '0')}`, { exact: true })).toBeAttached();
});
Then('the compact Friends final comparison and Back control are reachable', async ({ page, $testInfo }) => {
 const last = page.getByRole('button', { name: /^You & fixture_friend_/ }).last();
 await last.scrollIntoViewIfNeeded();
 await expect(last).toBeInViewport();
 await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeInViewport();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 const owners = await last.evaluate(element => {
   const owners: string[] = [];
   let parent = element.parentElement;
   while (parent) { if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 1) owners.push(parent.getAttribute('data-testid') ?? parent.tagName); parent = parent.parentElement; }
   return owners;
 });
 expect(owners.length).toBeLessThanOrEqual(1);
 await writeFile($testInfo.outputPath('friends-scroll.json'), JSON.stringify({ viewport: page.viewportSize(), owners }));
 const screenshotPath = $testInfo.outputPath('friends-last-row.png');
 await page.screenshot({ path: screenshotPath });
});
