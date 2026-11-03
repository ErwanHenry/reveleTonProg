import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';
import type { PiegeSpec, Remplacement } from '../helpers/overlay.ts';

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const THEME = 'src/content/themes/logement.yaml';
const COUVERTURE = 'src/content/couverture/logement.yaml';
const JEAN = 'src/content/candidats/jean-imaginaire.yaml';

const CAS_JEAN = '  - candidat: jean-imaginaire\n    etat: programme_non_publie\n    verifie_le: 2026-10-21\n    verifie_par: Erwan Henry\n';
const SANS_CAS_JEAN: Remplacement = { fichier: COUVERTURE, de: CAS_JEAN, par: '' };

type Triplet = [string, string, string, string];
/** Seuls les diagnostics d'équité : les autres familles ont leurs propres tests. */
const equite = (remplacer: Remplacement[], mode: Mode = 'production'): Triplet[] => {
  const spec: PiegeSpec = { piege: 'test', regle: 'REGLE-08', mode, remplacer, attendu: [] };
  return executerPiege(spec)
    .filter((d) => d.code.startsWith('EQUITE_'))
    .map((d): Triplet => [d.code, d.severite, d.fichier, d.pointer])
    .sort();
};

describe('REGLE-08 : équité des thèmes publiés', () => {
  it('le corpus de référence est équitable, en production comme en preview', () => {
    assert.deepEqual(equite([], 'production'), []);
    assert.deepEqual(equite([], 'preview'), []);
  });

  it('un candidat « renonce » sort du périmètre : son absence de couverture est permise', () => {
    assert.deepEqual(equite([SANS_CAS_JEAN, { fichier: JEAN, de: 'code: declare', par: 'code: renonce' }]), []);
  });

  it('candidat déclaré sans mesure ni case : erreur en production, avertissement en preview', () => {
    assert.deepEqual(equite([SANS_CAS_JEAN], 'production'), [['EQUITE_CANDIDAT_MANQUANT', 'error', THEME, '/statut_relecture']]);
    assert.deepEqual(equite([SANS_CAS_JEAN], 'preview'), [['EQUITE_CANDIDAT_MANQUANT', 'warning', THEME, '/statut_relecture']]);
  });

  it('mesure de Marie en brouillon alors que sa case dit « mesures » : EQUITE_COUVERTURE_INCOHERENTE', () => {
    const r = equite([{ fichier: MESURE, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' }]);
    assert.deepEqual(r, [['EQUITE_COUVERTURE_INCOHERENTE', 'error', COUVERTURE, '/cases/0/etat']]);
  });

  it('case de Jean « mesures » sans mesure publiée : EQUITE_COUVERTURE_INCOHERENTE', () => {
    const r = equite([{ fichier: COUVERTURE, de: 'etat: programme_non_publie', par: 'etat: mesures' }]);
    assert.deepEqual(r, [['EQUITE_COUVERTURE_INCOHERENTE', 'error', COUVERTURE, '/cases/1/etat']]);
  });

  it('case « programme_non_publie » alors qu’une mesure est publiée : EQUITE_COUVERTURE_INCOHERENTE', () => {
    const r = equite([{ fichier: COUVERTURE, de: 'etat: mesures', par: 'etat: programme_non_publie' }]);
    assert.deepEqual(r, [['EQUITE_COUVERTURE_INCOHERENTE', 'error', COUVERTURE, '/cases/0/etat']]);
  });

  it('thème en brouillon : la règle ne s’applique pas', () => {
    assert.deepEqual(equite([SANS_CAS_JEAN, { fichier: THEME, de: 'statut_relecture: publie', par: 'statut_relecture: brouillon' }]), []);
  });

  it('un statut « declare » en brouillon ajouté en dernier place un candidat « pressenti » dans le périmètre (A6)', () => {
    const pressenti: Remplacement = { fichier: JEAN, de: 'code: declare', par: 'code: pressenti' };
    assert.deepEqual(equite([SANS_CAS_JEAN, pressenti]), []);
    const brouillon: Remplacement = {
      fichier: JEAN,
      de: '    date_relecture: 2026-10-14\n',
      par:
        '    date_relecture: 2026-10-14\n' +
        '  - code: declare\n    date: 2026-10-20\n    source:\n      type: candidat\n      titre: Nouvelle annonce (fictive)\n' +
        '      url: https://jean-imaginaire.exemple.invalid/annonce\n      date_consultation: 2026-10-21\n    statut_relecture: brouillon\n',
    };
    assert.deepEqual(equite([SANS_CAS_JEAN, pressenti, brouillon]), [['EQUITE_CANDIDAT_MANQUANT', 'error', THEME, '/statut_relecture']]);
  });

  it('WR-12 : un statut plus ancien placé en fin de liste ne change pas le périmètre', () => {
    const ancien: Remplacement = {
      fichier: JEAN,
      de: '    date_relecture: 2026-10-14\n',
      par:
        '    date_relecture: 2026-10-14\n' +
        '  - code: pressenti\n    date: 2026-09-01\n    source:\n      type: candidat\n      titre: Rumeur (fictive)\n' +
        '      url: https://jean-imaginaire.exemple.invalid/rumeur\n      date_consultation: 2026-09-02\n    statut_relecture: brouillon\n',
    };
    // Le dernier de la liste est « pressenti », mais le plus récent par date est « declare » : Jean reste dans le périmètre.
    assert.deepEqual(equite([SANS_CAS_JEAN, ancien]), [['EQUITE_CANDIDAT_MANQUANT', 'error', THEME, '/statut_relecture']]);
  });

  it('WR-12 : une date partielle (AAAA-MM) se compare à une date complète', () => {
    const partiel: Remplacement = {
      fichier: JEAN,
      de: '    date_relecture: 2026-10-14\n',
      par:
        '    date_relecture: 2026-10-14\n' +
        '  - code: renonce\n    motif: retrait\n    date: 2026-11\n    source:\n      type: candidat\n      titre: Retrait (fictif)\n' +
        '      url: https://jean-imaginaire.exemple.invalid/retrait\n      date_consultation: 2026-11-02\n    statut_relecture: brouillon\n',
    };
    assert.deepEqual(equite([SANS_CAS_JEAN, partiel]), []);
  });

  it('un fichier invalide au schéma : la règle se tait (pas de cascade)', () => {
    assert.deepEqual(equite([SANS_CAS_JEAN, { fichier: JEAN, de: 'prenom: Jean\n', par: '' }]), []);
  });
});
