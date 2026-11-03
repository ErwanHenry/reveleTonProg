import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LineCounter, parseDocument } from 'yaml';
import { FENETRES_BLOCAGE } from '../../src/lib/content-core/rules/config.ts';
import { famille, fenetreDe } from '../../src/lib/content-core/rules/sondages.ts';
import type { Finding, LoadedEntry, RuleContext } from '../../src/lib/content-core/rules/types.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

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

// ---------------------------------------------------------------------------
// Fenêtres de blocage légal (heure de Paris), indépendantes du fuseau du processus
// ---------------------------------------------------------------------------

const DANS_FENETRE = [
  '2027-04-17T00:00:00+02:00',
  '2027-04-16T22:00:00Z',
  '2027-04-17T00:00:00+01:00',
  '2027-04-18T19:59:59+02:00',
  '2027-05-01T00:00:00+02:00',
  '2027-05-02T19:59:59+02:00',
  '2027-04-17T10:00:00-04:00',
];
const HORS_FENETRE = [
  '2027-04-16T23:59:59+02:00',
  '2027-04-18T20:00:00+02:00',
  '2027-04-18T18:00:00Z',
  '2027-04-30T23:59:59+02:00',
  '2027-05-02T20:00:00+02:00',
  '2026-10-05T08:00:00+02:00',
];

describe('sondages : fenetreDe', () => {
  for (const iso of DANS_FENETRE) {
    it(`${iso} est dans une fenêtre de blocage`, () => {
      assert.ok(fenetreDe(iso), `${iso} devrait être bloqué`);
    });
  }
  for (const iso of HORS_FENETRE) {
    it(`${iso} est hors fenêtre`, () => {
      assert.equal(fenetreDe(iso), undefined);
    });
  }
  it('une date illisible n’est dans aucune fenêtre (le schéma la refuse déjà)', () => {
    assert.equal(fenetreDe('pas une date'), undefined);
  });

  it('chaque fenêtre commence un samedi à 00:00 et finit un dimanche à 20:00, heure de Paris', () => {
    const parts = (t: number): Record<string, string> => {
      const fmt = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      return Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    };
    assert.equal(FENETRES_BLOCAGE.length, 2);
    for (const w of FENETRES_BLOCAGE) {
      const d = parts(w.debut);
      const f = parts(w.fin);
      assert.deepEqual([d.weekday, d.hour, d.minute], ['samedi', '00', '00'], w.libelle);
      assert.deepEqual([f.weekday, f.hour, f.minute], ['dimanche', '20', '00'], w.libelle);
    }
  });

  it('même verdict sous cinq fuseaux de processus', () => {
    const url = pathToFileURL(path.join(REPO_ROOT, 'src', 'lib', 'content-core', 'rules', 'sondages.ts')).href;
    const toutes = [...DANS_FENETRE, ...HORS_FENETRE];
    const script = `import { fenetreDe } from ${JSON.stringify(url)};
const out = ${JSON.stringify(toutes)}.map((d) => fenetreDe(d) !== undefined);
console.log(JSON.stringify(out));`;
    const attendu = toutes.map((iso) => DANS_FENETRE.includes(iso));
    for (const TZ of ['UTC', 'Europe/Paris', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Tokyo']) {
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
      assert.equal(r.status, 0, `TZ=${TZ} : ${r.stderr}`);
      assert.deepEqual(JSON.parse(r.stdout), attendu, `TZ=${TZ}`);
    }
  });
});

describe('sondages : règle de fenêtre', () => {
  for (const statut of ['brouillon', 'relu\nrelecteur: Erwan Henry\ndate_relecture: 2026-10-06']) {
    it(`date_publication dans une fenêtre : SONDAGE_FENETRE_BLOCAGE (statut ${statut.split('\n')[0]})`, () => {
      const texte = swap('date_publication: 2026-10-05T08:00:00+02:00', 'date_publication: 2027-05-01T12:00:00+02:00').replace(
        'statut_relecture: brouillon',
        `statut_relecture: ${statut}`,
      );
      const f = regle(texte);
      assert.deepEqual(codes(f), ['SONDAGE_FENETRE_BLOCAGE']);
      assert.equal(f[0]?.pointer, '/date_publication');
      assert.match(f[0]?.message ?? '', /1er mai 2027/);
    });
  }
  it('une date hors fenêtre n’est pas signalée', () => {
    assert.deepEqual(regle(swap('date_publication: 2026-10-05T08:00:00+02:00', 'date_publication: 2027-04-16T23:59:59+02:00')), []);
  });
});
