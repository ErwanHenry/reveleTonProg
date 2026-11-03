import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const dir = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'glossaire');
const TERME = readFileSync(path.join(dir, 'loyer.yaml'), 'utf8');
const PARTI = readFileSync(path.join(dir, 'parti-imaginaire.yaml'), 'utf8');

function swap(base: string, from: string, to: string): string {
  assert.ok(base.includes(from), `cible introuvable dans le fixture : ${from}`);
  return base.replace(from, to);
}

const SOURCE = (type: string): string => `source:
  type: ${type}
  url: https://exemple.invalid/s
  date_consultation: 2026-10-20
`;

describe('glossaire : cas valides', () => {
  const ok: [string, string][] = [
    ['terme (fixture)', TERME],
    ['parti (fixture)', PARTI],
    ['terme avec source institution', `${TERME}${SOURCE('institution')}`],
    ['definition de 300 caractères', swap(TERME, /definition: .*\n/.exec(TERME)?.[0] ?? '', `definition: ${'a'.repeat(300)}\n`)],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('glossaire', text));
});

describe('glossaire : cas invalides', () => {
  const sansSource = PARTI.slice(0, PARTI.indexOf('source:'));
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['parti sans source', sansSource, [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['parti avec source institution', swap(PARTI, 'source:\n  type: parti', 'source:\n  type: institution'), [{ code: 'SCHEMA_CONST', pointer: '/source/type' }]],
    ['terme avec source presse', `${TERME}${SOURCE('presse')}`, [{ code: 'SCHEMA_ENUM', pointer: '/source/type' }]],
    ['terme avec source candidat', `${TERME}${SOURCE('candidat')}`, [{ code: 'SCHEMA_ENUM', pointer: '/source/type' }]],
    ['parti avec source presse', swap(PARTI, 'source:\n  type: parti', 'source:\n  type: presse'), [{ code: 'SCHEMA_ENUM', pointer: '/source/type' }]],
    ['definition de 301 caractères', swap(TERME, /definition: .*\n/.exec(TERME)?.[0] ?? '', `definition: ${'a'.repeat(301)}\n`), [{ code: 'SCHEMA_MAXLENGTH', pointer: '/definition' }]],
    ['definition vide', swap(TERME, /definition: .*\n/.exec(TERME)?.[0] ?? '', 'definition: ""\n'), [{ code: 'SCHEMA_MINLENGTH', pointer: '/definition' }]],
    ['type personne', swap(TERME, 'type: terme', 'type: personne'), [{ code: 'SCHEMA_ENUM', pointer: '/type' }]],
    ['champ inconnu', `${TERME}exemple: x\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/exemple' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('glossaire', text, expected));
});
