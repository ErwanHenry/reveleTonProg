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
// Revue de la phase 9.2 : la lecture est asynchrone (WR-05 : un Ctrl-C à l'invite arrête tout et laisse le
// nettoyage se faire, au lieu d'attendre la touche Entrée), ce qui a été tapé avant l'invite est lu puis jeté
// (IN-04 : une ligne tapée d'avance ne vaut pas confirmation), et l'écran est réécrit sur le terminal quand la
// sortie standard n'en est pas un (IN-04 : sortie redirigée vers un fichier ou tee).
//
// Limite, dite franchement : la phrase protège contre l'erreur (mauvaise cible, mauvais commit, commande lancée
// par réflexe), pas contre un attaquant. Tout code qui tourne sous l'utilisateur d'Erwan peut importer cette
// bibliothèque et passer son propre confirmateur, ou lancer la CLI dans un pseudo-terminal (script, expect). La
// vraie barrière est la phrase de passe de la clé dédiée (agent.ts, D-09), que seul Erwan connaît et tape lui-même.
// Voir ADR-063 et le RUNBOOK.
// N'importe que des modules node: et des modules relatifs.
import { closeSync, openSync, writeSync } from 'node:fs';
import type { Readable } from 'node:stream';
import tty from 'node:tty';
import { Sortie } from './gardes.ts';

export type Action = 'deployer' | 'retour';
export type CibleConfirmation = 'essai' | 'production';

export interface OptionsConfirmation {
  /** WR-05 : signal reçu avant l'activation : la lecture s'arrête (Sortie code 3), rien n'est envoyé. */
  arret?: AbortSignal;
  /** IN-04 : lignes de l'écran, réécrites sur le terminal quand la sortie standard n'en est pas un. */
  ecran?: readonly string[];
}

/** Reçoit la phrase attendue ; rend la main si elle a été tapée exactement, lève Sortie code 3 sinon. */
export type Confirmateur = (phrase: string, o?: OptionsConfirmation) => Promise<void>;

const SHA = /^[0-9a-f]{40}$/;
const SAISIE_MAX = 1024;
/** IN-04 : ce qui arrive du terminal pendant ce délai, avant l'invite, a été tapé d'avance : lu puis jeté. */
const VIDAGE_MS = 150;

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
 * Lit une ligne de confirmation sur un flux (le terminal dans la CLI, un flux factice dans les tests). Ce qui arrive
 * pendant les vidageMs premières millisecondes est jeté (IN-04), puis l'écran éventuel et la consigne sont écrits.
 * La saisie s'arrête à la première fin de ligne, à la fin du flux (Ctrl-D : saisie incomplète) ou au-delà de
 * SAISIE_MAX octets. Arrêt demandé (WR-05) ou erreur de lecture : Sortie code 3.
 */
export function lireConfirmation(
  flux: Readable,
  ecrireTerminal: (texte: string) => void,
  phrase: string,
  o: { arret?: AbortSignal; ecran?: readonly string[]; vidageMs?: number } = {},
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (o.arret?.aborted === true) {
      reject(new Sortie(3, "confirmation interrompue par un signal : rien n'a été envoyé"));
      return;
    }
    const morceaux: Buffer[] = [];
    let taille = 0;
    let prete = false;
    let finie = false;
    const finir = (f: () => void): void => {
      if (finie) return;
      finie = true;
      clearTimeout(minuteur);
      flux.off('data', surDonnees);
      flux.off('end', surFin);
      flux.off('error', surErreur);
      o.arret?.removeEventListener('abort', surArret);
      f();
    };
    const texte = (): string => Buffer.concat(morceaux).toString('utf8');
    function surDonnees(d: Buffer | string): void {
      if (!prete) return; // tapé avant l'invite : jeté (IN-04)
      const b = typeof d === 'string' ? Buffer.from(d, 'utf8') : d;
      const fin = b.indexOf(0x0a);
      const garde = fin === -1 ? b : b.subarray(0, fin + 1);
      morceaux.push(garde);
      taille += garde.length;
      if (fin !== -1 || taille > SAISIE_MAX) finir(() => resolve(texte()));
    }
    function surFin(): void {
      finir(() => resolve(texte()));
    }
    function surErreur(): void {
      finir(() => reject(new Sortie(3, "lecture du terminal impossible : confirmation refusée, rien n'a été envoyé")));
    }
    function surArret(): void {
      finir(() => reject(new Sortie(3, "confirmation interrompue par un signal : rien n'a été envoyé")));
    }
    flux.on('data', surDonnees);
    flux.on('end', surFin);
    flux.on('error', surErreur);
    o.arret?.addEventListener('abort', surArret, { once: true });
    const minuteur = setTimeout(() => {
      prete = true;
      try {
        for (const l of o.ecran ?? []) ecrireTerminal(`${l}\n`);
        ecrireTerminal(`Pour confirmer, tapez exactement : ${phrase}\n> `);
      } catch {
        surErreur();
      }
    }, o.vidageMs ?? VIDAGE_MS);
  });
}

/**
 * Seul confirmateur de la CLI : ouvre /dev/tty, y écrit la consigne (et l'écran si la sortie standard n'est pas un
 * terminal), y lit une ligne sans bloquer la boucle d'événements, la vérifie. Pas de terminal de contrôle (processus
 * détaché, agent, tâche planifiée) : Sortie code 3 sans rien attendre.
 */
export const confirmerSurTerminal: Confirmateur = async (phrase, o = {}) => {
  let fdEcriture: number;
  let fdLecture: number;
  try {
    fdEcriture = openSync('/dev/tty', 'w');
  } catch {
    throw new Sortie(3, 'aucun terminal : la confirmation doit être tapée par Erwan');
  }
  try {
    try {
      fdLecture = openSync('/dev/tty', 'r');
    } catch {
      throw new Sortie(3, 'aucun terminal : la confirmation doit être tapée par Erwan');
    }
    // Le flux du terminal prend en charge fdLecture et le ferme à sa destruction.
    const flux = new tty.ReadStream(fdLecture);
    try {
      const saisie = await lireConfirmation(flux, (t) => writeSync(fdEcriture, t), phrase, {
        ...(o.arret === undefined ? {} : { arret: o.arret }),
        ...(process.stdout.isTTY === true || o.ecran === undefined ? {} : { ecran: o.ecran }),
      });
      verifierPhrase(saisie, phrase);
    } finally {
      flux.destroy();
    }
  } finally {
    closeSync(fdEcriture);
  }
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
