// Textes de l'image de partage (proposition 6 du lot B, D-04). Source unique : la page de capture
// scripts/partage.html (via scripts/partage.ts) et les balises og:image de src/layouts/Base.astro la lisent ici.
// Aucun nom de site dans l'image : elle ne dépend donc pas du nom affiché (proposition 5) ; le nom est porté par
// og:site_name et og:title, hors de l'image.

// BROUILLON 09.1 : phrase de l'image, à valider ou réécrire par Erwan. Pas de « thème par thème » : le site ouvre avec
// un seul thème publié. Après tout changement de texte, relancer « node scripts/partage.ts » (le contrôle de
// scripts/partage.ts --check refuse une image qui ne correspond plus au texte).
export const PROMESSE_PARTAGE = 'Les programmes de la présidentielle 2027, expliqués et sourcés.';

// BROUILLON 09.1 : ligne au-dessus de la phrase, dates des deux tours (18 avril et 2 mai 2027).
export const REPERE_PARTAGE = 'Élection présidentielle, 18 avril et 2 mai 2027';

/** Texte alternatif de l'image (og:image:alt) : la phrase de l'image. */
export const ALT_PARTAGE = PROMESSE_PARTAGE;

/** Fichier public/partage.png, servi à la racine du dist. */
export const FICHIER_PARTAGE = 'partage.png';
export const LARGEUR_PARTAGE = 1200;
export const HAUTEUR_PARTAGE = 630;
