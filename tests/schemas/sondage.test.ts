import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SCHEMAS_DIR, expectErrors, expectOk } from '../helpers/validate-yaml.ts';

const FIXTURE = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'sondages', 'sondage-fictif-1.yaml'), 'utf8');

function swap(from: string, to: string): string {
  assert.ok(FIXTURE.includes(from), `cible introuvable dans le fixture : ${from}`);
  return FIXTURE.replace(from, to);
}

describe('sondage : cas valides', () => {
  const ok: [string, string][] = [
    ['le fixture', FIXTURE],
    ['deuxième tour, téléphone, certains d’aller voter', swap('tour: 1', 'tour: 2').replace('methode: en_ligne', 'methode: telephone').replace('base: inscrits', 'base: certains_aller_voter')],
    ['sans autres_pct', swap('    autres_pct: 7\n', '')],
    ['relu avec relecteur', swap('statut_relecture: brouillon', 'statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: 2026-10-06')],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('sondage', text));
});

describe('sondage : cas invalides', () => {
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['url_notice absente (REGLE-09)', swap('url_notice: https://institut-fictif.exemple.invalid/notice\n', ''), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['url_notice en http', swap('url_notice: https://', 'url_notice: http://'), [{ code: 'SCHEMA_FORMAT', pointer: '/url_notice' }]],
    ['tour 3', swap('tour: 1', 'tour: 3'), [{ code: 'SCHEMA_ENUM', pointer: '/tour' }]],
    ['echantillon 0', swap('echantillon: 1000', 'echantillon: 0'), [{ code: 'SCHEMA_MINIMUM', pointer: '/echantillon' }]],
    ['methode sms', swap('methode: en_ligne', 'methode: sms'), [{ code: 'SCHEMA_ENUM', pointer: '/methode' }]],
    ['base tous', swap('base: inscrits', 'base: tous'), [{ code: 'SCHEMA_ENUM', pointer: '/base' }]],
    ['marges_erreur vide', swap(/marges_erreur:\n(?: {2}.*\n)+/.exec(FIXTURE)?.[0] ?? '', 'marges_erreur: []\n'), [{ code: 'SCHEMA_MINITEMS', pointer: '/marges_erreur' }]],
    ['hypothèse avec un seul score', swap('      - candidat: jean-imaginaire\n        pct: 41\n', ''), [{ code: 'SCHEMA_MINITEMS', pointer: '/hypotheses/0/scores' }]],
    ['pct 101', swap('pct: 52', 'pct: 101'), [{ code: 'SCHEMA_MAXIMUM', pointer: '/hypotheses/0/scores/0/pct' }]],
    ['date_publication sans heure', swap('date_publication: 2026-10-05T08:00:00+02:00', 'date_publication: 2026-11-01'), [{ code: 'SCHEMA_FORMAT', pointer: '/date_publication' }]],
    ['terrain.fin manquant', swap('  fin: 2026-10-03\n', ''), [{ code: 'SCHEMA_REQUIRED', pointer: '/terrain' }]],
    ['champ inconnu bloc', `${FIXTURE}bloc: gauche\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/bloc' }]],
    ['version_schema 2', swap('version_schema: 1', 'version_schema: 2'), [{ code: 'SCHEMA_CONST', pointer: '/version_schema' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('sondage', text, expected));
});

describe('sondage : conformité', () => {
  it('aucun champ ne s’appelle "collection" (Pitfall 2)', () => {
    const text = readFileSync(path.join(SCHEMAS_DIR, 'sondage.schema.json'), 'utf8');
    assert.ok(!/"collection"\s*:/.test(text));
  });
});
