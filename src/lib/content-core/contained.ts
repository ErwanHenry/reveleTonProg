import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Diagnostic } from './diagnostics.ts';

// Module feuille : il n'importe rien d'autre de content-core que le type Diagnostic. Les modules de
// règles (rules/**) en dépendent sans jamais importer load.ts, qui importe lui-même rules/index.ts
// (sinon : cycle load -> index -> règle -> load, et une ReferenceError sur zone morte temporelle).

function diag(code: string, file: string, line: number, col: number, message: string, pointer = ''): Diagnostic {
  return { code, severity: 'error', file, line, col, pointer, message };
}

/**
 * Lecture sûre d'un fichier de contenu, juste avant usage (le listage seul laisse une fenêtre
 * TOCTOU) : refuse lien symbolique, fichier non régulier et tout chemin dont le realpath sort de la
 * racine de contenu. Une erreur d'E/S devient un diagnostic, jamais une exception.
 */
export function checkContained(contentRoot: string, file: string): Diagnostic | undefined {
  try {
    const st = lstatSync(file);
    if (st.isSymbolicLink()) return diag('FICHIER_LIEN_SYMBOLIQUE', file, 1, 1, 'lien symbolique refusé (jamais suivi)');
    if (!st.isFile()) return diag('FICHIER_NON_REGULIER', file, 1, 1, 'fichier non régulier refusé (tube, socket, périphérique...)');
    const rootReal = realpathSync(contentRoot);
    if (!realpathSync(file).startsWith(rootReal + path.sep)) {
      return diag('FICHIER_HORS_RACINE', file, 1, 1, 'le fichier se résout hors de la racine de contenu : refusé');
    }
    return undefined;
  } catch (e) {
    return diag('FICHIER_ILLISIBLE', file, 1, 1, `fichier illisible (${e instanceof Error ? e.message : String(e)})`);
  }
}

export function readContained(contentRoot: string, file: string): { text: string } | { diagnostic: Diagnostic } {
  const diagnostic = checkContained(contentRoot, file);
  if (diagnostic) return { diagnostic };
  try {
    return { text: readFileSync(file, 'utf8') };
  } catch (e) {
    return { diagnostic: diag('FICHIER_ILLISIBLE', file, 1, 1, `fichier illisible (${e instanceof Error ? e.message : String(e)})`) };
  }
}
