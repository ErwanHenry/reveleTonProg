import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const FIXTURE = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'couverture', 'logement.yaml'), 'utf8');

function swap(from: string, to: string): string {
  assert.ok(FIXTURE.includes(from), `cible introuvable dans le fixture : ${from}`);
  return FIXTURE.replace(from, to);
}

function withCase(body: string): string {
  return `version_schema: 1
id: logement
theme: logement
cases:
  - candidat: marie-fictive
${body}    verifie_le: 2026-10-21
    verifie_par: Erwan Henry
`;
}

describe('couverture : cas valides', () => {
  const ok: [string, string][] = [
    ['le fixture (mesures + programme_non_publie)', FIXTURE],
    ['non_precise avec une source consultée', withCase('    etat: non_precise\n    sources_consultees:\n      - marie-fictive-programme\n')],
    ['mesures avec sources_consultees facultatives', withCase('    etat: mesures\n    sources_consultees:\n      - marie-fictive-programme\n')],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('couverture', text));
});

describe('couverture : cas invalides', () => {
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['cases vide', 'version_schema: 1\nid: logement\ntheme: logement\ncases: []\n', [{ code: 'SCHEMA_MINITEMS', pointer: '/cases' }]],
    ['etat inconnu', swap('etat: mesures', 'etat: absent'), [{ code: 'SCHEMA_ENUM', pointer: '/cases/0/etat' }]],
    ['non_precise sans sources_consultees', withCase('    etat: non_precise\n'), [{ code: 'SCHEMA_REQUIRED', pointer: '/cases/0' }]],
    ['non_precise avec sources_consultees vide', withCase('    etat: non_precise\n    sources_consultees: []\n'), [{ code: 'SCHEMA_MINITEMS', pointer: '/cases/0/sources_consultees' }]],
    ['verifie_le manquant', swap('    verifie_le: 2026-10-21\n    verifie_par: Erwan Henry\n  - candidat: jean', '    verifie_par: Erwan Henry\n  - candidat: jean'), [{ code: 'SCHEMA_REQUIRED', pointer: '/cases/0' }]],
    ['verifie_par manquant', swap('    verifie_par: Erwan Henry\n  - candidat: jean', '  - candidat: jean'), [{ code: 'SCHEMA_REQUIRED', pointer: '/cases/0' }]],
    ['verifie_le partiel', swap('verifie_le: 2026-10-21', 'verifie_le: 2026-10'), [{ code: 'SCHEMA_FORMAT', pointer: '/cases/0/verifie_le' }]],
    ['id candidat en majuscule', swap('candidat: marie-fictive', 'candidat: Jean'), [{ code: 'SCHEMA_PATTERN', pointer: '/cases/0/candidat' }]],
    ['champ inconnu dans une case', swap('etat: mesures', 'etat: mesures\n    note: x'), [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/cases/0/note' }]],
    ['version_schema 2', swap('version_schema: 1', 'version_schema: 2'), [{ code: 'SCHEMA_CONST', pointer: '/version_schema' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('couverture', text, expected));
});
