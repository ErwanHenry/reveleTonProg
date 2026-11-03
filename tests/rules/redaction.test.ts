import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { DiagnosticPiege, Remplacement } from '../helpers/overlay.ts';
import { champsEditoriaux } from '../../src/lib/content-core/rules/redaction.ts';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

after(() => nettoyerRacines());

const BASE = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const GLOSSAIRE = 'src/content/glossaire/loyer.yaml';
const JOURNAL = 'src/content/journal/20261103-001.yaml';
const THEME = 'src/content/themes/logement.yaml';

const CODES = new Set([
  'MOT_INTERDIT',
  'GUILLEMETS_DESEQUILIBRES',
  'VERBE_CONNOTE',
  'CARACTERE_SUSPECT',
  'LONGUEUR_HORS_BORNES',
  'PHRASE_ENFANT_LONGUE',
  'LISIBILITE_ENFANT_FAIBLE',
]);

/** Diagnostics de la famille « redaction » après des patchs en mémoire sur le corpus fictif. */
function diag(remplacer: Remplacement[]): DiagnosticPiege[] {
  return executerPiege({ piege: 'unitaire', regle: 'REGLE-02', remplacer, attendu: [] }).filter((d) => CODES.has(d.code));
}
const r = (fichier: string, de: string, par: string): Remplacement => ({ fichier, de, par });
const ligneDe = (fichier: string, debut: string): number => {
  const i = readFileSync(path.join(BASE, fichier), 'utf8').split('\n').findIndex((l) => l.startsWith(debut));
  assert.ok(i >= 0, `${debut} introuvable dans ${fichier}`);
  return i + 1;
};

describe('redaction : le corpus fictif sain', () => {
  it('ne produit aucun diagnostic de la famille', () => {
    assert.deepEqual(diag([]), []);
  });
});

describe('redaction : MOT_INTERDIT champ par champ', () => {
  it('dans le titre', () => {
    const d = diag([r(MESURE, 'Encadrement des loyers', 'Encadrement extrême des loyers')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer, x.fichier]), [['MOT_INTERDIT', '/titre', MESURE]]);
    assert.equal(d[0]?.ligne, ligneDe(MESURE, 'titre:'));
  });

  it('dans la rédaction aîné', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose d\'encadrer', 'Marie Fictive propose enfin d\'encadrer')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer]), [['MOT_INTERDIT', '/redactions/aine']]);
  });

  it('dans une définition de glossaire', () => {
    const d = diag([r(GLOSSAIRE, 'Le loyer est la somme', 'Le loyer est enfin la somme')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer, x.fichier]), [['MOT_INTERDIT', '/definition', GLOSSAIRE]]);
    assert.equal(d[0]?.ligne, ligneDe(GLOSSAIRE, 'definition:'));
  });

  it('dans le résumé du journal', () => {
    const d = diag([r(JOURNAL, "Ajout d'une mesure fictive de test", "Ajout d'une mesure extrême de test")]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer, x.fichier]), [['MOT_INTERDIT', '/resume', JOURNAL]]);
  });

  it('dans le nom d’un sous-thème', () => {
    const d = diag([r(THEME, 'nom: Loyers', 'nom: Loyers populistes')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer, x.fichier]), [['MOT_INTERDIT', '/sous_themes/0/nom', THEME]]);
    assert.equal(d[0]?.ligne, ligneDe(THEME, '    nom: Loyers'));
  });

  it('dans le nom du thème', () => {
    const d = diag([r(THEME, 'nom: Logement', 'nom: Logement courageux')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer]), [['MOT_INTERDIT', '/nom']]);
  });

  it('un seul diagnostic par mot distinct et par champ', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive propose enfin de plafonner, enfin, les loyers')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer]), [['MOT_INTERDIT', '/redactions/resume']]);
  });

  it('deux mots distincts donnent deux diagnostics', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive propose enfin de plafonner les loyers extrêmes')]);
    assert.equal(d.filter((x) => x.code === 'MOT_INTERDIT').length, 2);
  });

  it('le message cite le mot et reste borné', () => {
    const res = loadAllAvec([r(MESURE, 'Encadrement des loyers', 'Encadrement extrême des loyers')]);
    const m = res.find((x) => x.code === 'MOT_INTERDIT');
    assert.match(m?.message ?? '', /« extrême »/);
  });
});

