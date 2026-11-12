// Source unique de l'identité affichée du site : nom (en-tête, titres de page, og:site_name, plan 09.1-04), sous-titre
// de l'en-tête et ligne d'identité du pied de page (proposition 5 du lot B, audit B9 et B11).
// Clé « site.nom » du copy deck de 04-UI-SPEC, valeur PAR DÉFAUT : tout changement de valeur est une décision d'Erwan.

// Marqueur technique, indépendant du nom affiché : la sonde externe (.github/workflows/sonde.yml) et le battement du
// serveur (ops/battement.sh, MARQUEUR) cherchent cette chaîne dans la page d'accueil. Émis dans
// <meta name="generator"> par src/layouts/Base.astro ; ne change qu'avec ces deux contrôles.
export const MARQUEUR_SONDE = 'reveleTonProg';

// BROUILLON 09.1 : nom lisible du site, forme écrite du nom du dépôt « reveleTonProg ». Le tutoiement du nom de marque
// est une exception à la règle du vouvoiement, à confirmer par Erwan (il peut garder « reveleTonProg » ou en choisir un autre).
export const NOM_SITE = 'Révèle ton prog';

// BROUILLON 09.1 : sous-titre d'une ligne sous le nom, dans l'en-tête de chaque page.
export const SOUS_TITRE = 'Présidentielle 2027 : les programmes, expliqués et sourcés';

// BROUILLON 09.1 : ligne d'identité en tête du pied de page. Pas de mot « indépendant » : rien dans le dépôt ne
// l'établit ; s'il le souhaite, c'est une affirmation d'Erwan, à écrire par lui.
export const LIGNE_IDENTITE = `${NOM_SITE} présente les programmes des candidats sans prendre parti, sans publicité et sans cookie.`;
