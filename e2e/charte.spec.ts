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

const NUIT = 'rgb(16, 28, 76)';
const COTES = ['Top', 'Right', 'Bottom', 'Left'] as const;

test.describe('charte 10.2 : cartes et pastilles', () => {
  test('toutes les cartes ont le même cadre, la même vignette et le même nom', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(THEME.url);
    const cartes = await page.evaluate((cotes) => {
      const sorte = (e: Element): string => (e.querySelector('.mesure') ? 'mesure' : e.querySelector('.vide') ? 'vide' : 'autre');
      return [...document.querySelectorAll('li.cellule')].map((li) => {
        const s = getComputedStyle(li);
        const p = getComputedStyle(li.querySelector('.picto')!);
        const n = getComputedStyle(li.querySelector('.cellule-nom')!);
        const couleurs = [li, ...li.querySelectorAll('*')].flatMap((e) => {
          const c = getComputedStyle(e);
          return [c.color, c.backgroundColor, c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor, c.textDecorationColor];
        });
        return {
          sorte: sorte(li),
          largeurs: cotes.map((c) => (s as unknown as Record<string, string>)[`border${c}Width`]),
          couleurs: cotes.map((c) => (s as unknown as Record<string, string>)[`border${c}Color`]),
          rayon: s.borderTopLeftRadius,
          picto: [p.backgroundColor, p.borderTopColor, p.borderTopWidth],
          nom: [n.fontFamily, n.fontSize, n.fontWeight, n.color],
          rouge: couleurs.includes('rgb(193, 18, 31)'),
        };
      });
    }, [...COTES]);
    expect(cartes.length).toBeGreaterThan(0);
    // Le corpus m1 n'a parfois que des cartes sans mesure sur ce thème : la comparaison vaut pour toutes les sortes présentes.
    console.log(`cartes : ${cartes.filter((c) => c.sorte === 'mesure').length} avec mesure, ${cartes.filter((c) => c.sorte === 'vide').length} sans programme`);
    const ref = cartes[0]!;
    for (const c of cartes) {
      expect(c.largeurs).toEqual(['2px', '2px', '2px', '2px']);
      expect(c.couleurs).toEqual([NUIT, NUIT, NUIT, NUIT]);
      expect(c.rayon).toBe('14px');
      expect(c.picto).toEqual(ref.picto);
      expect(c.nom).toEqual(ref.nom);
      expect(c.rouge, 'rouge dans une carte').toBe(false);
    }
    const vide = page.locator('li.cellule .vide').first();
    if ((await vide.count()) > 0) {
      const s = await vide.evaluate((e) => {
        const c = getComputedStyle(e);
        return { fond: c.backgroundColor, bord: c.borderTopWidth, taille: c.fontSize };
      });
      expect(s).toEqual({ fond: 'rgba(0, 0, 0, 0)', bord: '0px', taille: '18px' });
    }
  });

  test('le contrôle des cadres échoue si le filet de thème revient sur la carte', async ({ page }) => {
    await page.goto(THEME.url);
    await page.addStyleTag({ content: '.cellule { border-top: 4px solid var(--theme); }' });
    const haut = await page.locator('li.cellule').first().evaluate((e) => getComputedStyle(e).borderTopWidth);
    expect(haut).not.toBe('2px');
  });

  test('pastilles de niveau à 375 px : 44 px, deux colonnes, choisie pleine ; 48 px en Gros caractères', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(THEME.url);
    const mesurer = () =>
      page.locator('.niveau label').evaluateAll((ls) =>
        ls.map((l) => {
          const r = l.getBoundingClientRect();
          const s = getComputedStyle(l);
          return {
            h: r.height,
            left: Math.round(r.left),
            lignes: Math.round((r.height - 16) / parseFloat(s.lineHeight)),
            fond: s.backgroundColor,
            couleur: s.color,
          };
        }),
      );
    const m = await mesurer();
    expect(m).toHaveLength(4);
    for (const l of m) expect(l.h).toBeGreaterThanOrEqual(44);
    expect(new Set(m.map((l) => l.left)).size).toBe(2);
    await page.locator('#niv-aine').check();
    const a = await mesurer();
    for (const l of a) expect(l.h).toBeGreaterThanOrEqual(48);
    const choisie = a[3]!;
    expect(choisie.fond).toBe(NUIT);
    expect(choisie.couleur).toBe('rgb(255, 255, 255)');
    console.log(`pastilles sur deux lignes à 375 px : ${m.filter((l) => l.lignes >= 2).length} (normal), ${a.filter((l) => l.lignes >= 2).length} (Gros caractères)`);
  });
});
