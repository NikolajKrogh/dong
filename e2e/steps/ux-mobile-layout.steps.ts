import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { buildPersistedBrowserStateFromSetupDataset, createSetupJourneyDataset, mockConfigureStartGameServices, PERSISTED_STORE_KEY } from './browser-flow.helpers';
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
