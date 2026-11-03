// Script d'ordre des candidats (src/scripts/ordre.js), exécuté dans node:vm avec un faux DOM.
// Documentation du code (le fichier livré n'a aucun commentaire) :
//  - IIFE ES5 classique, placée dans <head> (ni async, ni defer, ni module) : elle s'exécute avant l'analyse du <body> ;
//  - elle ne mémorise que `rtp:ordre` ('aleatoire' ou rien) : seule la chaîne exacte « aleatoire » active le mode aléatoire,
//    toute autre valeur (absente, vide, trafiquée, `"]x`) laisse l'ordre alphabétique ; localStorage peut lever : silencieux ;
//  - en mode aléatoire elle pose `data-ordre="aleatoire"` sur <html> tout de suite : le CSS cache alors les listes
//    (`visibility: hidden`, aucun décalage de mise en page) jusqu'à ce que le script les marque `data-ordre-fait` ;
//    si le script échoue, une animation CSS `rtp-reveler` les rend visibles après 1,5 s ;
//  - `data-ordre-js` sur <html> masque la phrase « L'ordre aléatoire demande JavaScript » ;
//  - ordre alphabétique = tri numérique sur `data-rang`, calculé à la construction avec Intl.Collator('fr') sur `nom_tri` :
//    le navigateur ne collationne jamais ;
//  - ordre aléatoire = Fisher-Yates avec `crypto.getRandomValues` et rejet des tirages >= floor(2^32 / n) * n
//    (aucun biais de modulo) ; jamais Math.random ;
//  - le radio à cocher est cherché avec la valeur INTERNE du mode, jamais avec la chaîne lue dans localStorage ;
//  - un retour depuis le bfcache restaure le DOM tel quel : le script ne s'exécute pas de nouveau, rien n'est retiré.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const FICHIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'scripts', 'ordre.js');
const source = fs.existsSync(FICHIER) ? fs.readFileSync(FICHIER, 'utf8') : '';

type Ecouteur = (e: unknown) => void;

interface Item {
  nom: string;
  getAttribute(n: string): string | null;
}

interface Liste {
  children: Item[];
  attrs: Map<string, string>;
  setAttribute(k: string, v: string): void;
  appendChild(n: Item): Item;
}

interface Radio {
  value: string;
  checked: boolean;
}

interface Decor {
  listes: Liste[];
  radios: Radio[];
  controle: { hidden: boolean; ecouteurs: Map<string, Ecouteur> };
  annonce: { textContent: string };
  attributsRacine: Map<string, string>;
  ecouteursDocument: Map<string, Ecouteur>;
  ecritures: [string, string][];
  lectures: string[];
  radioDemandes: string[];
  tirages: number;
}

type Stockage = { getItem(k: string): string | null; setItem(k: string, v: string): void };

function liste(rangs: string[]): Liste {
  const l: Liste = {
    children: [],
    attrs: new Map(),
    setAttribute: (k, v) => void l.attrs.set(k, v),
    appendChild: (n) => {
      const i = l.children.indexOf(n);
      if (i >= 0) l.children.splice(i, 1);
      l.children.push(n);
      return n;
    },
  };
  l.children = rangs.map((r, i) => ({ nom: `${i}:${r}`, getAttribute: (n: string) => (n === 'data-rang' ? r : null) }));
  return l;
}

const stockageAvec =
  (valeur: string | null) =>
  (d: Decor): Stockage => ({
    getItem: (k) => {
      d.lectures.push(k);
      return valeur;
    },
    setItem: (k, v) => void d.ecritures.push([k, v]),
  });

const stockageHostile = (): Stockage => ({
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
});

interface Options {
  avecControle?: boolean;
  readyState?: 'loading' | 'interactive';
  rangs?: string[][];
  /** Remplace crypto.getRandomValues (le vrai est utilisé par défaut). */
  alea?: (u: Uint32Array) => void;
}

