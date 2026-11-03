// Walking-skeleton end-to-end test.
// Seul fichier de test autorisé à lancer `astro build` : node --test exécute les
// fichiers en parallèle et des builds concurrents partageraient le cache `.astro`.
// Le corpus construit est choisi par la variable d'environnement RTP_CONTENT_ROOT
// (corpus fictif par défaut, racine vide ou fixture cassée selon le sous-test).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASTRO_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'astro');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');

const tmpDirs: string[] = [];
function mkTmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-'));
  tmpDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

interface BuildResult {
  status: number | null;
  output: string;
  outDir: string;
}

function build(contentRoot: string): BuildResult {
  assert.ok(
    fs.existsSync(ASTRO_BIN),
    `astro est introuvable (${ASTRO_BIN}) : lancez « npm install » avant ce test (build avec RTP_CONTENT_ROOT=${contentRoot})`,
  );
  const outDir = path.join(mkTmp(), 'dist');
  const res = spawnSync(ASTRO_BIN, ['build', '--outDir', outDir], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      RTP_CONTENT_ROOT: contentRoot, // lu par content-core (root.ts)
      ASTRO_TELEMETRY_DISABLED: '1',
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}`, outDir };
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('walking skeleton', { concurrency: false }, () => {
  it('(a) construit le corpus fictif en HTML statique sans JS', () => {
    const { status, output, outDir } = build(FIXTURE_ROOT);
    assert.equal(status, 0, `astro build a échoué :\n${output}`);
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.match(html, /Marie Fictive/);
    assert.match(html, /Parti Imaginaire/);
    assert.ok(html.includes('2026-10-15'), 'la date 2026-10-15 doit apparaître telle quelle');
    assert.match(html, /lang="fr"/);
    // compressHTML: true conserve l'espace entre un élément inline et le texte suivant
    assert.match(html, /<\/span>\s+à des fins de test/);

    const files = walk(outDir);
    for (const f of files) {
      assert.ok(!f.endsWith('.js'), `fichier JS interdit dans dist : ${f}`);
      if (f.endsWith('.html')) {
        const content = fs.readFileSync(f, 'utf8');
        assert.ok(!content.includes('<script'), `<script interdit dans ${f}`);
        for (const m of content.matchAll(/\b(?:src|href)=["']?(https?:\/\/[^"'\s>]*)/g)) {
          assert.fail(`ressource tierce interdite dans ${f} : ${m[1]}`);
        }
      }
    }
  });

  it('(b) construit une racine de contenu vide', () => {
    const root = mkTmp();
    fs.mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
    const { status, output, outDir } = build(root);
    assert.equal(status, 0, `astro build a échoué :\n${output}`);
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.match(html, /Aucun candidat dans ce corpus/);
  });

  it('(c) échoue avec fichier:ligne:col SCHEMA_REQUIRED sur une fixture cassée', () => {
    const root = mkTmp();
    fs.cpSync(FIXTURE_ROOT, root, { recursive: true });
    const file = path.join(root, 'src', 'content', 'candidats', 'marie-fictive.yaml');
    const source = fs.readFileSync(file, 'utf8');
    const idx = source.indexOf('statuts:');
    assert.ok(idx > 0, 'la fixture doit contenir « statuts: »');
    fs.writeFileSync(file, source.slice(0, idx));

    const { status, output, outDir } = build(root);
    assert.notEqual(status, 0, 'le build aurait dû échouer');
    assert.match(output, /marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/);
    const occurrences = output.match(/marie-fictive\.yaml:\d+:\d+ SCHEMA_REQUIRED/g) ?? [];
    assert.equal(occurrences.length, 1, `diagnostic attendu une seule fois, vu ${occurrences.length} fois`);
    assert.ok(!fs.existsSync(path.join(outDir, 'index.html')), 'index.html ne doit pas exister');
  });
});
