import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const FIXTURE_TEXT = readFileSync(path.join(FIXTURE_ROOT, 'src', 'content', 'candidats', 'marie-fictive.yaml'), 'utf8');
const NO_STATUTS = FIXTURE_TEXT.replace(/^statuts:[\s\S]*$/m, '');

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-cli-'));
  tmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function cli(args: string[], env: NodeJS.ProcessEnv = {}): { status: number | null; stdout: string; stderr: string } {
  const base = { ...process.env };
  delete base.RTP_CONTENT_ROOT;
  const res = spawnSync(process.execPath, ['scripts/validate.ts', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...base, ...env },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}
function candidatsDir(root: string): string {
  const dir = path.join(root, 'src', 'content', 'candidats');
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('npm run validate (scripts/validate.ts)', () => {
  it('sans option : valide le corpus fictif, code 0 et résumé', () => {
    const res = cli([]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /content-core : \d+ fichier\(s\), 0 erreur\(s\), 0 avertissement\(s\)/);
  });

  it('un candidat sans statuts : code 1 et fichier:ligne:col SCHEMA_REQUIRED', () => {
    const root = tmpRoot();
    writeFileSync(path.join(candidatsDir(root), 'marie-fictive.yaml'), NO_STATUTS);
    const res = cli(['--root', root]);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/);
  });

  it('--format github : exactement 10 annotations ::error pour 12 fichiers cassés', () => {
    const root = tmpRoot();
    for (let i = 0; i < 12; i++) writeFileSync(path.join(candidatsDir(root), `marie-fictive-${i}.yaml`), NO_STATUTS);
    const res = cli(['--root', root, '--format', 'github']);
    assert.equal(res.status, 1);
    const out = res.stdout.split('\n');
    assert.equal(out.filter((l) => l.startsWith('::error file=')).length, 10);
    assert.ok(out.filter((l) => l.length > 0 && !l.startsWith('::')).length >= 12);
  });

  it('RTP_CONTENT_ROOT vers un src/content vide : code 0 et 0 fichier explicite', () => {
    const root = tmpRoot();
    mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
    const res = cli([], { RTP_CONTENT_ROOT: root });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /0 fichier\(s\)/);
  });

  it('racine ou src/content introuvable : code 1 et RACINE_INTROUVABLE (CR-01)', () => {
    const typo = cli(['--root', path.join(tmpRoot(), 'nope', 'typo')]);
    assert.equal(typo.status, 1, typo.stdout + typo.stderr);
    assert.match(typo.stdout, /RACINE_INTROUVABLE/);
    const noContent = cli([], { RTP_CONTENT_ROOT: tmpRoot() });
    assert.equal(noContent.status, 1, noContent.stdout + noContent.stderr);
    assert.match(noContent.stdout, /RACINE_INTROUVABLE/);
  });

  it('--root prime sur RTP_CONTENT_ROOT', () => {
    const copy = tmpRoot();
    cpSync(FIXTURE_ROOT, copy, { recursive: true });
    const res = cli(['--root', copy], { RTP_CONTENT_ROOT: tmpRoot() });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.doesNotMatch(res.stdout, /\b0 fichier/);
  });

  it('option inconnue ou format invalide : code 2 et usage sur stderr', () => {
    const unknown = cli(['--nope']);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /Usage/);
    assert.equal(cli(['--format', 'xml']).status, 2);
  });
});
