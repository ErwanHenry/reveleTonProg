import { cleanText, mergeDigitGroups } from './normalize.ts';

// « Mot pour mot après normalisation » (REGLE-04, REGLE-05). Le contrat de normalisation est
// NORMALISATION_CITATIONS dans config.ts. Module PUR : aucun import node:.

const ELLIPSIS = /\s*(?:[[(]\s*(?:…|\.{3})\s*[\])]|…|\.{3})\s*/u; // a […] b, a (...) b, a … b, a ... b
const TOKEN = /\d+(?:[.,]\d+)*|[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;

/** NFKC, casse et ponctuation ignorées, accents conservés, groupes de chiffres fusionnés. */
export function tokens(s: string): string[] {
  const t = mergeDigitGroups(cleanText(s.normalize('NFKC').replace(/œ/g, 'oe').replace(/Œ/g, 'OE'))).toLocaleLowerCase('fr');
  return t.match(TOKEN) ?? [];
}

/** Fragments d'une citation découpée par les marques d'ellipse, chacun réduit à ses mots. */
export function fragments(s: string): string[] {
  return cleanText(s.normalize('NFKC'))
    .split(ELLIPSIS)
    .map((f) => tokens(f).join(' '))
    .filter(Boolean);
}

/** À calculer une fois par extrait d'archive (mémo par source). */
export function haystack(text: string): string {
  return ` ${tokens(text).join(' ')} `;
}

/** Chaque fragment figure, mot pour mot et contigu, dans `hay`. Une citation vide est fausse. */
export function quoteIn(quote: string, hay: string): boolean {
  const frs = fragments(quote);
  return frs.length > 0 && frs.every((f) => hay.includes(` ${f} `));
}
