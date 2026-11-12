// Pages candidat, index, hall, navigation et liens croisés (M1-02, M1-03, M1-12) sur la surcouche fictive corpus-m1.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { NOM_SITE } from '../../../src/lib/identite.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));

// Production : Paul et Nina n'ont aucun statut relu, ils sont absents de la build (D-06, plan 09-15).
const IDS = ['elise-erard', 'marie-fictive', 'jean-imaginaire', 'luc-retire'];
const ECARTES = ['nina-pressentie', 'paul-de-villefranche'];
const SANS_MESURE = "Aucune mesure n'est présentée pour cette personnalité : les thèmes couvrent les candidatures déclarées et les candidatures à une primaire.";
const STATUT_A_VERIFIER = "Aucune mesure n'est présentée pour cette personnalité tant que son statut est en cours de vérification.";
const INTRO_CANDIDATS =
  "Les personnalités du jeu de données dont le statut a été relu, par ordre alphabétique du nom, ou dans un ordre aléatoire si vous le choisissez ci-dessous. Le statut est celui de la dernière source consultée.";
const NIVEAUX_HALL = [
  ['En bref', 'Une phrase par mesure.'],
  ['En détail', 'Le coût annoncé, le calendrier, ce qui existe déjà dans la loi et la citation du programme.'],
  ['Pour les enfants', 'Des mots simples, avec les mots difficiles expliqués.'],
  ['Gros caractères', 'Un texte plus grand et les thèmes qui touchent souvent les retraités en premier.'],
];

