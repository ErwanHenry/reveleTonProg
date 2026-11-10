import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { comparer, construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { ElementAttendu, PiegeSpec, Remplacement } from '../helpers/overlay.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

// PUB-04 (plan 09-03, D-08 révisée) : une source citée par une mesure publiée a une copie Wayback, ou une
// exception motivée `archive.wayback_exception { motif, decide_par, decide_le }` que la règle accepte sans
// rien signaler. Une exception mal formée est une erreur de schéma : la source sort du corpus, jamais de
// passage silencieux. La liste des exceptions du corpus réel est épinglée : en ajouter une est un
// changement visible et relu.

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const SOURCE = 'src/content/sources/marie-fictive-programme.yaml';
const WAYBACK = '  wayback_url: https://web.archive.org/web/20261020100000/https://marie-fictive.exemple.invalid/programme\n';
const EXCEPTION = `  wayback_exception:
    motif: "La page d'origine affiche des données personnelles : elle n'est pas envoyée à la Wayback Machine."
    decide_par: Erwan Henry
    decide_le: 2026-11-10
`;

const spec = (remplacer: Remplacement[]): PiegeSpec => ({ piege: 'test', regle: 'REGLE-01', mode: 'production', remplacer, attendu: [] });
const err = (code: string, fichier: string, pointer: string): ElementAttendu => ({ code, severite: 'error', fichier, pointer });

/** Exceptions Wayback du corpus réel, triées. En ajouter une demande la décision écrite d'Erwan. */
const EXCEPTIONS_EPINGLEES: string[] = ['erwan-rohou-programme-mei'];

describe('PUB-04 : copie Wayback ou exception motivée', () => {
  it('exception valide à la place de wayback_url : aucun diagnostic en production', () => {
    comparer(executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: EXCEPTION }])), []);
  });

  it('ni wayback_url ni exception : ARCHIVE_WAYBACK_ABSENTE, message qui cite l’exception motivée', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: '' }]));
    comparer(r, [err('ARCHIVE_WAYBACK_ABSENTE', SOURCE, '/archive')]);
  });

  it('message d’ARCHIVE_WAYBACK_ABSENTE : se termine par la mention de l’exception motivée', () => {
    const racine = construireRacine(spec([{ fichier: SOURCE, de: WAYBACK, par: '' }]));
    const d = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'production' }).diagnostics.find((x) => x.code === 'ARCHIVE_WAYBACK_ABSENTE');
    assert.ok(d);
    assert.match(d.message, /ou une exception motivée \(archive\.wayback_exception\)$/);
  });

  // Une exception mal formée est une erreur de schéma de la source : la source sort du corpus et l'erreur
  // bloque la publication comme toute erreur ; la règle ne la voit jamais comme une exception valide.
  it('exception sans motif : erreur de schéma, jamais de passage silencieux', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: EXCEPTION.replace(/ {4}motif: .*\n/, '') }]));
    comparer(r, [err('SCHEMA_REQUIRED', SOURCE, '/archive/wayback_exception')]);
  });

  it('exception à côté de wayback_url : erreur de schéma sur wayback_url', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: `${WAYBACK}${EXCEPTION}` }]));
    comparer(r, [err('SCHEMA_FALSE', SOURCE, '/archive/wayback_url')]);
  });

  it('exception valide mais mesure en brouillon : rien non plus', () => {
    const r = executerPiege(spec([{ fichier: SOURCE, de: WAYBACK, par: EXCEPTION }, { fichier: MESURE, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' }]));
    assert.deepEqual(r.filter((d) => d.fichier === SOURCE), []);
  });
});

describe('PUB-04 : liste épinglée des exceptions du corpus réel', () => {
  it('les sources portant archive.wayback_exception sont exactement la liste épinglée', () => {
    const dossier = path.join(REPO_ROOT, 'src', 'content', 'sources');
    const ids = readdirSync(dossier)
      .filter((n) => n.endsWith('.yaml'))
      .filter((n) => {
        const doc = parse(readFileSync(path.join(dossier, n), 'utf8'), { schema: 'core' }) as { archive?: Record<string, unknown> } | null;
        return doc?.archive?.wayback_exception !== undefined;
      })
      .map((n) => n.slice(0, -5))
      .sort();
    assert.deepEqual(ids, EXCEPTIONS_EPINGLEES);
  });
});
