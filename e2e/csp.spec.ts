// PERF-01 (D-09) : chaque page du dist s'exécute sous sa propre CSP (meta à empreintes, ADR-056) sans aucune
// violation, avec JavaScript. La configuration globale passe bypassCSP à true (texte.spec injecte des styles
// avec page.addStyleTag) : ce spec rétablit la politique réelle de la page.
// On vérifie aussi que les deux scripts en ligne ont réellement tourné (data-ordre-js partout, data-js-niveau
// sur les pages à sélecteur) : un script bloqué ne laisse pas toujours de trace dans la console.
import { expect, test } from '@playwright/test';
import { PAGES } from './pages.ts';

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

for (const p of PAGES) {
  test(`${p.url} : zéro violation CSP avec JS, scripts exécutés`, async ({ page }) => {
    const console_: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console_.push(`${m.type()} : ${m.text()}`);
    });
    page.on('pageerror', (e) => console_.push(`pageerror : ${e.message}`));
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__violations!.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto(p.url);
    expect(await page.evaluate(() => window.__violations), `${p.url} : securitypolicyviolation`).toEqual([]);
    expect(await page.locator('html').getAttribute('data-ordre-js'), `${p.url} : ordre.js a tourné`).not.toBeNull();
    if (p.aSelecteur) {
      expect(await page.locator('html').getAttribute('data-js-niveau'), `${p.url} : niveau.js a tourné`).not.toBeNull();
    }
    expect(console_, `${p.url} : console`).toEqual([]);
  });
}
