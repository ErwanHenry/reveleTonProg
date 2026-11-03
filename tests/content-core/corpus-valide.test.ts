import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COLLECTION_NAMES } from '../../src/lib/content-core/collections.ts';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const result = loadAll(FIXTURE_ROOT, { schemasDir: SCHEMAS_DIR });

/** Parcourt récursivement une valeur et appelle `visit` sur chaque feuille ou objet, avec son chemin. */
function deepWalk(value: unknown, where: string, visit: (v: unknown, where: string) => void): void {
  visit(value, where);
  if (Array.isArray(value)) value.forEach((v, i) => deepWalk(v, `${where}[${i}]`, visit));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) deepWalk(v, `${where}.${k}`, visit);
  }
}

describe('corpus-valide : le corpus fictif complet', () => {
  it('ne produit aucun diagnostic', () => {
    assert.deepEqual(result.diagnostics, []);
  });

  for (const collection of COLLECTION_NAMES) {
    it(`contient au moins une entrée dans « ${collection} »`, () => {
      assert.ok(result.entries.some((e) => e.collection === collection), `collection vide : ${collection}`);
    });
  }

  it('chaque entrée porte un id identique à son nom de fichier (DATA-01)', () => {
    for (const e of result.entries) assert.equal(e.data.id, e.id, `${e.collection}/${e.id}`);
  });

  it('ne contient aucune Date, les dates restent des chaînes (DATA-07)', () => {
    for (const e of result.entries) {
      deepWalk(e.data, `${e.collection}/${e.id}`, (v, where) => {
        assert.ok(!(v instanceof Date), `Date trouvée à ${where}`);
      });
    }
  });

  it('toutes les URL https ont un hôte en .invalid (aucune personne réelle)', () => {
    let seen = 0;
    for (const e of result.entries) {
      deepWalk(e.data, `${e.collection}/${e.id}`, (v, where) => {
        if (typeof v !== 'string' || !v.startsWith('https://')) return;
        seen++;
        assert.ok(URL.canParse(v), `URL illisible à ${where}`);
        assert.ok(new URL(v).hostname.endsWith('.invalid'), `hôte non fictif à ${where} : ${v}`);
      });
    }
    assert.ok(seen > 0, 'aucune URL https dans le corpus : le test ne vérifie rien');
  });

  it('chaque archive de source existe et son sha256 correspond (extrait versionné)', () => {
    const sources = result.entries.filter((e) => e.collection === 'sources');
    assert.ok(sources.length > 0);
    for (const s of sources) {
      const archive = s.data.archive as { extrait: string; sha256: string } | undefined;
      assert.ok(archive, `source sans archive : ${s.id}`);
      const file = path.join(FIXTURE_ROOT, archive.extrait);
      assert.ok(existsSync(file), `extrait manquant : ${archive.extrait}`);
      assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), archive.sha256, `sha256 divergent : ${s.id}`);
    }
  });
});
