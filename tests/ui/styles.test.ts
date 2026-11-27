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

// Contrat 10.2 (UI-SPEC §4.1) : palette de la charte D, valeurs en majuscules ; --bord-fort sort de la liste.
const JETONS_COULEUR: Record<string, string> = {
  '--fond': '#FFFFFF',
  '--carte': '#FFFFFF',
  '--panneau': '#F3F5FC',
  '--encre': '#161A2B',
  '--encre-douce': '#3B4263',
  '--vide': '#3B4263',
  '--bord-carte': '#7C83A3',
  '--nuit': '#101C4C',
  '--lien-fort': '#16308F',
  '--rouge': '#C1121F',
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

describe('styles : pages institutionnelles', () => {
  it('« Détails techniques » : summary qui garde son marqueur natif, cible de 44 px (WR-05)', () => {
    const r = regles.find((x) => x.fichier === 'pages.css' && x.selecteur === '.texte-institutionnel summary');
    assert.ok(r, 'règle .texte-institutionnel summary absente');
    const d = (prop: string): string | undefined => r.declarations.find((x) => x.prop === prop)?.valeur;
    assert.equal(d('display'), 'list-item', 'display autre que list-item : plus de ::marker');
    assert.equal(d('min-height'), '2.75rem');
    for (const x of regles.filter((y) => /summary/.test(y.selecteur) && /texte-institutionnel/.test(y.selecteur))) {
      for (const decl of x.declarations) {
        assert.ok(!(decl.prop === 'list-style' || decl.prop === 'list-style-type') || !/none/.test(decl.valeur), `${x.selecteur} masque le marqueur`);
      }
    }
  });
});

// Finitions 09.1 (lot A) : césure réservée aux noms et titres, survol sous (hover: hover), barre du thème, statut.
describe('finitions 09.1 : contrat CSS', () => {
  const decl = (selecteur: string, prop: string): string | undefined =>
    regles
      .filter((r) => r.selecteur === selecteur)
      .flatMap((r) => r.declarations)
      .find((d) => d.prop === prop)?.valeur;

  it('hyphens: auto seulement sur titres, noms, étiquettes de contrôle (contrat : noms, titres et adresses)', () => {
    const avecCesure = regles
      .filter((r) => r.declarations.some((d) => d.prop === 'hyphens' && d.valeur === 'auto'))
      .map((r) => r.selecteur)
      .sort();
    assert.deepEqual(avecCesure, ['.ligne-nom', '.niveau label', '.ordre-option label', '.tuile-lien', 'h1, h2, h3, h4']);
    for (const s of avecCesure) {
      assert.ok(!/\.mesure|\.redaction|\.definition|\.mots-expliques|\.vide|\.source/.test(s), `césure sur ${s}`);
    }
    for (const r of regles) {
      if (/\.mesure(?![-\w])|\.redaction|\.definition|\.mots-expliques/.test(r.selecteur)) {
        assert.ok(
          !r.declarations.some((d) => d.prop === 'hyphens' && d.valeur !== 'manual'),
          `${r.selecteur} déclare hyphens`,
        );
      }
    }
  });

  it('chaque règle :hover est dans @media (hover: hover) (pas de survol collant au toucher)', () => {
    const trouvees: { selecteur: string; media: boolean }[] = [];
    for (const { texte } of sourcesCss) {
      const pile: string[] = [];
      let prelude = '';
      for (const c of texte) {
        if (c === '{') {
          pile.push(prelude.trim().replace(/\s+/g, ' '));
          if (/:hover/.test(prelude) && !prelude.trim().startsWith('@')) {
            trouvees.push({
              selecteur: prelude.trim().replace(/\s+/g, ' '),
              media: pile.slice(0, -1).some((p) => /^@media\b/.test(p) && /\(hover:\s*hover\)/.test(p)),
            });
          }
          prelude = '';
        } else if (c === '}') {
          pile.pop();
          prelude = '';
        } else if (c === ';') {
          prelude = '';
        } else prelude += c;
      }
    }
    assert.deepEqual(
      trouvees.map((t) => t.selecteur).sort(),
      ['.bouton:hover', '.niveau:hover label', '.ordre-option:hover label', '.site-nom:hover', 'a:hover'],
    );
    for (const t of trouvees) assert.ok(t.media, `${t.selecteur} hors @media (hover: hover)`);
  });

  it('la barre de couleur du thème est sur .theme-entete, pas sur main', () => {
    assert.equal(decl('main[data-theme]', 'border-top'), undefined);
    assert.equal(decl('.theme-entete', 'border-top'), '8px solid var(--theme)');
    assert.ok(ESPACES.has(decl('.theme-entete', 'padding-top') ?? ''), 'padding-top de .theme-entete hors échelle');
  });

  it('le bloc de statut prend la largeur du contenu', () => {
    assert.equal(decl('.statut', 'max-width'), undefined);
  });

  it('.redaction et .definition passent à la ligne sans césure (overflow-wrap: anywhere)', () => {
    assert.equal(decl('.redaction', 'overflow-wrap'), 'anywhere');
    assert.equal(decl('.definition', 'overflow-wrap'), 'anywhere');
  });
});

// Finitions visuelles 09.1, proposition 4 (audit B6) : grille sans grands vides. Remplace la hauteur égale par rangée de
// 04-UI-SPEC §C4 (verrouillé ; M1-08 ne dit que « taille fixe ») : acceptée par Erwan le 2026-11-13 (amendement d'ADR-034). Chaque carte garde sa structure en colonne (C4).
describe('styles : grille M1-08 09.1, cartes à leur hauteur', () => {
  const valeur = (selecteur: string, prop: string): string | undefined =>
    regles
      .filter((r) => r.fichier === 'base.css' && r.selecteur === selecteur)
      .flatMap((r) => r.declarations)
      .find((d) => d.prop === prop)?.valeur;

  it('.cellules aligne les cartes en haut de leur rangée (align-items: start)', () => {
    assert.equal(valeur('.cellules', 'align-items'), 'start');
  });

  it('.cellule reste une colonne flex (zones de la carte inchangées)', () => {
    assert.equal(valeur('.cellule', 'display'), 'flex');
    assert.equal(valeur('.cellule', 'flex-direction'), 'column');
  });

  // IN-05 (revue 09.1) : la carte a la hauteur de son contenu, une marge automatique ne pousse plus le pied en bas.
  it('IN-05 : .cellule-pied sans marge automatique, marges à zéro', () => {
    assert.equal(valeur('.cellule-pied', 'margin'), '0');
  });

  // IN-05 : la phrase de signalement n'est plus rendue que dans le pied, où .pied .signalement-intro fixe marge et couleur.
  it('IN-05 : .signalement-intro ne garde que sa taille ; marge et couleur viennent de .pied .signalement-intro', () => {
    const base = regles.filter((r) => r.fichier === 'base.css' && r.selecteur === '.signalement-intro').flatMap((r) => r.declarations);
    assert.deepEqual(base.map((d) => d.prop), ['font-size']);
    assert.equal(valeur('.pied .signalement-intro', 'margin'), '0 0 1rem');
    assert.equal(valeur('.pied .signalement-intro', 'color'), 'var(--carte)');
  });
});

describe('charte 10.2 : jetons et interdits', () => {
  it('(f) la pile des titres est une pile de polices système', () => {
    assert.equal(valeurRoot('--police-titres'), '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif');
  });

  it('(g) les trois rayons sont des jetons', () => {
    assert.equal(valeurRoot('--rayon-carte'), '0.875rem');
    assert.equal(valeurRoot('--rayon-bloc'), '0.625rem');
    assert.equal(valeurRoot('--rayon-pastille'), '1.5rem');
  });

  it('--bord-fort et --picto-fond ne sont ni définis ni employés', () => {
    assert.equal(valeurRoot('--bord-fort'), undefined);
    assert.equal(valeurRoot('--picto-fond'), undefined);
    for (const { fichier, texte } of sourcesCss) {
      assert.ok(!/--bord-fort|--picto-fond/.test(texte), `${fichier} cite un jeton supprimé`);
    }
  });

  it('(d) aucune casse forcée, aucun dégradé linéaire, aucune police ni ressource externe', () => {
    for (const { fichier, texte } of sourcesCss) {
      for (const interdit of [/text-transform:\s*uppercase/, /small-caps/, /linear-gradient/, /@font-face/, /url\(/, /@import/]) {
        assert.ok(!interdit.test(texte), `${fichier} : ${interdit}`);
      }
      assert.ok(!/letter-spacing:\s*\+?(?:0?\.\d*[1-9]|[1-9])/.test(texte), `${fichier} : letter-spacing positif`);
    }
  });

  it('(h) aucune couleur en dur hors :root et [data-theme], sauf le voile de la définition', () => {
    for (const r of regles) {
      if (r.selecteur === ':root' || r.selecteur.startsWith('[data-theme=')) continue;
      for (const d of r.declarations) {
        if (r.selecteur === '.definition::backdrop' && d.prop === 'background') {
          assert.equal(d.valeur, 'rgba(22, 26, 43, 0.4)');
          continue;
        }
        assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(d.valeur), `${r.fichier} ${r.selecteur} { ${d.prop}: ${d.valeur} }`);
      }
    }
  });
});

describe('charte 10.2 : titres et rouge', () => {
  const R1 = 'main h2:not(.section-titre)::after';
  const parSel = (sel: string): Regle | undefined => regles.find((r) => r.selecteur === sel);

  it('(a) le rouge est en liste fermée : R-1 à R-3, R-5 (surtitre), R-6 (bloc 2027), R-7 (étiquettes de garanties), R-4 (numéros des tuiles)', () => {
    const emplois = new Set(regles.filter((r) => r.declarations.some((d) => /var\(--rouge\)/.test(d.valeur))).map((r) => r.selecteur));
    assert.deepEqual(
      [...emplois].sort(),
      [R1, '.site-sous-titre', ':where(.hall-candidats, .hall-methode) a', '.hall-surtitre', '.hall-annee', '.garantie-titre', '.tuile-num'].sort(),
    );
    assert.equal(decl(parSel('.tuile-num'), 'color'), 'var(--rouge)');
    assert.equal(decl(parSel('.tuile-avenir .tuile-num'), 'color'), 'var(--encre-douce)');
    assert.equal(decl(parSel('.hall-surtitre'), 'border-inline-start'), '4px solid var(--rouge)');
    const annee = regles.filter((r) => r.selecteur === '.hall-annee').flatMap((r) => r.declarations);
    assert.equal(annee.find((d) => d.prop === 'border-inline-start')?.valeur, '4px solid var(--rouge)');
    assert.equal(decl(parSel('.garantie-titre'), 'border-bottom'), '3px solid var(--rouge)');
  });

  it('(b) le rouge ne touche ni mesure, ni carte, ni statut, ni titre de section ; filet R-1 exact', () => {
    for (const r of regles) {
      if (!r.declarations.some((d) => /var\(--rouge\)/.test(d.valeur))) continue;
      const sel = r.selecteur.replace(/:not\(\.section-titre\)/g, '');
      for (const interdit of ['.cellule', '.mesure', '.statut', '.ligne', '.vide', '.badge', '.pied', 'h1', '.section-titre', '.picto', '.bouton', '.tuile-lire', '.tuile-avenir']) {
        assert.ok(!sel.includes(interdit), `${r.selecteur} emploie le rouge avec ${interdit}`);
      }
    }
    const r1 = parSel(R1);
    assert.ok(r1, 'règle R-1 absente');
    assert.equal(decl(r1, 'content'), '""');
    assert.equal(decl(r1, 'position'), 'absolute');
    assert.equal(decl(r1, 'inline-size'), '4rem');
    assert.equal(decl(r1, 'block-size'), '0.25rem');
    assert.equal(decl(r1, 'inset-block-start'), 'calc(100% + 0.25rem)');
    assert.equal(decl(r1, 'inset-inline-start'), '0');
    assert.equal(decl(r1, 'background'), 'var(--rouge)');
    assert.equal(decl(parSel('main h2:not(.section-titre)'), 'position'), 'relative');
  });

  it('(c) la police des titres va aux h1 et h2 seulement', () => {
    assert.equal(decl(parSel('h1, h2'), 'font-family'), 'var(--police-titres)');
    for (const r of regles) {
      if (r.selecteur === ':root' || !r.declarations.some((d) => /--police-titres/.test(d.valeur))) continue;
      for (const s of r.selecteur.split(/\s*,\s*/)) {
        assert.ok(!/(^|[\s>])(h3|h4)$|\.mesure-titre/.test(s), `${s} reçoit la police des titres`);
      }
    }
  });

  it('(d) aucune couleur de texte à la couleur du thème (T-05)', () => {
    for (const r of regles) {
      for (const d of r.declarations) {
        if (d.prop === 'color') assert.notEqual(d.valeur, 'var(--theme)', `${r.selecteur} { color: var(--theme) }`);
      }
    }
  });

  it('(e) en-tête et tuiles de la charte D', () => {
    assert.equal(decl(parSel('.entete'), 'border-bottom'), '3px solid var(--nuit)');
    const t = parSel('.tuile');
    assert.equal(decl(t, 'border'), '2px solid var(--nuit)');
    assert.equal(decl(t, 'border-radius'), 'var(--rayon-carte)');
    assert.equal(decl(t, 'border-inline-start'), '8px solid var(--theme)');
    assert.equal(decl(parSel('.tuile-lien'), 'font-size'), 'var(--t-titre)');
  });
});

describe('charte 10.2 : contrôles et cartes', () => {
  const premiere = (fichier: string, sel: string): Regle | undefined => regles.find((r) => r.fichier === fichier && r.selecteur === sel);
  const parSel = (sel: string): Regle | undefined => regles.find((r) => r.fichier === 'base.css' && r.selecteur === sel);

  it('(1) pastilles de niveau et d\'ordre : cadre, rayon, état choisi, jamais nowrap', () => {
    for (const [fichier, base, choisi] of [
      ['niveaux.css', '.niveau label', '.niveau input:checked + label'],
      ['ordre.css', '.ordre-option label', '.ordre-option input:checked + label'],
    ] as const) {
      const p = premiere(fichier, base);
      assert.equal(decl(p, 'border'), '2px solid var(--nuit)', base);
      assert.equal(decl(p, 'border-radius'), 'var(--rayon-pastille)', base);
      assert.equal(decl(p, 'color'), 'var(--nuit)', base);
      assert.equal(decl(p, 'min-height'), '2.75rem', base);
      const c = premiere(fichier, choisi);
      assert.equal(decl(c, 'background'), 'var(--nuit)', choisi);
      assert.equal(decl(c, 'border-color'), 'var(--nuit)', choisi);
      assert.equal(decl(c, 'color'), 'var(--carte)', choisi);
      for (const r of regles.filter((x) => x.fichier === fichier && x.selecteur.includes('label'))) {
        assert.ok(!r.declarations.some((d) => d.prop === 'white-space' && d.valeur === 'nowrap'), `${r.selecteur} : nowrap`);
      }
    }
  });

  it('(2) .cellule : cadre unique sans couleur de thème ni état (règle 4)', () => {
    const c = parSel('.cellule');
    assert.equal(decl(c, 'border'), '2px solid var(--nuit)');
    assert.equal(decl(c, 'border-radius'), 'var(--rayon-carte)');
    assert.ok(!c?.declarations.some((d) => d.prop === 'border-top'), 'border-top sur .cellule');
    assert.ok(!c?.declarations.some((d) => d.valeur.includes('var(--theme)')), 'var(--theme) sur .cellule');
    for (const r of regles) {
      if (!/\.cellule|\.vide/.test(r.selecteur)) continue;
      assert.ok(!/data-etat|data-statut-relecture/.test(r.selecteur), `${r.selecteur} dépend de l'état`);
    }
  });

  it('(3) nom du candidat en empattements', () => {
    assert.equal(decl(parSel('.cellule-nom'), 'font-family'), 'var(--police-titres)');
  });

  it('(4) .vide sans boîte et hors forced-colors', () => {
    const v = parSel('.vide');
    assert.equal(decl(v, 'background'), 'none');
    assert.equal(decl(v, 'border'), '0');
    assert.equal(decl(v, 'padding'), '0');
    assert.equal(decl(v, 'color'), 'var(--vide)');
    assert.ok(!regles.some((r) => r.selecteur.split(/\s*,\s*/).includes('.vide') && decl(r, 'border') === '1px solid CanvasText'));
  });

  it('(5) « Ce qui me concerne » cadré', () => {
    const r = premiere('niveaux.css', '.concerne-liste li');
    const props = r?.declarations.map((d) => d.prop) ?? [];
    assert.equal(decl(r, 'border'), '2px solid var(--nuit)');
    assert.ok(props.indexOf('border') < props.indexOf('border-inline-start'));
    assert.equal(decl(r, 'border-inline-start'), '8px solid var(--theme)');
    assert.equal(decl(r, 'border-radius'), 'var(--rayon-bloc)');
  });
});

describe('charte 10.2 : contenu sourcé et pied', () => {
  const sel = (fichier: string, s: string): Regle | undefined => regles.find((r) => r.fichier === fichier && r.selecteur === s);
  const props = (r: Regle | undefined): string[] => r?.declarations.map((d) => d.prop) ?? [];

  it('(1) .mesure-titre : taille du corps, sans police propre, jamais rouge', () => {
    const r = sel('base.css', '.mesure-titre');
    assert.equal(decl(r, 'font-size'), 'var(--t-corps)');
    assert.ok(!props(r).includes('font-family'));
    assert.ok(!r?.declarations.some((d) => d.valeur.includes('--rouge')));
  });

  it('(2) .relecture en encre, graisse 600', () => {
    const r = sel('base.css', '.relecture');
    assert.equal(decl(r, 'color'), 'var(--encre)');
    assert.equal(decl(r, 'font-weight'), '600');
  });

  it('(3) .source : encadré teinté à filet gauche, liens forts gras', () => {
    const r = sel('base.css', '.source');
    assert.equal(decl(r, 'background'), 'var(--panneau)');
    assert.equal(decl(r, 'border-inline-start'), '4px solid var(--nuit)');
    assert.equal(decl(r, 'border-radius'), 'var(--rayon-bloc)');
    assert.equal(decl(r, 'padding'), '1rem');
    assert.equal(decl(r, 'color'), 'var(--encre)');
    assert.ok(!props(r).includes('border-top'));
    const a = sel('base.css', '.source a');
    assert.equal(decl(a, 'color'), 'var(--lien-fort)');
    assert.equal(decl(a, 'font-weight'), '600');
    assert.equal(decl(a, 'min-height'), '2.75rem');
    assert.ok(regles.some((x) => x.fichier === 'base.css' && x.selecteur.split(/\s*,\s*/).includes('.source') && decl(x, 'border') === '1px solid CanvasText'));
  });

  it('(4) .statut : filet gauche, rayon, sans max-width', () => {
    const r = sel('pages.css', '.statut');
    const p = props(r);
    assert.equal(decl(r, 'border'), '0');
    assert.ok(p.indexOf('border') < p.indexOf('border-inline-start'));
    assert.equal(decl(r, 'border-inline-start'), '4px solid var(--nuit)');
    assert.equal(decl(r, 'border-radius'), 'var(--rayon-bloc)');
    assert.ok(!p.includes('max-width'));
  });

  it('(5) encadrés repliables : cadre 2 px, rayon, jamais overflow hidden', () => {
    for (const [fichier, d, interieur] of [['base.css', 'details.renonce', 'details.renonce ul'], ['enfant.css', 'details.mots-expliques', 'details.mots-expliques dl']] as const) {
      const r = sel(fichier, d);
      assert.equal(decl(r, 'border'), '2px solid var(--nuit)', d);
      assert.equal(decl(r, 'border-radius'), 'var(--rayon-bloc)', d);
      assert.equal(decl(sel(fichier, interieur), 'border-radius'), '0 0 0.5rem 0.5rem', interieur);
    }
    for (const r of regles.filter((x) => /details\./.test(x.selecteur))) {
      assert.ok(!r.declarations.some((x) => x.prop === 'overflow' && x.valeur === 'hidden'), r.selecteur);
    }
  });

  it('(6) .pied bleu nuit, texte blanc, liens blancs gras, focus blanc', () => {
    const r = sel('base.css', '.pied');
    assert.equal(decl(r, 'background'), 'var(--nuit)');
    assert.equal(decl(r, 'color'), 'var(--carte)');
    assert.equal(decl(r, 'border-top'), '0');
    const a = sel('base.css', '.pied a');
    assert.equal(decl(a, 'color'), 'var(--carte)');
    assert.equal(decl(a, 'font-weight'), '600');
    const f = sel('base.css', '.pied :focus-visible');
    assert.equal(decl(f, 'outline-color'), 'var(--carte)');
    assert.equal(decl(f, 'box-shadow'), '0 0 0 2px var(--nuit)');
  });

  it('(7) toute ombre portée est une règle de focus', () => {
    for (const r of regles) {
      if (r.declarations.some((d) => d.prop === 'box-shadow')) assert.ok(r.selecteur.includes('focus'), r.selecteur);
    }
  });

  it('(8) .lignes : filet haut de 2 px bleu nuit', () => {
    assert.equal(decl(sel('pages.css', '.lignes'), 'border-top'), '2px solid var(--nuit)');
  });
});

// ---------------------------------------------------------------------------
// 10.4 : haut de l'accueil, aplats de bleu nuit, titre principal par paliers (P-09)
// ---------------------------------------------------------------------------

/** Règles avec la pile de préludes @media qui les enveloppent (même parcours que le test du survol). */
const reglesMedia: { fichier: string; selecteur: string; media: string[]; declarations: { prop: string; valeur: string }[] }[] = [];
for (const { fichier, texte } of sourcesCss) {
  const pile: string[] = [];
  let prelude = '';
  let corps = '';
  let dedans = false;
  for (const c of texte) {
    if (c === '{') {
      const p = prelude.trim().replace(/\s+/g, ' ');
      pile.push(p);
      prelude = '';
      dedans = !p.startsWith('@');
      corps = '';
    } else if (c === '}') {
      if (dedans) {
        const selecteur = pile[pile.length - 1] ?? '';
        const declarations = corps
          .split(';')
          .map((d) => d.trim())
          .filter((d) => d !== '')
          .map((d) => {
            const i = d.indexOf(':');
            return { prop: d.slice(0, i).trim().toLowerCase(), valeur: d.slice(i + 1).trim() };
          });
        reglesMedia.push({ fichier, selecteur, media: pile.slice(0, -1).filter((x) => x.startsWith('@media')), declarations });
      }
      pile.pop();
      dedans = false;
      prelude = '';
      corps = '';
    } else if (dedans) corps += c;
    else if (c === ';') prelude = '';
    else prelude += c;
  }
}

describe('10.4 : haut de l\'accueil, aplats, contraste forcé', () => {
  it('aplats de bleu nuit en liste fermée', () => {
    const sels = new Set(
      regles
        .filter((r) => r.declarations.some((d) => (d.prop === 'background' || d.prop === 'background-color') && d.valeur === 'var(--nuit)'))
        .map((r) => r.selecteur),
    );
    assert.deepEqual(
      [...sels].sort(),
      ['.skip-link', '.pied', '.niveau input:checked + label', '.ordre-option input:checked + label', '.bouton', '.tuile-lire'].sort(),
    );
  });

  it('contraste forcé : bande des garanties, bouton et pastille gardent un cadre, tuile à venir un cadre de texte', () => {
    const tav = reglesMedia.find((x) => x.media.some((m) => /forced-colors:\s*active/.test(m)) && x.selecteur.split(/\s*,\s*/).includes('.tuile-avenir'));
    assert.ok(tav, 'règle forced-colors pour .tuile-avenir');
    assert.equal(tav.declarations.find((d) => d.prop === 'border-color')?.valeur, 'CanvasText');
    for (const cle of ['.garanties', '.bouton', '.tuile-lire']) {
      const r = reglesMedia.find(
        (x) => x.media.some((m) => /forced-colors:\s*active/.test(m)) && x.selecteur.split(/\s*,\s*/).includes(cle),
      );
      assert.ok(r, `règle forced-colors pour ${cle}`);
      assert.equal(r.declarations.find((d) => d.prop === 'border')?.valeur, '1px solid CanvasText');
    }
  });

  it('tuiles à venir pleines (règle 8)', () => {
    const r = regles.find((x) => x.selecteur === '.tuile-avenir');
    assert.ok(r, '.tuile-avenir');
    assert.equal(decl(r, 'background'), 'var(--panneau)');
    assert.equal(decl(r, 'border'), '2px solid var(--bord-carte)');
    assert.equal(decl(r, 'border-radius'), 'var(--rayon-carte)');
    for (const x of regles.filter((y) => y.selecteur.includes('.tuile-avenir'))) {
      for (const d of x.declarations) {
        assert.doesNotMatch(d.valeur, /dashed|dotted|var\(--theme\)/, `${x.selecteur} ${d.prop}`);
      }
    }
    const nom = regles.find((x) => x.selecteur === '.tuile-avenir-nom');
    assert.equal(decl(nom, 'font-size'), 'var(--t-titre)');
    assert.equal(decl(nom, 'font-family'), 'var(--police-titres)');
  });

  it('le titre du haut de l\'accueil garde la césure manuelle (hyphens: manual)', () => {
    const r = regles.find((x) => x.selecteur === '.hall-tete h1');
    assert.ok(r, '.hall-tete h1');
    assert.equal(r.declarations.find((d) => d.prop === 'hyphens')?.valeur, 'manual');
  });
});

describe('10.4 : titre principal par paliers (P-09)', () => {
  const GROS = 'main:has(> .lecteur > .niveaux #niv-aine:checked)';
  const MQ37 = '@media (min-width: 37.5em)';
  const MQ60 = '@media (min-width: 60em)';
  const jeton = (sel: string, media: string | null): string | undefined => {
    const r = reglesMedia.filter((x) => x.selecteur === sel && (media === null ? x.media.length === 0 : x.media.join(' ') === media));
    return r.flatMap((x) => x.declarations).find((d) => d.prop === '--t-affiche')?.valeur;
  };
  const rem = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN');

  it('paliers du jeton --t-affiche : 2, 2.5, 3 rem ; Gros caractères 2.25, 2.75, 3.25 rem', () => {
    assert.equal(JETONS_TYPE['--t-affiche'], '2rem');
    assert.equal(valeurRoot('--t-affiche'), '2rem');
    assert.equal(jeton(':root', MQ37), '2.5rem');
    assert.equal(jeton(':root', MQ60), '3rem');
    assert.equal(jeton(GROS, null), '2.25rem');
    assert.equal(jeton(GROS, MQ37), '2.75rem');
    assert.equal(jeton(GROS, MQ60), '3.25rem');
    for (const [n, g] of [[jeton(':root', null), jeton(GROS, null)], [jeton(':root', MQ37), jeton(GROS, MQ37)], [jeton(':root', MQ60), jeton(GROS, MQ60)]] as const) {
      assert.ok(rem(g) > rem(n), `Gros caractères (${g}) plus grand que normal (${n})`);
    }
  });

  it('seules :root et la règle Gros caractères posent un jeton --t-*, et sous media seulement --t-affiche', () => {
    for (const r of reglesMedia) {
      const jetons = r.declarations.filter((d) => /^--t-/.test(d.prop));
      if (jetons.length === 0) continue;
      assert.ok(r.selecteur === ':root' || r.selecteur === GROS, `${r.selecteur} pose un jeton --t-*`);
      if (r.media.length > 0) assert.deepEqual(jetons.map((d) => d.prop), ['--t-affiche'], `${r.selecteur} sous media`);
    }
  });

  it('aucune valeur de jeton --t-* ne dépend de la fenêtre (vw, vh, clamp, calc, em seul)', () => {
    for (const r of reglesMedia) {
      for (const d of r.declarations) {
        if (!/^--t-/.test(d.prop)) continue;
        assert.ok(!/vw|vh|clamp|calc/.test(d.valeur) && !/(?<!r)em\b/.test(d.valeur), `${r.selecteur} { ${d.prop}: ${d.valeur} }`);
      }
    }
  });
});
