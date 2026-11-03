import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { LoadOptions } from '../../src/lib/content-core/load.ts';
import { FAMILLES } from '../../src/lib/content-core/rules/index.ts';
import { citer } from '../../src/lib/content-core/rules/types.ts';
import type { CorpusRule, EntryRule, FileRule, Famille, Finding, Mode } from '../../src/lib/content-core/rules/types.ts';
import { CATALOGUE, CITER_MAX, HYPOTHESES } from '../../src/lib/content-core/rules/config.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const tmpDirs: string[] = [];
function copie(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-moteur-'));
  tmpDirs.push(dir);
  cpSync(BASE_CORPUS, dir, { recursive: true });
  return dir;
}
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const MESURE_REL = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const CANDIDAT_REL = 'src/content/candidats/marie-fictive.yaml';

const famille = (parties: { fichier?: FileRule[]; entree?: EntryRule[]; corpus?: CorpusRule[] }): Famille => ({
  id: 'test',
  fichier: parties.fichier ?? [],
  entree: parties.entree ?? [],
  corpus: parties.corpus ?? [],
});
const charger = (racine: string, familles: readonly Famille[], mode?: Mode) => {
  const opts: LoadOptions = { schemasDir: SCHEMAS_DIR, familles };
  if (mode !== undefined) opts.mode = mode;
  return loadAll(racine, opts);
};
/** Rend la mesure invalide au schéma (relecteur obligatoire pour une mesure publiée). */
function casserMesure(racine: string): void {
  const f = path.join(racine, MESURE_REL);
  writeFileSync(f, readFileSync(f, 'utf8').replace('relecteur: Erwan Henry\n', ''));
}
const relatif = (racine: string, file: string): string => path.relative(racine, file).split(path.sep).join('/');

describe('moteur : trois niveaux', () => {
  it('une règle de fichier voit tout fichier lu, y compris un fichier invalide au schéma ; une règle d’entrée non', () => {
    const racine = copie();
    casserMesure(racine);
    const fichiers: string[] = [];
    const entrees: string[] = [];
    const res = charger(racine, [
      famille({
        fichier: [{ id: 'f', run: (f) => (fichiers.push(relatif(racine, f.file)), []) }],
        entree: [{ id: 'e', run: (e) => (entrees.push(relatif(racine, e.file)), []) }],
      }),
    ]);
    assert.ok(fichiers.includes(MESURE_REL), 'la règle de fichier doit voir la mesure invalide');
    assert.ok(!entrees.includes(MESURE_REL), 'la règle d’entrée ne doit pas voir la mesure invalide');
    assert.ok(entrees.includes(CANDIDAT_REL));
    assert.equal(fichiers.length, res.files);
    assert.ok(res.diagnostics.some((d) => d.code === 'SCHEMA_REQUIRED'));
  });

  it('une règle de corpus tourne une fois ; listes contient l’id invalide sans cascade', () => {
    const racine = copie();
    casserMesure(racine);
    let appels = 0;
    const vu: Record<string, unknown> = {};
    charger(racine, [
      famille({
        corpus: [
          {
            id: 'c',
            run: (ctx) => {
              appels++;
              vu.liste = ctx.corpus.listes.get('mesures')?.has('marie-fictive/encadrement-loyers');
              vu.entree = ctx.corpus.entree('mesures', 'marie-fictive/encadrement-loyers');
              vu.invalidesMesures = ctx.corpus.aDesInvalides('mesures');
              vu.invalidesCandidats = ctx.corpus.aDesInvalides('candidats');
              vu.candidat = ctx.corpus.entree('candidats', 'marie-fictive')?.id;
              vu.deMesures = ctx.corpus.de('mesures').length;
              return [];
            },
          },
        ],
      }),
    ]);
    assert.equal(appels, 1);
    assert.equal(vu.liste, true);
    assert.equal(vu.entree, undefined);
    assert.equal(vu.invalidesMesures, true);
    assert.equal(vu.invalidesCandidats, false);
    assert.equal(vu.candidat, 'marie-fictive');
    assert.equal(vu.deMesures, 0);
  });

  it('un corpus sain n’a aucun fichier invalide', () => {
    const racine = copie();
    let invalides = true;
    charger(racine, [famille({ corpus: [{ id: 'c', run: (ctx) => ((invalides = ctx.corpus.aDesInvalides('mesures')), []) }] })]);
    assert.equal(invalides, false);
  });
});

