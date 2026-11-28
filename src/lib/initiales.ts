// Initiales d'un nom, une seule règle pour tous les candidats et pour le logo du site (D-04, U-02, 10.4) :
// 1. le nom est normalisé en NFC et les espaces de début et de fin sont retirés ;
// 2. il est découpé aux espaces (dont les insécables U+00A0 et U+202F), aux traits d'union et aux apostrophes ;
// 3. on garde les segments qui commencent par une majuscule (« de », « d' », « le » sont donc écartés) ;
// 4. de chaque segment gardé on prend la première lettre (graphème), accent conservé, en majuscule ;
// 5. si aucun segment ne commence par une majuscule, on prend la première lettre du premier segment, en majuscule ;
// 6. lettres collées, sans point ni espace, sans limite ni troncature ; chaîne vide si le nom est vide.
const SEPARATEURS = /[\s\u00A0\u202F\u2010\u2011\u2019'-]+/u;
const GRAPHEMES = new Intl.Segmenter('fr', { granularity: 'grapheme' });

function premiereLettre(segment: string): string {
  const premier = GRAPHEMES.segment(segment)[Symbol.iterator]().next();
  return premier.done === true ? '' : premier.value.segment.toLocaleUpperCase('fr');
}

export function initiales(nom: string): string {
  const segments = nom.normalize('NFC').trim().split(SEPARATEURS).filter((s) => s !== '');
  if (segments.length === 0) return '';
  const gardes = segments.filter((s) => /^\p{Lu}/u.test(s));
  if (gardes.length === 0) return premiereLettre(segments[0]!);
  return gardes.map(premiereLettre).join('');
}
