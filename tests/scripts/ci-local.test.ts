// CI locale (LOC-01) : lanceur de processus (scripts/lib/processus.ts), puis exécution des étapes, reçu et verrou
// (scripts/lib/ci-local.ts, scripts/ci-local.ts). Aucun test ne touche le vrai ~/.cache/rtp : le dossier personnel
// est un dossier temporaire injecté.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { envDeBase, lancer } from '../../scripts/lib/processus.ts';

const NODE = process.execPath;
const ENV_MIN = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
const DELAI = 60_000;

describe('envDeBase', () => {
  it('garde la liste blanche, ajoute TZ et la télémétrie coupée, retire le reste', () => {
    const env = envDeBase({ PATH: 'p', HOME: 'h', SSH_AUTH_SOCK: 's', RTP_HOTE: 'x', GITHUB_TOKEN: 't' });
    assert.deepEqual(env, { PATH: 'p', HOME: 'h', TZ: 'Europe/Paris', ASTRO_TELEMETRY_DISABLED: '1' });
  });

  it('garde USER, LOGNAME, SHELL, TMPDIR, LANG, LC_ALL, LC_CTYPE, TERM', () => {
    const source = { USER: 'u', LOGNAME: 'l', SHELL: 's', TMPDIR: 't', LANG: 'fr', LC_ALL: 'a', LC_CTYPE: 'c', TERM: 'x', NPM_TOKEN: 'n' };
    const env = envDeBase(source);
    for (const k of Object.keys(source).filter((k) => k !== 'NPM_TOKEN')) assert.equal(env[k], source[k as keyof typeof source]);
    assert.equal(env.NPM_TOKEN, undefined);
  });
});

describe('lancer', () => {
  it('capture stdout, stderr et le code de sortie', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'process.stdout.write("sortie");process.stderr.write("erreur");process.exit(3)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: DELAI,
      libelle: 'test',
    });
    assert.equal(r.code, 3);
    assert.equal(r.stdout, 'sortie');
    assert.equal(r.stderr, 'erreur');
    assert.equal(r.delaiDepasse, false);
    assert.ok(r.dureeMs >= 0);
  });

  it('tue le processus au-delà du délai', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'setTimeout(() => {}, 120000)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: 500,
      libelle: 'attente',
    });
    assert.equal(r.delaiDepasse, true);
    assert.notEqual(r.code, 0);
  });

  it('écrit l’entrée sur stdin', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      entree: 'bonjour',
      delaiMs: DELAI,
      libelle: 'stdin',
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'bonjour');
  });

  it('passe exactement l’environnement donné, jamais process.env', async () => {
    process.env.SSH_AUTH_SOCK_TEST_CI_LOCAL = 'fuite';
    try {
      const r = await lancer({
        commande: NODE,
        args: ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))'],
        cwd: process.cwd(),
        env: { ...ENV_MIN, VARIABLE_DONNEE: '1' },
        delaiMs: DELAI,
        libelle: 'env',
      });
      assert.deepEqual(JSON.parse(r.stdout), ['PATH', 'VARIABLE_DONNEE']);
    } finally {
      delete process.env.SSH_AUTH_SOCK_TEST_CI_LOCAL;
    }
  });

  it('commande introuvable : code null et message, sans exception', async () => {
    const r = await lancer({
      commande: 'commande-qui-n-existe-pas-ci-local',
      args: [],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: DELAI,
      libelle: 'absente',
    });
    assert.equal(r.code, null);
    assert.match(r.stderr, /introuvable|ENOENT/);
  });
});
