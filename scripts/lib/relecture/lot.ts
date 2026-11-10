// Lot d'éditions tout ou rien (09-06) : toutes les éditions sont calculées et contrôlées en mémoire par le
// même éditeur que `marquer` (définirChamps, qui vérifie lui-même que seules les clés demandées ont changé),
// puis les fichiers sont écrits un par un, puis une vérification est lancée ; si elle échoue ou lève, chaque
// fichier retrouve ses octets d'origine, dans l'ordre inverse des écritures.

import path from 'node:path';
import { readContained } from '../../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../../src/lib/content-core/diagnostics.ts';
import { EditionRefusee, definirChamps, ecrireAtomique } from './editer.ts';
import type { Champ, Chemin } from './editer.ts';

export interface Edition {
  /** Chemin absolu d'un fichier de src/content, tel que loadAll le rapporte. */
  fichier: string;
  chemin: Chemin;
  champs: Champ[];
  /** Clé après laquelle poser le premier champ s'il est absent. */
  apres?: string;
}

export interface ResultatLot {
  ok: boolean;
  /** Raisons d'échec (refus d'édition, erreurs de vérification), une par ligne. */
  erreurs: string[];
  /** Fichiers écrits (et restaurés en cas d'échec), dans l'ordre d'écriture. */
  fichiers: string[];
}

/**
 * Applique `editions` en bloc. `verifier` renvoie les erreurs relevées après l'écriture (liste vide : tout va bien) ;
 * une exception est traitée comme un échec. Rien n'est écrit si une édition est refusée en mémoire.
 */
export function appliquerLot(racine: string, editions: readonly Edition[], verifier: () => string[]): ResultatLot {
  const originaux = new Map<string, string>();
  const nouveaux = new Map<string, string>();
  try {
    for (const e of editions) {
      let texte = nouveaux.get(e.fichier);
      if (texte === undefined) {
        const lu = readContained(racine, e.fichier);
        if ('diagnostic' in lu) return { ok: false, erreurs: [lu.diagnostic.message], fichiers: [] };
        originaux.set(e.fichier, lu.text);
        texte = lu.text;
      }
      nouveaux.set(e.fichier, definirChamps(texte, e.chemin, e.champs, e.apres !== undefined ? { apres: e.apres } : {}));
    }
  } catch (err) {
    if (err instanceof EditionRefusee) return { ok: false, erreurs: [err.message], fichiers: [] };
    throw err;
  }

  const ecrits: string[] = [];
  const restaurer = (): void => {
    for (const f of [...ecrits].reverse()) ecrireAtomique(racine, f, originaux.get(f) ?? '');
  };
  let erreurs: string[];
  try {
    for (const [fichier, texte] of nouveaux) {
      ecrits.push(fichier);
      ecrireAtomique(racine, fichier, texte);
    }
    erreurs = verifier();
  } catch (err) {
    restaurer();
    return { ok: false, erreurs: [err instanceof Error ? err.message : String(err)], fichiers: ecrits };
  }
  if (erreurs.length > 0) {
    restaurer();
    return { ok: false, erreurs, fichiers: ecrits };
  }
  return { ok: true, erreurs: [], fichiers: ecrits };
}

/** Une erreur de validation sur une ligne : fichier relatif, position, code, message. */
export function afficherDiagnostic(racine: string, d: Diagnostic): string {
  return `${path.relative(racine, d.file).split(path.sep).join('/')}:${d.line}:${d.col} ${d.code} ${d.message}`;
}
