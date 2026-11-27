// P-08, phase 10.4 : vignette à initiales de chaque carte de candidat. Les initiales sont calculées depuis le nom
// affiché, par la même règle pour tous (src/lib/initiales.ts) ; la vignette est décorative, de même classe et sans
// style propre : aucune couleur de parti, aucun rang. Réutilise « m1-production » et « m1-preview ».
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { aClasse, analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { initiales } from '../../../src/lib/initiales.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

export default function vignettes(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-vignettes'));
  const construit = (cle: 'm1-production' | 'm1-preview') => {
    const b = ctx.construire(cle, { racine, mode: cle === 'm1-production' ? 'production' : 'preview' });
    assert.equal(b.status, 0, `astro build (${cle}) a échoué :\n${b.output}`);
    return b;
  };

  describe('vignettes 10.4 : initiales des cartes calculées depuis le nom affiché', () => {
    for (const cle of ['m1-production', 'm1-preview'] as const) {
      it(`${cle} : chaque carte porte des initiales calculées, décoratives, identiques de forme`, () => {
        const { outDir } = construit(cle);
        const pages = ctx.pagesHtml(outDir).filter((f) => /(^|[\\/])themes[\\/][^\\/]+[\\/]index\.html$/.test(path.relative(outDir, f)));
        assert.ok(pages.length > 0, 'aucune page de thème');
        const vues = new Set<string>();
        let cartes = 0;
        for (const f of pages) {
          const r = path.relative(outDir, f);
          const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
          for (const li of trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'))) {
            cartes += 1;
            const pictos = trouver(li, (n) => aClasse(n, 'picto'));
            assert.equal(pictos.length, 1, `${r} : une vignette par carte`);
            const p = pictos[0] as Noeud;
            assert.equal(p.attrs['aria-hidden'], 'true', `${r} : vignette décorative`);
            assert.equal(p.attrs.class, 'picto', `${r} : même classe seule pour tous`);
            assert.ok(!('style' in p.attrs), `${r} : aucun style propre`);
            assert.ok(!Object.keys(p.attrs).some((k) => k.startsWith('data-')), `${r} : aucun data-*`);
            const nom = trouver(li, (n) => n.tag === 'h3' && aClasse(n, 'cellule-nom'))[0] as Noeud;
            const lettres = norm(texte(p));
            assert.ok(lettres.length > 0, `${r} : initiales vides`);
            assert.equal(lettres, initiales(norm(texte(nom))), `${r} : initiales de ${norm(texte(nom))}`);
            vues.add(lettres);
          }
        }
        assert.ok(cartes > 0, 'aucune carte');
        assert.ok(vues.size >= 2, `au moins deux initiales différentes attendues, vu : ${[...vues].join(', ')}`);
      });
    }

    it('source : initiales de Cellule.astro calculées, jamais écrites', () => {
      const src = fs.readFileSync(path.join(ctx.repoRoot, 'src/components/Cellule.astro'), 'utf8');
      assert.ok(!/class="picto"[^>]*>\s*[A-ZÀ-Ý]{1,4}\s*</.test(src), 'initiales écrites en dur dans Cellule.astro');
      assert.ok(src.includes('{candidat.initiales}'), 'Cellule.astro doit afficher {candidat.initiales}');
    });
  });
}
