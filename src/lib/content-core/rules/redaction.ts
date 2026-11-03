import { CARACTERES_SUSPECTS, CHAMPS_EDITORIAUX, LONGUEURS } from './config.ts';
import { motsInterdits, verbesConnotes } from './text/forbidden.ts';
import { cleanText, sansMarqueurs } from './text/normalize.ts';
import { countWords, quotesBalanced } from './text/words.ts';
import { citer } from './types.ts';
import type { EntryRule, Famille, Finding, LoadedEntry } from './types.ts';

// Famille « redaction » (REGLE-02, 03, 06) : neutralité, longueurs, lisibilité des rédactions.
// Seuils, listes et champs viennent de config.ts (pur, affiché par la page Méthode).

export interface ChampEditorial {
  /** Pointeur JSON du champ dans le fichier de l'entrée. */
  pointer: string;
  texte: string;
}

/** Développe un modèle de pointeur (`*` = chaque élément d'un tableau) en pointeurs concrets de chaînes. */
function developper(valeur: unknown, segments: readonly string[], prefixe: string, out: ChampEditorial[]): void {
  const [tete, ...reste] = segments;
  if (tete === undefined) {
    if (typeof valeur === 'string') out.push({ pointer: prefixe, texte: valeur });
    return;
  }
  if (tete === '*') {
    if (Array.isArray(valeur)) valeur.forEach((v, i) => developper(v, reste, `${prefixe}/${i}`, out));
    return;
  }
  if (valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur) && Object.hasOwn(valeur, tete)) {
    developper((valeur as Record<string, unknown>)[tete], reste, `${prefixe}/${tete}`, out);
  }
}

/** Champs de texte éditorial présents dans l'entrée (champs absents ou non textuels ignorés). */
export function champsEditoriaux(e: LoadedEntry): ChampEditorial[] {
  const out: ChampEditorial[] = [];
  for (const modele of CHAMPS_EDITORIAUX[e.collection] ?? []) {
    developper(e.data, modele.split('/').slice(1), '', out);
  }
  return out;
}

/** REGLE-02 : vocabulaire neutre hors citation, guillemets équilibrés, pas de caractère d'évasion. */
const neutralite: EntryRule = {
  id: 'neutralite',
  run(e) {
    const out: Finding[] = [];
    for (const { pointer, texte } of champsEditoriaux(e)) {
      if (CARACTERES_SUSPECTS.test(texte.normalize('NFC'))) {
        out.push({
          code: 'CARACTERE_SUSPECT',
          pointer,
          message: 'le texte contient un caractère de contrôle bidirectionnel ou d’une écriture non latine (grec, cyrillique), qui pourrait masquer un mot interdit.',
        });
      }
      const affiche = cleanText(sansMarqueurs(texte));
      if (!quotesBalanced(affiche)) {
        out.push({
          code: 'GUILLEMETS_DESEQUILIBRES',
          pointer,
          message: 'guillemets français « » non équilibrés : un « sans » (ou l’inverse) ne peut pas exempter le reste du texte.',
        });
      }
      for (const mot of motsInterdits(texte)) {
        out.push({
          code: 'MOT_INTERDIT',
          pointer,
          message: `mot interdit « ${citer(mot)} » : écrire de façon neutre, ou le placer entre guillemets s’il figure mot pour mot dans la source.`,
        });
      }
      for (const verbe of verbesConnotes(texte)) {
        out.push({
          code: 'VERBE_CONNOTE',
          severity: 'warning',
          pointer,
          message: `verbe de parole connoté « ${citer(verbe)} » : préférer un verbe neutre (« propose », « indique », « prévoit »).`,
        });
      }
    }
    return out;
  },
};

const NIVEAUX = ['resume', 'detaille', 'enfant', 'aine'] as const;
type Niveau = (typeof NIVEAUX)[number];

/** Rédaction d'un niveau de lecture si elle est présente et textuelle. */
function redaction(e: LoadedEntry, niveau: Niveau): string | undefined {
  const r = e.data.redactions;
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return undefined;
  const t = (r as Record<string, unknown>)[niveau];
  return typeof t === 'string' ? t : undefined;
}

function attendu(b: { min?: number; max?: number }): string {
  if (b.min !== undefined && b.max !== undefined) return `entre ${b.min} et ${b.max}`;
  if (b.max !== undefined) return `au plus ${b.max}`;
  return `au moins ${b.min ?? 0}`;
}

/** REGLE-03 : bornes de longueur par niveau, comptées comme les autres règles (count français). */
const longueurs: EntryRule = {
  id: 'longueurs',
  run(e) {
    if (e.collection !== 'mesures') return [];
    const out: Finding[] = [];
    for (const niveau of NIVEAUX) {
      const texte = redaction(e, niveau);
      if (texte === undefined) continue;
      const bornes: { min?: number; max?: number } = LONGUEURS[niveau];
      const n = countWords(sansMarqueurs(texte));
      if ((bornes.min !== undefined && n < bornes.min) || (bornes.max !== undefined && n > bornes.max)) {
        out.push({
          code: 'LONGUEUR_HORS_BORNES',
          pointer: `/redactions/${niveau}`,
          message: `rédaction « ${niveau} » : ${n} mot${n > 1 ? 's' : ''}, attendu : ${attendu(bornes)}.`,
        });
      }
    }
    return out;
  },
};

export const famille: Famille = { id: 'redaction', fichier: [], entree: [neutralite, longueurs], corpus: [] };
