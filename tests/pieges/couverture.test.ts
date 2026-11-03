import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { OVERRIDES } from '../../src/lib/content-core/ajv.ts';
import * as config from '../../src/lib/content-core/rules/config.ts';
import { CATALOGUE } from '../../src/lib/content-core/rules/config.ts';
import type { EntreeCatalogue } from '../../src/lib/content-core/rules/config.ts';
import { PIEGES_DIR, lirePiege } from '../helpers/overlay.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

// REGLE-10 : le cahier des charges §12 liste sept données piégées. Ce méta-test échoue si l'une
// d'elles disparaît, passe la validation, ou si un code du catalogue n'est plus exercé par un test.

const PIEGES_12 = [
  'SOURCE_ABSENTE',
  'MOT_INTERDIT',
  'SONDAGE_NOTICE_ABSENTE',
  'SONDAGE_SOMME_HORS_BORNES',
  'SONDAGE_TOUR2_EN_TOUR1',
  'CHIFFRE_HORS_SOURCE',
  'SONDAGE_FENETRE_BLOCAGE',
] as const;

/** Codes du catalogue annoncés comme piège §12 dont aucun dossier canonique `<CODE>/` n'existe. */
export function verifierCouverture(catalogue: readonly Pick<EntreeCatalogue, 'code' | 'piege'>[], dossiers: readonly string[]): string[] {
  const presents = new Set(dossiers);
  return catalogue.filter((c) => c.piege !== null && !presents.has(c.code)).map((c) => c.code);
}

const dossiers = readdirSync(PIEGES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const lire = (rel: string): string => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/** Tous les fichiers d'un dossier (récursif), chemins absolus, ordre stable. */
function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...fichiers(p));
    else out.push(p);
  }
  return out;
}

describe('REGLE-10 : les sept pièges du §12', () => {
  it('exactement sept codes du catalogue portent un piège §12, ceux du cahier des charges', () => {
    const avecPiege = CATALOGUE.filter((c) => c.piege !== null)
      .map((c) => c.code)
      .sort();
    assert.deepEqual(avecPiege, [...PIEGES_12].sort(), 'la liste des pièges §12 du catalogue a changé');
  });

  it('chaque piège a son dossier canonique tests/fixtures/pieges/<CODE>/ et attend ce code en erreur', () => {
    const manquants = verifierCouverture(CATALOGUE, dossiers);
    assert.deepEqual(manquants, [], `piège(s) §12 sans dossier de test : ${manquants.join(', ')}`);
    for (const code of PIEGES_12) {
      const dossier = path.join(PIEGES_DIR, code);
      assert.ok(existsSync(path.join(dossier, 'attendu.json')), `attendu.json absent pour ${code}`);
      const spec = lirePiege(dossier);
      assert.ok(
        spec.attendu.some((a) => a.code === code && a.severite === 'error'),
        `le piège ${code} doit attendre ${code} en erreur`,
      );
    }
  });

  it('auto-contrôle : la fonction de couverture signale un piège dont le dossier manque', () => {
    const sans = dossiers.filter((d) => d !== 'SONDAGE_FENETRE_BLOCAGE');
    assert.deepEqual(verifierCouverture(CATALOGUE, sans), ['SONDAGE_FENETRE_BLOCAGE']);
    assert.deepEqual(verifierCouverture(CATALOGUE, dossiers), []);
  });
});

