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
    // Aucune initiale ne déborde de sa vignette, au niveau par défaut puis en Gros caractères.
    const debords = () => page.evaluate(() => [...document.querySelectorAll('.picto')].filter((e) => e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight).length);
    expect(await debords(), 'initiales qui débordent (niveau par défaut)').toBe(0);
    await page.locator('#niv-aine').check();
    expect(await debords(), 'initiales qui débordent (Gros caractères)').toBe(0);
    expect(await page.locator('.picto').first().evaluate((e) => getComputedStyle(e).width)).toBe('64px');
    await page.locator('#niv-resume').check();
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

// Recensement transversal (10.4-UI-SPEC.md §4.3) : le rouge n'existe qu'aux emplois de la liste fermée R-1 à R-8, sans capitale
// forcée, sans dégradé (la vignette .picto est un aplat à initiales, sans dessin), sans ombre hors focus, sur un exemplaire de chaque type de page, à deux largeurs.
const TYPES_DE_PAGES: { nom: string; url: string }[] = [
  ['accueil', (p: { url: string }) => p.url === '/'],
  ['liste des thèmes', (p: { url: string }) => p.url === '/themes/'],
  ['page thème', (p: { url: string }) => /^\/themes\/[^/]+\/$/.test(p.url)],
  ['liste des candidats', (p: { url: string }) => p.url === '/candidats/'],
  ['page candidat', (p: { url: string }) => /^\/candidats\/[^/]+\/$/.test(p.url)],
  ['Méthode', (p: { url: string }) => p.url === '/methode/'],
  ['Mentions légales', (p: { url: string }) => p.url === '/mentions-legales/'],
  ['Qui sommes-nous', (p: { url: string }) => p.url === '/qui-sommes-nous/'],
].flatMap(([nom, pred]) => {
  const p = PAGES.find(pred as (p: { url: string }) => boolean);
  return p ? [{ nom: nom as string, url: p.url }] : [];
});
// La 404 n'est pas un index.html : le serveur la sert pour tout chemin inconnu (comme Caddy).
TYPES_DE_PAGES.push({ nom: '404', url: '/chemin-inexistant-charte/' });

interface Releve {
  rouges: string[];
  interdits: string[];
}

async function releverCharte(page: Page): Promise<Releve> {
  return page.evaluate(() => {
    const ROUGE_ = 'rgb(193, 18, 31)';
    const rouges: string[] = [];
    const interdits: string[] = [];
    const nom = (e: Element, pseudo: string): string => {
      const h2 = e.tagName === 'H2' && e.closest('main') !== null && !e.classList.contains('section-titre');
      if (pseudo === '::after' && h2) return 'R-1 h2::after';
      if (e.classList.contains('site-sous-titre')) return 'R-2 .site-sous-titre';
      if (e.closest('.hall-candidats, .hall-methode') && e.tagName === 'A') return 'R-3 lien d\'accueil';
      if (e.classList.contains('hall-surtitre')) return 'R-5 .hall-surtitre';
      if (e.classList.contains('hall-annee')) return 'R-6 .hall-annee';
      if (e.classList.contains('garantie-titre')) return 'R-7 .garantie-titre';
      if (e.classList.contains('tuile-num') && e.closest('li.tuile') !== null) return 'R-4 .tuile-num';
      if (e.classList.contains('logo')) return 'R-8 .logo';
      return `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}${pseudo}`;
    };
    const examiner = (e: Element, pseudo: string): void => {
      const cs = getComputedStyle(e, pseudo || null);
      if (pseudo !== '' && (cs.content === 'none' || cs.content === 'normal')) return;
      if (pseudo === '' && e.getClientRects().length === 0) return;
      if (cs.display === 'none') return;
      const id = nom(e, pseudo);
      const rouge = (prop: string, v: string): void => {
        if (v === ROUGE_) rouges.push(`${prop}|${id}`);
      };
      rouge('color', cs.color);
      rouge('backgroundColor', cs.backgroundColor);
      for (const c of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs.getPropertyValue(`border-${c.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${c.toLowerCase()}-style`) !== 'none')
          rouge(`border${c}Color`, cs.getPropertyValue(`border-${c.toLowerCase()}-color`));
      }
      if (cs.outlineStyle !== 'none') rouge('outlineColor', cs.outlineColor);
      if (cs.textDecorationLine !== 'none') rouge('textDecorationColor', cs.textDecorationColor);
      if (cs.textTransform === 'uppercase') interdits.push(`uppercase|${id}`);
      if (/small-caps/.test(cs.fontVariantCaps)) interdits.push(`${cs.fontVariantCaps}|${id}`);
      if (parseFloat(cs.letterSpacing) > 0) interdits.push(`letterSpacing ${cs.letterSpacing}|${id}`);
      if (/linear-gradient|conic-gradient/.test(cs.backgroundImage)) interdits.push(`gradient|${id}`);
      if (cs.boxShadow !== 'none') interdits.push(`boxShadow ${cs.boxShadow}|${id}`);
    };
    for (const e of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE'].includes(e.tagName)) continue;
      examiner(e, '');
      examiner(e, '::before');
      examiner(e, '::after');
    }
    return { rouges: [...new Set(rouges)].sort(), interdits: [...new Set(interdits)].sort() };
  });
}

const AUTORISES = [
  'backgroundColor|R-1 h2::after',
  'borderLeftColor|R-2 .site-sous-titre',
  "textDecorationColor|R-3 lien d'accueil",
  'borderLeftColor|R-5 .hall-surtitre',
  'borderLeftColor|R-6 .hall-annee',
  'borderBottomColor|R-7 .garantie-titre',
  'color|R-4 .tuile-num',
  'borderBottomColor|R-8 .logo',
];

