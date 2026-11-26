// Mise à jour autonome des statuts (phase 10.3) : état persistant de l'automate, fichier séparé etat-auto.json.
// Ne lit ni n'écrit etat.json de la veille. Valeurs par défaut si le fichier est absent, illisible ou d'une autre version.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { estCodeAuto } from './codes-auto.ts';
import type { CodeAuto } from './codes-auto.ts';
import { ecrirePrive } from './etat.ts';
import { ID_CANDIDAT } from './identite.ts';

export interface EtatAuto {
  version: 1;
  phase: 'repos' | 'pousse_non_deploye' | 'retenu';
  sha: string | null;
  empreinteTraitee: string | null;
  empreinteEnCours: string | null;
  dernierCode: CodeAuto | null;
  dernierPassage: string | null;
  derniereAlerte: { code: CodeAuto; empreinte: string | null } | null;
  reportsVerrou: number;
  boite: string[];
  perdues: number;
  fiches: string[];
  comptes: string | null;
  rapport: string | null;
}

export const ETAT_AUTO_VIDE: EtatAuto = {
  version: 1,
  phase: 'repos',
  sha: null,
  empreinteTraitee: null,
  empreinteEnCours: null,
  dernierCode: null,
  dernierPassage: null,
  derniereAlerte: null,
  reportsVerrou: 0,
  boite: [],
  perdues: 0,
  fiches: [],
  comptes: null,
  rapport: null,
};

export const cheminEtatAuto = (dossier: string): string => path.join(dossier, 'etat-auto.json');

const sha40 = (v: unknown): string | null => (typeof v === 'string' && /^[0-9a-f]{40}$/.test(v) ? v : null);
const sha64 = (v: unknown): string | null => (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : null);
const texte = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const entier = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

export function lireEtatAuto(dossier: string): EtatAuto {
  let j: Record<string, unknown>;
  try {
    const brut: unknown = JSON.parse(readFileSync(cheminEtatAuto(dossier), 'utf8'));
    if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return { ...ETAT_AUTO_VIDE };
    j = brut as Record<string, unknown>;
  } catch {
    return { ...ETAT_AUTO_VIDE };
  }
  if (j.version !== 1) return { ...ETAT_AUTO_VIDE };
  const phase = j.phase === 'pousse_non_deploye' || j.phase === 'retenu' ? j.phase : 'repos';
  const da = j.derniereAlerte as { code?: unknown; empreinte?: unknown } | null | undefined;
  return {
    version: 1,
    phase,
    sha: sha40(j.sha),
    empreinteTraitee: sha64(j.empreinteTraitee),
    empreinteEnCours: sha64(j.empreinteEnCours),
    dernierCode: estCodeAuto(j.dernierCode) ? j.dernierCode : null,
    dernierPassage: texte(j.dernierPassage, 40),
    derniereAlerte: da !== null && da !== undefined && typeof da === 'object' && estCodeAuto(da.code) ? { code: da.code, empreinte: sha64(da.empreinte) } : null,
    reportsVerrou: entier(j.reportsVerrou),
    boite: Array.isArray(j.boite) ? j.boite.filter((t): t is string => typeof t === 'string' && t.length <= 2000) : [],
    perdues: entier(j.perdues),
    fiches: Array.isArray(j.fiches) ? j.fiches.filter((f): f is string => typeof f === 'string' && ID_CANDIDAT.test(f)) : [],
    comptes: texte(j.comptes, 200),
    rapport: texte(j.rapport, 500),
  };
}

export function ecrireEtatAuto(dossier: string, etat: EtatAuto): void {
  ecrirePrive(cheminEtatAuto(dossier), `${JSON.stringify(etat, null, 2)}\n`);
}

/** Lignes d'affichage : aucune valeur de secret, aucun chemin de configuration. */
export function lignesEtatAuto(e: EtatAuto): string[] {
  return [
    `Phase de l'automate : ${e.phase}`,
    `Dernier code : ${e.dernierCode ?? 'aucun'}`,
    `Dernier passage : ${e.dernierPassage ?? 'jamais'}`,
    `Commit en attente : ${e.sha === null ? 'aucun' : e.sha.slice(0, 12)}`,
    `Alertes en boîte d'envoi : ${e.boite.length}`,
  ];
}
