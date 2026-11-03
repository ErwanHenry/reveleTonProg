import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LineCounter, parseDocument } from 'yaml';
import { famille } from '../../src/lib/content-core/rules/sondages.ts';
import type { Finding, LoadedEntry, RuleContext } from '../../src/lib/content-core/rules/types.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';

const FIXTURE = readFileSync(path.join(BASE_CORPUS, 'src', 'content', 'sondages', 'sondage-fictif-1.yaml'), 'utf8');

function swap(from: string, to: string): string {
  assert.ok(FIXTURE.includes(from), `cible introuvable dans le fixture : ${from}`);
  return FIXTURE.replace(from, () => to);
}

/** Applique la règle d'entrée `sondage` à un texte YAML (le schéma n'est pas rejoué ici). */
function regle(text: string): Finding[] {
  const lc = new LineCounter();
  const doc = parseDocument(text, { schema: 'core', lineCounter: lc });
  const entree: LoadedEntry = {
    collection: 'sondages',
    id: 'sondage-fictif-1',
    file: '/tmp/sondage-fictif-1.yaml',
    data: doc.toJS() as Record<string, unknown>,
    doc,
    lc,
  };
  const ctx = { mode: 'production', contentRoot: '/tmp', corpus: undefined, cache: new Map() } as unknown as RuleContext;
  const r = famille.entree.find((x) => x.id === 'sondage');
  assert.ok(r, 'règle d’entrée « sondage » introuvable');
  return r.run(entree, ctx);
}
const codes = (fs: Finding[]): string[] => fs.map((f) => f.code);

/** Fixture dont l'unique hypothèse porte ces scores et cet autres_pct. */
function avecScores(scores: number[], autres?: number): string {
  const bloc = /hypotheses:\n[\s\S]*?(?=statut_relecture:)/.exec(FIXTURE)?.[0];
  assert.ok(bloc);
  const lignes = scores.map((p, i) => `      - candidat: candidat-${i}\n        pct: ${p}\n`).join('');
  const nouveau = `hypotheses:\n  - nom: Hypothèse fictive A\n    scores:\n${lignes}${autres === undefined ? '' : `    autres_pct: ${autres}\n`}`;
  return FIXTURE.replace(bloc, () => nouveau);
}

describe('sondages : le fixture', () => {
  it('le sondage fictif valide (52 + 41 + 7 autres) n’est pas signalé', () => {
    assert.deepEqual(regle(FIXTURE), []);
  });
});

describe('sondages : somme des scores (centièmes)', () => {
  const cas: [string, number[], number | undefined, boolean][] = [
    ['94,99 : refusé', [50, 44.99], undefined, true],
    ['95 : accepté', [50, 45], undefined, false],
    ['105 : accepté', [60, 45], undefined, false],
    ['105,01 : refusé', [60, 45.01], undefined, true],
    ['24,6 + 31,2 + 44,2 : accepté (flottants)', [24.6, 31.2, 44.2], undefined, false],
    ['sans autres_pct : scores seuls', [30, 30, 40], undefined, false],
    ['avec autres_pct : 112 refusé', [52, 41], 19, true],
    ['avec autres_pct : 100 accepté', [52, 41], 7, false],
  ];
  for (const [nom, scores, autres, refuse] of cas) {
    it(nom, () => {
      const trouves = regle(avecScores(scores, autres)).filter((f) => f.code === 'SONDAGE_SOMME_HORS_BORNES');
      if (refuse) {
        assert.equal(trouves.length, 1);
        assert.equal(trouves[0]?.pointer, '/hypotheses/0');
      } else {
        assert.deepEqual(trouves, []);
      }
    });
  }

  it('le message cite la somme calculée avec une décimale', () => {
    const f = regle(avecScores([52, 41], 19)).find((x) => x.code === 'SONDAGE_SOMME_HORS_BORNES');
    assert.match(f?.message ?? '', /112,0/);
  });
});

describe('sondages : tour et duel', () => {
  it('un duel (deux scores sommant >= 99) rangé au tour 1 : SONDAGE_TOUR2_EN_TOUR1', () => {
    assert.deepEqual(codes(regle(avecScores([55, 45]))), ['SONDAGE_TOUR2_EN_TOUR1']);
  });
  it('une hypothèse nommée « Second tour fictif » avec trois scores au tour 1 : SONDAGE_TOUR2_EN_TOUR1', () => {
    const texte = avecScores([40, 30, 25], 5).replace('nom: Hypothèse fictive A', 'nom: Second tour fictif');
    assert.deepEqual(codes(regle(texte)), ['SONDAGE_TOUR2_EN_TOUR1']);
  });
  it('un tour 2 de deux scores est accepté', () => {
    assert.deepEqual(regle(avecScores([55, 45]).replace('tour: 1', 'tour: 2')), []);
  });
  it('un tour 2 de trois scores : SONDAGE_TOUR1_EN_TOUR2', () => {
    const f = regle(avecScores([40, 30, 30]).replace('tour: 1', 'tour: 2'));
    assert.deepEqual(codes(f), ['SONDAGE_TOUR1_EN_TOUR2']);
    assert.equal(f[0]?.pointer, '/hypotheses/0');
  });
});

describe('sondages : doublon de candidat', () => {
  it('le même candidat deux fois dans une hypothèse : SONDAGE_CANDIDAT_DOUBLON sur le second score', () => {
    const texte = swap('candidat: jean-imaginaire', 'candidat: marie-fictive');
    const f = regle(texte);
    assert.deepEqual(codes(f), ['SONDAGE_CANDIDAT_DOUBLON']);
    assert.equal(f[0]?.pointer, '/hypotheses/0/scores/1');
  });
});
