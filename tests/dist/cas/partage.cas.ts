// Balises de partage (FIN-02, plan 09.1-04) : Open Graph, carte Twitter et theme-color sur chaque page, og:url seulement
// en production et sur les pages qui ont une URL canonique, égale à celle-ci (domaine de config/site.yml, lu par
// loadSiteConfig, jamais écrit ici). Pas d'image de partage dans ce plan (proposition 6 du lot B).
// Réutilise les builds « m1-production » et « m1-preview » (aucun build supplémentaire).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_ERREUR } from '../../../scripts/lib/check-dist.ts';
import { analyserHtml, texte, trouver } from '../../../scripts/lib/html.ts';
import type { Noeud } from '../../../scripts/lib/html.ts';
import { NOM_SITE } from '../../../src/lib/identite.ts';
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
          assert.equal(un('name', 'twitter:card'), 'summary', r);
          assert.equal(un('name', 'theme-color'), fond, r);
        }
      });

      it('aucune image de partage pour l\'instant (og:image, twitter:image : proposition 6 du lot B)', () => {
        const outDir = build(mode);
        for (const f of ctx.pagesHtml(outDir)) {
          const a = analyserHtml(fs.readFileSync(f, 'utf8'));
          assert.equal(meta(a, 'property', 'og:image').length + meta(a, 'name', 'twitter:image').length, 0, rel(outDir, f));
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
}
