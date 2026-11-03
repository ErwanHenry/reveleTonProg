import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { kandelMoles, syllables } from '../../src/lib/content-core/rules/text/syllables.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

// Valeurs de référence : Lexique 3.83 (New, Pallier et al., licence CC BY-SA 4.0), colonne nbsyll
// (syllabes prononcées), une entrée par forme orthographique. Hypothèse A1 : l'heuristique est
// calibrée sur Lexique, pas sur textstat (Pitfall 7). Les 161 mots ci-dessous sont ceux pour
// lesquels l'heuristique et Lexique s'accordent ; ils figent le comportement.

const GEL: [string, number][] = [
  ['le', 1],
  ['de', 1],
  ['que', 1],
  ['je', 1],
  ['un', 1],
  ['une', 1],
  ['les', 1],
  ['des', 1],
  ['mais', 1],
  ['est', 1],
  ['sont', 1],
  ['pas', 1],
  ['plus', 1],
  ['tout', 1],
  ['très', 1],
  ['où', 1],
  ['à', 1],
  ['été', 2],
  ['être', 1],
  ['avoir', 2],
  ['école', 2],
  ['loyer', 2],
  ['loyers', 2],
  ['propriétaire', 4],
  ['préfet', 2],
  ['département', 4],
  ['gouvernement', 4],
  ['programme', 2],
  ['habitants', 3],
  ['plafond', 2],
  ['représente', 3],
  ['aujourd\'hui', 3],
  ['fixé', 2],
  ['année', 2],
  ['montant', 2],
  ['maximal', 3],
  ['logement', 3],
  ['logements', 3],
  ['construction', 3],
  ['encadrer', 3],
  ['permis', 2],
  ['question', 2],
  ['oiseau', 2],
  ['voyage', 2],
  ['ancien', 2],
  ['situation', 3],
  ['lien', 1],
  ['pied', 1],
  ['rien', 1],
  ['bien', 1],
  ['nuit', 1],
  ['huit', 1],
  ['fruit', 1],
  ['ouest', 1],
  ['moyen', 2],
  ['payer', 2],
  ['essayer', 3],
  ['théâtre', 2],
  ['aérien', 3],
  ['poète', 2],
  ['maïs', 2],
  ['Noël', 2],
  ['aiguille', 2],
  ['guide', 1],
  ['qui', 1],
  ['quatre', 1],
  ['quarante', 2],
  ['cinquante', 2],
  ['trente', 1],
  ['soixante', 2],
  ['vingt', 1],
  ['million', 2],
  ['milliard', 2],
  ['euros', 2],
  ['impôt', 2],
  ['retraite', 2],
  ['retraités', 3],
  ['santé', 2],
  ['dépendance', 3],
  ['succession', 3],
  ['citoyen', 3],
  ['nucléaire', 3],
  ['énergie', 3],
  ['scientifique', 3],
  ['hôpital', 3],
  ['maire', 1],
  ['mairie', 2],
  ['commune', 2],
  ['région', 2],
  ['européen', 4],
  ['société', 3],
  ['égalité', 4],
  ['simplement', 3],
  ['tellement', 3],
  ['propose', 2],
  ['proposer', 3],
  ['éducation', 4],
  ['enseignant', 3],
  ['élèves', 2],
  ['université', 5],
  ['emploi', 2],
  ['salaire', 2],
  ['locataire', 3],
  ['sécurité', 4],
  ['justice', 2],
  ['environnement', 5],
  ['écologie', 4],
  ['climat', 2],
  ['agriculture', 4],
  ['famille', 2],
  ['enfants', 2],
  ['personnes', 2],
  ['pharmacien', 3],
  ['créer', 2],
  ['créé', 2],
  ['crier', 2],
  ['premier', 2],
  ['première', 2],
  ['peuple', 1],
  ['république', 3],
  ['élection', 3],
  ['président', 3],
  ['présidentielle', 4],
  ['candidat', 3],
  ['jamais', 2],
  ['toujours', 2],
  ['aussi', 2],
  ['avec', 2],
  ['pour', 1],
  ['dans', 1],
  ['sans', 1],
  ['vie', 1],
  ['pluie', 1],
  ['joue', 1],
  ['rue', 1],
  ['français', 2],
  ['peuvent', 1],
  ['veulent', 1],
  ['viennent', 1],
  ['disent', 1],
  ['doivent', 1],
  ['savent', 1],
  ['arrivent', 2],
  ['parlent', 1],
  ['prennent', 1],
  ['attendent', 2],
  ['moment', 2],
  ['souvent', 2],
  ['argent', 2],
  ['client', 2],
  ['patient', 2],
  ['vraiment', 2],
  ['lentement', 3],
  ['seulement', 3],
  ['étaient', 2],
  ['avaient', 2],
  ['influence', 3],
  ['propriété', 4],
  ['oublier', 3],
  ['triomphe', 2],
  ['cruel', 2],
];

describe('syllables : mots de référence Lexique 3.83', () => {
  it('la table compte 161 mots distincts', () => {
    assert.equal(GEL.length, 161);
    assert.equal(new Set(GEL.map(([m]) => m)).size, 161);
  });
  for (const [mot, n] of GEL) {
    it(`${mot} : ${n}`, () => assert.equal(syllables(mot), n));
  }
});

describe('syllables : limites connues (valeur de l’heuristique, pas de Lexique)', () => {
  // [mot, valeur de l'heuristique, valeur Lexique 3.83]
  const limites: [string, number, number][] = [
    ['pays', 1, 2],
    ['aiment', 2, 1],
    ['ouvrier', 2, 3],
    ['médecin', 3, 2],
    ['extraordinaire', 4, 5],
    ['lorsque', 1, 2],
    ['blanche', 1, 2],
    ['ok', 1, 2],
    ['chaos', 1, 2],
  ];
  for (const [mot, heuristique, lexique] of limites) {
    it(`${mot} : ${heuristique} (limite connue, Lexique : ${lexique})`, () => {
      assert.equal(syllables(mot), heuristique);
      assert.notEqual(heuristique, lexique);
    });
  }
});

describe('syllables : nombres en chiffres (approximation volontaire)', () => {
  it('50000 = 4, 2027 = 4, 3,5 = 3, 12 = 2', () => {
    assert.equal(syllables('50000'), 4);
    assert.equal(syllables('2027'), 4);
    assert.equal(syllables('3,5'), 3);
    assert.equal(syllables('12'), 2);
  });
});

describe('kandelMoles', () => {
  it('un texte vide donne NaN', () => {
    assert.ok(Number.isNaN(kandelMoles('')));
    assert.ok(Number.isNaN(kandelMoles('   ')));
  });

  it('une phrase longue de mots longs score moins bien qu’un texte court', () => {
    const court = kandelMoles('Il part. Elle rit. Le chat dort.');
    const long = kandelMoles('Le gouvernement envisage une réforme constitutionnelle extraordinairement compliquée.');
    assert.ok(court > long, `${court} <= ${long}`);
  });

  it('le texte enfant de la fixture score au moins 82 (2 points de marge sur le seuil)', () => {
    const mesure = parse(
      readFileSync(path.join(REPO_ROOT, 'tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml'), 'utf8'),
    ) as { redactions: { enfant: string } };
    const km = kandelMoles(mesure.redactions.enfant);
    assert.ok(km >= 82, `Kandel-Moles de la fixture : ${km}`);
  });
});
