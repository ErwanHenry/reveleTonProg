// Mini analyseur HTML sans dépendance pour le contrôle post-build (QUAL-01).
// Il ne sait lire que le HTML généré par Astro (bien formé, compressHTML) ; il ne lève jamais :
// une balise non fermée est fermée avec son parent, une fermeture orpheline est ignorée.

export interface Noeud {
  /** Nom de balise en minuscules ; '#document' pour la racine. */
  tag: string;
  attrs: Record<string, string>;
  enfants: (Noeud | string)[];
  parent: Noeud | null;
}

// Commentaire | doctype | balise (ouvrante, fermante, auto-fermante) | texte | « < » isolé.
const TOKEN =
  /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTRIBUT = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ENTITE = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;

const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TEXTE_BRUT = new Set(['script', 'style']);
const NOMMEES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

function decoder(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(ENTITE, (tout, ref: string) => {
    const nom = ref.toLowerCase();
    const nommee = NOMMEES[nom];
    if (nommee !== undefined) return nommee;
    const code = nom.startsWith('#x') ? Number.parseInt(nom.slice(2), 16) : Number.parseInt(nom.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : tout;
  });
}

function lireAttributs(brut: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of brut.matchAll(ATTRIBUT)) {
    const nom = (m[1] ?? '').toLowerCase();
    if (nom === '' || nom in attrs) continue; // le premier gagne, comme dans un navigateur
    attrs[nom] = decoder(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function analyserHtml(html: string): Noeud {
  const racine: Noeud = { tag: '#document', attrs: {}, enfants: [], parent: null };
  const pile: Noeud[] = [racine];
  const courant = (): Noeud => pile[pile.length - 1] ?? racine;
  const re = new RegExp(TOKEN.source, 'g');
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    const [jeton, fermante, nomBrut, attrsBruts, autoFermante] = m;
    if (nomBrut === undefined) {
      // commentaire et doctype : abandonnés ; le reste est du texte
      if (jeton.startsWith('<!')) continue;
      courant().enfants.push(decoder(jeton));
      continue;
    }
    const tag = nomBrut.toLowerCase();
    if (fermante === '/') {
      for (let i = pile.length - 1; i > 0; i--) {
        if (pile[i]?.tag === tag) {
          pile.length = i;
          break;
        }
      }
      continue; // fermeture orpheline : ignorée
    }
    const noeud: Noeud = { tag, attrs: lireAttributs(attrsBruts ?? ''), enfants: [], parent: courant() };
    courant().enfants.push(noeud);
    if (VIDES.has(tag) || autoFermante === '/') continue;
    if (TEXTE_BRUT.has(tag)) {
      // le corps de <script> et <style> est du texte brut jusqu'à la fermeture correspondante
      const reste = html.slice(re.lastIndex);
      const fermeture = new RegExp(`</${tag}\\s*>`, 'i').exec(reste);
      const corps = fermeture ? reste.slice(0, fermeture.index) : reste;
      if (corps !== '') noeud.enfants.push(corps);
      re.lastIndex += fermeture ? fermeture.index + fermeture[0].length : reste.length;
      continue;
    }
    pile.push(noeud);
  }
  return racine;
}

/** Visite le nœud puis ses descendants éléments, dans l'ordre du document. */
export function parcourir(n: Noeud, f: (n: Noeud) => void): void {
  f(n);
  for (const e of n.enfants) if (typeof e !== 'string') parcourir(e, f);
}

/** Texte des descendants ; `exclure` saute tout le sous-arbre d'un élément. */
export function texte(n: Noeud, exclure?: (n: Noeud) => boolean): string {
  let s = '';
  for (const e of n.enfants) {
    if (typeof e === 'string') s += e;
    else if (!exclure?.(e)) s += texte(e, exclure);
  }
  return s;
}

export function aClasse(n: Noeud, classe: string): boolean {
  return (n.attrs.class ?? '').split(/\s+/).includes(classe);
}

/** Éléments (racine comprise) vérifiant le prédicat, dans l'ordre du document. */
export function trouver(n: Noeud, pred: (n: Noeud) => boolean): Noeud[] {
  const out: Noeud[] = [];
  parcourir(n, (x) => {
    if (pred(x)) out.push(x);
  });
  return out;
}
