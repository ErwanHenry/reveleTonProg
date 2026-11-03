import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import type { Document, LineCounter } from 'yaml';
import { COLLECTIONS } from './collections.ts';
import { pointerToPos } from './diagnostics.ts';
import type { Diagnostic } from './diagnostics.ts';

export const SCHEMA_URN_PREFIX = 'urn:reveletonprog:schema:';

interface SchemaContext {
  ajv: Ajv2020;
  /** Nom de schéma (ce qui suit le préfixe URN) -> JSON du schéma. */
  schemas: Map<string, Record<string, unknown>>;
}

const cache = new Map<string, SchemaContext>();

/** Vraie date calendaire AAAA-MM-JJ (2026-02-30 est refusée). */
function isoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function isoDateTime(s: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) &&
    isoDate(s.slice(0, 10)) &&
    !Number.isNaN(Date.parse(s))
  );
}

function httpsUrl(s: string): boolean {
  return URL.canParse(s) && new URL(s).protocol === 'https:';
}

/** Vide le cache des schémas compilés (rechargement à chaud en dev quand un schéma change). */
export function clearSchemaCache(): void {
  cache.clear();
}

/** Schémas illisibles, mal formés ou qui ne compilent pas : erreur de configuration, pas de contenu. */
export class SchemaLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function context(schemasDir: string): SchemaContext {
  const hit = cache.get(schemasDir);
  if (hit) return hit;
  // Mode strict intact : on corrige les schémas, jamais les options d'Ajv.
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addFormat('date', { type: 'string', validate: isoDate });
  ajv.addFormat('date-time', { type: 'string', validate: isoDateTime });
  ajv.addFormat('https-url', { type: 'string', validate: httpsUrl });
  const schemas = new Map<string, Record<string, unknown>>();
  const files = ['defs/common.schema.json'];
  let names: string[];
  try {
    names = readdirSync(schemasDir).sort();
  } catch (e) {
    throw new SchemaLoadError(`dossier des schémas illisible (${schemasDir}) : ${reason(e)}`);
  }
  for (const name of names) {
    if (name.endsWith('.schema.json')) files.push(name);
  }
  for (const rel of files) {
    try {
      const json = JSON.parse(readFileSync(path.join(schemasDir, rel), 'utf8')) as Record<string, unknown>;
      const id = typeof json.$id === 'string' ? json.$id : '';
      if (!id.startsWith(SCHEMA_URN_PREFIX)) throw new Error(`$id absent ou hors du préfixe ${SCHEMA_URN_PREFIX}`);
      ajv.addSchema(json);
      schemas.set(id.slice(SCHEMA_URN_PREFIX.length), json);
    } catch (e) {
      throw new SchemaLoadError(`schéma ${rel} invalide : ${reason(e)}`);
    }
  }
  // Compilation immédiate : le mode strict signale ici les fautes de schéma (mot-clé inconnu,
  // required hors properties, $ref cassé), même pour une collection qui n'a encore aucun fichier.
  for (const name of schemas.keys()) {
    try {
      ajv.getSchema(SCHEMA_URN_PREFIX + name);
    } catch (e) {
      throw new SchemaLoadError(`schéma « ${name} » ne compile pas : ${reason(e)}`);
    }
  }
  const ctx = { ajv, schemas };
  cache.set(schemasDir, ctx);
  return ctx;
}

/**
 * Contrôle de configuration pour les CLI : les schémas se chargent et compilent, et chaque
 * collection déclarée dans COLLECTIONS a le sien. Lève SchemaLoadError sinon.
 */
export function checkSchemas(schemasDir: string): void {
  const { schemas } = context(schemasDir);
  const missing = [...new Set(Object.values(COLLECTIONS).map((c) => c.schema))].filter((n) => !schemas.has(n));
  if (missing.length > 0) throw new SchemaLoadError(`schéma(s) manquant(s) dans ${schemasDir} : ${missing.join(', ')}`);
}