export default function candidat(ctx: ContexteSite): void {
  // Racine dédiée dans le dossier temporaire du contexte : nettoyerCorpusM1() supprimerait aussi celles des autres modules.
  // Les builds « m1-production » et « m1-preview » sont mémorisés par clé : ce module (le premier par ordre alphabétique) les construit.
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-candidat'));

  const production = () => {
    const b = ctx.construire('m1-production', { racine, mode: 'production' });
    assert.equal(b.status, 0, `astro build (production) a échoué :\n${b.output}`);
    return b;
  };
  const preview = () => {
    const b = ctx.construire('m1-preview', { racine, mode: 'preview' });
    assert.equal(b.status, 0, `astro build (preview) a échoué :\n${b.output}`);
    return b;
  };
  const page = (outDir: string, chemin: string): { html: string; arbre: Noeud } => {
    const html = ctx.lire(outDir, chemin);
    return { html, arbre: analyserHtml(html) };
  };
  const liens = (n: Noeud): Noeud[] => trouver(n, (x) => x.tag === 'a');
  const lien = (n: Noeud, libelle: string | RegExp): Noeud => {
    const l = liens(n).find((a) => (typeof libelle === 'string' ? txt(a) === libelle : libelle.test(txt(a))));
    assert.ok(l, `lien « ${String(libelle)} » absent`);
    return l;
  };
  const section = (arbre: Noeud, id: string): Noeud => {
    const s = trouver(arbre, (n) => n.tag === 'section' && n.attrs.id === id)[0];
    assert.ok(s, `section #${id} absente`);
    return s;
  };
  const nav = (arbre: Noeud): Noeud => {
    const n = trouver(arbre, (x) => x.tag === 'nav' && x.attrs['aria-label'] === 'Navigation principale')[0];
    assert.ok(n, 'nav « Navigation principale » absente');
    return n;
  };

  describe('production : pages candidat', () => {
    it('une page par personnalité au statut relu, aucune pour Paul et Nina', () => {
      const { outDir } = production();
      for (const id of IDS) assert.ok(fs.existsSync(path.join(outDir, 'candidats', id, 'index.html')), `candidats/${id}/index.html`);
      for (const id of ECARTES) assert.equal(fs.existsSync(path.join(outDir, 'candidats', id, 'index.html')), false, `candidats/${id}/index.html`);
    });

    it('Marie : nom, parti revendiqué, statut daté avec lien source', () => {
      const { arbre, html } = page(production().outDir, 'candidats/marie-fictive/index.html');
      assert.equal(txt(trouver(arbre, (n) => n.tag === 'h1')[0] as Noeud), 'Marie Fictive');
      assert.ok(html.includes(`<title>Marie Fictive : positions par thème, ${NOM_SITE}</title>`));
      assert.ok(norm(texte(arbre)).includes('Parti revendiqué : Parti Imaginaire'));
      const statut = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'statut'))[0] as Noeud;
      assert.ok(statut, 'p.statut');
      assert.equal(txt(statut), 'Candidature déclarée, depuis le 15 octobre 2026. Source : Annonce de candidature (fictive).');
      assert.ok(trouver(statut, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-15').length === 1);
      const l = lien(statut, 'Annonce de candidature (fictive)');
      assert.equal(l.attrs.href, 'https://marie-fictive.exemple.invalid/candidature');
      assert.deepEqual((l.attrs.rel ?? '').split(/\s+/).sort(), ['noopener', 'noreferrer']);
    });

    it('Marie : section logement (h2, deux mesures en h3, lien vers la carte) puis climat (état vide)', () => {
      const { arbre } = page(production().outDir, 'candidats/marie-fictive/index.html');
      const logement = section(arbre, 'logement');
      assert.equal(logement.attrs['data-theme'], 'logement');
      assert.equal(txt(trouver(logement, (n) => n.tag === 'h2')[0] as Noeud), 'Logement');
      const mesures = trouver(logement, (n) => n.tag === 'article' && aClasse(n, 'mesure'));
      assert.equal(mesures.length, 2);
      for (const m of mesures) assert.equal(trouver(m, (n) => n.tag === 'h3').length, 1);
      assert.equal(lien(logement, 'Voir tous les candidats sur le thème Logement').attrs.href, '/themes/logement/#c-marie-fictive');
      const climat = section(arbre, 'climat');
      assert.equal(trouver(climat, (n) => aClasse(n, 'mesure')).length, 0);
      const vide = trouver(climat, (n) => aClasse(n, 'vide'))[0] as Noeud;
      assert.match(txt(vide), /^Non précisé dans les sources consultées le 24 octobre 2026\.$/);
      assert.equal(lien(climat, 'Voir tous les candidats sur le thème Climat').attrs.href, '/themes/climat/#c-marie-fictive');
      assert.equal(trouver(arbre, (n) => n.tag === 'section' && n.attrs.id === 'ecole').length, 0, 'thème relu absent en production');
      const ordre = trouver(arbre, (n) => n.tag === 'section' && n.attrs['data-theme'] !== undefined).map((s) => s.attrs.id);
      assert.deepEqual(ordre, ['logement', 'climat']);
    });

    it('Luc : ne se présente pas, avec motif et date', () => {
      const { arbre } = page(production().outDir, 'candidats/luc-retire/index.html');
      const statut = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'statut'))[0] as Noeud;
      assert.ok(txt(statut).startsWith('Ne se présente pas (retrait de la candidature), depuis le 25 octobre 2026. Source : '));
      // Statut relu hors périmètre : la phrase du périmètre est exacte.
      assert.ok(txt(arbre).includes(SANS_MESURE));
      assert.ok(!txt(arbre).includes(STATUT_A_VERIFIER));
    });

    it('chaque page candidat a sa navigation, sa date de mise à jour et un seul h1', () => {
      const { outDir } = production();
      for (const id of IDS) {
        const { arbre, html } = page(outDir, `candidats/${id}/index.html`);
        const liensNav = liens(nav(arbre));
        assert.deepEqual(liensNav.map(txt), ['Thèmes', 'Candidats']);
        assert.deepEqual(
          liensNav.map((l) => l.attrs['aria-current']),
          [undefined, 'page'],
          `${id} : aria-current`,
        );
        assert.match(html, /Dernière mise à jour des contenus de cette page :\s*<time datetime="\d{4}-\d{2}-\d{2}">|Aucun contenu publié pour le moment\./);
      }
      const marie = page(outDir, 'candidats/marie-fictive/index.html').html;
      assert.match(marie, /<time datetime="2026-10-26">26 octobre 2026<\/time>/);
    });
  });

  describe('production : liens croisés depuis la page thème', () => {
    it('nom, « N autres mesures », renonce, liste complète et fil d\'Ariane sont des liens', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      const cartes = trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
      const marie = cartes.find((c) => txt(trouver(c, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud) === 'Marie Fictive') as Noeud;
      const nom = trouver(marie, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud;
      assert.equal(lien(nom, 'Marie Fictive').attrs.href, '/candidats/marie-fictive/#logement');
      assert.equal(lien(marie, /^1 autre mesure/).attrs.href, '/candidats/marie-fictive/#logement');
      const renonce = trouver(arbre, (n) => n.tag === 'details' && aClasse(n, 'renonce'))[0] as Noeud;
      assert.equal(lien(renonce, 'Luc Retiré').attrs.href, '/candidats/luc-retire/');
      // Paul et Nina ne sont plus comptés parmi les autres personnalités (plan 09-15) : aucune autre dans la fixture.
      assert.equal(liens(arbre).filter((a) => txt(a) === 'voir la liste complète des candidats').length, 0);
      const fil = trouver(arbre, (n) => n.tag === 'nav' && n.attrs['aria-label'] === "Fil d'Ariane")[0] as Noeud;
      assert.equal(lien(fil, 'Thèmes').attrs.href, '/themes/');
      assert.equal(lien(fil, 'Accueil').attrs.href, '/');
    });

    it('aria-current sur « Thèmes » pour une page thème', () => {
      const { arbre } = page(production().outDir, 'themes/logement/index.html');
      assert.deepEqual(
        liens(nav(arbre)).map((l) => [txt(l), l.attrs['aria-current']]),
        [
          ['Thèmes', 'page'],
          ['Candidats', undefined],
        ],
      );
    });
  });

  describe('production : index et hall', () => {
    it('/candidats/ : quatre lignes dans l\'ordre du rang, nom, parti, statut', () => {
      const { arbre } = page(production().outDir, 'candidats/index.html');
      assert.equal(txt(trouver(arbre, (n) => n.tag === 'h1')[0] as Noeud), 'Les candidats');
      assert.ok(txt(arbre).includes(INTRO_CANDIDATS));
      const ul = trouver(arbre, (n) => n.tag === 'ul' && n.attrs['data-ordonnable'] !== undefined)[0] as Noeud;
      assert.ok(ul, 'ul[data-ordonnable]');
      const lignes = trouver(ul, (n) => n.tag === 'li' && n.attrs['data-rang'] !== undefined);
      assert.deepEqual(
        lignes.map((l) => l.attrs['data-rang']),
        ['0', '1', '2', '3'],
      );
      assert.deepEqual(
        lignes.map((l) => lien(l, /./).attrs.href),
        IDS.map((id) => `/candidats/${id}/`),
      );
      const elise = lignes[0] as Noeud;
      assert.ok(txt(elise).includes('Parti revendiqué : Mouvement Inventé'));
      assert.ok(txt(elise).includes('Candidature déclarée · 18 octobre 2026'));
      assert.ok(trouver(elise, (n) => n.tag === 'time' && n.attrs.datetime === '2026-10-18').length === 1);
      assert.ok(!txt(ul).includes('Statut en cours de vérification'), 'aucune ligne au statut non relu en production');
      assert.ok(txt(lignes[3] as Noeud).includes('Ne se présente pas · 25 octobre 2026'));
    });

    it('/themes/ : tuiles logement et climat (pas ecole), 3 candidats chacune', () => {
      const { arbre } = page(production().outDir, 'themes/index.html');
      assert.equal(txt(trouver(arbre, (n) => n.tag === 'h1')[0] as Noeud), 'Les thèmes');
      const tuiles = trouver(arbre, (n) => n.tag === 'li' && n.attrs['data-theme'] !== undefined);
      assert.deepEqual(
        tuiles.map((t) => t.attrs['data-theme']),
        ['logement', 'climat'],
      );
      assert.equal(lien(tuiles[0] as Noeud, 'Logement').attrs.href, '/themes/logement/');
      for (const t of tuiles) assert.ok(txt(t).includes('3 candidats'), txt(t));
      assert.deepEqual(
        liens(nav(arbre)).map((l) => l.attrs['aria-current']),
        ['page', undefined],
      );
    });

    it('hall : h1, présentation, quatre niveaux, neutralité, tuiles, lien vers les candidats', () => {
      const { arbre, html } = page(production().outDir, 'index.html');
      assert.equal(txt(trouver(arbre, (n) => n.tag === 'h1')[0] as Noeud), 'Les programmes de la présidentielle 2027, à votre niveau');
      assert.ok(html.includes(`<title>${NOM_SITE} : les programmes de la présidentielle 2027</title>`));
      const t = txt(arbre);
      // Proposition 1 du lot B (09.1) : l'introduction devient une phrase de présentation (texte en brouillon,
      // ordre et contenu vérifiés par tests/dist/cas/accueil.cas.ts).
      assert.equal(trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'hall-presentation')).length, 1);
      const dl = trouver(arbre, (n) => n.tag === 'dl')[0] as Noeud;
      assert.ok(dl, 'dl des niveaux');
      assert.deepEqual(
        trouver(dl, (n) => n.tag === 'dt').map(txt),
        NIVEAUX_HALL.map(([l]) => l),
      );
      assert.deepEqual(
        trouver(dl, (n) => n.tag === 'dd').map(txt),
        NIVEAUX_HALL.map(([, d]) => d),
      );
      assert.ok(t.includes('Quatre niveaux de lecture'));
      // Les deux faits de l'ancien paragraphe de neutralité passent dans les garanties (proposition 1 du lot B).
      assert.match(t, /ordre alphabétique, jamais selon les sondages/);
      assert.match(t, /sans jugement/);
      assert.ok(trouver(arbre, (n) => n.tag === 'h2').some((h) => txt(h) === 'Les thèmes'));
      assert.deepEqual(
        trouver(arbre, (n) => n.tag === 'li' && n.attrs['data-theme'] !== undefined && aClasse(n, 'tuile')).map((x) => x.attrs['data-theme']),
        ['logement', 'climat'],
      );
      assert.equal(lien(arbre, 'Voir tous les candidats').attrs.href, '/candidats/');
      assert.ok(!/Données fictives|à des fins de test/.test(html), 'plus de chaîne du squelette');
    });

    it('chaque page publiée a sa navigation et une date de mise à jour en pied de page', () => {
      const { outDir } = production();
      for (const chemin of ['index.html', 'themes/index.html', 'candidats/index.html', 'themes/logement/index.html']) {
        const { arbre, html } = page(outDir, chemin);
        assert.deepEqual(liens(nav(arbre)).map(txt), ['Thèmes', 'Candidats'], chemin);
        assert.match(html, /Dernière mise à jour des contenus de cette page :\s*<time datetime="2026-10-26">26 octobre 2026<\/time>/, chemin);
      }
    });

    it('checkDist (liens et ancres compris) ne signale aucune erreur', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });

  describe('preview', () => {
    it('le thème relu a sa page et sa section sur la page de Marie', () => {
      const { outDir } = preview();
      assert.ok(fs.existsSync(path.join(outDir, 'themes', 'ecole', 'index.html')));
      const { arbre } = page(outDir, 'candidats/marie-fictive/index.html');
      const ordre = trouver(arbre, (n) => n.tag === 'section' && n.attrs['data-theme'] !== undefined).map((s) => s.attrs.id);
      assert.deepEqual(ordre, ['logement', 'ecole', 'climat']);
      assert.equal(lien(section(arbre, 'ecole'), 'Voir tous les candidats sur le thème École').attrs.href, '/themes/ecole/#c-marie-fictive');
    });

    it('/candidats/ : six lignes, Paul sans étiquette de parti, intro de preview', () => {
      const { arbre } = page(preview().outDir, 'candidats/index.html');
      assert.ok(txt(arbre).includes("Toutes les personnalités du jeu de données, par ordre alphabétique du nom, ou dans un ordre aléatoire si vous le choisissez ci-dessous. Le statut est celui de la dernière source consultée."));
      const lignes = trouver(arbre, (n) => n.tag === 'li' && n.attrs['data-rang'] !== undefined);
      assert.deepEqual(
        lignes.map((l) => lien(l, /./).attrs.href),
        ['elise-erard', 'marie-fictive', 'jean-imaginaire', 'nina-pressentie', 'luc-retire', 'paul-de-villefranche'].map((id) => `/candidats/${id}/`),
      );
      assert.ok(txt(lignes[5] as Noeud).includes('Sans étiquette de parti déclarée'));
      assert.ok(txt(lignes[5] as Noeud).includes('brouillon, non relu'));
    });

    it('Paul : statut déclaré en brouillon avec sa pastille', () => {
      const { arbre } = page(preview().outDir, 'candidats/paul-de-villefranche/index.html');
      const statut = trouver(arbre, (n) => n.tag === 'p' && aClasse(n, 'statut'))[0] as Noeud;
      assert.match(txt(statut), /^Candidature déclarée, depuis le 19 octobre 2026\. Source : Article fictif\./);
      assert.ok(trouver(statut, (n) => n.attrs['data-badge'] !== undefined && txt(n) === 'brouillon, non relu').length === 1);
    });

    it('Nina : statut « pressenti » affiché, phrase du périmètre', () => {
      const { arbre } = page(preview().outDir, 'candidats/nina-pressentie/index.html');
      assert.ok(txt(arbre).includes(SANS_MESURE));
      assert.ok(!txt(arbre).includes(STATUT_A_VERIFIER));
    });

    it('checkDist (liens et ancres compris) ne signale aucune erreur', () => {
      const { outDir } = preview();
      const constats = checkDist(outDir, { mode: 'preview', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'preview') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
