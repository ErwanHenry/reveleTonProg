import { cleanText, foldKey, mergeDigitGroups } from './normalize.ts';

// Nombres d'une rédaction, ramenés à une forme décimale canonique (chaîne, jamais un flottant) pour
// être comparés à ceux de la source (REGLE-04). Module PUR : aucun import node:.

const MULT: Record<string, number> = { mille: 3, million: 6, millions: 6, milliard: 9, milliards: 9 };

// 1.500.000 | 3,5 | 12 ; suffixe ordinal toléré (1er, 2e) ; jamais collé à une lettre (CO2, 5G) ;
// multiplicateur optionnel (1,5 milliard). Regex linéaire : sûre sur du texte de contributeur.
const NUM =
  /(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?:er|ère|re|e|ème|nd|nde)?(?![\p{L}\p{N}])(?:\s+(mille|millions?|milliards?)(?!\p{L}))?/giu;

/** Forme décimale canonique (chaîne, sans flottant) : « 1,5 » + « milliard » donne « 1500000000 ». */
export function canonical(raw: string, mult?: string): string {
  const s = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replaceAll('.', '') : raw.replace(',', '.');
  const [i0 = '', f0 = ''] = s.split('.');
  let int = i0;
  let frac = f0;
  let exp = mult ? (MULT[mult.toLowerCase()] ?? 0) : 0;
  while (exp > 0) {
    if (frac.length > 0) {
      int += frac[0];
      frac = frac.slice(1);
    } else {
      int += '0';
    }
    exp--;
  }
  int = int.replace(/^0+(?=\d)/, '');
  frac = frac.replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** Nombres écrits en chiffres, valeurs canoniques. L'unité (%, €) n'est volontairement pas comparée. */
export function extractNumbers(text: string): string[] {
  const t = mergeDigitGroups(cleanText(text));
  return [...t.matchAll(NUM)].map((m) => canonical(m[1] ?? '', m[2]));
}

const NUMBER_WORDS = new Set(
  'zero deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt vingts trente quarante cinquante soixante septante huitante nonante cent cents mille million millions milliard milliards dizaine dizaines douzaine douzaines centaine centaines millier milliers'.split(
    ' ',
  ),
);

/** Nombres en lettres (clés pliées) ; « un/une » exclus (articles) ; « pour cent » exclu. */
export function extractNumberWords(text: string): string[] {
  const toks = foldKey(cleanText(text)).split(/[^a-z]+/).filter(Boolean);
  return toks.filter((w, i) => NUMBER_WORDS.has(w) && !(w === 'cent' && toks[i - 1] === 'pour'));
}
