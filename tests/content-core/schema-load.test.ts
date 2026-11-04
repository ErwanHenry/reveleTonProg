// WR-06 : un dossier de schémas cassé est une erreur de configuration explicite (SchemaLoadError,
// code de sortie 2 pour les CLI), détectée au chargement et non au premier fichier validé.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SchemaLoadError, checkSchemas } from '../../src/lib/content-core/ajv.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const tmpDirs: string[] = [];
/** Copie des vrais schémas dans un dossier neuf (le cache Ajv est indexé par dossier). */
function schemasCopy(): string {
  const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'rtp-schemas-')), 'schemas');
  tmpDirs.push(path.dirname(dir));
  cpSync(SCHEMAS_DIR, dir, { recursive: true });
  return dir;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function cli(script: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  // Depuis la Phase 3 le défaut est le vrai corpus : la fixture est explicite.
  const env = { ...process.env, RTP_CONTENT_ROOT: path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide') };
  const res = spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('checkSchemas', () => {
  it('les vrais schémas passent', () => {
    checkSchemas(SCHEMAS_DIR);
  });

  it('dossier introuvable : SchemaLoadError', () => {
    assert.throws(() => checkSchemas(path.join(os.tmpdir(), 'rtp-nope-schemas')), SchemaLoadError);
  });

  it('JSON invalide : SchemaLoadError qui nomme le fichier', () => {
    const dir = schemasCopy();
    writeFileSync(path.join(dir, 'theme.schema.json'), '{ pas du json');
    assert.throws(() => checkSchemas(dir), (e: Error) => e instanceof SchemaLoadError && e.message.includes('theme.schema.json'));
  });

  it('$id absent ou hors du préfixe : SchemaLoadError', () => {
    const dir = schemasCopy();
    const file = path.join(dir, 'theme.schema.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"\$id":\s*"[^"]+"/, '"$id": "https://exemple.invalid/theme"'));
    assert.throws(() => checkSchemas(dir), (e: Error) => e instanceof SchemaLoadError && e.message.includes('$id'));
  });

  it('faute détectée par le mode strict (required hors properties) : levée au chargement, sans fichier de contenu', () => {
    const dir = schemasCopy();
    const file = path.join(dir, 'journal.schema.json');
    const json = JSON.parse(readFileSync(file, 'utf8')) as { required: string[] };
    json.required.push('propriete_fantome');
    writeFileSync(file, JSON.stringify(json));
    assert.throws(() => checkSchemas(dir), (e: Error) => e instanceof SchemaLoadError && e.message.includes('journal'));
  });

  it('une collection sans schéma : SchemaLoadError qui la nomme', () => {
    const dir = schemasCopy();
    unlinkSync(path.join(dir, 'sondage.schema.json'));
    assert.throws(() => checkSchemas(dir), (e: Error) => e instanceof SchemaLoadError && e.message.includes('sondage'));
  });
});

describe('CLI : schémas inutilisables', () => {
  it('migrate --check --schemas introuvable : code 2, message, pas de trace de pile', () => {
    const r = cli('scripts/migrate.ts', ['--check', '--schemas', 'nope']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /Schémas inutilisables/);
    assert.doesNotMatch(r.stderr, /\n\s+at /);
  });

  it('validate --schemas cassé : code 2', () => {
    const dir = schemasCopy();
    writeFileSync(path.join(dir, 'theme.schema.json'), '{');
    const r = cli('scripts/validate.ts', ['--schemas', dir]);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /theme\.schema\.json/);
  });

  it('validate --schemas avec les vrais schémas : code 0', () => {
    assert.equal(cli('scripts/validate.ts', ['--schemas', SCHEMAS_DIR]).status, 0);
  });
});
