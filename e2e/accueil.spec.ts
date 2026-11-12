// Finitions visuelles 09.1, lot B, proposition 1 (audit B3) : sur téléphone, la première tuile de thème est dans
// le premier écran de l'accueil, et le mode « Gros caractères » agrandit aussi la phrase de présentation
// (main:has(> .lecteur > .niveaux #niv-aine:checked) : le sélecteur est descendu sous les thèmes, il reste enfant de main).
// Les deux corpus (fixture en production, vrai corpus en préversion avec son bandeau).
import { expect, test } from '@playwright/test';
import { premierePage } from './pages.ts';

const accueil = premierePage((p) => p.url === '/', 'l’accueil').url;
/** Hauteur de la tuile qui doit au moins apparaître dans le premier écran (son nom et le début de sa carte). */
const PART_VISIBLE = 48;

test.describe('accueil 09.1 : thèmes au premier écran', () => {
  // Premier écran du site public, mesuré avec les métriques de la CI :
  // - police large imposée (Verdana, sinon DejaVu Sans), comme e2e/texte.spec.ts à 320 px : les polices système Linux
  //   de la CI sont plus larges que celles de macOS, et c'est la CI qui fait référence ; sans elle, le test passe
  //   en local et échoue en CI (894 px mesurés en CI le 2026-11-12 sur le vrai corpus, contre 761 px sur macOS) ;
  // - la hauteur mesurée du bandeau de préversion est retirée : il n'existe que dans la build preview (C11, verrouillé),
  //   jamais dans la page servie au public ; en production il est absent et rien n'est retiré.
  test('375 x 812 : au moins 48 px de la première tuile de thème dans le premier écran du site public', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueil);
    await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }' });
    const m = await page.evaluate(() => {
      const t = document.querySelector('.tuile');
      const b = document.querySelector('.bandeau-apercu');
      return {
        haut: t === null ? null : t.getBoundingClientRect().top + window.scrollY,
        bandeau: b === null ? 0 : b.getBoundingClientRect().height,
      };
    });
    expect(m.haut, 'aucune tuile de thème').not.toBeNull();
    console.log(`accueil 375 x 812 (police large) : première tuile à ${Math.round(m.haut!)} px, bandeau de préversion ${Math.round(m.bandeau)} px`);
    expect(m.haut! - m.bandeau + PART_VISIBLE).toBeLessThan(812);
  });

  test('« Gros caractères » : la phrase de présentation passe à 22 px', async ({ page }) => {
    await page.goto(accueil);
    await page.locator('#niv-aine').check();
    await expect(page.locator('#niv-aine')).toBeChecked();
    const taille = await page.evaluate(() => {
      const p = document.querySelector('p.hall-presentation');
      return p === null ? null : getComputedStyle(p).fontSize;
    });
    expect(taille).toBe('22px');
  });
});
