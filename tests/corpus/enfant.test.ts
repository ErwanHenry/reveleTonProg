// Segmenteur du texte « Pour les enfants » (src/lib/corpus/enfant.ts) : pur, sans Astro ni node:.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { segmenter, termesDe } from '../../src/lib/corpus/enfant.ts';
import { construireCorpus } from '../../src/lib/corpus/vue.ts';
import { materialiserCorpusM1, nettoyerCorpusM1 } from '../helpers/corpus-m1.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import type { EntreeGlossaire } from '../../src/lib/corpus/types.ts';
import { slugGlossaire as depuisNormalize } from '../../src/lib/content-core/rules/text/normalize.ts';
import { slugGlossaire as depuisReferences } from '../../src/lib/content-core/rules/references.ts';

const loyer: EntreeGlossaire = {
  version_schema: 1,
  id: 'loyer',
  type: 'terme',
  libelle: 'loyer',
  definition: "Le loyer est la somme qu'on paie chaque mois pour habiter un logement.",
};
const parti: EntreeGlossaire = {
  version_schema: 1,
  id: 'parti-imaginaire',
  type: 'parti',
  libelle: 'Parti Imaginaire',
  definition: 'Le Parti Imaginaire se présente comme un mouvement fictif.',
  source: {
    type: 'parti',
    titre: 'Page de présentation du Parti Imaginaire',
    url: 'https://parti-imaginaire.exemple.invalid/presentation',
    date_consultation: '2026-10-20',
  },
};
const energie: EntreeGlossaire = {
  version_schema: 1,
  id: 'energie-solaire',
  type: 'terme',
  libelle: 'énergie solaire',
  definition: "L'énergie solaire vient de la lumière du soleil.",
};
const glossaire = new Map([loyer, parti, energie].map((g) => [g.id, g] as const));

describe('segmenter', () => {
  it('découpe un marqueur simple en texte, terme, texte et garde les espaces exacts', () => {
    const segs = segmenter('Il paie un [[loyer]] chaque mois.', glossaire, 'm-x');
    assert.deepEqual(segs, [
      { type: 'texte', texte: 'Il paie un ' },
      { type: 'terme', affiche: 'loyer', id: 'loyer', popId: 'def-m-x-1', definition: loyer.definition, source: undefined },
      { type: 'texte', texte: ' chaque mois.' },
    ]);
  });

  it("résout l'identifiant explicite et la source d'une entrée parti", () => {
    const segs = segmenter('Elle est membre du [[Parti Imaginaire|parti-imaginaire]].', glossaire, 'm-x');
    const terme = segs[1];
    assert.ok(terme !== undefined && terme.type === 'terme');
    assert.equal(terme.affiche, 'Parti Imaginaire');
    assert.equal(terme.id, 'parti-imaginaire');
    assert.deepEqual(terme.source, { titre: 'Page de présentation du Parti Imaginaire', date: '2026-10-20' });
    const fin = segs[2];
    assert.ok(fin !== undefined && fin.type === 'texte');
    assert.equal(fin.texte, '.');
  });

  it("résout [[Loyer]] par le slug de l'affiché, avec accents", () => {
    const a = segmenter('Un [[Loyer]].', glossaire, 'p')[1];
    assert.ok(a !== undefined && a.type === 'terme');
    assert.equal(a.id, 'loyer');
    assert.equal(a.affiche, 'Loyer');
    const b = segmenter("De l'[[Énergie solaire]] ici.", glossaire, 'p')[1];
    assert.ok(b !== undefined && b.type === 'terme');
    assert.equal(b.id, 'energie-solaire');
  });

  it('numérote les occurrences : def-<prefixe>-1, def-<prefixe>-2', () => {
    const segs = segmenter('[[loyer]] puis encore [[loyer]].', glossaire, 'm-x');
    const ids = segs.flatMap((s) => (s.type === 'terme' ? [s.popId] : []));
    assert.deepEqual(ids, ['def-m-x-1', 'def-m-x-2']);
  });

  it("jette une erreur qui nomme l'identifiant inconnu et le préfixe", () => {
    assert.throws(
      () => segmenter('Un [[inconnu]] ici.', glossaire, 'm-zz'),
      (e: Error) => /inconnu/.test(e.message) && /m-zz/.test(e.message),
    );
  });

  it('un texte sans marqueur donne un seul segment texte', () => {
    assert.deepEqual(segmenter('Rien à expliquer.', glossaire, 'm-x'), [{ type: 'texte', texte: 'Rien à expliquer.' }]);
  });

  it('ne partage pas la regex globale : deux appels consécutifs donnent le même résultat', () => {
    const t = 'Un [[loyer]] et un [[loyer]].';
    assert.deepEqual(segmenter(t, glossaire, 'm-x'), segmenter(t, glossaire, 'm-x'));
  });

  it('aucun « [[ » ne subsiste dans les segments', () => {
    const segs = segmenter('A [[loyer]] B [[Parti Imaginaire|parti-imaginaire]] C', glossaire, 'm-x');
    for (const s of segs) {
      const t = s.type === 'texte' ? s.texte : `${s.affiche}${s.definition}`;
      assert.ok(!t.includes('[['), t);
    }
  });
});

