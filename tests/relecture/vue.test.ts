import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { fenetreExtrait, ficheCandidat, resume } from '../../scripts/lib/relecture/vue.ts';
import { foldKey } from '../../src/lib/content-core/rules/text/normalize.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

// Fiche de relecture d'un candidat (09-05, PUB-01, D-04) : assemblage pur à partir du corpus et des diagnostics
// du validateur, sur une copie temporaire du corpus fictif M1 (thème logement). Jamais d'écriture.

after(() => nettoyerCorpusRelecture());

const MESURE = 'src/content/mesures/elise-erard/guichet-unique.yaml';
const SOURCE = 'src/content/sources/programme-commun-fictif.yaml';
const CITATION = 'Nous créerons un guichet unique départemental pour toutes les demandes de logement social.';

const plie = (s: string): string => foldKey(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

describe('fenetreExtrait (localisation de la citation dans l’extrait archivé)', () => {
  it('trouve la citation malgré accents, apostrophes typographiques et espaces insécables, avec les offsets du texte d’origine', () => {
    const texte = 'Préambule. L’école publique sera gratuite pour 1 500 000 élèves. Fin.';
    const f = fenetreExtrait(texte, "l'ecole publique sera gratuite pour 1 500 000 eleves");
    assert.equal(f.trouve, true);
    assert.equal(f.cite, 'L’école publique sera gratuite pour 1 500 000 élèves');
    assert.equal(f.avant + f.cite + f.apres, texte);
  });

  it('fenêtre de 400 caractères de part et d’autre, coupée aux limites de mots', () => {
    const mots = (n: number, p: string): string => Array.from({ length: n }, (_, i) => `${p}${i}`).join(' ');
    const texte = `${mots(200, 'avant')} la phrase cherchée est ici ${mots(200, 'apres')}`;
    const f = fenetreExtrait(texte, 'la phrase cherchée est ici');
    assert.equal(f.trouve, true);
    assert.equal(f.cite, 'la phrase cherchée est ici');
    assert.ok(f.avant.length <= 401 && f.avant.length > 300, `avant : ${f.avant.length}`);
    assert.ok(f.apres.length <= 401 && f.apres.length > 300, `après : ${f.apres.length}`);
    assert.match(f.avant, /^avant\d+ /, 'commence par un mot entier');
    assert.match(f.apres, / apres\d+$/, 'finit par un mot entier');
  });

  it('citation à ellipse : seul le premier fragment est localisé', () => {
    const f = fenetreExtrait('Alpha. Nous ferons ceci très vite. Puis cela ensuite. Oméga.', 'Nous ferons ceci […] cela ensuite');
    assert.equal(f.trouve, true);
    assert.equal(f.cite, 'Nous ferons ceci');
  });

  it('introuvable : les 800 premiers caractères, trouve false', () => {
    const texte = 'mot '.repeat(400);
    const f = fenetreExtrait(texte, 'absent du texte');
    assert.equal(f.trouve, false);
    assert.equal(f.cite, '');
    assert.ok(f.avant.length <= 800 && f.avant.length > 700);
    assert.equal(f.apres, '');
    assert.equal(fenetreExtrait('court', '').trouve, false);
  });
});

describe('ficheCandidat et resume (corpus M1 temporaire, thème logement)', () => {
  let c: CorpusRelecture;
  beforeEach(() => {
    c = corpusRelecture();
  });

  it('mesure dont la citation est trouvée : rédactions, texte_source, source complète, fenêtre qui contient la citation', () => {
    const avant = c.arbre();
    const f = ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'elise-erard');
    assert.ok(f);
    assert.equal(f.nom, 'Élise Érard');
    assert.equal(f.parti, 'Mouvement Inventé');
    const m = f.mesures.find((x) => x.id === 'elise-erard/guichet-unique');
    assert.ok(m);
    assert.equal(m.cible, 'mesure:elise-erard/guichet-unique');
    assert.equal(m.titre, 'Guichet unique départemental du logement social (fictif)');
    assert.match(m.redactions.resume, /^Élise Érard propose/);
    assert.ok(m.redactions.detaille && m.redactions.enfant && m.redactions.aine);
    assert.equal(m.texte_source, CITATION);
    assert.equal(m.source_localisation, 'page 2 (fictive)');
    assert.equal(m.chiffrage, undefined);
    assert.equal(m.etat, 'a_relire');
    assert.deepEqual(m.notes, []);
    assert.ok(m.source);
    assert.equal(m.source.id, 'programme-commun-fictif');
    assert.equal(m.source.url, 'https://programme-commun.exemple.invalid/programme');
    assert.equal(m.source.date_consultation, '2026-10-24');
    assert.equal(m.source.date_publication, '2026-10');
    assert.equal(m.source.sha256, 'c3107ed7287b072c38461027ac295a334cfcdd7076821cbaf9a78a0bb465e2b5');
    assert.match(m.source.wayback_url ?? '', /^https:\/\/web\.archive\.org\/web\/20261024100000\//);
    assert.ok(m.extrait);
    assert.equal(m.extrait.trouve, true);
    assert.equal(plie(m.extrait.cite), plie(CITATION.replace(/\.$/, '')));
    assert.match(m.extrait.avant, /Page 2/);
    assert.match(m.extrait.apres, /concertation/);
    assert.deepEqual(m.alertes, []);
    // Statut retenu : déclaré, source et dates ; état de relecture.
    assert.ok(f.statut);
    assert.equal(f.statut.code, 'declare');
    assert.equal(f.statut.date, '2026-10-18');
    assert.equal(f.statut.source?.titre, 'Annonce de candidature (fictive)');
    assert.equal(f.statut.source?.url, 'https://elise-erard.exemple.invalid/candidature');
    assert.equal(f.statut.source?.date_consultation, '2026-10-18');
    assert.equal(f.statut.statut_relecture, 'relu');
    // Case de couverture non_precise : sources consultées avec titre, URL et date.
    assert.ok(f.case);
    assert.equal(f.case.etat_case, 'non_precise');
    assert.equal(f.case.verifie_le, '2026-10-24');
    assert.equal(f.case.verifie_par, 'Erwan Henry');
    assert.deepEqual(f.case.sources_consultees, [
      { id: 'programme-commun-fictif', titre: "Programme commun fictif d'Élise Érard et Jean Imaginaire", url: 'https://programme-commun.exemple.invalid/programme', date_consultation: '2026-10-24' },
    ]);
    assert.deepEqual(f.case.contradictions, []);
    assert.deepEqual(differencesArbre(avant, c.arbre()), []);
  });

  it('citation à ellipse dans la copie temporaire : le premier fragment est localisé', () => {
    c.ecrire(MESURE, c.lire(MESURE).replace(`texte_source: ${CITATION}`, 'texte_source: Nous créerons un guichet unique départemental […] toutes les demandes de logement social.'));
    const m = ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'elise-erard')?.mesures[0];
    assert.ok(m?.extrait);
    assert.equal(m.extrait.trouve, true);
    assert.equal(plie(m.extrait.cite), 'nous creerons un guichet unique departemental');
  });

  it('archive absente dans la copie temporaire : extrait null et alerte ARCHIVE_ABSENTE, jamais d’exception', () => {
    rmSync(c.chemin('archives/marie-fictive/23c5f1cc8eff.txt'));
    const f = ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'marie-fictive');
    assert.ok(f);
    assert.equal(f.mesures.length, 2);
    for (const m of f.mesures) {
      assert.equal(m.extrait, null, m.id);
      assert.ok(m.source);
      assert.ok(
        m.source.alertes.some((a) => a.code === 'ARCHIVE_ABSENTE' && a.severity === 'error'),
        JSON.stringify(m.source.alertes),
      );
    }
  });

  it('contradiction de dates : COUVERTURE_VERIFIEE_AVANT_SOURCE est rattachée à la case et expliquée', () => {
    c.ecrire(SOURCE, c.lire(SOURCE).replace('date_consultation: 2026-10-24', 'date_consultation: 2026-10-25'));
    const f = ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'elise-erard');
    assert.ok(f?.case);
    assert.equal(f.case.contradictions.length, 1);
    assert.match(f.case.contradictions[0]!, /vérifiée le 2026-10-24, avant la consultation de la source « programme-commun-fictif » \(le 2026-10-25\)/);
    assert.ok(f.case.alertes.some((a) => a.code === 'COUVERTURE_VERIFIEE_AVANT_SOURCE'));
    // Les autres cases ne la reçoivent pas.
    assert.deepEqual(ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'marie-fictive')?.case?.contradictions, []);
  });

  it('candidat hors périmètre ou inconnu : undefined', () => {
    assert.equal(ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'nina-pressentie'), undefined);
    assert.equal(ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'personne'), undefined);
  });

  it('notes ouvertes : rattachées à la mesure et comptées dans le résumé', () => {
    const n = c.lancer('note', 'mesure:elise-erard/guichet-unique', 'vérifier', 'la', 'page');
    assert.equal(n.code, 0, n.stderr);
    const m = ficheCandidat(c.racine, SCHEMAS_DIR, 'logement', 'elise-erard')?.mesures[0];
    assert.deepEqual(m?.notes.map((x) => x.texte), ['vérifier la page']);
    const r = resume(c.racine, SCHEMAS_DIR, 'logement');
    assert.equal(r.candidats.find((x) => x.id === 'elise-erard')?.notes_ouvertes, 1);
    assert.equal(r.notes_ouvertes, 1);
  });

  it('resume : candidats dans l’ordre du site (nom_tri), compteurs par candidat et totaux du thème', () => {
    const avant = c.arbre();
    const r = resume(c.racine, SCHEMAS_DIR, 'logement');
    assert.equal(r.theme, 'logement');
    assert.deepEqual(
      r.candidats.map((x) => x.id),
      ['elise-erard', 'marie-fictive', 'jean-imaginaire', 'paul-de-villefranche'],
    );
    assert.equal(r.total, 11);
    assert.equal(r.reste, 7);
    assert.equal(r.a_relire + r.a_revoir + r.relu, r.total);
    const elise = r.candidats.find((x) => x.id === 'elise-erard');
    assert.deepEqual(elise && { a_relire: elise.a_relire, relu: elise.relu, a_revoir: elise.a_revoir, notes: elise.notes_ouvertes }, { a_relire: 1, relu: 1, a_revoir: 1, notes: 0 });
    assert.equal(elise?.nom, 'Élise Érard');
    assert.deepEqual(differencesArbre(avant, c.arbre()), []);
  });
});

function differencesArbre(avant: Map<string, string>, apres: Map<string, string>): string[] {
  const cles = new Set([...avant.keys(), ...apres.keys()]);
  return [...cles].filter((k) => avant.get(k) !== apres.get(k)).sort();
}
