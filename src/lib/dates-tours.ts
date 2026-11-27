// Source unique des dates des deux tours de l'élection présidentielle, lue par le pied de page, l'accueil et l'image de
// partage. Ce fichier n'a aucun import : la chaîne de déploiement local le suit (tests/repo/deploiement-local.test.ts).
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

// Même règle que formatDate de src/lib/corpus/vue.ts (non importé : ce fichier reste sans import), sans l'année.
const JOUR_MOIS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' });

/** « 2027-05-01 » donne « 1er mai », « 2027-04-18 » donne « 18 avril ». */
export function formatJourMois(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m === null) throw new Error(`date de tour invalide : ${JSON.stringify(d)}`);
  return JOUR_MOIS.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))).replace(/^1 /, '1er ');
}

/** Textes affichables des tours, calculés depuis les dates : l'ordinal vient du numéro, jamais de la position. */
export function libellesTours(tours: readonly { numero: number; date: string }[] = TOURS): {
  annee: string;
  surtitre: string;
  bloc: string;
  repere: string;
} {
  const t1 = tours.find((t) => t.numero === 1);
  const t2 = tours.find((t) => t.numero === 2);
  if (t1 === undefined || t2 === undefined || tours.length !== 2) {
    throw new Error('les tours doivent être exactement le numéro 1 et le numéro 2');
  }
  const annee = t1.date.slice(0, 4);
  if (t2.date.slice(0, 4) !== annee) throw new Error('les deux tours doivent tomber la même année');
  const j1 = formatJourMois(t1.date);
  const j2 = formatJourMois(t2.date);
  return {
    annee,
    surtitre: `Élection présidentielle des ${j1} et ${j2} ${annee}`,
    bloc: `1er tour le ${j1}, 2d tour le ${j2}`,
    repere: `Élection présidentielle, ${j1} et ${j2} ${annee}`,
  };
}
