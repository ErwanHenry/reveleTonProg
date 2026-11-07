// PERF-01 (D-09) : chaque page du dist s'exécute sous sa propre CSP (meta à empreintes, ADR-056) sans aucune
// violation, avec JavaScript. La configuration globale passe bypassCSP à true (texte.spec injecte des styles
// avec page.addStyleTag) : ce spec rétablit la politique réelle de la page.
// On vérifie aussi que les deux scripts en ligne ont réellement tourné (data-ordre-js partout, data-js-niveau
// sur les pages à sélecteur) : un script bloqué ne laisse pas toujours de trace dans la console.
// WR-02 : e2e/serveur.ts envoie l'en-tête CSP du bloc Caddy (cspEnTete) ; le navigateur applique donc ici l'en-tête
// et le meta ensemble, comme en production. Preuve par mutation : un script d'ordre altéré (placé avant le meta, que
// le meta ne gouverne pas, ADR-056) est bloqué par l'en-tête, et tourne quand l'en-tête est retiré.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { scriptsEnLigne } from '../src/lib/csp-empreintes.ts';
import { PAGES } from './pages.ts';
import { creerServeur, cspEnTeteDuDepot } from './serveur.ts';

test.use({ bypassCSP: false });

declare global {
  interface Window {
    __violations?: string[];
  }
}

test('le dist contient des pages, la première porte un meta CSP', async ({ page }) => {
  expect(PAGES.length).toBeGreaterThan(0);
  const premiere = PAGES[0]!;
  await page.goto(premiere.url);
  // Sans ce contrôle, le spec passerait sur un dist sans politique.
  await expect(page.locator('meta[http-equiv="content-security-policy"]'), premiere.url).toHaveCount(1);
});

test('chaque page porte aussi l’en-tête CSP du bloc Caddy (en-tête et meta appliqués ensemble)', async ({ request }) => {
  const attendu = cspEnTeteDuDepot();
  expect(attendu).not.toMatch(/default-src|style-src/);
  for (const p of PAGES) {
    const rep = await request.get(p.url);
    expect(rep.headers()['content-security-policy'], p.url).toBe(attendu);
  }
});

for (const p of PAGES) {
  test(`${p.url} : zéro violation CSP avec JS, scripts exécutés`, async ({ page }) => {
    const console_: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console_.push(`${m.type()} : ${m.text()}`);
    });
    page.on('pageerror', (e) => console_.push(`pageerror : ${e.message}`));
    await enregistrerViolations(page);
    await page.goto(p.url);
    expect(await page.evaluate(() => window.__violations), `${p.url} : securitypolicyviolation`).toEqual([]);
    expect(await page.locator('html').getAttribute('data-ordre-js'), `${p.url} : ordre.js a tourné`).not.toBeNull();
    if (p.aSelecteur) {
      expect(await page.locator('html').getAttribute('data-js-niveau'), `${p.url} : niveau.js a tourné`).not.toBeNull();
    }
    expect(console_, `${p.url} : console`).toEqual([]);
  });
}

async function enregistrerViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violations!.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
}

test.describe('preuve par mutation : script d’ordre altéré', () => {
  const ordre = scriptsEnLigne(path.resolve('.')).find((s) => s.nom === 'ordre.js')!.texte;
  let dossier: string;
  const serveurs: Server[] = [];

  test.beforeAll(() => {
    const html = readFileSync(PAGES[0]!.fichier, 'utf8');
    // Le script d'ordre doit être en ligne, tel quel, avant le meta CSP : sinon la preuve ne porte sur rien.
    const iScript = html.indexOf(ordre);
    expect(iScript, 'ordre.js en ligne dans la page').toBeGreaterThan(-1);
    expect(iScript, 'ordre.js avant le meta CSP').toBeLessThan(html.indexOf('http-equiv="content-security-policy"'));
    dossier = mkdtempSync(path.join(tmpdir(), 'rtp-csp-ordre-'));
    writeFileSync(path.join(dossier, 'index.html'), html.replace(ordre, `${ordre}\n// altéré\n`));
  });

  test.afterAll(async () => {
    for (const s of serveurs) await new Promise<void>((ok) => s.close(() => ok()));
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  async function servir(csp: string | null): Promise<string> {
    const s = creerServeur(dossier, { csp });
    serveurs.push(s);
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
    return `http://127.0.0.1:${(s.address() as AddressInfo).port}/`;
  }

  test('avec l’en-tête du bloc Caddy : le script altéré est bloqué (violation script-src)', async ({ page }) => {
    await enregistrerViolations(page);
    await page.goto(await servir(cspEnTeteDuDepot()));
    expect(await page.locator('html').getAttribute('data-ordre-js')).toBeNull();
    const violations = (await page.evaluate(() => window.__violations)) ?? [];
    expect(violations.some((v) => /^script-src(-elem)? inline$/.test(v)), violations.join(' | ')).toBe(true);
  });

  test('témoin sans en-tête : le meta seul laisse tourner le script altéré (ADR-056)', async ({ page }) => {
    await enregistrerViolations(page);
    await page.goto(await servir(null));
    expect(await page.locator('html').getAttribute('data-ordre-js')).not.toBeNull();
  });
});
