import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR, expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const FIXTURE = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'candidats', 'marie-fictive.yaml'), 'utf8');

/** Remplace exactement une occurrence : échoue si le fixture a changé et que la cible a disparu. */
function swap(from: string, to: string): string {
  assert.ok(FIXTURE.includes(from), `cible introuvable dans le fixture : ${from}`);
  return FIXTURE.replace(from, to);
}

const BROUILLON_ONLY = `version_schema: 1
id: marie-fictive
prenom: Marie
nom: Fictive
nom_tri: Fictive
parti: null
statuts:
  - code: pressenti
    date: 2026-11
    source:
      type: presse
      url: https://journal-fictif.exemple.invalid/a
      date_consultation: 2026-11-02
    statut_relecture: brouillon
`;

function withStatut(statut: string, extra = ''): string {
  return `version_schema: 1
id: marie-fictive
prenom: Marie
nom: Fictive
nom_tri: Fictive
parti: null
${extra}statuts:
  - ${statut}
`;
}

const SOURCE = `    source:
      type: candidat
      url: https://marie-fictive.exemple.invalid/c
      date_consultation: 2026-10-16
`;

describe('candidat : cas valides', () => {
  const ok: [string, string][] = [
    ['le fixture', FIXTURE],
    ['parti: null sans parti_source', BROUILLON_ONLY],
    ['source de statut de type presse (D-3)', BROUILLON_ONLY],
    ['ordre_cc: 3', swap('statuts:', 'ordre_cc: 3\nstatuts:')],
    ['wikidata: Q42', swap('  2027etmoi: fictif-001\n', '  2027etmoi: fictif-001\n  wikidata: Q42\n')],
    ['renonce avec motif', withStatut(`code: renonce\n    motif: retrait\n    date: 2026-10-01\n${SOURCE}    statut_relecture: brouillon`)],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('candidat', text));
});

describe('candidat : cas invalides', () => {
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['renonce sans motif', withStatut(`code: renonce\n    date: 2026-10-01\n${SOURCE}    statut_relecture: brouillon`), [{ code: 'SCHEMA_REQUIRED', pointer: '/statuts/0' }]],
    ['motif sur declare', withStatut(`code: declare\n    motif: retrait\n    date: 2026-10-01\n${SOURCE}    statut_relecture: brouillon`), [{ code: 'SCHEMA_FALSE', pointer: '/statuts/0/motif' }]],
    ['motif hors énumération', withStatut(`code: renonce\n    motif: autre\n    date: 2026-10-01\n${SOURCE}    statut_relecture: brouillon`), [{ code: 'SCHEMA_ENUM', pointer: '/statuts/0/motif' }]],
    ['date partielle sur statut relu', withStatut(`code: declare\n    date: 2026-11\n${SOURCE}    statut_relecture: relu\n    relecteur: Erwan Henry\n    date_relecture: 2026-11-02`), [{ code: 'SCHEMA_FORMAT', pointer: '/statuts/0/date' }]],
    ['statut relu sans relecteur', withStatut(`code: declare\n    date: 2026-10-15\n${SOURCE}    statut_relecture: relu`), [{ code: 'SCHEMA_REQUIRED', pointer: '/statuts/0' }]],
    ['id en majuscules et underscore', swap('id: marie-fictive', 'id: Marie_Fictive'), [{ code: 'SCHEMA_PATTERN', pointer: '/id' }]],
    ['id sans tiret', swap('id: marie-fictive', 'id: marie'), [{ code: 'SCHEMA_PATTERN', pointer: '/id' }]],
    ['photo interdite (D-12)', `${FIXTURE}photo: https://exemple.invalid/p.jpg\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/photo' }]],
    ['faute de frappe dans une clé imbriquée', swap('    statut_relecture: brouillon', '    statut_relectur: brouillon'), [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/statuts/0/statut_relectur' }]],
    ['parti texte sans parti_source', swap(/parti_source:\n(?: {2}.*\n)+/.exec(FIXTURE)?.[0] ?? '', ''), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['parti_source de type presse', swap('parti_source:\n  type: parti', 'parti_source:\n  type: presse'), [{ code: 'SCHEMA_ENUM', pointer: '/parti_source/type' }]],
    ['wikidata invalide', swap('  2027etmoi: fictif-001\n', '  wikidata: 42x\n'), [{ code: 'SCHEMA_PATTERN', pointer: '/ids_externes/wikidata' }]],
    ['code de statut inconnu', swap('code: pressenti', 'code: retire'), [{ code: 'SCHEMA_ENUM', pointer: '/statuts/0/code' }]],
    ['statuts vide', withStatut('x').replace(/statuts:\n {2}- x\n/, 'statuts: []\n'), [{ code: 'SCHEMA_MINITEMS', pointer: '/statuts' }]],
    ['url http', swap('https://marie-fictive.exemple.invalid/candidature', 'http://marie-fictive.exemple.invalid/candidature'), [{ code: 'SCHEMA_FORMAT', pointer: '/statuts/1/source/url' }]],
    ['url javascript:', swap('https://marie-fictive.exemple.invalid/candidature', 'javascript:alert(1)'), [{ code: 'SCHEMA_FORMAT', pointer: '/statuts/1/source/url' }]],
    ['date inexistante 2026-02-30', swap('date_consultation: 2026-10-16', 'date_consultation: 2026-02-30'), [{ code: 'SCHEMA_FORMAT', pointer: '/statuts/1/source/date_consultation' }]],
    ['version_schema 2', swap('version_schema: 1', 'version_schema: 2'), [{ code: 'SCHEMA_CONST', pointer: '/version_schema' }]],
    ['ordre_cc à 0', swap('statuts:', 'ordre_cc: 0\nstatuts:'), [{ code: 'SCHEMA_MINIMUM', pointer: '/ordre_cc' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('candidat', text, expected));
});

describe('candidat : version_schema obsolète', () => {
  it('version_schema 0 : SCHEMA_VERSION_OBSOLETE avec la commande de migration', () => {
    const text = swap('version_schema: 1', 'version_schema: 0');
    expectErrors('candidat', text, [{ code: 'SCHEMA_VERSION_OBSOLETE', pointer: '/version_schema' }]);
    const { diagnostics } = validateYamlText('candidat', text, '/tmp/x.yaml', { schemasDir: SCHEMAS_DIR });
    const d = diagnostics.find((x) => x.code === 'SCHEMA_VERSION_OBSOLETE');
    assert.ok(d?.message.includes('npm run migrate -- --write'), d?.message);
    assert.ok(!diagnostics.some((x) => x.code === 'SCHEMA_CONST'));
  });
});

describe('schémas : conformité au mode strict d’Ajv', () => {
  it('aucun champ ne s’appelle "collection" (Pitfall 2)', () => {
    for (const rel of ['candidat.schema.json', 'defs/common.schema.json']) {
      const text = readFileSync(path.join(SCHEMAS_DIR, rel), 'utf8');
      assert.ok(!/"collection"\s*:/.test(text), rel);
    }
  });
});
