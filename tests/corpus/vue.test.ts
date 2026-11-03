// Vue-modèle pur (src/lib/corpus/vue.ts) : périmètre, cases, filtrage par mode, phrase de couverture.
// Le corpus vient de la surcouche fictive corpus-m1 (plan 04-01), chargée par content-core.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { Brut } from '../../src/lib/corpus/vue.ts';
import {
  BADGES,
  LIBELLES_MOTIF,
  LIBELLES_NIVEAUX,
  LIBELLES_STATUT,
  NIVEAUX,
  construireCorpus,
  dateMax,
  formatDate,
  phraseCouverture,
  statutAffiche,
} from '../../src/lib/corpus/vue.ts';
import type { Candidat } from '../../src/lib/corpus/types.ts';
import { TRAPPE_BROUILLON, materialiserCorpusM1, nettoyerCorpusM1 } from '../helpers/corpus-m1.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

let brut: Brut;

function copie(): Brut {
  return structuredClone(brut);
}

before(() => {
  const racine = materialiserCorpusM1();
  const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'preview' });
  const de = <T>(collection: string): T[] => res.entries.filter((e) => e.collection === collection).map((e) => e.data as unknown as T);
  brut = {
    themes: de('themes'),
    candidats: de('candidats'),
    mesures: de('mesures'),
    sources: de('sources'),
    couverture: de('couverture'),
    glossaire: de('glossaire'),
  };
});
after(nettoyerCorpusM1);

const ids = (xs: readonly { id: string }[]): string[] => xs.map((x) => x.id);

describe('vue : candidats et périmètre', () => {
  it('trie par nom_tri (collation française) puis id, rang 0..5', () => {
    const c = construireCorpus(brut, 'preview');
    assert.deepEqual(ids(c.candidats.map((v) => v.donnees)), [
      'elise-erard',
      'marie-fictive',
      'jean-imaginaire',
      'nina-pressentie',
      'luc-retire',
      'paul-de-villefranche',
    ]);
    assert.deepEqual(
      c.candidats.map((v) => v.rang),
      [0, 1, 2, 3, 4, 5],
    );
    assert.equal(c.candidats[0]?.nomAffiche, 'Élise Érard');
  });

  it("à nom_tri égal, l'id départage", () => {
    const b = copie();
    const modele = b.candidats.find((c) => c.id === 'jean-imaginaire') as Candidat;
    b.candidats = [
      { ...structuredClone(modele), id: 'z-dupont', nom_tri: 'Dupont' },
      { ...structuredClone(modele), id: 'a-dupont', nom_tri: 'Dupont' },
    ];
    b.mesures = [];
    b.couverture = [];
    const c = construireCorpus(b, 'preview');
    assert.deepEqual(ids(c.candidats.map((v) => v.donnees)), ['a-dupont', 'z-dupont']);
  });

  it('périmètre = declare/primaire par statut le plus récent', () => {
    const c = construireCorpus(brut, 'preview');
    assert.deepEqual([...c.perimetre].sort(), ['elise-erard', 'jean-imaginaire', 'marie-fictive', 'paul-de-villefranche']);
    assert.equal(c.candidat('luc-retire').statutRecent.code, 'renonce');
    assert.equal(c.candidat('luc-retire').perimetre, false);
  });

  it("un statut hors ordre chronologique : le plus récent par date l'emporte", () => {
    const b = copie();
    const luc = b.candidats.find((x) => x.id === 'luc-retire') as Candidat;
    luc.statuts = [...luc.statuts].reverse(); // renonce (2026-10-25) en tête, declare (2026-09-10) en fin
    const c = construireCorpus(b, 'preview');
    assert.equal(c.candidat('luc-retire').statutRecent.code, 'renonce');
    assert.equal(c.candidat('luc-retire').perimetre, false);
    // Statut déclaré plus récent placé en tête : il reste le plus récent.
    const elise = b.candidats.find((x) => x.id === 'elise-erard') as Candidat;
    const ancien = { ...structuredClone(elise.statuts[0]!), code: 'pressenti' as const, date: '2026-01-01' };
    elise.statuts = [elise.statuts[0]!, ancien];
    assert.equal(construireCorpus(b, 'preview').candidat('elise-erard').perimetre, true);
  });
});

