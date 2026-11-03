// Script de mémorisation du niveau de lecture (src/scripts/niveau.js), exécuté dans node:vm avec un faux DOM.
// Documentation du code (le fichier livré n'a aucun commentaire) :
//  - IIFE ES5 classique, chargé juste après le fieldset (ni async, ni defer, ni module) ;
//  - il ne fait que cocher un radio, écrire la clé `rtp:niveau` et annoncer le changement ;
//  - la valeur lue dans localStorage est COMPARÉE à la valeur de chaque radio, jamais insérée dans un sélecteur
//    (une valeur trafiquée comme `"]x` est donc ignorée) ;
//  - localStorage peut lever (Safari en navigation privée, stockage désactivé) : toutes les erreurs sont silencieuses ;
//  - `pageshow` avec `persisted` (bfcache) resynchronise les radios sur la valeur mémorisée ;
//  - `data-js-niveau` sur <html> masque la phrase « sans JavaScript, votre choix n'est pas mémorisé ».
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const FICHIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'scripts', 'niveau.js');
const source = fs.existsSync(FICHIER) ? fs.readFileSync(FICHIER, 'utf8') : '';

const LIBELLES: Record<string, string> = {
  resume: 'En bref',
  detaille: 'En détail',
  enfant: 'Pour les enfants',
  aine: 'Gros caractères',
};

interface Radio {
  name: string;
  value: string;
  checked: boolean;
  labels: { textContent: string }[];
}

type Ecouteur = (e: unknown) => void;

interface Decor {
  radios: Radio[];
  ecouteursChamp: Map<string, Ecouteur>;
  ecouteursFenetre: Map<string, Ecouteur>;
  attributsRacine: Map<string, string>;
  annonce: { textContent: string };
  ecritures: [string, string][];
  lectures: string[];
}

type Stockage = { getItem(k: string): string | null; setItem(k: string, v: string): void };

