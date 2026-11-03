// QUAL-04 : texte à 160 %, zoom émulé et reflow à 320 px, sans défilement horizontal ni texte coupé.
import { expect, test, type Page } from '@playwright/test';
import { NIVEAUX, PAGES } from './pages.ts';

const CONFIGS = [
  { nom: 'texte 160 % (1280 px)', largeur: 1280, texte160: true },
  { nom: 'zoom 160 % émulé (800 px)', largeur: 800, texte160: false },
  { nom: '320 px', largeur: 320, texte160: false },
  { nom: '320 px + texte 160 %', largeur: 320, texte160: true },
] as const;

async function verifier(page: Page, largeur: number): Promise<void> {
  const defauts = await page.evaluate((larg) => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`défilement horizontal : ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const coupe = cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
      if (coupe && el.scrollWidth > el.clientWidth + 1) {
        out.push(`texte coupé : <${el.tagName.toLowerCase()} class="${el.className}"> ${el.scrollWidth} > ${el.clientWidth}`);
      }
    }
    for (const l of document.querySelectorAll<HTMLElement>('.niveau label')) {
      const r = l.getBoundingClientRect();
      if (r.right > larg + 0.5) out.push(`étiquette de niveau hors écran : droite à ${Math.round(r.right)} px (> ${larg})`);
    }
    return out;
  }, largeur);
  expect(defauts, defauts.join('\n')).toEqual([]);
}

for (const c of CONFIGS) {
  for (const p of PAGES) {
    const niveaux = c.nom === '320 px + texte 160 %' && p.aSelecteur ? NIVEAUX : [null];
    for (const niveau of niveaux) {
      test(`${p.url} : ${c.nom}${niveau ? `, niveau ${niveau}` : ''}`, async ({ page }) => {
        await page.setViewportSize({ width: c.largeur, height: c.largeur === 1280 ? 900 : 800 });
        await page.goto(p.url);
        if (c.texte160) await page.addStyleTag({ content: 'html { font-size: 160% !important }' });
        if (niveau) await page.locator(`#niv-${niveau}`).check();
        await verifier(page, c.largeur);
      });
    }
  }
}
