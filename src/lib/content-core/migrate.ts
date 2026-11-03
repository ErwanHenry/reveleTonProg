// Migration des fichiers de contenu quand un schéma change de version (DATA-08).
// Moitié "écriture" du squelette : tout passe par l'API Document de `yaml`, jamais par un
// dump de toJS, pour que commentaires, ordre des clés et guillemets survivent.
// Aucun import Astro : ce module sert aussi la CLI et la CI.
import { readFileSync, writeFileSync } from 'node:fs';
import { LineCounter, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import { schemaVersion } from './ajv.ts';
import { COLLECTIONS } from './collections.ts';
import type { CollectionName } from './collections.ts';
import { pointerToPos } from './diagnostics.ts';
import type { Diagnostic } from './diagnostics.ts';
import { PARSE_OPTIONS, listContentFiles } from './load.ts';

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
  const diagnostics: Diagnostic[] = [];
  for (const f of listContentFiles(contentRoot).files) {
    const schema = COLLECTIONS[f.collection].schema;
    const courante = schemaVersion(opts.schemasDir, schema);
    const { doc, lc } = parse(readFileSync(f.file, 'utf8'));
    const base = { file: f.file, collection: f.collection, schema, courante };

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

export function runMigrations(
  contentRoot: string,
  opts: { schemasDir: string; registry: readonly Migration[]; write: boolean },
): { diagnostics: Diagnostic[]; ecrits: string[] } {
  const { fichiers, diagnostics: inspected } = inspectVersions(contentRoot, { schemasDir: opts.schemasDir });
  // Les fichiers en retard sont migrés ci-dessous ; leur diagnostic ne reste que pour un simple contrôle.
  const diagnostics = inspected.filter((d) => opts.write ? d.code !== 'MIGRATION_EN_RETARD' : true);
  const ecrits: string[] = [];

  for (const f of fichiers) {
    if (f.etat !== 'en_retard' || f.version === null) continue; // les autres fichiers ne sont jamais réécrits
    const text = readFileSync(f.file, 'utf8');
    let migrated: string;
    try {
      migrated = migrateText(text, f.schema, f.version, f.courante, opts.registry);
    } catch (e) {
      if (e instanceof Error && (e as { code?: string }).code === 'MIGRATION_CHAINE_MANQUANTE') {
        const { doc, lc } = parse(text);
        const pos = versionPos(doc, lc);
        diagnostics.push(diag('MIGRATION_CHAINE_MANQUANTE', f.file, pos.line, pos.col, e.message));
        continue;
      }
      throw e;
    }
    if (opts.write && migrated !== text) {
      writeFileSync(f.file, migrated); // f.file vient de listContentFiles : toujours sous la racine de contenu
      ecrits.push(f.file);
    }
  }
  return { diagnostics, ecrits };
}
