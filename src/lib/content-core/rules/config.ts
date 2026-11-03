import type { CollectionName } from '../collections.ts';

// Configuration éditoriale du moteur de règles (Phase 2).
//
// Module PUR : aucune dépendance Node (seul `import type` est permis), pour que la future page
// Méthode (Phase 5) l'importe telle quelle et affiche les listes, bornes, fenêtres, hypothèses et
// le catalogue de codes réellement appliqués par la CI. Les plans suivants ne modifient pas ce
// fichier : une valeur manquante est un écart à signaler, pas à corriger ici.

// ---------------------------------------------------------------------------
// Mode d'exécution
// ---------------------------------------------------------------------------

export const MODES = ['preview', 'production'] as const;
/** Fail-closed : sans indication, la CI applique le mode le plus strict. */
export const MODE_DEFAUT = 'production';
/** Longueur maximale d'un extrait de texte de contributeur cité dans un message (citer()). */
export const CITER_MAX = 60;

// ---------------------------------------------------------------------------
// Équité (REGLE-08) : statuts qui exigent une couverture (D-2)
// ---------------------------------------------------------------------------

export const PERIMETRE_EQUITE = ['declare', 'primaire'] as const;

// ---------------------------------------------------------------------------
// Champs éditoriaux scannés (REGLE-02, REGLE-04)
// ---------------------------------------------------------------------------

/**
 * Pointeurs JSON des champs de texte éditorial, par collection ; `*` désigne chaque élément d'un
 * tableau. Le « résumé de statut » cité en CONTEXT n'a aucun champ dans le schéma v1 (les statuts
 * portent un code, un motif, une date et une source typée) : un futur champ libre n'exige qu'une
 * ligne ici.
 */
export const CHAMPS_EDITORIAUX: Readonly<Partial<Record<CollectionName, readonly string[]>>> = {
  mesures: ['/titre', '/redactions/resume', '/redactions/detaille', '/redactions/enfant', '/redactions/aine'],
  glossaire: ['/libelle', '/definition'],
  journal: ['/resume'],
  themes: ['/nom', '/sous_themes/*/nom'],
};

/** Champs volontairement exemptés des règles de rédaction (citation ou donnée brute). */
export const CHAMPS_EXEMPTES: readonly string[] = [
  'mesures : texte_source (citation de la source primaire)',
  'mesures : chiffrage.texte (citation de la source primaire)',
  'candidats : parti (nom propre)',
  'sources : titre (peut être un titre de presse)',
];

/** Clés du dataset data.gouv qui ne doivent jamais entrer dans src/content/ (REGLE-12). */
export const CHAMPS_NON_IMPORTABLES = ['bloc', 'extdroite', 'propositions'] as const;

// ---------------------------------------------------------------------------
// Vocabulaire (REGLE-02)
// ---------------------------------------------------------------------------

export interface MotInterdit {
  /** Radical sans accent ni majuscule (comparaison après pliage). */
  motif: string;
  type: 'prefixe' | 'exact';
  exceptions?: readonly string[];
  exemples: readonly string[];
}

export const MOTS_INTERDITS: readonly MotInterdit[] = [
  { motif: 'extrem', type: 'prefixe', exceptions: ['extremite', 'extremites'], exemples: ['extrême', 'extrêmement', 'extrémiste'] },
  { motif: 'populis', type: 'prefixe', exemples: ['populiste', 'populisme'] },
  { motif: 'irresponsab', type: 'prefixe', exemples: ['irresponsable', 'irresponsabilité'] },
  { motif: 'courage', type: 'prefixe', exemples: ['courage', 'courageux', 'courageusement'] },
  { motif: 'enfin', type: 'exact', exemples: ['enfin'] },
];

/** Verbes de parole connotés (avertissement VERBE_CONNOTE) : on écrit « propose », « indique ». */
export const VERBES_CONNOTES: readonly string[] = [
  'promet', 'promettent', 'promettait', 'promettaient', 'prétend', 'prétendent', 'prétendait', 'prétendaient',
  'ose', 'osent', 'osait', 'osaient', 'assure', 'assurent', 'assurait', 'assuraient',
  'affirme', 'affirment', 'affirmait', 'affirmaient', 'martèle', 'martèlent', 'martelait', 'martelaient',
  'reconnaît', 'reconnait', 'reconnaissent', 'reconnaissait', 'reconnaissaient',
  'admet', 'admettent', 'admettait', 'admettaient', 'avoue', 'avouent', 'avouait', 'avouaient',
];
export const VERBES_CONNOTES_PRONOMINAUX = /\bse vant(?:e|ent|ait|aient)\b/u;

