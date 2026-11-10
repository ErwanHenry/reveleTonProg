import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

// L'outil de relecture (D-04, T-09-28) n'est jamais une partie du site : rien sous src/ ni astro.config.mjs ne le
// référence, aucun dossier relecture/ n'est servi par public/, et ses modules n'importent rien d'Astro.
// check-dist (TYPE_FICHIER_INATTENDU) refuse déjà tout fichier hors html/txt/xml/json dans le dist.

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const plein = path.join(dossier, e.name);
    return e.isDirectory() ? fichiers(plein) : e.isFile() ? [plein] : [];
  });
}

const REFERENCE = /scripts\/(?:lib\/)?relecture/;

describe('outil de relecture hors du site', () => {
  it('aucun fichier de src/ ne mentionne scripts/relecture ni scripts/lib/relecture', () => {
    const src = fichiers(path.join(REPO_ROOT, 'src'));
    assert.ok(src.length > 50, 'src/ lu');
    const fautifs = src.filter((f) => REFERENCE.test(readFileSync(f, 'latin1'))).map((f) => path.relative(REPO_ROOT, f));
    assert.deepEqual(fautifs, []);
  });

  it('astro.config.mjs ne mentionne pas l’outil', () => {
    const conf = readFileSync(path.join(REPO_ROOT, 'astro.config.mjs'), 'utf8');
    assert.doesNotMatch(conf, REFERENCE);
    assert.doesNotMatch(conf, /relecture/);
  });

  it('aucun dossier relecture/ sous public/', () => {
    assert.equal(existsSync(path.join(REPO_ROOT, 'public', 'relecture')), false);
    const publics = fichiers(path.join(REPO_ROOT, 'public')).map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'));
    assert.deepEqual(publics.filter((f) => /(^|\/)relecture(\/|$)/.test(f)), []);
  });

  it('scripts/lib/relecture n’importe rien d’Astro', () => {
    const modules = fichiers(path.join(REPO_ROOT, 'scripts', 'lib', 'relecture')).filter((f) => f.endsWith('.ts'));
    assert.ok(modules.some((f) => f.endsWith('serveur.ts')), 'serveur.ts présent');
    for (const f of [...modules, path.join(REPO_ROOT, 'scripts', 'relecture.ts')]) {
      const t = readFileSync(f, 'utf8');
      const imports = [...t.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      const astro = imports.filter((i) => /^(?:astro(?:[:/]|$)|@astrojs\/)/.test(i));
      assert.deepEqual(astro, [], path.relative(REPO_ROOT, f));
    }
  });

  it('le serveur écoute sur 127.0.0.1 seulement et ne contient aucun élément script', () => {
    const serveur = readFileSync(path.join(REPO_ROOT, 'scripts', 'lib', 'relecture', 'serveur.ts'), 'utf8');
    const servir = readFileSync(path.join(REPO_ROOT, 'scripts', 'lib', 'relecture', 'commandes', 'servir.ts'), 'utf8');
    assert.ok(`${serveur}${servir}`.includes("'127.0.0.1'"));
    assert.ok(!serveur.includes('0.0.0.0') && !servir.includes('0.0.0.0'));
    assert.ok(!serveur.toLowerCase().includes('<script'));
  });
});
