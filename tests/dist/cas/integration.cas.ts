// Intégration des tranches (QUAL-01, M1-02, M1-09) : les mêmes pages du corpus fictif corpus-m1 portent
// ensemble le sélecteur de niveau, le bloc Gros caractères, les définitions enfant, le contrôle d'ordre,
// la date de mise à jour, et passent le contrôle post-build. Réutilise les builds « m1-production » et « m1-preview ».
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { PAGE_ERREUR, cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const elements = (n: Noeud): Noeud[] => n.enfants.filter((e): e is Noeud => typeof e !== 'string');

export default function integration(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-integration'));

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
  const page = (chemin: string): Noeud => analyserHtml(ctx.lire(production().outDir, chemin));
  const ordreControle = (arbre: Noeud): Noeud[] =>
    trouver(arbre, (n) => n.attrs['data-ordre-controle'] !== undefined && n.attrs.hidden !== undefined);

  describe('intégration : page candidat', () => {
    const arbre = () => page('candidats/marie-fictive/index.html');

    it('sélecteur de niveau suivi du script niveau', () => {
      const a = arbre();
      const f = trouver(a, (n) => n.tag === 'fieldset' && aClasse(n, 'niveaux') && n.attrs.id === 'niveaux');
      assert.equal(f.length, 1, 'fieldset.niveaux#niveaux');
      // ADR-056 : le script de niveau est en ligne, juste après </fieldset>, identique à sa source.
      const f0 = f[0] as Noeud;
      const freres = elements(f0.parent as Noeud);
      const suivant = freres[freres.indexOf(f0) + 1] as Noeud;
      assert.equal(suivant?.tag, 'script', 'un <script> suit </fieldset>');
      assert.deepEqual(Object.keys(suivant.attrs), [], 'script sans attribut');
      assert.equal(texte(suivant), fs.readFileSync(path.join(ctx.repoRoot, 'src', 'scripts', 'niveau.js'), 'utf8'), 'corps identique à src/scripts/niveau.js');
    });

    it('« Ce qui me concerne » en premier dans .lecteur-contenu, un seul lien vers #logement', () => {
      const contenu = trouver(arbre(), (n) => aClasse(n, 'lecteur-contenu'))[0] as Noeud;
      const premier = elements(contenu)[0] as Noeud;
      assert.equal(premier.tag, 'section');
      assert.ok(aClasse(premier, 'concerne-aine'));
      const liens = trouver(premier, (n) => n.tag === 'a');
      assert.equal(liens.length, 1);
      assert.equal((liens[0] as Noeud).attrs.href, '#logement');
    });

    it('définitions enfant et liste « Mots expliqués (2) » dans la section logement', () => {
      const a = arbre();
      const logement = trouver(a, (n) => n.tag === 'section' && n.attrs.id === 'logement')[0] as Noeud;
      assert.ok(logement, 'section #logement');
      const pop = trouver(logement, (n) => n.tag === 'button' && n.attrs.popovertarget === 'def-m-marie-fictive-aide-construction-1');
      assert.equal(pop.length, 1, 'bouton du premier terme de la mesure');
      const resume = trouver(a, (n) => n.tag === 'summary').map((n) => norm(texte(n)));
      assert.ok(resume.includes('Mots expliqués (2)'), resume.join(' | '));
    });
  });

  describe('intégration : contrôle d’ordre et hall', () => {
    it('/candidats/ et /themes/logement/ : contrôle d’ordre caché', () => {
      assert.equal(ordreControle(page('candidats/index.html')).length, 1);
      assert.equal(ordreControle(page('themes/logement/index.html')).length, 1);
    });

    it('hall : sélecteur de niveau, pas de bloc Gros caractères', () => {
      const a = page('index.html');
      assert.equal(trouver(a, (n) => n.tag === 'fieldset' && aClasse(n, 'niveaux')).length, 1);
      assert.equal(trouver(a, (n) => aClasse(n, 'concerne-aine')).length, 0);
    });

    it('pages thème : une cellule contient au plus une mesure (M1-08)', () => {
      const { outDir } = production();
      for (const f of ctx.pagesHtml(outDir).filter((p) => p.includes(`${path.sep}themes${path.sep}`))) {
        const a = analyserHtml(fs.readFileSync(f, 'utf8'));
        for (const c of trouver(a, (n) => n.tag === 'li' && aClasse(n, 'cellule'))) {
          const n = trouver(c, (x) => x.tag === 'article' && aClasse(x, 'mesure')).length;
          assert.ok(n <= 1, `${path.relative(outDir, f)} : ${n} mesures dans une cellule`);
        }
      }
    });
  });

  for (const mode of ['production', 'preview'] as const) {
    describe(`intégration : toutes les pages (${mode})`, () => {
      const outDir = () => (mode === 'production' ? production() : preview()).outDir;

      it('un h1, lang="fr", date de mise à jour dans le pied de page', () => {
        const pages = ctx.pagesHtml(outDir());
        assert.ok(pages.length > 10);
        for (const f of pages) {
          const rel = path.relative(outDir(), f);
          const a = analyserHtml(fs.readFileSync(f, 'utf8'));
          const html = trouver(a, (n) => n.tag === 'html')[0] as Noeud;
          assert.equal(html.attrs.lang, 'fr', rel);
          assert.equal(trouver(a, (n) => n.tag === 'h1').length, 1, `${rel} : un seul h1`);
          const maj = trouver(a, (n) => n.attrs['data-mise-a-jour'] !== undefined);
          assert.equal(maj.length, 1, `${rel} : [data-mise-a-jour]`);
          const t = trouver(maj[0] as Noeud, (n) => n.tag === 'time' && /^\d{4}-\d{2}-\d{2}/.test(n.attrs.datetime ?? ''));
          // Une page sans aucune mesure publiée n'a pas de date à afficher : Base.astro le dit explicitement.
          if (norm(texte(maj[0] as Noeud)) === 'Aucun contenu publié pour le moment.') assert.equal(t.length, 0, rel);
          else assert.equal(t.length, 1, `${rel} : <time datetime> de mise à jour`);
        }
      });

      it(mode === 'production' ? 'aucune page noindex, sauf la page d\'erreur 404.html qui l\'a' : 'bandeau de prévisualisation sur chaque page', () => {
        let erreurVue = 0;
        for (const f of ctx.pagesHtml(outDir())) {
          const a = analyserHtml(fs.readFileSync(f, 'utf8'));
          const rel = path.relative(outDir(), f);
          if (mode === 'production') {
            const ni = trouver(a, (n) => n.tag === 'meta' && /noindex/i.test(n.attrs.content ?? ''));
            // Seule exception, un fichier nommé : la page d'erreur ne doit jamais être indexée (plan 09.1-02).
            if (rel.split(path.sep).join('/') === PAGE_ERREUR) {
              erreurVue += 1;
              assert.equal(ni.length, 1, `${rel} : noindex attendu sur la page d'erreur`);
              continue;
            }
            assert.equal(ni.length, 0, `${rel} noindex en production`);
          } else {
            assert.equal(trouver(a, (n) => aClasse(n, 'banniere-preview')).length, 1, `${rel} : bandeau`);
          }
        }
        if (mode === 'production') assert.equal(erreurVue, 1, `${PAGE_ERREUR} absent du dist de production`);
      });

      it('checkDist ne signale aucune erreur', () => {
        const constats = checkDist(outDir(), { mode, cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode) });
        const erreurs = constats.filter((c) => c.severite === 'erreur');
        assert.deepEqual(erreurs, [], erreurs.map((c) => `${c.code} ${c.fichier} : ${c.message}`).join('\n'));
      });
    });
  }

  describe('diagnostic : pages les plus lourdes', () => {
    it('affiche les 3 pages les plus lourdes (HTML seul, qui contient CSS et scripts)', () => {
      // ADR-056 : CSS et scripts sont dans la page, rien d'externe n'est chargé ; le HTML est donc tout le poids
      // de la page (check-dist POIDS_BRUT / POIDS_GZIP applique le budget, ce cas ne fait qu'afficher).
      const { outDir } = production();
      const lourdes = ctx
        .pagesHtml(outDir)
        .map((f) => {
          const octets = fs.readFileSync(f);
          return { page: path.relative(outDir, f), brut: octets.length, gzip: zlib.gzipSync(octets).length };
        })
        .sort((a, b) => b.gzip - a.gzip)
        .slice(0, 3);
      for (const l of lourdes) console.log(`# poids ${l.page} : ${l.brut} octets bruts, ${l.gzip} octets gzip`);
      assert.equal(lourdes.length, 3);
    });
  });
}
