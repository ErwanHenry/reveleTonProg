import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fragments, haystack, quoteIn, tokens } from '../../src/lib/content-core/rules/text/verbatim.ts';

const SOURCE = 'Nous encadrerons les loyers dans toutes les villes de plus de 50 000 habitants, avec un plafond fixé chaque année par le préfet.';
const hay = haystack(SOURCE);

describe('quoteIn : citations qui passent', () => {
  const ok: [string, string][] = [
    ['exacte', 'un plafond fixé chaque année par le préfet'],
    ['majuscule et ponctuation finale', 'Un plafond fixé chaque année par le préfet.'],
    ['virgule insérée', 'avec un plafond, fixé chaque année, par le préfet'],
    ['NBSP et NNBSP dans 50 000', 'villes de plus de 50\u00A0000\u202Fhabitants'],
    ['NNBSP dans 50 000', 'villes de plus de 50\u202F000 habitants'],
    ['sans espace', 'villes de plus de 50000 habitants'],
    ['ellipse […]', 'Nous encadrerons les loyers […] par le préfet'],
    ['ellipse (...)', 'Nous encadrerons les loyers (...) par le préfet'],
    ['ellipse …', 'Nous encadrerons les loyers … par le préfet'],
    ['retours à la ligne', 'un plafond\nfixé chaque\n année'],
  ];
  for (const [nom, q] of ok) it(nom, () => assert.equal(quoteIn(q, hay), true, q));
});

describe('quoteIn : citations refusées', () => {
  const ko: [string, string][] = [
    ['accents retirés', 'un plafond fixe chaque annee par le prefet'],
    ['mots finaux en plus', 'un plafond fixé chaque année par le préfet de région'],
    ['autre chiffre', 'villes de plus de 30 000 habitants'],
    ['mot partiel', 'ncadrerons les loyers'],
    ['mots dans le désordre', 'par le préfet chaque année fixé un plafond'],
    ['citation vide', ''],
    ['guillemets seuls', '«»'],
    ['ellipse seule', '[…]'],
  ];
  for (const [nom, q] of ko) it(nom, () => assert.equal(quoteIn(q, hay), false, q));
});

describe('WR-06 : élisions découpées comme words()', () => {
  const h = haystack("il combat l'extrême droite et l'école, aujourd'hui");
  it('on peut citer le mot sans son élision', () => {
    assert.equal(quoteIn('extrême droite', h), true);
    assert.equal(quoteIn('école', h), true);
  });
  it('la citation avec l’élision passe aussi, apostrophe droite ou typographique', () => {
    assert.equal(quoteIn("l'extrême droite", h), true);
    assert.equal(quoteIn('l’extrême droite', h), true);
  });
  it('aujourd’hui reste un seul mot et un mot partiel reste refusé', () => {
    assert.deepEqual(tokens("aujourd'hui l'école"), ["aujourd'hui", "l'", 'école']);
    assert.equal(quoteIn('trême droite', h), false);
  });
});

describe('tokens, fragments, haystack', () => {
  it('tokens ignore casse, ponctuation et groupes de chiffres', () => {
    assert.deepEqual(tokens('Plus de 50 000 habitants !'), ['plus', 'de', '50000', 'habitants']);
  });
  it('apostrophes typographiques = apostrophe droite', () => {
    assert.deepEqual(tokens('l’école'), tokens("l'école"));
  });
  it('œ = oe', () => {
    assert.deepEqual(tokens('cœur'), tokens('coeur'));
  });
  it('fragments découpe sur les ellipses', () => {
    assert.deepEqual(fragments('a b […] c d'), ['a b', 'c d']);
  });
  it('haystack est encadré d’espaces', () => {
    assert.equal(haystack('Un Deux'), ' un deux ');
  });
});
