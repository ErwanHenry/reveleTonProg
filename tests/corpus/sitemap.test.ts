// sitemap.xml et robots.txt (HEB-05) : fonctions pures de (URL du site, chemins, mode). Domaines
// synthétiques seulement (exemple.test, autre.test) : changer de domaine change les textes.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cheminsDuSite, texteRobots, xmlSitemap } from '../../src/lib/sitemap.ts';

const SITE = new URL('https://exemple.test');

describe('cheminsDuSite', () => {
  it('liste accueil, index, une page par thème et par candidat, pages institutionnelles, triés et sans doublon', () => {
    const chemins = cheminsDuSite({
      themes: [{ theme: { id: 'sante' } }, { theme: { id: 'climat' } }, { theme: { id: 'sante' } }],
      candidats: [{ id: 'zoe-martin' }, { id: 'anne-dupont' }],
    });
    assert.deepEqual(chemins, [
      '/',
      '/candidats/',
      '/candidats/anne-dupont/',
      '/candidats/zoe-martin/',
      '/mentions-legales/',
      '/methode/',
      '/qui-sommes-nous/',
      '/themes/',
      '/themes/climat/',
      '/themes/sante/',
    ]);
  });

  it('sans thème ni candidat : les pages fixes seulement', () => {
    assert.deepEqual(cheminsDuSite({ themes: [], candidats: [] }), [
      '/',
      '/candidats/',
      '/mentions-legales/',
      '/methode/',
      '/qui-sommes-nous/',
      '/themes/',
    ]);
  });
});

describe('xmlSitemap', () => {
  it('urlset sitemaps.org 0.9 en UTF-8, une <loc> absolue par chemin', () => {
    const xml = xmlSitemap(SITE, ['/', '/a/']);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'), xml);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]), ['https://exemple.test/', 'https://exemple.test/a/']);
    assert.equal(xml.match(/<url>/g)?.length, 2);
    assert.ok(xml.trimEnd().endsWith('</urlset>'));
  });

  it('échappe &, < et > dans les adresses', () => {
    const xml = xmlSitemap(SITE, ['/a/?x=1&y=<2>']);
    const loc = /<loc>([^<]*)<\/loc>/.exec(xml)?.[1] ?? '';
    assert.ok(!/[<>]/.test(loc), loc);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(loc), loc);
    assert.ok(loc.includes('&amp;'), loc);
  });

  it('un autre domaine donne d’autres <loc>', () => {
    const a = xmlSitemap(SITE, ['/themes/']);
    const b = xmlSitemap(new URL('https://autre.test'), ['/themes/']);
    assert.notEqual(a, b);
    assert.ok(b.includes('<loc>https://autre.test/themes/</loc>'));
    assert.ok(!b.includes('exemple.test'));
  });

  it('refuse un chemin qui ne commence pas par /', () => {
    assert.throws(() => xmlSitemap(SITE, ['themes/']), /chemin/);
    assert.throws(() => xmlSitemap(SITE, ['//ailleurs.test/']), /chemin/);
  });
});

describe('texteRobots', () => {
  it('preview : tout interdit, aucune ligne Sitemap', () => {
    assert.equal(texteRobots('preview', SITE), 'User-agent: *\nDisallow: /\n');
    assert.equal(texteRobots('preview', undefined), 'User-agent: *\nDisallow: /\n');
  });

  it('production : tout permis et ligne Sitemap absolue sur le domaine', () => {
    assert.equal(texteRobots('production', SITE), 'User-agent: *\nAllow: /\nSitemap: https://exemple.test/sitemap.xml\n');
    assert.equal(
      texteRobots('production', new URL('https://autre.test')),
      'User-agent: *\nAllow: /\nSitemap: https://autre.test/sitemap.xml\n',
    );
  });

  it('production sans site : erreur explicite', () => {
    assert.throws(() => texteRobots('production', undefined), /site/);
  });
});
