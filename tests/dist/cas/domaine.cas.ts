// Domaine paramétré (HEB-05, HEB-06) sur de vraies builds du corpus-m1 : URL canonique de chaque page,
// sitemap.xml et robots.txt en production, rien de tout cela en preview, et build de déploiement refusée
// tant que le domaine de config/site.yml est provisoire (.invalid). Le domaine attendu est toujours lu par
// loadSiteConfig(ctx.repoRoot), jamais écrit ici (07-06 refuse les noms d'hôte du site en dur).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, trouver } from '../../../scripts/lib/html.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

/** `index.html` → `/`, `x/y/index.html` → `/x/y/` (trailingSlash 'always', aucune autre page HTML). */
function cheminDePage(outDir: string, fichier: string): string {
  const rel = path.relative(outDir, fichier).split(path.sep).join('/');
  assert.ok(rel === 'index.html' || rel.endsWith('/index.html'), `page HTML inattendue : ${rel}`);
  return `/${rel.slice(0, -'index.html'.length)}`;
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
      for (const f of pages) {
        const liens = canoniques(fs.readFileSync(f, 'utf8'));
        const chemin = cheminDePage(outDir, f);
        assert.equal(liens.length, 1, `${chemin} : ${liens.length} lien(s) canonique(s)`);
        assert.equal(liens[0], `${origine}${chemin}`, chemin);
      }
    });

    it('HEB-05 : production, sitemap.xml liste exactement les pages construites (ensemble des <loc> = ensemble des canoniques)', () => {
      const { outDir } = build('production');
      const attendues = ctx.pagesHtml(outDir).map((f) => canoniques(fs.readFileSync(f, 'utf8'))[0]);
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

  describe('déploiement', () => {
    it('HEB-06 : RTP_DEPLOIEMENT=1, la build refuse un domaine provisoire (.invalid) en nommant config/site.yml', () => {
      // Échec au chargement de astro.config.mjs, avant tout rendu : le cache .astro des autres builds n'est pas touché.
      const b = ctx.construire('m1-deploiement', { racine, mode: 'production', env: { RTP_DEPLOIEMENT: '1' } });
      if (site.domaineProvisoire) {
        assert.notEqual(b.status, 0, `la build de déploiement aurait dû échouer :\n${b.output.slice(-2000)}`);
        assert.match(b.output, /config\/site\.yml/);
        assert.match(b.output, /domaine provisoire \(\.invalid\)/);
        assert.equal(fs.existsSync(path.join(b.outDir, 'index.html')), false, 'une page a été écrite malgré le refus');
      } else {
        // Domaine acheté : la garde du domaine ne mord plus (le contact ou l'hébergeur peuvent encore refuser).
        assert.doesNotMatch(b.output, /domaine provisoire/);
      }
    });
  });
}
