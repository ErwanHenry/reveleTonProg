// Migration des fichiers de contenu quand un schéma change de version (DATA-08).
// Moitié "écriture" du squelette : tout passe par l'API Document de `yaml`, jamais par un
// dump de toJS, pour que commentaires, ordre des clés et guillemets survivent.
// Aucun import Astro : ce module sert aussi la CLI et la CI.
import { renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LineCounter, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import { schemaVersion } from './ajv.ts';
import { COLLECTIONS } from './collections.ts';
import type { CollectionName } from './collections.ts';
import { pointerToPos } from './diagnostics.ts';
import type { Diagnostic } from './diagnostics.ts';
import { PARSE_OPTIONS, checkContained, listContentFiles, readContained } from './load.ts';

export interface Migration {
  schema: string;
  from: number;
  to: number;
  migrate(doc: Document.Parsed): void;
}

// Pitfall 4 : la largeur par défaut (80) replie les longues valeurs (texte_source, rédactions).
export const TO_STRING_OPTS = { lineWidth: 0 } as const;

export type EtatVersion = 'a_jour' | 'en_retard' | 'trop_recent' | 'invalide';

export interface FichierVersion {
  file: string;
  collection: CollectionName;
  schema: string;
  version: number | null;
  courante: number;
  etat: EtatVersion;
}

function diag(code: string, file: string, line: number, col: number, message: string): Diagnostic {
  return { code, severity: 'error', file, line, col, pointer: '/version_schema', message };
}

function parse(text: string): { doc: Document.Parsed; lc: LineCounter } {
  const lc = new LineCounter();
  const doc = parseDocument(text, { ...PARSE_OPTIONS, lineCounter: lc });
  return { doc, lc };
}

/** Position de la clé version_schema (1:1 si elle est absente). */
function versionPos(doc: Document.Parsed, lc: LineCounter): { line: number; col: number } {
  if (!doc.has('version_schema')) return { line: 1, col: 1 };
  return pointerToPos(doc, lc, '/version_schema', 'key');
}

export function inspectVersions(
  contentRoot: string,
  opts: { schemasDir: string },
): { fichiers: FichierVersion[]; diagnostics: Diagnostic[] } {
  const fichiers: FichierVersion[] = [];
  // Les anomalies d'emplacement (racine introuvable, lien symbolique...) comptent : un contrôle
  // de versions ne doit jamais réussir sur un corpus qu'il n'a pas pu lister.
  const listed = listContentFiles(contentRoot);
  const diagnostics: Diagnostic[] = [...listed.diagnostics];
  for (const f of listed.files) {
    const schema = COLLECTIONS[f.collection].schema;
    const courante = schemaVersion(opts.schemasDir, schema);
    const base = { file: f.file, collection: f.collection, schema, courante };
    const read = readContained(contentRoot, f.file);
    if ('diagnostic' in read) {
      fichiers.push({ ...base, version: null, etat: 'invalide' });
      diagnostics.push(read.diagnostic);
      continue;
    }
    const { doc, lc } = parse(read.text);

    if (doc.errors.length > 0) {
      fichiers.push({ ...base, version: null, etat: 'invalide' });
      diagnostics.push(diag('MIGRATION_VERSION_INVALIDE', f.file, 1, 1, 'fichier YAML illisible : lancer `npm run validate` pour le détail'));
      continue;
    }
    const pos = versionPos(doc, lc);
    const raw: unknown = doc.get('version_schema');
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      fichiers.push({ ...base, version: null, etat: 'invalide' });
      diagnostics.push(
        diag('MIGRATION_VERSION_INVALIDE', f.file, pos.line, pos.col, 'version_schema absent ou invalide : un entier positif ou nul est attendu'),
      );
    } else if (raw < courante) {
      fichiers.push({ ...base, version: raw, etat: 'en_retard' });
      diagnostics.push(
        diag('MIGRATION_EN_RETARD', f.file, pos.line, pos.col, `version_schema ${raw} en retard sur ${courante} : lancer \`npm run migrate -- --write\``),
      );
    } else if (raw > courante) {
      fichiers.push({ ...base, version: raw, etat: 'trop_recent' });
      diagnostics.push(
        diag('MIGRATION_TROP_RECENTE', f.file, pos.line, pos.col, `version_schema ${raw} plus récent que le schéma (${courante}) : mettre à jour les schémas, jamais rétrograder un fichier`),
      );
    } else {
      fichiers.push({ ...base, version: raw, etat: 'a_jour' });
    }
  }
  return { fichiers, diagnostics };
}