describe('vue : production', () => {
  it('thèmes publiés seulement, par ordre : logement puis climat', () => {
    const c = construireCorpus(brut, 'production');
    assert.deepEqual(
      c.themes.map((t) => t.theme.id),
      ['logement', 'climat'],
    );
    assert.throws(() => c.theme('ecole'));
  });

  it('cases du thème logement dans le rang des candidats', () => {
    const t = construireCorpus(brut, 'production').theme('logement');
    assert.deepEqual(
      t.cellules.map((x) => [x.candidat.donnees.id, x.etat]),
      [
        ['elise-erard', 'non_precise'],
        ['marie-fictive', 'mesures'],
        ['jean-imaginaire', 'programme_non_publie'],
        ['paul-de-villefranche', 'programme_non_publie'],
      ],
    );
    const marie = t.cellules[1]!;
    assert.equal(marie.premiere?.mesure.titre, 'Aide à la construction dans les zones tendues (fictif)');
    assert.equal(marie.autres, 1);
    assert.equal(marie.mesures.length, 2);
    assert.equal(marie.premiere?.ancre, 'm-marie-fictive-aide-construction');
    assert.equal(marie.premiere?.badge, null);
    assert.equal(marie.premiere?.source.id, 'marie-fictive-programme');
    const elise = t.cellules[0]!;
    assert.equal(elise.verifieLe, '2026-10-24');
    assert.deepEqual(ids(elise.sourcesConsultees), ['programme-commun-fictif']);
    assert.equal(elise.premiere, undefined);
  });

  it("la mesure en brouillon n'apparaît nulle part dans le corpus", () => {
    const c = construireCorpus(brut, 'production');
    const dump = JSON.stringify({ themes: c.themes, candidats: c.candidats });
    assert.ok(!dump.includes(TRAPPE_BROUILLON));
    assert.ok(!dump.includes('guichet-unique'));
  });

  it('lève une erreur nommant le thème et le candidat quand ni mesure visible ni case', () => {
    const b = copie();
    const couv = b.couverture.find((x) => x.theme === 'logement')!;
    couv.cases = couv.cases.filter((x) => x.candidat !== 'paul-de-villefranche');
    assert.throws(() => construireCorpus(b, 'production'), /logement.*paul-de-villefranche/);
    assert.doesNotThrow(() => construireCorpus(b, 'preview'));
  });

  it("lève une erreur quand une case dit « mesures » sans mesure visible", () => {
    const b = copie();
    const couv = b.couverture.find((x) => x.theme === 'climat')!;
    couv.cases.find((x) => x.candidat === 'elise-erard')!.etat = 'mesures';
    assert.throws(() => construireCorpus(b, 'production'), /climat.*elise-erard/);
    const c = construireCorpus(b, 'preview');
    assert.equal(c.theme('climat').cellules.find((x) => x.candidat.donnees.id === 'elise-erard')?.etat, 'non_verifie');
  });

  it('renonces = luc-retire ; un renoncement non relu bascule dans les autres personnalités', () => {
    const c = construireCorpus(brut, 'production');
    assert.deepEqual(ids(c.theme('logement').renonces.map((v) => v.donnees)), ['luc-retire']);
    assert.equal(c.theme('logement').autresPersonnalites, 1);
    assert.equal(c.theme('climat').autresPersonnalites, 1);

    const b = copie();
    const luc = b.candidats.find((x) => x.id === 'luc-retire') as Candidat;
    luc.statuts[1]!.statut_relecture = 'brouillon';
    const c2 = construireCorpus(b, 'production');
    assert.deepEqual(c2.theme('logement').renonces, []);
    assert.equal(c2.theme('logement').autresPersonnalites, 2);
    // En preview, le renoncement (même brouillon) est affiché.
    assert.deepEqual(ids(construireCorpus(b, 'preview').theme('logement').renonces.map((v) => v.donnees)), ['luc-retire']);
  });

  it('renonces identiques en preview', () => {
    const c = construireCorpus(brut, 'preview');
    assert.deepEqual(ids(c.theme('logement').renonces.map((v) => v.donnees)), ['luc-retire']);
    assert.equal(c.theme('logement').autresPersonnalites, 1);
  });

  it('statutAffiche : production = dernier statut relu/publié, sinon null ; preview = le plus récent', () => {
    const c = construireCorpus(brut, 'preview');
    const paul = c.candidat('paul-de-villefranche').donnees;
    assert.equal(statutAffiche(paul, 'production'), null);
    assert.equal(statutAffiche(paul, 'preview')?.code, 'declare');
    const marie = c.candidat('marie-fictive').donnees; // pressenti (brouillon, 2026-09) puis declare (relu, 2026-10-15)
    assert.equal(statutAffiche(marie, 'production')?.code, 'declare');
    const nina = c.candidat('nina-pressentie').donnees;
    assert.equal(statutAffiche(nina, 'production'), null);
    const luc = c.candidat('luc-retire').donnees;
    assert.equal(statutAffiche(luc, 'production')?.code, 'renonce');
  });
});

