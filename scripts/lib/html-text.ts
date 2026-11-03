// Extraction de texte depuis une page HTML (outil d'archivage, CONT-03). Module PUR : aucun import
// node:. Le HTML vient d'un site tiers : c'est une donnée non fiable, jamais exécutée ni évaluée.
// Le découpeur est linéaire (aucune expression régulière à retour arrière sur le document entier).

/** Taille de HTML (en caractères) au-dessus de laquelle une page quasi vide ressemble à une coquille JS. */
export const SEUIL_COQUILLE_HTML = 30 * 1024;
/** Nombre de caractères visibles en dessous duquel une grande page HTML est une coquille JS. */
export const SEUIL_COQUILLE_TEXTE = 1200;

const ELEMENTS_IGNORES = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'title']);

const ELEMENTS_BLOC = new Set([
  'p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'tr', 'section', 'article', 'header', 'footer', 'nav',
  'main', 'aside', 'table', 'blockquote', 'pre', 'form', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'hr', 'details', 'summary',
]);

const ENTITES_NOMMEES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù',
  icirc: 'î', iuml: 'ï', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Ocirc: 'Ô', Ucirc: 'Û',
  Ugrave: 'Ù', Icirc: 'Î', Iuml: 'Ï', Euml: 'Ë',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—',
  oelig: 'œ', OElig: 'Œ', copy: '©', euro: '€', deg: '°', middot: '·', bull: '•', times: '×', shy: '\u00AD',
};

// Numéros 0x80-0x9F : le HTML les lit comme du windows-1252.
const CP1252: Readonly<Record<number, string>> = {
  0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
};

const ENTITE = /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g;