function chainError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/** Applique la chaîne from -> from+1 -> ... -> to ; lève une erreur de code MIGRATION_CHAINE_MANQUANTE s'il manque un maillon. */
export function migrateText(text: string, schema: string, from: number, to: number, registry: readonly Migration[]): string {
  const { doc } = parse(text);
  for (let v = from; v < to; v++) {
    const steps = registry.filter((m) => m.schema === schema && m.from === v && m.to === v + 1);
    if (steps.length === 0) throw chainError('MIGRATION_CHAINE_MANQUANTE', `Aucune migration ${schema} v${v} -> v${v + 1}`);
    if (steps.length > 1) throw chainError('MIGRATION_CHAINE_MANQUANTE', `Plusieurs migrations ${schema} v${v} -> v${v + 1} : une seule est autorisée`);
    steps[0]?.migrate(doc);
  }
  // Dernière opération : si une migration échoue, la version n'est jamais avancée.
  doc.set('version_schema', to);
  return doc.toString(TO_STRING_OPTS);
}

interface Pending {
  file: string;
  original: string;
  migrated: string;
}

/** Écriture atomique : fichier temporaire voisin (ignoré par le listage, nom caché) puis renameSync. */
function writeAtomic(file: string, text: string): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    writeFileSync(tmp, text, { flag: 'wx', mode: statSync(file).mode & 0o777 });
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/**
 * Migre en deux phases : (1) calcul du texte migré de TOUS les fichiers en retard, toute erreur
 * devenant un diagnostic localisé ; (2) écriture, seulement si la phase 1 n'a produit aucune erreur
 * de migration. Un échec en cours d'écriture restaure les fichiers déjà réécrits : le corpus est
 * migré en entier ou pas du tout.
 */
export function runMigrations(
  contentRoot: string,
  opts: { schemasDir: string; registry: readonly Migration[]; write: boolean },
): { diagnostics: Diagnostic[]; ecrits: string[] } {
  const { fichiers, diagnostics: inspected } = inspectVersions(contentRoot, { schemasDir: opts.schemasDir });
  // Les fichiers en retard sont migrés ci-dessous ; leur diagnostic ne reste que pour un simple contrôle.
  const diagnostics = inspected.filter((d) => opts.write ? d.code !== 'MIGRATION_EN_RETARD' : true);
  const pending: Pending[] = [];
  let failed = false;

  for (const f of fichiers) {
    if (f.etat !== 'en_retard' || f.version === null) continue; // les autres fichiers ne sont jamais réécrits
    const read = readContained(contentRoot, f.file);
    if ('diagnostic' in read) {
      diagnostics.push(read.diagnostic);
      failed = true;
      continue;
    }
    const text = read.text;
    try {
      const migrated = migrateText(text, f.schema, f.version, f.courante, opts.registry);
      if (migrated !== text) pending.push({ file: f.file, original: text, migrated });
    } catch (e) {
      const { doc, lc } = parse(text);
      const pos = versionPos(doc, lc);
      const code = e instanceof Error && (e as { code?: string }).code === 'MIGRATION_CHAINE_MANQUANTE' ? 'MIGRATION_CHAINE_MANQUANTE' : 'MIGRATION_ECHEC';
      const msg = e instanceof Error ? e.message : String(e);
      diagnostics.push(diag(code, f.file, pos.line, pos.col, code === 'MIGRATION_ECHEC' ? `la migration a échoué : ${msg}` : msg));
      failed = true;
    }
  }
  if (!opts.write || failed) return { diagnostics, ecrits: [] };

  const ecrits: string[] = [];
  for (const p of pending) {
    try {
      const unsafe = checkContained(contentRoot, p.file); // revérifié juste avant l'écriture (TOCTOU)
      if (unsafe) throw new Error(unsafe.message);
      writeAtomic(p.file, p.migrated); // p.file vient de listContentFiles : toujours sous la racine de contenu
      ecrits.push(p.file);
    } catch (e) {
      diagnostics.push(diag('MIGRATION_ECRITURE_ECHEC', p.file, 1, 1, `écriture impossible, migration annulée : ${e instanceof Error ? e.message : String(e)}`));
      for (const done of ecrits.splice(0)) {
        const back = pending.find((x) => x.file === done);
        try {
          if (back) writeAtomic(done, back.original);
        } catch {
          diagnostics.push(diag('MIGRATION_RESTAURATION_ECHEC', done, 1, 1, 'restauration impossible : rétablir ce fichier avec git checkout'));
        }
      }
      break;
    }
  }
  return { diagnostics, ecrits };
}
