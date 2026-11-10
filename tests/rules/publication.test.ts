import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';
import type { PiegeSpec, Remplacement } from '../helpers/overlay.ts';

after(() => nettoyerRacines());

const LISTE = 'config/publication.yml';
const THEME = 'src/content/themes/logement.yaml';
const LISTE_OK = 'themes_ouverts:\n  - logement\n';

type Triplet = [string, string, string, string];
const publication = (spec: Partial<PiegeSpec>, mode: Mode = 'production'): Triplet[] =>
  executerPiege({ piege: 'test', regle: 'REGLE-13', mode, attendu: [], ...spec })
    .filter((d) => d.code.startsWith('PUBLICATION_'))
    .map((d): Triplet => [d.code, d.severite, d.fichier, d.pointer])
    .sort();

const liste = (contenu: string): Remplacement => ({ fichier: LISTE, de: LISTE_OK, par: contenu });

describe('REGLE-13 : liste blanche de publication', () => {
  it('le corpus de référence est conforme, en production comme en preview', () => {
    assert.deepEqual(publication({}, 'production'), []);
    assert.deepEqual(publication({}, 'preview'), []);
  });

  it('thème publié retiré de la liste : erreur en production, avertissement en preview', () => {
    const r = [liste('themes_ouverts: []\n')];
    assert.deepEqual(publication({ remplacer: r }, 'production'), [['PUBLICATION_THEME_NON_OUVERT', 'error', THEME, '/statut_relecture']]);
    assert.deepEqual(publication({ remplacer: r }, 'preview'), [['PUBLICATION_THEME_NON_OUVERT', 'warning', THEME, '/statut_relecture']]);
  });

  it('identifiant inconnu dans la liste : erreur dans les deux modes', () => {
    const r = [liste('themes_ouverts:\n  - logement\n  - sante-inconnue\n')];
    for (const mode of ['production', 'preview'] as const) {
      assert.deepEqual(publication({ remplacer: r }, mode), [['PUBLICATION_THEME_INCONNU', 'error', LISTE, '']]);
    }
  });

  it('thème connu mais en brouillon, listé : avertissement seulement (retrait d\'urgence)', () => {
    const r = [{ fichier: THEME, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' }];
    for (const mode of ['production', 'preview'] as const) {
      const res = publication({ remplacer: r }, mode);
      assert.deepEqual(res, [['PUBLICATION_THEME_OUVERT_NON_PUBLIE', 'warning', LISTE, '']]);
    }
  });

  it('liste illisible : PUBLICATION_LISTE_INVALIDE, une seule fois, avec le message du lecteur', () => {
    const spec: PiegeSpec = { piege: 'test', regle: 'REGLE-13', mode: 'production', remplacer: [liste('themes_ouverts:\n  logement: oui\n')], attendu: [] };
    const res = executerPiege(spec).filter((d) => d.code === 'PUBLICATION_LISTE_INVALIDE');
    assert.equal(res.length, 1);
    assert.equal(res[0]?.severite, 'error');
    assert.equal(res[0]?.fichier, LISTE);
    assert.equal(res[0]?.ligne, 1);
  });

  it('fichier supprimé avec un thème publié : PUBLICATION_THEME_NON_OUVERT', () => {
    assert.deepEqual(publication({ supprimer: [LISTE] }), [['PUBLICATION_THEME_NON_OUVERT', 'error', THEME, '/statut_relecture']]);
  });
});