function monter(stockage: (d: Decor) => Stockage, { avecControle = true, readyState = 'interactive', rangs = [['3', '1', '2', '0']], alea }: Options = {}): Decor {
  const radios: Radio[] = ['alphabetique', 'aleatoire'].map((value) => {
    return { value, checked: value === 'alphabetique' };
  });
  for (const r of radios) {
    let coche = r.checked;
    Object.defineProperty(r, 'checked', {
      get: () => coche,
      set: (v: boolean) => {
        if (v) for (const x of radios) if (x !== r) x.checked = false;
        coche = v;
      },
    });
  }
  const decor: Decor = {
    listes: rangs.map(liste),
    radios,
    controle: { hidden: true, ecouteurs: new Map() },
    annonce: { textContent: '' },
    attributsRacine: new Map(),
    ecouteursDocument: new Map(),
    ecritures: [],
    lectures: [],
    radioDemandes: [],
    tirages: 0,
  };
  const controle = {
    get hidden(): boolean {
      return decor.controle.hidden;
    },
    set hidden(v: boolean) {
      decor.controle.hidden = v;
    },
    querySelector: (s: string): unknown => {
      if (s === '[data-ordre-annonce]') return decor.annonce;
      const m = /^input\[value="([^"]*)"\]$/.exec(s);
      assert.ok(m, `sélecteur inattendu : ${s}`);
      decor.radioDemandes.push(m[1] as string);
      return radios.find((r) => r.value === m[1]);
    },
    addEventListener: (t: string, f: Ecouteur): void => void decor.controle.ecouteurs.set(t, f),
  };
  const store = stockage(decor);
  const generateur = alea ?? ((u: Uint32Array) => globalThis.crypto.getRandomValues(u));
  const sandbox = {
    document: {
      readyState,
      documentElement: { setAttribute: (k: string, v: string): void => void decor.attributsRacine.set(k, v) },
      addEventListener: (t: string, f: Ecouteur): void => void decor.ecouteursDocument.set(t, f),
      querySelectorAll: (s: string): Liste[] => {
        assert.equal(s, '[data-ordonnable]');
        return decor.listes;
      },
      querySelector: (s: string): unknown => {
        assert.equal(s, '[data-ordre-controle]');
        return avecControle ? controle : null;
      },
    },
    localStorage: store,
    crypto: {
      getRandomValues: (u: Uint32Array): Uint32Array => {
        decor.tirages++;
        generateur(u);
        return u;
      },
    },
  };
  vm.runInNewContext(source, sandbox);
  return decor;
}

const rangsDe = (l: Liste): string[] => l.children.map((c) => c.getAttribute('data-rang') as string);
const changer = (d: Decor, valeur: unknown): void => (d.controle.ecouteurs.get('change') as Ecouteur)({ target: { value: valeur } });
const coche = (d: Decor): string[] => d.radios.filter((r) => r.checked).map((r) => r.value);

