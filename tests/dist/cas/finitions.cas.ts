// Finitions visuelles 09.1 (lot A) : le CSS réellement inliné dans les pages construites (ADR-056).
// Réutilise le build « m1-production » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { analyserHtml, texte } from '../../../scripts/lib/html.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import { cssDesPages } from '../css-pages.ts';
import type { ContexteSite } from '../contexte.ts';

/** Blocs « prélude { corps } » du CSS minifié, avec leur chaîne de @media englobants. */
function blocs(css: string): { prelude: string; corps: string; medias: string[] }[] {
  const sortie: { prelude: string; corps: string; medias: string[] }[] = [];
  const parcourir = (src: string, medias: string[]): void => {
    let i = 0;
    while (i < src.length) {
      const o = src.indexOf('{', i);
      if (o < 0) return;
      const prelude = src.slice(i, o).replace(/^[^{}]*;/, '').trim();
      let prof = 1;
      let j = o + 1;
      while (j < src.length && prof > 0) {
        if (src[j] === '{') prof++;
        else if (src[j] === '}') prof--;
        j++;
      }
      const corps = src.slice(o + 1, j - 1);
      if (prelude.startsWith('@media')) parcourir(corps, [...medias, prelude.replace(/\s+/g, '')]);
      else sortie.push({ prelude, corps, medias });
      i = j;
    }
  };
  parcourir(css, []);
  return sortie;
}

export default function finitions(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-candidats-relus'));
  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };

  describe('finitions 09.1 : CSS servi', () => {
    it('aucune règle de .mesure ne déclare hyphens ; .redaction et .definition ont overflow-wrap: anywhere', () => {
      const css = cssDesPages(production().outDir);
      const tous = blocs(css);
      const mesure = tous.filter((b) => b.prelude.split(',').some((s) => /\.mesure(?![-\w])/.test(s)));
      assert.ok(mesure.length > 0, 'règle .mesure introuvable dans le CSS servi');
      for (const b of mesure) assert.ok(!b.corps.includes('hyphens'), `${b.prelude} déclare hyphens : ${b.corps}`);
      for (const sel of ['.redaction', '.definition']) {
        const r = tous.filter((b) => b.prelude.split(',').includes(sel));
        assert.ok(r.some((b) => b.corps.includes('overflow-wrap:anywhere')), `${sel} sans overflow-wrap:anywhere`);
      }
    });

    it('chaque :hover du CSS servi est dans @media (hover:hover)', () => {
      const css = cssDesPages(production().outDir);
      const survols = blocs(css).filter((b) => b.prelude.includes(':hover'));
      assert.ok(survols.length >= 4, `règles :hover trouvées : ${survols.length}`);
      for (const b of survols) {
        assert.ok(b.medias.some((m) => m.includes('(hover:hover)')), `${b.prelude} hors @media (hover:hover)`);
      }
    });

    it('la barre du thème est sur .theme-entete, plus sur main[data-theme]', () => {
      const tous = blocs(cssDesPages(production().outDir));
      const main = tous.filter((b) => b.prelude.includes('main[data-theme]'));
      for (const b of main) assert.ok(!b.corps.includes('border-top'), `${b.prelude} garde border-top`);
      assert.ok(
        tous.some((b) => b.prelude === '.theme-entete' && b.corps.includes('border-top:8px solid var(--theme)')),
        '.theme-entete sans barre de 8px',
      );
    });

    it('la page /candidats/ ne renvoie plus à un contrôle « ci-dessus »', () => {
      const { outDir } = production();
      const t = texte(analyserHtml(ctx.lire(outDir, 'candidats/index.html')));
      assert.ok(!t.includes('ci-dessus'), 'ci-dessus encore présent');
      assert.ok(t.replace(/\s+/g, ' ').includes('par ordre alphabétique du nom, ou dans un ordre aléatoire si vous le choisissez ci-dessous'));
    });
  });
}
