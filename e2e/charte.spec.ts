// Charte 10.2 (UI-SPEC §4.3 R-1) : le filet rouge sous un h2 de contenu occupe de 4 à 8 px sous le bas du titre et ne
// recouvre jamais l'élément suivant, y compris « Ce qui me concerne » en Gros caractères quand le titre passe sur deux
// lignes. Le filet n'existe ni sous le h1 ni sous un h2 de section de la page candidat.
import { expect, test, type Page } from '@playwright/test';
import { PAGES, premierePage } from './pages.ts';
import { THEME } from './chemin.ts';

const PAGES_TEXTE = ['/', '/methode/', '/mentions-legales/', '/qui-sommes-nous/'].map((url) =>
  premierePage((p) => p.url === url, `la page ${url}`),
);

/** Pour chaque h2 visible de main hors section-titre : écart entre son bas et le haut de l'élément affiché suivant. */
async function ecarts(page: Page): Promise<{ titre: string; ecart: number | null }[]> {
  return page.evaluate(() => {
    const visible = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden';
    };
    const tous = [...document.querySelectorAll('main *')];
    return [...document.querySelectorAll('main h2:not(.section-titre)')]
      .filter(visible)
      .map((h) => {
        const bas = h.getBoundingClientRect().bottom;
        let suivant: Element | null = h.nextElementSibling;
        while (suivant !== null && !visible(suivant)) suivant = suivant.nextElementSibling;
        if (suivant === null) {
          const i = tous.indexOf(h);
          suivant = tous.slice(i + 1).find((e) => !h.contains(e) && visible(e) && e.getBoundingClientRect().top >= bas - 1) ?? null;
        }
        return { titre: (h.textContent ?? '').trim(), ecart: suivant === null ? null : suivant.getBoundingClientRect().top - bas };
      });
  });
}

async function verifierFilet(page: Page): Promise<void> {
  const mesures = await ecarts(page);
  expect(mesures.length, 'aucun h2 de contenu visible').toBeGreaterThan(0);
  for (const m of mesures) {
    if (m.ecart !== null) expect(m.ecart, `« ${m.titre} » : le filet recouvre l'élément suivant`).toBeGreaterThanOrEqual(8);
  }
  const couleur = await page.evaluate(() => getComputedStyle(document.querySelector('main h2:not(.section-titre)')!, '::after').backgroundColor);
  expect(couleur).toBe('rgb(193, 18, 31)');
  const h1 = await page.evaluate(() => getComputedStyle(document.querySelector('main h1')!, '::after').content);
  expect(['none', 'normal']).toContain(h1);
}

test.describe('charte 10.2 : filet rouge des h2', () => {
  for (const taille of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    for (const p of PAGES_TEXTE) {
      test(`${p.url} à ${taille.width} x ${taille.height} : filet sans recouvrement`, async ({ page }) => {
        await page.setViewportSize(taille);
        await page.goto(p.url);
        await verifierFilet(page);
      });
    }
  }

  for (const largeur of [375, 320]) {
    test(`page thème en Gros caractères à ${largeur} x 812 : « Ce qui me concerne » sans recouvrement`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 812 });
      await page.goto(THEME.url);
      await page.locator('#niv-aine').check();
      const titre = page.locator('#concerne-titre');
      await expect(titre).toBeVisible();
      const lignes = await titre.evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
      console.log(`« Ce qui me concerne » en Gros caractères à ${largeur} px : ${Math.round(lignes)} ligne(s)`);
      await verifierFilet(page);
    });
  }

  test('un h2 de section de la page candidat n\'a pas de filet', async ({ page }) => {
    const cand = PAGES.find((p) => /^\/candidats\/[^/]+\/$/.test(p.url));
    test.skip(cand === undefined, 'aucune page candidat');
    await page.goto(cand!.url);
    const contenus = await page.evaluate(() =>
      [...document.querySelectorAll('main h2.section-titre')].map((h) => getComputedStyle(h, '::after').content),
    );
    for (const c of contenus) expect(['none', 'normal']).toContain(c);
  });
});
