// Page 404 en français (FIN-01, D-05, plan 09.1-02) : dist/404.html à la racine, dans la mise en page du site,
// noindex, sans URL canonique ni entrée de sitemap, acceptée par checkDist dans les deux modes. C'est aussi la page
// qu'obtient une personne non relue en production (filtre du plan 09-15 : aucun dossier, donc 404 côté serveur).
// Réutilise les builds « m1-production » et « m1-preview » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, aClasse, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { PAGE_ERREUR, candidatsNonRelus, cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import { NOM_SITE } from '../../../src/lib/identite.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const txt = (n: Noeud): string => norm(texte(n));

const PARAGRAPHE = "Cette adresse ne correspond à aucune page du site. La page a peut-être changé d'adresse, ou elle n'est pas encore publiée.";
const LIENS = [
  ['/', "Revenir à l'accueil"],
  ['/themes/', 'Voir les thèmes'],
  ['/candidats/', 'Voir la liste des candidats'],
];

export default function introuvable(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-introuvable'));
  const build = (mode: 'production' | 'preview') => {
    const b = ctx.construire(`m1-${mode}`, { racine, mode });
    assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
    return b.outDir;
  };
  const page = (outDir: string): Noeud => {
    const f = path.join(outDir, PAGE_ERREUR);
    assert.ok(fs.existsSync(f), `${PAGE_ERREUR} absent du dist`);
    return analyserHtml(fs.readFileSync(f, 'utf8'));
  };
  const robots = (a: Noeud): Noeud[] =>
    trouver(a, (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(n.attrs.content ?? ''));
  const canoniques = (a: Noeud): Noeud[] =>
    trouver(a, (n) => n.tag === 'link' && (n.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'));

  for (const mode of ['production', 'preview'] as const) {
    describe(`introuvable 404 : page d'erreur en français (${mode})`, () => {
      it('dist/404.html existe à la racine, et aucun dossier 404/', () => {
        const outDir = build(mode);
        assert.ok(fs.statSync(path.join(outDir, PAGE_ERREUR)).isFile());
        assert.equal(fs.existsSync(path.join(outDir, '404', 'index.html')), false, '404/index.html écrit');
      });

      it('lang="fr", titre, un seul h1 « Page introuvable », en-tête et pied de page du site', () => {
        const a = page(build(mode));
        assert.equal((trouver(a, (n) => n.tag === 'html')[0] as Noeud).attrs.lang, 'fr');
        assert.deepEqual(trouver(a, (n) => n.tag === 'title').map(txt), [`Page introuvable : ${NOM_SITE}`]);
        assert.deepEqual(trouver(a, (n) => n.tag === 'h1').map(txt), ['Page introuvable']);
        assert.equal(trouver(a, (n) => n.tag === 'header' && aClasse(n, 'entete')).length, 1, 'en-tête du site');
        assert.equal(trouver(a, (n) => n.tag === 'nav' && n.attrs['aria-label'] === 'Navigation principale').length, 1, 'navigation');
        assert.equal(trouver(a, (n) => n.tag === 'footer' && aClasse(n, 'pied')).length, 1, 'pied de page');
        assert.equal(trouver(a, (n) => n.tag === 'main' && n.attrs.id === 'contenu').length, 1, 'main#contenu');
      });

      // IN-09 (revue 09.1) : la page 404 n'a pas de contenu daté ; son pied ne dit pas « Dernière mise à jour des contenus
      // de cette page », et garde ses autres lignes (liens institutionnels, cookie, tours).
      it('pied de page sans ligne de mise à jour des contenus, autres lignes présentes', () => {
        const a = page(build(mode));
        const pied = trouver(a, (n) => n.tag === 'footer' && aClasse(n, 'pied'))[0] as Noeud;
        assert.equal(trouver(a, (n) => n.attrs['data-mise-a-jour'] !== undefined).length, 0, '[data-mise-a-jour] sur la page 404');
        assert.doesNotMatch(txt(pied), /Dernière mise à jour des contenus|Aucun contenu publié/);
        assert.match(txt(pied), /n'utilise aucun cookie/);
        assert.match(txt(pied), /premier tour le dimanche/);
        assert.equal(trouver(pied, (n) => n.tag === 'a' && n.attrs.href === '/mentions-legales/').length, 1);
      });

      it('paragraphe d\'explication et liste de trois liens : accueil, thèmes, candidats ; aucun sélecteur de niveau', () => {
        const a = page(build(mode));
        const main = trouver(a, (n) => n.tag === 'main')[0] as Noeud;
        assert.ok(trouver(main, (n) => n.tag === 'p').map(txt).includes(PARAGRAPHE), 'paragraphe d\'explication');
        const listes = trouver(main, (n) => n.tag === 'ul');
        assert.equal(listes.length, 1, 'une liste de liens');
        const liens = trouver(listes[0] as Noeud, (n) => n.tag === 'a').map((n) => [n.attrs.href, txt(n)]);
        assert.deepEqual(liens, LIENS);
        for (const li of trouver(listes[0] as Noeud, (n) => n.tag === 'li')) {
          assert.equal(trouver(li, (n) => aClasse(n, 'section-lien')).length, 1, 'cible de 44 px (.section-lien)');
        }
        assert.equal(trouver(a, (n) => aClasse(n, 'niveaux')).length, 0, 'sélecteur de niveau');
      });

      it(mode === 'production' ? 'production : un seul noindex et aucune URL canonique' : 'preview : un seul noindex (jamais deux), aucune URL canonique', () => {
        const a = page(build(mode));
        assert.equal(robots(a).length, 1);
        assert.equal(trouver(a, (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots').length, 1);
        assert.equal(canoniques(a).length, 0);
      });

      it('checkDist ne signale aucune erreur sur 404.html', () => {
        const outDir = build(mode);
        const constats = checkDist(outDir, {
          mode,
          cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode),
          ...(mode === 'production' ? { candidatsNonRelus: [...candidatsNonRelus(racine, ctx.repoRoot)] } : {}),
        });
        const erreurs = constats.filter((c) => c.severite === 'erreur').map((c) => `${c.code} ${c.fichier} : ${c.message}`);
        assert.deepEqual(erreurs, []);
      });
    });
  }

  describe('introuvable 404 : sitemap', () => {
    it('sitemap.xml de production ne liste pas la page 404', () => {
      const xml = ctx.lire(build('production'), 'sitemap.xml');
      assert.doesNotMatch(xml, /404\.html|\/404\//);
    });
  });
}