describe('termesDe', () => {
  const vue = (enfant: string | undefined) => ({ mesure: { redactions: { enfant } } });

  it('renvoie les entrées distinctes, triées par libellé (fr)', () => {
    const termes = termesDe(
      [vue('Un [[Parti Imaginaire|parti-imaginaire]] et un [[loyer]].'), vue('Encore un [[loyer]].'), vue(undefined)],
      glossaire,
    );
    assert.deepEqual(
      termes.map((t) => t.id),
      ['loyer', 'parti-imaginaire'],
    );
  });

  it('trie « énergie solaire » avant « loyer » (collation française, pas ordre des codes)', () => {
    const termes = termesDe([vue('[[loyer]] [[Énergie solaire]]')], glossaire);
    assert.deepEqual(
      termes.map((t) => t.libelle),
      ['énergie solaire', 'loyer'],
    );
  });

  it('liste vide si aucun marqueur', () => {
    assert.deepEqual(termesDe([vue('Rien.')], glossaire), []);
  });
});

describe('slugGlossaire déplacé dans le module texte pur', () => {
  it('même sortie depuis normalize.ts et references.ts', () => {
    assert.equal(depuisNormalize('Énergie solaire'), 'energie-solaire');
    assert.equal(depuisReferences('Énergie solaire'), 'energie-solaire');
    assert.equal(depuisReferences, depuisNormalize);
  });
});

// ---------------------------------------------------------------------------
// Sur le corpus fictif corpus-m1 : ce que la page thème « logement » rendra (le build n'est pas lancé ici)
// ---------------------------------------------------------------------------

describe('sur le corpus fictif corpus-m1', () => {
  let corpus: ReturnType<typeof construireCorpus>;

  before(() => {
    const res = loadAll(materialiserCorpusM1(), { schemasDir: SCHEMAS_DIR, mode: 'production' });
    const de = <T>(collection: string): T[] => res.entries.filter((e) => e.collection === collection).map((e) => e.data as unknown as T);
    corpus = construireCorpus(
      {
        themes: de('themes'),
        candidats: de('candidats'),
        mesures: de('mesures'),
        sources: de('sources'),
        couverture: de('couverture'),
        glossaire: de('glossaire'),
      },
      'production',
    );
  });
  after(nettoyerCorpusM1);

  it("le texte enfant de marie-fictive donne le parti puis le loyer, avec des ids propres à l'ancre de la mesure", () => {
    const vue = corpus.mesures.find((m) => m.mesure.id === 'marie-fictive/aide-construction');
    assert.ok(vue, 'mesure absente du corpus de production');
    assert.equal(vue.ancre, 'm-marie-fictive-aide-construction');
    const segs = segmenter(vue.mesure.redactions.enfant ?? '', corpus.glossaire, vue.ancre);
    const termes = segs.flatMap((s) => (s.type === 'terme' ? [s] : []));
    assert.deepEqual(
      termes.map((t) => [t.affiche, t.id, t.popId]),
      [
        ['Parti Imaginaire', 'parti-imaginaire', 'def-m-marie-fictive-aide-construction-1'],
        ['loyer', 'loyer', 'def-m-marie-fictive-aide-construction-2'],
      ],
    );
    assert.deepEqual(termes[0]?.source, { titre: 'Page de présentation du Parti Imaginaire', date: '2026-10-20' });
    assert.equal(termes[1]?.source, undefined);
    assert.match(termes[1]?.definition ?? '', /^Le loyer est la somme d'argent/);
    // chaque terme est entouré de texte : ni début ni fin de phrase collés à un bouton
    segs.forEach((s, i) => {
      if (s.type === 'terme') assert.ok(segs[i - 1]?.type === 'texte' && segs[i + 1]?.type === 'texte');
    });
  });

  it('la liste de la page « logement » compte 2 mots : loyer puis Parti Imaginaire', () => {
    const logement = corpus.mesures.filter((m) => m.mesure.theme === 'logement');
    assert.ok(logement.length >= 2);
    assert.deepEqual(
      termesDe(logement, corpus.glossaire).map((t) => t.libelle),
      ['loyer', 'Parti Imaginaire'],
    );
  });

  it('chaque texte enfant du corpus se segmente sans erreur (tous les marqueurs se résolvent)', () => {
    for (const vue of corpus.mesures) {
      const segs = segmenter(vue.mesure.redactions.enfant ?? '', corpus.glossaire, vue.ancre);
      assert.ok(segs.every((s) => s.type === 'texte' || !s.definition.includes('[[')));
    }
  });
});
