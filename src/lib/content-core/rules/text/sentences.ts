import { cleanText } from './normalize.ts';
import { words } from './words.ts';

// Découpage en phrases pour la règle des 15 mots (REGLE-06). Module PUR.

const MASK = '\uE000'; // remplace un point qui ne termine pas la phrase
const ABBR = /\b(?:MM|Mmes?|Mlle|Mgr|Dr|Pr|St|Ste|cf|pp?|art|arts|vol|av|apr|env|fig|tél?|sec|min)\./gi;
const INITIALE = /(?<![\p{L}])(\p{Lu})\./gu; // « J. Dupont », « M. Dupont »
const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });

/**
 * Phrases d'un texte : les sauts de ligne deviennent des espaces (un bloc `|` coupé à la main reste
 * une phrase), la ponctuation à l'intérieur de « … » et après une abréviation connue ne termine pas
 * la phrase. Une citation suivie d'une autre phrase peut fusionner : conservateur pour la règle.
 */
export function sentences(raw: string): string[] {
  let s = cleanText(raw);
  s = s.replace(/«[^«»]*»/g, (q) => q.replace(/[.!?…]/g, MASK));
  s = s.replace(ABBR, (m) => m.slice(0, -1) + MASK).replace(INITIALE, `$1${MASK}`);
  const out: string[] = [];
  for (const seg of segmenter.segment(s)) {
    const t = seg.segment.replaceAll(MASK, '.').trim();
    if (words(t).length > 0) out.push(t);
  }
  return out;
}
