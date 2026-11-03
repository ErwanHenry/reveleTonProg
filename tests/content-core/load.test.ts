import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ecrireIdsLock } from '../../src/lib/content-core/ids-lock.ts';
import { checkContained, listContentFiles, loadAll, parseYaml, validateYamlText } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const FIXTURE_TEXT = readFileSync(path.join(FIXTURE_ROOT, 'src', 'content', 'candidats', 'marie-fictive.yaml'), 'utf8');
const OPTS = { schemasDir: SCHEMAS_DIR };
const FILE = '/tmp/inline.yaml';

const tmpDirs: string[] = [];
function tmpRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-load-'));
  tmpDirs.push(dir);
  return dir;
}
function put(root: string, rel: string, text: string): string {
  const full = path.join(root, 'src', 'content', rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
  return full;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe('parseYaml : les scalaires restent des chaînes', () => {
  it('date complète, date partielle et "no" sont des chaînes', () => {
    const { data, diagnostics } = parseYaml('date: 2026-11-03\nd: 2026-11\noui: no\n', FILE);
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(data, { date: '2026-11-03', d: '2026-11', oui: 'no' });
  });

  it('!!timestamp dans une date de statut donne SCHEMA_TYPE sur /statuts/0/date', () => {
    const text = FIXTURE_TEXT.replace('date: 2026-09\n', 'date: !!timestamp 2026-09-01\n');
    const { diagnostics } = validateYamlText('candidat', text, FILE, OPTS);
    assert.ok(diagnostics.some((d) => d.code === 'SCHEMA_TYPE' && d.pointer === '/statuts/0/date'), JSON.stringify(diagnostics));
  });
});

describe('parseYaml : erreurs refusées avec des codes stables', () => {
  it('clé en double : YAML_DUPLICATE_KEY sur la ligne de la seconde clé', () => {
    const { diagnostics } = parseYaml('a: 1\nb: 2\na: 3\n', FILE);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.code, 'YAML_DUPLICATE_KEY');
    assert.equal(diagnostics[0]?.line, 3);
    assert.equal(diagnostics[0]?.severity, 'error');
  });

  it('deux documents : YAML_MULTIPLE_DOCS', () => {
    const { diagnostics } = parseYaml('a: 1\n---\nb: 2\n', FILE);
    assert.ok(diagnostics.some((d) => d.code === 'YAML_MULTIPLE_DOCS'));
  });

  it('alias : YAML_ALIAS_INTERDIT, positionné sur l’alias', () => {
    const { diagnostics } = parseYaml('a: &x 1\nb: *x\n', FILE);
    const d = diagnostics.find((x) => x.code === 'YAML_ALIAS_INTERDIT');
    assert.ok(d);
    assert.equal(d.line, 2);
  });

  it('fichier vide ou liste à la racine : YAML_RACINE_NON_OBJET', () => {
    assert.equal(parseYaml('', FILE).diagnostics[0]?.code, 'YAML_RACINE_NON_OBJET');
    assert.equal(parseYaml('- a\n- b\n', FILE).diagnostics[0]?.code, 'YAML_RACINE_NON_OBJET');
    assert.equal(parseYaml('just text\n', FILE).diagnostics[0]?.code, 'YAML_RACINE_NON_OBJET');
  });

  it('balise inconnue : erreur (avertissement promu) YAML_TAG_RESOLVE_FAILED', () => {
    const { diagnostics } = parseYaml('b: !foo bar\n', FILE);
    assert.equal(diagnostics[0]?.code, 'YAML_TAG_RESOLVE_FAILED');
    assert.equal(diagnostics[0]?.severity, 'error');
  });

  it('<<: *x ne fusionne jamais (alias refusé, pas de fusion)', () => {
    const { data, diagnostics } = parseYaml('base: &x\n  k: 1\nautre:\n  <<: *x\n', FILE);
    assert.ok(diagnostics.some((d) => d.code === 'YAML_ALIAS_INTERDIT'));
    assert.equal(data, undefined);
    const noAlias = parseYaml('autre:\n  <<: 1\n', FILE);
    assert.deepEqual(noAlias.data, { autre: { '<<': 1 } });
  });

  it('un fichier invalide n’est jamais validé contre le schéma', () => {
    const { diagnostics } = validateYamlText('candidat', 'a: 1\na: 2\n', FILE, OPTS);
    assert.ok(diagnostics.every((d) => d.code.startsWith('YAML_')));
  });
});

describe('listContentFiles', () => {
  it('src/content existant mais vide : 0 entrée, 0 diagnostic (accepté jusqu’à la Phase 3)', () => {
    const root = tmpRoot();
    mkdirSync(path.join(root, 'src', 'content'), { recursive: true });
    const res = loadAll(root, OPTS);
    assert.deepEqual(res, { entries: [], diagnostics: [], files: 0 });
  });

  it('src/content absent : RACINE_INTROUVABLE (jamais « 0 erreur » en silence)', () => {
    const res = loadAll(tmpRoot(), OPTS);
    assert.equal(res.files, 0);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['RACINE_INTROUVABLE']);
    assert.equal(res.diagnostics[0]?.severity, 'error');
  });

  it('racine inexistante : RACINE_INTROUVABLE', () => {
    const res = loadAll(path.join(tmpRoot(), 'nope', 'typo'), OPTS);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['RACINE_INTROUVABLE']);
  });

  it('src/content qui est un fichier et non un dossier : RACINE_INTROUVABLE', () => {
    const root = tmpRoot();
    mkdirSync(path.join(root, 'src'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'content'), 'x');
    assert.deepEqual(listContentFiles(root).diagnostics.map((d) => d.code), ['RACINE_INTROUVABLE']);
  });

  it('.yml refusé (FICHIER_EXTENSION), fichiers cachés ignorés', () => {
    const root = tmpRoot();
    put(root, 'candidats/x.yml', 'a: 1\n');
    put(root, 'candidats/.gitkeep', '');
    const res = listContentFiles(root);
    assert.deepEqual(res.files, []);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_EXTENSION']);
  });

  it('lien symbolique : FICHIER_LIEN_SYMBOLIQUE, cible jamais lue', () => {
    const root = tmpRoot();
    const outside = path.join(tmpRoot(), 'secret.yaml');
    writeFileSync(outside, 'a: 1\na: 2\n'); // serait une erreur YAML si on le lisait
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    symlinkSync(outside, path.join(root, 'src', 'content', 'candidats', 'lien.yaml'));
    const res = loadAll(root, OPTS);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_LIEN_SYMBOLIQUE']);
    assert.equal(res.entries.length, 0);
  });

  it('src/ lien symbolique : FICHIER_LIEN_SYMBOLIQUE, rien de listé (CR-02)', () => {
    const root = tmpRoot();
    const elsewhere = tmpRoot();
    cpSync(path.join(FIXTURE_ROOT, 'src'), path.join(elsewhere, 'src'), { recursive: true });
    symlinkSync(path.join(elsewhere, 'src'), path.join(root, 'src'));
    const res = loadAll(root, OPTS);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_LIEN_SYMBOLIQUE']);
    assert.equal(res.files, 0);
  });

  it('src/content lien symbolique : FICHIER_LIEN_SYMBOLIQUE, rien de listé (CR-02)', () => {
    const root = tmpRoot();
    const elsewhere = tmpRoot();
    cpSync(path.join(FIXTURE_ROOT, 'src', 'content'), path.join(elsewhere, 'content'), { recursive: true });
    mkdirSync(path.join(root, 'src'), { recursive: true });
    symlinkSync(path.join(elsewhere, 'content'), path.join(root, 'src', 'content'));
    const res = loadAll(root, OPTS);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_LIEN_SYMBOLIQUE']);
    assert.equal(res.files, 0);
  });

  it('fichier non régulier (tube nommé) : FICHIER_NON_REGULIER, jamais ouvert (CR-02)', () => {
    const root = tmpRoot();
    mkdirSync(path.join(root, 'src', 'content', 'candidats'), { recursive: true });
    const fifo = path.join(root, 'src', 'content', 'candidats', 'x.yaml');
    assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
    const res = loadAll(root, OPTS); // se bloquerait à jamais si le tube était ouvert
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_NON_REGULIER']);
    assert.equal(res.files, 0);
  });

  it('checkContained : fichier hors racine ou lien symbolique refusé, fichier interne accepté', () => {
    const root = tmpRoot();
    const outside = path.join(tmpRoot(), 'dehors.yaml');
    writeFileSync(outside, 'a: 1\n');
    const inside = put(root, 'candidats/ok.yaml', 'a: 1\n');
    assert.equal(checkContained(root, inside), undefined);
    assert.equal(checkContained(root, outside)?.code, 'FICHIER_HORS_RACINE');
    const link = path.join(root, 'src', 'content', 'candidats', 'lien.yaml');
    symlinkSync(outside, link);
    assert.equal(checkContained(root, link)?.code, 'FICHIER_LIEN_SYMBOLIQUE');
    assert.equal(checkContained(root, path.join(root, 'absent.yaml'))?.code, 'FICHIER_ILLISIBLE');
  });

  it('mesures : exactement mesures/<candidat>/<slug>.yaml', () => {
    const root = tmpRoot();
    put(root, 'mesures/a.yaml', 'a: 1\n');
    put(root, 'mesures/a/b/c.yaml', 'a: 1\n');
    const res = listContentFiles(root);
    assert.deepEqual(res.files, []);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_EMPLACEMENT', 'FICHIER_EMPLACEMENT']);
  });

  it('sous-dossier dans une collection plate et dossier inconnu : FICHIER_EMPLACEMENT', () => {
    const root = tmpRoot();
    put(root, 'candidats/sous/x.yaml', 'a: 1\n');
    put(root, 'inconnue/x.yaml', 'a: 1\n');
    const res = listContentFiles(root);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_EMPLACEMENT', 'FICHIER_EMPLACEMENT']);
  });

  it('identifiant d’une mesure = <candidat>/<slug>', () => {
    const root = tmpRoot();
    put(root, 'mesures/marie-fictive/x.yaml', 'a: 1\n');
    const res = listContentFiles(root);
    assert.equal(res.files[0]?.id, 'marie-fictive/x');
    assert.equal(res.files[0]?.collection, 'mesures');
  });
});

