import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONTENT_ROOT, resolveContentRoot } from '../../src/lib/content-core/root.ts';

describe('racine de contenu par défaut', () => {
  it('vaut « . » : le vrai corpus', () => {
    assert.equal(DEFAULT_CONTENT_ROOT, '.');
  });
  it('sans variable : la racine du projet', () => {
    assert.equal(resolveContentRoot('/x/proj', {}), '/x/proj');
  });
  it('une variable vide équivaut à une variable absente', () => {
    assert.equal(resolveContentRoot('/x/proj', { RTP_CONTENT_ROOT: '' }), '/x/proj');
  });
  it('la fixture fictive est désignée explicitement', () => {
    assert.equal(
      resolveContentRoot('/x/proj', { RTP_CONTENT_ROOT: 'tests/fixtures/corpus-valide' }),
      '/x/proj/tests/fixtures/corpus-valide',
    );
  });
});
