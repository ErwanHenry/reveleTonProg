// Séparation preview / production côté visiteur (M1-11) : pastilles, bandeau, noindex, robots.txt.
// Deux builds du corpus-m1 (clés partagées avec les autres modules de cas : un build par mode et par exécution).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { TRAPPE_BROUILLON, materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const BANNIERE = 'Version de prévisualisation : contenus non relus, ne pas diffuser.';
const BROUILLON = 'brouillon, non relu';
const RELU = 'relu, pas encore publié';

export default function modes(ctx: ContexteSite): void {
  // Racine dédiée dans un dossier temporaire du contexte : nettoyerCorpusM1() supprimerait aussi celles des autres modules de cas.
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1'));

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
  const arbreDe = (fichier: string): Noeud => analyserHtml(fs.readFileSync(fichier, 'utf8'));
  /** La page d'accueil historique n'utilise pas Base : le plan 04-06 la remplace et la contrôle. */
  const estAccueilHistorique = (outDir: string, fichier: string): boolean => path.relative(outDir, fichier) === 'index.html';
  const noindex = (arbre: Noeud): Noeud[] =>
    trouver(arbre, (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(n.attrs.content ?? ''));
  const cellules = (arbre: Noeud): Noeud[] => trouver(arbre, (n) => n.tag === 'li' && aClasse(n, 'cellule'));
  const badges = (n: Noeud): Noeud[] => trouver(n, (x) => x.tag === 'span' && aClasse(x, 'badge') && x.attrs['data-badge'] !== undefined);

  describe('preview', () => {
    it('noindex sur toutes les pages', () => {
      const { outDir } = preview();
      const pages = ctx.pagesHtml(outDir);
      assert.ok(pages.length >= 3);
      for (const f of pages) assert.equal(noindex(arbreDe(f)).length, 1, `${path.relative(outDir, f)} sans noindex`);
    });

    it('bandeau de prévisualisation sur toutes les pages rendues par Base', () => {
      const { outDir } = preview();
      const pages = ctx.pagesHtml(outDir).filter((f) => !estAccueilHistorique(outDir, f));
      assert.ok(pages.length >= 3);
      for (const f of pages) {
        const bandeaux = trouver(arbreDe(f), (n) => n.tag === 'div' && aClasse(n, 'banniere-preview'));
        assert.equal(bandeaux.length, 1, `${path.relative(outDir, f)} : un bandeau attendu`);
        assert.equal(norm(texte(bandeaux[0] as Noeud)), BANNIERE);
      }
    });

    it('robots.txt interdit tout', () => {
      const robots = ctx.lire(preview().outDir, 'robots.txt');
      assert.match(robots, /^User-agent: \*$/m);
      assert.match(robots, /^Disallow: \/$/m);
    });

    it('la mesure en brouillon d’Élise porte la pastille texte dans sa rangée de titre', () => {
      const arbre = arbreDe(path.join(preview().outDir, 'themes', 'logement', 'index.html'));
      const elise = cellules(arbre).find((c) => norm(texte(trouver(c, (n) => aClasse(n, 'cellule-nom'))[0] as Noeud)) === 'Élise Érard');
      assert.ok(elise, 'carte d’Élise');
      const mesure = trouver(elise, (n) => n.tag === 'article' && aClasse(n, 'mesure'))[0];
      assert.ok(mesure, 'mesure en brouillon visible en preview');
      assert.equal(mesure.attrs['data-statut-relecture'], 'brouillon');
      assert.ok(norm(texte(mesure)).includes(TRAPPE_BROUILLON));
      const entete = trouver(mesure, (n) => aClasse(n, 'mesure-entete'))[0] as Noeud;
      assert.ok(entete, 'rangée de titre .mesure-entete');
      const b = badges(entete);
      assert.equal(b.length, 1);
      assert.equal(norm(texte(b[0] as Noeud)), BROUILLON);
      assert.ok(trouver(entete, (n) => aClasse(n, 'mesure-titre')).length === 1, 'le titre est dans la même rangée');
    });

    it('le thème relu affiche « relu, pas encore publié » à côté du h1 ; ses cases non vérifiées la pastille brouillon', () => {
      const arbre = arbreDe(path.join(preview().outDir, 'themes', 'ecole', 'index.html'));
      const h1 = trouver(arbre, (n) => n.tag === 'h1')[0] as Noeud;
      assert.ok(!norm(texte(h1)).includes(RELU), 'la pastille n’entre pas dans le texte du h1');
      const entete = trouver(arbre, (n) => aClasse(n, 'theme-entete'))[0] as Noeud;
      assert.ok(entete, 'rangée .theme-entete');
      assert.ok(trouver(entete, (n) => n.tag === 'h1').length === 1);
      assert.deepEqual(badges(entete).map((b) => norm(texte(b))), [RELU]);
      const cs = cellules(arbre);
      assert.equal(cs.length, 4);
      for (const c of cs) {
        const vide = trouver(c, (n) => aClasse(n, 'vide'))[0] as Noeud;
        assert.equal(vide.attrs['data-etat'], 'non_verifie');
        assert.deepEqual(badges(vide).map((b) => norm(texte(b))), [BROUILLON]);
      }
    });

    it('checkDist ne signale aucune erreur en preview', () => {
      const { outDir } = preview();
      const constats = checkDist(outDir, { mode: 'preview', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'preview') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });

  describe('production', () => {
    it('aucun fichier du dist ne contient pastille, bandeau ou libellé de preview', () => {
      const { outDir } = production();
      const interdits = [BROUILLON, RELU, 'prévisualisation', 'data-badge', 'banniere-preview'];
      for (const f of ctx.fichiers(outDir)) {
        const contenu = fs.readFileSync(f, 'utf8');
        for (const s of interdits) assert.ok(!contenu.includes(s), `${path.relative(outDir, f)} contient « ${s} »`);
      }
    });

    it('aucune page rendue par Base n’est noindex', () => {
      const { outDir } = production();
      const pages = ctx.pagesHtml(outDir).filter((f) => !estAccueilHistorique(outDir, f));
      assert.ok(pages.length >= 2);
      for (const f of pages) assert.equal(noindex(arbreDe(f)).length, 0, `${path.relative(outDir, f)} est noindex en production`);
    });

    it('robots.txt autorise l’indexation', () => {
      const robots = ctx.lire(production().outDir, 'robots.txt');
      assert.match(robots, /^User-agent: \*$/m);
      assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'pas de Disallow: / en production');
    });

    it('checkDist ne signale aucune erreur en production', () => {
      const { outDir } = production();
      const constats = checkDist(outDir, { mode: 'production', cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, 'production') });
      const erreurs = constats.filter((c) => c.severite === 'erreur');
      assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
    });
  });
}
