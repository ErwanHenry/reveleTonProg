// Balises de partage (FIN-02, plan 09.1-04) : Open Graph, carte Twitter et theme-color sur chaque page, og:url seulement
// en production et sur les pages qui ont une URL canonique, égale à celle-ci (domaine de config/site.yml, lu par
// loadSiteConfig, jamais écrit ici). Image de partage (proposition 6, 09.1-08) : og:image seulement en production,
// hors page d'erreur, cité par ces seules balises.
// Réutilise les builds « m1-production » et « m1-preview » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cellulesAttendues, checkDist, PAGE_ERREUR } from '../../../scripts/lib/check-dist.ts';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { NOM_SITE } from '../../../src/lib/identite.ts';
import { ALT_PARTAGE, FICHIER_PARTAGE, HAUTEUR_PARTAGE, LARGEUR_PARTAGE } from '../../../src/lib/partage.ts';
import { loadSiteConfig } from '../../../src/lib/site-config.ts';
import { materialiserCorpusM1 } from '../../helpers/corpus-m1.ts';
import type { ContexteSite } from '../contexte.ts';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

export default function partage(ctx: ContexteSite): void {
  const racine = materialiserCorpusM1(path.join(ctx.tmp(), 'corpus-m1-partage'));
  const site = loadSiteConfig(ctx.repoRoot, {});
  const origine = `https://${site.domaine}`;
  // Couleur de la barre du navigateur = --fond de base.css, lue dans la feuille (jamais recopiée).
  const fond = /--fond:\s*(#[0-9A-Fa-f]{6})\s*;/.exec(fs.readFileSync(path.join(ctx.repoRoot, 'src', 'styles', 'base.css'), 'utf8'))?.[1];
  assert.ok(fond, '--fond introuvable dans src/styles/base.css');

  const build = (mode: 'production' | 'preview') => {
    const b = ctx.construire(`m1-${mode}`, { racine, mode });
    assert.equal(b.status, 0, `astro build (${mode}) a échoué :\n${b.output}`);
    return b.outDir;
  };
  const rel = (outDir: string, f: string): string => path.relative(outDir, f).split(path.sep).join('/');
  const meta = (a: Noeud, cle: 'property' | 'name', valeur: string): Noeud[] =>
    trouver(a, (n) => n.tag === 'meta' && n.attrs[cle] === valeur);
  const canonique = (a: Noeud): string[] =>
    trouver(a, (n) => n.tag === 'link' && (n.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')).map((n) => n.attrs.href ?? '');

  for (const mode of ['production', 'preview'] as const) {
    describe(`partage 09.1 : balises (${mode})`, () => {
      it('chaque page : og:type, og:site_name, og:title, og:description, og:locale, twitter:card, theme-color, une fois chacun', () => {
        const outDir = build(mode);
        const pages = ctx.pagesHtml(outDir);
        assert.ok(pages.length > 5, `trop peu de pages : ${pages.length}`);
        for (const f of pages) {
          const r = rel(outDir, f);
          const a = analyserHtml(fs.readFileSync(f, 'utf8'));
          const un = (cle: 'property' | 'name', valeur: string): string => {
            const l = meta(a, cle, valeur);
            assert.equal(l.length, 1, `${r} : ${l.length} balise(s) ${valeur}`);
            return (l[0] as Noeud).attrs.content ?? '';
          };
          const titre = norm(texte(trouver(a, (n) => n.tag === 'title')[0] as Noeud));
          const description = meta(a, 'name', 'description')[0]?.attrs.content ?? '';
          assert.equal(un('property', 'og:type'), 'website', r);
          assert.equal(un('property', 'og:site_name'), NOM_SITE, r);
          assert.equal(un('property', 'og:title'), titre, r);
          assert.equal(un('property', 'og:description'), description, r);
          assert.equal(un('property', 'og:locale'), 'fr_FR', r);
          assert.equal(un('name', 'twitter:card'), mode === 'production' && r !== PAGE_ERREUR ? 'summary_large_image' : 'summary', r);
          assert.equal(un('name', 'theme-color'), fond, r);
        }
      });
    });
  }

  describe('partage 09.1 : balises, og:url', () => {
    it('production : chaque page sauf la page d\'erreur a exactement un og:url égal à son URL canonique', () => {
      const outDir = build('production');
      for (const f of ctx.pagesHtml(outDir)) {
        const r = rel(outDir, f);
        if (r === PAGE_ERREUR) continue;
        const a = analyserHtml(fs.readFileSync(f, 'utf8'));
        const urls = meta(a, 'property', 'og:url').map((n) => n.attrs.content);
        assert.deepEqual(urls, canonique(a), r);
        assert.equal(urls.length, 1, r);
        assert.ok(urls[0]?.startsWith(`${origine}/`), r);
      }
    });

    it('production : 404.html n\'a pas d\'og:url', () => {
      const outDir = build('production');
      const a = analyserHtml(fs.readFileSync(path.join(outDir, PAGE_ERREUR), 'utf8'));
      assert.equal(meta(a, 'property', 'og:url').length, 0);
    });

    it('préversion : aucun og:url, et aucune balise og: ni twitter: ne nomme le domaine configuré', () => {
      const outDir = build('preview');
      for (const f of ctx.pagesHtml(outDir)) {
        const html = fs.readFileSync(f, 'utf8');
        const a = analyserHtml(html);
        assert.equal(meta(a, 'property', 'og:url').length, 0, rel(outDir, f));
        const tags = trouver(a, (n) => n.tag === 'meta' && /^(og:|twitter:)/.test(n.attrs.property ?? n.attrs.name ?? ''));
        for (const t of tags) assert.ok(!(t.attrs.content ?? '').includes(site.domaine), `${rel(outDir, f)} : ${t.attrs.property ?? t.attrs.name}`);
      }
    });
  });

  describe('partage 09.1 : image', () => {
    const chaque = (outDir: string, f: (r: string, a: Noeud) => void): void => {
      for (const file of ctx.pagesHtml(outDir)) f(rel(outDir, file), analyserHtml(fs.readFileSync(file, 'utf8')));
    };

    it('production : chaque page sauf 404.html porte og:image (URL absolue du domaine configuré), largeur, hauteur, alt, et twitter:card summary_large_image', () => {
      const outDir = build('production');
      assert.ok(fs.existsSync(path.join(outDir, FICHIER_PARTAGE)), 'partage.png absent du dist (public/partage.png)');
      let n = 0;
      chaque(outDir, (r, a) => {
        if (r === PAGE_ERREUR) return;
        n++;
        const une = (cle: string): string => {
          const l = meta(a, 'property', cle);
          assert.equal(l.length, 1, `${r} : ${l.length} balise(s) ${cle}`);
          return (l[0] as Noeud).attrs.content ?? '';
        };
        assert.equal(une('og:image'), `${origine}/${FICHIER_PARTAGE}`, r);
        assert.equal(une('og:image:width'), String(LARGEUR_PARTAGE), r);
        assert.equal(une('og:image:height'), String(HAUTEUR_PARTAGE), r);
        assert.equal(une('og:image:alt'), ALT_PARTAGE, r);
        assert.equal(meta(a, 'name', 'twitter:card')[0]?.attrs.content, 'summary_large_image', r);
      });
      assert.ok(n > 5, `trop peu de pages : ${n}`);
    });

    it('production : 404.html et préversion : aucune balise d\'image, twitter:card summary', () => {
      const prod = build('production');
      const a404 = analyserHtml(fs.readFileSync(path.join(prod, PAGE_ERREUR), 'utf8'));
      const images = (a: Noeud): Noeud[] => trouver(a, (x) => x.tag === 'meta' && /^(og:image|twitter:image)/.test(x.attrs.property ?? x.attrs.name ?? ''));
      assert.equal(images(a404).length, 0);
      assert.equal(meta(a404, 'name', 'twitter:card')[0]?.attrs.content, 'summary');
      const prev = build('preview');
      chaque(prev, (r, a) => {
        assert.equal(images(a).length, 0, r);
        assert.equal(meta(a, 'name', 'twitter:card')[0]?.attrs.content, 'summary', r);
      });
    });

    it('production : partage.png est cité par og:image seulement (aucun img, srcset, link ni url() ne le charge)', () => {
      const outDir = build('production');
      chaque(outDir, (r, a) => {
        const html = fs.readFileSync(path.join(outDir, r), 'utf8');
        const refs = html.match(/partage\.png/g) ?? [];
        const dansMeta = meta(a, 'property', 'og:image').length;
        assert.equal(refs.length, dansMeta, `${r} : partage.png cité hors d'og:image`);
        assert.equal(trouver(a, (x) => (x.tag === 'img' || x.tag === 'link') && /partage\.png/.test(x.attrs.src ?? x.attrs.href ?? '')).length, 0, r);
      });
    });

    it('checkDist avec le domaine : aucune erreur ni PARTAGE_INCORRECT, en production et en préversion', () => {
      for (const mode of ['production', 'preview'] as const) {
        const outDir = build(mode);
        const constats = checkDist(outDir, { mode, cellulesParTheme: cellulesAttendues(racine, ctx.repoRoot, mode), domaine: site.domaine, typesAutorises: ['.html', '.txt', '.xml', '.json', '.ico', '.png'] });
        assert.deepEqual(constats.filter((c) => c.code === 'PARTAGE_INCORRECT'), [], mode);
        assert.deepEqual(constats.filter((c) => c.severite === 'erreur').map((c) => `${c.code} ${c.fichier}`), [], mode);
      }
    });
  });
}
