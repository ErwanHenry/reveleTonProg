import type { Document, LineCounter } from 'yaml';
import type { CollectionName } from '../collections.ts';
import { CITER_MAX } from './config.ts';

// Contrats du moteur de règles. Aucun import node: ici : le module reste pur.

/** `production` (défaut, fail-closed) ou `preview` (relâche uniquement les règles « selon_mode »). */
export type Mode = 'preview' | 'production';
export type Severite = 'error' | 'warning';

export interface Finding {
  /** Doit figurer dans CATALOGUE. */
  code: string;
  /** Par défaut `error`. */
  severity?: Severite;
  /** Pointeur JSON dans `file` ('' = racine). */
  pointer: string;
  /** Français ; le texte d'un contributeur ne s'y cite que via citer(). */
  message: string;
  /** Chemin absolu ; par défaut l'entrée / le fichier examiné. */
  file?: string;
  /** Position explicite (fichier non YAML comme ids.lock, ou position déjà détenue). */
  at?: { line: number; col: number };
}

export interface LoadedEntry {
  collection: CollectionName;
  id: string;
  file: string;
  data: Record<string, unknown>;
  doc: Document.Parsed;
  lc: LineCounter;
}

export interface FichierAnalyse {
  collection: CollectionName;
  id: string;
  file: string;
  doc: Document.Parsed;
  lc: LineCounter;
}

export interface Corpus {
  /** Entrées valides au schéma et cohérentes avec leur chemin. */
  entries: readonly LoadedEntry[];
  de(collection: CollectionName): readonly LoadedEntry[];
  entree(collection: CollectionName, id: string): LoadedEntry | undefined;
  /** Ids de TOUS les fichiers listés, valides ou non (pas de cascade d'erreurs). */
  listes: ReadonlyMap<CollectionName, ReadonlySet<string>>;
  /** Un fichier listé de cette collection n'est pas dans `entries`. */
  aDesInvalides(collection: CollectionName): boolean;
}

export interface RuleContext {
  mode: Mode;
  contentRoot: string;
  corpus: Corpus;
  /** Mémo partagé entre règles d'un même chargement (ex. extraits d'archive déjà lus). */
  cache: Map<string, unknown>;
}

export interface FileRule {
  id: string;
  run(f: FichierAnalyse, ctx: RuleContext): Finding[];
}
export interface EntryRule {
  id: string;
  run(e: LoadedEntry, ctx: RuleContext): Finding[];
}
export interface CorpusRule {
  id: string;
  run(ctx: RuleContext): Finding[];
}

export interface Famille {
  id: string;
  fichier: readonly FileRule[];
  entree: readonly EntryRule[];
  corpus: readonly CorpusRule[];
}

/**
 * Prépare un extrait de texte de contributeur pour un message : espaces normalisés, tronqué à
 * `max` caractères (CITER_MAX par défaut) puis « … ». Ne retire PAS les caractères de contrôle :
 * formatText/formatGithub (safe, escapeData) restent les seuls afficheurs.
 */
export function citer(s: string, max: number = CITER_MAX): string {
  const propre = s.replace(/\s+/g, ' ').trim();
  const lettres = Array.from(propre);
  return lettres.length <= max ? propre : `${lettres.slice(0, max).join('')}…`;
}
