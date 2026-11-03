import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { cleanText, foldKey, mergeDigitGroups, sansMarqueurs } from '../../src/lib/content-core/rules/text/normalize.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';
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

describe('words : décompte de la fixture (canari de segmentation, valeurs exactes)', () => {
  const mesure = parse(
    readFileSync(path.join(REPO_ROOT, 'tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml'), 'utf8'),
  ) as { redactions: Record<string, string> };
  const attendus: [string, number][] = [['resume', 22], ['detaille', 99], ['enfant', 51], ['aine', 73]];
  for (const [niveau, n] of attendus) {
    it(`${niveau} : ${n} mots`, () => assert.equal(countWords(sansMarqueurs(mesure.redactions[niveau] ?? '')), n));
  }
  it('un marqueur de glossaire compte comme son texte affiché', () => {
    assert.equal(countWords(sansMarqueurs('Le [[loyer|loyer]] baisse')), 3);
  });
  it('« 1 500 000 » compte pour un mot, « l’école » pour deux', () => {
    assert.equal(countWords('1\u202F500\u202F000'), 1);
    assert.equal(countWords('l’école'), 2);
  });
});
