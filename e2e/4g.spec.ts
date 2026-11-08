// QUAL-03 : la page la plus lourde, servie compressée, se charge à froid dans le budget de chaque profil de
// src/lib/profil-4g.ts (profils et budgets publiés sur la page Méthode). Trois mesures par profil, chacune
// dans un contexte neuf (cache et connexions neufs). Projet `4g` dédié, un seul worker : rien ne tourne à
// côté de la mesure.
// PERF-02 (D-13) : avec E2E_BASE_URL, la même mesure vise le vrai serveur (playwright.config.ts). Un contexte créé à
// la main n'hérite ni de `use.extraHTTPHeaders` ni de `use.httpCredentials` : l'en-tête Authorization Basic du projet
// est passé à chaque contexte de mesure, envoyé d'emblée, et la mesure échoue si une réponse 401 apparaît (le temps
// mesuré ne contient donc aucun aller-retour d'authentification). Caddy peut répondre en zstd, gzip ou br.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PROFILS_4G } from '../src/lib/profil-4g.ts';
import { pageLaPlusLourde } from './poids.ts';
import { PAGES } from './pages.ts';

const dist = process.env.E2E_DIST ?? 'dist-e2e/reel';
const lourde = pageLaPlusLourde(dist);
const distant = process.env.E2E_BASE_URL !== undefined && process.env.E2E_BASE_URL !== '';

test('la page la plus lourde est une page du dist', () => {
  expect(lourde.octetsGzip).toBeGreaterThan(0);
  expect(PAGES.map((p) => p.url)).toContain(lourde.url);
});

if (distant) {
  // T-08-25 : la build mesurée est celle qui a été pesée (même commit servi et local).
  test('le serveur sert le commit du dist local (version.json)', async ({ request, baseURL }) => {
    const locale = JSON.parse(readFileSync(path.join(dist, 'version.json'), 'utf8')) as { commit?: unknown };
    expect(locale.commit, `${dist}/version.json : construire le dist avec GITHUB_SHA=<commit servi>`).toMatch(/^[0-9a-f]{40}$/);
    const reponse = await request.get(`${baseURL}/version.json`);
    expect(reponse.status(), 'version.json du serveur').toBe(200);
    const servie = (await reponse.json()) as { commit?: unknown };
    console.log(`version servie ${String(servie.commit)}, dist local ${String(locale.commit)}`);
    expect(servie.commit, 'commit servi différent du dist local mesuré').toBe(locale.commit);
  });
}

for (const profil of PROFILS_4G) {
  test(`${lourde.url} : chargement à froid < ${profil.budgetMs} ms, ${profil.libelle} (3 sur 3)`, async ({ browser, baseURL, extraHTTPHeaders }, testInfo) => {
    const mesures: number[] = [];
    const encodages: string[] = [];
    for (let i = 0; i < 3; i++) {
      // Nouveau contexte à chaque mesure : cache, cookies et connexions TCP neufs, donc un vrai chargement à froid.
      // En-têtes du projet (Authorization Basic en mode distant, aucun en local) : envoyés dès la première requête.
      const context = await browser.newContext({ extraHTTPHeaders: extraHTTPHeaders ?? {} });
      try {
        const page = await context.newPage();
        const statuts: Array<{ url: string; status: number }> = [];
        page.on('response', (r) => statuts.push({ url: r.url(), status: r.status() }));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: profil.latenceRequeteMs,
          downloadThroughput: profil.debitDescendantOctetsParSeconde,
          uploadThroughput: profil.debitMontantOctetsParSeconde,
        });
        const reponse = await page.goto(`${baseURL}${lourde.url}`, { waitUntil: 'load' });
        expect(reponse?.status(), 'première réponse du document').toBe(200);
        expect(
          statuts.filter((s) => s.status === 401),
          'aucune réponse 401 dans la mesure (identifiants envoyés d’emblée)',
        ).toEqual([]);
        const encodage = reponse?.headers()['content-encoding'] ?? '';
        expect(encodage, 'le HTML doit être servi compressé (gzip, zstd ou br)').toMatch(/^(gzip|zstd|br)$/);
        encodages.push(encodage);
        const ms = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return nav.loadEventEnd - nav.startTime;
        });
        mesures.push(Math.round(ms));
      } finally {
        await context.close();
      }
    }

    await testInfo.attach(`mesures-4g-${profil.id}.json`, {
      body: JSON.stringify(
        { url: lourde.url, baseURL, octetsGzip: lourde.octetsGzip, profil, mesuresMs: mesures, encodages },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    console.log(
      `4G ${profil.id} ${lourde.url} (${lourde.octetsGzip} o gzip, servi en ${[...new Set(encodages)].join('/')}) : ${mesures.join(' / ')} ms (budget ${profil.budgetMs} ms)`,
    );
    expect(Math.max(...mesures), `mesures ${mesures.join(', ')} ms`).toBeLessThan(profil.budgetMs);
  });
}