function jeuDeCaracteres(contentType: string | undefined, octets: Uint8Array): string {
  if (octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) return 'utf-8';
  if (octets.length >= 2 && octets[0] === 0xff && octets[1] === 0xfe) return 'utf-16le';
  if (octets.length >= 2 && octets[0] === 0xfe && octets[1] === 0xff) return 'utf-16be';
  const entete = contentType === undefined ? null : contentType.match(/charset\s*=\s*["']?\s*([A-Za-z0-9_:.-]+)/i);
  if (entete?.[1] !== undefined) return entete[1];
  const debut = new TextDecoder('latin1').decode(octets.subarray(0, 4096));
  const meta = debut.match(/<meta[^>]{0,400}?charset\s*=\s*["']?\s*([A-Za-z0-9_:.-]+)/i);
  return meta?.[1] ?? 'utf-8';
}

/** Décode les octets d'une page : charset de l'en-tête, sinon `<meta>`, sinon UTF-8 (jamais d'exception). */
export function decodeHtml(octets: Uint8Array, contentType?: string): string {
  const label = jeuDeCaracteres(contentType, octets);
  let decodeur: TextDecoder;
  try {
    decodeur = new TextDecoder(label, { fatal: false });
  } catch {
    decodeur = new TextDecoder('utf-8', { fatal: false });
  }
  return decodeur.decode(octets);
}

function decoderEntites(texte: string, residuelles: Map<string, number>): string {
  if (!texte.includes('&')) return texte;
  return texte.replace(ENTITE, (brut: string, corps: string) => {
    if (corps.startsWith('#')) {
      const n = corps[1] === 'x' || corps[1] === 'X' ? Number.parseInt(corps.slice(2), 16) : Number.parseInt(corps.slice(1), 10);
      const speciale = CP1252[n];
      if (speciale !== undefined) return speciale;
      if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return brut;
      return String.fromCodePoint(n);
    }
    const remplace = ENTITES_NOMMEES[corps];
    if (remplace !== undefined) return remplace;
    residuelles.set(brut, (residuelles.get(brut) ?? 0) + 1);
    return brut;
  });
}

const estLettre = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const estCarNom = (c: number): boolean => estLettre(c) || (c >= 48 && c <= 57) || c === 45 || c === 58;

/** Position juste après le `>` qui ferme la balise commençant à `debut` (guillemets respectés). */
function finDeBalise(html: string, debut: number): number {
  const n = html.length;
  let i = debut;
  while (i < n) {
    const c = html[i];
    if (c === '>') return i + 1;
    if (c === '"' || c === "'") {
      const q = html.indexOf(c, i + 1);
      if (q === -1) return n;
      i = q + 1;
    } else {
      i++;
    }
  }
  return n;
}

/** Position juste après `</nom ...>`, ou -1 s'il n'existe pas. */
function finElementIgnore(html: string, depuis: number, nom: string): number {
  let i = depuis;
  for (;;) {
    const p = html.indexOf('</', i);
    if (p === -1) return -1;
    const candidat = html.slice(p + 2, p + 2 + nom.length).toLowerCase();
    const suivant = html.charCodeAt(p + 2 + nom.length);
    if (candidat === nom && !(suivant >= 0 && estCarNom(suivant))) return finDeBalise(html, p + 2 + nom.length);
    i = p + 2;
  }
}

export interface TexteHtml {
  text: string;
  /** Entités nommées non décodées (« &foo; »), avec leur nombre d'occurrences. */
  entitesResiduelles: { entite: string; occurrences: number }[];
}

/** Texte visible d'une page : scripts, styles, commentaires et `head` retirés, blocs en sauts de ligne. */
export function htmlToText(html: string): TexteHtml {
  const morceaux: string[] = [];
  const residuelles = new Map<string, number>();
  const n = html.length;
  let i = 0;
  const texte = (brut: string): void => {
    if (brut === '') return;
    morceaux.push(decoderEntites(brut.replace(/[ \t\n\r\f]+/g, ' '), residuelles));
  };
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      texte(html.slice(i));
      break;
    }
    if (lt > i) texte(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const fin = html.indexOf('-->', lt + 4);
      i = fin === -1 ? n : fin + 3;
      continue;
    }
    const c1 = html.charCodeAt(lt + 1);
    if (c1 === 33 || c1 === 63) {
      // <!DOCTYPE ...>, <![CDATA[ ... ]]> approximé, <?xml ... ?>
      i = finDeBalise(html, lt + 2);
      continue;
    }
    const fermante = c1 === 47;
    const debutNom = lt + (fermante ? 2 : 1);
    if (!estLettre(html.charCodeAt(debutNom))) {
      texte('<');
      i = lt + 1;
      continue;
    }
    let finNom = debutNom;
    while (finNom < n && estCarNom(html.charCodeAt(finNom))) finNom++;
    const nom = html.slice(debutNom, finNom).toLowerCase();
    const apres = finDeBalise(html, finNom);
    if (!fermante && ELEMENTS_IGNORES.has(nom)) {
      const fin = finElementIgnore(html, apres, nom);
      if (fin !== -1) {
        i = fin;
        continue;
      }
      if (nom !== 'head') {
        i = n; // script, style... jamais refermé : le navigateur ignore la suite
        continue;
      }
    }
    if (ELEMENTS_BLOC.has(nom)) morceaux.push('\n');
    else if (nom === 'td' || nom === 'th') morceaux.push(' ');
    i = apres;
  }
  const lignes: string[] = [];
  let videAvant = true;
  for (const brute of morceaux.join('').split('\n')) {
    const ligne = brute.replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '');
    if (ligne === '') {
      if (!videAvant) lignes.push('');
      videAvant = true;
    } else {
      lignes.push(ligne);
      videAvant = false;
    }
  }
  while (lignes.length > 0 && lignes[lignes.length - 1] === '') lignes.pop();
  return {
    text: lignes.join('\n'),
    entitesResiduelles: [...residuelles].map(([entite, occurrences]) => ({ entite, occurrences })),
  };
}

/** Vrai pour une grande page HTML presque vide de texte : un site rendu côté client (coquille JS). */
export function looksClientRendered(html: string, texte: string): boolean {
  return html.length > SEUIL_COQUILLE_HTML && texte.trim().length < SEUIL_COQUILLE_TEXTE;
}
