import { cleanText, mergeDigitGroups } from './normalize.ts';

// Mots français : le même découpage sert à compter (REGLE-03) et à chercher les mots interdits
// (REGLE-02), pour qu'un « l'extrême » ne passe pas entre les deux. Module PUR.

export const ELISION = /^(?:[ldjnsctm]|qu|jusqu|lorsqu|puisqu|quoiqu)'(?=\p{L})/iu; // aujourd'hui, presqu'île, quelqu'un restent entiers
const segmenter = new Intl.Segmenter('fr', { granularity: 'word' });

/** Mots français : Intl.Segmenter + élisions séparées (l'école = 2) + groupes de chiffres fusionnés (1 500 000 = 1). */
export function words(raw: string): string[] {
  const s = mergeDigitGroups(cleanText(raw)).replace(/(?<=\p{L})-t-(?=\p{L})/gu, '-'); // « a-t-il » : le t euphonique ne compte pas
  const out: string[] = [];
  for (const seg of segmenter.segment(s)) {
    if (!seg.isWordLike) continue;
    let w = seg.segment;
    const m = ELISION.exec(w);
    if (m) {
      out.push(m[0]);
      w = w.slice(m[0].length);
    }
    if (w) out.push(w);
  }
  return out;
}
export const countWords = (s: string): number => words(s).length;

// Regex linéaire (pas de quantificateur imbriqué) : sûre sur du texte de contributeur.
const QUOTE_SPAN = /«([^«»]*)»/g;
export const quoteSpans = (s: string): string[] => [...s.matchAll(QUOTE_SPAN)].map((m) => cleanText(m[1] ?? ''));
export const withoutQuotes = (s: string): string => s.replace(QUOTE_SPAN, ' ');
/** Faux si un « ou » est orphelin : empêche d'exempter tout le texte avec un guillemet ouvrant jamais fermé. */
export const quotesBalanced = (s: string): boolean => !/[«»]/.test(s.replace(QUOTE_SPAN, ''));
