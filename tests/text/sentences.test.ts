import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sentences } from '../../src/lib/content-core/rules/text/sentences.ts';

describe('sentences', () => {
  it('une phrase simple par point', () => {
    assert.deepEqual(sentences('Il part. Elle reste.'), ['Il part.', 'Elle reste.']);
  });
  it('« M. Dupont propose. Il part. » fait 2 phrases', () => {
    assert.equal(sentences('M. Dupont propose. Il part.').length, 2);
  });
  it('« Voir p. 3 et art. 4. Fin. » fait 2 phrases', () => {
    assert.equal(sentences('Voir p. 3 et art. 4. Fin.').length, 2);
  });
  it('la ponctuation dans une citation ne coupe pas la phrase', () => {
    assert.equal(sentences('Il dit « Non. Jamais. » puis part.').length, 1);
  });
  it('un bloc coupé à la main reste une seule phrase', () => {
    assert.equal(sentences('Le préfet fixe\nle plafond\nchaque année.').length, 1);
  });
  it('une initiale ne termine pas la phrase', () => {
    assert.equal(sentences('J. Dupont arrive.').length, 1);
  });
  it('le texte restitué garde les points masqués', () => {
    assert.deepEqual(sentences('Il dit « Non. Jamais. » puis part.'), ['Il dit « Non. Jamais. » puis part.']);
  });
  it('un texte vide ne donne aucune phrase', () => {
    assert.deepEqual(sentences(''), []);
    assert.deepEqual(sentences('   '), []);
  });
});
