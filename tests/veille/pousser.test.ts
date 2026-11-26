// Phase 10.3 plan 05 : poussée en avance rapide, uniquement contre un dépôt nu local (aucun réseau, aucun vrai moyen de push).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { ErreurConfigLocale } from '../../scripts/lib/config-locale.ts';
import { lireConfigPush, preparerPush, pousserAvanceRapide, sonderPush } from '../../scripts/lib/veille/pousser.ts';
import type { ExecuterEnv } from '../../scripts/lib/veille/pousser.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-pousser-'));
  dossiers.push(d);
  return d;
};

const reel: ExecuterEnv = (cmd, args, o) => {
  const r = spawnSync(cmd, args, { cwd: o?.cwd, env: o?.env ?? process.env, encoding: 'utf8', timeout: o?.timeoutMs });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};
const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  assert.equal(r.status, 0, `${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const identite = (cwd: string): void => {
  git(cwd, 'config', 'user.name', 'Test');
  git(cwd, 'config', 'user.email', 'test@example.invalid');
  git(cwd, 'config', 'commit.gpgsign', 'false');
};
const commit = (cwd: string, nom: string): string => {
  writeFileSync(path.join(cwd, nom), nom);
  git(cwd, 'add', nom);
  git(cwd, 'commit', '-q', '-m', nom);
  return git(cwd, 'rev-parse', 'HEAD');
};

function depots(): { nu: string; travail: string; base: string } {
  const d = tmp();
  const nu = path.join(d, 'origine.git');
  git(d, 'init', '-q', '--bare', '-b', 'main', nu);
  const travail = path.join(d, 'travail');
  git(d, 'clone', '-q', nu, travail);
  identite(travail);
  git(travail, 'checkout', '-q', '-B', 'main');
  const base = commit(travail, 'a.txt');
  git(travail, 'push', '-q', 'origin', 'main');
  return { nu, travail, base };
}

const envTest = { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };

describe('pousserAvanceRapide', () => {
  it('avance rapide : pousse, main distant = sha', () => {
    const { nu, travail } = depots();
    const sha = commit(travail, 'b.txt');
    assert.equal(pousserAvanceRapide({ worktree: travail, sha, destination: nu, env: envTest, configGit: [], executer: reel }), 'pousse');
    assert.equal(git(nu, 'rev-parse', 'refs/heads/main'), sha);
  });
  it('main a avancé ailleurs : main_a_avance, main distant inchangé', () => {
    const { nu, travail, base } = depots();
    const d = path.dirname(nu);
    const autre = path.join(d, 'autre');
    git(d, 'clone', '-q', nu, autre);
    identite(autre);
    const avance = commit(autre, 'c.txt');
    git(autre, 'push', '-q', 'origin', 'main');
    const sha = commit(travail, 'b.txt');
    assert.notEqual(sha, base);
    assert.equal(pousserAvanceRapide({ worktree: travail, sha, destination: nu, env: envTest, configGit: [], executer: reel }), 'main_a_avance');
    assert.equal(git(nu, 'rev-parse', 'refs/heads/main'), avance);
  });
  it('destination introuvable : push_echec', () => {
    const { travail } = depots();
    const sha = git(travail, 'rev-parse', 'HEAD');
    assert.equal(pousserAvanceRapide({ worktree: travail, sha, destination: path.join(os.tmpdir(), 'rtp-inexistant-xyz.git'), env: envTest, configGit: [], executer: reel }), 'push_echec');
  });
  it('panne réseau reconnue dans stderr : hors_ligne', () => {
    const faux: ExecuterEnv = () => ({ status: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' });
    assert.equal(pousserAvanceRapide({ worktree: '/x', sha: 'a'.repeat(40), destination: 'd', env: {}, configGit: [], executer: faux }), 'hors_ligne');
  });
  it('arguments : refspec exacte, aucune option de force', () => {
    const vus: string[][] = [];
    const faux: ExecuterEnv = (_c, args) => {
      vus.push(args);
      return { status: 0, stdout: '', stderr: '' };
    };
    const sha = 'd'.repeat(40);
    pousserAvanceRapide({ worktree: '/w', sha, destination: 'dest', env: {}, configGit: ['-c', 'x=y'], executer: faux });
    const args = vus[0] ?? [];
    assert.ok(args.includes(`${sha}:refs/heads/main`));
    for (const a of args) assert.doesNotMatch(a, /^(--force|-f|--force-with-lease.*|\+.*)$/);
  });
});

describe('sonderPush', () => {
  it('rend le SHA de main ou une raison fixe', () => {
    const { nu, base } = depots();
    assert.deepEqual(sonderPush({ destination: nu, env: envTest, configGit: [], executer: reel }), { ok: true, main: base });
    const r = sonderPush({ destination: path.join(os.tmpdir(), 'rtp-inexistant-xyz.git'), env: envTest, configGit: [], executer: reel });
    assert.equal(r.ok, false);
  });
});

describe('configuration du moyen de push', () => {
  const DEPOT_SSH = 'git@github.com:ErwanHenry/reveleTonProg.git';
  const DEPOT_HTTPS = 'https://github.com/ErwanHenry/reveleTonProg.git';
  const prep = (lignes: string[], fichiers: Record<string, string> = { cle: 'CLE', kh: 'KH', jeton: 'JETON-SECRET-FICTIF' }): string => {
    const home = tmp();
    const conf = path.join(home, '.config', 'rtp');
    mkdirSync(conf, { recursive: true });
    for (const [n, c] of Object.entries(fichiers)) {
      writeFileSync(path.join(conf, n), c, { mode: 0o600 });
      chmodSync(path.join(conf, n), 0o600);
    }
    writeFileSync(path.join(conf, 'push-auto.env'), `${lignes.join('\n')}\n`, { mode: 0o600 });
    chmodSync(path.join(conf, 'push-auto.env'), 0o600);
    return home;
  };
  it('mode clé : GIT_SSH_COMMAND durci', () => {
    const home = prep([`RTP_PUSH_DEPOT=${DEPOT_SSH}`, 'RTP_PUSH_CLE=~/.config/rtp/cle', 'RTP_PUSH_KNOWN_HOSTS=~/.config/rtp/kh']);
    const cfg = lireConfigPush(home);
    assert.equal(cfg.mode, 'cle');
    const p = preparerPush(cfg);
    assert.match(p.env.GIT_SSH_COMMAND ?? '', /IdentitiesOnly=yes.*IdentityAgent=none.*BatchMode=yes.*StrictHostKeyChecking=yes/);
    assert.match(p.env.GIT_SSH_COMMAND ?? '', /-i '.*\/cle'/);
    assert.deepEqual(p.configGit, []);
  });
  it('mode jeton : le secret n\'est ni en argument ni dans l\'environnement', () => {
    const home = prep([`RTP_PUSH_DEPOT=${DEPOT_HTTPS}`, 'RTP_PUSH_JETON=~/.config/rtp/jeton']);
    const p = preparerPush(lireConfigPush(home));
    assert.equal(p.configGit[0], '-c');
    assert.equal(p.configGit[1], 'credential.helper=');
    assert.match(p.configGit[3] ?? '', /^credential\.helper=!f\(\)/);
    assert.equal(p.env.GIT_TERMINAL_PROMPT, '0');
    const tout = JSON.stringify([p.configGit, Object.entries(p.env)]);
    assert.doesNotMatch(tout, /JETON-SECRET-FICTIF/);
    assert.match(p.env.RTP_PUSH_JETON_FICHIER ?? '', /\/jeton$/);
  });
  it('refus : autre dépôt, mélange des voies, clé manquante, droits trop larges', () => {
    const autres = ['https://github.com/Autre/reveleTonProg.git', 'http://github.com/ErwanHenry/reveleTonProg.git', 'https://exemple.org/ErwanHenry/reveleTonProg.git'];
    for (const d of autres) assert.throws(() => lireConfigPush(prep([`RTP_PUSH_DEPOT=${d}`, 'RTP_PUSH_JETON=~/.config/rtp/jeton'])), ErreurConfigLocale);
    assert.throws(() => lireConfigPush(prep([`RTP_PUSH_DEPOT=${DEPOT_SSH}`, 'RTP_PUSH_CLE=~/.config/rtp/cle', 'RTP_PUSH_JETON=~/.config/rtp/jeton', 'RTP_PUSH_KNOWN_HOSTS=~/.config/rtp/kh'])), ErreurConfigLocale);
    assert.throws(() => lireConfigPush(prep([`RTP_PUSH_DEPOT=${DEPOT_SSH}`])), ErreurConfigLocale);
    assert.throws(() => lireConfigPush(prep([`RTP_PUSH_DEPOT=${DEPOT_SSH}`, 'RTP_PUSH_CLE=~/.config/rtp/cle'])), ErreurConfigLocale);
    const home = prep([`RTP_PUSH_DEPOT=${DEPOT_HTTPS}`, 'RTP_PUSH_JETON=~/.config/rtp/jeton']);
    chmodSync(path.join(home, '.config', 'rtp', 'jeton'), 0o644);
    assert.throws(() => lireConfigPush(home), (e: unknown) => e instanceof ErreurConfigLocale && !e.message.includes('JETON-SECRET-FICTIF'));
  });
});
