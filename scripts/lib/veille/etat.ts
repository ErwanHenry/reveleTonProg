// Veille des candidatures (phase 10.1) : dossier de données et état, hors dépôt.
// Le dossier (~/.cache/rtp/veille, à côté des reçus de ci:local) contient : l'état, les rapports datés, les octets
// amont gardés par empreinte, le worktree détaché de la veille et le verrou. Rien de ce dossier n'entre dans le dépôt.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const dossierVeille = (env: NodeJS.ProcessEnv, home: string): string =>
  env.RTP_VEILLE_DIR !== undefined && env.RTP_VEILLE_DIR !== '' ? path.resolve(env.RTP_VEILLE_DIR) : path.join(home, '.cache', 'rtp', 'veille');

export const cheminEtat = (dossier: string): string => path.join(dossier, 'etat.json');
export const dossierRapports = (dossier: string): string => path.join(dossier, 'rapports');
export const dossierAmont = (dossier: string): string => path.join(dossier, 'amont');
export const dossierArbre = (dossier: string): string => path.join(dossier, 'arbre');
export const dossierVerrou = (dossier: string): string => path.join(dossier, 'verrou');

export type CodePassage = 'nouveau' | 'deja_vu' | 'panne';

export interface EtatVeille {
  version: 1;
  /** Date ISO du dernier passage (réussi ou non). */
  dernierPassage: string | null;
  dernierCode: CodePassage | null;
  /** Message de panne du dernier passage, sans secret. */
  derniereErreur: string | null;
  /** SHA-256 des derniers octets amont analysés avec succès. */
  derniereEmpreinte: string | null;
  /** Chemin des octets amont gardés pour cette empreinte. */
  dernierAmont: string | null;
  dernierRapport: string | null;
  /** Commit de la référence suivie (origin/main) sur lequel le rapport a été calculé. */
  dernierCommit: string | null;
  dernierNotable: boolean;
  dernierComptes: string | null;
  /** Canaux configurés au dernier passage (oui ou non, jamais la valeur). */
  canaux: { telegram: boolean; healthchecks: boolean };
  /** Dernier incident d'un canal d'alerte (la veille n'échoue pas pour autant), sans secret. */
  incidentAlerte: string | null;
}

export const ETAT_VIDE: EtatVeille = {
  version: 1,
  dernierPassage: null,
  dernierCode: null,
  derniereErreur: null,
  derniereEmpreinte: null,
  dernierAmont: null,
  dernierRapport: null,
  dernierCommit: null,
  dernierNotable: false,
  dernierComptes: null,
  canaux: { telegram: false, healthchecks: false },
  incidentAlerte: null,
};

export function lireEtat(dossier: string): EtatVeille {
  try {
    const j = JSON.parse(readFileSync(cheminEtat(dossier), 'utf8')) as Partial<EtatVeille>;
    if (j.version !== 1) return { ...ETAT_VIDE };
    return { ...ETAT_VIDE, ...j, canaux: { ...ETAT_VIDE.canaux, ...(j.canaux ?? {}) } };
  } catch {
    return { ...ETAT_VIDE };
  }
}

/** Écriture atomique, fichier 0600 dans un dossier 0700. */
export function ecrirePrive(fichier: string, contenu: string | Buffer): void {
  mkdirSync(path.dirname(fichier), { recursive: true, mode: 0o700 });
  const tmp = `${fichier}.tmp-${process.pid}`;
  writeFileSync(tmp, contenu, { mode: 0o600 });
  renameSync(tmp, fichier);
}

export function ecrireEtat(dossier: string, etat: EtatVeille): void {
  ecrirePrive(cheminEtat(dossier), `${JSON.stringify(etat, null, 2)}\n`);
}

/** Lignes de `npm run veille -- etat` : aucune valeur secrète, seulement oui ou non pour les canaux. */
export function lignesEtat(dossier: string, e: EtatVeille): string[] {
  const oui = (b: boolean): string => (b ? 'oui' : 'non');
  return [
    `dossier : ${dossier}`,
    `dernier passage : ${e.dernierPassage ?? 'jamais'} (${e.dernierCode ?? 'aucun'})`,
    ...(e.derniereErreur !== null && e.dernierCode === 'panne' ? [`panne : ${e.derniereErreur}`] : []),
    `dernière empreinte amont : ${e.derniereEmpreinte ?? 'aucune'}`,
    `dernier commit analysé : ${e.dernierCommit ?? 'aucun'}`,
    `dernier rapport : ${e.dernierRapport ?? 'aucun'}`,
    `à décider ou à relire : ${e.dernierComptes ?? 'aucun passage'}${e.dernierNotable ? '' : ' (aucune alerte)'}`,
    `Telegram configuré : ${oui(e.canaux.telegram)} ; Healthchecks configuré : ${oui(e.canaux.healthchecks)}`,
    ...(e.incidentAlerte !== null ? [`dernier incident d'alerte : ${e.incidentAlerte}`] : []),
  ];
}