/**
 * Marqueur de renvoi au glossaire dans une rédaction : `[[affiché]]` ou `[[affiché|id]]`
 * (hypothèse A2). Regex globale : l'utiliser avec matchAll, jamais avec test()/exec() partagés.
 */
export const MARQUEUR_GLOSSAIRE = /\[\[([^\[\]|]+)(?:\|([a-z0-9]+(?:-[a-z0-9]+)*))?\]\]/g;

/**
 * Liste blanche (CR-01) : tout caractère de format ou d'usage privé (invisible, bidi, étiquettes),
 * toute écriture qui n'est ni latine, ni commune (chiffres, ponctuation, symboles), ni héritée
 * (diacritiques), ainsi que les lettres latines qui imitent une autre lettre (alphabet phonétique
 * et petites capitales U+0250-02AF, U+1D00-1DBF ; i sans point U+0131 ; j sans point U+0237).
 */
export const CARACTERES_SUSPECTS =
  /[\p{Cf}\p{Co}\u0131\u0237\u0250-\u02AF\u1D00-\u1DBF]|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

// ---------------------------------------------------------------------------
// Longueurs et lisibilité (REGLE-03, REGLE-06)
// ---------------------------------------------------------------------------

/** Bornes en mots, par niveau de rédaction. */
export const LONGUEURS = {
  resume: { max: 25 },
  detaille: { min: 80, max: 200 },
  enfant: { min: 40, max: 60 },
  aine: { min: 60, max: 120 },
} as const;

export const PHRASE_ENFANT_MAX = 15;
/** Kandel-Moles : en dessous, avertissement LISIBILITE_ENFANT_FAIBLE (hypothèse A12). */
export const SEUIL_KANDEL_MOLES = 80;
export const KANDEL_MOLES = { base: 207, motsParPhrase: 1.015, syllabesParMot: 73.6 } as const;

// ---------------------------------------------------------------------------
// Chiffres et citations (REGLE-04, REGLE-05)
// ---------------------------------------------------------------------------

/** Niveaux dont les nombres sont vérifiés contre la source (le détaillé ne l'est pas). */
export const CHAMPS_CHIFFRES = ['resume', 'enfant', 'aine'] as const;
/** Garde-fou anti-contournement : longueur (en mots) plausible d'un texte_source (avertissement). */
export const TEXTE_SOURCE_MOTS = { min: 4, max: 120 } as const;

/** Ce que signifie « mot pour mot après normalisation » (affiché tel quel sur la page Méthode). */
export const NORMALISATION_CITATIONS: readonly string[] = [
  'Le texte est normalisé en NFKC, la casse est ignorée et les accents restent significatifs.',
  'Les apostrophes typographiques (’ ‘ ʼ ′ ´) valent l’apostrophe droite et les espaces insécables valent des espaces.',
  'Les guillemets et toute ponctuation sont ignorés, ainsi que les espaces et les retours à la ligne.',
  'Les groupes de chiffres sont fusionnés : « 50 000 » et « 50000 » sont identiques.',
  'La ligature « œ » vaut « oe » et le trait d’union sépare deux mots (« peut-être » = « peut être »).',
  'Une citation ne peut ni commencer ni finir au milieu d’un mot de la source.',
  'Les marques […], (...), … et ... découpent une citation en fragments ; chaque fragment doit figurer, contigu, dans la source (l’ordre entre fragments n’est pas imposé).',
  'Une citation vide est toujours refusée.',
];

export const ARCHIVE_TAILLE_MAX = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Sondages (REGLE-09)
// ---------------------------------------------------------------------------

/** Somme des scores (+ autres), en pourcentage : hors de ces bornes, le sondage est refusé. */
export const SOMME_SONDAGE = { min: 95, max: 105 } as const;

