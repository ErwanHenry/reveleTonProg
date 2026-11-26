// Charte 10.2 (UI-SPEC §4.3 R-1) : le filet rouge sous un h2 de contenu occupe de 4 à 8 px sous le bas du titre et ne
// recouvre jamais l'élément suivant, y compris « Ce qui me concerne » en Gros caractères quand le titre passe sur deux
// lignes. Le filet n'existe ni sous le h1 ni sous un h2 de section de la page candidat.
import { expect, test, type Page } from '@playwright/test';
import { PAGES, premierePage } from './pages.ts';
import { readFileSync } from 'node:fs';
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

const BLANC = 'rgb(255, 255, 255)';
const ROUGE = 'rgb(193, 18, 31)';

test.describe('charte 10.2 : contenu sourcé et pied', () => {
  test('bloc source, relecture et titre de mesure', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(THEME.url);
    const r = await page.evaluate(() => {
      const vis = (e: Element): boolean => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      };
      const src = [...document.querySelectorAll('.source')].find(vis);
      const cs = src ? getComputedStyle(src) : null;
      return {
        source: cs && {
          fond: cs.backgroundColor, largeur: cs.borderLeftWidth, couleur: cs.borderLeftColor, rayon: cs.borderTopLeftRadius,
        },
        liens: [...document.querySelectorAll('.source a')].filter(vis).map((a) => {
          const c = getComputedStyle(a);
          return { couleur: c.color, graisse: Number(c.fontWeight), trait: c.textDecorationLine, haut: a.getBoundingClientRect().height };
        }),
        relectures: [...document.querySelectorAll('.relecture')].filter(vis).map((e) => {
          const c = getComputedStyle(e);
          return { couleur: c.color, graisse: Number(c.fontWeight) };
        }),
        titres: [...document.querySelectorAll('.mesure-titre')].filter(vis).map((e) => {
          const c = getComputedStyle(e);
          return { taille: c.fontSize, couleur: c.color, police: c.fontFamily };
        }),
      };
    });
    expect(r.source, 'aucun bloc source visible').not.toBeNull();
    expect(r.source).toEqual({ fond: 'rgb(243, 245, 252)', largeur: '4px', couleur: NUIT, rayon: '10px' });
    expect(r.liens.length, 'aucun lien de source').toBeGreaterThan(0);
    for (const l of r.liens) {
      expect(l.couleur).toBe('rgb(22, 48, 143)');
      expect(l.graisse).toBeGreaterThanOrEqual(600);
      expect(l.trait).toContain('underline');
      expect(l.haut).toBeGreaterThanOrEqual(44);
    }
    for (const l of r.relectures) {
      expect(l.couleur).toBe('rgb(22, 26, 43)');
      expect(l.graisse).toBeGreaterThanOrEqual(600);
    }
    for (const t of r.titres) {
      expect(t.taille).toBe('18px');
      expect(t.couleur).toBe(NUIT);
      expect(t.police).not.toMatch(/Georgia|Palatino|Iowan/);
    }
  });

  for (const url of ['/', THEME.url]) {
    test(`pied bleu nuit lisible et focus visible : ${url}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url);
      expect(await page.locator('.pied').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(NUIT);
      const textes = await page.locator('.pied').evaluate((pied) => {
        const sortie: { texte: string; taille: number; couleur: string }[] = [];
        const w = document.createTreeWalker(pied, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const el = n.parentElement!;
          if ((n.textContent ?? '').trim() === '') continue;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          const c = getComputedStyle(el);
          sortie.push({ texte: (n.textContent ?? '').trim().slice(0, 30), taille: parseFloat(c.fontSize), couleur: c.color });
        }
        return sortie;
      });
      expect(textes.length).toBeGreaterThan(0);
      for (const t of textes) {
        expect(t.taille, t.texte).toBeGreaterThanOrEqual(16);
        expect(t.couleur, t.texte).toBe(BLANC);
      }
      await page.keyboard.press('Tab');
      const lien = page.locator('.pied a').first();
      await lien.focus();
      const o = await lien.evaluate((e) => ({ c: getComputedStyle(e).outlineColor, w: getComputedStyle(e).outlineWidth }));
      expect(o).toEqual({ c: BLANC, w: '3px' });
    });
  }

  test('le test du focus du pied échoue sans la règle (contrôle)', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: '.pied :focus-visible { outline-color: rgb(22, 26, 43) !important; }' });
    await page.keyboard.press('Tab');
    const lien = page.locator('.pied a').first();
    await lien.focus();
    expect(await lien.evaluate((e) => getComputedStyle(e).outlineColor)).not.toBe(BLANC);
  });

  test('statut du candidat : filet bleu nuit, jamais rouge', async ({ page }) => {
    const cand = PAGES.find((p) => /^\/candidats\/[^/]+\/$/.test(p.url) && readFileSync(p.fichier, 'utf8').includes('class="statut'));
    expect(cand, 'aucune page candidat avec statut').toBeDefined();
    await page.goto(cand!.url);
    const r = await page.locator('.statut').first().evaluate((e, rouge) => ({
      gauche: getComputedStyle(e).borderLeftColor,
      haut: getComputedStyle(e).borderTopWidth,
      rouge: [e, ...e.querySelectorAll('*')].some((x) => {
        const c = getComputedStyle(x);
        return [c.color, c.backgroundColor, c.borderTopColor, c.borderLeftColor].includes(rouge);
      }),
    }), ROUGE);
    expect(r.gauche).toBe(NUIT);
    expect(r.haut).toBe('0px');
    expect(r.rouge).toBe(false);
  });
});
