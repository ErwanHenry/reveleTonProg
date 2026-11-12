// Finitions visuelles 09.1, lot B, proposition 3 (audit B5) : « Aller à un candidat (N) » en tête de la page d'un
// thème. Cibles de 44 px (48 px en « Gros caractères », M1-09) et saut vers la carte, avec et sans JavaScript.
// Les deux corpus ; police large imposée comme e2e/texte.spec.ts (polices Linux de la CI plus larges).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { premierePage } from './pages.ts';

const theme = premierePage((p) => p.estTheme && readFileSync(p.fichier, 'utf8').includes('class="acces-candidats"'), 'une page thème avec la liste');
const POLICE_LARGE = '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }';

async function cibles(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('details.acces-candidats summary, details.acces-candidats a')].map((e) => e.getBoundingClientRect().height),
  );
}

async function sauter(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(theme.url);
  await page.locator('details.acces-candidats > summary').click();
  const lien = page.locator('details.acces-candidats a').last();
  const href = await lien.getAttribute('href');
  await lien.click();
  expect(new URL(page.url()).hash).toBe(href);
  const haut = await page.evaluate((id) => document.getElementById(id.slice(1))?.getBoundingClientRect().top ?? null, href ?? '');
  expect(haut).not.toBeNull();
  // Carte dans l'écran (la dernière ne peut pas toujours monter tout en haut d'une page courte)
  expect(haut!).toBeGreaterThanOrEqual(-1);
  expect(haut!).toBeLessThan(812);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test.describe('acces candidats 09.1 : liste en tête de la page d’un thème', () => {
  test('375 px : résumé et liens de 44 px au moins, 48 px en « Gros caractères »', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(theme.url);
    await page.addStyleTag({ content: POLICE_LARGE });
    await page.locator('details.acces-candidats > summary').click();
    const normal = await cibles(page);
    expect(normal.length).toBeGreaterThan(1);
    expect(Math.min(...normal)).toBeGreaterThanOrEqual(44);
    await page.locator('#niv-aine').check();
    const gros = await cibles(page);
    expect(Math.min(...gros)).toBeGreaterThanOrEqual(48);
  });

  test('un lien mène à la carte du candidat', async ({ page }) => {
    await sauter(page);
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('le repli s’ouvre et le lien mène à la carte', async ({ page }) => {
      await sauter(page);
    });
  });
});
