// QUAL-02 : sans JavaScript (projet « sans-js », javaScriptEnabled: false), le visiteur change de niveau
// de lecture avec les radios natifs et seul le niveau choisi est visible.
// On coche le radio (jamais un clic sur le <label> : le radio le recouvre, voir niveaux.css).
import { expect, test } from '@playwright/test';
import { NIVEAUX, PAGES } from './pages.ts';

const AVEC_SELECTEUR = PAGES.filter((p) => p.aSelecteur);

test('le dist contient des pages avec sélecteur de niveau', () => {
  expect(AVEC_SELECTEUR.length).toBeGreaterThan(0);
});

test('au moins une page avec sélecteur affiche des rédactions', async ({ page }) => {
  let total = 0;
  for (const p of AVEC_SELECTEUR) {
    await page.goto(p.url);
    total += await page.locator('.redaction').count();
  }
  expect(total).toBeGreaterThan(0);
});

for (const p of PAGES) {
  test(`${p.url} : 200, un seul h1`, async ({ page }) => {
    const rep = await page.goto(p.url);
    expect(rep?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}

for (const p of AVEC_SELECTEUR) {
  test(`${p.url} : changement de niveau sans JS`, async ({ page }) => {
    await page.goto(p.url);
    await expect(page.locator('#niv-resume')).toBeChecked();
    if ((await page.locator('.redaction').count()) === 0) {
      // État vide (aucune mesure publiée sur cette page) : le sélecteur reste manipulable, rien à afficher.
      for (const niveau of NIVEAUX) {
        await page.locator(`#niv-${niveau}`).check();
        await expect(page.locator(`#niv-${niveau}`)).toBeChecked();
      }
      return;
    }

    const visibles = async (): Promise<string[]> =>
      page
        .locator('.redaction')
        .evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => e.getAttribute('data-niveau') ?? ''));

    // Niveau par défaut : résumé seul.
    let vus = await visibles();
    expect(vus.length).toBeGreaterThan(0);
    expect(new Set(vus)).toEqual(new Set(['resume']));

    for (const niveau of NIVEAUX) {
      await page.locator(`#niv-${niveau}`).check();
      vus = await visibles();
      expect(vus.length, `aucune rédaction visible au niveau ${niveau}`).toBeGreaterThan(0);
      expect(new Set(vus), `niveau ${niveau}`).toEqual(new Set([niveau]));
    }
  });
}
