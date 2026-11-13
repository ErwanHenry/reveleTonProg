// WR-01 (revue 09.1), sans JavaScript (projet « sans-js ») : le mode « Gros caractères » est du CSS pur
// (main:has(> .lecteur > .niveaux #niv-aine:checked)), les cibles des liens de l'accueil doivent suivre sans script.
import { expect, test } from '@playwright/test';
import { premierePage } from './pages.ts';
import { policeLargeSansJs, verifierCibles } from './cibles-accueil.ts';

const accueil = premierePage((p) => p.url === '/', 'l’accueil').url;

test('accueil sans JavaScript : liens autonomes de main à 44 px, puis 48 px en « Gros caractères »', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await policeLargeSansJs(page);
  await page.goto(accueil);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-js-niveau'))).toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/Verdana/);
  await verifierCibles(page, 44);
  await page.locator('#niv-aine').check();
  await verifierCibles(page, 48);
});