export function createAjv(schemasDir: string): Ajv2020 {
  return context(schemasDir).ajv;
}

export function hasSchema(schemasDir: string, schemaName: string): boolean {
  return schemaName !== 'common' && context(schemasDir).schemas.has(schemaName);
}

export function schemaVersion(schemasDir: string, schemaName: string): number {
  const json = context(schemasDir).schemas.get(schemaName);
  const props = json?.properties as Record<string, { const?: unknown }> | undefined;
  const v = props?.version_schema?.const;
  if (typeof v !== 'number') throw new Error(`Schéma « ${schemaName} » sans version_schema.const`);
  return v;
}

/** Règle de remplacement de code, pour que la Phase 2 expose des codes métier stables. */
export interface CodeOverride {
  schema?: string;
  keyword: string;
  pointer: RegExp;
  /** Condition supplémentaire sur la valeur observée et les paramètres de l'erreur. */
  when?: (value: unknown, params: Record<string, unknown>) => boolean;
  code: string;
  message?: (value: unknown, params: Record<string, unknown>) => string;
  /**
   * Pointeur JSON servant uniquement au positionnement (préférence « clé ») : une propriété
   * manquante n'a pas de ligne, on vise alors une propriété voisine toujours présente. Le
   * diagnostic garde le pointeur d'Ajv. Si l'ancre est absente, le positionnement d'origine s'applique.
   */
  anchor?: string;
}

export const OVERRIDES: CodeOverride[] = [
  {
    keyword: 'const',
    pointer: /^\/version_schema$/,
    when: (value, params) =>
      Number.isInteger(value) && typeof params.allowedValue === 'number' && (value as number) < params.allowedValue,
    code: 'SCHEMA_VERSION_OBSOLETE',
    message: (value, params) =>
      `version_schema ${String(value)} en retard sur ${String(params.allowedValue)} : lancer \`npm run migrate -- --write\``,
  },
  // REGLE-01 : codes métier stables pour « pas de source primaire archivée ». Le piège §12 « une
  // mesure sans source » doit nommer le problème (SOURCE_ABSENTE) et viser une ligne utile.
  {
    schema: 'mesure',
    keyword: 'required',
    pointer: /^$/,
    when: (_value, params) => params.missingProperty === 'source',
    code: 'SOURCE_ABSENTE',
    message: () => 'mesure sans source : le champ « source » (identifiant d\'une source primaire archivée) est obligatoire',
    anchor: '/texte_source',
  },
  {
    schema: 'mesure',
    keyword: 'required',
    pointer: /^$/,
    when: (_value, params) => params.missingProperty === 'texte_source',
    code: 'TEXTE_SOURCE_ABSENT',
    message: () => 'mesure sans « texte_source » : la citation de la source primaire est obligatoire',
    anchor: '/titre',
  },
  {
    schema: 'source',
    keyword: 'enum',
    pointer: /^\/type$/,
    code: 'SOURCE_NON_PRIMAIRE',
    message: (_value, params) =>
      `type de source non primaire (seules les sources primaires sont admises : ${(params.allowedValues as unknown[]).map(String).join(', ')})`,
  },
  {
    schema: 'source',
    keyword: 'required',
    pointer: /^$/,
    when: (_value, params) => params.missingProperty === 'archive',
    code: 'ARCHIVE_ABSENTE',
    message: () => 'source sans « archive » : un extrait archivé (chemin et empreinte sha256) est obligatoire',
    anchor: '/url',
  },
];

function escapePointerSegment(s: string): string {
  return s.replaceAll('~', '~0').replaceAll('/', '~1');
}

