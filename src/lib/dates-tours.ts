// Source unique des dates des deux tours de l'élection présidentielle 2027 (affichées dans le pied de page).
export const TOURS = [
  { numero: 1, date: '2027-04-18' },
  { numero: 2, date: '2027-05-02' },
] as const;

// Source officielle des dates (service-public.fr, site de l'administration), relevée à la date indiquée.
export const SOURCE_DATES: { titre: string; url: string; consulte_le: string } | null = {
  titre: 'Service-Public.fr : Quelles sont les dates des prochaines élections ?',
  url: 'https://www.service-public.fr/particuliers/vosdroits/F1939',
  consulte_le: '2026-11-03',
};
