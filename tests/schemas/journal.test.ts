import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SCHEMAS_DIR, expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const FIXTURE = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'journal', '20261103-001.yaml'), 'utf8');

function swap(from: string, to: string): string {
  assert.ok(FIXTURE.includes(from), `cible introuvable dans le fixture : ${from}`);
  return FIXTURE.replace(from, to);
}

describe('journal : cas valides', () => {
  const ok: [string, string][] = [
    ['le fixture', FIXTURE],
    ['id_cible simple (sans candidat)', swap('id_cible: marie-fictive/encadrement-loyers', 'id_cible: logement')],
    ['avec source https', `${FIXTURE}source: https://exemple.invalid/a\n`],
    ['correction', swap('type: ajout', 'type: correction')],
    ['retrait', swap('type: ajout', 'type: retrait')],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('journal', text));
});

describe('journal : cas invalides', () => {
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['champ nommé collection interdit (Pitfall 2)', `${FIXTURE}collection: mesures\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/collection' }]],
    ['collection_cible partis', swap('collection_cible: mesures', 'collection_cible: partis'), [{ code: 'SCHEMA_ENUM', pointer: '/collection_cible' }]],
    ['id mal formé', swap('id: 20261103-001', 'id: 2026-11-03-1'), [{ code: 'SCHEMA_PATTERN', pointer: '/id' }]],
    ['id_cible en majuscules', swap('id_cible: marie-fictive/encadrement-loyers', 'id_cible: Marie/Loyers'), [{ code: 'SCHEMA_PATTERN', pointer: '/id_cible' }]],
    ['type suppression', swap('type: ajout', 'type: suppression'), [{ code: 'SCHEMA_ENUM', pointer: '/type' }]],
    ['date sans heure', swap('date: 2026-11-03T12:00:00+01:00', 'date: 2026-11-03'), [{ code: 'SCHEMA_FORMAT', pointer: '/date' }]],
    ['auteur manquant', swap('auteur: Erwan Henry\n', ''), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['source en http', `${FIXTURE}source: http://exemple.invalid/a\n`, [{ code: 'SCHEMA_FORMAT', pointer: '/source' }]],
    ['version_schema 2', swap('version_schema: 1', 'version_schema: 2'), [{ code: 'SCHEMA_CONST', pointer: '/version_schema' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('journal', text, expected));
});

describe('journal : conformité', () => {
  it('le schéma n’a aucun champ "collection" mais déclare collection_cible et id_cible', () => {
    const text = readFileSync(path.join(SCHEMAS_DIR, 'journal.schema.json'), 'utf8');
    assert.ok(!/"collection"\s*:/.test(text));
    assert.ok(/"collection_cible"\s*:/.test(text) && /"id_cible"\s*:/.test(text));
  });
});
