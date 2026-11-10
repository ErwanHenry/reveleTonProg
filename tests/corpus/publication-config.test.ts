import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estOuvert, loadPublicationConfig } from '../../src/lib/publication-config.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const racines: string[] = [];
after(() => {
  for (const r of racines) rmSync(r, { recursive: true, force: true });
});

function racineAvec(contenu: string | undefined): string {
  const r = mkdtempSync(path.join(os.tmpdir(), 'rtp-pub-'));
  racines.push(r);
  if (contenu !== undefined) {
    mkdirSync(path.join(r, 'config'));
    writeFileSync(path.join(r, 'config', 'publication.yml'), contenu);
  }
  return r;
}

describe('loadPublicationConfig', () => {
  it('fichier absent : liste vide, present faux', () => {
    const r = racineAvec(undefined);
    const c = loadPublicationConfig(r);
    assert.deepEqual(c.themesOuverts, []);
    assert.equal(c.present, false);
    assert.equal(c.fichier, path.join(r, 'config', 'publication.yml'));
  });

  it('un fichier créé après une première lecture est vu (pas de mémo)', () => {
    const r = racineAvec(undefined);
    assert.equal(loadPublicationConfig(r).present, false);
    mkdirSync(path.join(r, 'config'));
    writeFileSync(path.join(r, 'config', 'publication.yml'), 'themes_ouverts:\n  - sante\n');
    assert.deepEqual(loadPublicationConfig(r).themesOuverts, ['sante']);
  });

  it('liste vide acceptée', () => {
    const c = loadPublicationConfig(racineAvec('themes_ouverts: []\n'));
    assert.deepEqual(c.themesOuverts, []);
    assert.equal(c.present, true);
  });

  it('séquence en bloc indentée de deux espaces (le style imposé)', () => {
    assert.deepEqual(loadPublicationConfig(racineAvec('# commentaire\nthemes_ouverts:\n  - logement\n  - climat\n')).themesOuverts, ['logement', 'climat']);
  });

  it('le fichier du vrai corpus est lisible et vide', () => {
    const c = loadPublicationConfig(REPO_ROOT);
    assert.equal(c.present, true);
    assert.deepEqual(c.themesOuverts, []);
    assert.match(readFileSync(c.fichier, 'utf8'), /^themes_ouverts: \[\]$/m);
  });

  for (const [nom, contenu] of [
    ['YAML invalide', 'themes_ouverts: [a\n'],
    ['alias', 'a: &x [sante]\nthemes_ouverts: *x\n'],
    ['autre clé', 'themes_ouverts: []\nautre: 1\n'],
    ['clé absente', '# rien\n{}\n'],
    ['racine non objet', '- sante\n'],
    ['non-liste', 'themes_ouverts:\n  sante: oui\n'],
    ['élément non slug', 'themes_ouverts:\n  - Santé\n'],
    ['élément non texte', 'themes_ouverts:\n  - 12\n'],
    ['doublon', 'themes_ouverts:\n  - sante\n  - sante\n'],
    ['clé en double', 'themes_ouverts: []\nthemes_ouverts: []\n'],
  ] as const) {
    it(`refuse : ${nom}`, () => {
      assert.throws(() => loadPublicationConfig(racineAvec(contenu)), /config\/publication\.yml/);
    });
  }
});

describe('estOuvert', () => {
  it('accepte un tableau ou un ensemble', () => {
    assert.equal(estOuvert(['a'], 'a'), true);
    assert.equal(estOuvert(new Set(['a']), 'b'), false);
  });
});
