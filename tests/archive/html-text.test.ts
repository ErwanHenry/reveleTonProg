import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { decodeHtml, htmlToText, looksClientRendered } from '../../scripts/lib/html-text.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const fixture = (nom: string): Buffer => readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'archive', nom));

describe('decodeHtml', () => {
  it('décode le latin1 déclaré dans <meta> sans U+FFFD', () => {
    const html = decodeHtml(fixture('page-latin1.html'));
    assert.ok(html.includes('préfet'));
    assert.ok(!html.includes('\ufffd'));
    const { text } = htmlToText(html);
    assert.ok(text.includes('é'));
    assert.ok(!text.includes('\ufffd'));
  });

  it("le charset de l'en-tête content-type prime sur <meta>", () => {
    const octets = Buffer.from('<meta charset="utf-8"><p>café</p>', 'latin1');
    assert.ok(decodeHtml(octets, 'text/html; charset=ISO-8859-1').includes('café'));
    assert.ok(decodeHtml(octets).includes('\ufffd'), 'sans en-tête, <meta> déclare utf-8 : octet invalide');
  });

  it('retombe sur UTF-8 pour un charset inconnu et reconnaît le BOM', () => {
    assert.equal(decodeHtml(Buffer.from('éa', 'utf8'), 'text/html; charset=pas-un-charset'), 'éa');
    assert.equal(decodeHtml(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('é')])), 'é');
  });

  it('lit http-equiv Content-Type', () => {
    const octets = Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><p>é</p>', 'latin1');
    assert.ok(decodeHtml(octets).includes('é'));
  });
});

describe('htmlToText', () => {
  const { text, entitesResiduelles } = htmlToText(decodeHtml(fixture('page-utf8.html')));

  it('retire script, style, noscript, commentaires et head', () => {
    for (const interdit of ['SCRIPT_SENTINEL', 'STYLE_SENTINEL', 'COMMENT_SENTINEL', 'NOSCRIPT_SENTINEL', 'Page fictive de Marie Fictive']) {
      assert.ok(!text.includes(interdit), `ne doit pas contenir ${interdit}`);
    }
  });

  it('décode les entités numériques et nommées, &nbsp; devient U+00A0', () => {
    assert.ok(text.includes('par le préfet.'));
    assert.ok(text.includes('50 000\u00a0habitants,'));
    assert.ok(text.includes('L’école'));
    assert.ok(text.includes('imaginaire & sans valeur réelle'));
    assert.deepEqual(entitesResiduelles, []);
  });

  it('garde la phrase coupée sur deux lignes dans la source comme une seule ligne', () => {
    assert.ok(text.includes('Nous encadrerons les loyers dans toutes les villes de plus de 50 000\u00a0habitants, avec un plafond fixé chaque année par le préfet.'));
  });

  it('transforme les blocs et <br> en sauts de ligne, sans lignes vides multiples', () => {
    assert.ok(text.includes('Les loyers\n\nNous encadrerons'));
    assert.ok(text.includes('texte ultérieur.\nLes modalités'));
    assert.ok(!/\n\n\n/.test(text));
    assert.ok(text.length > 500);
  });

  it('signale les entités nommées résiduelles', () => {
    const r = htmlToText('<p>un &inconnu; et &inconnu; et &amp;</p>');
    assert.equal(r.text, 'un &inconnu; et &inconnu; et &');
    assert.deepEqual(r.entitesResiduelles, [{ entite: '&inconnu;', occurrences: 2 }]);
  });

  it('décode en une seule passe et lit windows-1252 pour &#146;', () => {
    assert.equal(htmlToText('<p>&amp;lt; &#146;&#x41;</p>').text, '&lt; ’A');
  });

  it('un < isolé reste du texte, un script jamais refermé avale la suite', () => {
    assert.equal(htmlToText('<p>1 < 2</p>').text, '1 < 2');
    assert.equal(htmlToText('<p>avant</p><script>var a = 1;').text, 'avant');
  });

  it('<head> sans fermeture ne fait pas disparaître la page', () => {
    assert.equal(htmlToText('<html><head><title>t</title><body><p>corps</p></body>').text, 'corps');
  });

  it('respecte les guillemets dans les attributs (un > dans une valeur)', () => {
    assert.equal(htmlToText('<p>a</p><a title="x > y">lien</a>').text, 'a\nlien');
  });

  it('temps linéaire sur 2 Mo', () => {
    const bloc = '<div><p>Texte &eacute;l&eacute;mentaire <b>gras</b> <!-- c --> suite</p><script>var x = "<p>";</script></div>\n';
    const html = bloc.repeat(Math.ceil((2 * 1024 * 1024) / bloc.length));
    const debut = performance.now();
    const r = htmlToText(html);
    const duree = performance.now() - debut;
    assert.ok(r.text.length > 100_000);
    assert.ok(duree < 1000, `trop lent : ${Math.round(duree)} ms`);
  });

  it('temps linéaire sur des « < » ou des guillemets pathologiques', () => {
    const debut = performance.now();
    htmlToText('<'.repeat(1_000_000));
    htmlToText(`<a ${'"'.repeat(1_000_000)}`);
    htmlToText('<p'.repeat(500_000));
    assert.ok(performance.now() - debut < 1000);
  });
});

describe('looksClientRendered', () => {
  it('vrai pour la coquille JS, faux pour une vraie page', () => {
    const coquille = decodeHtml(fixture('coquille-js.html'));
    assert.ok(coquille.length > 30 * 1024);
    assert.equal(looksClientRendered(coquille, htmlToText(coquille).text), true);
    const page = decodeHtml(fixture('page-utf8.html'));
    assert.equal(looksClientRendered(page, htmlToText(page).text), false);
  });

  it('une grande page riche en texte ne déclenche pas la détection', () => {
    assert.equal(looksClientRendered('x'.repeat(40_000), 'y'.repeat(5000)), false);
  });
});
