// Profil « 4G lente » (Lantern Slow 4G) partagé par la page Méthode et le test e2e de temps de chargement.
export const PROFIL_4G = {
  latenceMs: 150,
  debitDescendantOctetsParSeconde: (1.6 * 1024 * 1024) / 8,
  debitMontantOctetsParSeconde: (750 * 1024) / 8,
  libelle: '150 ms, 1,6 Mbit/s',
} as const;
