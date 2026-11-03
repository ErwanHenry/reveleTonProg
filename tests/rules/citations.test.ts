import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { countWords } from '../../src/lib/content-core/rules/text/words.ts';
import { comparer, construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { DiagnosticPiege, ElementAttendu, PiegeSpec, Remplacement } from '../helpers/overlay.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const SOURCE = 'src/content/sources/marie-fictive-programme.yaml';
const ARCHIVE = 'archives/marie-fictive/23c5f1cc8eff.txt';
const SHA = '23c5f1cc8eff56b2cb3581489929653742d60d472bf77d8aa83020cc99a7993e';
const TEXTE = 'Nous encadrerons les loyers dans toutes les villes de plus de 50 000 habitants, avec un plafond fixé chaque année par le préfet.';

const CODES = new Set([
  'CHIFFRE_HORS_SOURCE',
  'CHIFFRE_DETAILLE_HORS_SOURCE',
  'NOMBRE_LETTRES_HORS_SOURCE',
  'CITATION_HORS_SOURCE',
  'TEXTE_SOURCE_HORS_ARCHIVE',
  'CHIFFRAGE_HORS_ARCHIVE',
  'TEXTE_SOURCE_TROP_COURT',
  'TEXTE_SOURCE_TROP_LONG',
]);

const r = (fichier: string, de: string, par: string): Remplacement => ({ fichier, de, par });
const spec = (remplacer: Remplacement[], extra: Partial<PiegeSpec> = {}): PiegeSpec => ({
  piege: 'unitaire',
  regle: 'REGLE-04',
  mode: 'production',
  remplacer,
  attendu: [],
  ...extra,
});
const err = (code: string, pointer: string, fichier = MESURE): ElementAttendu => ({ code, severite: 'error', fichier, pointer });
const warn = (code: string, pointer: string, fichier = MESURE): ElementAttendu => ({ code, severite: 'warning', fichier, pointer });

/** Diagnostics (tous codes) après patchs en mémoire. */
const tous = (remplacer: Remplacement[], extra: Partial<PiegeSpec> = {}): DiagnosticPiege[] => executerPiege(spec(remplacer, extra));
/** Diagnostics de la famille « citations » seulement (les patchs touchent parfois d'autres familles). */
const citations = (remplacer: Remplacement[]): DiagnosticPiege[] => tous(remplacer).filter((d) => CODES.has(d.code));

/** Comme `tous`, mais ajoute `ajout` à l'archive et recalcule son sha256 dans la source. */
function avecArchive(remplacer: Remplacement[], ajout: string): DiagnosticPiege[] {
  const racine = construireRacine(spec(remplacer));
  const fichier = path.join(racine, ARCHIVE);
  appendFileSync(fichier, ajout);
  const sha = createHash('sha256').update(readFileSync(fichier)).digest('hex');
  const src = path.join(racine, SOURCE);
  writeFileSync(src, readFileSync(src, 'utf8').replace(SHA, sha));
  const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'production' });
  return res.diagnostics.map((d) => ({
    code: d.code,
    severite: d.severity,
    fichier: path.relative(racine, d.file).split(path.sep).join('/'),
    pointer: d.pointer,
    ligne: d.line,
  }));
}

