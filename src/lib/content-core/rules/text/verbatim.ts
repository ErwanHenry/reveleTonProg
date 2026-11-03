import { FRAGMENTS_CITATION } from '../config.ts';
import { cleanText, mergeDigitGroups } from './normalize.ts';
import { ELISION } from './words.ts';

// « Mot pour mot après normalisation » (REGLE-04, REGLE-05). Le contrat de normalisation est
// NORMALISATION_CITATIONS dans config.ts. Module PUR : aucun import node:.

const ELLIPSIS = /\s*(?:[[(]\s*(?:…|\.{3})\s*[\])]|…|\.{3})\s*/u; // a […] b, a (...) b, a … b, a ... b
const TOKEN = /\d+(?:[.,]\d+)*|[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;

/** NFKC, casse et ponctuation ignorées, accents conservés, groupes de chiffres fusionnés. */
export function tokens(s: string): string[] {
  const t = mergeDigitGroups(cleanText(s.normalize('NFKC').replace(/œ/g, 'oe').replace(/Œ/g, 'OE'))).toLocaleLowerCase('fr');
  // Même découpage des élisions que words() (WR-06) : « l'extrême » = « l' » + « extrême », pour
  // qu'on puisse citer le mot que le détecteur de mots interdits voit.
  const out: string[] = [];
  for (const tok of t.match(TOKEN) ?? []) {
    const m = ELISION.exec(tok);
    if (m) {
      out.push(m[0]);
      if (tok.length > m[0].length) out.push(tok.slice(m[0].length));
    } else {
      out.push(tok);
    }
  }
  return out;
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

/** Vrai si la citation contient une marque d'ellipse (donc plusieurs fragments). */
export const aEllipse = (quote: string): boolean => fragments(quote).length > 1;

/** Positions (début de l'espace de tête) de ` f ` dans `hay`, chevauchements compris. */
function occurrences(hay: string, f: string): number[] {
  const out: number[] = [];
  const needle = ` ${f} `;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

/** Les fragments `frs[k..]` se suivent dans l'ordre, chacun à `ecartMax` mots au plus du précédent. */
function enchaine(hay: string, frs: readonly string[], k: number, finPrecedent: number): boolean {
  const f = frs[k];
  if (f === undefined) return true;
  for (const i of occurrences(hay, f)) {
    if (finPrecedent >= 0) {
      if (i < finPrecedent) continue;
      const ecart = hay.slice(finPrecedent, i).split(' ').length - 1; // mots entre les deux fragments
      if (ecart > FRAGMENTS_CITATION.ecartMax) continue;
    }
    if (enchaine(hay, frs, k + 1, i + 1 + f.length)) return true;
  }
  return false;
}

/**
 * Chaque fragment figure, mot pour mot et contigu, dans `hay`. Une citation vide est fausse. Une
 * citation à ellipse (WR-11) exige en plus que chaque fragment compte au moins `motsMin` mots, que
 * les fragments se suivent dans l'ordre de la source, à `ecartMax` mots au plus les uns des autres.
 */
export function quoteIn(quote: string, hay: string): boolean {
  const frs = fragments(quote);
  if (frs.length === 0) return false;
  if (frs.length === 1) return hay.includes(` ${frs[0]} `);
  if (frs.some((f) => f.split(' ').length < FRAGMENTS_CITATION.motsMin)) return false;
  return enchaine(hay, frs, 0, -1);
}
