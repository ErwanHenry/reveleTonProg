// Finitions visuelles 09.1 (lot A) : preuve dans un vrai navigateur de la césure, du mot long sans débordement,
// de la barre du thème et du bloc de statut. Le survol collant au toucher n'est pas reproductible par l'émulation
// Chromium (le tap sur le même code d'avant le correctif passe) : il reste prouvé par les tests statiques et dist. Aucun identifiant de page en dur (PAGES).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { NIVEAUX, PAGES } from './pages.ts';

const lire = (fichier: string): string => readFileSync(fichier, 'utf8');
const pageTheme = PAGES.find((p) => p.estTheme && lire(p.fichier).includes('class="mesure"') && lire(p.fichier).includes('class="terme"'));
const pageCandidat = PAGES.find((p) => /^\/candidats\/[^/]+\/$/.test(p.url) && lire(p.fichier).includes('class="statut'));
const pageAvecSelecteur = PAGES.find((p) => p.aSelecteur && lire(p.fichier).includes('class="mesure"'));

// 60 lettres sans aucune possibilité de coupure
const MOT_LONG = 'Anticonstitutionnellement'.repeat(3).slice(0, 60);

async function mesureVisible(page: Page, selecteur: string): Promise<string> {
  const ok = await page.evaluate((s) => {
    const el = [...document.querySelectorAll<HTMLElement>(s)].find((e) => e.getClientRects().length > 0);
    return el !== undefined;
  }, selecteur);
  expect(ok, `aucun ${selecteur} visible`).toBe(true);
  return selecteur;
}

test.describe('finitions 09.1 : preuve navigateur', () => {
  test('barre de thème alignée sur le fil d\'Ariane, césure sur les titres seulement', async ({ page }) => {
    expect(pageTheme, 'aucune page thème avec mesure et terme').toBeDefined();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pageTheme!.url);
    const m = await page.evaluate(() => {
      const css = (s: string) => getComputedStyle(document.querySelector(s)!);
      const gauche = (s: string) => document.querySelector(s)!.getBoundingClientRect().left;
      const redaction = [...document.querySelectorAll<HTMLElement>('.redaction p')].find((e) => e.getClientRects().length > 0)!;
      return {
        barre: css('.theme-entete').borderTopWidth,
        barreMain: css('main').borderTopWidth,
        ecart: Math.abs(gauche('.theme-entete') - gauche('nav.fil')),
        redaction: getComputedStyle(redaction).hyphens,
        titre: css('.mesure-titre').hyphens,
        nom: css('.cellule-nom').hyphens,
      };
    });
    expect(m.barre).toBe('8px');
    expect(m.barreMain).toBe('0px');
    expect(m.ecart).toBeLessThanOrEqual(1);
    expect(m.redaction).toBe('manual');
    expect(m.titre).toBe('auto');
    expect(m.nom).toBe('auto');
    await page.locator('#niv-enfant').check();
    const def = await page.evaluate(() => {
      const d = document.querySelector('.definition');
      return d === null ? null : getComputedStyle(d).hyphens;
    });
    expect(def).toBe('manual');
  });

  test('bloc de statut du candidat aussi large que le contenu', async ({ page }) => {
    expect(pageCandidat, 'aucune page candidat avec statut').toBeDefined();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pageCandidat!.url);
    const m = await page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('.statut')!;
      const p = s.parentElement!;
      const cs = getComputedStyle(p);
      const contenu = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { statut: s.getBoundingClientRect().width, contenu };
    });
    expect(Math.abs(m.statut - m.contenu)).toBeLessThanOrEqual(1);
  });

  // Page candidat et page thème : la carte n'est pas dans le même gabarit (liste de cellules ou liste de mesures)
  const pagesMotLong = [...new Set([pageAvecSelecteur, pageTheme])].filter((p) => p !== undefined);
  for (const texte160 of [false, true]) {
    for (const niveau of NIVEAUX) for (const cible of pagesMotLong) {
      test(`mot de 60 lettres sans débordement à 320 px${texte160 ? ' + texte 160 %' : ''}, niveau ${niveau}, ${cible.url}`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto(cible.url);
        if (texte160) await page.addStyleTag({ content: 'html { font-size: 160% !important }' });
        await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }' });
        await page.locator(`#niv-${niveau}`).check();
        await mesureVisible(page, '.redaction p');
        await page.evaluate((mot) => {
          const p = [...document.querySelectorAll<HTMLElement>('.redaction p')].find((e) => e.getClientRects().length > 0)!;
          p.append(` ${mot}`);
        }, MOT_LONG);
        const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(debord, 'défilement horizontal du document').toBeLessThanOrEqual(0);
      });
    }

    test(`définition (popover) avec un mot de 60 lettres à 320 px${texte160 ? ' + texte 160 %' : ''}`, async ({ page }) => {
      test.skip(pageTheme === undefined, 'aucune page avec terme');
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(pageTheme!.url);
      if (texte160) await page.addStyleTag({ content: 'html { font-size: 160% !important }' });
      await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }' });
      await page.locator('#niv-enfant').check();
      const terme = page.locator('.terme:visible').first();
      await terme.click();
      const ouvert = await page.evaluate((mot) => {
        const d = document.querySelector<HTMLElement>('.definition:popover-open');
        if (d === null) return false;
        d.append(` ${mot}`);
        return true;
      }, MOT_LONG);
      expect(ouvert, 'popover non ouvert').toBe(true);
      const m = await page.evaluate(() => {
        const d = document.querySelector<HTMLElement>('.definition:popover-open')!;
        return { popover: d.scrollWidth - d.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(m.popover, 'défilement horizontal du popover').toBeLessThanOrEqual(0);
      expect(m.doc, 'défilement horizontal du document').toBeLessThanOrEqual(0);
    });
  }
});

