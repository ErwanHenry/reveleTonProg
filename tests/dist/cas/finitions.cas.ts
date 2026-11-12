// Finitions visuelles 09.1 (lot A) : le CSS réellement inliné dans les pages construites (ADR-056).
// Réutilise le build « m1-production » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { aClasse, analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import { cssDesPages } from '../css-pages.ts';
import type { ContexteSite } from '../contexte.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';

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

  describe('finitions 09.1 : niveaux', () => {
    const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const source = fs.readFileSync(path.join(ctx.repoRoot, 'src', 'scripts', 'niveau.js'), 'utf8');

    for (const [cle, mode] of [['m1-production', 'production'], ['m1-preview', 'preview']] as const) {
      const construit = () => {
        const b = ctx.construire(cle, { racine, mode });
        assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
        return b;
      };
      const rel = (outDir: string, f: string): string => path.relative(outDir, f).split(path.sep).join('/');

      it(`${mode} : chaque page candidat garde son sélecteur de niveau et son script, avec ou sans mesure (gros caractères et niveau mémorisé en dépendent)`, () => {
        const { outDir } = construit();
        const fiches = ctx.pagesHtml(outDir).filter((f) => /^candidats\/[^/]+\/index\.html$/.test(rel(outDir, f)));
        assert.ok(fiches.length > 0, 'aucune page candidat');
        let sansMesure = 0;
        for (const f of fiches) {
          const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
          const champs = trouver(arbre, (n) => n.tag === 'fieldset' && n.attrs.id === 'niveaux');
          assert.equal(champs.length, 1, `${rel(outDir, f)} : un seul fieldset#niveaux`);
          const champ = champs[0] as Noeud;
          const freres = elements(champ.parent as Noeud);
          const suivant = freres[freres.indexOf(champ) + 1] as Noeud;
          assert.equal(suivant?.tag, 'script', `${rel(outDir, f)} : le script de niveau suit le sélecteur`);
          assert.equal(texte(suivant), source, `${rel(outDir, f)} : script de niveau identique à src/scripts/niveau.js`);
          // Le mode « Gros caractères » est commuté par main:has(> .lecteur > .niveaux #niv-aine:checked)
          const lecteur = champ.parent as Noeud;
          assert.ok(aClasse(lecteur, 'lecteur'), `${rel(outDir, f)} : le sélecteur est dans .lecteur`);
          assert.equal(lecteur.parent?.tag, 'main', `${rel(outDir, f)} : .lecteur est enfant direct de main`);
          assert.equal(trouver(arbre, (n) => n.tag === 'input' && n.attrs.id === 'niv-aine').length, 1, `${rel(outDir, f)} : radio « Gros caractères »`);
          if (trouver(arbre, (n) => n.tag === 'article' && aClasse(n, 'mesure')).length === 0) sansMesure++;
        }
        assert.ok(sansMesure > 0, 'la fixture doit compter au moins une page candidat sans mesure (luc-retire), sinon le cas est vide');
      });

      it(`${mode} : l'accueil garde un seul sélecteur mais plus de lien « Changer le niveau de lecture »`, () => {
        const { outDir } = construit();
        const arbre = analyserHtml(ctx.lire(outDir, 'index.html'));
        assert.equal(trouver(arbre, (n) => n.tag === 'fieldset' && n.attrs.id === 'niveaux').length, 1);
        assert.equal(trouver(arbre, (n) => aClasse(n, 'rappel-niveau')).length, 0, 'rappel encore présent sur l\'accueil');
        assert.ok(!norm(texte(arbre)).includes('Changer le niveau de lecture'));
      });

      it(`${mode} : pages thème et pages candidat gardent le rappel en dernier élément de .lecteur-contenu`, () => {
        const { outDir } = construit();
        const pages = ctx.pagesHtml(outDir).filter((f) => /^(themes|candidats)\/[^/]+\/index\.html$/.test(rel(outDir, f)));
        assert.ok(pages.some((f) => rel(outDir, f).startsWith('themes/')) && pages.some((f) => rel(outDir, f).startsWith('candidats/')));
        for (const f of pages) {
          const arbre = analyserHtml(fs.readFileSync(f, 'utf8'));
          const contenu = trouver(arbre, (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud | undefined;
          assert.ok(contenu, `${rel(outDir, f)} : .lecteur-contenu`);
          const els = elements(contenu);
          const dernier = els[els.length - 1] as Noeud;
          assert.ok(aClasse(dernier, 'rappel-niveau'), `${rel(outDir, f)} : le rappel n'est pas le dernier élément`);
          const a = trouver(dernier, (n) => n.tag === 'a')[0] as Noeud;
          assert.equal(a.attrs.href, '#niveaux');
        }
      });
    }
  });
}
