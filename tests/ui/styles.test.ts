// Contrat CSS de la UI-SPEC (jetons, palette, échelle d'espacement, typographie, focus, mouvement).
// Lecture statique de src/styles/*.css : aucun build.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLES = path.join(ROOT, 'src', 'styles');

interface Regle {
  fichier: string;
  selecteur: string;
  declarations: { prop: string; valeur: string }[];
}

const fichiers = existsSync(STYLES) ? readdirSync(STYLES).filter((f) => f.endsWith('.css')).sort() : [];
const regles: Regle[] = [];
const sourcesCss: { fichier: string; texte: string }[] = [];

for (const fichier of fichiers) {
  const texte = readFileSync(path.join(STYLES, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  sourcesCss.push({ fichier, texte });
  // Blocs « sélecteur { déclarations } » les plus internes : les @media englobants sont aplatis.
  for (const m of texte.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = (m[2] ?? '')
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d !== '')
      .map((d) => {
        const i = d.indexOf(':');
        return { prop: d.slice(0, i).trim().toLowerCase(), valeur: d.slice(i + 1).trim() };
      });
    regles.push({ fichier, selecteur: (m[1] ?? '').trim().replace(/\s+/g, ' '), declarations });
  }
}

const valeurRoot = (prop: string): string | undefined =>
  regles
    .filter((r) => r.selecteur === ':root')
    .flatMap((r) => r.declarations)
    .find((d) => d.prop === prop)?.valeur;

const JETONS_COULEUR: Record<string, string> = {
  '--fond': '#FAFAF8',
  '--carte': '#FFFFFF',
  '--panneau': '#F0EEE9',
  '--encre': '#1F2328',
  '--encre-douce': '#4D535B',
  '--vide': '#575C63',
  '--bord-fort': '#6B7078',
  '--bord-carte': '#8A8F96',
};

const JETONS_TYPE: Record<string, string> = {
  '--t-label': '1rem',
  '--t-corps': '1.125rem',
  '--t-titre': '1.5rem',
  '--t-affiche': '2rem',
};

const PALETTE: Record<string, string> = {
  logement: '#A3401C',
  travail: '#8A5200',
  ecole: '#6A6500',
  climat: '#2F6B2F',
  sante: '#00695C',
  impots: '#006A7D',
  'europe-et-monde': '#2B5CAB',
  institutions: '#5B48B0',
  retraites: '#8C3A7A',
  securite: '#4A5A68',
};

const ESPACES = new Set(['0', 'auto', '0.25rem', '0.5rem', '1rem', '1.5rem', '2rem', '3rem', '4rem']);

function idsThemes(dossier: string, seulementPublies: boolean): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.yaml'))
    .filter((f) => !seulementPublies || /^statut_relecture:\s*publie\s*$/m.test(readFileSync(path.join(dossier, f), 'utf8')))
    .map((f) => f.replace(/\.yaml$/, ''));
}

describe('styles : jetons et palette', () => {
  it('au moins une feuille de style existe', () => {
    assert.ok(fichiers.length > 0, `aucun fichier .css dans ${STYLES}`);
  });

  it(':root définit les jetons de couleur de la UI-SPEC', () => {
    for (const [nom, hex] of Object.entries(JETONS_COULEUR)) {
      assert.equal(valeurRoot(nom)?.toUpperCase(), hex, `jeton ${nom}`);
    }
  });

  it(':root définit les jetons typographiques', () => {
    for (const [nom, valeur] of Object.entries(JETONS_TYPE)) assert.equal(valeurRoot(nom), valeur, `jeton ${nom}`);
  });

  it('dix règles [data-theme] avec la couleur de la UI-SPEC', () => {
    for (const [id, hex] of Object.entries(PALETTE)) {
      const r = regles.find((x) => x.selecteur === `[data-theme="${id}"]`);
      assert.ok(r, `règle [data-theme="${id}"] absente`);
      assert.equal(r.declarations.find((d) => d.prop === '--theme')?.valeur.toUpperCase(), hex, `--theme de ${id}`);
    }
  });

  it('tous les thèmes des fixtures et du contenu publié ont une règle', () => {
    const trouves = new Set([
      ...idsThemes(path.join(ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'themes'), false),
      ...idsThemes(path.join(ROOT, 'tests', 'fixtures', 'corpus-m1', 'src', 'content', 'themes'), false),
      ...idsThemes(path.join(ROOT, 'src', 'content', 'themes'), true),
    ]);
    assert.ok(trouves.size >= 3, 'au moins logement, ecole et climat');
    for (const id of trouves) {
      assert.ok(
        regles.some((r) => r.selecteur === `[data-theme="${id}"]`),
        `thème « ${id} » sans règle [data-theme]`,
      );
    }
  });
});

