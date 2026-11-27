// Mise à jour autonome des statuts (phase 10.3) : liste fermée des issues et des arrêts de l'automate.
// Aucune dépendance. Chaque code a un libellé fixe (alertes-auto.ts) ; aucun texte libre ne sort de l'automate.

export const CODES_ISSUE = ['publie', 'pret_a_blanc', 'rien_a_faire', 'deja_en_ligne'] as const;

export const CODES_ARRET = [
  'gel',
  'main_non_deploye',
  'motif_a_decider',
  'date_au_mois',
  'garde_volume',
  'conflit_import',
  'identite_ambigue',
  'volume_anormal',
  'programme_signale',
  'controle_rouge',
  'doute_agent',
  'source_inaccessible',
  'ci_rouge',
  'perimetre_ecriture',
  'main_a_avance',
  'push_echec',
  'verrou_pris',
  'config_absente',
  'serveur_non_restreint',
  'deploiement_refuse',
  'smoke_echec_retour_ok',
  'smoke_echec_retour_ko',
  'hors_ligne',
  'desactive',
  'reprise_a_blanc',
] as const;

export type CodeIssue = (typeof CODES_ISSUE)[number];
export type CodeArret = (typeof CODES_ARRET)[number];
export type CodeAuto = CodeIssue | CodeArret;

/** Arrêts qui se résolvent seuls ou par une action simple : le passage suivant réessaie. Les autres sont définitifs. */
export const CODES_TRANSITOIRES: readonly CodeAuto[] = [
  'gel',
  'main_non_deploye',
  'source_inaccessible',
  'main_a_avance',
  'push_echec',
  'verrou_pris',
  'config_absente',
  'deploiement_refuse',
  'hors_ligne',
  'desactive',
  'reprise_a_blanc',
];

export function estCodeAuto(v: unknown): v is CodeAuto {
  return typeof v === 'string' && ((CODES_ISSUE as readonly string[]).includes(v) || (CODES_ARRET as readonly string[]).includes(v));
}