describe('ordre.js : mode au chargement', () => {
  it('« aleatoire » mémorisé pose data-ordre="aleatoire" avant DOMContentLoaded', () => {
    const d = monter(stockageAvec('aleatoire'), { readyState: 'loading' });
    assert.equal(d.attributsRacine.get('data-ordre'), 'aleatoire');
    assert.ok(d.attributsRacine.has('data-ordre-js'));
    assert.ok(d.ecouteursDocument.has('DOMContentLoaded'), 'le tri attend DOMContentLoaded tant que le document charge');
    assert.ok(!d.listes[0]?.attrs.has('data-ordre-fait'), 'rien n’est marqué avant DOMContentLoaded');
    (d.ecouteursDocument.get('DOMContentLoaded') as Ecouteur)({});
    assert.ok(d.listes[0]?.attrs.has('data-ordre-fait'));
    assert.equal(d.controle.hidden, false);
    assert.deepEqual(coche(d), ['aleatoire']);
  });

  for (const [libelle, valeur] of [
    ['absente', null],
    ['vide', ''],
    ['autre mot', 'alphabetique'],
    ['casse différente', 'ALEATOIRE'],
    ['espace en trop', 'aleatoire '],
    ['hostile', '"]x'],
  ] as const) {
    it(`valeur mémorisée ${libelle} : ordre alphabétique, pas de data-ordre, radio alphabétique coché`, () => {
      const d = monter(stockageAvec(valeur));
      assert.ok(!d.attributsRacine.has('data-ordre'));
      assert.ok(d.attributsRacine.has('data-ordre-js'));
      assert.deepEqual(coche(d), ['alphabetique']);
      assert.deepEqual(d.radioDemandes, ['alphabetique'], 'le sélecteur n’embarque jamais la valeur lue dans localStorage');
      assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2', '3']);
      assert.equal(d.tirages, 0, 'aucun tirage en mode alphabétique');
    });
  }

  it('localStorage qui lève : ordre alphabétique, aucune exception, data-ordre-js posé', () => {
    const d = monter(() => stockageHostile());
    assert.ok(!d.attributsRacine.has('data-ordre'));
    assert.ok(d.attributsRacine.has('data-ordre-js'));
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2', '3']);
    assert.equal(d.controle.hidden, false);
    changer(d, 'aleatoire');
    assert.equal(d.annonce.textContent, 'Ordre aléatoire : nouveau tirage.', 'l’échec d’écriture ne bloque pas le changement');
  });

  it('document déjà analysé : tri immédiat, listes marquées data-ordre-fait, contrôle révélé', () => {
    const d = monter(stockageAvec(null), { rangs: [['2', '0', '1'], ['1', '0']] });
    assert.equal(d.ecouteursDocument.size, 0, 'aucun écouteur DOMContentLoaded inutile');
    for (const l of d.listes) assert.ok(l.attrs.has('data-ordre-fait'));
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2']);
    assert.deepEqual(rangsDe(d.listes[1] as Liste), ['0', '1']);
    assert.equal(d.controle.hidden, false);
  });

  it('le tri alphabétique est numérique (« 10 » après « 9 »)', () => {
    const d = monter(stockageAvec(null), { rangs: [['10', '9', '2', '100', '1']] });
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['1', '2', '9', '10', '100']);
  });

  it('page sans contrôle : les listes sont triées et marquées, sans exception', () => {
    const d = monter(stockageAvec(null), { avecControle: false });
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2', '3']);
    assert.ok(d.listes[0]?.attrs.has('data-ordre-fait'));
  });

  it('page sans liste : aucune exception, le contrôle est tout de même révélé', () => {
    const d = monter(stockageAvec(null), { rangs: [] });
    assert.equal(d.controle.hidden, false);
  });
});

describe('ordre.js : changement de mode', () => {
  it('passer à « aleatoire » n’écrit que rtp:ordre, redistribue et annonce', () => {
    const d = monter(stockageAvec(null));
    changer(d, 'aleatoire');
    assert.deepEqual(d.ecritures, [['rtp:ordre', 'aleatoire']]);
    assert.ok(d.tirages > 0);
    assert.equal(d.annonce.textContent, 'Ordre aléatoire : nouveau tirage.');
    assert.deepEqual([...rangsDe(d.listes[0] as Liste)].sort(), ['0', '1', '2', '3'], 'les mêmes éléments, rien de perdu ni de dupliqué');
  });

  it('revenir à « alphabetique » restaure l’ordre de data-rang et annonce', () => {
    const d = monter(stockageAvec('aleatoire'), { rangs: [['5', '3', '1', '4', '2', '0']] });
    changer(d, 'aleatoire');
    const avant = d.tirages;
    changer(d, 'alphabetique');
    assert.equal(d.tirages, avant, 'aucun tirage pour l’ordre alphabétique');
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2', '3', '4', '5']);
    assert.equal(d.annonce.textContent, 'Ordre alphabétique.');
    assert.deepEqual(d.ecritures.at(-1), ['rtp:ordre', 'alphabetique']);
  });

  it('une valeur de radio hostile est ramenée à l’ordre alphabétique', () => {
    const d = monter(stockageAvec('aleatoire'));
    changer(d, '"]x');
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2', '3']);
    assert.deepEqual(d.ecritures, [['rtp:ordre', 'alphabetique']]);
  });

  it('chaque liste est redistribuée indépendamment (carte et « ne se présentent pas »)', () => {
    const d = monter(stockageAvec('aleatoire'), { rangs: [['0', '1', '2'], ['0', '1']] });
    for (const l of d.listes) assert.ok(l.attrs.has('data-ordre-fait'));
    assert.deepEqual([...rangsDe(d.listes[1] as Liste)].sort(), ['0', '1']);
  });
});

