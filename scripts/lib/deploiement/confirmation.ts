// Confirmation humaine avant tout envoi ou retour depuis le Mac (phase 9.2, D-06 ; LOC-03 ; T-09.2-25, T-09.2-26).
//
// Elle remplace l'approbation de l'Environment GitHub : avant d'écrire quoi que ce soit sur le serveur, la commande
// affiche ce qui va se passer (lignesEcran), puis exige une phrase tapée exactement, distincte par action et par
// cible (phraseAttendue) : « deployer essai 1a2b3c4 », « deployer en production 1a2b3c4 », « retour essai
// precedente », « retour en production 1a2b3c4 ». Une phrase différente, même d'une espace ou d'une majuscule,
// arrête tout avant le moindre envoi (code 3).
//
// Comment elle est lue : confirmerSurTerminal ouvre /dev/tty, le terminal de contrôle du processus, et y lit une
// ligne. Ni l'entrée standard, ni une variable d'environnement, ni une option de la ligne de commande ne peuvent
// répondre à sa place, et la CLI (scripts/deploy-local.ts) refuse en premier une entrée standard qui n'est pas un
// terminal, puis ne passe jamais d'autre confirmateur que celui-ci.
//
// Limite, dite franchement : la phrase protège contre l'erreur (mauvaise cible, mauvais commit, commande lancée
// par réflexe), pas contre un attaquant. Tout code qui tourne sous l'utilisateur d'Erwan peut importer cette
// bibliothèque et passer son propre confirmateur, ou lancer la CLI dans un pseudo-terminal (script, expect). La
// vraie barrière est la phrase de passe de la clé dédiée (agent.ts, D-09), que seul Erwan connaît et tape lui-même.
// Voir ADR-063 et le RUNBOOK.
// N'importe que des modules node: et des modules relatifs.
import { closeSync, openSync, readSync, writeSync } from 'node:fs';
import { Sortie } from './gardes.ts';

export type Action = 'deployer' | 'retour';
export type CibleConfirmation = 'essai' | 'production';

/** Reçoit la phrase attendue ; rend la main si elle a été tapée exactement, lève Sortie code 3 sinon. */
export type Confirmateur = (phrase: string) => Promise<void>;

const SHA = /^[0-9a-f]{40}$/;
const SAISIE_MAX = 1024;

/**
 * Phrase à taper : `<action> [en production|essai] <commit sur 7 caractères | precedente>`. null n'est admis que
 * pour un retour (version précédente).
 */
export function phraseAttendue(action: Action, cible: CibleConfirmation, sha: string | null): string {
  if (action !== 'deployer' && action !== 'retour') throw new Error(`action inconnue : ${String(action)}`);
  if (cible !== 'essai' && cible !== 'production') throw new Error(`cible inconnue : ${String(cible)}`);
  if (sha === null && action === 'deployer') throw new Error('un déploiement porte toujours un commit');
  if (sha !== null && !SHA.test(sha)) throw new Error('commit attendu sur 40 caractères hexadécimaux minuscules');
  const quoi = sha === null ? 'precedente' : sha.slice(0, 7);
  const ou = cible === 'production' ? 'en production' : 'essai';
  return `${action} ${ou} ${quoi}`;
}

/**
 * Compare la saisie à la phrase après avoir retiré la seule fin de ligne finale (\n ou \r\n) : ni rognage des
 * espaces, ni changement de casse. Différence : Sortie code 3.
 */
export function verifierPhrase(saisie: string, phrase: string): void {
  const sansFin = saisie.endsWith('\r\n') ? saisie.slice(0, -2) : saisie.endsWith('\n') ? saisie.slice(0, -1) : saisie;
  if (sansFin !== phrase) throw new Sortie(3, "confirmation refusée : rien n'a été envoyé");
}

/**
 * Seul confirmateur de la CLI : écrit la consigne sur /dev/tty, y lit une ligne, la vérifie. Pas de terminal de
 * contrôle (processus détaché, agent, tâche planifiée) : Sortie code 3 sans rien attendre.
 */
export const confirmerSurTerminal: Confirmateur = async (phrase) => {
  let fd: number;
  try {
    fd = openSync('/dev/tty', 'r+');
  } catch {
    throw new Sortie(3, 'aucun terminal : la confirmation doit être tapée par Erwan');
  }
  let saisie = '';
  try {
    writeSync(fd, `Pour confirmer, tapez exactement : ${phrase}\n> `);
    const octets: number[] = [];
    const tampon = Buffer.alloc(1);
    for (;;) {
      let n: number;
      try {
        n = readSync(fd, tampon, 0, 1, null);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EAGAIN') continue;
        throw new Sortie(3, "lecture du terminal impossible : confirmation refusée, rien n'a été envoyé");
      }
      if (n === 0) break; // fin de fichier (Ctrl-D) : la saisie incomplète sera refusée.
      const o = tampon[0] as number;
      octets.push(o);
      if (o === 0x0a || octets.length > SAISIE_MAX) break;
    }
    saisie = Buffer.from(octets).toString('utf8');
  } finally {
    closeSync(fd);
  }
  verifierPhrase(saisie, phrase);
};

/** Ce que l'écran de confirmation montre. Aucun champ pour l'hôte, l'utilisateur ou l'URL du serveur. */
export interface InfosEcran {
  action: Action;
  cible: CibleConfirmation;
  /** Commit à déployer ou à remettre en ligne ; null (retour seulement) : la version précédente. */
  commit?: string | null;
  sujet?: string;
  /** Version en ligne avant l'action ; null : aucune version en ligne. */
  enLigne?: string | null;
  sujetEnLigne?: string;
  dateRecu?: string;
  fichiers?: string;
  empreinte?: string;
  rsync?: string;
  gel?: string;
}

/** Lignes de l'écran de confirmation (fonction pure) : cible en capitales pour la production, champs absents omis. */
export function lignesEcran(i: InfosEcran): string[] {
  const l: string[] = [];
  l.push(i.action === 'deployer' ? 'Déploiement demandé' : 'Retour arrière demandé');
  l.push(`Cible : ${i.cible === 'production' ? 'PRODUCTION' : 'essai'}`);
  if (i.commit !== undefined) {
    const libelle = i.action === 'deployer' ? 'Commit à déployer' : 'Version à remettre en ligne';
    if (i.commit === null) l.push(`${libelle} : la précédente`);
    else l.push(`${libelle} : ${i.commit}${i.sujet === undefined ? '' : ` (${i.sujet})`}`);
  }
  if (i.enLigne !== undefined) {
    if (i.enLigne === null) l.push('Version en ligne : aucune version en ligne');
    else l.push(`Version en ligne : ${i.enLigne}${i.sujetEnLigne === undefined ? '' : ` (${i.sujetEnLigne})`}`);
  }
  if (i.dateRecu !== undefined) l.push(`Reçu de ci:local : ${i.dateRecu}`);
  if (i.fichiers !== undefined) l.push(`Fichiers qui changent : ${i.fichiers}`);
  if (i.empreinte !== undefined) l.push(`Empreinte de la build : ${i.empreinte}`);
  if (i.rsync !== undefined) l.push(`Variante de rsync : ${i.rsync}`);
  if (i.gel !== undefined) l.push(`Garde de gel : ${i.gel}`);
  return l;
}
