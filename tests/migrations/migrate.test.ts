import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ecrireIdsLock } from '../../src/lib/content-core/ids-lock.ts';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { inspectVersions, migrateText, runMigrations } from '../../src/lib/content-core/migrate.ts';
import type { Migration } from '../../src/lib/content-core/migrate.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import { fakeMigration } from './fake-migration.ts';

const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'migrations');
const AVANT = readFileSync(path.join(FIXTURES, 'candidat-v0-avant.yaml'), 'utf8');
const APRES = readFileSync(path.join(FIXTURES, 'candidat-v0-apres.yaml'), 'utf8');

const tmpDirs: string[] = [];
/** Racine de contenu temporaire contenant un seul candidat (marie-fictive.yaml) avec le texte donné. */
function tmpRoot(candidat: string): { root: string; file: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rtp-migrate-'));
  tmpDirs.push(root);
  const dir = path.join(root, 'src', 'content', 'candidats');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'marie-fictive.yaml');
  writeFileSync(file, candidat);
  return { root, file };
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe('migrateText (registre injecté)', () => {
  it('produit exactement le fichier "après" (octet pour octet)', () => {
    assert.equal(migrateText(AVANT, 'candidat', 0, 1, [fakeMigration]), APRES);
  });

  it('conserve l\'en-tête, le commentaire en ligne et la ligne de plus de 80 caractères', () => {
    const out = migrateText(AVANT, 'candidat', 0, 1, [fakeMigration]);
    assert.ok(out.startsWith('# en-tête de test de migration\n'));
    assert.ok(out.includes('Parti Imaginaire # étiquette revendiquée par la candidate'));
    const longue = out.split('\n').find((l) => l.includes('titre volontairement très long'));
    assert.ok(longue && longue.length > 80, 'la ligne longue doit rester sur une seule ligne');
  });

  it('conserve l\'ordre des clés : parti reste à la place d\'etiquette', () => {
    const keys = migrateText(AVANT, 'candidat', 0, 1, [fakeMigration])
      .split('\n')
      .filter((l) => /^[a-z_]+:/.test(l))
      .map((l) => l.split(':')[0]);
    assert.deepEqual(keys, ['version_schema', 'id', 'prenom', 'nom', 'nom_tri', 'parti', 'parti_source', 'statuts']);
  });

  it('est idempotent : le fichier migré est stable et déclaré à jour', () => {
    const { root } = tmpRoot(migrateText(AVANT, 'candidat', 0, 1, [fakeMigration]));
    const { fichiers, diagnostics } = inspectVersions(root, { schemasDir: SCHEMAS_DIR });
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(fichiers.map((f) => f.etat), ['a_jour']);
  });

  it('lève MIGRATION_CHAINE_MANQUANTE quand le registre est vide', () => {
    assert.throws(
      () => migrateText(AVANT, 'candidat', 0, 1, []),
      (e: Error & { code?: string }) => e.code === 'MIGRATION_CHAINE_MANQUANTE' && e.message === 'Aucune migration candidat v0 -> v1',
    );
  });

  it('lève MIGRATION_CHAINE_MANQUANTE quand un maillon manque au milieu de la chaîne', () => {
    assert.throws(
      () => migrateText(AVANT, 'candidat', 0, 2, [fakeMigration]),
      (e: Error & { code?: string }) => e.code === 'MIGRATION_CHAINE_MANQUANTE' && e.message === 'Aucune migration candidat v1 -> v2',
    );
  });
});

