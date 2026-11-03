import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const MARIE = path.join('src', 'content', 'candidats', 'marie-fictive.yaml');

const tmpDirs: string[] = [];
function tmpDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-migrate-cli-'));
  tmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

/** Copie du corpus fictif où marie-fictive porte version_schema: 0. */
function v0Copy(): { root: string; file: string } {
  const root = path.join(tmpDir(), 'corpus');
  cpSync(FIXTURE_ROOT, root, { recursive: true });
  const file = path.join(root, MARIE);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^version_schema: 1$/m, 'version_schema: 0'));
  return { root, file };
}

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const env = { ...process.env };
  delete env.RTP_CONTENT_ROOT;
  const res = spawnSync(process.execPath, ['scripts/migrate.ts', ...args], { cwd: REPO_ROOT, encoding: 'utf8', env });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('npm run migrate (scripts/migrate.ts)', () => {
  it('--check sur le corpus par défaut : code 0 et résumé', () => {
    const r = cli(['--check']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /migrate : \d+ fichier\(s\) à jour, 0 en retard/);
  });

  it('--check sur une copie où marie-fictive est en v0 : code 1, MIGRATION_EN_RETARD localisé', () => {
    const { root } = v0Copy();
    const r = cli(['--check', '--root', root]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /marie-fictive\.yaml:\d+:\d+ MIGRATION_EN_RETARD/);
    assert.match(r.stdout, /npm run migrate -- --write/);
    assert.match(r.stdout, /1 en retard/);
  });

  it('simulation de bump de schéma : --check --schemas (candidat en const 2) signale les deux candidats', () => {
    const schemas = path.join(tmpDir(), 'schemas');
    cpSync(path.join(REPO_ROOT, 'schemas'), schemas, { recursive: true });
    const file = path.join(schemas, 'candidat.schema.json');
    const json = readFileSync(file, 'utf8');
    assert.ok(json.includes('"version_schema": { "const": 1 }'));
    writeFileSync(file, json.replace('"version_schema": { "const": 1 }', '"version_schema": { "const": 2 }'));

    const r = cli(['--check', '--schemas', schemas]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const lines = r.stdout.split('\n').filter((l) => l.includes('MIGRATION_EN_RETARD'));
    assert.equal(lines.length, 2);
    assert.ok(lines.some((l) => l.includes('marie-fictive.yaml')));
    assert.ok(lines.some((l) => l.includes('jean-imaginaire.yaml')));
  });

  it('--write avec le registre réel (vide) : code 1, MIGRATION_CHAINE_MANQUANTE, fichier inchangé', () => {
    const { root, file } = v0Copy();
    const before = readFileSync(file, 'utf8');
    const r = cli(['--write', '--root', root]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /MIGRATION_CHAINE_MANQUANTE/);
    assert.match(r.stdout, /Aucune migration candidat v0 -> v1/);
    assert.equal(readFileSync(file, 'utf8'), before);
  });

  it('--write sur un corpus à jour : code 0, rien de réécrit', () => {
    const r = cli(['--write']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /0 fichier\(s\) réécrit\(s\), 0 erreur\(s\)/);
  });

  it('racine ou src/content introuvable : code 1 en --check comme en --write, une seule fois (CR-01)', () => {
    const nope = path.join(tmpDir(), 'nope');
    const check = cli(['--check', '--root', nope]);
    assert.equal(check.status, 1, check.stdout + check.stderr);
    assert.match(check.stdout, /RACINE_INTROUVABLE/);
    const write = cli(['--write', '--root', nope]);
    assert.equal(write.status, 1, write.stdout + write.stderr);
    assert.equal(write.stdout.split('\n').filter((l) => l.includes('RACINE_INTROUVABLE')).length, 1);
    const noContent = tmpDir();
    assert.equal(cli(['--check', '--root', noContent]).status, 1);
  });

  it('src/content existant mais vide : code 0 (accepté jusqu’à la Phase 3)', () => {
    const root = tmpDir();
    mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
    const r = cli(['--check', '--root', root]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /0 fichier\(s\) à jour/);
  });

  it('sans option de mode : code 2 et usage', () => {
    const r = cli([]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Usage/);
  });

  it('--check et --write ensemble : code 2', () => {
    const r = cli(['--check', '--write']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /exclusifs/);
  });

  it('format inconnu : code 2', () => {
    assert.equal(cli(['--check', '--format', 'xml']).status, 2);
  });

  it('--format github sur la copie v0 : annotation ::error file=', () => {
    const { root } = v0Copy();
    const r = cli(['--check', '--root', root, '--format', 'github']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^::error file=.*marie-fictive\.yaml,line=\d+,col=\d+,title=MIGRATION_EN_RETARD::/m);
  });
});
