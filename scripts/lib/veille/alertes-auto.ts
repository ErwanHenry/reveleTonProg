// Mise à jour autonome des statuts (phase 10.3) : textes d'alerte fermés, envoi, boîte d'envoi.
//
// Une alerte ne contient que : un libellé fixe par code, des comptes, un SHA court, des identifiants de fiche
// (ID_CANDIDAT) et un chemin de rapport en ~/. Jamais un nom complet, jamais un texte produit par un agent.
import { SERVICES, lireSecret, masquer, notifierMac, envoyerTelegram } from './alertes.ts';
import type { Executer, Fetch } from './alertes.ts';
import type { CodeAuto } from './codes-auto.ts';
import { ID_CANDIDAT } from './identite.ts';

export const TITRE_AUTO = 'Mise à jour autonome des statuts';

export const LIBELLES: Record<CodeAuto, string> = {
  publie: 'mise à jour publiée et mise en ligne',
  pret_a_blanc: "passage à blanc réussi : tout est prêt, rien n'est publié tant que l'automate n'est pas activé",
  rien_a_faire: "rien à publier : aucune différence avec l'état en ligne",
  deja_en_ligne: 'le commit poussé a déjà été mis en ligne par un autre déploiement',
  gel: "gel en cours : passage à blanc seulement, rien n'est publié",
  main_non_deploye: "le dernier commit de main n'est pas encore en ligne : l'automate attend",
  motif_a_decider: "désistement d'une personne connue sans motif : décision d'Erwan (npm run veille -- decider)",
  date_au_mois: 'une date de la source est donnée au mois seulement : décision humaine requise',
  garde_volume: 'le nombre de changements dépasse le plafond de sécurité : relecture humaine requise',
  conflit_import: "conflit entre l'import et une décision existante : relecture humaine requise",
  identite_ambigue: "identité d'une personne ambiguë : relecture humaine requise",
  volume_anormal: 'volume de données anormal dans la source amont : relecture humaine requise',
  programme_signale: "un programme est signalé par la source : à examiner, rien n'est publié",
  controle_rouge: 'un contrôle du dépôt est rouge sur la mise à jour : rien n\'est publié',
  doute_agent: "relecture par l'agent d'IA Claude non concluante : rien n'est publié, voir le rapport local",
  source_inaccessible: 'une source est inaccessible : nouvel essai au prochain passage',
  ci_rouge: "la vérification complète (ci:local) a échoué : rien n'est poussé",
  perimetre_ecriture: "une écriture de l'automate sort du périmètre autorisé : rien n'est publié",
  main_a_avance: "main a avancé pendant le passage : rien n'est poussé, nouvel essai au prochain passage",
  push_echec: "la poussée sur main a échoué : rien n'est publié",
  verrou_pris: 'un autre passage est en cours : celui-ci est reporté',
  config_absente: "configuration locale absente ou invalide : rien n'est poussé",
  serveur_non_restreint: "la clé de déploiement automatique n'est pas restreinte côté serveur : rien n'est déployé",
  deploiement_refuse: "le déploiement automatique a été refusé avant toute activation : l'ancienne version reste en ligne",
  smoke_echec_retour_ok: 'vérification après déploiement en échec : retour à la version précédente réussi',
  smoke_echec_retour_ko: 'vérification après déploiement en échec et retour en arrière en échec : intervention humaine immédiate',
  hors_ligne: 'réseau indisponible : nouvel essai au prochain passage',
  desactive: "l'automate est désactivé par l'interrupteur d'arrêt",
  reprise_a_blanc: "mode à blanc (marqueur d'activation absent) : la mise en ligne du commit déjà poussé attend l'activation",
};

export interface Alerte {
  code: CodeAuto;
  mode: 'a_blanc' | 'publier';
  comptes: string | null;
  sha: string | null;
  rapport: string | null;
  fiches: string[];
  home: string;
}

export const PREFIXES_ALERTE = ['Mise à jour autonome : ', 'code : ', 'mode : ', 'comptes : ', 'commit : ', 'fiches : ', 'rapport : '] as const;

const FICHES_MAX = 10;

function cheminHome(chemin: string, home: string): string {
  const h = home.replace(/\/+$/, '');
  return chemin === h ? '~' : chemin.startsWith(`${h}/`) ? `~/${chemin.slice(h.length + 1)}` : chemin;
}

export function texteAlerteAuto(a: Alerte): string {
  const lignes = [`${PREFIXES_ALERTE[0]}${LIBELLES[a.code]}`, `${PREFIXES_ALERTE[1]}${a.code}`, `${PREFIXES_ALERTE[2]}${a.mode === 'publier' ? 'publication' : 'à blanc'}`];
  if (a.comptes !== null && a.comptes !== '') lignes.push(`${PREFIXES_ALERTE[3]}${a.comptes}`);
  if (a.sha !== null && /^[0-9a-f]{40}$/.test(a.sha)) lignes.push(`${PREFIXES_ALERTE[4]}${a.sha.slice(0, 12)}`);
  const fiches = a.fiches.filter((f) => ID_CANDIDAT.test(f));
  if (fiches.length > 0) {
    const reste = fiches.length - FICHES_MAX;
    lignes.push(`${PREFIXES_ALERTE[5]}${fiches.slice(0, FICHES_MAX).join(', ')}${reste > 0 ? ` (+${reste})` : ''}`);
  }
  if (a.rapport !== null && a.rapport !== '') lignes.push(`${PREFIXES_ALERTE[6]}${cheminHome(a.rapport, a.home)}`);
  return lignes.join('\n');
}

export interface DependancesAlerte {
  executer: Executer;
  fetch: Fetch;
  sansAlerte: boolean;
  pause?: (ms: number) => Promise<void>;
}

export async function envoyerAlerteAuto(texte: string, d: DependancesAlerte): Promise<{ telegram: boolean; mac: boolean; incident: string | null }> {
  if (d.sansAlerte) return { telegram: false, mac: false, incident: null };
  const jeton = lireSecret(SERVICES.telegramJeton, d.executer);
  const conversation = lireSecret(SERVICES.telegramConversation, d.executer);
  let telegram = false;
  let incident: string | null = null;
  if (jeton !== null && conversation !== null) {
    const motif = await envoyerTelegram(jeton, conversation, texte, d.fetch, d.pause);
    if (motif === null) telegram = true;
    else incident = masquer(motif, [jeton, conversation]);
  } else {
    incident = 'Telegram non configuré';
  }
  const mac = notifierMac(texte, d.executer, TITRE_AUTO);
  return { telegram, mac, incident };
}

export const BOITE_MAX = 20;

/** Ajoute un texte à la boîte d'envoi ; au-delà de 20, les plus anciens sont retirés et comptés. */
export function ajouterBoite(boite: string[], texte: string): { boite: string[]; perdues: number } {
  const b = [...boite, texte];
  const perdues = Math.max(0, b.length - BOITE_MAX);
  return { boite: b.slice(perdues), perdues };
}

/** Renvoie la boîte dans l'ordre ; s'arrête au premier échec (le reste est gardé). */
export async function viderBoite(boite: string[], envoyer: (t: string) => Promise<boolean>): Promise<{ restantes: string[]; envoyees: number }> {
  let envoyees = 0;
  for (const t of boite) {
    if (!(await envoyer(t))) break;
    envoyees++;
  }
  return { restantes: boite.slice(envoyees), envoyees };
}
