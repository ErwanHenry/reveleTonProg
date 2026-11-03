import { existsSync, lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { LineCounter, parseDocument, visit } from 'yaml';
import type { Document } from 'yaml';
import { hasSchema, validateData } from './ajv.ts';
import { COLLECTIONS, COLLECTION_NAMES } from './collections.ts';
import type { CollectionName } from './collections.ts';
import { readContained } from './contained.ts';
import { pointerToPos } from './diagnostics.ts';
import type { Diagnostic } from './diagnostics.ts';
import { FAMILLES, appliquerRegles } from './rules/index.ts';
import type { FichierAnalyse, Famille, LoadedEntry, Mode } from './rules/types.ts';

// checkContained/readContained vivent dans un module feuille (les règles ne doivent jamais importer
// load.ts : cycle) ; on les ré-exporte pour que les importeurs existants continuent de fonctionner.
export { checkContained, readContained } from './contained.ts';

// Un seul chemin de parsing pour la CLI, la CI et Astro (DATA-07) : schéma YAML 1.2 "core"
// sans balises personnalisées, donc 2026-11-03 reste une chaîne, jamais une Date.
export const PARSE_OPTIONS = { schema: 'core', uniqueKeys: true, merge: false } as const;
// Aucun alias n'est accepté (pas de "billion laughs", pas d'ambiguïté de relecture).
export const TO_JS_OPTIONS = { maxAliasCount: 0 } as const;

export interface Entry {
  collection: CollectionName;
  id: string;
  file: string;
  data: Record<string, unknown>;
}
export interface LoadOptions {
  schemasDir: string;
  /** `production` par défaut (fail-closed) ; `preview` relâche seulement les règles « selon_mode ». */
  mode?: Mode;
  /** Familles de règles ; par défaut FAMILLES (les tests en injectent de synthétiques). */
  familles?: readonly Famille[];
}
export interface LoadResult {
  entries: Entry[];
  diagnostics: Diagnostic[];
  files: number;
}

const YAML_MESSAGES: Record<string, string> = {
  DUPLICATE_KEY: 'clé en double dans le même objet',
  MULTIPLE_DOCS: 'plusieurs documents YAML dans le même fichier',
  TAG_RESOLVE_FAILED: 'balise YAML inconnue',
  BAD_INDENT: 'indentation incorrecte ou structure non terminée',
};

function diag(code: string, file: string, line: number, col: number, message: string, pointer = ''): Diagnostic {
  return { code, severity: 'error', file, line, col, pointer, message };
}

function yamlMessage(code: string, raw: string): string {
  const first = (raw.split('\n')[0] ?? raw).replace(/\s+at line \d+, column \d+:?$/, '').trim();
  const fr = YAML_MESSAGES[code];
  return fr ? `${fr} (${first})` : first;
}

export function parseYaml(
  text: string,
  file: string,
): { doc: Document.Parsed; lc: LineCounter; data: unknown; diagnostics: Diagnostic[] } {
  const lc = new LineCounter();
  const doc = parseDocument(text, { ...PARSE_OPTIONS, lineCounter: lc });
  const diagnostics: Diagnostic[] = [];

  // Les avertissements (balise inconnue...) comptent comme des erreurs.
  for (const err of [...doc.errors, ...doc.warnings]) {
    const pos = err.linePos?.[0] ?? lc.linePos(err.pos[0]);
    diagnostics.push(diag(`YAML_${err.code}`, file, pos.line, pos.col, yamlMessage(err.code, err.message)));
  }

  let hasAlias = false;
  visit(doc, {
    Alias(_key, node) {
      hasAlias = true;
      const pos = lc.linePos(node.range?.[0] ?? 0);
      diagnostics.push(diag('YAML_ALIAS_INTERDIT', file, pos.line, pos.col, 'les alias YAML (*nom) sont interdits : répéter la valeur'));
    },
  });

  let data: unknown = undefined;
  if (!hasAlias) {
    try {
      data = doc.toJS(TO_JS_OPTIONS);
    } catch {
      diagnostics.push(diag('YAML_ALIAS_INTERDIT', file, 1, 1, 'les alias YAML (*nom) sont interdits : répéter la valeur'));
    }
    if (diagnostics.length === 0 && (data === null || typeof data !== 'object' || Array.isArray(data))) {
      diagnostics.push(diag('YAML_RACINE_NON_OBJET', file, 1, 1, 'le fichier doit contenir un objet YAML (clé: valeur) à la racine'));
    }
  }
  return { doc, lc, data, diagnostics };
}

export function validateYamlText(
  schemaName: string,
  text: string,
  file: string,
  opts: LoadOptions,
): { data: unknown; diagnostics: Diagnostic[]; doc: Document.Parsed; lc: LineCounter } {
  const parsed = parseYaml(text, file);
  const { doc, lc } = parsed;
  if (parsed.diagnostics.some((d) => d.severity === 'error')) return { data: parsed.data, diagnostics: parsed.diagnostics, doc, lc };
  const diagnostics = validateData(opts.schemasDir, schemaName, parsed.data, { file, doc, lc });
  return { data: parsed.data, diagnostics, doc, lc };
}

/**
 * Invariants entre un fichier et son emplacement : l'id déclaré est celui du chemin et, pour une
 * mesure, `candidat` est le dossier parent. Sans cela, déplacer un fichier rattacherait en silence
 * une mesure au mauvais candidat (getMesuresDe filtre sur data.candidat, getEntry sur l'id du chemin).
 */
function checkPathCoherence(
  f: { collection: CollectionName; id: string; file: string },
  data: Record<string, unknown>,
  doc: Document.Parsed,
  lc: LineCounter,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const at = (pointer: string, message: string): void => {
    const pos = pointerToPos(doc, lc, pointer, 'key');
    out.push({ code: 'ID_CHEMIN_INCOHERENT', severity: 'error', file: f.file, line: pos.line, col: pos.col, pointer, message });
  };
  if (data.id !== f.id) at('/id', `l'identifiant « ${String(data.id)} » ne correspond pas au chemin du fichier (attendu : « ${f.id} »)`);
  if (f.collection === 'mesures') {
    const dossier = f.id.slice(0, f.id.indexOf('/'));
    if (data.candidat !== dossier) at('/candidat', `le candidat « ${String(data.candidat)} » ne correspond pas au dossier du fichier (attendu : « ${dossier} »)`);
  }
  return out;
}

const isCollection = (name: string): name is CollectionName => (COLLECTION_NAMES as readonly string[]).includes(name);

export function listContentFiles(contentRoot: string): {
  files: { collection: CollectionName; id: string; file: string }[];
  diagnostics: Diagnostic[];
} {
  const files: { collection: CollectionName; id: string; file: string }[] = [];
  const diagnostics: Diagnostic[] = [];
  const base = path.join(contentRoot, 'src', 'content');
  // Une racine ou un src/content introuvable ne doit jamais valider « 0 erreur » en silence
  // (faute de frappe dans RTP_CONTENT_ROOT ou --root). Un src/content existant mais vide reste
  // accepté : « 0 fichier » est explicite dans le résumé, jusqu'à l'arrivée du contenu réel (Phase 3).
  if (!existsSync(contentRoot)) {
    diagnostics.push(diag('RACINE_INTROUVABLE', contentRoot, 1, 1, 'racine de contenu introuvable (vérifier --root ou RTP_CONTENT_ROOT)'));
    return { files, diagnostics };
  }
  // src/ et src/content/ ne sont jamais des liens symboliques : sinon la lecture (et l'écriture de
  // `migrate --write`) sortirait de la racine de contenu sans que rien ne le signale.
  for (const p of [path.join(contentRoot, 'src'), base]) {
    if (existsSync(p) && lstatSync(p).isSymbolicLink()) {
      diagnostics.push(diag('FICHIER_LIEN_SYMBOLIQUE', p, 1, 1, 'lien symbolique refusé (jamais suivi)'));
      return { files, diagnostics };
    }
  }
  if (!existsSync(base) || !statSync(base).isDirectory()) {
    diagnostics.push(diag('RACINE_INTROUVABLE', base, 1, 1, 'dossier src/content introuvable sous la racine de contenu'));
    return { files, diagnostics };
  }

  const bad = (code: string, file: string, message: string): void => {
    diagnostics.push(diag(code, file, 1, 1, message));
  };
  const entriesOf = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.')).sort((a, b) => (a.name < b.name ? -1 : 1));
  const posix = (p: string): string => p.split(path.sep).join('/');
  // Dirent.isSymbolicLink() ne suffit pas partout : on double avec lstat.
  const isLink = (full: string, d: { isSymbolicLink(): boolean }): boolean => d.isSymbolicLink() || lstatSync(full).isSymbolicLink();

  for (const top of entriesOf(base)) {
    const topPath = path.join(base, top.name);
    if (isLink(topPath, top)) {
      bad('FICHIER_LIEN_SYMBOLIQUE', topPath, 'lien symbolique refusé (jamais suivi)');
      continue;
    }
    if (!top.isDirectory() || !isCollection(top.name)) {
      bad('FICHIER_EMPLACEMENT', topPath, `emplacement inattendu sous src/content/ (collections : ${COLLECTION_NAMES.join(', ')})`);
      continue;
    }
    const collection = top.name;
    const layout = COLLECTIONS[collection].layout;
    for (const e of entriesOf(topPath)) {
      const full = path.join(topPath, e.name);
      if (isLink(full, e)) {
        bad('FICHIER_LIEN_SYMBOLIQUE', full, 'lien symbolique refusé (jamais suivi)');
        continue;
      }
      if (layout === 'flat') {
        if (e.isDirectory()) bad('FICHIER_EMPLACEMENT', full, `pas de sous-dossier dans ${collection}/ : un fichier .yaml par entrée`);
        else if (!e.isFile()) bad('FICHIER_NON_REGULIER', full, 'fichier non régulier refusé (tube, socket, périphérique...)');
        else if (!e.name.endsWith('.yaml')) bad('FICHIER_EXTENSION', full, 'extension .yaml attendue');
        else files.push({ collection, id: e.name.slice(0, -'.yaml'.length), file: full });
        continue;
      }
      // par-candidat : <collection>/<candidat>/<slug>.yaml, exactement deux niveaux.
      if (!e.isDirectory()) {
        bad('FICHIER_EMPLACEMENT', full, `attendu : ${collection}/<candidat>/<slug>.yaml`);
        continue;
      }
      for (const f of entriesOf(full)) {
        const ffull = path.join(full, f.name);
        if (isLink(ffull, f)) bad('FICHIER_LIEN_SYMBOLIQUE', ffull, 'lien symbolique refusé (jamais suivi)');
        else if (f.isDirectory()) bad('FICHIER_EMPLACEMENT', ffull, `attendu : ${collection}/<candidat>/<slug>.yaml, pas de niveau supplémentaire`);
        else if (!f.isFile()) bad('FICHIER_NON_REGULIER', ffull, 'fichier non régulier refusé (tube, socket, périphérique...)');
        else if (!f.name.endsWith('.yaml')) bad('FICHIER_EXTENSION', ffull, 'extension .yaml attendue');
        else files.push({ collection, id: posix(path.join(e.name, f.name.slice(0, -'.yaml'.length))), file: ffull });
      }
    }
  }
  return { files, diagnostics };
}

export function loadAll(contentRoot: string, opts: LoadOptions): LoadResult {
  const listed = listContentFiles(contentRoot);
  const diagnostics: Diagnostic[] = [...listed.diagnostics];
  const entries: Entry[] = [];
  const chargees: LoadedEntry[] = [];
  const fichiers: FichierAnalyse[] = [];
  const listes = new Map<CollectionName, Set<string>>(COLLECTION_NAMES.map((c) => [c, new Set<string>()]));
  for (const f of listed.files) listes.get(f.collection)?.add(f.id);
  for (const f of listed.files) {
    const schemaName = COLLECTIONS[f.collection].schema;
    if (!hasSchema(opts.schemasDir, schemaName)) {
      diagnostics.push(diag('SCHEMA_INCONNU', f.file, 1, 1, `aucun schéma « ${schemaName} » pour la collection ${f.collection}`));
      continue;
    }
    const read = readContained(contentRoot, f.file);
    if ('diagnostic' in read) {
      diagnostics.push(read.diagnostic);
      continue;
    }
    const res = validateYamlText(schemaName, read.text, f.file, opts);
    const own = [...res.diagnostics];
    // Les règles de fichier voient tout fichier dont le YAML s'est lu, même si son schéma échoue.
    if (!own.some((d) => d.code.startsWith('YAML_'))) fichiers.push({ collection: f.collection, id: f.id, file: f.file, doc: res.doc, lc: res.lc });
    if (!own.some((d) => d.severity === 'error')) own.push(...checkPathCoherence(f, res.data as Record<string, unknown>, res.doc, res.lc));
    diagnostics.push(...own);
    if (!own.some((d) => d.severity === 'error')) {
      const data = res.data as Record<string, unknown>;
      entries.push({ collection: f.collection, id: f.id, file: f.file, data });
      chargees.push({ collection: f.collection, id: f.id, file: f.file, data, doc: res.doc, lc: res.lc });
    }
  }
  diagnostics.push(
    ...appliquerRegles({
      mode: opts.mode ?? 'production',
      contentRoot,
      familles: opts.familles ?? FAMILLES,
      fichiers,
      entries: chargees,
      listes,
    }),
  );
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  diagnostics.sort((a, b) => cmp(a.file, b.file) || a.line - b.line || a.col - b.col || cmp(a.code, b.code) || cmp(a.message, b.message));
  return { entries, diagnostics, files: listed.files.length };
}
