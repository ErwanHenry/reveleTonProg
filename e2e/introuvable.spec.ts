// Page 404 (FIN-01, plan 09.1-02) : une adresse inconnue reçoit le code 404 et la page « Page introuvable » du dist,
// comme le bloc Caddy public. e2e/pages.ts ne liste que les index.html : axe et reflow sont donc vérifiés ici.
import { existsSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const DIST = path.resolve(process.env.E2E_DIST ?? 'dist-e2e/reel');

async function ouvrir(page: Page, chemin: string): Promise<void> {
  const r = await page.goto(chemin);
  expect(r?.status(), chemin).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page introuvable');
}

test.describe('introuvable 404', () => {
  test('/nexistepas/ : code 404, page en français, lien vers l\'accueil, noindex, sans URL canonique', async ({ page }) => {
    await ouvrir(page, '/nexistepas/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('main a[href="/"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('axe AA : aucune violation grave', async ({ page }) => {
    await ouvrir(page, '/nexistepas/');
    const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const graves = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const message = graves.map((v) => `${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`).join('\n');
    expect(graves, message).toEqual([]);
  });

  test('320 px et texte à 160 % : aucun défilement horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await ouvrir(page, '/nexistepas/');
    await page.addStyleTag({ content: 'html { font-size: 160% !important }' });
    // Même police large qu'e2e/texte.spec.ts à 320 px (polices Linux de la CI plus larges que celles de macOS).
    await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }' });
    const largeurs = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(largeurs[0], `défilement horizontal : ${largeurs[0]} > ${largeurs[1]}`).toBeLessThanOrEqual(largeurs[1] as number);
  });

  // Filtre de production du plan 09-15 : une personne non relue n'a pas de dossier, son adresse donne cette page.
  const fixtureProduction =
    existsSync(path.join(DIST, 'candidats', 'elise-erard')) && !existsSync(path.join(DIST, 'candidats', 'paul-de-villefranche'));
  test('personne écartée par le filtre de production : même page 404', async ({ page }) => {
    test.skip(!fixtureProduction, 'seule la fixture m1 de production écarte paul-de-villefranche (plan 09-15)');
    await ouvrir(page, '/candidats/paul-de-villefranche/');
  });
});
