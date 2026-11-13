// Finitions visuelles 09.1, lot B, proposition 1 (audit B3) : accueil réordonné. Ce que le site est (une phrase),
// pourquoi lui faire confiance (trois garanties et un lien vers la Méthode), puis les thèmes, puis les niveaux de
// lecture et le sélecteur. Réutilise « m1-production » et « m1-preview » ; une build de plus (« accueil-un-theme »)
// sur une copie de la fixture qui n'ouvre qu'un thème, cas de l'ouverture (une seule tuile, santé).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { aClasse, analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');

/** Jeton d'un enfant de main : balise, puis la classe qui le désigne s'il en a une connue. */
function jeton(n: Noeud): string {
  for (const c of ['hall-presentation', 'garanties', 'hall-candidats', 'hall-methode', 'tuiles', 'autres-themes', 'lecteur', 'hall-themes', 'hall-niveaux']) {
    if (aClasse(n, c)) return `${n.tag}.${c}`;
  }
  return n.tag;
}

export default function accueil(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-accueil'));
  const construit = (cle: 'm1-production' | 'm1-preview') => {
    const b = ctx.construire(cle, { racine, mode: cle === 'm1-production' ? 'production' : 'preview' });
    assert.equal(b.status, 0, `astro build (${cle}) a échoué :\n${b.output}`);
    return b;
  };
  // Copie de la fixture qui n'ouvre que « logement » (liste blanche, et « climat » repassé en brouillon comme
  // l'exige PUBLICATION_THEME_NON_OUVERT) : une seule tuile, comme à l'ouverture.
  const unTheme = () => {
    const r = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-un-theme'));
    fs.writeFileSync(path.join(r, 'config', 'publication.yml'), 'themes_ouverts:\n  - logement\n');
    const climat = path.join(r, 'src', 'content', 'themes', 'climat.yaml');
    const avant = fs.readFileSync(climat, 'utf8');
    assert.ok(avant.includes('statut_relecture: publie\n'), 'climat.yaml de la fixture : statut publie attendu');
    fs.writeFileSync(climat, avant.replace('statut_relecture: publie\n', 'statut_relecture: brouillon\n'));
    const b = ctx.construire('accueil-un-theme', { racine: r, mode: 'production' });
    assert.equal(b.status, 0, `astro build (un thème) a échoué :\n${b.output}`);
    return b;
  };
  const main = (outDir: string): Noeud => {
    const m = trouver(analyserHtml(ctx.lire(outDir, 'index.html')), (n) => n.tag === 'main' && n.attrs.id === 'contenu')[0];
    assert.ok(m, 'main#contenu');
    return m;
  };

  /** Vérifie l'ordre des enfants de main et renvoie main. */
  function verifierOrdre(outDir: string, attendueAutresThemes: boolean): Noeud {
    const m = main(outDir);
    const enfants = elements(m);
    const attendu = [
      'h1',
      'p.hall-presentation',
      'ul.garanties',
      'h2.hall-themes',
      'ul.tuiles',
      ...(attendueAutresThemes ? ['p.autres-themes'] : []),
      // Classe qui donne au lien sa cible de 44 et 48 px hors de .lecteur (WR-01 de la revue 09.1).
      'p.hall-candidats',
      // Lien vers la Méthode après les thèmes : la première tuile reste au premier écran (e2e/accueil.spec.ts).
      'p.hall-methode',
      'h2.hall-niveaux',
      'div.lecteur',
    ];
    assert.deepEqual(enfants.map(jeton), attendu);
    assert.equal(txt(enfants[0] as Noeud), 'Les programmes de la présidentielle 2027, à votre niveau');
    assert.equal(txt(enfants[3] as Noeud), 'Les thèmes');
    const lienCandidats = trouver(enfants[attendu.length - 4] as Noeud, (n) => n.tag === 'a')[0];
    assert.equal(lienCandidats?.attrs.href, '/candidats/');
    assert.equal(txt(lienCandidats as Noeud), 'Voir tous les candidats');
    assert.equal(txt(enfants[attendu.length - 2] as Noeud), 'Quatre niveaux de lecture');
    return m;
  }

  describe('accueil 09.1 : présentation, garanties, thèmes avant le niveau de lecture', () => {
    for (const cle of ['m1-production', 'm1-preview'] as const) {
      it(`${cle} : enfants de main dans l'ordre h1, présentation, garanties, Méthode, thèmes, candidats, niveaux`, () => {
        const { outDir } = construit(cle);
        // La fixture ouvre deux thèmes (logement, climat) : ni tuile pleine largeur ni phrase sur les autres thèmes.
        const m = verifierOrdre(outDir, false);
        assert.equal(trouver(m, (n) => aClasse(n, 'tuile-une')).length, 0, 'tuile-une avec plusieurs thèmes');
        assert.ok(trouver(m, (n) => aClasse(n, 'tuile')).length >= 2);
      });

      it(`${cle} : trois garanties, dont l'ordre alphabétique jamais selon les sondages et la source datée sans jugement ; lien vers la Méthode`, () => {
        const { outDir } = construit(cle);
        const m = main(outDir);
        const ul = trouver(m, (n) => n.tag === 'ul' && aClasse(n, 'garanties'))[0] as Noeud;
        assert.equal(ul.attrs.role, 'list');
        const lis = elements(ul);
        assert.equal(lis.length, 3);
        assert.ok(lis.every((li) => li.tag === 'li'));
        const t = lis.map(txt).join(' ');
        // Les deux faits de l'ancien paragraphe de neutralité restent dits.
        assert.match(t, /ordre alphabétique, jamais selon les sondages/);
        assert.match(t, /ordre aléatoire/);
        assert.match(t, /sans jugement/);
        assert.match(t, /daté et archivé/);
        assert.match(t, /cookie/);
        const methode = trouver(m, (n) => n.tag === 'p' && aClasse(n, 'hall-methode'))[0] as Noeud;
        const a = trouver(methode, (n) => n.tag === 'a')[0] as Noeud;
        assert.equal(a.attrs.href, '/methode/');
        assert.ok(txt(a).length > 0);
        assert.ok(txt(trouver(m, (n) => aClasse(n, 'hall-presentation'))[0] as Noeud).length > 0);
      });

      it(`${cle} : .lecteur enfant direct de main, fieldset puis la liste des quatre niveaux, plus de paragraphe de neutralité séparé`, () => {
        const { outDir } = construit(cle);
        const m = main(outDir);
        const lecteur = elements(m).find((n) => aClasse(n, 'lecteur')) as Noeud;
        const dedans = elements(lecteur);
        assert.equal(dedans[0]?.tag, 'fieldset');
        assert.equal(dedans[0]?.attrs.id, 'niveaux');
        const dl = trouver(lecteur, (n) => n.tag === 'dl');
        assert.equal(dl.length, 1);
        assert.equal(trouver(dl[0] as Noeud, (n) => n.tag === 'dt').length, 4);
        assert.equal(trouver(lecteur, (n) => aClasse(n, 'tuile')).length, 0, 'aucune tuile dans le lecteur');
        assert.ok(!txt(m).includes('Chaque mesure vient d\'une source primaire datée'), 'ancien paragraphe de neutralité');
        assert.ok(!txt(m).includes('Choisissez aussi votre niveau de lecture'), 'ancienne introduction');
      });
    }

    it('un seul thème ouvert : la tuile porte tuile-une et la phrase sur les autres thèmes suit la liste', () => {
      const { outDir } = unTheme();
      const m = verifierOrdre(outDir, true);
      const tuiles = trouver(m, (n) => n.tag === 'li' && aClasse(n, 'tuile'));
      assert.equal(tuiles.length, 1);
      assert.ok(aClasse(tuiles[0] as Noeud, 'tuile-une'));
      assert.ok(txt(trouver(m, (n) => aClasse(n, 'autres-themes'))[0] as Noeud).length > 0);
    });
  });
}
