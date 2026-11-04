// QUAL-03 : la page la plus lourde, servie compressée, se charge à froid dans le budget de chaque profil de
// src/lib/profil-4g.ts (profils et budgets publiés sur la page Méthode). Trois mesures par profil, chacune
// dans un contexte neuf (cache et connexions neufs). Projet `4g` dédié, un seul worker : rien ne tourne à
// côté de la mesure.
import { expect, test } from '@playwright/test';
import { PROFILS_4G } from '../src/lib/profil-4g.ts';
import { pageLaPlusLourde } from './poids.ts';
import { PAGES } from './pages.ts';

const lourde = pageLaPlusLourde(process.env.E2E_DIST ?? 'dist-e2e/reel');

test('la page la plus lourde est une page du dist', () => {
  expect(lourde.octetsGzip).toBeGreaterThan(0);
  expect(PAGES.map((p) => p.url)).toContain(lourde.url);
});

for (const profil of PROFILS_4G) {
  test(`${lourde.url} : chargement à froid < ${profil.budgetMs} ms, ${profil.libelle} (3 sur 3)`, async ({ browser, baseURL }, testInfo) => {
    const mesures: number[] = [];
    for (let i = 0; i < 3; i++) {
      // Nouveau contexte à chaque mesure : cache, cookies et connexions TCP neufs, donc un vrai chargement à froid.
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
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
        expect(reponse?.headers()['content-encoding'], 'le HTML doit être servi compressé').toBe('gzip');
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
      body: JSON.stringify({ url: lourde.url, octetsGzip: lourde.octetsGzip, profil, mesuresMs: mesures }, null, 2),
      contentType: 'application/json',
    });
    console.log(`4G ${profil.id} ${lourde.url} (${lourde.octetsGzip} o gzip) : ${mesures.join(' / ')} ms (budget ${profil.budgetMs} ms)`);
    expect(Math.max(...mesures), `mesures ${mesures.join(', ')} ms`).toBeLessThan(profil.budgetMs);
  });
}
