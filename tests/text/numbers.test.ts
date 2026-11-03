import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, extractNumberWords, extractNumbers } from '../../src/lib/content-core/rules/text/numbers.ts';

describe('extractNumbers : valeurs canoniques', () => {
  it('50 000 avec espace, NBSP, NNBSP, sans espace ou avec points valent la même valeur', () => {
    for (const s of ['50 000', '50\u00A0000', '50\u202F000', '50000', '50.000']) {
      assert.deepEqual(extractNumbers(`plus de ${s} habitants`), ['50000'], JSON.stringify(s));
    }
  });

  it('1,5 milliard = 1 500 millions = 1 500 000 000', () => {
    const a = extractNumbers('1,5 milliard d’euros');
    const b = extractNumbers('1 500 millions d’euros');
    const c = extractNumbers('1 500 000 000 euros');
    assert.deepEqual(a, ['1500000000']);
    assert.deepEqual(b, a);
    assert.deepEqual(c, a);
  });

  it('3,5 = 3.5 et les zéros de tête ou de fin sont neutres', () => {
    assert.deepEqual(extractNumbers('3,5'), ['3.5']);
    assert.deepEqual(extractNumbers('3.5'), ['3.5']);
    assert.deepEqual(extractNumbers('3,50'), ['3.5']);
    assert.deepEqual(extractNumbers('04'), ['4']);
    assert.deepEqual(extractNumbers('4'), ['4']);
  });

  it('CO2 et 5G ne sont pas des nombres', () => {
    assert.deepEqual(extractNumbers('le CO2 et la 5G'), []);
  });

  it('les ordinaux 1er et 2e sont extraits', () => {
    assert.deepEqual(extractNumbers('le 1er tour, le 2e tour'), ['1', '2']);
  });

  it('en 2027 500 personnes : deux nombres', () => {
    assert.deepEqual(extractNumbers('en 2027 500 personnes'), ['2027', '500']);
  });

  it('CR-04 : chiffres pleine chasse et arabo-indiens valent les chiffres ASCII', () => {
    assert.deepEqual(extractNumbers('plus de ２０００ postes'), ['2000']);
    assert.deepEqual(extractNumbers('plus de ٥٠٠ postes'), ['500']);
    assert.deepEqual(extractNumbers('plus de ۱۲۳ postes'), ['123']);
    assert.deepEqual(extractNumbers('plus de ५०० postes'), ['500']);
  });

  it('CR-04 : unité ou ordinal collé au nombre', () => {
    assert.deepEqual(extractNumbers('50k postes'), ['50000']);
    assert.deepEqual(extractNumbers('100M€ de plus'), ['100000000']);
    assert.deepEqual(extractNumbers('10es et 1ers'), ['10', '1']);
    assert.deepEqual(extractNumbers('50kg et 20cl'), ['50', '20']);
    assert.deepEqual(extractNumbers('100m de long'), ['100']);
  });

  it('CR-04 : 3 Md€ = 3 milliards, 2,5 Mds = 2,5 milliards', () => {
    assert.deepEqual(extractNumbers('3 Md€'), extractNumbers('3 milliards'));
    assert.deepEqual(extractNumbers('3 Md€'), ['3000000000']);
    assert.deepEqual(extractNumbers('2,5 Mds'), ['2500000000']);
    assert.deepEqual(extractNumbers('1 Mrd d’euros'), ['1000000000']);
    assert.deepEqual(extractNumbers('3 M€'), ['3000000']);
    assert.deepEqual(extractNumbers('2 M. Dupont'), ['2']);
  });

  it('canonical() ne passe pas par un flottant', () => {
    assert.equal(canonical('0,1', 'million'), '100000');
    assert.equal(canonical('12345678901234567890'), '12345678901234567890');
    assert.equal(canonical('1.500.000'), '1500000');
  });
});

describe('extractNumberWords : nombres en lettres', () => {
  it('trois, cinquante et millions sont extraits', () => {
    assert.deepEqual(extractNumberWords('trois villes, cinquante communes et des millions'), ['trois', 'cinquante', 'millions']);
  });
  it('WR-04 : moitié, double, triple, tiers, quart, -aines et ordinaux en lettres sont extraits', () => {
    assert.deepEqual(
      extractNumberWords('La moitié, le double, le triple, un tiers, un quart, une trentaine, une soixantaine, la deuxième, le second, le premier'),
      ['moitie', 'double', 'triple', 'tiers', 'quart', 'trentaine', 'soixantaine', 'deuxieme', 'second', 'premier'],
    );
  });
  it('un et une sont des articles, « pour cent » est exclu', () => {
    assert.deepEqual(extractNumberWords('un loyer, une ville'), []);
    assert.deepEqual(extractNumberWords('dix pour cent'), ['dix']);
  });
  it('insensible à la casse et aux accents', () => {
    assert.deepEqual(extractNumberWords('Trois ZÉRO'), ['trois', 'zero']);
  });
});
