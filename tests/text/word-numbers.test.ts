import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractWordNumbers } from '../../src/lib/content-core/rules/text/word-numbers.ts';

const valeurs = (t: string): string[] => extractWordNumbers(t).map((n) => n.valeur);

describe('extractWordNumbers : valeurs des nombres en toutes lettres (WR-08)', () => {
  const cas: [string, string][] = [
    ['deux', '2'],
    ['zéro', '0'],
    ['onze', '11'],
    ['dix-sept', '17'],
    ['vingt', '20'],
    ['vingt et un', '21'],
    ['vingt-deux', '22'],
    ['soixante et onze', '71'],
    ['soixante-douze', '72'],
    ['soixante-dix-sept', '77'],
    ['quatre-vingts', '80'],
    ['quatre-vingt-dix', '90'],
    ['quatre-vingt-quinze', '95'],
    ['cent', '100'],
    ['deux cents', '200'],
    ['deux cent trois', '203'],
    ['quatre cent quatre-vingt-quatre', '484'],
    ['mille', '1000'],
    ['deux mille', '2000'],
    ['cinquante mille', '50000'],
    ['trois mille deux cents', '3200'],
    ['deux cent mille', '200000'],
    ['un million', '1000000'],
    ['deux millions', '2000000'],
    ['trois millions cinq cent mille', '3500000'],
    ['un milliard', '1000000000'],
    ['deux milliards', '2000000000'],
  ];
  for (const [mots, valeur] of cas) {
    it(`« ${mots} » = ${valeur}`, () => assert.deepEqual(valeurs(`Il y a ${mots} de choses`), [valeur]));
  }

  it('« un » et « une » seuls sont des articles', () => {
    assert.deepEqual(valeurs('un loyer, une ville'), []);
  });
  it('« millions » sans compte devant n’est pas un nombre', () => {
    assert.deepEqual(valeurs('des millions de personnes'), []);
  });
  it('« pour cent » est exclu', () => {
    assert.deepEqual(valeurs('dix pour cent'), ['10']);
  });
  it('deux nombres séparés par une virgule ou « et » restent distincts', () => {
    assert.deepEqual(valeurs('deux, trois'), ['2', '3']);
    assert.deepEqual(valeurs('entre deux et trois'), ['2', '3']);
    assert.deepEqual(valeurs('deux trois'), ['2', '3']);
  });
  it('les mots d’un nombre sont conservés, casse et accents pliés', () => {
    assert.deepEqual(extractWordNumbers('Soixante ET ONZE'), [{ valeur: '71', mots: ['soixante', 'et', 'onze'] }]);
  });
});
