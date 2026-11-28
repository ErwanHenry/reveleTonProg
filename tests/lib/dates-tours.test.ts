// Textes des tours calculés depuis TOURS (D-02, 10.4) : jamais écrits à la main.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJourMois, libellesTours } from '../../src/lib/dates-tours.ts';
import { REPERE_PARTAGE } from '../../src/lib/partage.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('formatJourMois', () => {
  it('formate le jour et le mois, 1er pour le premier', () => {
    assert.equal(formatJourMois('2027-04-18'), '18 avril');
    assert.equal(formatJourMois('2027-05-01'), '1er mai');
  });
  it('refuse une date mal formée', () => {
    assert.throws(() => formatJourMois('2027-5-1'), /2027-5-1/);
  });
});

describe('libellesTours', () => {
  it('tours de 2027 (valeurs par défaut)', () => {
    assert.deepEqual(libellesTours(), {
      annee: '2027',
      surtitre: 'Élection présidentielle des 18 avril et 2 mai 2027',
      bloc: '1er tour le 18 avril, 2d tour le 2 mai',
      repere: 'Élection présidentielle, 18 avril et 2 mai 2027',
    });
  });
  const attendu2032 = {
    annee: '2032',
    surtitre: 'Élection présidentielle des 11 avril et 1er mai 2032',
    bloc: '1er tour le 11 avril, 2d tour le 1er mai',
    repere: 'Élection présidentielle, 11 avril et 1er mai 2032',
  };
  it('tours fictifs de 2032', () => {
    assert.deepEqual(libellesTours([{ numero: 1, date: '2032-04-11' }, { numero: 2, date: '2032-05-01' }]), attendu2032);
  });
  it('l\'ordinal vient du numéro, pas de la position', () => {
    assert.deepEqual(libellesTours([{ numero: 2, date: '2032-05-01' }, { numero: 1, date: '2032-04-11' }]), attendu2032);
  });
  it('refuse deux années différentes, un numéro manquant ou inattendu', () => {
    assert.throws(() => libellesTours([{ numero: 1, date: '2027-04-18' }, { numero: 2, date: '2028-05-02' }]));
    assert.throws(() => libellesTours([{ numero: 1, date: '2027-04-18' }]));
    assert.throws(() => libellesTours([{ numero: 1, date: '2027-04-18' }, { numero: 3, date: '2027-05-02' }]));
    assert.throws(() => libellesTours([{ numero: 1, date: '2027-04-18' }, { numero: 1, date: '2027-05-02' }]));
  });
});

describe('sources', () => {
  it('REPERE_PARTAGE est calculé et inchangé', () => {
    assert.equal(REPERE_PARTAGE, libellesTours().repere);
    assert.equal(REPERE_PARTAGE, 'Élection présidentielle, 18 avril et 2 mai 2027');
  });
  it('partage.ts ne cite ni avril ni mai', () => {
    const s = fs.readFileSync(path.join(ROOT, 'src/lib/partage.ts'), 'utf8');
    assert.ok(!/\bavril\b/.test(s));
    assert.ok(!/\bmai\b/.test(s));
  });
  it('dates-tours.ts reste sans import', () => {
    const s = fs.readFileSync(path.join(ROOT, 'src/lib/dates-tours.ts'), 'utf8');
    assert.ok(!/^\s*import\b/m.test(s));
    assert.ok(!/require\(/.test(s));
  });
});