describe('moteur : positionnement et sévérité', () => {
  const trouver = (res: ReturnType<typeof loadAll>, code: string) => {
    const d = res.diagnostics.find((x) => x.code === code);
    assert.ok(d, `diagnostic ${code} introuvable : ${JSON.stringify(res.diagnostics.map((x) => x.code))}`);
    return d;
  };

  it('un pointeur est positionné dans le fichier de l’entrée par défaut', () => {
    const racine = copie();
    const mesure = readFileSync(path.join(racine, MESURE_REL), 'utf8').split('\n');
    const ligneTitre = mesure.findIndex((l) => l.startsWith('titre:')) + 1;
    const res = charger(racine, [
      famille({ entree: [{ id: 'e', run: (e) => (e.collection === 'mesures' ? [{ code: 'X_TITRE', pointer: '/titre', message: 'm' }] : []) }] }),
    ]);
    const d = trouver(res, 'X_TITRE');
    assert.equal(relatif(racine, d.file), MESURE_REL);
    assert.equal(d.line, ligneTitre);
    assert.equal(d.severity, 'error');
    assert.equal(d.pointer, '/titre');
  });

  it('un finding peut nommer un autre fichier lu : positionné dans ce fichier', () => {
    const racine = copie();
    const candidat = path.join(racine, CANDIDAT_REL);
    const ligneId = readFileSync(candidat, 'utf8').split('\n').findIndex((l) => l.startsWith('id:')) + 1;
    const res = charger(racine, [
      famille({ corpus: [{ id: 'c', run: () => [{ code: 'X_AUTRE', pointer: '/id', message: 'm', file: candidat }] }] }),
    ]);
    const d = trouver(res, 'X_AUTRE');
    assert.equal(d.file, candidat);
    assert.equal(d.line, ligneId);
  });

  it('`at` est utilisé tel quel ; un fichier non lu sans `at` est en 1:1', () => {
    const racine = copie();
    const lock = path.join(racine, 'ids.lock');
    const res = charger(racine, [
      famille({
        corpus: [
          {
            id: 'c',
            run: () => [
              { code: 'X_AT', pointer: '', message: 'm', file: lock, at: { line: 7, col: 3 } },
              { code: 'X_SANS_AT', pointer: '/x', message: 'm', file: lock },
            ],
          },
        ],
      }),
    ]);
    const at = trouver(res, 'X_AT');
    assert.deepEqual([at.line, at.col], [7, 3]);
    const sans = trouver(res, 'X_SANS_AT');
    assert.deepEqual([sans.line, sans.col], [1, 1]);
    assert.equal(sans.file, lock);
  });

  it('severity vaut error par défaut ; un warning ne compte pas comme une erreur', () => {
    const racine = copie();
    const findings: Finding[] = [
      { code: 'X_ERR', pointer: '', message: 'm' },
      { code: 'X_WARN', severity: 'warning', pointer: '', message: 'm' },
    ];
    const res = charger(racine, [famille({ corpus: [{ id: 'c', run: () => findings }] })]);
    assert.equal(trouver(res, 'X_ERR').severity, 'error');
    assert.equal(trouver(res, 'X_WARN').severity, 'warning');
    assert.equal(res.diagnostics.filter((d) => d.severity === 'error').length, 1);
  });
});

describe('moteur : fail-closed', () => {
  it('une règle qui lève donne un REGLE_ECHEC nommant la règle ; les autres règles tournent', () => {
    const racine = copie();
    let autre = 0;
    const res = charger(racine, [
      famille({
        corpus: [
          {
            id: 'boom',
            run: () => {
              throw new Error('kaboom');
            },
          },
          { id: 'ok', run: () => (autre++, [{ code: 'X_OK', pointer: '', message: 'm' }]) },
        ],
      }),
    ]);
    const echecs = res.diagnostics.filter((d) => d.code === 'REGLE_ECHEC');
    assert.equal(echecs.length, 1);
    assert.equal(echecs[0]?.severity, 'error');
    assert.match(echecs[0]?.message ?? '', /boom/);
    assert.match(echecs[0]?.message ?? '', /kaboom/);
    assert.equal(autre, 1);
    assert.ok(res.diagnostics.some((d) => d.code === 'X_OK'));
  });

  it('une règle de fichier qui lève n’est signalée qu’une fois, sur un fichier réel', () => {
    const racine = copie();
    const res = charger(racine, [
      famille({
        fichier: [
          {
            id: 'fboom',
            run: () => {
              throw new Error('non');
            },
          },
        ],
      }),
    ]);
    const echecs = res.diagnostics.filter((d) => d.code === 'REGLE_ECHEC');
    assert.equal(echecs.length, 1);
    assert.match(echecs[0]?.file ?? '', /\.yaml$/);
  });
});