test.describe('charte 10.2 : recensement sur toutes les pages', () => {
  for (const taille of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    for (const p of TYPES_DE_PAGES) {
      test(`${p.nom} à ${taille.width} x ${taille.height} : rouge en liste fermée, aucun interdit`, async ({ page }) => {
        await page.setViewportSize(taille);
        await page.goto(p.url);
        const r = await releverCharte(page);
        for (const rouge of r.rouges) expect(AUTORISES, `rouge hors liste fermée : ${rouge}`).toContain(rouge);
        expect(r.interdits, 'capitale forcée, espacement positif, dégradé ou ombre hors focus').toEqual([]);
      });
    }
  }

  test('le survol d\'un lien R-3 garde la priorité : 3px survolé, 2px au repos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const lien = page.locator('.hall-methode a').first();
    await expect(lien).toBeVisible();
    await page.mouse.move(0, 0);
    expect(await lien.evaluate((e) => getComputedStyle(e).textDecorationThickness)).toBe('2px');
    await lien.hover();
    expect(await lien.evaluate((e) => getComputedStyle(e).textDecorationThickness)).toBe('3px');
  });
});

test.describe('charte 10.4 : bloc 2027', () => {
  const accueilUrl = premierePage((p) => p.url === '/', 'l’accueil').url;

  test('à 1280 x 900 : décoratif, à droite du titre, sur la même rangée', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(accueilUrl);
    const annee = page.locator('.hall-annee');
    await expect(annee).toBeVisible();
    await expect(annee).toHaveAttribute('aria-hidden', 'true');
    const h1 = (await page.locator('main h1').boundingBox())!;
    const a = (await annee.boundingBox())!;
    expect(a.x, 'bord gauche du bloc à droite du bord droit du h1').toBeGreaterThanOrEqual(h1.x + h1.width);
    const recouvre = a.y < h1.y + h1.height && h1.y < a.y + a.height;
    expect(recouvre, 'même rangée de grille').toBe(true);
  });

  test('à 375 x 812 : display none', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueilUrl);
    expect(await page.locator('.hall-annee').evaluate((e) => getComputedStyle(e).display)).toBe('none');
  });
});

/** Valeur d'un jeton de couleur de base.css, en rgb(...) comme le rend le navigateur. */
function jetonRgb(nom: string): string {
  const css = readFileSync('src/styles/base.css', 'utf8');
  const m = new RegExp(`${nom}:\\s*#([0-9A-Fa-f]{6})`).exec(css);
  if (m === null) throw new Error(`jeton ${nom} introuvable dans base.css`);
  const h = m[1] as string;
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

test.describe('charte 10.4 : tuiles à venir', () => {
  const accueilUrl = premierePage((p) => p.url === '/', 'l’accueil').url;
  for (const taille of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 },
  ]) {
    test(`tuiles à venir : pleines, sans lien, numéro gris, sans débordement à ${taille.width} x ${taille.height}`, async ({ page }) => {
      await page.setViewportSize(taille);
      await page.goto(accueilUrl);
      const panneau = jetonRgb('--panneau');
      const rouge = jetonRgb('--rouge');
      const tuiles = page.locator('ul.tuiles > li');
      const debordent = await tuiles.evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).length);
      expect(debordent, 'tuile qui déborde horizontalement').toBe(0);
      const venir = page.locator('li.tuile-avenir');
      const n = await venir.count();
      console.log(`tuiles à venir : ${n}`);
      if (n === 0) return;
      for (let i = 0; i < n; i++) {
        const li = venir.nth(i);
        const r = await li.evaluate((e) => {
          const cs = getComputedStyle(e);
          const num = getComputedStyle(e.querySelector('.tuile-num')!);
          return { style: cs.borderTopStyle, fond: cs.backgroundColor, numero: num.color, liens: e.querySelectorAll('a').length };
        });
        expect(r.style).toBe('solid');
        expect(r.fond).toBe(panneau);
        expect(r.numero).not.toBe(rouge);
        expect(r.liens).toBe(0);
      }
    });
  }
});

test.describe('charte 10.4 : logo', () => {
  const accueilUrl = premierePage((p) => p.url === '/', 'l’accueil').url;
  for (const taille of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 },
  ]) {
    test(`logo : lettre dans un carré bleu nuit à filet rouge bas, hors du nom accessible à ${taille.width} x ${taille.height}`, async ({ page }) => {
      await page.setViewportSize(taille);
      await page.goto(accueilUrl);
      const logo = page.locator('.entete .logo');
      await expect(logo).toHaveCount(1);
      const r = await logo.evaluate((e) => {
        const cs = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        return {
          l: b.width, h: b.height, fond: cs.backgroundColor, texte: cs.color, bas: cs.borderBottomColor,
          autres: [cs.borderTopWidth, cs.borderLeftWidth, cs.borderRightWidth],
        };
      });
      expect(r.l).toBe(36);
      expect(r.h).toBe(36);
      expect(r.fond).toBe(jetonRgb('--nuit'));
      expect(r.texte).toBe(jetonRgb('--carte'));
      expect(r.bas).toBe(jetonRgb('--rouge'));
      expect(r.autres).toEqual(['0px', '0px', '0px']);
      const nomSite = await page.locator('meta[property="og:site_name"]').getAttribute('content');
      await expect(page.locator('.entete').getByRole('link', { name: nomSite!, exact: true })).toHaveCount(1);
    });
  }
});
