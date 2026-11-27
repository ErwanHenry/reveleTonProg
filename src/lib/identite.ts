import { initiales } from './initiales.ts';

// Source unique de l'identité affichée du site : nom (en-tête, titres de page, og:site_name, plan 09.1-04), sous-titre
// de l'en-tête et ligne d'identité du pied de page (proposition 5 du lot B, audit B9 et B11).
// Clé « site.nom » du copy deck de 04-UI-SPEC, valeur PAR DÉFAUT : tout changement de valeur est une décision d'Erwan.

// Marqueur technique, indépendant du nom affiché : la sonde externe (.github/workflows/sonde.yml) et le battement du
// serveur (ops/battement.sh, MARQUEUR) cherchent cette chaîne dans la page d'accueil. Émis dans
// <meta name="generator"> par src/layouts/Base.astro ; ne change qu'avec ces deux contrôles.
export const MARQUEUR_SONDE = 'reveleTonProg';

// Nom lisible du site, forme écrite du nom du dépôt « reveleTonProg ». Le tutoiement du nom de marque
// est une exception à la règle du vouvoiement, validée par Erwan.
export const NOM_SITE = 'Révèle ton prog';

// Initiale du nom, dans le logo carré de l'en-tête (P-06) : décorative, aria-hidden.
export const INITIALE_SITE = initiales(NOM_SITE);

// Sous-titre d'une ligne sous le nom, dans l'en-tête de chaque page.
export const SOUS_TITRE = 'Présidentielle 2027 : les programmes, expliqués et sourcés';

// Ligne d'identité en tête du pied de page. Pas de mot « indépendant » : rien dans le dépôt ne
// l'établit ; ce serait une affirmation d'Erwan, à écrire par lui.
export const LIGNE_IDENTITE = `${NOM_SITE} présente les programmes des candidats sans prendre parti, sans publicité et sans cookie.`;

// Intitulé public du jeu de données data.gouv.fr d'où viennent les statuts. Seule saisie du nom dans le code : la fiche
// candidat et la page Méthode le reprennent ; l'URL vient de `page` dans data/dataset-datagouv.yaml.
export const NOM_JEU_DATAGOUV = "Candidatures à l'élection présidentielle 2027, statuts sourcés";