describe('moteur : mode et tri', () => {
  it('le mode vaut production par défaut ; preview atteint ctx.mode', () => {
    const racine = copie();
    const modes: string[] = [];
    const fam = famille({ corpus: [{ id: 'c', run: (ctx) => (modes.push(ctx.mode), []) }] });
    charger(racine, [fam]);
    charger(racine, [fam], 'preview');
    charger(racine, [fam], 'production');
    assert.deepEqual(modes, ['production', 'preview', 'production']);
  });

  it('les diagnostics sont triés par fichier, ligne, colonne, code, message', () => {
    const racine = copie();
    const mesure = path.join(racine, MESURE_REL);
    const res = charger(racine, [
      famille({
        corpus: [
          {
            id: 'c',
            run: () => [
              { code: 'B', pointer: '', message: 'm', file: mesure, at: { line: 3, col: 1 } },
              { code: 'A', pointer: '', message: 'z', file: mesure, at: { line: 3, col: 1 } },
              { code: 'A', pointer: '', message: 'a', file: mesure, at: { line: 3, col: 1 } },
              { code: 'C', pointer: '', message: 'm', file: mesure, at: { line: 2, col: 9 } },
              { code: 'D', pointer: '', message: 'm', file: mesure, at: { line: 2, col: 2 } },
            ],
          },
        ],
      }),
    ]);
    assert.deepEqual(
      res.diagnostics.map((d) => `${d.code}:${d.message}`),
      ['D:m', 'C:m', 'A:a', 'A:z', 'B:m'],
    );
  });
});

describe('citer', () => {
  it('tronque à 60 caractères plus le marqueur d’ellipse', () => {
    const c = citer('x'.repeat(100));
    assert.equal(c, `${'x'.repeat(CITER_MAX)}…`);
    assert.ok(Array.from(c).length <= CITER_MAX + 1);
  });
  it('ne tronque pas un texte court et normalise les espaces', () => {
    assert.equal(citer('  a \n  b\t c '), 'a b c');
  });
  it('ne retire pas les caractères de contrôle (formatText s’en charge)', () => {
    assert.ok(citer('a\u001bb').includes('\u001b'));
  });
  it('accepte une longueur maximale explicite', () => {
    assert.equal(citer('abcdef', 3), 'abc…');
  });
});

describe('registre par défaut', () => {
  it('trois familles vides : la fixture saine donne [] et LoadResult garde sa forme', () => {
    assert.deepEqual(
      FAMILLES.map((f) => f.id),
      ['redaction', 'corpus', 'sondages'],
    );
    const res = loadAll(BASE_CORPUS, { schemasDir: SCHEMAS_DIR });
    assert.deepEqual(res.diagnostics, []);
    assert.deepEqual(Object.keys(res).sort(), ['diagnostics', 'entries', 'files']);
    assert.ok(res.entries.every((e) => !('doc' in e) && !('lc' in e)));
  });
});

describe('configuration exportable', () => {
  it('le catalogue a des codes uniques et des hypothèses A1 à A12', () => {
    const codes = CATALOGUE.map((c) => c.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(codes.length, 39);
    assert.deepEqual(
      HYPOTHESES.map((h) => h.id),
      Array.from({ length: 12 }, (_, i) => `A${i + 1}`),
    );
  });
  it('le module de configuration n’importe rien de node: ni de runtime', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'src', 'lib', 'content-core', 'rules', 'config.ts'), 'utf8');
    const imports = src.split('\n').filter((l) => /^import /.test(l));
    assert.ok(imports.every((l) => l.startsWith('import type')), imports.join('\n'));
    assert.ok(!/from 'node:/.test(src));
  });
});
