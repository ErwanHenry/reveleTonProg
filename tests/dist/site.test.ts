// Seul fichier de test autorisé à lancer `astro build` (voir tests/dist/contexte.ts).
// Il construit un site à la fois (spawnSync), mémorise chaque build par clé, puis charge chaque module
// tests/dist/cas/*.cas.ts (ordre alphabétique) : les tranches suivantes ajoutent leurs assertions
// dans un nouveau module, sans toucher à ce fichier.
import { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Build, ContexteSite } from './contexte.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASTRO_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'astro');
const DOSSIER_CAS = path.join(REPO_ROOT, 'tests', 'dist', 'cas');

const tmpDirs: string[] = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-'));
  tmpDirs.push(dir);
  return dir;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    })
    .sort();
}

const builds = new Map<string, Build>();

const ctx: ContexteSite = {
  repoRoot: REPO_ROOT,
  tmp,
  construire(cle, { racine, mode }) {
    const memo = builds.get(cle);
    if (memo) return memo;
    assert.ok(
      fs.existsSync(ASTRO_BIN),
      `astro est introuvable (${ASTRO_BIN}) : lancez « npm install » avant ce test (build « ${cle} », RTP_CONTENT_ROOT=${racine})`,
    );
    const outDir = path.join(tmp(), 'dist');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      RTP_CONTENT_ROOT: racine, // lu par content-core (root.ts)
      ASTRO_TELEMETRY_DISABLED: '1',
    };
    // Jamais de RTP_MODE hérité : sans mode demandé, le build prend le défaut fail-closed (production).
    if (mode === undefined) delete env.RTP_MODE;
    else env.RTP_MODE = mode;
    const res = spawnSync(ASTRO_BIN, ['build', '--outDir', outDir], { cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 120_000 });
    const build: Build = { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}`, outDir };
    builds.set(cle, build);
    return build;
  },
  lire: (outDir, chemin) => fs.readFileSync(path.join(outDir, chemin), 'utf8'),
  fichiers: (outDir) => walk(outDir),
  pagesHtml: (outDir) => walk(outDir).filter((f) => f.endsWith('.html')),
};

const modules = fs
  .readdirSync(DOSSIER_CAS)
  .filter((f) => f.endsWith('.cas.ts'))
  .sort();
assert.ok(modules.length > 0, `aucun module de cas dans ${DOSSIER_CAS}`);

// Tous les modules sont importés avant de déclarer la première suite. Alterner `await import()` et
// `describe()` laisse le test racine démarrer entre deux imports : si une suite entièrement filtrée par
// --test-name-pattern se termine alors qu'aucune autre n'est encore déclarée, la racine se croit finie,
// lance son `after` et supprime les dist mémorisés pendant que les suites suivantes en ont besoin.
const declarations: [string, (c: ContexteSite) => void][] = [];
for (const fichier of modules) {
  const mod = (await import(pathToFileURL(path.join(DOSSIER_CAS, fichier)).href)) as { default?: (c: ContexteSite) => void };
  assert.equal(typeof mod.default, 'function', `${fichier} doit exporter par défaut une fonction (ctx) => void`);
  declarations.push([fichier, mod.default as (c: ContexteSite) => void]);
}
for (const [fichier, declarer] of declarations) {
  describe(fichier.replace(/\.cas\.ts$/, ''), { concurrency: false }, () => declarer(ctx));
}