describe('inspectVersions', () => {
  it('classe un fichier en retard et situe le diagnostic sur la ligne de version_schema', () => {
    const { root, file } = tmpRoot(AVANT);
    const { fichiers, diagnostics } = inspectVersions(root, { schemasDir: SCHEMAS_DIR });
    assert.equal(fichiers[0]?.etat, 'en_retard');
    assert.equal(fichiers[0]?.version, 0);
    assert.equal(fichiers[0]?.courante, 1);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.code, 'MIGRATION_EN_RETARD');
    assert.equal(diagnostics[0]?.file, file);
    assert.equal(diagnostics[0]?.line, 2); // la ligne 1 est le commentaire d'en-tête
    assert.equal(diagnostics[0]?.col, 1);
  });

  it('classe version_schema: 2 contre un schéma en 1 comme trop récent', () => {
    const { root } = tmpRoot(AVANT.replace('version_schema: 0', 'version_schema: 2'));
    const { fichiers, diagnostics } = inspectVersions(root, { schemasDir: SCHEMAS_DIR });
    assert.equal(fichiers[0]?.etat, 'trop_recent');
    assert.equal(diagnostics[0]?.code, 'MIGRATION_TROP_RECENTE');
  });

  it('classe un version_schema manquant ou non entier comme invalide', () => {
    for (const text of [AVANT.replace('version_schema: 0\n', ''), AVANT.replace('version_schema: 0', 'version_schema: "1"')]) {
      const { root } = tmpRoot(text);
      const { fichiers, diagnostics } = inspectVersions(root, { schemasDir: SCHEMAS_DIR });
      assert.equal(fichiers[0]?.etat, 'invalide');
      assert.equal(diagnostics[0]?.code, 'MIGRATION_VERSION_INVALIDE');
    }
  });

  it('ne réécrit jamais un fichier trop récent ou invalide', () => {
    const text = AVANT.replace('version_schema: 0', 'version_schema: 2');
    const { root, file } = tmpRoot(text);
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(res.ecrits, []);
    assert.equal(res.diagnostics[0]?.code, 'MIGRATION_TROP_RECENTE');
    assert.equal(readFileSync(file, 'utf8'), text);
  });
});

describe('runMigrations', () => {
  it('write: true réécrit en "après", puis une seconde passe n\'écrit rien', () => {
    const { root, file } = tmpRoot(AVANT);
    const first = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(first.diagnostics, []);
    assert.deepEqual(first.ecrits, [file]);
    assert.equal(readFileSync(file, 'utf8'), APRES);

    const second = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(second.ecrits, []);
    assert.deepEqual(second.diagnostics, []);
    assert.equal(readFileSync(file, 'utf8'), APRES);
  });

  it('le contenu migré passe la validation complète (0 diagnostic)', () => {
    const { root } = tmpRoot(AVANT);
    writeFileSync(path.join(root, 'ids.lock'), ecrireIdsLock(['marie-fictive'])); // un candidat exige son verrou (REGLE-07)
    runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(loadAll(root, { schemasDir: SCHEMAS_DIR }).diagnostics.filter((d) => d.severity === 'error'), []);
  });

  it('write: false ne touche à rien et signale le retard', () => {
    const { root, file } = tmpRoot(AVANT);
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: false });
    assert.deepEqual(res.ecrits, []);
    assert.equal(res.diagnostics[0]?.code, 'MIGRATION_EN_RETARD');
    assert.equal(readFileSync(file, 'utf8'), AVANT);
  });

  it('registre vide : MIGRATION_CHAINE_MANQUANTE sur la ligne de version_schema, fichier inchangé', () => {
    const { root, file } = tmpRoot(AVANT);
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [], write: true });
    assert.deepEqual(res.ecrits, []);
    assert.equal(res.diagnostics.length, 1);
    assert.equal(res.diagnostics[0]?.code, 'MIGRATION_CHAINE_MANQUANTE');
    assert.equal(res.diagnostics[0]?.line, 2);
    assert.equal(readFileSync(file, 'utf8'), AVANT);
  });

  it('ne touche pas aux fichiers à jour d\'un corpus mixte', () => {
    const { root, file } = tmpRoot(AVANT);
    const fixtureCandidat = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'candidats', 'jean-imaginaire.yaml');
    const other = path.join(path.dirname(file), 'jean-imaginaire.yaml');
    cpSync(fixtureCandidat, other);
    const before = readFileSync(other, 'utf8');
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(res.ecrits, [file]);
    assert.equal(readFileSync(other, 'utf8'), before);
  });
});

describe('runMigrations : jamais d\'écriture hors de la racine de contenu (CR-02)', () => {
  it('src/content lien symbolique : rien n\'est écrit à travers le lien', () => {
    const { root: outsideRoot, file: outsideFile } = tmpRoot(AVANT);
    const root = mkdtempSync(path.join(os.tmpdir(), 'rtp-migrate-link-'));
    tmpDirs.push(root);
    mkdirSync(path.join(root, 'src'), { recursive: true });
    symlinkSync(path.join(outsideRoot, 'src', 'content'), path.join(root, 'src', 'content'));
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(res.ecrits, []);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['FICHIER_LIEN_SYMBOLIQUE']);
    assert.equal(readFileSync(outsideFile, 'utf8'), AVANT);
  });

  it('inspectVersions signale la racine introuvable', () => {
    const res = inspectVersions(path.join(os.tmpdir(), 'rtp-inexistant-xyz'), { schemasDir: SCHEMAS_DIR });
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['RACINE_INTROUVABLE']);
  });
});

