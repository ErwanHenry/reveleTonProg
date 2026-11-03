import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { COLLECTIONS } from '../../src/lib/content-core/collections.ts';
import { SCHEMA_URN_PREFIX, createAjv, hasSchema, schemaVersion } from '../../src/lib/content-core/ajv.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const NAMES = ['candidat', 'theme', 'mesure', 'source', 'couverture', 'glossaire', 'sondage', 'journal'];
const FORBIDDEN_PROPS = ['collection', 'photo', 'photos', 'image'];

type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(path.join(SCHEMAS_DIR, rel), 'utf8')) as Json;
const isObj = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Parcourt tous les sous-schémas ; `inCondition` vaut true sous if/then/else. */
function walkSchemas(node: unknown, pointer: string, inCondition: boolean, visit: (s: Json, pointer: string, inCondition: boolean) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkSchemas(child, `${pointer}/${i}`, inCondition, visit));
    return;
  }
  if (!isObj(node)) return;
  visit(node, pointer, inCondition);
  for (const [key, value] of Object.entries(node)) {
    // Un objet "properties"/"$defs" est une table de sous-schémas, pas un sous-schéma.
    if ((key === 'properties' || key === '$defs') && isObj(value)) {
      for (const [name, sub] of Object.entries(value)) walkSchemas(sub, `${pointer}/${key}/${name}`, inCondition, visit);
    } else {
      walkSchemas(value, `${pointer}/${key}`, inCondition || key === 'if' || key === 'then' || key === 'else', visit);
    }
  }
}

describe('schémas : méta-test (DATA-01)', () => {
  it('le dossier schemas/ contient exactement les 8 schémas, defs/common et CHANGELOG.md', () => {
    assert.deepEqual(
      readdirSync(SCHEMAS_DIR).sort(),
      [...NAMES.map((n) => `${n}.schema.json`), 'CHANGELOG.md', 'defs'].sort(),
    );
    assert.deepEqual(readdirSync(path.join(SCHEMAS_DIR, 'defs')), ['common.schema.json']);
  });

  it('chaque collection pointe vers un des 8 schémas', () => {
    const used = Object.values(COLLECTIONS).map((c) => c.schema).sort();
    assert.deepEqual(used, [...NAMES].sort());
    for (const c of Object.values(COLLECTIONS)) assert.ok(hasSchema(SCHEMAS_DIR, c.schema), `schéma manquant : ${c.schema}`);
  });

  for (const name of NAMES) {
    describe(name, () => {
      const json = readJson(`${name}.schema.json`);

      it('porte $schema 2020-12, $id URN, type object, unevaluatedProperties false, version_schema entier', () => {
        assert.equal(json.$schema, 'https://json-schema.org/draft/2020-12/schema');
        assert.equal(json.$id, `${SCHEMA_URN_PREFIX}${name}`);
        assert.equal(json.type, 'object');
        assert.equal(json.unevaluatedProperties, false);
        assert.ok((json.required as string[]).includes('version_schema'), 'version_schema doit être obligatoire');
        const v = (json.properties as Record<string, { const?: unknown }>).version_schema?.const;
        assert.ok(Number.isInteger(v), 'version_schema.const doit être un entier');
        assert.equal(schemaVersion(SCHEMAS_DIR, name), v);
      });

      it('se compile en mode strict d\'Ajv', () => {
        const validate = createAjv(SCHEMAS_DIR).getSchema(`${SCHEMA_URN_PREFIX}${name}`);
        assert.equal(typeof validate, 'function');
      });

      it('ne déclare aucune propriété collection, photo, photos ou image (Pitfall 2, D-12)', () => {
        const found: string[] = [];
        walkSchemas(json, '', false, (s, pointer) => {
          if (!isObj(s.properties)) return;
          for (const key of Object.keys(s.properties)) if (FORBIDDEN_PROPS.includes(key)) found.push(`${pointer}/properties/${key}`);
        });
        assert.deepEqual(found, []);
      });

      it('tout sous-schéma objet avec required (hors if/then/else) interdit les propriétés inconnues', () => {
        const missing: string[] = [];
        walkSchemas(json, '', false, (s, pointer, inCondition) => {
          if (inCondition || s.type !== 'object' || !Array.isArray(s.required)) return;
          if (s.unevaluatedProperties !== false) missing.push(pointer || '/');
        });
        assert.deepEqual(missing, []);
      });
    });
  }

  it('defs/common compile et porte un $id URN', () => {
    const json = readJson('defs/common.schema.json');
    assert.equal(json.$id, `${SCHEMA_URN_PREFIX}common`);
    assert.equal(json.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.ok(createAjv(SCHEMAS_DIR).getSchema(`${SCHEMA_URN_PREFIX}common`));
    const found: string[] = [];
    walkSchemas(json, '', false, (s, pointer) => {
      if (!isObj(s.properties)) return;
      for (const key of Object.keys(s.properties)) if (FORBIDDEN_PROPS.includes(key)) found.push(`${pointer}/properties/${key}`);
    });
    assert.deepEqual(found, []);
  });
});
