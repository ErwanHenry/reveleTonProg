// Finitions visuelles 09.1, lot B, proposition 2 (audit B4) : le bloc source compact garde des cibles de 44 px
// (48 px en « Gros caractères », M1-09 verrouillé) pour chaque lien du document et chaque lien de signalement
// (variante 2b : et pour chaque résumé « Vérifier la source », replis ouverts pour mesurer les liens),
// et ne crée aucun défilement horizontal à 320 px avec le texte à 160 %. Les deux corpus.
// Police large imposée (Verdana, sinon DejaVu Sans), comme e2e/texte.spec.ts : les polices Linux de la CI sont plus
// larges que celles de macOS, et c'est la CI qui fait référence pour les retours à la ligne.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { premierePage } from './pages.ts';

const theme = premierePage((p) => p.estTheme && readFileSync(p.fichier, 'utf8').includes('class="mesure"'), 'une page thème avec une mesure');
const POLICE_LARGE = '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }';

/**
 * Hauteur de chaque cible affichée d'un bloc source (mesures et sources consultées) : résumés « Vérifier la source »
 * de la variante 2b (touche C5), puis, replis ouverts, chaque lien.
 */
async function hauteursLiens(page: Page): Promise<{ texte: string; h: number }[]> {
  const resumes = await page.locator('.source details.source-details > summary').count();
  if (resumes > 0) await page.locator('.source details.source-details > summary').first().click();
  return page.evaluate(() =>
    [
      ...[...document.querySelectorAll<HTMLElement>('.source details.source-details > summary')],
      ...(() => {
        for (const d of document.querySelectorAll('.source details.source-details')) d.setAttribute('open', '');
        return [...document.querySelectorAll<HTMLAnchorElement>('.source a')];
      })(),
    ]
      .map((a) => ({ texte: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60), h: a.getBoundingClientRect().height }))
      .filter((x) => x.h > 0),
  );
}

test.describe('source 09.1 : bloc source compact, cibles et reflow', () => {
  test('375 x 812 : chaque lien du bloc source mesure au moins 44 px de haut', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(theme.url);
    await page.addStyleTag({ content: POLICE_LARGE });
    const liens = await hauteursLiens(page);
    expect(liens.length, 'aucun lien de bloc source affiché').toBeGreaterThan(0);
    const petits = liens.filter((l) => l.h < 44);
    expect(petits, petits.map((l) => `${l.h} px : ${l.texte}`).join('\n')).toEqual([]);
  });

  test('« Gros caractères » à 375 px : chaque lien du bloc source mesure au moins 48 px de haut', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(theme.url);
    await page.addStyleTag({ content: POLICE_LARGE });
    await page.locator('#niv-aine').check();
    await expect(page.locator('#niv-aine')).toBeChecked();
    const liens = await hauteursLiens(page);
    expect(liens.length).toBeGreaterThan(0);
    const petits = liens.filter((l) => l.h < 48);
    expect(petits, petits.map((l) => `${l.h} px : ${l.texte}`).join('\n')).toEqual([]);
  });

  test('320 px et texte à 160 % : aucun défilement horizontal, aucun lien du bloc source hors de l’écran', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(theme.url);
    await page.addStyleTag({ content: 'html { font-size: 160% !important }' });
    await page.addStyleTag({ content: POLICE_LARGE });
    const r = await page.evaluate(() => ({
      large: document.documentElement.scrollWidth,
      vue: document.documentElement.clientWidth,
      dehors: [...document.querySelectorAll('.source a')]
        .map((a) => a.getBoundingClientRect())
        .filter((b) => b.height > 0 && b.right > document.documentElement.clientWidth + 0.5).length,
    }));
    expect(r.large, `défilement horizontal : ${r.large} > ${r.vue}`).toBeLessThanOrEqual(r.vue);
    expect(r.dehors).toBe(0);
  });

  test('variante 2b : « Vérifier la source » s’ouvre au clavier, les liens du document apparaissent', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(theme.url);
    const resume = page.locator('.mesure .source details.source-details > summary').first();
    await expect(resume).toHaveText('Vérifier la source');
    const lien = page.locator('.mesure .source details.source-details').first().locator('a').first();
    await expect(lien).toBeHidden();
    await resume.focus();
    await page.keyboard.press('Enter');
    await expect(lien).toBeVisible();
    // Titre et date jamais repliés
    const titre = page.locator('.mesure .source > p').first();
    await expect(titre).toBeVisible();
    await expect(titre).toContainText('Source primaire : ');
  });
});