describe('loadAll', () => {
  it('collection sans schéma dans schemasDir : SCHEMA_INCONNU', () => {
    const schemas = path.join(tmpRoot(), 'schemas');
    mkdirSync(path.join(schemas, 'defs'), { recursive: true });
    cpSync(path.join(SCHEMAS_DIR, 'defs', 'common.schema.json'), path.join(schemas, 'defs', 'common.schema.json'));
    cpSync(path.join(SCHEMAS_DIR, 'candidat.schema.json'), path.join(schemas, 'candidat.schema.json'));
    const root = tmpRoot();
    put(root, 'themes/logement.yaml', 'a: 1\n');
    const res = loadAll(root, { schemasDir: schemas });
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['SCHEMA_INCONNU']);
    assert.equal(res.diagnostics[0]?.line, 1);
  });

  it('le corpus fictif réel : ≥ 1 candidat, 0 diagnostic, dates en chaînes', () => {
    const res = loadAll(FIXTURE_ROOT, OPTS);
    assert.deepEqual(res.diagnostics, []);
    const candidats = res.entries.filter((e) => e.collection === 'candidats');
    assert.ok(candidats.length >= 1);
    const marie = candidats.find((e) => e.id === 'marie-fictive');
    const statuts = marie?.data.statuts as { date: unknown }[];
    assert.equal(typeof statuts[1]?.date, 'string');
    assert.equal(statuts[1]?.date, '2026-10-15');
  });

  it('WR-03 : mesure déplacée vers un autre candidat ou renommée : ID_CHEMIN_INCOHERENT', () => {
    const root = tmpRoot();
    cpSync(FIXTURE_ROOT, root, { recursive: true });
    const from = path.join(root, 'src', 'content', 'mesures', 'marie-fictive', 'encadrement-loyers.yaml');
    const to = path.join(root, 'src', 'content', 'mesures', 'jean-imaginaire', 'autre-nom.yaml');
    mkdirSync(path.dirname(to), { recursive: true });
    renameSync(from, to);
    const res = loadAll(root, OPTS);
    const bad = res.diagnostics.filter((d) => d.code === 'ID_CHEMIN_INCOHERENT');
    assert.deepEqual(bad.map((d) => d.pointer).sort(), ['/candidat', '/id']);
    assert.ok(bad.every((d) => d.file === to && d.line > 1), JSON.stringify(bad));
    assert.ok(!res.entries.some((e) => e.collection === 'mesures'));
  });

  it('WR-03 : candidat dont le nom de fichier diffère de l’id : ID_CHEMIN_INCOHERENT sur /id', () => {
    const root = tmpRoot();
    put(root, 'candidats/autre-nom.yaml', FIXTURE_TEXT);
    writeFileSync(path.join(root, 'ids.lock'), ecrireIdsLock(['autre-nom'])); // sans lock, IDS_LOCK_ABSENT s'ajouterait
    const res = loadAll(root, OPTS);
    assert.deepEqual(res.diagnostics.map((d) => [d.code, d.pointer]), [['ID_CHEMIN_INCOHERENT', '/id']]);
    assert.equal(res.entries.length, 0);
  });

  it('un candidat invalide : diagnostics triés, aucune entrée', () => {
    const root = tmpRoot();
    put(root, 'candidats/marie-fictive.yaml', FIXTURE_TEXT.replace(/^statuts:[\s\S]*$/m, ''));
    const res = loadAll(root, OPTS);
    assert.equal(res.entries.length, 0);
    assert.equal(res.files, 1);
    assert.ok(res.diagnostics.some((d) => d.code === 'SCHEMA_REQUIRED'));
  });
});
