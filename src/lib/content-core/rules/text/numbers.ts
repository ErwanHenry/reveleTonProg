import { cleanText, foldKey, mergeDigitGroups } from './normalize.ts';

// Nombres d'une rédaction, ramenés à une forme décimale canonique (chaîne, jamais un flottant) pour
// être comparés à ceux de la source (REGLE-04). Module PUR : aucun import node:.

// Exposants décimaux. Mots : insensibles à la casse (mille, million(s), milliard(s)). Abréviations
// de montants, sensibles à la casse (« 100m » est une longueur, « 100M€ » des millions) : k, M, Md,
// Mds, Mrd, Mrds (« 3 Md€ » = 3 milliards).
const MULT: Record<string, number> = {
  mille: 3, million: 6, millions: 6, milliard: 9, milliards: 9,
  k: 3, M: 6, Md: 9, Mds: 9, Mrd: 9, Mrds: 9,
};
const ABREVIATIONS = new Set(['k', 'M', 'Md', 'Mds', 'Mrd', 'Mrds']);
const MOTS_MULT = new Set(['mille', 'million', 'millions', 'milliard', 'milliards']);
// Suffixes d'ordinal tolérés directement derrière le nombre (1er, 2e, 10es, 3èmes).
const ORDINAUX = new Set(['er', 'ers', 'ère', 'ères', 're', 'res', 'e', 'es', 'ème', 'èmes', 'nd', 'nde', 'nds', 'ndes']);
// Unités courantes collées au nombre (50kg, 20cl) : le nombre compte, sans multiplicateur.
const UNITES = new Set(['m', 'cm', 'mm', 'km', 'g', 'kg', 'l', 'cl', 'ml', 'h', 'min', 's', 'ha', 't', 'kW', 'MW', 'GW', 'kWh', 'MWh', 'GWh']);

// 1.500.000 | 3,5 | 12, éventuellement suivi d'un suffixe collé (1er, 50k, 100M€, 50kg) ou d'un mot
// après une espace (1,5 milliard, 3 Md€). Un nombre collé à d'autres lettres (CO2, 5G) n'en est pas
// un. Sans drapeau `i` : les abréviations sont sensibles à la casse. Regex linéaire : sûre sur du
// texte de contributeur.
const NUM = /(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?!\p{N})(?:(\p{L}+)|\s+(\p{L}+)(€)?)?/gu;

const ND = /\p{Nd}/u;
/** Valeur 0-9 d'un chiffre décimal Unicode non ASCII (arabo-indien, devanagari…) : rang dans son bloc de 10. */
function valeurChiffre(cp: number): number {
  for (let k = 0; k < 9; k++) if (!ND.test(String.fromCodePoint(cp - k - 1))) return k;
  return 9;
}
/** Tout chiffre décimal Unicode devient son équivalent ASCII (« ٥٠٠ » = « 500 »). */
export function chiffresAscii(s: string): string {
  return s.replace(/\p{Nd}/gu, (ch) => (ch >= '0' && ch <= '9' ? ch : String(valeurChiffre(ch.codePointAt(0) ?? 0))));
}

/** Forme décimale canonique (chaîne, sans flottant) : « 1,5 » + « milliard » donne « 1500000000 ». */
export function canonical(raw: string, mult?: string): string {
  const s = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replaceAll('.', '') : raw.replace(',', '.');
  const [i0 = '', f0 = ''] = s.split('.');
  let int = i0;
  let frac = f0;
  let exp = mult ? (MULT[mult] ?? MULT[mult.toLowerCase()] ?? 0) : 0;
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

/**
 * Nombres écrits en chiffres, valeurs canoniques. L'unité (%, €) n'est volontairement pas comparée.
 * Le texte passe en NFKC et les chiffres non ASCII en ASCII : « ２０００ » et « ٥٠٠ » comptent.
 */
export function extractNumbers(text: string): string[] {
  const t = mergeDigitGroups(chiffresAscii(cleanText(text.normalize('NFKC'))));
  const out: string[] = [];
  for (const m of t.matchAll(NUM)) {
    const [, nombre = '', colle, espace, euro] = m;
    let mult: string | undefined;
    if (colle !== undefined) {
      if (ORDINAUX.has(colle.toLowerCase()) || UNITES.has(colle)) mult = undefined;
      else if (ABREVIATIONS.has(colle)) mult = colle;
      else continue; // jeton alphanumérique (5G, 3D) : pas un nombre
    } else if (espace !== undefined) {
      if (MOTS_MULT.has(espace.toLowerCase()) || /^(?:Md|Mds|Mrd|Mrds)$/.test(espace) || (/^[kM]$/.test(espace) && euro !== undefined)) mult = espace;
    }
    out.push(canonical(nombre, mult));
  }
  return out;
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
