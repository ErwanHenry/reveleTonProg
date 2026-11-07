// PERF-01 (D-09) : sans JavaScript (projet « sans-js »), chaque page s'affiche sous sa propre CSP sans aucune
// erreur ni avertissement dans la console. Un <style> en ligne refusé par la politique y est signalé
// (« Applying inline style violates… ») même quand JavaScript est coupé. La configuration globale passe
// bypassCSP à true (texte.spec) : ce spec rétablit la politique réelle de la page.
import { expect, test } from '@playwright/test';
import { PAGES } from './pages.ts';

test.use({ bypassCSP: false });

test('le dist contient des pages, la première porte un meta CSP (sans JS)', async ({ page }) => {
  expect(PAGES.length).toBeGreaterThan(0);
  const premiere = PAGES[0]!;
  await page.goto(premiere.url);
  await expect(page.locator('meta[http-equiv="content-security-policy"]'), premiere.url).toHaveCount(1);
});

for (const p of PAGES) {
  test(`${p.url} : zéro violation CSP sans JS`, async ({ page }) => {
    const console_: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console_.push(`${m.type()} : ${m.text()}`);
    });
    page.on('pageerror', (e) => console_.push(`pageerror : ${e.message}`));
    const rep = await page.goto(p.url);
    expect(rep?.status(), p.url).toBe(200);
    expect(console_, `${p.url} : console`).toEqual([]);
  });
}
