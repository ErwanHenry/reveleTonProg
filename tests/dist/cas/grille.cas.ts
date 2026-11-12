// Finitions visuelles 09.1, lot B, proposition 4 (audit B6) : grille des cartes sans grands vides.
// TOUCHE la règle VERROUILLÉE M1-08 (« même hauteur par rangée ») : décision d'Erwan requise (09.1-09).
// Vérifié sur le CSS réellement servi par les pages thème (fixture corpus-m1, production).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';
import { cssDesPages } from '../css-pages.ts';

export default function grille(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'));

  describe('grille M1-08 09.1 : cartes à leur hauteur', () => {
    it('le CSS servi des pages thème aligne les cartes en haut (.cellules{…align-items:start…})', () => {
      const b = ctx.construire('m1-production', { racine, mode: 'production' });
      assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
      const pages = ctx
        .pagesHtml(b.outDir)
        .filter((f) => /[\\/]themes[\\/][^\\/]+[\\/]index\.html$/.test(f))
        .map((f) => path.relative(b.outDir, f).split(path.sep).join('/'));
      assert.ok(pages.length >= 1, 'aucune page thème');
      const css = cssDesPages(b.outDir, pages).replace(/\s+/g, '');
      const regles = [...css.matchAll(/(?:^|})\.cellules\{([^}]*)\}/g)].map((m) => m[1] ?? '');
      assert.ok(regles.length >= 1, 'règle .cellules absente du CSS servi');
      assert.ok(regles.some((r) => /(^|;)align-items:start(;|$)/.test(r)), `align-items:start absent : ${regles.join(' | ')}`);
    });
  });
}
