import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { DepotPriveError, readMeta, resolveArchivesDir, storeBinary, syncPrivate, type MetaBinaire } from '../../scripts/lib/private-store.ts';

const ENV_GIT = {
  GIT_AUTHOR_NAME: 'Test Archive',
  GIT_AUTHOR_EMAIL: 'test@exemple.invalid',
  GIT_COMMITTER_NAME: 'Test Archive',
  GIT_COMMITTER_EMAIL: 'test@exemple.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ENV_GIT }, stdio: ['ignore', 'pipe', 'pipe'] });

const dossiers: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-store-'));
  dossiers.push(d);
  return d;
};
after(() => {
  for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('resolveArchivesDir', () => {
  it('relatif à la racine de contenu, jamais au dossier courant', () => {
    const base = tmp();
    const racine = path.join(base, 'projet');
    mkdirSync(racine);
    mkdirSync(path.join(base, 'reveleTonProg-archives', '.git'), { recursive: true });
    assert.notEqual(process.cwd(), racine);
    assert.equal(resolveArchivesDir({}, racine), path.join(base, 'reveleTonProg-archives'));
    assert.equal(resolveArchivesDir({ RTP_ARCHIVES_DIR: '' }, racine), path.join(base, 'reveleTonProg-archives'));
  });

  it('RTP_ARCHIVES_DIR absolu, ou relatif résolu depuis la racine de contenu', () => {
    const base = tmp();
    const racine = path.join(base, 'projet');
    mkdirSync(racine);
    mkdirSync(path.join(base, 'ailleurs', '.git'), { recursive: true });
    assert.equal(resolveArchivesDir({ RTP_ARCHIVES_DIR: path.join(base, 'ailleurs') }, racine), path.join(base, 'ailleurs'));
    assert.equal(resolveArchivesDir({ RTP_ARCHIVES_DIR: '../ailleurs' }, racine), path.join(base, 'ailleurs'));
  });

  it('erreur qui nomme le dépôt quand le dossier n’est pas un clone git', () => {
    const base = tmp();
    const racine = path.join(base, 'projet');
    mkdirSync(racine);
    mkdirSync(path.join(base, 'reveleTonProg-archives'));
    assert.throws(() => resolveArchivesDir({}, racine), (e: unknown) => e instanceof DepotPriveError && /reveleTonProg-archives/.test(e.message));
    assert.throws(() => resolveArchivesDir({ RTP_ARCHIVES_DIR: '/nexiste/pas' }, racine), /reveleTonProg-archives/);
  });
});

const sha = (o: Uint8Array): string => createHash('sha256').update(o).digest('hex');
const metaPour = (binaire: Uint8Array, sourceId: string, capture = '2026-11-03T10:00:00+01:00'): MetaBinaire => ({
  source_id: sourceId,
  url_demandee: 'https://exemple.invalid/a',
  url_finale: 'https://exemple.invalid/a',
  statut_http: 200,
  content_type: 'text/html',
  bytes: binaire.byteLength,
  binaire_sha256: sha(binaire),
  extrait_sha256: 'e'.repeat(64),
  capture_le: capture,
  outil: 'fetch',
});

describe('storeBinary', () => {
  it('écrit <candidat>/<sha12>.<ext> et la fiche <sha12>--<source-id>.json, puis ne réécrit rien', () => {
    const dossier = tmp();
    const binaire = Buffer.from('<html>binaire</html>');
    const p = { dossier, candidat: 'marie-fictive', sourceId: 'source-a', binaire, extension: 'html' as const, meta: metaPour(binaire, 'source-a') };
    const sha12 = sha(binaire).slice(0, 12);
    const r1 = storeBinary(p);
    assert.deepEqual(r1.ecrits.sort(), [`marie-fictive/${sha12}--source-a.json`, `marie-fictive/${sha12}.html`]);
    assert.deepEqual(readFileSync(path.join(dossier, 'marie-fictive', `${sha12}.html`)), binaire);
    assert.equal(readMeta(dossier, 'marie-fictive', sha(binaire), 'source-a')?.outil, 'fetch');
    assert.deepEqual(storeBinary(p).ecrits, [], 'octets identiques : sans effet');
  });

  it('deux sources qui partagent un binaire écrivent deux fiches distinctes', () => {
    const dossier = tmp();
    const binaire = Buffer.from('%PDF-1.4 partagé');
    const base = { dossier, candidat: 'marie-fictive', binaire, extension: 'pdf' as const };
    storeBinary({ ...base, sourceId: 'source-a', meta: metaPour(binaire, 'source-a') });
    const r = storeBinary({ ...base, sourceId: 'source-b', meta: metaPour(binaire, 'source-b') });
    assert.deepEqual(r.ecrits, [`marie-fictive/${sha(binaire).slice(0, 12)}--source-b.json`], 'le binaire existe déjà');
    assert.equal(readMeta(dossier, 'marie-fictive', sha(binaire), 'source-a')?.source_id, 'source-a');
    assert.equal(readMeta(dossier, 'marie-fictive', sha(binaire), 'source-b')?.source_id, 'source-b');
  });

  it('met à jour la fiche quand la date de capture change', () => {
    const dossier = tmp();
    const binaire = Buffer.from('contenu');
    const base = { dossier, candidat: 'marie-fictive', sourceId: 'source-a', binaire, extension: 'html' as const };
    storeBinary({ ...base, meta: metaPour(binaire, 'source-a') });
    const r = storeBinary({ ...base, meta: metaPour(binaire, 'source-a', '2026-11-05T09:00:00+01:00') });
    assert.equal(r.ecrits.length, 1);
    assert.equal(readMeta(dossier, 'marie-fictive', sha(binaire), 'source-a')?.capture_le, '2026-11-05T09:00:00+01:00');
  });

  it('refuse un nom de dossier ou de source qui sortirait du dépôt, et des métadonnées incohérentes', () => {
    const dossier = tmp();
    const binaire = Buffer.from('x');
    const meta = metaPour(binaire, 'source-a');
    const base = { dossier, binaire, extension: 'html' as const, meta };
    assert.throws(() => storeBinary({ ...base, candidat: '../evil', sourceId: 'source-a' }), DepotPriveError);
    assert.throws(() => storeBinary({ ...base, candidat: 'marie-fictive', sourceId: 'a/../b' }), DepotPriveError);
    assert.throws(() => storeBinary({ ...base, candidat: 'marie-fictive', sourceId: 'source-a', meta: { ...meta, binaire_sha256: 'f'.repeat(64) } }), DepotPriveError);
    assert.equal(existsSync(path.join(dossier, 'marie-fictive')), false);
  });
});

describe('syncPrivate', () => {
  let base: string;
  let remote: string;
  let clone: string;
  const commitsDistants = (): number => Number(git(remote, 'rev-list', '--count', 'main').trim());

  before(() => {
    base = tmp();
    remote = path.join(base, 'remote.git');
    git(base, 'init', '--bare', '--quiet', '-b', 'main', remote);
    const amorce = path.join(base, 'amorce');
    git(base, 'clone', '--quiet', remote, amorce);
    git(amorce, 'checkout', '--quiet', '-B', 'main');
    writeFileSync(path.join(amorce, 'README.md'), 'privé\n');
    git(amorce, 'add', 'README.md');
    git(amorce, 'commit', '--quiet', '-m', 'init');
    git(amorce, 'push', '--quiet', '-u', 'origin', 'main');
    clone = path.join(base, 'clone');
    git(base, 'clone', '--quiet', remote, clone);
  });

  it('ajoute seulement les fichiers écrits, commit « archive: … », pousse', async () => {
    const avant = commitsDistants();
    mkdirSync(path.join(clone, 'c'), { recursive: true });
    writeFileSync(path.join(clone, 'c', 'a.txt'), 'a\n');
    writeFileSync(path.join(clone, 'autre.txt'), 'pas touché\n');
    const r = await syncPrivate({ dossier: clone, chemins: ['c/a.txt'], message: 'archive: source-a' });
    assert.deepEqual(r, { commit: true, pousse: true });
    assert.equal(commitsDistants(), avant + 1);
    assert.equal(git(remote, 'log', '-1', '--format=%s', 'main').trim(), 'archive: source-a');
    assert.deepEqual(git(remote, 'ls-tree', '-r', '--name-only', 'main').trim().split('\n').sort(), ['README.md', 'c/a.txt']);
    assert.match(git(clone, 'status', '--porcelain'), /\?\? autre\.txt/, 'le fichier étranger reste en attente');
    assert.equal(existsSync(path.join(clone, '.git', 'rtp-archive.lock')), false, 'verrou libéré');
  });

  it('tout envoyer (sans chemins), puis rien à commiter', async () => {
    const avant = commitsDistants();
    const r1 = await syncPrivate({ dossier: clone, message: 'archive: synchronisation' });
    assert.deepEqual(r1, { commit: true, pousse: true });
    assert.equal(commitsDistants(), avant + 1);
    const r2 = await syncPrivate({ dossier: clone, message: 'archive: synchronisation' });
    assert.deepEqual(r2, { commit: false, pousse: true });
    assert.equal(commitsDistants(), avant + 1);
  });

  it('intègre un commit arrivé entre-temps sur le dépôt distant (pull --rebase)', async () => {
    const autre = path.join(base, 'autre-clone');
    git(base, 'clone', '--quiet', remote, autre);
    writeFileSync(path.join(autre, 'venu-d-ailleurs.txt'), 'x\n');
    git(autre, 'add', 'venu-d-ailleurs.txt');
    git(autre, 'commit', '--quiet', '-m', 'ailleurs');
    git(autre, 'push', '--quiet', 'origin', 'main');
    writeFileSync(path.join(clone, 'local.txt'), 'y\n');
    const r = await syncPrivate({ dossier: clone, chemins: ['local.txt'], message: 'archive: local' });
    assert.equal(r.commit, true);
    const fichiers = git(remote, 'ls-tree', '-r', '--name-only', 'main').trim().split('\n');
    assert.ok(fichiers.includes('venu-d-ailleurs.txt') && fichiers.includes('local.txt'));
  });

  it('un verrou ancien est signalé et jamais retiré en silence', async () => {
    const verrou = path.join(clone, '.git', 'rtp-archive.lock');
    mkdirSync(verrou);
    const vieux = new Date(Date.now() - 30 * 60 * 1000);
    utimesSync(verrou, vieux, vieux);
    await assert.rejects(syncPrivate({ dossier: clone, message: 'archive: x', pasMs: 1, dormir: async () => undefined }), /verrou ancien/);
    assert.equal(existsSync(verrou), true, 'le verrou périmé reste en place');
    rmSync(verrou, { recursive: true });
  });

  it('un verrou récent fait attendre puis échoue après le délai, sans jamais le retirer', async () => {
    const verrou = path.join(clone, '.git', 'rtp-archive.lock');
    mkdirSync(verrou);
    let t = Date.now();
    let attentes = 0;
    await assert.rejects(
      syncPrivate({
        dossier: clone,
        message: 'archive: x',
        attenteMaxMs: 5000,
        pasMs: 1000,
        maintenant: () => t,
        dormir: async (ms) => {
          attentes++;
          t += ms;
        },
      }),
      /toujours pris/,
    );
    assert.ok(attentes >= 4, `attentes : ${attentes}`);
    assert.equal(existsSync(verrou), true);
    rmSync(verrou, { recursive: true });
  });

  it('prend le verrou dès qu’il est libéré pendant l’attente', async () => {
    const verrou = path.join(clone, '.git', 'rtp-archive.lock');
    mkdirSync(verrou);
    let appels = 0;
    const r = await syncPrivate({
      dossier: clone,
      message: 'archive: x',
      pasMs: 1,
      dormir: async () => {
        appels++;
        if (appels === 2) rmSync(verrou, { recursive: true });
      },
    });
    assert.equal(r.pousse, true);
    assert.ok(appels >= 2);
    assert.equal(existsSync(verrou), false);
  });
});
