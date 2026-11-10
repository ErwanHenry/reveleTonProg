// Registre de relecture, hors du contenu publié (D-04) : relecture/journal.jsonl (une ligne par écriture de
// l'outil, avec l'empreinte du texte relu) et relecture/notes.jsonl (notes de correction ouvertes ou résolues).
// Les deux fichiers sont en ajout seul : une note se résout par une nouvelle ligne, jamais par réécriture.
// Lecture stricte : une ligne cassée ou une clé inconnue est une erreur qui nomme le numéro de ligne.

import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const DOSSIER_REGISTRE = 'relecture';
export const FICHIER_JOURNAL = 'journal.jsonl';
export const FICHIER_NOTES = 'notes.jsonl';
export const NOTE_MAX = 500;

export interface LigneJournal {
  horodatage: string;
  action: string;
  cible: string;
  relecteur: string;
  date: string;
  sha256: string;
}
export interface LigneNote {
  horodatage: string;
  cible: string;
  texte: string;
  etat: 'ouverte' | 'resolue';
}

export class RegistreInvalide extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistreInvalide';
  }
}

const CLES_JOURNAL = ['horodatage', 'action', 'cible', 'relecteur', 'date', 'sha256'] as const;
const CLES_NOTE = ['horodatage', 'cible', 'texte', 'etat'] as const;

function chemin(racine: string, fichier: string): string {
  return path.join(path.resolve(racine), DOSSIER_REGISTRE, fichier);
}

function lireLignes<T>(fichier: string, cles: readonly string[], verifier: (o: Record<string, unknown>) => string | undefined): T[] {
  if (!existsSync(fichier)) return [];
  if (lstatSync(fichier).isSymbolicLink()) throw new RegistreInvalide(`${fichier} : lien symbolique refusé`);
  const lignes = readFileSync(fichier, 'utf8').split('\n');
  const out: T[] = [];
  lignes.forEach((brute, i) => {
    if (brute === '' && i === lignes.length - 1) return;
    let o: unknown;
    try {
      o = JSON.parse(brute);
    } catch {
      throw new RegistreInvalide(`${fichier} ligne ${i + 1} : JSON illisible`);
    }
    if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new RegistreInvalide(`${fichier} ligne ${i + 1} : objet attendu`);
    const rec = o as Record<string, unknown>;
    const inconnue = Object.keys(rec).find((k) => !cles.includes(k));
    if (inconnue !== undefined) throw new RegistreInvalide(`${fichier} ligne ${i + 1} : clé inconnue « ${inconnue} »`);
    const manquante = cles.find((k) => typeof rec[k] !== 'string');
    if (manquante !== undefined) throw new RegistreInvalide(`${fichier} ligne ${i + 1} : « ${manquante} » absente ou non textuelle`);
    const probleme = verifier(rec);
    if (probleme !== undefined) throw new RegistreInvalide(`${fichier} ligne ${i + 1} : ${probleme}`);
    out.push(rec as T);
  });
  return out;
}

function ajouter(racine: string, fichier: string, ligne: object): void {
  const dossier = path.join(path.resolve(racine), DOSSIER_REGISTRE);
  if (existsSync(dossier) && lstatSync(dossier).isSymbolicLink()) throw new RegistreInvalide(`${dossier} : lien symbolique refusé`);
  mkdirSync(dossier, { recursive: true });
  const cible = chemin(racine, fichier);
  if (existsSync(cible) && lstatSync(cible).isSymbolicLink()) throw new RegistreInvalide(`${cible} : lien symbolique refusé`);
  appendFileSync(cible, `${JSON.stringify(ligne)}\n`, 'utf8');
}

export function lireJournal(racine: string): LigneJournal[] {
  return lireLignes<LigneJournal>(chemin(racine, FICHIER_JOURNAL), CLES_JOURNAL, (o) => (/^[0-9a-f]{64}$/.test(String(o.sha256)) ? undefined : 'sha256 invalide'));
}

export function lireNotes(racine: string): LigneNote[] {
  return lireLignes<LigneNote>(chemin(racine, FICHIER_NOTES), CLES_NOTE, (o) => (o.etat === 'ouverte' || o.etat === 'resolue' ? undefined : `état « ${String(o.etat)} » inconnu`));
}

export function ajouterJournal(racine: string, ligne: LigneJournal): void {
  ajouter(racine, FICHIER_JOURNAL, { horodatage: ligne.horodatage, action: ligne.action, cible: ligne.cible, relecteur: ligne.relecteur, date: ligne.date, sha256: ligne.sha256 });
}

/** Vérifie le texte d'une note : non vide, au plus NOTE_MAX caractères, aucun caractère de contrôle. */
export function texteNoteValide(texte: string): string | undefined {
  if (texte.trim() === '') return 'note vide';
  if ([...texte].length > NOTE_MAX) return `note trop longue (${[...texte].length} caractères, maximum ${NOTE_MAX})`;
  if (/\p{Cc}/u.test(texte)) return 'caractère de contrôle refusé dans la note (retour à la ligne compris)';
  return undefined;
}

export function ajouterNote(racine: string, ligne: LigneNote): void {
  if (ligne.etat === 'ouverte') {
    const probleme = texteNoteValide(ligne.texte);
    if (probleme !== undefined) throw new RegistreInvalide(probleme);
  }
  ajouter(racine, FICHIER_NOTES, { horodatage: ligne.horodatage, cible: ligne.cible, texte: ligne.texte, etat: ligne.etat });
}

/** Notes encore ouvertes : celles qui suivent la dernière ligne « resolue » de leur cible. */
export function notesOuvertes(notes: readonly LigneNote[]): Map<string, LigneNote[]> {
  const out = new Map<string, LigneNote[]>();
  for (const n of notes) {
    if (n.etat === 'resolue') out.delete(n.cible);
    else out.set(n.cible, [...(out.get(n.cible) ?? []), n]);
  }
  return out;
}

/** Dernière empreinte enregistrée pour chaque cible. */
export function dernieresEmpreintes(journal: readonly LigneJournal[]): Map<string, LigneJournal> {
  const out = new Map<string, LigneJournal>();
  for (const l of journal) out.set(l.cible, l);
  return out;
}