describe('redaction : exemptions', () => {
  it('texte_source n’est jamais examiné', () => {
    const d = diag([r(MESURE, 'chaque année par le préfet.\nsource:', 'chaque année par le préfet. Enfin, extrême.\nsource:')]);
    assert.deepEqual(d, []);
  });

  it('un mot interdit entre guillemets équilibrés est exempté', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive propose de plafonner « enfin » les loyers')]);
    assert.deepEqual(d, []);
  });
});

describe('redaction : guillemets, verbes, caractères suspects', () => {
  it('un « orphelin donne GUILLEMETS_DESEQUILIBRES sur ce champ', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive « propose de plafonner les loyers')]);
    assert.deepEqual(d.map((x) => [x.code, x.severite, x.pointer]), [['GUILLEMETS_DESEQUILIBRES', 'error', '/redactions/resume']]);
  });

  it('un « orphelin ne cache pas un mot interdit qui le suit', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive « propose enfin de plafonner les loyers')]);
    assert.deepEqual(d.map((x) => x.code).sort(), ['GUILLEMETS_DESEQUILIBRES', 'MOT_INTERDIT']);
  });

  it('un verbe connoté avertit seulement', () => {
    const d = diag([r(MESURE, 'Marie Fictive prévoit d\'encadrer', 'Marie Fictive promet d\'encadrer')]);
    assert.deepEqual(d.map((x) => [x.code, x.severite, x.pointer]), [['VERBE_CONNOTE', 'warning', '/redactions/detaille']]);
  });

  it('un caractère cyrillique dans un mot français est une erreur', () => {
    const d = diag([r(MESURE, 'Marie Fictive propose de plafonner les loyers', 'Marie Fictive propose de plafonner les loy\u0435rs')]);
    assert.deepEqual(d.map((x) => [x.code, x.severite, x.pointer]), [['CARACTERE_SUSPECT', 'error', '/redactions/resume']]);
  });

  it('un contrôle bidirectionnel (U+202E) est une erreur', () => {
    const d = diag([r(MESURE, 'Encadrement des loyers', 'Encadrement des \u202Eloyers')]);
    assert.deepEqual(d.map((x) => [x.code, x.pointer]), [['CARACTERE_SUSPECT', '/titre']]);
  });
});

const fixture = parse(readFileSync(path.join(BASE, MESURE), 'utf8')) as { redactions: Record<'resume' | 'detaille' | 'enfant' | 'aine', string> };
type Niveau = keyof typeof fixture.redactions;

/** Texte de `n` mots (« mot mot … mot. »), pour viser une borne exacte. */
const mots = (n: number): string => `${Array.from({ length: n - 1 }, () => 'mot').join(' ')} mot.`;
const surNiveau = (niveau: Niveau, texte: string): Remplacement[] => [r(MESURE, fixture.redactions[niveau], texte)];
const longueurs = (niveau: Niveau, n: number): DiagnosticPiege[] => diag(surNiveau(niveau, mots(n))).filter((d) => d.code === 'LONGUEUR_HORS_BORNES');

