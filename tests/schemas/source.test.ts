import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const SHA = 'a'.repeat(64);

const BASE = `version_schema: 1
id: marie-fictive-programme
type: programme
auteur: candidat
candidats:
  - marie-fictive
titre: Programme fictif de Marie Fictive
url: https://marie-fictive.exemple.invalid/programme
date_publication: 2026-10
date_consultation: 2026-10-20
archive:
  extrait: archives/marie-fictive/aaaaaaaaaaaa.txt
  sha256: ${SHA}
  capture_le: 2026-10-20T10:00:00+02:00
`;

function swap(from: string, to: string): string {
  assert.ok(BASE.includes(from), `cible introuvable dans la base : ${from}`);
  return BASE.replace(from, to);
}

describe('source : cas valides', () => {
  const ok: [string, string][] = [
    ['source de base', BASE],
    ...['programme', 'site_candidat', 'site_parti', 'discours', 'tribune', 'depot_cc'].map((t): [string, string] => [`type ${t}`, swap('type: programme', `type: ${t}`)]),
    ['auteur parti_du_candidat', swap('auteur: candidat', 'auteur: parti_du_candidat')],
    ['auteur coalition', swap('auteur: candidat', 'auteur: coalition')],
    ['sans wayback_url (optionnel)', BASE],
    ['wayback_url web.archive.org', `${BASE}  wayback_url: https://web.archive.org/web/20261020120000/https://marie-fictive.exemple.invalid/programme\n`],
    ['binaire_sha256 optionnel', `${BASE}  binaire_sha256: ${'b'.repeat(64)}\n`],
    ['date_publication complète', swap('date_publication: 2026-10', 'date_publication: 2026-10-05')],
    ['date_publication mensuelle', swap('date_publication: 2026-10', 'date_publication: 2026-10')],
    ['deux candidats', swap('  - marie-fictive\n', '  - marie-fictive\n  - jean-imaginaire\n')],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('source', text));
});

describe('source : cas invalides', () => {
  const sansArchive = BASE.slice(0, BASE.indexOf('archive:'));
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['type presse (D-3)', swap('type: programme', 'type: presse'), [{ code: 'SCHEMA_ENUM', pointer: '/type' }]],
    ['auteur journaliste', swap('auteur: candidat', 'auteur: journaliste'), [{ code: 'SCHEMA_ENUM', pointer: '/auteur' }]],
    ['archive absente', sansArchive, [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['candidats vide', swap('candidats:\n  - marie-fictive\n', 'candidats: []\n'), [{ code: 'SCHEMA_MINITEMS', pointer: '/candidats' }]],
    ['candidats en double', swap('  - marie-fictive\n', '  - marie-fictive\n  - marie-fictive\n'), [{ code: 'SCHEMA_UNIQUEITEMS', pointer: '/candidats' }]],
    ['extrait avec ..', swap('archives/marie-fictive/aaaaaaaaaaaa.txt', 'archives/../secret.txt'), [{ code: 'SCHEMA_PATTERN', pointer: '/archive/extrait' }]],
    ['extrait absolu', swap('archives/marie-fictive/aaaaaaaaaaaa.txt', '/etc/passwd'), [{ code: 'SCHEMA_PATTERN', pointer: '/archive/extrait' }]],
    ['extrait .pdf', swap('archives/marie-fictive/aaaaaaaaaaaa.txt', 'archives/marie-fictive/aaaaaaaaaaaa.pdf'), [{ code: 'SCHEMA_PATTERN', pointer: '/archive/extrait' }]],
    ['sha256 de 63 caractères', swap(SHA, 'a'.repeat(63)), [{ code: 'SCHEMA_PATTERN', pointer: '/archive/sha256' }]],
    ['sha256 en majuscules', swap(SHA, 'A'.repeat(64)), [{ code: 'SCHEMA_PATTERN', pointer: '/archive/sha256' }]],
    ['capture_le sans heure', swap('2026-10-20T10:00:00+02:00', '2026-10-20'), [{ code: 'SCHEMA_FORMAT', pointer: '/archive/capture_le' }]],
    ['wayback_url hors web.archive.org', `${BASE}  wayback_url: https://exemple.invalid/x\n`, [{ code: 'SCHEMA_PATTERN', pointer: '/archive/wayback_url' }]],
    ['date_consultation partielle', swap('date_consultation: 2026-10-20', 'date_consultation: 2026-10'), [{ code: 'SCHEMA_FORMAT', pointer: '/date_consultation' }]],
    ['url en http', swap('https://marie-fictive.exemple.invalid/programme', 'http://marie-fictive.exemple.invalid/programme'), [{ code: 'SCHEMA_FORMAT', pointer: '/url' }]],
    ['champ inconnu', `${BASE}fiabilite: haute\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/fiabilite' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('source', text, expected));
});
