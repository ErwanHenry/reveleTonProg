import { MOTS_INTERDITS, VERBES_CONNOTES, VERBES_CONNOTES_PRONOMINAUX } from '../config.ts';
import { cleanText, foldKey, sansMarqueurs } from './normalize.ts';
import { words, withoutQuotes } from './words.ts';

// Mots interdits (REGLE-02) et verbes connotés. Les citations « … » équilibrées sont exemptées :
// la règle de citation (plan 02-06) vérifie que chacune figure mot pour mot dans texte_source.
// Module PUR.

export interface OptionsDetection {
  /**
   * Retire les citations « … » avant la recherche (défaut : oui). À réserver aux champs dont les
   * citations sont vérifiées contre un texte_source (mesures) : ailleurs, « … » ne prouve rien
   * (CR-03) et ne doit pas servir d'échappatoire.
   */
  exempterCitations?: boolean;
}

/** Texte vu par les détecteurs : marqueurs de glossaire résolus, citations retirées si exemptées. */
function corps(text: string, opts: OptionsDetection = {}): string {
  const propre = cleanText(sansMarqueurs(text));
  return opts.exempterCitations === false ? propre : withoutQuotes(propre);
}

const VERBES = new Set(VERBES_CONNOTES);

/** Mots interdits hors citation (minuscules, accents conservés), sans doublon. */
export function motsInterdits(text: string, opts: OptionsDetection = {}): string[] {
  const found = new Set<string>();
  for (const w of words(corps(text, opts))) {
    const k = foldKey(w);
    for (const r of MOTS_INTERDITS) {
      const hit = r.type === 'exact' ? k === r.motif : k.startsWith(r.motif);
      if (hit && !(r.exceptions ?? []).includes(k)) found.add(w.toLocaleLowerCase('fr'));
    }
  }
  return [...found];
}

/** Verbes de parole connotés hors citation, accents significatifs (« osé » n'est pas « ose »). */
export function verbesConnotes(text: string, opts: OptionsDetection = {}): string[] {
  const found = new Set<string>();
  const sansCitations = corps(text, opts);
  for (const w of words(sansCitations)) {
    const v = w.normalize('NFKC').toLocaleLowerCase('fr'); // NFKC : lettres pleine chasse ; accents conservés
    if (VERBES.has(v)) found.add(v);
  }
  const pronominal = VERBES_CONNOTES_PRONOMINAUX.exec(sansCitations.toLocaleLowerCase('fr'));
  if (pronominal) found.add(pronominal[0]);
  return [...found];
}
