import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../src/lib/content-core/diagnostics.ts';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');
const FAKE_FILE = path.join(REPO_ROOT, 'tests', 'fixtures', 'inline.yaml');

function run(schemaName: string, yamlText: string): Diagnostic[] {
  return validateYamlText(schemaName, yamlText, FAKE_FILE, { schemasDir: SCHEMAS_DIR }).diagnostics;
}

const show = (ds: Diagnostic[]): string => JSON.stringify(ds.map((d) => `${d.code} ${d.pointer}`));

export function expectOk(schemaName: string, yamlText: string): void {
  const ds = run(schemaName, yamlText);
  assert.deepEqual(ds, [], `aucun diagnostic attendu, reçu : ${show(ds)}`);
}

/** Correspondance par sous-ensemble : chaque (code, pointeur) attendu doit apparaître ; aucune erreur YAML_*. */
export function expectErrors(schemaName: string, yamlText: string, expected: { code: string; pointer: string }[]): void {
  const ds = run(schemaName, yamlText);
  assert.ok(!ds.some((d) => d.code.startsWith('YAML_')), `erreur YAML inattendue : ${show(ds)}`);
  for (const want of expected) {
    assert.ok(
      ds.some((d) => d.code === want.code && d.pointer === want.pointer),
      `attendu ${want.code} à « ${want.pointer} », reçu : ${show(ds)}`,
    );
  }
}
