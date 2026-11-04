import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string): string => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  type: string;
  private: boolean;
  license: string;
  engines: { node: string };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('scaffold Node 24', () => {
  it('.nvmrc vaut 24', () => {
    assert.equal(read('.nvmrc').trim(), '24');
  });

  it('package.json : type, private, licence et engines', () => {
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.private, true);
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.engines.node, '>=24.12');
  });

  it('scripts npm : contrat exact', () => {
    assert.deepEqual(pkg.scripts, {
      validate: 'node scripts/validate.ts',
      migrate: 'node scripts/migrate.ts',
      ids: 'node scripts/ids.ts',
      'import:datagouv': 'node scripts/import-datagouv.ts',
      archive: 'node scripts/archive-source.ts',
      couverture: 'node scripts/couverture-scan.ts',
      check: 'astro check',
      test: 'TZ=Europe/Paris node --test "tests/**/*.test.ts"',
      build: 'astro build',
      'check-dist': 'node scripts/check-dist.ts',
      dev: 'astro dev',
      preview: 'astro preview',
    });
  });

  it('dépendances : exactement les huit paquets justifiés', () => {
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['ajv', 'astro', 'yaml']);
    assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
      '@astrojs/check',
      '@axe-core/playwright',
      '@playwright/test',
      '@types/node',
      'typescript',
    ]);
    assert.match(pkg.devDependencies['typescript'] ?? '', /^\^6\./);
    assert.match(pkg.devDependencies['@types/node'] ?? '', /^\^24\./);
    assert.match(pkg.devDependencies['@playwright/test'] ?? '', /^\^1\.64\./);
    assert.match(pkg.devDependencies['@axe-core/playwright'] ?? '', /^\^4\.14\./);
  });

  it('.npmrc impose engine-strict et src/content/.gitkeep existe', () => {
    assert.ok(read('.npmrc').split('\n').includes('engine-strict=true'));
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'content', '.gitkeep')));
  });

  it('.npmrc coupe les scripts de cycle de vie des dépendances (WR-07)', () => {
    assert.ok(read('.npmrc').split('\n').includes('ignore-scripts=true'));
  });

  it('le Node qui exécute les tests est >= 24', () => {
    assert.ok(Number(process.versions.node.split('.')[0]) >= 24, process.version);
  });

  it("lockfile : aucun script d'installation, sauf fsevents (optionnel, darwin)", () => {
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { hasInstallScript?: boolean; optional?: boolean; os?: string[] }>;
    };
    const withScripts = Object.entries(lock.packages).filter(([, p]) => p.hasInstallScript);
    assert.deepEqual(
      withScripts.map(([name]) => name),
      ['node_modules/fsevents'],
      'seul fsevents (dépendance optionnelle de vite, macOS) peut avoir un script d\'installation',
    );
    const fsevents = withScripts[0]?.[1];
    assert.equal(fsevents?.optional, true);
    assert.deepEqual(fsevents?.os, ['darwin']);
  });
});
