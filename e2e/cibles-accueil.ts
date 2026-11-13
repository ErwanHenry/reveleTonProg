// Cibles tactiles des liens de main sur l'accueil (WR-01 de la revue 09.1), partagées par e2e/accueil.spec.ts (avec
// JavaScript) et e2e/accueil-sans-js.spec.ts (sans JavaScript).
import { expect, type Page } from '@playwright/test';

/** Police large de la CI (Verdana, sinon DejaVu Sans), comme e2e/accueil.spec.ts et e2e/texte.spec.ts. */
export const POLICE_LARGE = '* { font-family: Verdana, "DejaVu Sans", sans-serif !important }';

/**
 * Sans JavaScript, page.addStyleTag attend un événement que la page ne peut pas émettre : la police large est donc
 * insérée dans le HTML du document à la réception (interception réseau, sans script dans la page ; bypassCSP de la config).
 */
export async function policeLargeSansJs(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const reponse = await route.fetch();
    const html = (await reponse.text()).replace('</head>', `<style>${POLICE_LARGE}</style></head>`);
    const { 'content-encoding': _e, 'content-length': _l, ...entetes } = reponse.headers();
    await route.fulfill({ response: reponse, body: html, headers: entetes });
  });
}

export async function verifierCibles(page: Page, minimum: number): Promise<void> {
  const mesures = await page.evaluate(() =>
    [...document.querySelectorAll('main a')].map((a) => {
      const tuile = a.closest('.tuile');
      const boite = (tuile ?? a).getBoundingClientRect();
      return { texte: (a.textContent ?? '').trim(), tuile: tuile !== null, hauteur: boite.height };
    }),
  );
  const autonomes = mesures.filter((m) => !m.tuile);
  expect(autonomes.length, 'liens autonomes de main').toBeGreaterThanOrEqual(2);
  expect(autonomes.map((m) => m.texte)).toContain('Comment nous travaillons');
  for (const m of mesures) {
    expect(m.hauteur, `${m.tuile ? 'tuile' : 'lien'} « ${m.texte} » : ${m.hauteur} px`).toBeGreaterThanOrEqual(minimum - 0.5);
  }
}