describe('REGLE-04 : chiffres', () => {
  it('le corpus de référence ne produit aucun diagnostic de citations', () => {
    comparer(tous([]), []);
  });

  it('résumé : un chiffre absent de la source échoue', () => {
    comparer(
      citations([r(MESURE, 'Marie Fictive propose de plafonner les loyers dans les villes de plus de 50 000 habitants.', 'Marie Fictive propose de plafonner les loyers dans les villes de plus de 30 000 habitants.')]),
      [err('CHIFFRE_HORS_SOURCE', '/redactions/resume')],
    );
  });

  it('WR-03 : détaillé, un chiffre absent de la source avertit (la décision acceptée réserve l’erreur à résumé, enfant, aîné)', () => {
    comparer(
      citations([r(MESURE, 'La mesure concernerait toutes les villes de plus de 50 000 habitants.', 'La mesure concernerait toutes les villes de plus de 30 000 habitants.')]),
      [warn('CHIFFRE_DETAILLE_HORS_SOURCE', '/redactions/detaille')],
    );
  });

  it('WR-03 : titre, un chiffre absent de la source avertit', () => {
    comparer(
      citations([r(MESURE, 'Encadrement des loyers dans les villes moyennes (fictif)', 'Baisse de 30 % des loyers (fictif)')]),
      [warn('CHIFFRE_DETAILLE_HORS_SOURCE', '/titre')],
    );
  });

  it('aîné : un chiffre absent de la source échoue', () => {
    comparer(
      citations([r(MESURE, "Cette règle s'appliquerait dans toutes les villes de plus de 50 000 habitants.", "Cette règle s'appliquerait dans toutes les villes de plus de 30 000 habitants.")]),
      [err('CHIFFRE_HORS_SOURCE', '/redactions/aine')],
    );
  });

  it('un même chiffre répété dans un champ ne produit qu’un diagnostic par champ', () => {
    const d = citations([
      r(MESURE, 'Cela concerne les villes de plus de 50 000 habitants.', 'Cela concerne les villes de plus de 30 000 habitants et de plus de 30 000 personnes.'),
    ]);
    assert.equal(d.filter((x) => x.code === 'CHIFFRE_HORS_SOURCE' && x.pointer === '/redactions/enfant').length, 1);
  });

  it('un chiffre présent seulement dans chiffrage.texte est accepté si chiffrage.texte est dans l’archive', () => {
    const chiffrage = "Coût estimé de 2 milliards d'euros.";
    const d = avecArchive(
      [
        r(MESURE, 'source_localisation: page 3 (fictive)\n', `source_localisation: page 3 (fictive)\nchiffrage:\n  texte: ${chiffrage}\n`),
        r(MESURE, 'Le préfet fixerait le plafond chaque année.', "Coût estimé de 2 milliards d'euros."),
      ],
      `\n\n${chiffrage}\n`,
    );
    comparer(d, []);
  });

  it('chiffrage.texte absent de l’archive : CHIFFRAGE_HORS_ARCHIVE, et le chiffre n’est pas blanchi sans cela', () => {
    const d = tous([
      r(MESURE, 'source_localisation: page 3 (fictive)\n', "source_localisation: page 3 (fictive)\nchiffrage:\n  texte: Coût estimé de 2 milliards d'euros.\n"),
      r(MESURE, 'Le préfet fixerait le plafond chaque année.', "Coût estimé de 2 milliards d'euros."),
    ]);
    comparer(d, [err('CHIFFRAGE_HORS_ARCHIVE', '/chiffrage/texte')]);
  });

  it('un nombre en lettres absent de la source donne un avertissement sur l’enfant', () => {
    comparer(
      citations([r(MESURE, 'Un propriétaire ne pourrait pas demander plus que ce prix.', 'Trois propriétaires ne pourraient pas demander plus que ce prix.')]),
      [warn('NOMBRE_LETTRES_HORS_SOURCE', '/redactions/enfant')],
    );
  });

  it('les marqueurs de glossaire sont remplacés par leur texte affiché avant extraction', () => {
    const base = 'Marie Fictive propose de plafonner les loyers dans les villes de plus de 50 000 habitants.';
    const debut = 'Marie Fictive propose de plafonner les loyers dans les villes de plus de ';
    comparer(citations([r(MESURE, base, `${debut}[[50 000|loyer]] habitants.`)]), []);
    comparer(citations([r(MESURE, base, `${debut}[[30 000|loyer]] habitants.`)]), [err('CHIFFRE_HORS_SOURCE', '/redactions/resume')]);
  });
});

describe('REGLE-04 : citations « … »', () => {
  it('une citation du détaillé absente de texte_source échoue', () => {
    comparer(
      citations([r(MESURE, '« un plafond fixé chaque année par le préfet »', '« un plafond fixé chaque mois par le préfet »')]),
      [err('CITATION_HORS_SOURCE', '/redactions/detaille')],
    );
  });

  it('une citation du résumé absente de texte_source échoue', () => {
    comparer(
      citations([r(MESURE, 'Le préfet fixerait le plafond chaque année.', 'Le préfet fixerait « un plafond mensuel ».')]),
      [err('CITATION_HORS_SOURCE', '/redactions/resume')],
    );
  });

  it('une citation fidèle (ponctuation et casse différentes) passe', () => {
    comparer(citations([r(MESURE, '« un plafond fixé chaque année par le préfet »', '« Un plafond fixé, chaque année, par le préfet. »')]), []);
  });
});

