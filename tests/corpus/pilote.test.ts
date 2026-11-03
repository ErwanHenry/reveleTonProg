import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { lireCouverture } from '../../scripts/lib/couverture.ts';
import { verifierPilote } from '../../scripts/lib/pilote.ts';

// Corpus pilote réel (racine du dépôt), CONT-05 : plafond de 2 mesures, brouillon uniquement, complétude des
// thèmes livrés, cohérence des cases, sources consultées, hôtes. Les deux codes de glossaire (CONT-06) sont
// contrôlés par tests/corpus/glossaire.test.ts. Plan 03-05.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODES_GLOSSAIRE = ['PILOTE_PARTI_NON_MARQUE', 'PILOTE_TERME_NON_MARQUE'];

const { data, problemes } = lireCouverture(readFileSync(path.join(REPO_ROOT, 'data', 'couverture-themes.yaml'), 'utf8'));
const charge = loadAll(REPO_ROOT, { schemasDir: path.join(REPO_ROOT, 'schemas'), mode: 'preview' });

describe('corpus pilote réel (CONT-05)', () => {
  it('lit le tableau de couverture sans problème', () => {
    assert.deepEqual(problemes, []);
  });

  it('a 3 thèmes pilotes, et pilote.livres est inclus dans pilote.themes', () => {
    assert.equal(data.pilote.themes.length, 3);
    assert.equal(new Set(data.pilote.themes).size, 3);
    for (const l of data.pilote.livres) assert.ok(data.pilote.themes.includes(l), `thème livré « ${l} » hors de pilote.themes`);
  });

  it('ne produit aucune erreur de corpus pilote (hors codes de glossaire)', (t) => {
    const tous = verifierPilote(charge.entries, data);
    for (const p of tous.filter((x) => x.severite === 'avertissement')) t.diagnostic(`${p.code} ${p.fichier ?? ''} : ${p.message}`);
    const erreurs = tous.filter((p) => p.severite === 'erreur' && !CODES_GLOSSAIRE.includes(p.code));
    assert.deepEqual(erreurs.map((p) => `${p.code} ${p.fichier ?? ''} : ${p.message}`), []);
  });

  it('ne livre aucune mesure tant que le premier thème n’est pas rédigé (corpus vide : aucun problème)', () => {
    const mesures = charge.entries.filter((e) => e.collection === 'mesures');
    if (mesures.length === 0) assert.deepEqual(verifierPilote(charge.entries, data), []);
  });
});
