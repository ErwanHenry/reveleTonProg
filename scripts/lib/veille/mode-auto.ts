// Mise à jour autonome des statuts (phase 10.3) : chemins, interrupteur d'arrêt, marqueur d'activation.
// Le gel est calculé par l'appelant : ce module n'importe rien de deploiement/.
import { lstatSync } from 'node:fs';
import path from 'node:path';

export interface CheminsAuto {
  actif: string;
  desactive: string;
  worktree: string;
  rapports: string;
  verrouCi: string;
  lockNpm: string;
}

export function cheminsAuto(home: string, dossier: string): CheminsAuto {
  return {
    actif: path.join(home, '.config', 'rtp', 'auto-actif'),
    desactive: path.join(dossier, 'auto-desactive'),
    worktree: path.join(dossier, 'auto'),
    rapports: path.join(dossier, 'rapports-auto'),
    verrouCi: path.join(home, '.cache', 'rtp', 'ci', '.verrou'),
    lockNpm: path.join(dossier, 'auto-lock.sha256'),
  };
}

export type ModeAuto = 'desactive' | 'a_blanc' | 'publier';

export function modeAuto(o: { home: string; dossier: string; gel: { gele: boolean; motif: string } }): { mode: ModeAuto; raison: string } {
  const c = cheminsAuto(o.home, o.dossier);
  try {
    lstatSync(c.desactive);
    return { mode: 'desactive', raison: "interrupteur d'arrêt présent" };
  } catch {
    // absent : on poursuit
  }
  let st;
  try {
    st = lstatSync(c.actif);
  } catch {
    return { mode: 'a_blanc', raison: "marqueur d'activation absent" };
  }
  if (!st.isFile()) return { mode: 'a_blanc', raison: "marqueur d'activation invalide" };
  if (o.gel.gele) return { mode: 'a_blanc', raison: o.gel.motif };
  return { mode: 'publier', raison: 'automate activé' };
}
