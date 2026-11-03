// QUAL-03 : la page la plus lourde se charge à froid en moins d'une seconde en 4G lente (profil publié sur la
// page Méthode), servie compressée. Projet `4g` dédié, un seul worker : rien ne tourne à côté de la mesure.
import { expect, test } from '@playwright/test';
import { PROFIL_4G } from '../src/lib/profil-4g.ts';
import { pageLaPlusLourde } from './poids.ts';
import { PAGES } from './pages.ts';

const lourde = pageLaPlusLourde(process.env.E2E_DIST ?? 'dist-e2e/reel');

test('la page la plus lourde est une page du dist', () => {
  expect(lourde.octetsGzip).toBeGreaterThan(0);
  expect(PAGES.map((p) => p.url)).toContain(lourde.url);
});

test(`${lourde.url} : chargement à froid en 4G lente < 1 s (3 sur 3)`, async ({ page, context, baseURL }, testInfo) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: PROFIL_4G.latenceMs,
    downloadThroughput: PROFIL_4G.debitDescendantOctetsParSeconde,
    uploadThroughput: PROFIL_4G.debitMontantOctetsParSeconde,
  });

  const mesures: number[] = [];
  for (let i = 0; i < 3; i++) {
    await cdp.send('Network.clearBrowserCache');
    await page.goto('about:blank');
    const reponse = await page.goto(`${baseURL}${lourde.url}`, { waitUntil: 'load' });
    expect(reponse?.headers()['content-encoding'], 'le HTML doit être servi compressé').toBe('gzip');
    const ms = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav.loadEventEnd - nav.startTime;
    });
    mesures.push(Math.round(ms));
  }

  await testInfo.attach('mesures-4g.json', {
    body: JSON.stringify({ url: lourde.url, octetsGzip: lourde.octetsGzip, profil: PROFIL_4G.libelle, mesuresMs: mesures }, null, 2),
    contentType: 'application/json',
  });
  console.log(`4G ${lourde.url} (${lourde.octetsGzip} o gzip) : ${mesures.join(' / ')} ms`);
  expect(Math.max(...mesures), `mesures ${mesures.join(', ')} ms`).toBeLessThan(1000);
});