/** Détection d'une hypothèse de second tour (duel) rangée au premier tour (hypothèse A7). */
export const DUEL = {
  scores: 2,
  sommeMin: 99,
  motif: /second tour|2(?:e|nd|ème) tour|duel|face[- ]à[- ]face/i,
} as const;

/**
 * Fenêtres de blocage légal (loi 77-808, art. 11) : instants UTC en dur, début inclus, fin exclue
 * (hypothèses A8 et A10). Paris = UTC+2 aux deux dates. Aucune dépendance au fuseau du processus.
 */
export const FENETRES_BLOCAGE = [
  {
    debut: Date.UTC(2027, 3, 16, 22, 0, 0),
    fin: Date.UTC(2027, 3, 18, 18, 0, 0),
    libelle: 'du samedi 17 avril 2027 00h00 au dimanche 18 avril 20h00 (heure de Paris)',
  },
  {
    debut: Date.UTC(2027, 3, 30, 22, 0, 0),
    fin: Date.UTC(2027, 4, 2, 18, 0, 0),
    libelle: 'du samedi 1er mai 2027 00h00 au dimanche 2 mai 20h00 (heure de Paris)',
  },
] as const;

// ---------------------------------------------------------------------------
// Catalogue des codes
// ---------------------------------------------------------------------------

export type SeveriteCatalogue = 'erreur' | 'avertissement' | 'selon_mode' | 'selon_statut';

export interface EntreeCatalogue {
  code: string;
  regle: string;
  severite: SeveriteCatalogue;
  /** Libellé du piège §12 que ce code referme, sinon null. */
  piege: string | null;
  libelle: string;
}