function monter(stockage: (d: Decor) => Stockage, { avecChamp = true }: { avecChamp?: boolean } = {}): Decor {
  const radios: Radio[] = [];
  for (const [value, libelle] of Object.entries(LIBELLES)) {
    let coche = value === 'resume';
    radios.push({
      name: 'niveau',
      value,
      // comme un vrai groupe de radios : cocher l'un décoche les autres
      get checked(): boolean {
        return coche;
      },
      set checked(v: boolean) {
        if (v) for (const r of radios) r.checked = false;
        coche = v;
      },
      labels: [{ textContent: libelle }],
    });
  }
  const ecouteursChamp = new Map<string, Ecouteur>();
  const ecouteursFenetre = new Map<string, Ecouteur>();
  const attributsRacine = new Map<string, string>();
  const annonce = { textContent: '' };
  const champ = {
    querySelectorAll: (s: string): Radio[] => {
      assert.equal(s, 'input[name="niveau"]', 'le script interroge toujours le même sélecteur constant');
      return radios;
    },
    addEventListener: (t: string, f: Ecouteur): void => {
      ecouteursChamp.set(t, f);
    },
  };
  const decor: Decor = { radios, ecouteursChamp, ecouteursFenetre, attributsRacine, annonce, ecritures: [], lectures: [] };
  const store = stockage(decor);
  const sandbox = {
    document: {
      documentElement: { setAttribute: (k: string, v: string): void => void attributsRacine.set(k, v) },
      querySelector: (s: string) => (s === '.niveaux' ? (avecChamp ? champ : null) : s === '[data-niveau-annonce]' ? annonce : null),
    },
    localStorage: store,
    addEventListener: (t: string, f: Ecouteur): void => void ecouteursFenetre.set(t, f),
  };
  vm.runInNewContext(source, sandbox);
  return decor;
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

const coche = (d: Decor): string[] => d.radios.filter((r) => r.checked).map((r) => r.value);
const changer = (d: Decor, cible: unknown): void => (d.ecouteursChamp.get('change') as Ecouteur)({ target: cible });

describe('niveau.js : restauration', () => {
  it('un niveau mémorisé « aine » coche le radio aine', () => {
    const d = monter(stockageAvec('aine'));
    assert.deepEqual(coche(d), ['aine']);
    assert.deepEqual(d.lectures, ['rtp:niveau']);
  });

  it('valeurs hostiles, inconnues, vides ou absentes : « En bref » reste coché, aucune exception', () => {
    for (const v of ['"]x', 'unknown', '', null, 'AINE', 'aine ', '[name=niveau]']) {
      const d = monter(stockageAvec(v));
      assert.deepEqual(coche(d), ['resume'], `valeur ${JSON.stringify(v)}`);
    }
  });

  it('localStorage qui lève (Safari privé) : le défaut reste, aucune exception, changement sans erreur', () => {
    const d = monter(stockageHostile);
    assert.deepEqual(coche(d), ['resume']);
    assert.doesNotThrow(() => changer(d, d.radios[1]));
    assert.equal(d.annonce.textContent, 'Niveau « En détail » affiché.');
  });
});

describe('niveau.js : mémorisation et annonce', () => {
  it('un changement écrit uniquement `rtp:niveau` et annonce le libellé', () => {
    const d = monter(stockageAvec(null));
    changer(d, d.radios[1]);
    assert.deepEqual(d.ecritures, [['rtp:niveau', 'detaille']]);
    assert.equal(d.annonce.textContent, 'Niveau « En détail » affiché.');
  });

  it('un changement sur un autre champ du fieldset est ignoré', () => {
    const d = monter(stockageAvec(null));
    changer(d, { name: 'ordre', value: 'aleatoire', labels: [{ textContent: 'x' }] });
    assert.deepEqual(d.ecritures, []);
    assert.equal(d.annonce.textContent, '');
  });

  it("aucune clé autre que `rtp:niveau` n'est jamais lue ni écrite", () => {
    const d = monter(stockageAvec('enfant'));
    for (const r of d.radios) changer(d, r);
    (d.ecouteursFenetre.get('pageshow') as Ecouteur)({ persisted: true });
    for (const k of [...d.lectures, ...d.ecritures.map(([c]) => c)]) assert.equal(k, 'rtp:niveau');
    assert.equal(d.ecritures.length, 4);
  });
});

describe('niveau.js : bfcache et racine', () => {
  it('pageshow persisted: true réapplique la valeur mémorisée', () => {
    let valeur: string | null = null;
    const d = monter(() => ({ getItem: () => valeur, setItem: () => {} }));
    assert.deepEqual(coche(d), ['resume']);
    valeur = 'aine';
    (d.ecouteursFenetre.get('pageshow') as Ecouteur)({ persisted: true });
    assert.deepEqual(coche(d), ['aine']);
  });

  it('pageshow persisted: false ne fait rien', () => {
    let valeur: string | null = null;
    const d = monter(() => ({ getItem: () => valeur, setItem: () => {} }));
    valeur = 'enfant';
    (d.ecouteursFenetre.get('pageshow') as Ecouteur)({ persisted: false });
    assert.deepEqual(coche(d), ['resume']);
  });

  it('pose data-js-niveau sur <html>', () => {
    const d = monter(stockageAvec(null));
    assert.equal(d.attributsRacine.get('data-js-niveau'), '');
  });

  it('sans élément .niveaux : retourne sans erreur et ne branche rien', () => {
    const d = monter(stockageAvec('aine'), { avecChamp: false });
    assert.equal(d.ecouteursChamp.size, 0);
    assert.equal(d.ecouteursFenetre.size, 0);
    assert.deepEqual(d.lectures, []);
  });
});

describe('niveau.js : fichier livré', () => {
  it('existe, pèse au plus 2048 octets', () => {
    assert.ok(source !== '', `${FICHIER} introuvable`);
    assert.ok(Buffer.byteLength(source) <= 2048, `${Buffer.byteLength(source)} octets`);
  });

  it('ne contient ni commentaire, ni innerHTML, ni eval', () => {
    assert.ok(!/\/\/|\/\*/.test(source), 'commentaire interdit');
    assert.ok(!/innerHTML|eval\s*\(|new Function|document\.write/.test(source));
  });

  it('la seule chaîne commençant par « rtp: » est `rtp:niveau`', () => {
    const cles = [...source.matchAll(/(['"])(rtp:[^'"]*)\1/g)].map((m) => m[2]);
    assert.deepEqual([...new Set(cles)], ['rtp:niveau']);
  });
});
