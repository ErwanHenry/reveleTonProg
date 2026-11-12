// QUAL-04 / INST-02 : le site ne stocke que les deux réglages de présentation, n'écrit aucun cookie et ne
// contacte aucun autre hôte que le sien.
import { expect, test } from '@playwright/test';
import { CLES_STOCKAGE } from '../src/lib/stockage-local.ts';
import { premierePage } from './pages.ts';

test('stockage local, cookies et requêtes sortantes', async ({ page, context }) => {
  const hotes = new Set<string>();
  const chemins = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    chemins.add(u.pathname);
    if (u.protocol === 'http:' || u.protocol === 'https:') hotes.add(u.hostname);
  });

  const accueil = premierePage((p) => p.url === '/', 'l’accueil').url;
  const theme = premierePage((p) => p.estTheme && p.aSelecteur, 'une page de thème avec sélecteur').url;
  const candidat = premierePage((p) => p.url.startsWith('/candidats/') && p.aSelecteur, 'une page candidat avec sélecteur').url;

  await page.goto(accueil);
  await page.goto(theme);
  await page.locator('#niv-aine').check();
  await page.locator('#ordre-alea').check();
  await page.locator('#ordre-alpha').check();
  await page.goto(candidat);
  await page.locator('#niv-aine').check();
  await page.reload();

  const cles = await page.evaluate(() => Object.keys(localStorage));
  const permises: string[] = [CLES_STOCKAGE.niveau.cle, CLES_STOCKAGE.ordre.cle];
  for (const c of cles) expect(permises, `clé inattendue ${c}`).toContain(c);

  const valeurs = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const niveau = valeurs[CLES_STOCKAGE.niveau.cle];
  if (niveau !== undefined) expect(CLES_STOCKAGE.niveau.valeurs as readonly string[]).toContain(niveau);
  const ordre = valeurs[CLES_STOCKAGE.ordre.cle];
  if (ordre !== undefined) expect(CLES_STOCKAGE.ordre.valeurs as readonly string[]).toContain(ordre);
  expect(niveau, 'le niveau choisi doit être mémorisé').toBe('aine');

  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(await context.cookies()).toEqual([]);
  expect([...hotes]).toEqual(['127.0.0.1']);
  // 09.1 (proposition 6) : l'image de partage n'est citée que par og:image, pour les robots ; aucun visiteur ne la demande.
  expect([...chemins].filter((c) => /partage\.png$/.test(c)), 'aucune page ne doit charger partage.png').toEqual([]);
});
