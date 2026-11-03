// Parité Astro / CLI (DATA-07) : le loader Astro appelle le même loadAll que `npm run validate`.
// Aucun processus enfant : on appelle load() avec un contexte Astro simulé.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contentCoreLoader } from '../../src/lib/content-core/astro-loader.ts';
import { COLLECTION_NAMES } from '../../src/lib/content-core/collections.ts';
import type { CollectionName } from '../../src/lib/content-core/collections.ts';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { resolveContentRoot, schemasDirOf } from '../../src/lib/content-core/root.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');

interface StoredEntry {
  id: string;
  data: Record<string, unknown>;
  digest?: string;
  filePath?: string;
}

function makeContext(messages: string[]) {
  const map = new Map<string, StoredEntry>();
  const store = {
    clear: () => map.clear(),
    set: (e: StoredEntry) => {
      map.set(e.id, e);
      return true;
    },
    get: (id: string) => map.get(id),
    keys: () => [...map.keys()],
    values: () => [...map.values()],
    entries: () => [...map.entries()],
  };
  const ctx = {
    config: { root: pathToFileURL(REPO_ROOT + '/') },
    store,
    generateDigest: (d: unknown) => createHash('sha256').update(JSON.stringify(d)).digest('hex'),
    logger: {
      error: (m: string) => messages.push(m),
      warn: (m: string) => messages.push(m),
      info: () => {},
      debug: () => {},
    },
    watcher: undefined,
  };
  return { ctx, map };
}

type Ctx = Parameters<ReturnType<typeof contentCoreLoader>['load']>[0];

const tmpDirs: string[] = [];
async function withEnv<T>(root: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.RTP_CONTENT_ROOT;
  if (root === undefined) delete process.env.RTP_CONTENT_ROOT;
  else process.env.RTP_CONTENT_ROOT = root;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.RTP_CONTENT_ROOT;
    else process.env.RTP_CONTENT_ROOT = before;
  }
}

after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('parité du loader Astro avec content-core', () => {
  it('stocke les mêmes ids et les mêmes données que loadAll, dates en chaînes', async () => {
    const messages: string[] = [];
    const { ctx, map } = makeContext(messages);
    await withEnv(undefined, () => contentCoreLoader('candidats').load(ctx as unknown as Ctx));

    const res = loadAll(resolveContentRoot(REPO_ROOT, {}), { schemasDir: schemasDirOf(REPO_ROOT) });
    const expected = res.entries.filter((e) => e.collection === 'candidats');
    assert.ok(expected.length >= 1, 'la fixture doit contenir au moins un candidat');
    assert.deepEqual([...map.keys()].sort(), expected.map((e) => e.id).sort());
    for (const e of expected) assert.deepEqual(map.get(e.id)?.data, e.data);

    const marie = map.get('marie-fictive');
    assert.ok(marie, 'marie-fictive doit être dans le store');
    const statuts = marie.data.statuts as { date: unknown }[];
    assert.strictEqual(statuts[1]?.date, '2026-10-15');
    assert.equal(typeof statuts[1]?.date, 'string');
    assert.equal(marie.filePath, 'tests/fixtures/corpus-valide/src/content/candidats/marie-fictive.yaml');
    assert.equal(messages.length, 0);
  });

  it("rejette avec « erreur(s) de contenu » sur une racine cassée et journalise chaque diagnostic une fois", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-parity-'));
    tmpDirs.push(root);
    fs.cpSync(FIXTURE_ROOT, root, { recursive: true });
    const file = path.join(root, 'src', 'content', 'candidats', 'marie-fictive.yaml');
    const source = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, source.slice(0, source.indexOf('statuts:')));

    const messages: string[] = [];
    const results = await withEnv(root, () =>
      Promise.allSettled(
        COLLECTION_NAMES.map((name: CollectionName) => contentCoreLoader(name).load(makeContext(messages).ctx as unknown as Ctx)),
      ),
    );
    assert.equal(results.length, 8);
    for (const r of results) {
      assert.equal(r.status, 'rejected');
      assert.match(String((r as PromiseRejectedResult).reason), /erreur\(s\) de contenu/);
    }
    const res = loadAll(root, { schemasDir: schemasDirOf(REPO_ROOT) });
    const errors = res.diagnostics.filter((d) => d.severity === 'error');
    assert.ok(errors.length >= 1);
    assert.equal(messages.length, errors.length, `chaque diagnostic une seule fois : ${messages.join(' | ')}`);
    assert.equal(messages.filter((m) => /marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/.test(m)).length, 1);
  });
});

describe('robustesse du loader (WR-05)', () => {
  /** Racine de projet sans dossier schemas/ : le chargement lève une exception d'E/S. */
  function brokenProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-noschemas-'));
    tmpDirs.push(dir);
    return dir;
  }
  const watcherStub = () => {
    const handlers: Record<string, (p: string) => void> = {};
    return { add: () => {}, on: (ev: string, fn: (p: string) => void) => void (handlers[ev] = fn), handlers };
  };

  it('dev : une exception de chargement est journalisée, le serveur ne tombe pas', async () => {
    const messages: string[] = [];
    const { ctx } = makeContext(messages);
    const watcher = watcherStub();
    const custom = { ...ctx, config: { root: pathToFileURL(brokenProject() + '/') }, watcher };
    await withEnv(FIXTURE_ROOT, () => contentCoreLoader('candidats').load(custom as unknown as Ctx));
    assert.ok(messages.some((m) => m.startsWith('content-core : ')), messages.join(' | '));
    // Un événement du watcher qui relance le chargement ne lève pas non plus.
    const again = watcher.handlers.change;
    assert.ok(again);
    const before = messages.length;
    await withEnv(FIXTURE_ROOT, async () => again(path.join(FIXTURE_ROOT, 'src', 'content', 'candidats', 'x.yaml')));
    assert.ok(messages.length > before, "l’événement relance le chargement sans lever");
  });

  it('build : la même exception fait échouer le chargement', async () => {
    const { ctx } = makeContext([]);
    const custom = { ...ctx, config: { root: pathToFileURL(brokenProject() + '/') }, watcher: undefined };
    await assert.rejects(withEnv(FIXTURE_ROOT, () => contentCoreLoader('candidats').load(custom as unknown as Ctx)));
  });
});