describe('redaction : LONGUEUR_HORS_BORNES aux bornes', () => {
  const cas: [Niveau, number, boolean][] = [
    ['resume', 25, true], ['resume', 26, false],
    ['detaille', 79, false], ['detaille', 80, true], ['detaille', 200, true], ['detaille', 201, false],
    ['enfant', 39, false], ['enfant', 40, true], ['enfant', 60, true], ['enfant', 61, false],
    ['aine', 59, false], ['aine', 60, true], ['aine', 120, true], ['aine', 121, false],
  ];
  for (const [niveau, n, ok] of cas) {
    it(`${niveau} : ${n} mots ${ok ? 'accepté' : 'refusé'}`, () => {
      const d = longueurs(niveau, n);
      if (ok) assert.deepEqual(d, []);
      else assert.deepEqual(d.map((x) => [x.severite, x.pointer]), [['error', `/redactions/${niveau}`]]);
    });
  }

  it('le message donne le décompte et les bornes', () => {
    const racine = construireRacine({ piege: 'unitaire', regle: 'REGLE-03', remplacer: surNiveau('resume', mots(26)), attendu: [] });
    const m = loadAll(racine, { schemasDir: SCHEMAS_DIR }).diagnostics.find((x) => x.code === 'LONGUEUR_HORS_BORNES');
    assert.match(m?.message ?? '', /26 mots, attendu : au plus 25/);
    const racine2 = construireRacine({ piege: 'unitaire', regle: 'REGLE-03', remplacer: surNiveau('detaille', mots(79)), attendu: [] });
    const m2 = loadAll(racine2, { schemasDir: SCHEMAS_DIR }).diagnostics.find((x) => x.code === 'LONGUEUR_HORS_BORNES');
    assert.match(m2?.message ?? '', /79 mots, attendu : entre 80 et 200/);
  });

  it('la ligne est celle de la clé du niveau', () => {
    const d = longueurs('resume', 26);
    assert.equal(d[0]?.ligne, ligneDe(MESURE, '  resume:'));
  });

  it('une longueur hors bornes est une erreur même en brouillon (A4)', () => {
    const d = diag([...surNiveau('resume', mots(26)), r(MESURE, 'statut_relecture: publie', 'statut_relecture: brouillon')]);
    assert.deepEqual(d.filter((x) => x.code === 'LONGUEUR_HORS_BORNES').map((x) => x.severite), ['error']);
  });

  it('un niveau facultatif absent en brouillon ne produit rien', () => {
    const d = diag([
      r(MESURE, 'statut_relecture: publie', 'statut_relecture: brouillon'),
      r(MESURE, `  enfant: >-\n    ${fixture.redactions.enfant}\n`, ''),
      r(MESURE, `  aine: >-\n    ${fixture.redactions.aine}\n`, ''),
    ]);
    assert.deepEqual(d.filter((x) => x.code === 'LONGUEUR_HORS_BORNES'), []);
  });

  it('les marqueurs de glossaire comptent pour leurs mots affichés', () => {
    const base = `${Array.from({ length: 24 }, () => 'mot').join(' ')} [[loyer|loyer]]`;
    assert.deepEqual(diag(surNiveau('resume', base)).filter((x) => x.code === 'LONGUEUR_HORS_BORNES'), []);
    assert.equal(diag(surNiveau('resume', `${base} mot`)).filter((x) => x.code === 'LONGUEUR_HORS_BORNES').length, 1);
  });
});

describe('redaction : champsEditoriaux', () => {
  it('développe * et ignore les champs absents ou non textuels', () => {
    const res = loadAll(BASE, { schemasDir: SCHEMAS_DIR });
    const theme = res.entries.find((e) => e.collection === 'themes');
    assert.ok(theme);
    assert.deepEqual(
      champsEditoriaux(theme).map((c) => c.pointer),
      ['/nom', '/sous_themes/0/nom', '/sous_themes/1/nom'],
    );
    const candidat = res.entries.find((e) => e.collection === 'candidats');
    assert.ok(candidat);
    assert.deepEqual(champsEditoriaux(candidat), []);
  });
});

function loadAllAvec(remplacer: Remplacement[]): { code: string; message: string }[] {
  const racine = construireRacine({ piege: 'unitaire', regle: 'REGLE-02', remplacer, attendu: [] });
  return loadAll(racine, { schemasDir: SCHEMAS_DIR }).diagnostics;
}
