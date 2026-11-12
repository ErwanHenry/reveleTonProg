// Finitions visuelles 09.1, lot B, proposition 3 (audit B5) : liste « Aller à un candidat (N) » en tête de la page
// d'un thème. Un <details> fermé, placé entre l'introduction et le lecteur de niveaux, qui contient une nav avec un
// lien par carte vers l'ancre #c-<id> existante, dans l'ordre alphabétique des cartes. Hors de toute liste
// [data-ordonnable] : l'ordre aléatoire ne la touche jamais (neutralité). Sans JavaScript (élément natif).
// Fixture corpus-m1, production et preview.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
const visible = (n: Noeud): string => norm(texte(n, (x) => aClasse(x, 'sr-only')));

export default function accesCandidats(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'));
  const builds = () =>
    (['production', 'preview'] as const).map((mode) => {
      const b = ctx.construire(`m1-${mode}`, { racine, mode });
      assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
      return { mode, outDir: b.outDir };
    });
  const pagesTheme = (outDir: string): { ou: string; arbre: Noeud }[] =>
    ctx
      .pagesHtml(outDir)
      .filter((f) => /[\\/]themes[\\/][^\\/]+[\\/]index\.html$/.test(f))
      .map((f) => ({ ou: path.relative(outDir, f), arbre: analyserHtml(fs.readFileSync(f, 'utf8')) }));

  describe('acces candidats 09.1 : liste « Aller à un candidat » en tête de la page d’un thème', () => {
    it('un details fermé entre l’introduction et le lecteur, un lien par carte vers #c-<id>, ordre alphabétique', () => {
      let vues = 0;
      for (const { mode, outDir } of builds()) {
        for (const { ou, arbre } of pagesTheme(outDir)) {
          const lieu = `${mode} ${ou}`;
          const cartes = trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
          const blocs = trouver(arbre, (n) => n.tag === 'details' && aClasse(n, 'acces-candidats'));
          if (cartes.length === 0) {
            assert.equal(blocs.length, 0, `${lieu} : aucune liste sans carte`);
            continue;
          }
          vues++;
          assert.equal(blocs.length, 1, `${lieu} : une seule liste`);
          const bloc = blocs[0] as Noeud;
          assert.equal(bloc.attrs.open, undefined, `${lieu} : fermée par défaut`);
          // Place : enfant de main, après le paragraphe d'introduction, juste avant div.lecteur
          const main = bloc.parent as Noeud;
          assert.equal(main.tag, 'main', lieu);
          const freres = elements(main);
          const i = freres.indexOf(bloc);
          assert.equal(freres[i - 1]?.tag, 'p', `${lieu} : après l'introduction`);
          assert.ok(freres[i + 1] !== undefined && aClasse(freres[i + 1] as Noeud, 'lecteur'), `${lieu} : avant le lecteur`);
          const summary = elements(bloc)[0] as Noeud;
          assert.equal(summary.tag, 'summary', lieu);
          assert.equal(visible(summary), `Aller à un candidat (${cartes.length})`, lieu);
          const navs = trouver(bloc, (n) => n.tag === 'nav');
          assert.equal(navs.length, 1, lieu);
          assert.equal(navs[0]?.attrs['aria-label'], 'Aller à un candidat', lieu);
          const ul = elements(navs[0] as Noeud).find((e) => e.tag === 'ul') as Noeud;
          assert.ok(ul, `${lieu} : nav > ul`);
          const liens = trouver(ul, (n) => n.tag === 'a');
          assert.deepEqual(
            liens.map((a) => a.attrs.href),
            cartes.map((c) => `#${c.attrs.id}`),
            `${lieu} : un lien par carte, dans l'ordre des cartes`,
          );
          assert.deepEqual(
            liens.map((a) => visible(a)),
            cartes.map((c) => visible(trouver(c, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud)),
            `${lieu} : nom affiché de chaque candidat`,
          );
          const rangs = cartes.map((c) => Number(c.attrs['data-rang']));
          assert.ok(rangs.every((r, k) => k === 0 || r > (rangs[k - 1] as number)), `${lieu} : cartes et liens en ordre alphabétique (rang croissant) : ${rangs}`);
          for (let p: Noeud | null | undefined = ul; p !== null && p !== undefined; p = p.parent) {
            assert.equal(p.attrs['data-ordonnable'], undefined, `${lieu} : jamais dans une liste réordonnée`);
          }
        }
      }
      assert.ok(vues >= 2, `pages thème avec cartes vues : ${vues}`);
    });

    it('checkDist : ancres résolues, aucun identifiant en double', () => {
      for (const { mode, outDir } of builds()) {
        const constats = checkDist(outDir, { mode, cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode) });
        const erreurs = constats.filter((c) => c.severite === 'erreur');
        assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
      }
    });
  });
}