export const CATALOGUE: readonly EntreeCatalogue[] = [
  // REGLE-01 : source primaire archivée
  { code: 'SOURCE_ABSENTE', regle: 'REGLE-01', severite: 'erreur', piege: '§12 : une mesure sans source', libelle: 'La mesure n’indique aucune source primaire archivée.' },
  { code: 'TEXTE_SOURCE_ABSENT', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'La mesure ne cite pas le texte de sa source.' },
  { code: 'SOURCE_INCONNUE', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'La source citée par la mesure n’existe pas.' },
  { code: 'SOURCE_NON_PRIMAIRE', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'Le type de la source n’est pas un type de source primaire (pas de presse).' },
  { code: 'SOURCE_AUTRE_CANDIDAT', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'La source citée appartient à un autre candidat.' },
  { code: 'ARCHIVE_ABSENTE', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'La source n’a pas d’archive, ou le fichier archivé est introuvable.' },
  { code: 'ARCHIVE_SHA256_DIVERGENT', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'L’empreinte sha256 ne correspond pas aux octets de l’archive.' },
  { code: 'ARCHIVE_TROP_VOLUMINEUX', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'L’archive dépasse la taille maximale autorisée.' },
  { code: 'ARCHIVE_WAYBACK_ABSENTE', regle: 'REGLE-01', severite: 'erreur', piege: null, libelle: 'Une source citée par une mesure publiée n’a pas de capture Wayback Machine.' },
  // REGLE-02 : neutralité du vocabulaire
  { code: 'MOT_INTERDIT', regle: 'REGLE-02', severite: 'erreur', piege: '§12 : une mesure avec un mot interdit', libelle: 'Un mot de la liste des mots interdits figure hors citation.' },
  { code: 'GUILLEMETS_DESEQUILIBRES', regle: 'REGLE-02', severite: 'erreur', piege: null, libelle: 'Les guillemets français ne sont pas équilibrés.' },
  { code: 'VERBE_CONNOTE', regle: 'REGLE-02', severite: 'avertissement', piege: null, libelle: 'Un verbe de parole connoté est employé.' },
  { code: 'CARACTERE_SUSPECT', regle: 'REGLE-02', severite: 'erreur', piege: null, libelle: 'Le texte contient un caractère invisible, de contrôle bidirectionnel, d’une écriture non latine ou imitant une lettre latine.' },
  // REGLE-03 : longueurs
  { code: 'LONGUEUR_HORS_BORNES', regle: 'REGLE-03', severite: 'erreur', piege: null, libelle: 'La rédaction est plus courte ou plus longue que les bornes du niveau.' },
  // REGLE-04 : chiffres et citations
  { code: 'CHIFFRE_HORS_SOURCE', regle: 'REGLE-04', severite: 'erreur', piege: '§12 : une rédaction enfant qui ajoute un chiffre absent du programme', libelle: 'Un chiffre de la rédaction ne figure ni dans le texte de la source ni dans le chiffrage.' },
  { code: 'NOMBRE_LETTRES_HORS_SOURCE', regle: 'REGLE-04', severite: 'avertissement', piege: null, libelle: 'Un nombre écrit en lettres ne figure pas dans la source.' },
  { code: 'CITATION_HORS_SOURCE', regle: 'REGLE-04', severite: 'erreur', piege: null, libelle: 'Une citation entre guillemets n’est pas mot pour mot dans le texte de la source.' },
  // REGLE-05 : fidélité à l'archive
  { code: 'TEXTE_SOURCE_HORS_ARCHIVE', regle: 'REGLE-05', severite: 'erreur', piege: null, libelle: 'Le texte de la source ne figure pas mot pour mot dans l’extrait archivé.' },
  { code: 'CHIFFRAGE_HORS_ARCHIVE', regle: 'REGLE-05', severite: 'erreur', piege: null, libelle: 'Le texte du chiffrage ne figure pas mot pour mot dans l’extrait archivé.' },
  { code: 'TEXTE_SOURCE_TROP_COURT', regle: 'REGLE-05', severite: 'avertissement', piege: null, libelle: 'Le texte de la source est anormalement court.' },
  { code: 'TEXTE_SOURCE_TROP_LONG', regle: 'REGLE-05', severite: 'avertissement', piege: null, libelle: 'Le texte de la source est anormalement long.' },
  // REGLE-06 : lisibilité du niveau enfant
  { code: 'PHRASE_ENFANT_LONGUE', regle: 'REGLE-06', severite: 'selon_statut', piege: null, libelle: 'Une phrase de la rédaction enfant dépasse la longueur maximale.' },
  { code: 'LISIBILITE_ENFANT_FAIBLE', regle: 'REGLE-06', severite: 'avertissement', piege: null, libelle: 'L’indice de lisibilité Kandel-Moles de la rédaction enfant est trop bas.' },
  // REGLE-07 : intégrité du corpus
  { code: 'ID_CHEMIN_INCOHERENT', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'L’identifiant ou le candidat ne correspond pas à l’emplacement du fichier.' },
  { code: 'REFERENCE_CASSEE', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'Une référence pointe vers une entrée qui n’existe pas.' },
  { code: 'ID_VERROUILLE_DISPARU', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'Un identifiant verrouillé dans ids.lock n’a plus de fichier.' },
  { code: 'ID_NON_VERROUILLE', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'Un candidat n’est pas encore verrouillé dans ids.lock.' },
  { code: 'IDS_LOCK_ABSENT', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'Il y a des candidats mais pas de fichier ids.lock.' },
  { code: 'IDS_LOCK_INVALIDE', regle: 'REGLE-07', severite: 'erreur', piege: null, libelle: 'Une ligne de ids.lock est invalide, en double ou mal triée.' },
  // REGLE-08 : équité
  { code: 'EQUITE_CANDIDAT_MANQUANT', regle: 'REGLE-08', severite: 'selon_mode', piege: null, libelle: 'Un candidat déclaré ou primaire n’a ni mesure publiée ni case de couverture sur un thème publié.' },
  { code: 'EQUITE_COUVERTURE_INCOHERENTE', regle: 'REGLE-08', severite: 'selon_mode', piege: null, libelle: 'La couverture d’un thème ne correspond pas aux mesures publiées.' },
  // REGLE-09 : sondages
  { code: 'SONDAGE_NOTICE_ABSENTE', regle: 'REGLE-09', severite: 'erreur', piege: '§12 : un sondage sans notice', libelle: 'Le sondage n’indique pas l’URL de sa notice officielle.' },
  { code: 'SONDAGE_SOMME_HORS_BORNES', regle: 'REGLE-09', severite: 'erreur', piege: '§12 : un sondage dont les scores font 112 %', libelle: 'La somme des scores d’une hypothèse sort des bornes admises.' },
  { code: 'SONDAGE_TOUR2_EN_TOUR1', regle: 'REGLE-09', severite: 'erreur', piege: '§12 : une hypothèse de second tour glissée dans le premier tour', libelle: 'Une hypothèse de duel figure dans un sondage de premier tour.' },
  { code: 'SONDAGE_TOUR1_EN_TOUR2', regle: 'REGLE-09', severite: 'erreur', piege: null, libelle: 'Une hypothèse de plus de deux candidats figure dans un sondage de second tour.' },
  { code: 'SONDAGE_FENETRE_BLOCAGE', regle: 'REGLE-09', severite: 'erreur', piege: '§12 : une date de publication dans la fenêtre de blocage légal', libelle: 'La date de publication tombe dans une fenêtre de blocage légal.' },
  { code: 'SONDAGE_CANDIDAT_DOUBLON', regle: 'REGLE-09', severite: 'erreur', piege: null, libelle: 'Un même candidat apparaît deux fois dans une hypothèse.' },
  // REGLE-12 : champs non importables
  { code: 'CHAMP_NON_IMPORTABLE', regle: 'REGLE-12', severite: 'erreur', piege: null, libelle: 'Un champ du dataset data.gouv, interdit dans le contenu, est présent.' },
  // Moteur
  { code: 'REGLE_ECHEC', regle: 'REGLE-11', severite: 'erreur', piege: null, libelle: 'Une règle a planté : la validation échoue plutôt que de passer en silence.' },
];

