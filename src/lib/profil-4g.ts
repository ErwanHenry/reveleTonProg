// Profils de connexion mobile lente simulée, partagés par la page Méthode et le test e2e de temps de
// chargement (e2e/4g.spec.ts). Chaque profil a son propre budget, publié tel quel sur la page Méthode (WR-04).
//
// Le test applique les profils par CDP (Network.emulateNetworkConditions) : la latence y est ajoutée à chaque
// requête, elle ne simule pas un aller-retour de paquet.
// - `latence-150` : 150 ms par requête, 1,6 Mbit/s. Profil historique du test, nommé pour ce qu'il simule.
// - `slow-4g-lighthouse`, publié sous le nom « Slow 4G simulé » : équivalent du « Slow 4G » de Lighthouse
//   (moteur Lantern : 150 ms d'aller-retour, 1,6 Mbit/s descendant, 750 kbit/s montant) avec les facteurs que
//   Lighthouse applique en mode DevTools pour ce profil : latence × 3,75 (562,5 ms par requête), débits × 0,9.
//   Depuis l'intégration du CSS et des scripts dans la page (Phase 7, ADR-056), une page est une seule requête
//   HTML : la latence de 562,5 ms laisse de la place sous 1 s (environ 730 ms mesurés en 07-05 sur la page la
//   plus lourde). Budget de 1 s comme le premier profil, choix d'Erwan du 2026-11-08 (D-13, 08-05) : ne pas
//   le relever pour faire passer un test, signaler l'écart.
const DEBIT_DESCENDANT = (1.6 * 1024 * 1024) / 8;
const DEBIT_MONTANT = (750 * 1024) / 8;
const LIGHTHOUSE_LATENCE = 3.75;
const LIGHTHOUSE_DEBIT = 0.9;

export interface Profil4G {
  id: string;
  /** Nom court, début du libellé : repris dans la phrase de mesure derrière le serveur réel (page Méthode). */
  nom: string;
  libelle: string;
  latenceRequeteMs: number;
  debitDescendantOctetsParSeconde: number;
  debitMontantOctetsParSeconde: number;
  /** Temps de chargement maximal accepté (ms), de la navigation à la fin de l'événement load. */
  budgetMs: number;
}

export const PROFILS_4G: readonly Profil4G[] = [
  {
    id: 'latence-150',
    nom: 'une latence de 150 ms par requête',
    libelle: 'une latence de 150 ms par requête et un débit de 1,6 Mbit/s',
    latenceRequeteMs: 150,
    debitDescendantOctetsParSeconde: DEBIT_DESCENDANT,
    debitMontantOctetsParSeconde: DEBIT_MONTANT,
    budgetMs: 1000,
  },
  {
    id: 'slow-4g-lighthouse',
    nom: 'le profil « Slow 4G simulé »',
    libelle: 'le profil « Slow 4G simulé » (équivalent DevTools du Slow 4G de Lighthouse : 562,5 ms de latence par requête, 1,44 Mbit/s)',
    latenceRequeteMs: 150 * LIGHTHOUSE_LATENCE,
    debitDescendantOctetsParSeconde: DEBIT_DESCENDANT * LIGHTHOUSE_DEBIT,
    debitMontantOctetsParSeconde: DEBIT_MONTANT * LIGHTHOUSE_DEBIT,
    budgetMs: 1000,
  },
];

export interface MesureServeur4G {
  /** Date de la mesure (AAAA-MM-JJ). */
  date: string;
  /** Page mesurée : la plus lourde du dist servi (e2e/poids.ts), même commit que le serveur. */
  page: string;
  /** Poids gzip de la page, calculé sur le dist local (e2e/poids.ts). */
  octetsGzip: number;
  /** Compression choisie par Caddy pour le document. */
  encodage: string;
  /** Trois chargements à froid par profil de PROFILS_4G, dans le même ordre (ms, de la navigation à la fin de load). */
  profils: readonly { id: string; mesuresMs: readonly number[] }[];
  /** Lighthouse lancé à la main (hors dépendances du projet), profil mobile simulé, médiane de trois passages. */
  lighthouse: { version: string; fcpMs: number; lcpMs: number; speedIndexMs: number };
  /** Ce que couvre la mesure (page publiée à cette date). */
  perimetre: string;
  /** Pourquoi Lighthouse et le test du site ne donnent pas les mêmes chiffres. */
  ecart: string;
}

// PERF-02 (D-13, 08-14) : mesure derrière le vrai serveur (Caddy en HTTPS, hôte technique protégé, commit servi
// 0949633), relevée le 2026-11-09 avec e2e/4g.spec.ts en mode distant (en-tête Authorization envoyé d'emblée, aucune
// réponse 401) et Lighthouse 13.0.3. Publiée sur la page Méthode ; README et RUNBOOK reprennent les mêmes chiffres
// (tests/repo/docs.test.ts). Une nouvelle mesure remplace ces valeurs ; un budget ne se relève pas pour la publier.
export const MESURE_SERVEUR_4G: MesureServeur4G = {
  date: '2026-11-09',
  page: '/methode/',
  octetsGzip: 11917,
  encodage: 'zstd',
  profils: [
    { id: 'latence-150', mesuresMs: [345, 300, 304] },
    { id: 'slow-4g-lighthouse', mesuresMs: [716, 722, 723] },
  ],
  lighthouse: { version: '13.0.3', fcpMs: 791, lcpMs: 791, speedIndexMs: 812 },
  perimetre:
    "Aucune page thème n'est encore publiée à cette adresse : la page la plus lourde y est la page Méthode. Les pages thème en préparation, plus lourdes, sont mesurées sur le serveur local par le test décrit plus haut.",
  ecart:
    "Lighthouse ne chronomètre pas le chargement : il le recalcule à partir d'un chargement sans ralentissement, en comptant 150 ms pour chaque aller-retour réseau, y compris ceux qui ouvrent la connexion chiffrée, et un processeur quatre fois plus lent ; ses chiffres portent sur l'affichage, pas sur la fin du chargement. Le test du site ajoute 562,5 ms à chaque requête, ouvre une vraie connexion chiffrée vers le serveur et ne ralentit pas le processeur. Les deux méthodes donnent des chiffres proches, pas identiques.",
};
