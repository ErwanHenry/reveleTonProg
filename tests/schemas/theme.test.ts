import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const BASE = `version_schema: 1
id: logement
nom: Logement
ordre: 1
prioritaire_aine: true
mots_cles:
  - loyer
  - habitat
sous_themes:
  - id: loyers
    nom: Loyers
  - id: construction
    nom: Construction
statut_relecture: publie
relecteur: Erwan Henry
date_relecture: 2026-10-21
`;

function swap(from: string, to: string): string {
  assert.ok(BASE.includes(from), `cible introuvable dans la base : ${from}`);
  return BASE.replace(from, to);
}

describe('theme : cas valides', () => {
  const ok: [string, string][] = [
    ['thème complet', BASE],
    ['sans mots_cles ni prioritaire_aine', `version_schema: 1
id: sante
nom: Santé
ordre: 2
sous_themes:
  - id: hopital
    nom: Hôpital
statut_relecture: brouillon
`],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('theme', text));
});

describe('theme : cas invalides', () => {
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['sous_themes vide', BASE.replace(/sous_themes:[\s\S]*?(?=statut_relecture)/, 'sous_themes: []\n'), [{ code: 'SCHEMA_MINITEMS', pointer: '/sous_themes' }]],
    ['ordre 0', swap('ordre: 1', 'ordre: 0'), [{ code: 'SCHEMA_MINIMUM', pointer: '/ordre' }]],
    ['sous-thème sans nom', swap('  - id: loyers\n    nom: Loyers\n', '  - id: loyers\n'), [{ code: 'SCHEMA_REQUIRED', pointer: '/sous_themes/0' }]],
    ['prioritaire_aine "oui"', swap('prioritaire_aine: true', 'prioritaire_aine: "oui"'), [{ code: 'SCHEMA_TYPE', pointer: '/prioritaire_aine' }]],
    ['champ inconnu', `${BASE}couleur: bleu\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/couleur' }]],
    ['mots_cles en double', swap('  - habitat\n', '  - loyer\n'), [{ code: 'SCHEMA_UNIQUEITEMS', pointer: '/mots_cles' }]],
    ['statut_relecture absent', swap('statut_relecture: publie\n', ''), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('theme', text, expected));
});
