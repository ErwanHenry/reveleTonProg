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
import { REPO_ROOT } from '../../helpers/validate-yaml.ts';
import { formatJourMois, libellesTours, TOURS } from '../../../src/lib/dates-tours.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');

/** Jeton d'un enfant de main : balise, puis la classe qui le désigne s'il en a une connue. */
function jeton(n: Noeud): string {
  for (const c of ['hall-tete', 'hall-texte', 'hall-annee', 'hall-surtitre', 'hall-action', 'hall-presentation', 'garanties', 'hall-candidats', 'hall-methode', 'tuiles', 'autres-themes', 'lecteur', 'hall-themes', 'hall-niveaux']) {
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
      'div.hall-tete',
      'ul.garanties',
      'h2.hall-themes',
      'ul.tuiles',
      ...(attendueAutresThemes ? ['p.autres-themes'] : []),
      // Classe qui donne au lien sa cible de 44 et 48 px hors de .lecteur (WR-01 de la revue 09.1).
      'p.hall-candidats',
      // Lien vers la Méthode après les thèmes.
      'p.hall-methode',
      'h2.hall-niveaux',
      'div.lecteur',
    ];
    assert.deepEqual(enfants.map(jeton), attendu);
    // 10.4 : le haut de l'accueil est un bloc à deux enfants (texte, puis bloc « 2027 » décoratif).
    const tete = enfants[0] as Noeud;
    assert.deepEqual(elements(tete).map(jeton), ['div.hall-texte', 'div.hall-annee']);
    const texteTete = elements(tete)[0] as Noeud;
    assert.deepEqual(elements(texteTete).map(jeton), ['p.hall-surtitre', 'h1', 'p.hall-presentation', 'p.hall-action']);
    assert.equal(txt(elements(texteTete)[1] as Noeud), 'Les programmes de la présidentielle 2027, à votre niveau');
    const par = (cls: string): Noeud => {
      const n = enfants.find((e) => aClasse(e, cls));
      assert.ok(n, cls);
      return n;
    };
    assert.equal(txt(par('hall-themes')), 'Les thèmes');
    const lienCandidats = trouver(par('hall-candidats'), (n) => n.tag === 'a')[0];
    assert.equal(lienCandidats?.attrs.href, '/candidats/');
    // P-12 (10.2, décision d'Erwan du 2026-11-27) : le nombre est celui des personnes listées sur /candidats/ de la même
    // build. Les builds production et preview n'ont pas le même nombre : un nombre écrit à la main échoue sur l'une des deux.
    const nListe = trouver(analyserHtml(ctx.lire(outDir, 'candidats/index.html')), (n) => aClasse(n, 'ligne-nom')).length;
    assert.ok(nListe >= 2, `au moins deux personnes listées sur /candidats/ (${nListe})`);
    assert.equal(txt(lienCandidats as Noeud), `Voir les ${nListe} candidats`);
    assert.equal(txt(par('hall-niveaux')), 'Quatre niveaux de lecture');
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

      it(`${cle} : le nombre du lien vers /candidats/ vient des données, jamais d'un littéral dans la page`, () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'pages', 'index.astro'), 'utf8');
        assert.ok(!/Voir les \d+ candidats/.test(src), 'nombre écrit à la main dans index.astro');
        assert.match(src, /const nCandidats = corpus\.candidats\.length;/);
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
        // Texte validé par Erwan le 2026-11-13 : la garantie ne promet plus l'ordre aléatoire, qui demande JavaScript
        // (revue 09.1, IN-10). Le sélecteur d'ordre l'annonce lui-même là où il existe.
        assert.doesNotMatch(t, /ordre aléatoire/);
        assert.match(t, /Par défaut, les candidats sont classés par ordre alphabétique, jamais selon les sondages\./);
        assert.match(t, /sans jugement/);
        assert.match(t, /daté et archivé/);
        assert.match(t, /cookie/);
        const methode = trouver(m, (n) => n.tag === 'p' && aClasse(n, 'hall-methode'))[0] as Noeud;
        const a = trouver(methode, (n) => n.tag === 'a')[0] as Noeud;
        assert.equal(a.attrs.href, '/methode/');
        assert.ok(txt(a).length > 0);
        // Texte validé par Erwan le 2026-11-13 (revue 09.1, WR-02) : pas de « thème par thème », le site ouvre
        // avec un seul thème publié.
        const presentation = txt(trouver(m, (n) => aClasse(n, 'hall-presentation'))[0] as Noeud).replace(/\s+/g, ' ').trim();
        assert.equal(
          presentation,
          "Ce site explique ce que proposent les candidats à l'élection présidentielle de 2027, un thème à la fois. Il ne prend jamais parti.",
        );
        // La description de l'accueil sert aussi de description de partage (og:description).
        const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
        assert.ok(
          html.includes('content="Les propositions des candidats, à quatre niveaux de lecture, avec leur source."'),
          "description de l'accueil validée par Erwan",
        );
        assert.ok(!/thème par thème/.test(html), "plus de « thème par thème » sur l'accueil");
        // Même règle sur tout le site (Méthode et pages candidat alignées le 2026-11-13, accord d'Erwan).
        for (const f of ctx.pagesHtml(outDir)) {
          assert.ok(!/thème par thème/.test(fs.readFileSync(f, 'utf8')), `« thème par thème » dans ${path.relative(outDir, f)}`);
        }
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

  describe('accueil 10.4 : surtitre, bloc 2027, bouton, garanties', () => {
    /** Vérifie le bouton principal : un seul, dans p.hall-action, qui reprend le nom et l'adresse du premier lien de tuile. */
    function verifierBouton(m: Noeud): void {
      const boutons = trouver(m, (n) => n.tag === 'a' && aClasse(n, 'bouton'));
      assert.equal(boutons.length, 1, 'un seul a.bouton dans main');
      const bouton = boutons[0] as Noeud;
      const action = trouver(m, (n) => n.tag === 'p' && aClasse(n, 'hall-action'))[0] as Noeud;
      assert.ok(trouver(action, (n) => n === bouton).length === 1, 'le bouton est dans p.hall-action');
      const lien = trouver(m, (n) => n.tag === 'a' && aClasse(n, 'tuile-lien'))[0] as Noeud;
      assert.ok(lien, 'premier a.tuile-lien');
      assert.equal(txt(bouton), `Lire le thème ${txt(lien)}`);
      assert.equal(bouton.attrs.href, lien.attrs.href);
    }

    for (const cle of ['m1-production', 'm1-preview'] as const) {
      it(`${cle} : surtitre et bloc 2027 calculés depuis TOURS`, () => {
        const { outDir } = construit(cle);
        const m = main(outDir);
        const t = libellesTours();
        const surtitre = txt(trouver(m, (n) => n.tag === 'p' && aClasse(n, 'hall-surtitre'))[0] as Noeud);
        assert.equal(surtitre, t.surtitre);
        for (const frag of [formatJourMois(TOURS[0].date), formatJourMois(TOURS[1].date), TOURS[0].date.slice(0, 4)]) {
          assert.ok(surtitre.includes(frag), `surtitre contient ${frag}`);
        }
        const annee = trouver(m, (n) => n.tag === 'div' && aClasse(n, 'hall-annee'))[0] as Noeud;
        assert.equal(annee.attrs['aria-hidden'], 'true');
        const ps = elements(annee);
        assert.equal(ps.length, 2);
        assert.ok(ps.every((p) => p.tag === 'p'));
        assert.deepEqual(ps.map(txt), [t.annee, t.bloc]);
        assert.ok(txt(annee).includes(formatJourMois(TOURS[0].date)) && txt(annee).includes(formatJourMois(TOURS[1].date)));
      });

      it(`${cle} : garanties étiquetées et bouton du premier thème`, () => {
        const { outDir } = construit(cle);
        const m = main(outDir);
        const ul = trouver(m, (n) => n.tag === 'ul' && aClasse(n, 'garanties'))[0] as Noeud;
        const titres = elements(ul).map((li) => {
          const premier = elements(li)[0] as Noeud;
          assert.equal(premier.tag, 'strong');
          assert.ok(aClasse(premier, 'garantie-titre'));
          return txt(premier);
        });
        assert.deepEqual(titres, ['Sourcé', 'Sans classement', 'Sans traceur']);
        verifierBouton(m);
      });
    }

    it('un seul thème ouvert : le bouton mène à ce thème', () => {
      const { outDir } = unTheme();
      verifierBouton(main(outDir));
    });

    it('index.astro ne contient aucune date, aucun ordinal de tour, aucun « 2027 » isolé ni nom de thème dans le bouton', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'pages', 'index.astro'), 'utf8');
      assert.doesNotMatch(src, /\b(avril|mai)\b/);
      assert.doesNotMatch(src, /1er tour|2d tour/);
      assert.doesNotMatch(src, />\s*2027\s*</);
      assert.doesNotMatch(src, /Lire le thème [A-ZÀ-Ý]/);
      assert.match(src, /libellesTours\(\)/);
      assert.match(src, /corpus\.themes\[0\]/);
      assert.doesNotMatch(src, /set:html/);
    });
  });
}
