// DETTE-02 (W4) : parcours par clics commun à parcours.spec (retour restauré du bfcache) et retour.spec
// (retour sans bfcache). La page de thème est choisie dans le dist, jamais par identifiant : la fixture et le
// vrai corpus ne publient pas les mêmes thèmes.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { premierePage, type PageDist } from './pages.ts';

/** Vrai si le HTML contient une cellule de candidat avec un lien vers une page candidat. */
function aCelluleAvecCandidat(p: PageDist): boolean {
  return readFileSync(p.fichier, 'utf8')
    .split('<li class="cellule"')
    .slice(1)
    .some((c) => c.includes('href="/candidats/'));
}

export const THEME = premierePage(
  (p) => p.estTheme && p.aSelecteur && aCelluleAvecCandidat(p),
  'une page de thème avec sélecteur de niveau et une cellule qui renvoie vers une page candidat',
);

/**
 * Hall, nav « Thèmes », thème choisi, niveau Aîné coché, marqueur posé, page candidat (niveau Aîné gardé),
 * niveau Enfant coché. `base` vide : baseURL de la config ; sinon origine absolue (serveur de la copie mutée).
 * Les radios sont cochés sur l'input (jamais un clic sur le <label> : le radio le recouvre, voir niveaux.css).
 * Renvoie l'URL absolue de la page de thème.
 */
export async function jusquaLaPageCandidat(page: Page, base = ''): Promise<string> {
  await page.goto(`${base}/`);
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Thèmes', exact: true }).click();
  await expect(page).toHaveURL(/\/themes\/$/);
  await page.locator(`main a[href="${THEME.url}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${THEME.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.locator('#niv-resume')).toBeChecked();
  await page.locator('#niv-aine').check();
  await page.evaluate(() => {
    (window as unknown as { __marqueur: string }).__marqueur = 'theme';
  });
  const urlTheme = page.url();
  await page.locator('main li.cellule a[href^="/candidats/"]').first().click();
  // Le lien de cellule porte une ancre vers le thème (#<thème>).
  await expect(page).toHaveURL(/\/candidats\/[^/#]+\/(#.*)?$/);
  await expect(page.locator('#niv-aine'), 'niveau gardé d\'une page à l\'autre').toBeChecked();
  await page.locator('#niv-enfant').check();
  return urlTheme;
}
