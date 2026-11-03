import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARGE_EGALITE, NIVEAUX, THEMES_SPEC, classer, lireCouverture } from '../../scripts/lib/couverture.ts';
import type { Niveau } from '../../scripts/lib/couverture.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTIMATION = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'couverture', 'estimation-2026-11-03.yaml'), 'utf8');

const IDS = THEMES_SPEC.map((t) => t.id);

describe('THEMES_SPEC', () => {
  it('liste les 10 thèmes de la spec dans l’ordre, avec les thèmes Aîné prioritaires', () => {
    assert.deepEqual(IDS, ['logement', 'ecole', 'retraites', 'sante', 'securite', 'climat', 'travail', 'impots', 'europe-et-monde', 'institutions']);
    assert.deepEqual(
      THEMES_SPEC.filter((t) => t.prioritaire_aine).map((t) => t.id),
      ['logement', 'retraites', 'sante'],
    );
    assert.deepEqual(THEMES_SPEC.map((t) => t.ordre), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(MARGE_EGALITE, 2);
    assert.deepEqual([...NIVEAUX], ['fort', 'partiel', 'silence', 'aucun', 'inaccessible']);
  });
});

describe('lireCouverture', () => {
  it('accepte l’estimation de recherche figée', () => {
    const { data, problemes } = lireCouverture(ESTIMATION);
    assert.deepEqual(problemes, []);
    assert.equal(data.candidats.length, 37);
    assert.equal(data.pilote.relecture_ouverte, false);
  });

  // Construit un tableau minimal valide, modifiable par un callback sur l'objet JS.
  function tableau(modif?: (t: Record<string, any>) => void): string {
    const cellules = (niveau: string): Record<string, unknown> => Object.fromEntries(IDS.map((id) => [id, { niveau, note: 'n' }]));
    const t: Record<string, any> = {
      version: 1,
      mesure_le: '2026-11-04',
      mesure_par: 'Claude (agent), à relire par Erwan Henry',
      regle: { marge_egalite: 2 },
      themes: THEMES_SPEC.map((s) => ({ id: s.id, nom: s.nom, prioritaire_aine: s.prioritaire_aine })),
      candidats: [
        { id: 'a-a', acces: 'ok', urls_bloquees: [], sources: ['a-a-programme'], urls_consultees: ['https://a.example/p'], cellules: cellules('partiel') },
        { id: 'b-b', acces: 'aucun_site', urls_bloquees: [], sources: [], urls_consultees: [], cellules: cellules('aucun') },
        { id: 'c-c', acces: 'bloque', urls_bloquees: ['https://c.example'], sources: [], urls_consultees: ['https://c.example'], cellules: cellules('inaccessible') },
        { id: 'd-d', acces: 'partiel', urls_bloquees: ['https://d.example/x'], sources: [], urls_consultees: [], cellules: cellules('silence') },
      ],
      pilote: { provisoires: ['institutions', 'impots', 'retraites'], themes: [], livres: [], derogation: null, relecture_ouverte: false },
    };
    modif?.(t);
    return JSON.stringify(t); // JSON est du YAML valide
  }
  const rejette = (nom: string, modif: (t: Record<string, any>) => void, motif: RegExp): void => {
    it(`rejette : ${nom}`, () => {
      const { problemes } = lireCouverture(tableau(modif));
      assert.ok(problemes.length > 0, 'au moins un problème attendu');
      assert.ok(problemes.some((p) => motif.test(p)), `aucun problème ne correspond à ${motif} : ${JSON.stringify(problemes)}`);
    });
  };

  it('accepte le tableau minimal de test', () => {
    assert.deepEqual(lireCouverture(tableau()).problemes, []);
  });

  rejette('une liste de thèmes différente de THEMES_SPEC (ordre)', (t) => t.themes.reverse(), /thème/i);
  rejette('un thème en moins', (t) => t.themes.pop(), /thème/i);
  rejette('une case manquante', (t) => delete t.candidats[0].cellules.climat, /climat/);
  rejette('une case en trop', (t) => (t.candidats[0].cellules.inconnu = { niveau: 'fort' }), /inconnu/);
  rejette('un niveau inconnu', (t) => (t.candidats[0].cellules.climat.niveau = 'moyen'), /niveau/i);
  rejette('un identifiant de candidat en double', (t) => (t.candidats[1].id = 'a-a'), /double|doublon/i);
  rejette('un acces inconnu', (t) => (t.candidats[0].acces = 'tout'), /acces/i);
  rejette('acces bloque avec une case non inaccessible', (t) => (t.candidats[2].cellules.sante.niveau = 'silence'), /inaccessible/);
  rejette('acces aucun_site avec une case non aucun', (t) => (t.candidats[1].cellules.sante.niveau = 'silence'), /aucun/);
  rejette('acces partiel sans urls_bloquees', (t) => (t.candidats[3].urls_bloquees = []), /urls_bloquees/);
  rejette('acces bloque sans urls_bloquees', (t) => (t.candidats[2].urls_bloquees = []), /urls_bloquees/);
  rejette('acces ok avec urls_bloquees', (t) => (t.candidats[0].urls_bloquees = ['https://x.example']), /urls_bloquees/);
  rejette('acces aucun_site avec urls_bloquees', (t) => (t.candidats[1].urls_bloquees = ['https://x.example']), /urls_bloquees/);
  rejette('acces partiel avec une case inaccessible', (t) => (t.candidats[3].cellules.sante.niveau = 'inaccessible'), /inaccessible/);
  rejette('relecture_ouverte absente', (t) => delete t.pilote.relecture_ouverte, /relecture_ouverte/);
  rejette('relecture_ouverte non booléenne', (t) => (t.pilote.relecture_ouverte = 'non'), /relecture_ouverte/);
  rejette('pilote.themes de 2 thèmes', (t) => (t.pilote.themes = ['institutions', 'impots']), /pilote\.themes/);
  rejette('pilote.themes avec un doublon', (t) => (t.pilote.themes = ['institutions', 'institutions', 'impots']), /pilote\.themes/);
  rejette('pilote.themes avec un thème inconnu', (t) => (t.pilote.themes = ['institutions', 'impots', 'cuisine']), /pilote\.themes/);
  rejette('pilote.livres hors pilote.themes', (t) => {
    t.pilote.themes = ['institutions', 'impots', 'retraites'];
    t.pilote.livres = ['logement'];
  }, /pilote\.livres/);
  rejette('derogation sans raison', (t) => (t.pilote.derogation = { decide_par: 'Erwan Henry', date: '2026-11-05' }), /raison/);
  rejette('derogation sans decide_par', (t) => (t.pilote.derogation = { raison: 'x', date: '2026-11-05' }), /decide_par/);
  rejette('derogation sans date', (t) => (t.pilote.derogation = { raison: 'x', decide_par: 'Erwan Henry' }), /date/);

  it('accepte trois thèmes pilotes, des livres inclus et une dérogation complète', () => {
    const { problemes } = lireCouverture(
      tableau((t) => {
        t.pilote.themes = ['institutions', 'impots', 'retraites'];
        t.pilote.livres = ['impots'];
        t.pilote.derogation = { raison: 'choix éditorial', decide_par: 'Erwan Henry', date: '2026-11-05' };
      }),
    );
    assert.deepEqual(problemes, []);
  });

  it('signale un YAML illisible en français sans lever', () => {
    const { problemes } = lireCouverture('version: [1\n');
    assert.ok(problemes.length > 0);
  });
});

describe('classer sur l’estimation de recherche', () => {
  const { data } = lireCouverture(ESTIMATION);
  const r = classer(data);
  const ligne = (id: string) => r.classement.find((c) => c.theme === id)!;

  it('recalcule les totaux de 03-RESEARCH', () => {
    const attendu: Record<string, [number, number]> = {
      institutions: [21, 15],
      impots: [21, 13],
      ecole: [19, 10],
      climat: [19, 10],
      'europe-et-monde': [19, 8],
      retraites: [18, 11],
      travail: [18, 11],
      logement: [18, 8],
      sante: [17, 11],
      securite: [16, 12],
    };
    for (const [id, [positions, forts]] of Object.entries(attendu)) {
      assert.equal(ligne(id).positions, positions, `positions ${id}`);
      assert.equal(ligne(id).forts, forts, `forts ${id}`);
      assert.equal(ligne(id).aucuns, 10, `aucuns ${id}`);
      assert.equal(ligne(id).inaccessibles, 0);
    }
    assert.equal(ligne('logement').silences, 9);
    assert.equal(ligne('logement').partiels, 10);
    assert.equal(ligne('logement').prioritaire_aine, true);
  });

  it('classe par positions, forts puis ordre de la spec', () => {
    assert.deepEqual(
      r.classement.map((c) => c.theme),
      ['institutions', 'impots', 'ecole', 'climat', 'europe-et-monde', 'retraites', 'travail', 'logement', 'sante', 'securite'],
    );
  });

  it('retient institutions, impots, retraites (règle de la marge) et institutions, impots, ecole (littéral)', () => {
    assert.deepEqual(r.choix, ['institutions', 'impots', 'retraites']);
    assert.deepEqual(r.top3Litteral, ['institutions', 'impots', 'ecole']);
  });

  it('documente la règle et les deux listes dans explication', () => {
    const texte = r.explication.join('\n');
    assert.match(texte, /écart de 2 candidats au plus = égalité \(marge d’erreur de la mesure\)/);
    assert.match(texte, /institutions, impots, retraites/);
    assert.match(texte, /institutions, impots, ecole/);
    assert.ok(r.explication.every((l) => typeof l === 'string'));
  });
});

describe('classer sur des cas synthétiques', () => {
  // Fabrique un tableau où chaque thème a `positions` candidats « partiel » (et `forts` « fort »), sur 30 candidats.
  function synth(spec: Record<string, [number, number]>) {
    const candidats = Array.from({ length: 30 }, (_, i) => ({
      id: `c-${i}`,
      acces: 'ok' as const,
      urls_bloquees: [],
      sources: [],
      urls_consultees: [],
      cellules: Object.fromEntries(
        IDS.map((id) => {
          const [positions, forts] = spec[id] ?? [0, 0];
          const niveau: Niveau = i < forts ? 'fort' : i < positions ? 'partiel' : 'silence';
          return [id, { niveau }];
        }),
      ),
    }));
    return {
      version: 1 as const,
      mesure_le: '2026-11-04',
      mesure_par: 'test',
      regle: { marge_egalite: 2 as const },
      themes: THEMES_SPEC.map((s) => ({ id: s.id, nom: s.nom, prioritaire_aine: s.prioritaire_aine })),
      candidats,
      pilote: { provisoires: [], themes: [], livres: [], derogation: null, relecture_ouverte: false },
    };
  }

  it('trois meneurs nets : ces trois thèmes quel que soit l’Aîné', () => {
    const r = classer(synth({ securite: [25, 5], climat: [24, 5], travail: [23, 5], logement: [20, 5], retraites: [19, 5], sante: [18, 5] }));
    assert.deepEqual(r.choix, ['securite', 'climat', 'travail']);
    assert.deepEqual(r.top3Litteral, ['securite', 'climat', 'travail']);
  });

  it('une bande sans thème Aîné : positions, puis forts, puis ordre de la spec', () => {
    // 2 meneurs nets (30, 29), puis bande {ecole 20/3, climat 20/9, travail 19/9} sans Aîné ; P4 = 20, sécurisés >= 22.
    const r = classer(synth({ institutions: [30, 5], impots: [29, 5], ecole: [20, 3], climat: [20, 9], travail: [19, 9] }));
    assert.deepEqual(r.choix, ['institutions', 'impots', 'climat']);
  });

  it('deux thèmes Aîné dans la bande : celui qui a le plus de positions', () => {
    const r = classer(synth({ institutions: [30, 5], impots: [29, 5], ecole: [20, 9], logement: [18, 2], retraites: [19, 2], sante: [10, 0] }));
    assert.deepEqual(r.choix, ['institutions', 'impots', 'retraites']);
  });

  it('un thème Aîné hors de la marge ne passe pas devant', () => {
    const r = classer(synth({ institutions: [30, 5], impots: [29, 5], ecole: [20, 9], retraites: [17, 2] }));
    assert.deepEqual(r.choix, ['institutions', 'impots', 'ecole']);
  });

  it('inaccessible et aucun ne comptent jamais comme positions', () => {
    const base = synth({ ecole: [10, 4] });
    for (const c of base.candidats) {
      (c.cellules as Record<string, { niveau: Niveau }>).climat = { niveau: 'inaccessible' };
      (c.cellules as Record<string, { niveau: Niveau }>).travail = { niveau: 'aucun' };
    }
    const r = classer(base);
    const l = (id: string) => r.classement.find((c) => c.theme === id)!;
    assert.equal(l('climat').positions, 0);
    assert.equal(l('climat').inaccessibles, 30);
    assert.equal(l('travail').positions, 0);
    assert.equal(l('travail').aucuns, 30);
    assert.equal(l('ecole').positions, 10);
  });
});
