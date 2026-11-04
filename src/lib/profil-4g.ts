// Profils de connexion mobile lente simulée, partagés par la page Méthode et le test e2e de temps de
// chargement (e2e/4g.spec.ts). Chaque profil a son propre budget, publié tel quel sur la page Méthode (WR-04).
//
// Le test applique les profils par CDP (Network.emulateNetworkConditions) : la latence y est ajoutée à chaque
// requête, elle ne simule pas un aller-retour de paquet.
// - `latence-150` : 150 ms par requête, 1,6 Mbit/s. Profil historique du test, nommé pour ce qu'il simule.
// - `slow-4g-lighthouse` : équivalent du « Slow 4G » de Lighthouse (moteur Lantern : 150 ms d'aller-retour,
//   1,6 Mbit/s descendant, 750 kbit/s montant) avec les facteurs que Lighthouse applique en mode DevTools pour
//   ce profil : latence × 3,75 (562,5 ms par requête), débits × 0,9. Une page faite d'un HTML et d'une feuille
//   de style demande deux requêtes l'une après l'autre, soit 1 125 ms de latence au minimum : la seconde
//   n'y est pas atteignable, d'où un budget distinct.
const DEBIT_DESCENDANT = (1.6 * 1024 * 1024) / 8;
const DEBIT_MONTANT = (750 * 1024) / 8;
const LIGHTHOUSE_LATENCE = 3.75;
const LIGHTHOUSE_DEBIT = 0.9;

export interface Profil4G {
  id: string;
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
    libelle: 'une latence de 150 ms par requête et un débit de 1,6 Mbit/s',
    latenceRequeteMs: 150,
    debitDescendantOctetsParSeconde: DEBIT_DESCENDANT,
    debitMontantOctetsParSeconde: DEBIT_MONTANT,
    budgetMs: 1000,
  },
  {
    id: 'slow-4g-lighthouse',
    libelle: 'le profil « Slow 4G » de Lighthouse (562,5 ms de latence par requête, 1,44 Mbit/s)',
    latenceRequeteMs: 150 * LIGHTHOUSE_LATENCE,
    debitDescendantOctetsParSeconde: DEBIT_DESCENDANT * LIGHTHOUSE_DEBIT,
    debitMontantOctetsParSeconde: DEBIT_MONTANT * LIGHTHOUSE_DEBIT,
    budgetMs: 1500,
  },
];
