import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expectErrors, expectOk } from '../helpers/validate-yaml.ts';

// Mesure de base entièrement fictive ; chaque cas modifie un seul champ.
const PUBLIE = `version_schema: 1
id: marie-fictive/encadrement-loyers
candidat: marie-fictive
theme: logement
sous_theme: loyers
titre: Encadrement des loyers (fictif)
texte_source: Les loyers seront encadrés dans les villes de plus de 50 000 habitants.
source: marie-fictive-programme
source_localisation: page 3 (fictive)
redactions:
  resume: Encadrer les loyers dans les villes moyennes.
  detaille: Le programme prévoit d'encadrer les loyers dans les villes de plus de 50 000 habitants.
  enfant: Le prix des loyers ne pourra plus monter trop haut.
  aine: Le montant du loyer serait limité dans les villes moyennes.
statut_relecture: publie
relecteur: Erwan Henry
date_relecture: 2026-10-21
`;

const BROUILLON = `version_schema: 1
id: marie-fictive/encadrement-loyers
candidat: marie-fictive
theme: logement
sous_theme: loyers
titre: Encadrement des loyers (fictif)
texte_source: Les loyers seront encadrés.
source: marie-fictive-programme
redactions:
  resume: Encadrer les loyers.
  detaille: Le programme prévoit d'encadrer les loyers.
statut_relecture: brouillon
`;

/** Remplace exactement une occurrence : échoue si la cible a disparu de la base. */
function swap(base: string, from: string, to: string): string {
  assert.ok(base.includes(from), `cible introuvable dans la base : ${from}`);
  return base.replace(from, to);
}
const without = (base: string, line: string): string => swap(base, line, '');

const sansEnfantNiAine = without(without(PUBLIE, '  enfant: Le prix des loyers ne pourra plus monter trop haut.\n'), '  aine: Le montant du loyer serait limité dans les villes moyennes.\n');

describe('mesure : cas valides', () => {
  const ok: [string, string][] = [
    ['publiée avec 4 rédactions', PUBLIE],
    ['brouillon avec résumé et détaillé seulement', BROUILLON],
    ['brouillon avec enfant et aîné', swap(BROUILLON, '  detaille: Le programme prévoit d\'encadrer les loyers.\n', "  detaille: Le programme prévoit d'encadrer les loyers.\n  enfant: Les loyers seront limités.\n  aine: Le loyer serait plafonné.\n")],
    ['relu sans enfant ni aîné', swap(sansEnfantNiAine, 'statut_relecture: publie', 'statut_relecture: relu')],
    ['avec chiffrage du candidat', `${PUBLIE}chiffrage:\n  texte: 2 milliards d'euros par an\n  source_localisation: page 40 (fictive)\n`],
    ['sans source_localisation', without(PUBLIE, 'source_localisation: page 3 (fictive)\n')],
  ];
  for (const [name, text] of ok) it(name, () => expectOk('mesure', text));
});

describe('mesure : cas invalides', () => {
  const sansEnfant = without(PUBLIE, '  enfant: Le prix des loyers ne pourra plus monter trop haut.\n');
  const sansAine = without(PUBLIE, '  aine: Le montant du loyer serait limité dans les villes moyennes.\n');
  const bad: [string, string, { code: string; pointer: string }[]][] = [
    ['publiée sans enfant', sansEnfant, [{ code: 'SCHEMA_REQUIRED', pointer: '/redactions' }]],
    ['publiée sans aîné', sansAine, [{ code: 'SCHEMA_REQUIRED', pointer: '/redactions' }]],
    ['publiée sans relecteur', without(PUBLIE, 'relecteur: Erwan Henry\n'), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['relue sans date_relecture', swap(without(PUBLIE, 'date_relecture: 2026-10-21\n'), 'statut_relecture: publie', 'statut_relecture: relu'), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['texte_source absent', without(PUBLIE, 'texte_source: Les loyers seront encadrés dans les villes de plus de 50 000 habitants.\n'), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['source absente', without(PUBLIE, 'source: marie-fictive-programme\n'), [{ code: 'SCHEMA_REQUIRED', pointer: '' }]],
    ['champ inconnu evaluation', `${PUBLIE}evaluation: bonne\n`, [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/evaluation' }]],
    ['rédaction inconnue ado', swap(PUBLIE, 'redactions:\n', 'redactions:\n  ado: Texte pour les ados.\n'), [{ code: 'SCHEMA_UNEVALUATEDPROPERTIES', pointer: '/redactions/ado' }]],
    ['statut_relecture valide', swap(PUBLIE, 'statut_relecture: publie', 'statut_relecture: valide'), [{ code: 'SCHEMA_ENUM', pointer: '/statut_relecture' }]],
    ['id sans préfixe candidat', swap(PUBLIE, 'id: marie-fictive/encadrement-loyers', 'id: encadrement-loyers'), [{ code: 'SCHEMA_PATTERN', pointer: '/id' }]],
    ['chiffrage sans texte', `${PUBLIE}chiffrage:\n  source_localisation: page 40 (fictive)\n`, [{ code: 'SCHEMA_REQUIRED', pointer: '/chiffrage' }]],
    ['titre vide', swap(PUBLIE, 'titre: Encadrement des loyers (fictif)', 'titre: ""'), [{ code: 'SCHEMA_MINLENGTH', pointer: '/titre' }]],
    ['version_schema 2', swap(PUBLIE, 'version_schema: 1', 'version_schema: 2'), [{ code: 'SCHEMA_CONST', pointer: '/version_schema' }]],
  ];
  for (const [name, text, expected] of bad) it(name, () => expectErrors('mesure', text, expected));

  it('brouillon : aucune erreur même sans relecteur (garde contre un faux positif)', () => expectOk('mesure', BROUILLON));
});
