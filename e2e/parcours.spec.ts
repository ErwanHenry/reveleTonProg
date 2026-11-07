// DETTE-02 (W4, D-12) : le niveau de lecture est gardé sur un parcours par clics et après un retour arrière
// restauré du back/forward cache (pageshow persisted). Projet « parcours » : channel 'chromium' (le headless
// shell par défaut refuse le bfcache) sans --disable-back-forward-cache ; sinon le test ne prouverait rien.
// Preuve par mutation : la même navigation sur une copie du dist dont le script de niveau n'a plus son
// gestionnaire pageshow ne montre plus le niveau choisi en dernier.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { jusquaLaPageCandidat } from './chemin.ts';
import { PAGES } from './pages.ts';
import { creerServeur } from './serveur.ts';

const GESTIONNAIRE = "addEventListener('pageshow', function (e) { if (e.persisted) appliquer(lire()); });";
const DIST = path.resolve(process.env.E2E_DIST ?? 'dist-e2e/reel');

interface Etat {
  marqueur: string | undefined;
  ps: boolean[];
}

async function enregistrerPageshow(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __ps: boolean[] };
    w.__ps = [];
    addEventListener('pageshow', (e) => w.__ps.push(e.persisted));
  });
}

/** Retour arrière restauré du bfcache : la page de thème revient avec son marqueur JS et persisted true. */
async function retourBfcache(page: Page, urlTheme: string): Promise<void> {
  // Pas d'événement load à une restauration bfcache : goBack() par défaut expirerait.
  await page.goBack({ waitUntil: 'commit' });
  await expect(page).toHaveURL(urlTheme);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ps?: boolean[] }).__ps ?? []), {
      message: 'pageshow persisted === true attendu',
    })
    .toContain(true);
  const etat = await page.evaluate<Etat>(() => {
    const w = window as unknown as { __marqueur?: string; __ps: boolean[] };
    return { marqueur: w.__marqueur, ps: w.__ps };
  });
  expect(etat.marqueur, 'la page de thème doit venir du bfcache (même document)').toBe('theme');
  expect(etat.ps, 'pageshow : chargement puis restauration').toEqual([false, true]);
}

test('niveau gardé d\'une page à l\'autre et après un retour restauré du bfcache', async ({ page }) => {
  await enregistrerPageshow(page);
  const urlTheme = await jusquaLaPageCandidat(page);
  await retourBfcache(page, urlTheme);
  await expect(page.locator('#niv-enfant'), 'niveau choisi sur la page candidat, relu au pageshow').toBeChecked();
});

test.describe('preuve par mutation : sans gestionnaire pageshow', () => {
  let copie: string;
  let serveur: Server;
  let base: string;

  test.beforeAll(async () => {
    // Copie hors du dépôt, servie sur 127.0.0.1 port libre ; bypassCSP reste à true dans ce projet (le script
    // muté n'a plus l'empreinte de la politique).
    copie = mkdtempSync(path.join(tmpdir(), 'rtp-parcours-'));
    cpSync(DIST, copie, { recursive: true });
    for (const p of PAGES.filter((x) => x.aSelecteur)) {
      const f = path.join(copie, path.relative(DIST, p.fichier));
      const html = readFileSync(f, 'utf8');
      const n = html.split(GESTIONNAIRE).length - 1;
      expect(n, `${p.url} : gestionnaire pageshow trouvé dans le script de niveau`).toBeGreaterThanOrEqual(1);
      writeFileSync(f, html.split(GESTIONNAIRE).join(''));
    }
    serveur = creerServeur(copie);
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    if (serveur) await new Promise<void>((ok) => serveur.close(() => ok()));
    if (copie) rmSync(copie, { recursive: true, force: true });
  });

  test('restauré du bfcache, la page garde l\'ancien niveau', async ({ page }) => {
    await enregistrerPageshow(page);
    const urlTheme = await jusquaLaPageCandidat(page, base);
    expect(urlTheme.startsWith(`${base}/`), 'la navigation reste sur la copie mutée').toBe(true);
    await retourBfcache(page, urlTheme);
    // Le document restauré garde le niveau coché sur la page de thème : le test principal dépend bien du
    // gestionnaire.
    await expect(page.locator('#niv-aine')).toBeChecked();
    await expect(page.locator('#niv-enfant')).not.toBeChecked();
  });
});
