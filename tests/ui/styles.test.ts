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
