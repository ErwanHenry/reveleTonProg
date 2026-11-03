import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, foldKey, mergeDigitGroups, sansMarqueurs } from '../../src/lib/content-core/rules/text/normalize.ts';
import { countWords, quoteSpans, quotesBalanced, withoutQuotes, words } from '../../src/lib/content-core/rules/text/words.ts';

// Ces tests servent aussi de canaris ICU (Pitfall 15) : si l'un échoue après une montée de version
// de Node, il faut revérifier la couche texte, pas désactiver le test.

describe('words : élisions, composés, nombres', () => {
  it("sépare les élisions (l'école = 2 mots)", () => {
    assert.deepEqual(words("l'école"), ["l'", 'école']);
    assert.deepEqual(words('l’école'), ["l'", 'école']);
    assert.deepEqual(words("qu'il jusqu'à"), ["qu'", 'il', "jusqu'", 'à']);
  });

  it("garde entiers aujourd'hui, presqu'île, quelqu'un", () => {
    assert.deepEqual(words("aujourd'hui"), ["aujourd'hui"]);
    assert.deepEqual(words("presqu'île"), ["presqu'île"]);
    assert.deepEqual(words("quelqu'un"), ["quelqu'un"]);
  });

  for (const [nom, sp] of [
    ['espace', ' '],
    ['NBSP', '\u00A0'],
    ['espace insécable fine', '\u202F'],
    ['espace fine', '\u2009'],
  ] as const) {
    it(`« 1 500 000 » avec ${nom} compte pour un seul mot`, () => {
      assert.deepEqual(words(`1${sp}500${sp}000`), ['1500000']);
      assert.equal(countWords(`1${sp}500${sp}000`), 1);
    });
  }

  it('« 12 % » avec espace insécable fine : le mot est 12, sans espace', () => {
    assert.deepEqual(words('12\u202F%'), ['12']);
  });

  it('les composés comptent par partie', () => {
    assert.equal(countWords('a-t-il'), 2);
    assert.equal(countWords('peut-être'), 2);
    assert.equal(countWords("c'est-à-dire"), 4);
  });

  it('les caractères de largeur nulle et le trait d’union conditionnel sont retirés avant le comptage', () => {
    assert.deepEqual(words('extr\u200B\u00EAme'), ['extrême']);
    assert.deepEqual(words('loy\u00ADer'), ['loyer']);
    assert.deepEqual(words('a\u2060b\uFEFFc'), ['abc']);
  });

  it('« en 2027 500 personnes » ne fusionne pas une année et un nombre', () => {
    assert.equal(mergeDigitGroups(cleanText('en 2027 500 personnes')), 'en 2027 500 personnes');
  });
});

describe('words : guillemets', () => {
  it('quoteSpans extrait chaque citation', () => {
    assert.deepEqual(quoteSpans('Il dit « non » et « oui »'), ['non', 'oui']);
  });
  it('withoutQuotes retire les citations', () => {
    assert.equal(cleanText(withoutQuotes('Il dit « non » puis part')), 'Il dit puis part');
  });
  it('quotesBalanced refuse un guillemet orphelin', () => {
    assert.equal(quotesBalanced('a « b'), false);
    assert.equal(quotesBalanced('a b »'), false);
    assert.equal(quotesBalanced('a « b » c'), true);
    assert.equal(quotesBalanced('a « b » c « d'), false);
    assert.equal(quotesBalanced('sans guillemet'), true);
  });
});

describe('normalize', () => {
  it('foldKey plie la casse, les accents et les ligatures', () => {
    assert.equal(foldKey('EXTRÊME'), 'extreme');
    assert.equal(foldKey('cœur'), 'coeur');
  });
  it('sansMarqueurs remplace chaque renvoi par le texte affiché', () => {
    assert.equal(sansMarqueurs('Le [[loyer]] et [[préfets|prefet]]'), 'Le loyer et préfets');
  });
  it('sansMarqueurs peut être appelé plusieurs fois de suite (regex globale partagée)', () => {
    assert.equal(sansMarqueurs('[[a]]'), 'a');
    assert.equal(sansMarqueurs('[[a]]'), 'a');
  });
});