// Page candidat sans aucune mesure : le sélecteur de niveau y reste (M1-09 : « Gros caractères » agrandit le bloc de statut
// et les états vides, et le niveau mémorisé y est appliqué). Sans lui, main:has(> .lecteur > .niveaux #niv-aine:checked)
// ne s'applique plus et niveau.js sort aussitôt. Aucun identifiant en dur : la première page candidat sans mesure, avec statut.
const reel = (process.env.E2E_DIST ?? 'dist-e2e/reel').includes('reel');
const candidatsSansMesure = PAGES.filter((p) => /^\/candidats\/[^/]+\/$/.test(p.url) && !lire(p.fichier).includes('class="mesure"') && lire(p.fichier).includes('class="statut'));
const candidatSansMesure = candidatsSansMesure.find((p) => lire(p.fichier).includes('class="vide"')) ?? candidatsSansMesure[0];

async function taille(page: Page, selecteur: string): Promise<number | null> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el === null ? null : parseFloat(getComputedStyle(el).fontSize);
  }, selecteur);
}

test.describe('finitions 09.1 : page candidat sans mesure', () => {
  test('le corpus compte une page candidat sans mesure', () => {
    if (reel) expect(candidatSansMesure, 'le vrai corpus doit compter au moins un candidat sans mesure').toBeDefined();
    else test.skip(candidatSansMesure === undefined, 'fixture sans page candidat sans mesure');
  });

  test('« Gros caractères » agrandit le bloc de statut (20 px) et l\'état vide (22 px)', async ({ page }) => {
    test.skip(candidatSansMesure === undefined, 'aucune page candidat sans mesure');
    await page.goto(candidatSansMesure!.url);
    await expect(page.locator('#niv-aine')).toHaveCount(1);
    expect(await taille(page, '.statut')).toBe(16);
    const avecVide = (await page.locator('.vide').count()) > 0;
    if (avecVide) expect(await taille(page, '.vide')).toBe(18);
    await page.locator('#niv-aine').check();
    expect(await taille(page, '.statut')).toBe(20);
    if (avecVide) expect(await taille(page, '.vide')).toBe(22);
  });

  test('le niveau mémorisé sur une page thème est appliqué sur cette page candidat', async ({ page }) => {
    test.skip(candidatSansMesure === undefined || pageAvecSelecteur === undefined, 'aucune page candidat sans mesure');
    await page.goto(pageAvecSelecteur!.url);
    await page.locator('#niv-aine').check();
    await page.goto(candidatSansMesure!.url);
    await expect(page.locator('#niv-aine')).toBeChecked();
    expect(await taille(page, '.statut')).toBe(20);
  });
});

test.describe('finitions 09.1 : pied de page', () => {
  const pagesPied = [...new Set([pageTheme, pageCandidat, PAGES.find((p) => p.url === '/')])].filter((p) => p !== undefined);
  // Liens du bloc de navigation du pied (cibles de 44 px). Le lien « source officielle » est dans une phrase : cible en ligne,
  // exemptée de la taille minimale (WCAG 2.5.8), inchangée et non touchée par ce plan.
  test('à 375 px chaque lien de la navigation du pied fait au moins 44 px de haut', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const cible of pagesPied) {
      await page.goto(cible.url);
      const hauteurs = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('footer nav.pied-liens a')].map((a) => [a.textContent ?? '', a.getBoundingClientRect().height] as const));
      expect(hauteurs.length, `liens du pied de ${cible.url}`).toBeGreaterThanOrEqual(3);
      for (const [nom, h] of hauteurs) expect(h, `${cible.url} : lien « ${nom} »`).toBeGreaterThanOrEqual(44);
    }
  });

  test('à 1280 px le pied ne déborde pas horizontalement', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const cible of pagesPied) {
      await page.goto(cible.url);
      const m = await page.evaluate(() => {
        const f = document.querySelector<HTMLElement>('footer')!;
        return { pied: f.scrollWidth - f.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(m.pied, `${cible.url} : débordement du pied`).toBeLessThanOrEqual(0);
      expect(m.doc, `${cible.url} : débordement du document`).toBeLessThanOrEqual(0);
    }
  });
});
