import path from 'node:path';
import { isMap, isPair, isSeq } from 'yaml';
import type { Document, LineCounter, Node } from 'yaml';

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  severity: Severity;
  /** Chemin absolu du fichier. */
  file: string;
  line: number;
  /** 1-based. */
  col: number;
  /** Pointeur JSON ('' = racine). */
  pointer: string;
  /** Message en français. */
  message: string;
}

function unescapeSegment(seg: string): string {
  return seg.replaceAll('~1', '/').replaceAll('~0', '~');
}

function startOf(node: unknown): number | undefined {
  const range = (node as { range?: [number, number, number] | null } | null | undefined)?.range;
  return range ? range[0] : undefined;
}

/**
 * Résout un pointeur JSON dans le document YAML et renvoie la position 1-based.
 * 'key' : la clé de la dernière paire résolue (pour une propriété inconnue, un format invalide...).
 * 'node' : la valeur (pour une propriété manquante, on vise l'objet parent).
 * Repli : l'ancêtre le plus profond résolu, puis 1:1.
 */
export function pointerToPos(
  doc: Document.Parsed,
  lc: LineCounter,
  pointer: string,
  prefer: 'key' | 'node',
): { line: number; col: number } {
  const segments = pointer === '' ? [] : pointer.split('/').slice(1).map(unescapeSegment);
  let current: unknown = doc.contents;
  let lastKey: unknown = null;
  for (const seg of segments) {
    if (isMap(current)) {
      const pair = current.items.find((p) => isPair(p) && String((p.key as { value?: unknown } | null)?.value ?? p.key) === seg);
      if (!pair) break;
      lastKey = pair.key;
      current = pair.value ?? pair.key;
    } else if (isSeq(current)) {
      const idx = Number(seg);
      const item = Number.isInteger(idx) ? current.items[idx] : undefined;
      if (item === undefined) break;
      lastKey = null;
      current = item;
    } else {
      break;
    }
  }
  const offset = (prefer === 'key' ? (startOf(lastKey) ?? startOf(current)) : startOf(current)) ?? startOf(doc.contents as Node | null);
  if (offset === undefined) return { line: 1, col: 1 };
  const { line, col } = lc.linePos(offset);
  return { line, col };
}

function relPosix(file: string, cwd: string): string {
  const rel = path.relative(cwd, file);
  return (rel === '' ? file : rel).split(path.sep).join('/');
}

export function formatText(d: Diagnostic, cwd: string = process.cwd()): string {
  return `${relPosix(d.file, cwd)}:${d.line}:${d.col} ${d.code} ${d.message} (${d.pointer === '' ? '/' : d.pointer})`;
}

/** Encodage des données d'une commande de workflow GitHub : % \r \n. */
export function escapeData(s: string): string {
  return s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** Encodage d'une propriété : comme escapeData, plus ':' et ','. */
export function escapeProperty(s: string): string {
  return escapeData(s).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

function annotation(d: Diagnostic, cwd: string): string {
  const kind = d.severity === 'error' ? 'error' : 'warning';
  return `::${kind} file=${escapeProperty(relPosix(d.file, cwd))},line=${d.line},col=${d.col},title=${escapeProperty(d.code)}::${escapeData(d.message)}`;
}

/**
 * Toutes les lignes de texte d'abord, puis au plus `cap` annotations ::error et `cap` ::warning
 * (GitHub ignore silencieusement le surplus : 10 par type et par étape).
 */
export function formatGithub(ds: Diagnostic[], cwd: string = process.cwd(), cap = 10): string[] {
  const lines = ds.map((d) => formatText(d, cwd));
  const errors = ds.filter((d) => d.severity === 'error').slice(0, cap);
  const warnings = ds.filter((d) => d.severity === 'warning').slice(0, cap);
  return [...lines, ...errors.map((d) => annotation(d, cwd)), ...warnings.map((d) => annotation(d, cwd))];
}
