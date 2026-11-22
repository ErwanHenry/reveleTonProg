// Lot d'éditions tout ou rien (09-06) : toutes les éditions sont calculées et contrôlées en mémoire par le
// même éditeur que `marquer` (définirChamps, qui vérifie lui-même que seules les clés demandées ont changé),
// puis les fichiers sont écrits un par un, puis une vérification est lancée ; si elle échoue ou lève, chaque
// fichier retrouve ses octets d'origine, dans l'ordre inverse des écritures.

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
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

  // Un fichier n'entre dans `ecrits` qu'une fois écrit (revue de la phase 9, WR-04) : un fichier dont l'écriture a
  // échoué n'est pas « restauré », ce qui échouerait de nouveau et laisserait les précédents modifiés. Chaque
  // restauration a son propre essai ; un échec est ajouté aux erreurs renvoyées, jamais levé.
  const ecrits: string[] = [];
  const restaurer = (): string[] => {
    const echecs: string[] = [];
    for (const f of [...ecrits].reverse()) {
      try {
        ecrireAtomique(racine, f, originaux.get(f) ?? '');
      } catch (err) {
        echecs.push(`restauration impossible de ${path.relative(racine, f).split(path.sep).join('/')} : ${err instanceof Error ? err.message : String(err)} (le remettre avec git checkout)`);
      }
    }
    return echecs;
  };
  let erreurs: string[];
  try {
    for (const [fichier, texte] of nouveaux) {
      ecrireAtomique(racine, fichier, texte);
      ecrits.push(fichier);
    }
    erreurs = verifier();
  } catch (err) {
    const echecs = restaurer();
    return { ok: false, erreurs: [err instanceof Error ? err.message : String(err), ...echecs], fichiers: ecrits };
  }
  if (erreurs.length > 0) {
    const echecs = restaurer();
    return { ok: false, erreurs: [...erreurs, ...echecs], fichiers: ecrits };
  }
  return { ok: true, erreurs: [], fichiers: ecrits };
}

/** Ce que la validation lit dans une racine de contenu (load.ts, règles d'archives, d'identifiants, liste blanche). */
const COPIE_ESSAI = ['src/content', 'config', 'archives', 'ids.lock'] as const;

/**
 * Essai à blanc fidèle (revue de la phase 9, IN-04) : le même lot est appliqué à une copie temporaire de ce que lit la
 * validation, puis `verifier` reçoit la racine de la copie. La vraie racine n'est jamais écrite ; la copie est
 * effacée dans tous les cas. Les chemins renvoyés sont ceux de la vraie racine.
 */
export function essayerLot(racine: string, editions: readonly Edition[], verifier: (racineCopie: string) => string[]): ResultatLot {
  const reelle = path.resolve(racine);
  const copie = mkdtempSync(path.join(os.tmpdir(), 'rtp-essai-lot-'));
  try {
    for (const rel of COPIE_ESSAI) {
      const de = path.join(reelle, ...rel.split('/'));
      if (existsSync(de)) cpSync(de, path.join(copie, ...rel.split('/')), { recursive: true });
    }
    const versCopie = (f: string): string => path.join(copie, path.relative(reelle, path.resolve(f)));
    const r = appliquerLot(copie, editions.map((e) => ({ ...e, fichier: versCopie(e.fichier) })), () => verifier(copie));
    return { ...r, fichiers: r.fichiers.map((f) => path.join(reelle, path.relative(copie, f))) };
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
}

/** Une erreur de validation sur une ligne : fichier relatif, position, code, message. */
export function afficherDiagnostic(racine: string, d: Diagnostic): string {
  return `${path.relative(racine, d.file).split(path.sep).join('/')}:${d.line}:${d.col} ${d.code} ${d.message}`;
}