describe('REGLE-05 : texte_source et archive', () => {
  it('un texte_source altéré d’un mot échoue : TEXTE_SOURCE_HORS_ARCHIVE', () => {
    comparer(tous([r(MESURE, 'Nous encadrerons les loyers', 'Nous plafonnerons les loyers')]), [err('TEXTE_SOURCE_HORS_ARCHIVE', '/texte_source')]);
  });

  it('archive supprimée : seulement ARCHIVE_ABSENTE (pas de cascade)', () => {
    comparer(tous([], { supprimer: [ARCHIVE] }), [err('ARCHIVE_ABSENTE', '/archive/extrait', SOURCE)]);
  });

  it('archive altérée (sha256 divergent) : seulement ARCHIVE_SHA256_DIVERGENT', () => {
    const racine = construireRacine(spec([]));
    appendFileSync(path.join(racine, ARCHIVE), '\nUne ligne de plus.\n');
    const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'production' });
    assert.deepEqual(
      res.diagnostics.map((d) => d.code),
      ['ARCHIVE_SHA256_DIVERGENT'],
    );
  });

  it('texte_source de 3 mots : avertissement TROP_COURT (et HORS_ARCHIVE s’il n’est pas dans l’archive)', () => {
    const dansArchive = citations([r(MESURE, `texte_source: ${TEXTE}`, 'texte_source: Nous encadrerons les')]);
    assert.ok(dansArchive.some((d) => d.code === 'TEXTE_SOURCE_TROP_COURT' && d.severite === 'warning' && d.pointer === '/texte_source'));
    assert.ok(!dansArchive.some((d) => d.code === 'TEXTE_SOURCE_HORS_ARCHIVE'));

    const absent = citations([r(MESURE, `texte_source: ${TEXTE}`, 'texte_source: Un texte absent')]);
    assert.ok(absent.some((d) => d.code === 'TEXTE_SOURCE_TROP_COURT' && d.severite === 'warning'));
    assert.ok(absent.some((d) => d.code === 'TEXTE_SOURCE_HORS_ARCHIVE' && d.severite === 'error'));
  });

  it('texte_source de 4 mots : pas d’avertissement de longueur', () => {
    const d = citations([r(MESURE, `texte_source: ${TEXTE}`, 'texte_source: Nous encadrerons les loyers')]);
    assert.ok(!d.some((x) => x.code === 'TEXTE_SOURCE_TROP_COURT'));
  });

  const long = (mots: number): string => {
    const n = mots - countWords(TEXTE);
    assert.ok(n > 0);
    return `${TEXTE} ${Array.from({ length: n }, () => 'alpha').join(' ')}`;
  };

  it('WR-04 : texte_source de 121 mots, fidèle à l’archive : TROP_LONG est une erreur en production', () => {
    const t = long(121);
    assert.equal(countWords(t), 121);
    comparer(avecArchive([r(MESURE, `texte_source: ${TEXTE}`, `texte_source: ${t}`)], `\n\n${t}\n`), [err('TEXTE_SOURCE_TROP_LONG', '/texte_source')]);
  });

  it('WR-04 : le même texte_source n’est qu’un avertissement en preview', () => {
    const t = long(121);
    const racine = construireRacine(spec([r(MESURE, `texte_source: ${TEXTE}`, `texte_source: ${t}`)], { mode: 'preview' }));
    const fichier = path.join(racine, ARCHIVE);
    appendFileSync(fichier, `\n\n${t}\n`);
    const sha = createHash('sha256').update(readFileSync(fichier)).digest('hex');
    const src = path.join(racine, SOURCE);
    writeFileSync(src, readFileSync(src, 'utf8').replace(SHA, sha));
    const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
    assert.deepEqual(res.diagnostics.filter((d) => d.code === 'TEXTE_SOURCE_TROP_LONG').map((d) => d.severity), ['warning']);
  });

  it('texte_source de 120 mots, fidèle à l’archive : aucun diagnostic', () => {
    const t = long(120);
    assert.equal(countWords(t), 120);
    comparer(avecArchive([r(MESURE, `texte_source: ${TEXTE}`, `texte_source: ${t}`)], `\n\n${t}\n`), []);
  });
});
