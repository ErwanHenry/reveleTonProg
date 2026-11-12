// Finitions visuelles 09.1 (lot A), sans JavaScript (projet « sans-js ») : « Gros caractères » sur une page candidat sans
// mesure. Le mécanisme est du CSS pur (main:has(> .lecteur > .niveaux #niv-aine:checked)) : il exige que le sélecteur de
// niveau soit présent sur la page, même sans aucune mesure. Aucun identifiant de page en dur (PAGES).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PAGES } from './pages.ts';

const lire = (fichier: string): string => readFileSync(fichier, 'utf8');
const reel = (process.env.E2E_DIST ?? 'dist-e2e/reel').includes('reel');
const candidats = PAGES.filter((p) => /^\/candidats\/[^/]+\/$/.test(p.url) && !lire(p.fichier).includes('class="mesure"') && lire(p.fichier).includes('class="statut'));
const candidat = candidats.find((p) => lire(p.fichier).includes('class="vide"')) ?? candidats[0];

test.describe('finitions 09.1 : page candidat sans mesure, sans JavaScript', () => {
  test('« Gros caractères » agrandit le bloc de statut (20 px) et l\'état vide (22 px)', async ({ page }) => {
    if (reel) expect(candidat, 'le vrai corpus doit compter au moins un candidat sans mesure').toBeDefined();
    test.skip(candidat === undefined, 'fixture sans page candidat sans mesure');
    await page.goto(candidat!.url);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-js-niveau'))).toBe(false);
    const taille = (s: string) => page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el === null ? null : parseFloat(getComputedStyle(el).fontSize);
    }, s);
    expect(await taille('.statut')).toBe(16);
    const avecVide = (await page.locator('.vide').count()) > 0;
    if (avecVide) expect(await taille('.vide')).toBe(18);
    await page.locator('#niv-aine').check();
    expect(await taille('.statut')).toBe(20);
    if (avecVide) expect(await taille('.vide')).toBe(22);
  });
});