describe('REGLE-10 : catalogue, code et tests restent alignés', () => {
  const catalogue = new Set(CATALOGUE.map((c) => c.code));
  const LITTERAL = /\bcode:\s*'([A-Z][A-Z0-9_]*)'/g;

  /** Codes écrits en littéral dans les règles (hors config.ts, qui porte le catalogue lui-même). */
  const dansRegles = (): Map<string, string> => {
    const out = new Map<string, string>();
    for (const f of fichiers(path.join(REPO_ROOT, 'src', 'lib', 'content-core', 'rules'))) {
      if (!f.endsWith('.ts') || path.basename(f) === 'config.ts') continue;
      for (const m of readFileSync(f, 'utf8').matchAll(LITTERAL)) out.set(m[1] ?? '', path.relative(REPO_ROOT, f));
    }
    return out;
  };

  it('le détecteur de littéraux voit bien les codes des règles (garde contre une regex aveugle)', () => {
    const codes = dansRegles();
    for (const attendu of ['MOT_INTERDIT', 'CHIFFRE_HORS_SOURCE', 'SONDAGE_SOMME_HORS_BORNES', 'EQUITE_CANDIDAT_MANQUANT', 'REGLE_ECHEC']) {
      assert.ok(codes.has(attendu), `${attendu} non détecté dans rules/`);
    }
  });

  it('tout code émis par les règles, le schéma, ids.lock et le chargeur est dans CATALOGUE', () => {
    const emis = new Map<string, string>(dansRegles());
    for (const o of OVERRIDES) if (o.code !== 'SCHEMA_VERSION_OBSOLETE') emis.set(o.code, 'src/lib/content-core/ajv.ts (OVERRIDES)');
    const union = /export type CodeIds =([^;]+);/.exec(lire('src/lib/content-core/ids-lock.ts'));
    assert.ok(union, 'CodeIds introuvable dans ids-lock.ts');
    for (const m of (union[1] ?? '').matchAll(/'([A-Z][A-Z0-9_]*)'/g)) emis.set(m[1] ?? '', 'src/lib/content-core/ids-lock.ts (CodeIds)');
    assert.ok(lire('src/lib/content-core/load.ts').includes("'ID_CHEMIN_INCOHERENT'"), 'ID_CHEMIN_INCOHERENT introuvable dans load.ts');
    emis.set('ID_CHEMIN_INCOHERENT', 'src/lib/content-core/load.ts');
    const inconnus = [...emis].filter(([code]) => !catalogue.has(code)).map(([code, ou]) => `${code} (${ou})`);
    assert.deepEqual(inconnus, [], `code(s) émis mais absents de CATALOGUE : ${inconnus.join(', ')}`);
  });

  it('tout code du catalogue apparaît dans au moins un test ou un attendu.json', () => {
    const moi = path.join(REPO_ROOT, 'tests', 'pieges', 'couverture.test.ts');
    const corpus = fichiers(path.join(REPO_ROOT, 'tests'))
      .filter((f) => f !== moi && (f.endsWith('.test.ts') || path.basename(f) === 'attendu.json'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const sansTest = [...catalogue].filter((code) => !new RegExp(`\\b${code}\\b`).test(corpus));
    assert.deepEqual(sansTest, [], `code(s) du catalogue jamais exercé(s) par un test : ${sansTest.join(', ')}`);
  });
});

describe('REGLE-10 : rules/config.ts reste pur et exportable (contrat de la page Méthode)', () => {
  it('aucun import non typé dans config.ts', () => {
    const src = lire('src/lib/content-core/rules/config.ts');
    assert.ok(!/^\s*import\s+(?!type\b)/m.test(src), 'config.ts importe un module à l’exécution');
    assert.ok(!/\bimport\s*\(/.test(src) && !/\brequire\s*\(/.test(src), 'config.ts charge un module dynamiquement');
    assert.ok(!/from\s+['"]node:/.test(src), 'config.ts dépend de Node');
  });

  it('expose tout ce que la page Méthode affiche', () => {
    for (const nom of [
      'CATALOGUE',
      'HYPOTHESES',
      'MOTS_INTERDITS',
      'VERBES_CONNOTES',
      'LONGUEURS',
      'PHRASE_ENFANT_MAX',
      'SEUIL_KANDEL_MOLES',
      'FENETRES_BLOCAGE',
      'SOMME_SONDAGE',
      'DUEL',
      'PERIMETRE_EQUITE',
      'CHAMPS_EDITORIAUX',
      'CHAMPS_NON_IMPORTABLES',
      'NORMALISATION_CITATIONS',
    ] as const) {
      assert.ok(nom in config, `config.ts n'exporte pas ${nom}`);
      assert.notEqual((config as Record<string, unknown>)[nom], undefined, nom);
    }
  });

  it('les hypothèses sont A1 à A12, dans l’ordre, chacune avec une règle et un choix', () => {
    assert.deepEqual(
      config.HYPOTHESES.map((h) => h.id),
      Array.from({ length: 12 }, (_, i) => `A${i + 1}`),
    );
    for (const h of config.HYPOTHESES) {
      assert.match(h.regle, /^REGLE-\d{2}$/);
      assert.ok(h.choix.length > 10, h.id);
    }
  });
});