function valueAt(data: unknown, pointer: string): unknown {
  if (pointer === '') return data;
  let cur: unknown = data;
  for (const raw of pointer.split('/').slice(1)) {
    const seg = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function frenchMessage(e: ErrorObject): string {
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case 'required':
      return `propriété obligatoire manquante : « ${String(p.missingProperty)} »`;
    case 'unevaluatedProperties':
      return `propriété inconnue : « ${String(p.unevaluatedProperty)} »`;
    case 'additionalProperties':
      return `propriété inconnue : « ${String(p.additionalProperty)} »`;
    case 'enum':
      return `valeur non autorisée (attendu : ${(p.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ')})`;
    case 'const':
      return `valeur attendue : ${JSON.stringify(p.allowedValue)}`;
    case 'type':
      return `type attendu : ${Array.isArray(p.type) ? p.type.join(' ou ') : String(p.type)}`;
    case 'format':
      return `format « ${String(p.format)} » invalide`;
    case 'pattern':
      return `ne respecte pas le motif ${String(p.pattern)}`;
    case 'minItems':
      return `au moins ${String(p.limit)} élément(s) attendu(s)`;
    case 'minLength':
      return `au moins ${String(p.limit)} caractère(s) attendu(s)`;
    case 'maxLength':
      return `au plus ${String(p.limit)} caractères autorisés`;
    case 'minimum':
      return `valeur minimale : ${String(p.limit)}`;
    case 'maximum':
      return `valeur maximale : ${String(p.limit)}`;
    case 'uniqueItems':
      return 'éléments en double';
    case 'false schema':
      return 'propriété interdite dans ce contexte';
    default:
      return e.message ?? `règle « ${e.keyword} » non respectée`;
  }
}

function pointerOf(e: ErrorObject): string {
  const p = e.params as Record<string, unknown>;
  if (e.keyword === 'unevaluatedProperties') return `${e.instancePath}/${escapePointerSegment(String(p.unevaluatedProperty))}`;
  if (e.keyword === 'additionalProperties') return `${e.instancePath}/${escapePointerSegment(String(p.additionalProperty))}`;
  return e.instancePath;
}

export function validateData(
  schemasDir: string,
  schemaName: string,
  data: unknown,
  ctx: { file: string; doc: Document.Parsed; lc: LineCounter },
): Diagnostic[] {
  const schemaInconnu = (): Diagnostic[] => [
    { code: 'SCHEMA_INCONNU', severity: 'error', file: ctx.file, line: 1, col: 1, pointer: '', message: `aucun schéma « ${schemaName} » dans ${path.basename(schemasDir)}/` },
  ];
  if (!hasSchema(schemasDir, schemaName)) return schemaInconnu();
  const validate = createAjv(schemasDir).getSchema(SCHEMA_URN_PREFIX + schemaName);
  if (!validate) return schemaInconnu();
  if (validate(data)) return [];

  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const e of validate.errors ?? []) {
    // Bruit "doit satisfaire then/else" : l'erreur utile est celle de l'enfant.
    if (e.keyword === 'if' || e.keyword === 'anyOf') continue;
    const pointer = pointerOf(e);
    const params = e.params as Record<string, unknown>;
    let code = e.keyword === 'false schema' ? 'SCHEMA_FALSE' : `SCHEMA_${e.keyword.toUpperCase()}`;
    let message = frenchMessage(e);
    const value = valueAt(data, e.instancePath);
    let anchor: string | undefined;
    for (const o of OVERRIDES) {
      if (o.keyword !== e.keyword || (o.schema !== undefined && o.schema !== schemaName) || !o.pointer.test(pointer)) continue;
      if (o.when && !o.when(value, params)) continue;
      code = o.code;
      message = o.message ? o.message(value, params) : message;
      anchor = o.anchor;
      break;
    }
    const key = `${code}|${pointer}|${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pos =
      anchor !== undefined && valueAt(data, anchor) !== undefined
        ? pointerToPos(ctx.doc, ctx.lc, anchor, 'key')
        : pointerToPos(ctx.doc, ctx.lc, pointer, e.keyword === 'required' ? 'node' : 'key');
    out.push({ code, severity: 'error', file: ctx.file, line: pos.line, col: pos.col, pointer, message });
  }
  return out;
}