// ---------------------------------------------------------------------------
// Hypothèses (A1 à A12) : choix par défaut, fail-closed, à relire par Erwan
// ---------------------------------------------------------------------------

export interface Hypothese {
  id: string;
  regle: string;
  choix: string;
}

export const HYPOTHESES: readonly Hypothese[] = [
  { id: 'A1', regle: 'REGLE-06', choix: 'Environ 170 couples mot/syllabes issus de Lexique 3.83 (CC BY-SA 4.0) sont figés dans un fichier de test pour calibrer le décompte des syllabes, avec crédit à Lexique (New et al.).' },
  { id: 'A2', regle: 'REGLE-07', choix: 'Un renvoi au glossaire s’écrit [[affiché]] ou [[affiché|id]], l’id par défaut étant le slug du texte affiché, et le marqueur est remplacé par son texte avant tout décompte.' },
  { id: 'A3', regle: 'REGLE-06', choix: 'Le statut « relu » est traité comme « publie » pour PHRASE_ENFANT_LONGUE (erreur) ; seul « brouillon » la rétrograde en avertissement.' },
  { id: 'A4', regle: 'REGLE-03', choix: 'LONGUEUR_HORS_BORNES est une erreur quel que soit le statut de relecture.' },
  { id: 'A5', regle: 'REGLE-07', choix: 'Un candidat absent de ids.lock est une erreur (pas seulement un identifiant renommé ou supprimé) : il faut lancer « npm run ids -- --write » dans la même PR.' },
  { id: 'A6', regle: 'REGLE-08', choix: 'Le périmètre d’équité se lit sur le dernier statut de la liste statuts[], quel que soit son statut de relecture.' },
  { id: 'A7', regle: 'REGLE-09', choix: 'Une hypothèse de duel au premier tour compte exactement deux scores dont la somme atteint au moins 99, ou un nom qui évoque le second tour ; les seuils sont dans la configuration.' },
  { id: 'A8', regle: 'REGLE-09', choix: 'Une fenêtre de blocage inclut son instant de début et exclut son instant de fin (20h00 pile est autorisé).' },
  { id: 'A9', regle: 'REGLE-11', choix: 'GitHub affiche au plus 10 erreurs et 10 avertissements en annotations par étape ; les lignes de texte du journal restent toutes imprimées.' },
  { id: 'A10', regle: 'REGLE-09', choix: 'Les bornes 00h00 et 20h00 des fenêtres de blocage viennent de la spécification du projet (§6), pas du texte de l’article 11 de la loi 77-808.' },
  { id: 'A11', regle: 'REGLE-05', choix: 'Mot pour mot après normalisation signifie : casse et ponctuation ignorées, accents significatifs.' },
  { id: 'A12', regle: 'REGLE-06', choix: 'Le seuil Kandel-Moles reste à 80 et ne produit qu’un avertissement, même si la fixture saine demande une retouche pour l’atteindre.' },
];
