import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scriptsEnLigne } from '../../src/lib/csp-empreintes.ts';

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
    security?: { csp?: { directives?: string[]; scriptDirective?: { hashes?: string[] } } };
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

  it("CSS en ligne (inlineStylesheets 'always') et aucun asset en data: (assetsInlineLimit 0, SCRIPT_DATA_URI)", () => {
    assert.strictEqual(config.build?.inlineStylesheets, 'always');
    assert.strictEqual(config.vite?.build?.assetsInlineLimit, 0);
  });

  it("CSP par page (ADR-056) : directives restrictives et empreintes des scripts calculées sur src/scripts/", () => {
    const directives = config.security?.csp?.directives ?? [];
    for (const d of ["default-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"]) {
      assert.ok(directives.includes(d), `directive absente : ${d}`);
    }
    assert.deepEqual(
      config.security?.csp?.scriptDirective?.hashes,
      scriptsEnLigne(ROOT).map((s) => s.empreinte),
    );
  });

  it("jamais 'unsafe-inline' ni 'unsafe-eval' dans la configuration de sécurité", () => {
    const texte = JSON.stringify(config.security ?? {});
    assert.doesNotMatch(texte, /unsafe-inline|unsafe-eval/);
  });

  it('trailingSlash always et barre de dev désactivée', () => {
    assert.equal(config.trailingSlash, 'always');
    assert.strictEqual(config.devToolbar?.enabled, false);
  });
});
