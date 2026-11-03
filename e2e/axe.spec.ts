// QUAL-02 : audit WCAG 2.2 AA (axe) de toutes les pages du dist, et de chacun des 4 niveaux de lecture
// quand la page a le sélecteur. Échec sur toute violation « serious » ou « critical ».
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { NIVEAUX, PAGES } from './pages.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function auditer(page: Page): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const graves = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const message = graves
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
    .join('\n');
  expect(graves, message).toEqual([]);
}

for (const p of PAGES) {
  if (!p.aSelecteur) {
    test(`${p.url} : axe`, async ({ page }) => {
      await page.goto(p.url);
      await auditer(page);
    });
    continue;
  }
  for (const niveau of NIVEAUX) {
    test(`${p.url} : axe, niveau ${niveau}`, async ({ page }) => {
      await page.goto(p.url);
      await page.locator(`#niv-${niveau}`).check();
      await auditer(page);
    });
  }
}
