import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModeInvalideError, resolveMode } from '../../src/lib/content-core/root.ts';
import { PIEGES_DIR, construireRacine, lirePiege, nettoyerRacines } from '../helpers/overlay.ts';
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
  nettoyerRacines();
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

describe('resolveMode (REGLE-11, fail-closed)', () => {
  it('le drapeau, puis RTP_MODE, puis production', () => {
    assert.equal(resolveMode('preview'), 'preview');
    assert.equal(resolveMode('production'), 'production');
    assert.equal(resolveMode(undefined, { RTP_MODE: 'preview' }), 'preview');
    assert.equal(resolveMode('production', { RTP_MODE: 'preview' }), 'production');
    assert.equal(resolveMode('preview', { RTP_MODE: 'n’importe quoi' }), 'preview');
    assert.equal(resolveMode(undefined, {}), 'production');
    assert.equal(resolveMode(undefined, { RTP_MODE: '' }), 'production');
    assert.equal(resolveMode('', { RTP_MODE: 'preview' }), 'preview');
  });

  it('toute autre valeur lève ModeInvalideError et nomme les valeurs admises', () => {
    for (const bad of ['prod', 'Preview', ' preview', 'xyz']) {
      assert.throws(() => resolveMode(bad), (e: unknown) => e instanceof ModeInvalideError && /preview/.test(e.message) && /production/.test(e.message));
      assert.throws(() => resolveMode(undefined, { RTP_MODE: bad }), ModeInvalideError);
    }
  });
});

describe('npm run validate : --mode et RTP_MODE', () => {
  it('--mode xyz et RTP_MODE=xyz : code 2 et usage sur stderr', () => {
    const flag = cli(['--mode', 'xyz']);
    assert.equal(flag.status, 2, flag.stdout + flag.stderr);
    assert.match(flag.stderr, /Usage/);
    const env = cli([], { RTP_MODE: 'xyz' });
    assert.equal(env.status, 2, env.stdout + env.stderr);
    assert.match(env.stderr, /Usage/);
    assert.match(env.stderr, /RTP_MODE|mode/);
  });

  it('--mode preview et --mode production : code 0 et le résumé nomme le mode', () => {
    for (const mode of ['preview', 'production']) {
      const res = cli(['--mode', mode]);
      assert.equal(res.status, 0, res.stdout + res.stderr);
      assert.match(res.stdout, /content-core : \d+ fichier\(s\), 0 erreur\(s\), 0 avertissement\(s\)/);
      assert.match(res.stdout.trimEnd(), new RegExp(`, mode ${mode}$`));
    }
  });

  it('par défaut production ; RTP_MODE=preview est lu ; le drapeau prime sur RTP_MODE', () => {
    assert.match(cli([]).stdout.trimEnd(), /, mode production$/);
    assert.match(cli([], { RTP_MODE: 'preview' }).stdout.trimEnd(), /, mode preview$/);
    assert.match(cli([], { RTP_MODE: '' }).stdout.trimEnd(), /, mode production$/);
    const flagWins = cli(['--mode', 'preview'], { RTP_MODE: 'xyz' });
    assert.equal(flagWins.status, 0, flagWins.stdout + flagWins.stderr);
    assert.match(flagWins.stdout.trimEnd(), /, mode preview$/);
  });
});

describe('npm run validate : contrat d’annotations CI (REGLE-11)', () => {
  const piegeRoot = (nom: string): string => {
    const dossier = path.join(PIEGES_DIR, nom);
    return construireRacine(lirePiege(dossier), dossier);
  };

  it('SOURCE_ABSENTE : ligne de texte et annotation ::error avec fichier, ligne, colonne et code', () => {
    const racine = piegeRoot('SOURCE_ABSENTE');
    const res = cli(['--root', racine, '--format', 'github', '--mode', 'production']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /^.*encadrement-loyers\.yaml:7:\d+ SOURCE_ABSENTE /m);
    assert.match(res.stdout, /^::error file=[^\n]*encadrement-loyers\.yaml,line=7,col=\d+,title=SOURCE_ABSENTE::/m);
  });

  it('SONDAGE_NOTICE_ABSENTE : annotation sur la ligne d’url_publication', () => {
    const racine = piegeRoot('SONDAGE_NOTICE_ABSENTE');
    const res = cli(['--root', racine, '--format', 'github']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /^.*sondage-fictif-1\.yaml:15:\d+ SONDAGE_NOTICE_ABSENTE /m);
    assert.match(res.stdout, /^::error file=[^\n]*sondage-fictif-1\.yaml,line=15,col=\d+,title=SONDAGE_NOTICE_ABSENTE::/m);
  });

  it('scripts/validate.ts n’écrit aucune annotation lui-même', () => {
    assert.ok(!readFileSync(path.join(REPO_ROOT, 'scripts', 'validate.ts'), 'utf8').includes('::error'));
  });
});
