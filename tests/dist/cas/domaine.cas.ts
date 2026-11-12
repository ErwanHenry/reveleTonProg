// Domaine paramétré (HEB-05, HEB-06) sur de vraies builds du corpus-m1 : URL canonique de chaque page,
// sitemap.xml et robots.txt en production, rien de tout cela en preview, et build de déploiement refusée
// tant que le domaine de config/site.yml est provisoire (.invalid). Le domaine attendu est toujours lu par
// loadSiteConfig(ctx.repoRoot), jamais écrit ici (07-06 refuse les noms d'hôte du site en dur).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_ERREUR, cellulesAttendues, checkDist } from '../../../scripts/lib/check-dist.ts';
import type { Constat } from '../../../scripts/lib/check-dist.ts';
import { analyserHtml, trouver } from '../../../scripts/lib/html.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

/** `index.html` → `/`, `x/y/index.html` → `/x/y/` (trailingSlash 'always') ; seule autre page HTML admise : la page
 * d'erreur `404.html` à la racine (PAGE_ERREUR, plan 09.1-02), rendue telle quelle (`/404.html`). */
function cheminDePage(outDir: string, fichier: string): string {
  const rel = path.relative(outDir, fichier).split(path.sep).join('/');
  if (rel === PAGE_ERREUR) return `/${rel}`;
  assert.ok(rel === 'index.html' || rel.endsWith('/index.html'), `page HTML inattendue : ${rel}`);
  return `/${rel.slice(0, -'index.html'.length)}`;
}

/** La page d'erreur, exclue des canoniques et du sitemap (IN-07) : on vérifie ici qu'elle n'a pas d'URL canonique. */
function estPageErreur(outDir: string, fichier: string): boolean {
  return path.relative(outDir, fichier).split(path.sep).join('/') === PAGE_ERREUR;
}

