// Finitions visuelles 09.1 et charte 10.4 : sur téléphone, le bouton du premier thème est entier dans le premier écran de
// l'accueil (règle 7 de la charte, D-06), et le mode « Gros caractères » agrandit aussi la phrase de présentation
// (main:has(> .lecteur > .niveaux #niv-aine:checked) : le sélecteur est descendu sous les thèmes, il reste enfant de main).
// Les deux corpus (fixture en production, vrai corpus en préversion avec son bandeau).
import { expect, test, type Page } from '@playwright/test';
import { premierePage } from './pages.ts';
import { POLICE_LARGE, verifierCibles } from './cibles-accueil.ts';

const accueil = premierePage((p) => p.url === '/', 'l’accueil').url;

/** Bas du bouton (avec le défilement) et hauteur du bandeau de préversion. */
async function mesurerBouton(page: Page): Promise<{ bas: number | null; bandeau: number }> {
  return page.evaluate(() => {
    const t = document.querySelector('a.bouton');
    const b = document.querySelector('.bandeau-apercu');
    return {
      bas: t === null ? null : t.getBoundingClientRect().bottom + window.scrollY,
      bandeau: b === null ? 0 : b.getBoundingClientRect().height,
    };
  });
}

test.describe('accueil 10.4 : bouton du premier thème au premier écran', () => {
  // Premier écran du site public, mesuré avec les métriques de la CI :
  // - police large imposée (Verdana, sinon DejaVu Sans), comme e2e/texte.spec.ts à 320 px : les polices système Linux
  //   de la CI sont plus larges que celles de macOS, et c'est la CI qui fait référence ;
  // - la hauteur mesurée du bandeau de préversion est retirée : il n'existe que dans la build preview (C11, verrouillé),
  //   jamais dans la page servie au public ; en production il est absent et rien n'est retiré.
  // L'exigence d'un accès au thème dans le premier écran n'est jamais retirée (D-06) ; seuil d'alerte du §7.2 : 700 px.
  test('375 x 812 : le bouton du premier thème entier dans le premier écran du site public', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueil);
    await page.addStyleTag({ content: POLICE_LARGE });
    const m = await mesurerBouton(page);
    expect(m.bas, 'aucun bouton').not.toBeNull();
    const utile = m.bas! - m.bandeau;
    console.log(
      `accueil 375 x 812 (police large) : bas du bouton à ${Math.round(m.bas!)} px, bandeau de préversion ${Math.round(m.bandeau)} px, marge restante ${Math.round(812 - utile)} px`,
    );
    expect(utile).toBeLessThan(812);
  });

  // Même mesure, titres en serif (charte 10.2, UI-SPEC §7.2 parade 2) : DejaVu Serif en CI, Georgia sur macOS.
  test('375 x 812, titres en serif : le bouton du premier thème entier dans le premier écran', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueil);
    await page.addStyleTag({
      content:
        POLICE_LARGE +
        ' ' +
        'h1, h2, .site-nom, .tuile-lien, .cellule-nom { font-family: "DejaVu Serif", Georgia, serif !important }',
    });
    const m = await mesurerBouton(page);
    expect(m.bas, 'aucun bouton').not.toBeNull();
    const utile = m.bas! - m.bandeau;
    console.log(
      `accueil 375 x 812 (police large, titres serif) : bas du bouton à ${Math.round(m.bas!)} px, bandeau de préversion ${Math.round(m.bandeau)} px, marge restante ${Math.round(812 - utile)} px`,
    );
    expect(utile).toBeLessThan(812);
  });

  // Règle de contrat du §7.3 : au-dessus du bouton, seulement l'en-tête, le surtitre, le h1 et la présentation.
  test('375 x 812 : rien d\'autre au-dessus du bouton ; garanties et tuiles dessous ; bloc 2027 masqué', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueil);
    await page.addStyleTag({ content: POLICE_LARGE });
    const r = await page.evaluate(() => {
      const bouton = document.querySelector('a.bouton')!.getBoundingClientRect();
      const intrus: string[] = [];
      for (const e of document.querySelectorAll('main *')) {
        if (e.getClientRects().length === 0 || e.contains(document.querySelector('a.bouton'))) continue;
        if (e.getBoundingClientRect().top < bouton.top && e.closest('.hall-texte') === null) {
          intrus.push(`${e.tagName.toLowerCase()}.${e.className}`);
        }
      }
      const haut = (sel: string): number => document.querySelector(sel)!.getBoundingClientRect().top;
      return {
        intrus,
        garanties: haut('ul.garanties'),
        tuiles: haut('ul.tuiles'),
        boutonBas: bouton.bottom,
        annee: getComputedStyle(document.querySelector('.hall-annee')!).display,
      };
    });
    expect(r.intrus, 'éléments de main au-dessus du bouton hors div.hall-texte').toEqual([]);
    expect(r.garanties).toBeGreaterThanOrEqual(r.boutonBas);
    expect(r.tuiles).toBeGreaterThanOrEqual(r.boutonBas);
    expect(r.annee).toBe('none');
  });

  // Le nom du thème et l'adresse viennent des données : un nom écrit à la main échoue sur l'un des deux jeux
  // (Logement en m1, Santé en réel).
  test('le bouton reprend le nom et l\'adresse du premier thème', async ({ page }) => {
    await page.goto(accueil);
    const lien = page.locator('a.tuile-lien').first();
    const nom = ((await lien.textContent()) ?? '').trim().replace(/\s+/g, ' ');
    const bouton = page.locator('main a.bouton');
    await expect(bouton).toHaveCount(1);
    expect(((await bouton.textContent()) ?? '').trim().replace(/\s+/g, ' ')).toBe(`Lire le thème ${nom}`);
    expect(await bouton.getAttribute('href')).toBe(await lien.getAttribute('href'));
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

  // WR-01 (revue 09.1) : depuis que les thèmes sont sortis de .lecteur, les liens autonomes de main (« Voir tous les
  // candidats », « Consulter la liste des candidats », « Comment nous travaillons ») doivent porter eux-mêmes leur cible :
  // 44 px, et 48 px en « Gros caractères » (04-UI-SPEC). Les tuiles ont pour cible toute la carte (::after étiré).
  // Aucun lien dans une phrase dans main de l'accueil : aucune exemption. Même police large que le test ci-dessus.
  test('liens autonomes de main : 44 px, puis 48 px en « Gros caractères » ; tuiles : carte entière', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(accueil);
    await page.addStyleTag({ content: POLICE_LARGE });
    await verifierCibles(page, 44);
    await page.locator('#niv-aine').check();
    await verifierCibles(page, 48);
  });
});
