import { MARQUEUR_GLOSSAIRE } from '../config.ts';

// Couche texte française (Phase 2). Module PUR : aucun import node:, importable par Astro.

const SPACE_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g; // NBSP, espaces fines, insécables fines...
// Tout caractère de format (Cf : marques bidi, opérateurs invisibles, étiquettes, trait d'union
// conditionnel, largeur nulle, BOM), tout usage privé (Co) et les « remplisseurs » qui ne sont pas
// des Cf (CR-01) : aucun ne doit pouvoir se glisser à l'intérieur d'un mot interdit.
const INVISIBLE = /[\p{Cf}\p{Co}\u034F\u115F\u1160\u17B4\u17B5\u180E\u3164\uFE00-\uFE0F\uFFA0]/gu;
const APOSTROPHES = /[\u2018\u2019\u201B\u02BC\u2032`\u00B4]/g;
const DIGIT_GROUP = /(?<![\d.,])(\d{1,3})((?: \d{3})+)(?!\d)/g;

/** NFC, invisibles retirés, espaces typographiques -> U+0020, apostrophes -> ', espaces réduits. */
export function cleanText(s: string): string {
  return s.normalize('NFC').replace(INVISIBLE, '').replace(SPACE_LIKE, ' ').replace(APOSTROPHES, "'").replace(/\s+/g, ' ').trim();
}

/** « 1 500 000 » -> « 1500000 » (après cleanText). « en 2027 500 personnes » reste intact. */
export function mergeDigitGroups(s: string): string {
  return s.replace(DIGIT_GROUP, (_m, a: string, rest: string) => a + rest.replaceAll(' ', ''));
}

/** Clé de comparaison, jamais affichée : NFKC, minuscules fr, sans diacritiques, œ -> oe. */
export function foldKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Remplace chaque renvoi au glossaire `[[affiché]]` ou `[[affiché|id]]` par le texte affiché
 * (hypothèse A2) : les règles de rédaction jugent ce que le lecteur voit.
 */
export function sansMarqueurs(s: string): string {
  return s.replace(MARQUEUR_GLOSSAIRE, (_m, affiche: string) => affiche);
}

/** Identifiant de glossaire par défaut d'un marqueur [[affiché]] : le slug du texte affiché (A2). */
export function slugGlossaire(affiche: string): string {
  return affiche
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