function canoniques(html: string): string[] {
  return trouver(analyserHtml(html), (n) => n.tag === 'link' && (n.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')).map(
    (n) => n.attrs.href ?? '',
  );
}

export default function domaine(ctx: ContexteSite): void {
  // Racine dédiée dans un dossier temporaire du contexte (nettoyerCorpusM1() supprimerait celles des autres modules).
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-domaine'));
  // Env vide : on lit la valeur configurée, sans évaluer la garde de déploiement dans le processus de test
  // (un RTP_DEPLOIEMENT=1 exporté par le développeur ne doit pas empêcher de déclarer ces cas).
  const site = loadSiteConfig(ctx.repoRoot, {});
  const origine = `https://${site.domaine}`;
  const build = (mode: 'production' | 'preview') => {
    const b = ctx.construire(`m1-${mode}`, { racine, mode });
    assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
    return b;
  };

  describe('production', () => {
    it('HEB-05 : production, chaque page a exactement une URL canonique égale à https://<domaine> + son chemin', () => {
      const { outDir } = build('production');
      const pages = ctx.pagesHtml(outDir);
      assert.ok(pages.length > 5, `trop peu de pages : ${pages.length}`);
      assert.equal(pages.filter((f) => estPageErreur(outDir, f)).length, 1, `${PAGE_ERREUR} absent du dist`);
      for (const f of pages) {
        const liens = canoniques(fs.readFileSync(f, 'utf8'));
        const chemin = cheminDePage(outDir, f);
        if (estPageErreur(outDir, f)) {
          assert.deepEqual(liens, [], `${PAGE_ERREUR} : aucune URL canonique attendue (IN-07)`);
          continue;
        }
        assert.equal(liens.length, 1, `${chemin} : ${liens.length} lien(s) canonique(s)`);
        assert.equal(liens[0], `${origine}${chemin}`, chemin);
      }
    });

    it('HEB-05 : production, sitemap.xml liste exactement les pages construites (ensemble des <loc> = ensemble des canoniques)', () => {
      const { outDir } = build('production');
      const pages = ctx.pagesHtml(outDir);
      const erreur = pages.filter((f) => estPageErreur(outDir, f));
      assert.equal(erreur.length, 1, `${PAGE_ERREUR} absent du dist`);
      assert.deepEqual(canoniques(fs.readFileSync(erreur[0] as string, 'utf8')), [], `${PAGE_ERREUR} : aucune URL canonique (IN-07)`);
      const attendues = pages.filter((f) => !estPageErreur(outDir, f)).map((f) => canoniques(fs.readFileSync(f, 'utf8'))[0]);
      const xml = ctx.lire(outDir, 'sitemap.xml');
      assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), xml.slice(0, 80));
      assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
      const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
      assert.equal(new Set(locs).size, locs.length, 'doublon dans sitemap.xml');
      assert.deepEqual([...locs].sort(), [...attendues].sort());
      for (const loc of locs) assert.ok(loc?.startsWith(`${origine}/`), loc);
    });

    it('HEB-05 : production, robots.txt permet tout et finit par « Sitemap: https://<domaine>/sitemap.xml »', () => {
      const { outDir } = build('production');
      const robots = ctx.lire(outDir, 'robots.txt');
      assert.match(robots, /^Allow: \/$/m);
      assert.doesNotMatch(robots, /^Disallow:/m);
      assert.ok(robots.endsWith(`\nSitemap: ${origine}/sitemap.xml\n`), robots);
    });
  });

  describe('preview', () => {
    it('HEB-05 : preview, aucune URL canonique, noindex gardé sur chaque page', () => {
      const { outDir } = build('preview');
      for (const f of ctx.pagesHtml(outDir)) {
        const html = fs.readFileSync(f, 'utf8');
        const chemin = cheminDePage(outDir, f);
        assert.doesNotMatch(html, /rel="?canonical/i, chemin);
        const noindex = trouver(
          analyserHtml(html),
          (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(n.attrs.content ?? ''),
        );
        assert.equal(noindex.length, 1, `${chemin} : noindex absent`);
      }
    });

    it('HEB-05 : preview, aucun sitemap.xml et robots.txt « Disallow: / » sans ligne Sitemap', () => {
      const { outDir } = build('preview');
      assert.equal(fs.existsSync(path.join(outDir, 'sitemap.xml')), false, 'sitemap.xml écrit en preview');
      assert.deepEqual(ctx.fichiers(outDir).filter((f) => f.endsWith('.xml')), []);
      const robots = ctx.lire(outDir, 'robots.txt');
      assert.match(robots, /^Disallow: \/$/m);
      assert.doesNotMatch(robots, /Sitemap:/i);
      assert.doesNotMatch(robots, new RegExp(site.domaine.replace(/\./g, '\\.')));
    });
  });

  describe('checkDist avec le domaine configuré', () => {
    const controler = (dist: string, mode: 'production' | 'preview'): Constat[] =>
      checkDist(dist, { mode, cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode), domaine: site.domaine });
    const erreurs = (constats: readonly Constat[]): string[] =>
      constats.filter((c) => c.severite === 'erreur').map((c) => `${c.code} ${c.fichier} : ${c.message}`);

    for (const mode of ['production', 'preview'] as const) {
      it(`HEB-05 : ${mode}, checkDist({ domaine }) ne signale aucune erreur (canonique, sitemap, robots)`, () => {
        const constats = controler(build(mode).outDir, mode);
        assert.deepEqual(erreurs(constats), []);
        // tant que le domaine est provisoire, un seul avertissement de domaine, sur le dist entier
        const provisoires = constats.filter((c) => c.code === 'DOMAINE_PROVISOIRE');
        assert.deepEqual(provisoires.map((c) => [c.fichier, c.severite]), site.domaineProvisoire ? [['.', 'avertissement']] : []);
      });
    }

    /** Copie du dist de production, `muter` appliqué au fichier `rel` (qui doit changer), puis contrôle. */
    const apres = (rel: string, muter: (texte: string) => string): Constat[] => {
      const copie = path.join(ctx.tmp(), 'dist');
      fs.cpSync(build('production').outDir, copie, { recursive: true });
      const fichier = path.join(copie, ...rel.split('/'));
      const avant = fs.readFileSync(fichier, 'utf8');
      const texte = muter(avant);
      assert.notEqual(texte, avant, `faute non injectée dans ${rel}`);
      fs.writeFileSync(fichier, texte);
      return controler(copie, 'production').filter((c) => c.severite === 'erreur');
    };

    it('HEB-05 : copie du dist, une URL canonique modifiée donne CANONIQUE_INCORRECT sur cette page seulement', () => {
      const rel = 'themes/logement/index.html';
      const nouveaux = apres(rel, (html) => html.replace(`href="${origine}/themes/logement/"`, `href="${origine}/themes/autre/"`));
      assert.deepEqual(nouveaux.map((c) => [c.code, c.fichier]), [['CANONIQUE_INCORRECT', rel]]);
    });

    it('HEB-05 : copie du dist, un <loc> retiré de sitemap.xml donne SITEMAP_INCOHERENT', () => {
      // forme écrite par src/lib/sitemap.ts : une ligne « <url><loc>…</loc></url> » par page
      const nouveaux = apres('sitemap.xml', (xml) => xml.replace(`  <url><loc>${origine}/themes/logement/</loc></url>\n`, ''));
      assert.deepEqual(nouveaux.map((c) => [c.code, c.fichier]), [['SITEMAP_INCOHERENT', 'sitemap.xml']]);
      assert.match(nouveaux[0]?.message ?? '', /1 URL canonique\(s\) manquante\(s\)/);
    });
  });

  describe('déploiement', () => {
    it('HEB-06 : RTP_DEPLOIEMENT=1, la build refuse un domaine provisoire (.invalid) en nommant config/site.yml', () => {
      // Échec au chargement de astro.config.mjs, avant tout rendu : le cache .astro des autres builds n'est pas touché.
      const b = ctx.construire('m1-deploiement', { racine, mode: 'production', env: { RTP_DEPLOIEMENT: '1' } });
      if (site.domaineProvisoire) {
        assert.notEqual(b.status, 0, `la build de déploiement aurait dû échouer :\n${b.output.slice(-2000)}`);
        assert.match(b.output, /config\/site\.yml/);
        assert.match(b.output, /domaine provisoire \(TLD réservé : \.invalid/);
        assert.equal(fs.existsSync(path.join(b.outDir, 'index.html')), false, 'une page a été écrite malgré le refus');
      } else {
        // Domaine acheté : la garde du domaine ne mord plus (le contact ou l'hébergeur peuvent encore refuser).
        assert.doesNotMatch(b.output, /domaine provisoire/);
      }
    });
  });
}
