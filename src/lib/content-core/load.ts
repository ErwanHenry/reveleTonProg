import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LineCounter, parseDocument, visit } from 'yaml';
import type { Document } from 'yaml';
import { hasSchema, validateData } from './ajv.ts';
import { COLLECTIONS, COLLECTION_NAMES } from './collections.ts';
import type { CollectionName } from './collections.ts';
import type { Diagnostic } from './diagnostics.ts';

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
): { data: unknown; diagnostics: Diagnostic[] } {
  const parsed = parseYaml(text, file);
  if (parsed.diagnostics.some((d) => d.severity === 'error')) return { data: parsed.data, diagnostics: parsed.diagnostics };
  const diagnostics = validateData(opts.schemasDir, schemaName, parsed.data, { file, doc: parsed.doc, lc: parsed.lc });
  return { data: parsed.data, diagnostics };
}

const isCollection = (name: string): name is CollectionName => (COLLECTION_NAMES as readonly string[]).includes(name);

export function listContentFiles(contentRoot: string): {
  files: { collection: CollectionName; id: string; file: string }[];
  diagnostics: Diagnostic[];
} {
  const files: { collection: CollectionName; id: string; file: string }[] = [];
  const diagnostics: Diagnostic[] = [];
  const base = path.join(contentRoot, 'src', 'content');
  if (!existsSync(base)) return { files, diagnostics };

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
  for (const f of listed.files) {
    const schemaName = COLLECTIONS[f.collection].schema;
    if (!hasSchema(opts.schemasDir, schemaName)) {
      diagnostics.push(diag('SCHEMA_INCONNU', f.file, 1, 1, `aucun schéma « ${schemaName} » pour la collection ${f.collection}`));
      continue;
    }
    const text = readFileSync(f.file, 'utf8');
    const res = validateYamlText(schemaName, text, f.file, opts);
    diagnostics.push(...res.diagnostics);
    if (!res.diagnostics.some((d) => d.severity === 'error')) {
      entries.push({ collection: f.collection, id: f.id, file: f.file, data: res.data as Record<string, unknown> });
    }
  }
  diagnostics.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.col - b.col));
  return { entries, diagnostics, files: listed.files.length };
}
