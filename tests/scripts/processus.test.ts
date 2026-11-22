// Lancement isolé et arrêt demandé (scripts/lib/processus.ts ; revue de la phase 9.2 : CR-01, WR-04, WR-05, WR-07).
// Processus factices (sh, sleep, node) dans un dossier temporaire ; aucun réseau. Chaque processus laissé en vie par
// un cas est tué à la fin, même en échec.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lancer } from '../../scripts/lib/processus.ts';

const ENV = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
const DELAI = 120_000;
const dossiers: string[] = [];
const pids: number[] = [];
after(() => {
  for (const p of pids) {
    try {
      process.kill(p, 'SIGKILL');
    } catch {
      // déjà mort
    }
  }
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
function temp(): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-processus-')));
  dossiers.push(d);
  return d;
}
const vivant = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pgid = (pid: number): string => spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim();
const lirePid = (f: string): number => {
  const n = Number.parseInt(readFileSync(f, 'utf8').trim(), 10);
  pids.push(n);
  return n;
};
async function attendreMort(pid: number, ms = 10_000): Promise<boolean> {
  const fin = Date.now() + ms;
  while (vivant(pid) && Date.now() < fin) await new Promise((r) => setTimeout(r, 100));
  return !vivant(pid);
}

describe('lancer isolé (CR-01, WR-04, WR-07)', () => {
  it('nouveau groupe et nouvelle session : pgid égal à son pid, différent de celui du parent', async () => {
    const r = await lancer({ commande: 'sh', args: ['-c', 'echo $$; ps -o pgid= -p $$'], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'groupe', isole: true });
    const [pid, groupe] = r.stdout.trim().split(/\s+/);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(groupe, pid);
    assert.notEqual(groupe, pgid(process.pid));
  });

  it('sans isolement : même groupe que le parent', async () => {
    const r = await lancer({ commande: 'sh', args: ['-c', 'ps -o pgid= -p $$'], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'groupe' });
    assert.equal(r.stdout.trim(), pgid(process.pid));
  });

  it('un descendant resté dans le groupe est tué quand le processus se termine, même s\'il garde la sortie ouverte', async () => {
    const d = temp();
    const f = path.join(d, 'pid');
    const debut = Date.now();
    const r = await lancer({ commande: 'sh', args: ['-c', `sleep 300 & echo $! > '${f}'; exit 0`], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'survivant', isole: true });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(Date.now() - debut < 60_000, 'lancer n\'a pas attendu le descendant');
    assert.ok(await attendreMort(lirePid(f)), 'descendant encore vivant');
  });

  it('un descendant qui crée sa propre session et garde la sortie ouverte ne bloque pas la fin (délai de grâce)', async () => {
    const d = temp();
    const f = path.join(d, 'pid');
    const script = `const c = require('child_process').spawn('sleep', ['300'], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] }); require('fs').writeFileSync(${JSON.stringify(f)}, String(c.pid)); c.unref();`;
    const debut = Date.now();
    const r = await lancer({ commande: process.execPath, args: ['-e', script], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'évadé', isole: true });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(Date.now() - debut < 60_000, 'lancer a attendu la fin du descendant évadé');
    const p = lirePid(f);
    assert.ok(vivant(p), 'le filet ne prétend pas tuer un descendant sorti du groupe');
  });
});

describe('arrêt demandé (WR-05)', () => {
  it('signal d\'arrêt pendant l\'exécution : le processus et son groupe sont tués', async () => {
    const d = temp();
    const f = path.join(d, 'pid');
    const arret = new AbortController();
    const p = lancer({ commande: 'sh', args: ['-c', `sleep 300 & echo $! > '${f}'; wait`], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'long', isole: true, arret: arret.signal });
    const fin = Date.now() + 30_000;
    while (!existsSync(f) && Date.now() < fin) await new Promise((r) => setTimeout(r, 50));
    arret.abort();
    const r = await p;
    assert.notEqual(r.code, 0);
    assert.ok(await attendreMort(lirePid(f)), 'petit-enfant encore vivant');
  });

  it('arrêt déjà demandé : rien n\'est lancé', async () => {
    const d = temp();
    const f = path.join(d, 'temoin');
    const arret = new AbortController();
    arret.abort();
    const r = await lancer({ commande: 'sh', args: ['-c', `: > '${f}'`], cwd: '/', env: ENV, delaiMs: DELAI, libelle: 'jamais', arret: arret.signal });
    assert.equal(r.code, null);
    assert.match(r.stderr, /arrêt demandé, non lancé/);
    assert.equal(existsSync(f), false);
  });
});
