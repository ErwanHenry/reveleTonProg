// QUAL-02 : parcours clavier. Premier arrêt = lien d'évitement ; chaque lien, bouton, summary et un arrêt
// par groupe de radios est atteint ; aucun tabindex positif ; un indicateur de focus est toujours visible.
import { expect, test, type Page } from '@playwright/test';
import { PAGES } from './pages.ts';

interface Attendu {
  cles: string[];
  tabindexPositifs: number;
}

/** Marque les éléments focalisables visibles (data-e2e-cle) et renvoie leurs clés (un radio = son groupe). */
async function marquer(page: Page): Promise<Attendu> {
  return page.evaluate(() => {
    const cles = new Set<string>();
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button, summary, input:not([type=hidden])')) {
      if (!el.checkVisibility() || (el as HTMLButtonElement).disabled) continue;
      const cle = el instanceof HTMLInputElement && el.type === 'radio' ? `radio:${el.name}` : `${el.tagName}#${n++}`;
      el.setAttribute('data-e2e-cle', cle);
      cles.add(cle);
    }
    return {
      cles: [...cles],
      tabindexPositifs: [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).length,
    };
  });
}

/** Indicateur de focus : outline >= 2px ou box-shadow, sur l'élément, son label ou son parent. */
async function indicateurFocus(page: Page): Promise<{ ok: boolean; cle: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { ok: false, cle: '(aucun)' };
    const candidats: Element[] = [el];
    const id = el.getAttribute('id');
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab) candidats.push(lab);
    }
    if (el.parentElement) candidats.push(el.parentElement);
    const ok = candidats.some((c) => {
      const s = getComputedStyle(c);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      const ombre = s.boxShadow !== 'none';
      return outline || ombre;
    });
    return { ok, cle: el.getAttribute('data-e2e-cle') ?? el.tagName };
  });
}

for (const p of PAGES) {
  test(`${p.url} : parcours clavier complet`, async ({ page }) => {
    await page.goto(p.url);
    const attendu = await marquer(page);
    expect(attendu.tabindexPositifs, 'tabindex > 0 interdit').toBe(0);

    await page.keyboard.press('Tab');
    const premier = await page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a?.tagName, href: a?.getAttribute('href') };
    });
    expect(premier, "premier arrêt = lien d'évitement").toEqual({ tag: 'A', href: '#contenu' });

    const visites = new Set<string>();
    const sansIndicateur: string[] = [];
    for (let i = 0; i <= attendu.cles.length + 5; i++) {
      const cle = await page.evaluate(() => document.activeElement?.getAttribute('data-e2e-cle') ?? null);
      if (cle !== null) {
        visites.add(cle);
        const ind = await indicateurFocus(page);
        if (!ind.ok) sansIndicateur.push(ind.cle);
      }
      await page.keyboard.press('Tab');
    }
    const manquants = attendu.cles.filter((c) => !visites.has(c));
    expect(manquants, 'éléments jamais atteints au clavier').toEqual([]);
    expect(sansIndicateur, 'éléments focalisés sans indicateur visible').toEqual([]);
  });
}
