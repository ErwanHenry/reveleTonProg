import { cleanText, foldKey } from './normalize.ts';

// Nombres écrits en toutes lettres, ramenés à leur valeur (WR-08), pour qu'« deux millions » dans la
// source et « 2 millions » dans une rédaction soient reconnus comme le même nombre. Module PUR.

type Genre = 'unit' | 'un' | 'teen' | 'dix' | 'ten' | 'cent' | 'mille' | 'mult' | 'et';
interface Jeton {
  genre: Genre;
  v: number;
  mot: string;
}

const VALEURS: Readonly<Record<string, readonly [Genre, number]>> = {
  zero: ['unit', 0], deux: ['unit', 2], trois: ['unit', 3], quatre: ['unit', 4], cinq: ['unit', 5],
  six: ['unit', 6], sept: ['unit', 7], huit: ['unit', 8], neuf: ['unit', 9],
  un: ['un', 1], une: ['un', 1],
  dix: ['dix', 10], onze: ['teen', 11], douze: ['teen', 12], treize: ['teen', 13], quatorze: ['teen', 14],
  quinze: ['teen', 15], seize: ['teen', 16],
  vingt: ['ten', 20], vingts: ['ten', 20], trente: ['ten', 30], quarante: ['ten', 40], cinquante: ['ten', 50],
  soixante: ['ten', 60], septante: ['ten', 70], huitante: ['ten', 80], nonante: ['ten', 90],
  cent: ['cent', 100], cents: ['cent', 100], mille: ['mille', 1000],
  million: ['mult', 1e6], millions: ['mult', 1e6], milliard: ['mult', 1e9], milliards: ['mult', 1e9],
  et: ['et', 0],
};

/** Construit la valeur d'une suite de mots-nombres ; refuse un mot qui ne peut pas la prolonger. */
class Suite {
  total = 0;
  cur = 0;
  mots: string[] = [];
  private dernier: Jeton | undefined;

  get vide(): boolean {
    return this.mots.length === 0;
  }

  /** Vrai si `t` prolonge la suite (état mis à jour) ; `suivant` sert à « un » et « et ». */
  ajouter(t: Jeton, suivant: Jeton | undefined): boolean {
    const l = this.dernier;
    const debutGroupe = l === undefined || l.genre === 'mille' || l.genre === 'mult';
    const apresDixaine = l !== undefined && l.genre === 'ten';
    let retenu: Jeton = t;
    let ok = false;
    switch (t.genre) {
      case 'unit':
        if (debutGroupe) {
          this.cur = t.v;
          ok = true;
        } else if (apresDixaine || l.genre === 'dix' || l.genre === 'cent') {
          this.cur += t.v;
          ok = t.v !== 0;
        }
        break;
      case 'un':
        if (l?.genre === 'et') {
          this.cur += 1;
          ok = true;
        } else if (debutGroupe && suivant?.genre === 'mult') {
          this.cur = 1;
          ok = true;
        }
        break;
      case 'teen':
        if (debutGroupe) {
          this.cur = t.v;
          ok = true;
        } else if (l.genre === 'cent' || (apresDixaine && (l.v === 60 || l.v === 80))) {
          this.cur += t.v;
          ok = true;
        } else if (l.genre === 'et' && this.cur % 100 === 60) {
          this.cur += t.v; // « soixante et onze »
          ok = true;
        }
        break;
      case 'dix':
        if (debutGroupe) {
          this.cur = 10;
          ok = true;
        } else if (l.genre === 'cent' || (apresDixaine && (l.v === 60 || l.v === 80))) {
          this.cur += 10;
          ok = true;
        }
        break;
      case 'ten':
        if (debutGroupe) {
          this.cur = t.v;
          ok = true;
        } else if (l.genre === 'cent') {
          this.cur += t.v;
          ok = true;
        } else if (l.genre === 'unit' && l.v === 4 && t.v === 20 && this.cur % 100 === 4) {
          this.cur += 76; // « quatre-vingt(s) » : 4 + 76 = 80
          retenu = { genre: 'ten', v: 80, mot: t.mot };
          ok = true;
        }
        break;
      case 'cent':
        if (debutGroupe) {
          this.cur = 100;
          ok = true;
        } else if (l.genre === 'unit' && l.v >= 2 && this.cur === l.v) {
          this.cur *= 100;
          ok = true;
        }
        break;
      case 'mille':
        if (l?.genre !== 'et' && l?.genre !== 'mille') {
          this.total += (this.cur || 1) * 1000;
          this.cur = 0;
          ok = true;
        }
        break;
      case 'mult':
        // « millions » sans compte devant (« des millions ») n'est pas un nombre.
        if (l !== undefined && (this.cur > 0 || this.total > 0) && l.genre !== 'et' && l.genre !== 'mille' && l.genre !== 'mult') {
          this.total += this.cur * t.v;
          this.cur = 0;
          ok = true;
        }
        break;
      case 'et':
        ok = apresDixaine && l.v >= 20 && l.v <= 60 && (suivant?.genre === 'un' || (l.v === 60 && suivant?.genre === 'teen'));
        break;
    }
    if (ok) {
      this.dernier = retenu;
      this.mots.push(t.mot);
    }
    return ok;
  }

  get valeur(): string | undefined {
    if (this.vide || this.dernier?.genre === 'et') return undefined;
    return String(this.total + this.cur);
  }
}

/**
 * Nombres écrits en toutes lettres, avec leur valeur canonique (« deux millions » = « 2000000 »,
 * « soixante et onze » = « 71 »). Seules les suites non ambiguës comptent : « un/une » seul est un
 * article, « millions » sans compte n'est pas un nombre, « pour cent » est exclu, « deux, trois »
 * donne deux nombres. Chaque entrée garde ses mots (clés pliées) pour les messages.
 */
export function extractWordNumbers(text: string): { valeur: string; mots: string[] }[] {
  const morceaux = foldKey(cleanText(text)).match(/[a-z]+|[^a-z]+/g) ?? [];
  const jetons: (Jeton | null)[] = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i] ?? '';
    if (/^[a-z]/.test(m)) {
      const e = VALEURS[m];
      const pourCent = m === 'cent' && morceaux[i - 2] === 'pour';
      jetons.push(e === undefined || pourCent ? null : { genre: e[0], v: e[1], mot: m });
    } else if (!/^[\s-]+$/.test(m)) {
      jetons.push(null); // ponctuation ou chiffre : rupture entre deux nombres
    }
  }
  const out: { valeur: string; mots: string[] }[] = [];
  let suite = new Suite();
  const clore = (): void => {
    const valeur = suite.valeur;
    if (valeur !== undefined) out.push({ valeur, mots: suite.mots });
    suite = new Suite();
  };
  for (let i = 0; i < jetons.length; i++) {
    const t = jetons[i];
    if (t === null || t === undefined) {
      clore();
      continue;
    }
    const suivant = jetons[i + 1] ?? undefined;
    if (!suite.ajouter(t, suivant)) {
      clore();
      suite.ajouter(t, suivant);
    }
  }
  clore();
  return out;
}