describe('vue : preview', () => {
  it('thèmes logement, ecole, climat ; brouillon visible avec son badge ; thème relu badgé', () => {
    const c = construireCorpus(brut, 'preview');
    assert.deepEqual(
      c.themes.map((t) => t.theme.id),
      ['logement', 'ecole', 'climat'],
    );
    const elise = c.theme('logement').cellules[0]!;
    assert.equal(elise.etat, 'mesures');
    assert.equal(elise.premiere?.badge, 'brouillon, non relu');
    assert.ok(elise.premiere?.mesure.titre.includes(TRAPPE_BROUILLON));
    assert.equal(c.theme('ecole').badge, 'relu, pas encore publié');
    assert.equal(c.theme('logement').badge, null);
    assert.deepEqual(
      c.theme('ecole').cellules.map((x) => x.etat),
      ['non_verifie', 'non_verifie', 'non_verifie', 'non_verifie'],
    );
  });
});

describe('vue : couverture, dates, libellés', () => {
  it('phraseCouverture : cas du jeu de test', () => {
    const prod = construireCorpus(brut, 'production');
    assert.equal(
      phraseCouverture(prod.theme('logement').couverture),
      "Sur ce thème, 1 candidat sur 4 a une position publiée, 1 n'a rien de précisé dans les sources consultées, 2 n'ont pas publié de programme.",
    );
    assert.equal(
      phraseCouverture(prod.theme('climat').couverture),
      "Sur ce thème, 0 candidat sur 4 a une position publiée, 3 n'ont rien de précisé dans les sources consultées, 1 n'a pas publié de programme.",
    );
    const prev = construireCorpus(brut, 'preview');
    assert.equal(
      phraseCouverture(prev.theme('ecole').couverture),
      'Sur ce thème, 0 candidat sur 4 a une position publiée, 4 cases ne sont pas encore vérifiées.',
    );
  });

  it('phraseCouverture : clauses à zéro omises, accords au singulier pour 0 et 1', () => {
    assert.equal(
      phraseCouverture({ total: 5, mesures: 5, nonPrecise: 0, programmeNonPublie: 0, nonVerifie: 0 }),
      'Sur ce thème, 5 candidats sur 5 ont une position publiée.',
    );
    assert.equal(
      phraseCouverture({ total: 3, mesures: 1, nonPrecise: 0, programmeNonPublie: 0, nonVerifie: 2 }),
      'Sur ce thème, 1 candidat sur 3 a une position publiée, 2 cases ne sont pas encore vérifiées.',
    );
    assert.equal(
      phraseCouverture({ total: 3, mesures: 1, nonPrecise: 0, programmeNonPublie: 1, nonVerifie: 1 }),
      "Sur ce thème, 1 candidat sur 3 a une position publiée, 1 n'a pas publié de programme, 1 case n'est pas encore vérifiée.",
    );
  });

  it('formatDate : indépendant du fuseau', () => {
    const tz = process.env.TZ;
    try {
      for (const z of ['Pacific/Auckland', 'America/Los_Angeles', 'UTC']) {
        process.env.TZ = z;
        assert.equal(formatDate('2026-10-21'), '21 octobre 2026');
        assert.equal(formatDate('2026-11-01'), '1er novembre 2026');
        assert.equal(formatDate('2026-10'), 'octobre 2026');
        assert.equal(formatDate('2026'), '2026');
      }
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });

  it('dateMax ignore undefined et compare des chaînes ISO', () => {
    assert.equal(dateMax([undefined, '2026-10-21', '2026-10-26', undefined, '2026-09']), '2026-10-26');
    assert.equal(dateMax([undefined]), undefined);
    assert.equal(dateMax([]), undefined);
  });

  it("miseAJour : maximum des dates affichées sur la page (la date du renoncement compte)", () => {
    const c = construireCorpus(brut, 'production');
    assert.equal(c.theme('logement').miseAJour, '2026-10-26');
    assert.equal(c.theme('climat').miseAJour, '2026-10-25');
  });

  it('libellés', () => {
    assert.deepEqual([...NIVEAUX], ['resume', 'detaille', 'enfant', 'aine']);
    assert.deepEqual(LIBELLES_NIVEAUX, { resume: 'En bref', detaille: 'En détail', enfant: 'Pour les enfants', aine: 'Gros caractères' });
    assert.equal(LIBELLES_STATUT.renonce, 'Ne se présente pas');
    assert.equal(LIBELLES_STATUT.declare, 'Candidature déclarée');
    assert.equal(LIBELLES_MOTIF.retrait, 'retrait de la candidature');
    assert.deepEqual(BADGES, { brouillon: 'brouillon, non relu', relu: 'relu, pas encore publié' });
  });
});
