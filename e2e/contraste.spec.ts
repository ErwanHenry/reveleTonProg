// QUAL-04 : le texte de chacune des 10 couleurs de thème passe le contraste AA d'axe, aux niveaux En bref et
// Gros caractères, même si le vrai corpus ne publie que quelques thèmes pilotes (la couleur est injectée par
// l'attribut data-theme sur la page, jamais une liste d'identifiants en dur).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { THEMES_SPEC } from '../scripts/lib/couverture.ts';
import { PAGES, premierePage } from './pages.ts';

const IDS = THEMES_SPEC.map((t) => t.id);
const NIVEAUX_TESTES = ['resume', 'aine'] as const;

test('base.css définit une couleur pour chacun des 10 thèmes', () => {
  const css = readFileSync('src/styles/base.css', 'utf8');
  expect(IDS).toHaveLength(10);
  for (const id of IDS) expect(css, `[data-theme="${id}"] absent de base.css`).toContain(`[data-theme="${id}"]`);
});

const cibles = [
  premierePage((p) => p.estTheme && p.aSelecteur, 'une page de thème avec sélecteur').url,
  premierePage((p) => p.url === '/', 'l’accueil').url,
];
test('les pages ciblées existent dans le dist', () => {
  for (const u of cibles) expect(PAGES.map((p) => p.url)).toContain(u);
});

for (const url of cibles) {
  for (const id of IDS) {
    for (const niveau of NIVEAUX_TESTES) {
      test(`${url} : couleur ${id}, niveau ${niveau}`, async ({ page }) => {
        await page.goto(url);
        await page.evaluate((i) => {
          for (const el of document.querySelectorAll('[data-theme]')) el.setAttribute('data-theme', i);
        }, id);
        await page.locator(`#niv-${niveau}`).check();
        const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const msg = res.violations
          .flatMap((v) => v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} : ${n.any[0]?.message ?? ''}`))
          .join('\n');
        expect(res.violations, msg).toEqual([]);
      });
    }
  }
}
