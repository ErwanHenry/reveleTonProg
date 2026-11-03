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
    build?: { inlineStylesheets?: string };
    vite?: { build?: { assetsInlineLimit?: number } };
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

  it("assets toujours externes : assetsInlineLimit 0 et inlineStylesheets 'never' (CSP sans 'unsafe-inline', Pitfall 2)", () => {
    assert.strictEqual(config.vite?.build?.assetsInlineLimit, 0);
    assert.strictEqual(config.build?.inlineStylesheets, 'never');
  });

  it('trailingSlash always et barre de dev désactivée', () => {
    assert.equal(config.trailingSlash, 'always');
    assert.strictEqual(config.devToolbar?.enabled, false);
  });
});