describe('runMigrations : tout ou rien (WR-02)', () => {
  const failOnJean: Migration = {
    schema: 'candidat',
    from: 0,
    to: 1,
    migrate(doc) {
      if (doc.get('id') === 'jean-imaginaire') throw new Error('boum');
      fakeMigration.migrate(doc);
    },
  };

  /** Deux candidats en v0 : marie-fictive (migrable) puis jean-imaginaire (la migration y échoue). */
  function deuxCandidats(): { root: string; marie: string; jean: string } {
    const { root, file: marie } = tmpRoot(AVANT);
    const jean = path.join(path.dirname(marie), 'jean-imaginaire.yaml');
    writeFileSync(jean, AVANT.replace('id: marie-fictive', 'id: jean-imaginaire'));
    return { root, marie, jean };
  }

  it('une migration qui lève sur le 2e fichier : aucun fichier réécrit, diagnostic localisé', () => {
    const { root, marie, jean } = deuxCandidats();
    const beforeJean = readFileSync(jean, 'utf8');
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [failOnJean], write: true });
    assert.deepEqual(res.ecrits, []);
    assert.equal(readFileSync(marie, 'utf8'), AVANT);
    assert.equal(readFileSync(jean, 'utf8'), beforeJean);
    const d = res.diagnostics.find((x) => x.code === 'MIGRATION_ECHEC');
    assert.ok(d, JSON.stringify(res.diagnostics));
    assert.equal(d.file, jean);
    assert.match(d.message, /boum/);
    assert.deepEqual(readdirSync(path.dirname(marie)).filter((n) => n.endsWith('.tmp')), []);
  });

  it('une chaîne manquante bloque tout : registre vide, deux fichiers en retard, rien d\'écrit', () => {
    const { root, marie } = deuxCandidats();
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [], write: true });
    assert.deepEqual(res.ecrits, []);
    assert.equal(res.diagnostics.filter((d) => d.code === 'MIGRATION_CHAINE_MANQUANTE').length, 2);
    assert.equal(readFileSync(marie, 'utf8'), AVANT);
  });

  it('succès : tous les fichiers réécrits, aucun fichier temporaire', () => {
    const { root, marie, jean } = deuxCandidats();
    const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration], write: true });
    assert.deepEqual(res.diagnostics, []);
    assert.deepEqual([...res.ecrits].sort(), [jean, marie].sort());
    assert.equal(readFileSync(marie, 'utf8'), APRES);
    assert.deepEqual(readdirSync(path.dirname(marie)).filter((n) => n.endsWith('.tmp')), []);
  });

  it('échec d\'écriture sur le 2e fichier : le 1er est restauré (corpus inchangé)', { skip: process.getuid?.() === 0 }, () => {
    const { root, file: marie } = tmpRoot(AVANT);
    const glossaireDir = path.join(root, 'src', 'content', 'glossaire');
    mkdirSync(glossaireDir, { recursive: true });
    const loyer = path.join(glossaireDir, 'loyer.yaml');
    const loyerText = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'glossaire', 'loyer.yaml'), 'utf8').replace('version_schema: 1', 'version_schema: 0');
    writeFileSync(loyer, loyerText);
    const glossaireV1: Migration = { schema: 'glossaire', from: 0, to: 1, migrate() {} };
    chmodSync(glossaireDir, 0o555); // création du fichier temporaire impossible
    try {
      const res = runMigrations(root, { schemasDir: SCHEMAS_DIR, registry: [fakeMigration, glossaireV1], write: true });
      assert.deepEqual(res.ecrits, []);
      assert.ok(res.diagnostics.some((d) => d.code === 'MIGRATION_ECRITURE_ECHEC' && d.file === loyer), JSON.stringify(res.diagnostics));
      assert.equal(readFileSync(marie, 'utf8'), AVANT);
      assert.equal(readFileSync(loyer, 'utf8'), loyerText);
    } finally {
      chmodSync(glossaireDir, 0o755);
    }
  });
});