describe('ordre.js : tirage sans biais', () => {
  it('chi² sur la première position (6 éléments, 60 000 tirages, 5 ddl) < 20,52', () => {
    const rangs = ['0', '1', '2', '3', '4', '5'];
    const d = monter(stockageAvec('aleatoire'), { rangs: [rangs] });
    const N = 60000;
    const compte = new Array<number>(6).fill(0);
    for (let k = 0; k < N; k++) {
      changer(d, 'aleatoire');
      compte[Number(rangsDe(d.listes[0] as Liste)[0])]!++;
    }
    const attendu = N / 6;
    const chi2 = compte.reduce((s, c) => s + (c - attendu) ** 2 / attendu, 0);
    assert.ok(chi2 < 20.52, `chi² = ${chi2.toFixed(2)} (effectifs ${compte.join(', ')})`);
  });

  it('chi² sur l’avant-dernière position et sur la dernière (mêmes seuils)', () => {
    const d = monter(stockageAvec('aleatoire'), { rangs: [['0', '1', '2', '3', '4', '5']] });
    const N = 60000;
    const compte = [new Array<number>(6).fill(0), new Array<number>(6).fill(0)];
    for (let k = 0; k < N; k++) {
      changer(d, 'aleatoire');
      const r = rangsDe(d.listes[0] as Liste);
      compte[0]![Number(r[4])]!++;
      compte[1]![Number(r[5])]!++;
    }
    for (const c of compte) {
      const chi2 = c.reduce((s, x) => s + (x - N / 6) ** 2 / (N / 6), 0);
      assert.ok(chi2 < 20.52, `chi² = ${chi2.toFixed(2)}`);
    }
  });

  it('rejet : un tirage >= floor(2^32 / n) * n n’engendre jamais d’indice, le script retire', () => {
    // 3 éléments : alea(3) a pour borne 4294967295 ; 4294967295 % 3 === 0 donnerait un indice biaisé.
    const suite = [4294967295, 1, 0];
    const d = monter(stockageAvec('aleatoire'), {
      rangs: [['0', '1', '2']],
      alea: (u) => {
        u[0] = suite.shift() as number;
      },
    });
    assert.equal(suite.length, 0, 'exactement 3 tirages consommés : 1 rejeté + 2 retenus');
    assert.equal(d.tirages, 3);
    // i = 2 : j = 1 → [0, 2, 1] ; i = 1 : j = 0 → [2, 0, 1]
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['2', '0', '1']);
  });

  it('rejet répété : plusieurs tirages hors borne de suite sont tous écartés', () => {
    const suite = [4294967295, 4294967295, 4294967295, 2, 1];
    const d = monter(stockageAvec('aleatoire'), {
      rangs: [['0', '1', '2']],
      alea: (u) => {
        u[0] = suite.shift() as number;
      },
    });
    assert.equal(suite.length, 0);
    assert.equal(d.tirages, 5);
    // alea(3) = 2 % 3 = 2 → j = 2 (i = 2, pas d'échange) ; alea(2) = 1 → j = 1 (i = 1, pas d'échange)
    assert.deepEqual(rangsDe(d.listes[0] as Liste), ['0', '1', '2']);
  });
});

describe('ordre.js : fichier livré', () => {
  it('le fichier existe et pèse au plus 2048 octets (les accents comptent pour 2)', () => {
    assert.ok(source !== '', 'src/scripts/ordre.js absent');
    assert.ok(Buffer.byteLength(source, 'utf8') <= 2048, `${Buffer.byteLength(source, 'utf8')} octets`);
  });

  it('aucun commentaire', () => {
    assert.ok(!/\/\*|\/\//.test(source), 'commentaire détecté (// ou /*)');
  });

  it('ni Math.random ni innerHTML ; un seul appel à getRandomValues', () => {
    assert.ok(!/Math\.random/.test(source));
    assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(source));
    assert.ok(!/\.sort\(\s*function\s*\(\)\s*\{[^}]*random/i.test(source));
    assert.equal((source.match(/getRandomValues/g) ?? []).length, 1);
  });

  it('la seule clé de stockage est rtp:ordre ; aucun cookie', () => {
    const cles = new Set((source.match(/'rtp:[a-z]+'/g) ?? []) as string[]);
    assert.deepEqual([...cles], ["'rtp:ordre'"]);
    assert.ok(!/document\.cookie/.test(source));
  });

  it('chaînes affichées : celles du jeu de textes (annonces)', () => {
    assert.ok(source.includes("'aléatoire : nouveau tirage.'"));
    assert.ok(source.includes("'alphabétique.'"));
  });
});