describe('styles : échelle et interdits', () => {
  it("marges, remplissages et gouttières : valeurs de l'échelle 4/8/16/24/32/48/64 px", () => {
    for (const r of regles) {
      for (const d of r.declarations) {
        if (!/^(margin|padding)(-[a-z]+)*$/.test(d.prop) && !/^(row-|column-)?gap$/.test(d.prop)) continue;
        for (const v of d.valeur.split(/\s+/)) {
          assert.ok(ESPACES.has(v), `${r.selecteur} { ${d.prop}: ${d.valeur} } : « ${v} » hors échelle`);
        }
      }
    }
  });

  it('font-size : jeton var(--t-…) ou inherit (seule exception : 0.75em sur .terme::after)', () => {
    for (const r of regles) {
      for (const d of r.declarations) {
        if (d.prop !== 'font-size') continue;
        const ok = /^var\(--t-[a-z]+\)$/.test(d.valeur) || d.valeur === 'inherit' || (d.valeur === '0.75em' && /\.terme::after/.test(r.selecteur));
        assert.ok(ok, `${r.selecteur} { font-size: ${d.valeur} }`);
      }
    }
  });

  it('jamais outline: none ni outline: 0', () => {
    for (const r of regles) {
      for (const d of r.declarations) {
        if (d.prop !== 'outline') continue;
        assert.ok(!/^(none|0)(\s|$)/.test(d.valeur), `${r.selecteur} { outline: ${d.valeur} }`);
      }
    }
  });

  it('aucune transition ; animation et @keyframes seulement rtp-reveler', () => {
    for (const { fichier, texte } of sourcesCss) {
      assert.ok(!/(^|[\s;{])transition(-[a-z]+)?\s*:/.test(texte), `${fichier} : transition interdite`);
      for (const m of texte.matchAll(/@keyframes\s+([^\s{]+)/g)) assert.equal(m[1], 'rtp-reveler', `${fichier} : @keyframes ${m[1]}`);
    }
    for (const r of regles) {
      for (const d of r.declarations) {
        if (!/^animation(-name)?$/.test(d.prop)) continue;
        assert.ok(d.valeur === 'none' || /rtp-reveler/.test(d.valeur), `${r.selecteur} { ${d.prop}: ${d.valeur} }`);
      }
    }
  });

  it('aucune troncature de texte', () => {
    for (const { fichier, texte } of sourcesCss) {
      assert.ok(!/text-overflow\s*:\s*ellipsis/.test(texte), `${fichier} : text-overflow: ellipsis`);
      assert.ok(!/line-clamp/.test(texte), `${fichier} : line-clamp`);
    }
  });

  it('height et max-height : jamais en px (hors utilitaire masqué à 1px)', () => {
    for (const r of regles) {
      for (const d of r.declarations) {
        if (d.prop !== 'height' && d.prop !== 'max-height') continue;
        for (const m of d.valeur.matchAll(/(-?[\d.]+)px/g)) {
          assert.equal(m[0], '1px', `${r.selecteur} { ${d.prop}: ${d.valeur} }`);
        }
      }
    }
  });

  it('aucun !important', () => {
    for (const { fichier, texte } of sourcesCss) assert.ok(!/!important/.test(texte), `${fichier} : !important`);
  });
});

// ---------------------------------------------------------------------------
// niveaux.css : sélecteur de niveau, Gros caractères (plan 04-05)
// ---------------------------------------------------------------------------

const NIVEAUX_CSS = sourcesCss.find((s) => s.fichier === 'niveaux.css')?.texte ?? '';
const reglesNiveaux = regles.filter((r) => r.fichier === 'niveaux.css');
const decl = (r: Regle | undefined, prop: string): string | undefined => r?.declarations.find((d) => d.prop === prop)?.valeur;
const AINE = '.lecteur:has(> .niveaux #niv-aine:checked)';

describe('styles : niveaux de lecture', () => {
  it('niveaux.css existe', () => {
    assert.ok(NIVEAUX_CSS !== '', 'src/styles/niveaux.css absent');
  });

  it('quatre règles :has() ancrées sur .lecteur (combinateur enfant) masquent les autres rédactions', () => {
    for (const n of ['resume', 'detaille', 'enfant', 'aine']) {
      const sel = `.lecteur:has(> .niveaux #niv-${n}:checked) .redaction:not([data-niveau="${n}"])`;
      const r = reglesNiveaux.find((x) => x.selecteur.split(/\s*,\s*/).includes(sel));
      assert.ok(r, `règle de masquage ${n} absente`);
      assert.equal(decl(r, 'display'), 'none');
    }
  });

  it('Gros caractères REMPLACE les jetons typographiques (20/22/28/36 px), sans multiplicateur', () => {
    const r = reglesNiveaux.find((x) => x.selecteur === 'main:has(> .lecteur > .niveaux #niv-aine:checked)');
    assert.ok(r, 'surcharge des jetons sur main:has(> .lecteur > .niveaux #niv-aine:checked) absente');
    assert.equal(decl(r, '--t-label'), '1.25rem');
    assert.equal(decl(r, '--t-corps'), '1.375rem');
    assert.equal(decl(r, '--t-titre'), '1.75rem');
    assert.equal(decl(r, '--t-affiche'), '2.25rem');
    assert.equal(decl(r, 'font-size'), 'var(--t-corps)', 'le texte hérité repart du jeton remplacé');
    for (const x of reglesNiveaux) {
      for (const d of x.declarations) {
        if (d.prop === 'font-size') assert.ok(!/\d(em|%)$/.test(d.valeur), `${x.selecteur} { font-size: ${d.valeur} } : multiplicateur interdit`);
      }
    }
  });

  it('cibles de 3rem (48 px) pour a, button, label, summary hors .terme sous Gros caractères', () => {
    const r = reglesNiveaux.find((x) => x.selecteur === `${AINE} :is(a, button, label, summary):not(.terme)`);
    assert.ok(r, 'règle min-height Gros caractères absente');
    assert.equal(decl(r, 'min-height'), '3rem');
  });

  it('la grille de cartes s’élargit sous Gros caractères', () => {
    const r = reglesNiveaux.find((x) => x.selecteur === `${AINE} .cellules`);
    assert.ok(r, 'règle .cellules sous Gros caractères absente');
    assert.match(decl(r, 'grid-template-columns') ?? '', /minmax\(min\(100%, 22rem\), 1fr\)/);
  });

  it('les radios sont transparents (opacity: 0) et jamais display: none', () => {
    const radio = reglesNiveaux.find((x) => x.selecteur === '.niveau input');
    assert.ok(radio, 'règle .niveau input absente');
    assert.equal(decl(radio, 'opacity'), '0');
    for (const x of reglesNiveaux) {
      if (/\binput\b/.test(x.selecteur)) assert.notEqual(decl(x, 'display'), 'none', `${x.selecteur}`);
    }
  });

  it('les étiquettes de niveau passent à la ligne au lieu de déborder (320 px, texte 160 %)', () => {
    const label = reglesNiveaux.find((x) => x.selecteur === '.niveau label');
    assert.ok(label, 'règle .niveau label absente');
    assert.equal(decl(label, 'min-inline-size'), '0');
    assert.equal(decl(label, 'overflow-wrap'), 'anywhere');
    const niveau = reglesNiveaux.find((x) => x.selecteur === '.niveau');
    assert.equal(decl(niveau!, 'min-inline-size'), '0');
  });

  it('le focus clavier est dessiné sur l’étiquette (input:focus-visible + label)', () => {
    const r = reglesNiveaux.find((x) => /input:focus-visible \+ label/.test(x.selecteur) && decl(x, 'outline') !== undefined);
    assert.ok(r, 'outline sur input:focus-visible + label absent');
  });

  it('l’étiquette de niveau est masquée visuellement (jamais display: none) quand :has() est pris en charge', () => {
    assert.match(NIVEAUX_CSS, /@supports selector\(:has\(\*\)\)/);
    const r = reglesNiveaux.find((x) => /\.redaction > \.etiquette/.test(x.selecteur) && decl(x, 'clip-path') !== undefined);
    assert.ok(r, 'masquage visuel de .etiquette absent');
    assert.equal(decl(r, 'width'), '1px');
    assert.equal(decl(r, 'height'), '1px');
    assert.notEqual(decl(r, 'display'), 'none');
  });

  it('« Ce qui me concerne » masqué par défaut, affiché sous Gros caractères', () => {
    assert.equal(decl(reglesNiveaux.find((x) => x.selecteur === '.concerne-aine'), 'display'), 'none');
    assert.equal(decl(reglesNiveaux.find((x) => x.selecteur === `${AINE} .concerne-aine`), 'display'), 'block');
  });

  it('mode contraste forcé et jamais de réordonnancement CSS', () => {
    assert.match(NIVEAUX_CSS, /@media \(forced-colors: active\)/);
    for (const x of reglesNiveaux) assert.ok(!x.declarations.some((d) => d.prop === 'order'), `${x.selecteur} { order }`);
  });
});

// ---------------------------------------------------------------------------
// enfant.css : mots du glossaire en popover, liste « Mots expliqués » (plan 04-07)
// ---------------------------------------------------------------------------

const ENFANT_CSS = sourcesCss.find((s) => s.fichier === 'enfant.css')?.texte ?? '';
const reglesEnfant = regles.filter((r) => r.fichier === 'enfant.css');
const selEnfant = (sel: string): Regle | undefined => reglesEnfant.find((x) => x.selecteur.split(/\s*,\s*/).includes(sel));

describe('styles : glossaire enfant', () => {
  it('enfant.css existe', () => {
    assert.ok(ENFANT_CSS !== '', 'src/styles/enfant.css absent');
  });

  it('.terme : pointillé de 2px, décalé de 4px, zone de 24 px (padding-block: 0.25rem)', () => {
    const r = selEnfant('.terme');
    assert.ok(r, 'règle .terme absente');
    assert.match(decl(r, 'text-decoration') ?? '', /underline dotted/);
    assert.equal(decl(r, 'text-decoration-thickness'), '2px');
    assert.equal(decl(r, 'text-underline-offset'), '4px');
    assert.equal(decl(r, 'padding-block'), '0.25rem');
  });

  it('.terme::after : « ? » ASCII dessiné en CSS, déclaration simple puis variante à texte alternatif vide', () => {
    const r = selEnfant('.terme::after');
    assert.ok(r, 'règle .terme::after absente');
    const contenus = r.declarations.filter((d) => d.prop === 'content').map((d) => d.valeur);
    assert.deepEqual(contenus, ['"?"', '"?" / ""']);
    assert.equal(decl(r, 'font-size'), '0.75em');
  });

  it('aucune valeur `content:` ne contient de caractère hors ASCII (ni ⓘ, ni emoji)', () => {
    for (const { fichier, texte } of sourcesCss) {
      for (const m of texte.matchAll(/content\s*:\s*([^;}]*)/g)) {
        assert.ok(/^[\x20-\x7E]*$/.test(m[1] ?? ''), `${fichier} : content: ${m[1]}`);
      }
    }
  });

  it("l'état ouvert du terme repose sur :popover-open (aria-expanded n'est pas reflété dans le DOM)", () => {
    const r = reglesEnfant.find((x) => /\.terme:has\(\+ \.definition:popover-open\)/.test(x.selecteur));
    assert.ok(r, 'règle d’état ouvert absente');
    assert.equal(decl(r, 'background'), 'var(--panneau)');
  });

  it('.definition : boîte du UI-SPEC, sans display (la feuille UA gère l’ouverture), fond de page assombri', () => {
    const r = selEnfant('.definition');
    assert.ok(r, 'règle .definition absente');
    assert.equal(decl(r, 'background'), 'var(--carte)');
    assert.equal(decl(r, 'border'), '2px solid var(--encre)');
    assert.equal(decl(r, 'border-radius'), '4px');
    assert.equal(decl(r, 'padding'), '1rem');
    assert.equal(decl(r, 'max-width'), 'min(calc(100vw - 2rem), 24rem)');
    assert.equal(decl(r, 'max-height'), '80vh');
    assert.equal(decl(r, 'overflow'), 'auto');
    assert.equal(decl(r, 'font-size'), 'var(--t-corps)');
    assert.ok(!r.declarations.some((d) => d.prop === 'display'), '.definition ne fixe pas display');
    assert.ok(selEnfant('.definition::backdrop'), '::backdrop absent');
  });

  it('repli : @supports not selector(:popover-open) masque .definition et montre l’aide', () => {
    assert.match(ENFANT_CSS, /@supports not selector\(:popover-open\)/);
    const bloc = ENFANT_CSS.slice(ENFANT_CSS.indexOf('@supports not selector(:popover-open)'));
    const internes = [...bloc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].slice(0, 4).map((m) => ({
      sel: (m[1] ?? '').trim().replace(/\s+/g, ' '),
      corps: m[2] ?? '',
    }));
    assert.ok(internes.some((b) => b.sel === '.definition' && /display:\s*none/.test(b.corps)), '.definition masqué');
    assert.ok(internes.some((b) => b.sel === '.terme::after' && /content:\s*none/.test(b.corps)), 'marqueur retiré');
    assert.ok(internes.some((b) => b.sel === '.terme' && /text-decoration:\s*none/.test(b.corps)), 'terme sans soulignement');
    assert.ok(internes.some((b) => b.sel === '.mots-aide-repli' && /display:\s*block/.test(b.corps)), 'aide affichée');
    assert.equal(decl(selEnfant('.mots-aide-repli'), 'display'), 'none', 'aide masquée par défaut');
  });

  it('« Mots expliqués » et son aide masqués hors du niveau enfant, sans casser les navigateurs sans :has()', () => {
    const r = selEnfant('.lecteur:not(:has(> .niveaux #niv-enfant:checked)) .mots-expliques');
    assert.ok(r, 'règle de masquage absente');
    assert.equal(decl(r, 'display'), 'none');
    const aide = selEnfant('.lecteur:not(:has(> .niveaux #niv-enfant:checked)) .mots-aide-repli');
    assert.ok(aide, 'l’aide de repli suit le même interrupteur');
    assert.equal(decl(aide, 'display'), 'none');
  });

  it('summary de 44 px minimum et contraste forcé', () => {
    const r = selEnfant('details.mots-expliques summary');
    assert.ok(r, 'règle summary absente');
    assert.equal(decl(r, 'min-height'), '2.75rem');
    assert.match(ENFANT_CSS, /@media \(forced-colors: active\)/);
  });
});
