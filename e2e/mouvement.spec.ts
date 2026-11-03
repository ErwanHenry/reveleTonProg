// QUAL-04 : avec prefers-reduced-motion: reduce, aucune transition ni animation de durée non nulle, aucun défilement doux.
import { expect, test } from '@playwright/test';
import { PAGES } from './pages.ts';

test.use({ reducedMotion: 'reduce' });

for (const p of PAGES) {
  test(`${p.url} : mouvement réduit`, async ({ page }) => {
    await page.goto(p.url);
    const defauts = await page.evaluate(() => {
      const out: string[] = [];
      const nul = (v: string): boolean => v.split(',').every((d) => parseFloat(d) === 0);
      for (const el of [document.documentElement, ...document.querySelectorAll<HTMLElement>('*')]) {
        const cs = getComputedStyle(el);
        const nom = `<${el.tagName.toLowerCase()} class="${el.className}">`;
        if (!nul(cs.transitionDuration)) out.push(`${nom} transition ${cs.transitionDuration}`);
        if (!nul(cs.animationDuration)) out.push(`${nom} animation ${cs.animationDuration}`);
        if (cs.scrollBehavior === 'smooth') out.push(`${nom} scroll-behavior smooth`);
      }
      return out;
    });
    expect(defauts, defauts.slice(0, 10).join('\n')).toEqual([]);
  });
}
