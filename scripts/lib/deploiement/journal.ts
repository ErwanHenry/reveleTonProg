// Journal local des déploiements et retours depuis le Mac (phase 9.2, D-10 ; LOC-04 ; T-09.2-28, T-09.2-29).
//
// Chaque déploiement, retour automatique et retour arrière ajoute une ligne JSON à
// ~/.local/state/rtp/deploiements.jsonl, hors du dépôt (dossier 0700, fichier 0600). Il remplace, pour les
// actions lancées depuis le Mac, l'historique des runs GitHub : qui a mis quoi en ligne, quand, à la place de quoi,
// avec quel résultat, et si c'était un retrait d'urgence.
//
// Seuls les champs de EntreeJournal sont admis, chacun contrôlé ; une clé inconnue est refusée. Aucune donnée
// personnelle, aucun secret : ni hôte, ni utilisateur, ni URL du serveur (la justification et le message passent
// par masquer, puis sont ramenés à une ligne de 300 caractères au plus). Une écriture impossible n'est qu'un
// avertissement : le journal ne doit jamais faire échouer une action déjà faite sur le serveur.
// N'importe que des modules node:, des modules relatifs et scripts/garde-gel.ts (sans dépendance npm).
import { chmodSync, closeSync, constants, fchmodSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { nettoyerJustification } from '../../garde-gel.ts';
import { cheminsLocaux, type ConfigDeploiement } from './config.ts';
import { masquer } from './masque.ts';

export interface EntreeJournal {
  /** Instant UTC (ISO 8601, suffixe Z). */
  date: string;
  action: 'deployer' | 'retour' | 'retour-auto';
  cible: 'essai' | 'production';
  /** Commit mis en ligne (ou visé) ; null : inconnu (version précédente non atteinte). */
  commit: string | null;
  /** Version en ligne avant l'action ; null : aucune ou inconnue. */
  precedent: string | null;
  resultat: 'succes' | 'echec' | 'refus' | 'retour-auto' | 'sans-retour';
  urgence: boolean;
  justification?: string;
  message?: string;
}

const CLES_OBLIGATOIRES = ['date', 'action', 'cible', 'commit', 'precedent', 'resultat', 'urgence'] as const;
const CLES_FACULTATIVES = ['justification', 'message'] as const;
const ACTIONS: readonly string[] = ['deployer', 'retour', 'retour-auto'];
const CIBLES: readonly string[] = ['essai', 'production'];
const RESULTATS: readonly string[] = ['succes', 'echec', 'refus', 'retour-auto', 'sans-retour'];
const SHA = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const shaOuNull = (v: unknown): boolean => v === null || (typeof v === 'string' && SHA.test(v));

/** Contrôle chaque champ ; lève une Error qui nomme la clé fautive (jamais sa valeur). */
function valider(e: Record<string, unknown>): void {
  const connues = new Set<string>([...CLES_OBLIGATOIRES, ...CLES_FACULTATIVES]);
  for (const k of Object.keys(e)) if (!connues.has(k)) throw new Error(`journal : clé inconnue ${k}`);
  for (const k of CLES_OBLIGATOIRES) if (!(k in e)) throw new Error(`journal : clé manquante ${k}`);
  if (typeof e.date !== 'string' || !DATE.test(e.date) || Number.isNaN(new Date(e.date).getTime())) throw new Error('journal : date ISO 8601 UTC attendue');
  if (typeof e.action !== 'string' || !ACTIONS.includes(e.action)) throw new Error('journal : action inconnue');
  if (typeof e.cible !== 'string' || !CIBLES.includes(e.cible)) throw new Error('journal : cible inconnue');
  if (!shaOuNull(e.commit)) throw new Error('journal : commit de 40 caractères hexadécimaux minuscules ou null attendu');
  if (!shaOuNull(e.precedent)) throw new Error('journal : precedent de 40 caractères hexadécimaux minuscules ou null attendu');
  if (typeof e.resultat !== 'string' || !RESULTATS.includes(e.resultat)) throw new Error('journal : résultat inconnu');
  if (typeof e.urgence !== 'boolean') throw new Error('journal : urgence booléenne attendue');
  for (const k of CLES_FACULTATIVES) {
    if (k in e && typeof e[k] !== 'string') throw new Error(`journal : ${k} doit être un texte`);
  }
}

/**
 * WR-03 (revue de la phase 9.2) : le commit donné a-t-il été mis en ligne sur cette cible par un retrait d'urgence
 * réussi (déploiement ou retour avec --urgence), d'après le journal local ? Journal absent ou ligne illisible : non.
 * Un retrait fait depuis GitHub n'y figure pas : l'avertissement est un filet, pas une garantie.
 */
export function retraitUrgenceEnLigne(home: string, cible: 'essai' | 'production', commit: string): boolean {
  let texte: string;
  try {
    texte = readFileSync(cheminsLocaux(home).journal, 'utf8');
  } catch {
    return false;
  }
  for (const ligne of texte.split('\n')) {
    if (ligne.trim() === '') continue;
    try {
      const e = JSON.parse(ligne) as Partial<EntreeJournal>;
      if ((e.action === 'deployer' || e.action === 'retour') && e.resultat === 'succes' && e.urgence === true && e.cible === cible && e.commit === commit) return true;
    } catch {
      // ligne illisible : ignorée
    }
  }
  return false;
}

/**
 * Ajoute une ligne au journal. Entrée invalide : Error (erreur de programmation, rien n'est écrit). Écriture
 * impossible : avertissement et false. Écrite : true.
 */
export function ajouterJournal(
  home: string,
  entree: EntreeJournal,
  cfg: Pick<ConfigDeploiement, 'hote' | 'utilisateur' | 'url'>,
  avertir: (m: string) => void = (m) => console.warn(m),
): boolean {
  valider(entree as unknown as Record<string, unknown>);
  const propre = (t: string): string => nettoyerJustification(masquer(t, cfg));
  const ligne: EntreeJournal = {
    date: entree.date,
    action: entree.action,
    cible: entree.cible,
    commit: entree.commit,
    precedent: entree.precedent,
    resultat: entree.resultat,
    urgence: entree.urgence,
  };
  if (entree.justification !== undefined) ligne.justification = propre(entree.justification);
  if (entree.message !== undefined) ligne.message = propre(entree.message);

  const fichier = cheminsLocaux(home).journal;
  const dossier = path.dirname(fichier);
  try {
    mkdirSync(dossier, { recursive: true, mode: 0o700 });
    chmodSync(dossier, 0o700);
    // O_NOFOLLOW : un lien posé à la place du journal n'est pas suivi.
    const fd = openSync(fichier, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try {
      fchmodSync(fd, 0o600);
      writeSync(fd, `${JSON.stringify(ligne)}\n`);
    } finally {
      closeSync(fd);
    }
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'erreur';
    avertir(`avertissement : journal local non écrit (${fichier}, ${code}) ; l'action elle-même n'est pas touchée`);
    return false;
  }
}
