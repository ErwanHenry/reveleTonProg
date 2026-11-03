import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mod = (await import(pathToFileURL(path.join(ROOT, 'astro.config.mjs')).href)) as {
  default: {
    output?: string;
    compressHTML?: unknown;
    prefetch?: unknown;
    trailingSlash?: string;
    image?: { service?: { entrypoint?: string } };
    devToolbar?: { enabled?: boolean };
  };
};
const config = mod.default;

describe('astro.config.mjs', () => {
  it('sortie statique', () => {
    assert.equal(config.output, 'static');
  });

  it("compressHTML vaut true (booléen), pas 'jsx' qui colle les mots (Pitfall 3)", () => {
    assert.strictEqual(config.compressHTML, true);
  });

  it('prefetch désactivé', () => {
    assert.strictEqual(config.prefetch, false);
  });

  it('service d\'images noop', () => {
    assert.equal(config.image?.service?.entrypoint, 'astro/assets/services/noop');
  });

  it('trailingSlash always et barre de dev désactivée', () => {
    assert.equal(config.trailingSlash, 'always');
    assert.strictEqual(config.devToolbar?.enabled, false);
  });
});
