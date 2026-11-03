import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml } from '../../src/lib/content-core/load.ts';
import { regleChamps } from '../../src/lib/content-core/rules/champs.ts';
import type { RuleContext } from '../../src/lib/content-core/rules/types.ts';
import { executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { PiegeSpec, Remplacement } from '../helpers/overlay.ts';

after(() => nettoyerRacines());

const CANDIDAT = 'src/content/candidats/marie-fictive.yaml';
const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';

const spec = (remplacer: Remplacement[]): PiegeSpec => ({ piege: 'test', regle: 'REGLE-12', mode: 'production', remplacer, attendu: [] });
const champs = (remplacer: Remplacement[]) =>
  executerPiege(spec(remplacer))
    .filter((d) => d.code === 'CHAMP_NON_IMPORTABLE' || d.code.startsWith('SCHEMA_'))
    .map((d) => [d.code, d.fichier, d.pointer, d.ligne] as const)
    .sort();

describe('CHAMP_NON_IMPORTABLE (balayage de l’arbre YAML)', () => {
  it('le corpus de référence est propre', () => {
    assert.deepEqual(champs([]), []);
  });

  it('`bloc` à la racine d’un candidat : erreur de schéma et CHAMP_NON_IMPORTABLE, sur la ligne de la clé', () => {
    const r = champs([{ fichier: CANDIDAT, de: 'prenom: Marie\n', par: 'prenom: Marie\nbloc: gauche\n' }]);
    assert.deepEqual(r, [
      ['CHAMP_NON_IMPORTABLE', CANDIDAT, '/bloc', 4],
      ['SCHEMA_UNEVALUATEDPROPERTIES', CANDIDAT, '/bloc', 4],
    ]);
  });

  it('`extdroite` imbriqué sous statuts/0 : pointeur complet', () => {
    const r = champs([{ fichier: CANDIDAT, de: '    statut_relecture: brouillon\n', par: '    statut_relecture: brouillon\n    extdroite: non\n' }]);
    assert.deepEqual(
      r.filter((d) => d[0] === 'CHAMP_NON_IMPORTABLE').map((d) => d[2]),
      ['/statuts/0/extdroite'],
    );
  });

  it('`propositions` dans une map de flux est signalé', () => {
    const r = champs([{ fichier: CANDIDAT, de: 'prenom: Marie\n', par: 'prenom: Marie\nautre: { propositions: 3 }\n' }]);
    assert.deepEqual(
      r.filter((d) => d[0] === 'CHAMP_NON_IMPORTABLE').map((d) => d[2]),
      ['/autre/propositions'],
    );
  });

  it('le mot « propositions » dans un texte n’est pas une clé', () => {
    const r = champs([{ fichier: MESURE, de: 'Marie Fictive propose de plafonner', par: 'Marie Fictive fait des propositions : plafonner' }]);
    assert.deepEqual(r, []);
  });

  it('la règle balaie aussi un document avec clé en double (appel direct de la règle)', () => {
    const texte = 'version_schema: 1\nbloc: a\nbloc: b\nliste:\n  - x: 1\n  - propositions: 2\n';
    const { doc, lc } = parseYaml(texte, 'x.yaml');
    const f = regleChamps.run({ collection: 'candidats', id: 'x', file: 'x.yaml', doc, lc }, {} as RuleContext);
    assert.deepEqual(
      f.map((x) => [x.code, x.pointer, x.at?.line]),
      [
        ['CHAMP_NON_IMPORTABLE', '/bloc', 2],
        ['CHAMP_NON_IMPORTABLE', '/bloc', 3],
        ['CHAMP_NON_IMPORTABLE', '/liste/1/propositions', 6],
      ],
    );
  });

  it('les clés échappent « / » et « ~ » dans le pointeur', () => {
    const { doc, lc } = parseYaml('"a/b~c":\n  extdroite: 1\n', 'x.yaml');
    const f = regleChamps.run({ collection: 'candidats', id: 'x', file: 'x.yaml', doc, lc }, {} as RuleContext);
    assert.deepEqual(f.map((x) => x.pointer), ['/a~1b~0c/extdroite']);
  });
});
