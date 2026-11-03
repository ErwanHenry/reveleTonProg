import { MOTS_INTERDITS, VERBES_CONNOTES, VERBES_CONNOTES_PRONOMINAUX } from '../config.ts';
import { cleanText, foldKey, sansMarqueurs } from './normalize.ts';
import { words, withoutQuotes } from './words.ts';

// Mots interdits (REGLE-02) et verbes connotés. Les citations « … » équilibrées sont exemptées :
// la règle de citation (plan 02-06) vérifie que chacune figure mot pour mot dans texte_source.
// Module PUR.

/** Texte vu par les détecteurs : marqueurs de glossaire résolus, citations retirées. */
function corps(text: string): string {
  return withoutQuotes(cleanText(sansMarqueurs(text)));
}

const VERBES = new Set(VERBES_CONNOTES);

/** Mots interdits hors citation (minuscules, accents conservés), sans doublon. */
export function motsInterdits(text: string): string[] {
  const found = new Set<string>();
  for (const w of words(withoutQuotes(cleanText(sansMarqueurs(text))))) {
    const k = foldKey(w);
    for (const r of MOTS_INTERDITS) {
      const hit = r.type === 'exact' ? k === r.motif : k.startsWith(r.motif);
      if (hit && !(r.exceptions ?? []).includes(k)) found.add(w.toLocaleLowerCase('fr'));
    }
  }
  return [...found];
}

/** Verbes de parole connotés hors citation, accents significatifs (« osé » n'est pas « ose »). */
export function verbesConnotes(text: string): string[] {
  const found = new Set<string>();
  const sansCitations = corps(text);
  for (const w of words(sansCitations)) {
    const v = w.normalize('NFKC').toLocaleLowerCase('fr'); // NFKC : lettres pleine chasse ; accents conservés
    if (VERBES.has(v)) found.add(v);
  }
  const pronominal = VERBES_CONNOTES_PRONOMINAUX.exec(sansCitations.toLocaleLowerCase('fr'));
  if (pronominal) found.add(pronominal[0]);
  return [...found];
}
