// Les deux seules clés du stockage local du navigateur (réglages de présentation).
// Partagé par la page Mentions légales et les tests ; src/scripts/niveau.js et ordre.js portent les
// mêmes littéraux (cohérence testée dans tests/ui/constantes-publiques.test.ts).
export const CLES_STOCKAGE = {
  niveau: { cle: 'rtp:niveau', valeurs: ['resume', 'detaille', 'enfant', 'aine'] },
  ordre: { cle: 'rtp:ordre', valeurs: ['alphabetique', 'aleatoire'] },
} as const;
