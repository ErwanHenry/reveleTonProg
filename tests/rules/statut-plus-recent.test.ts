import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { CATALOGUE } from '../../src/lib/content-core/rules/config.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import { construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import { publier } from '../../scripts/lib/relecture/commandes/publier.ts';
import { retirer } from '../../scripts/lib/relecture/commandes/retirer.ts';
import { DATE, THEME, contexteTest, themePret } from '../relecture/etat-publie.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';
import type { PiegeSpec, Remplacement } from '../helpers/overlay.ts';

// D-08, option B (Phase 10) : STATUT_PLUS_RECENT_NON_RELU. Personnes fictives seulement (corpus de base et corpus M1).
// Avertissement dans tous les modes : jamais une erreur, donc jamais un blocage (build, déploiement, publier,
// marquer, retirer). Les cas ci-dessous prouvent à la fois que la règle se déclenche (non vacuité) et qu'elle se tait.

after(() => {
  nettoyerRacines();
  nettoyerCorpusRelecture();
});

const CODE = 'STATUT_PLUS_RECENT_NON_RELU';
const JEAN = 'src/content/candidats/jean-imaginaire.yaml';
const FIN_JEAN = '    date_relecture: 2026-10-14\n';

/** Nouvelle entrée de Jean, ajoutée après son statut relu `declare` du 2026-10-12. */
const entree = (code: string, date: string, relecture: 'brouillon' | 'relu' = 'brouillon'): Remplacement => ({
  fichier: JEAN,
  de: FIN_JEAN,
  par:
    FIN_JEAN +
    `  - code: ${code}\n${code === 'renonce' ? '    motif: retrait\n' : ''}    date: ${date}\n    source:\n      type: candidat\n      titre: Annonce (fictive)\n` +
    '      url: https://jean-imaginaire.exemple.invalid/annonce\n      date_consultation: 2026-11-09\n' +
    `    statut_relecture: ${relecture}\n` +
    (relecture === 'relu' ? '    relecteur: Erwan Henry\n    date_relecture: 2026-11-10\n' : ''),
});

type Diag = ReturnType<typeof executerPiege>[number];
const lancer = (remplacer: Remplacement[], mode: Mode): Diag[] => {
  const spec: PiegeSpec = { piege: 'test', regle: 'REGLE-08', mode, remplacer, attendu: [] };
  return executerPiege(spec);
};
const alertes = (remplacer: Remplacement[], mode: Mode): Diag[] => lancer(remplacer, mode).filter((d) => d.code === CODE);

describe('D-08 option B : STATUT_PLUS_RECENT_NON_RELU (règle)', () => {
  it('le corpus de base ne produit aucun diagnostic, ni cet avertissement, dans les deux modes', () => {
    assert.deepEqual(lancer([], 'production'), []);
    assert.deepEqual(lancer([], 'preview'), []);
  });

  it('un renoncement plus récent et non relu : un avertissement par mode, jamais une erreur, sur l’entrée la plus récente', () => {
    for (const mode of ['production', 'preview'] as const) {
      const r = alertes([entree('renonce', '2026-11-05')], mode);
      assert.equal(r.length, 1, mode);
      assert.equal(r[0]?.severite, 'warning', mode);
      assert.equal(r[0]?.fichier, JEAN);
      assert.equal(r[0]?.pointer, '/statuts/1/statut_relecture');
    }
  });

  it('WR-01 gardé : en production, le même cas ne produit aucune erreur d’équité (la personne reste dans le périmètre)', () => {
    const tous = lancer([entree('renonce', '2026-11-05')], 'production');
    assert.deepEqual(tous.filter((d) => d.severite === 'error'), []);
    assert.deepEqual(tous.map((d) => d.code), [CODE]);
  });

  it('le message nomme les deux statuts et les deux dates, sans mot interdit', () => {
    const [d] = alertes([entree('renonce', '2026-11-05')], 'production');
    assert.ok(d);
    const racine = construireRacine({ piege: 'test', regle: 'REGLE-08', remplacer: [entree('renonce', '2026-11-05')], attendu: [] });
    const p = spawnSync(process.execPath, ['scripts/validate.ts', '--root', racine, '--mode', 'production'], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const ligne = p.stdout.split('\n').find((l) => l.includes(CODE)) ?? '';
    assert.match(ligne, /le statut le plus récent de jean-imaginaire \(renonce, 2026-11-05\) n'est pas relu : la production affiche encore declare du 2026-10-12/);
    assert.deepEqual(motsInterdits(ligne), []);
    assert.deepEqual(motsInterdits(CATALOGUE.find((c) => c.code === CODE)?.libelle ?? ''), []);
  });

  it('la même entrée marquée relue : aucun avertissement', () => {
    assert.deepEqual(alertes([entree('renonce', '2026-11-05', 'relu')], 'production'), []);
    assert.deepEqual(alertes([entree('renonce', '2026-11-05', 'relu')], 'preview'), []);
  });

  it('une entrée non relue plus ancienne que le statut relu : aucun avertissement', () => {
    assert.deepEqual(alertes([entree('renonce', '2026-09-01')], 'production'), []);
    assert.deepEqual(alertes([entree('renonce', '2026-09-01')], 'preview'), []);
  });

  it('une personne sans aucun statut relu (nouvelle personne) : aucun avertissement', () => {
    const toutBrouillon: Remplacement = { fichier: JEAN, de: 'statut_relecture: relu\n    relecteur: Erwan Henry\n    date_relecture: 2026-10-14\n', par: 'statut_relecture: brouillon\n' };
    assert.deepEqual(alertes([toutBrouillon], 'production'), []);
    assert.deepEqual(alertes([toutBrouillon], 'preview'), []);
  });

  it('un fichier candidat invalide : la règle se tait (pas de cascade)', () => {
    const invalide: Remplacement = { fichier: 'src/content/candidats/marie-fictive.yaml', de: 'nom_tri:', par: 'nom_tri_inconnu_du_schema:' };
    const r = lancer([entree('renonce', '2026-11-05'), invalide], 'production');
    assert.ok(r.some((d) => d.severite === 'error'), 'le fichier invalide doit produire son erreur de schéma');
    assert.deepEqual(r.filter((d) => d.code === CODE), []);
  });

  it('catalogue : avertissement, REGLE-08, sans piège', () => {
    const e = CATALOGUE.find((c) => c.code === CODE);
    assert.ok(e);
    assert.equal(e.regle, 'REGLE-08');
    assert.equal(e.severite, 'avertissement');
    assert.equal(e.piege, null);
  });
});

describe('D-08 option B : l’avertissement ne bloque jamais (corpus M1 temporaire)', () => {
  const LUC = 'src/content/candidats/luc-retire.yaml';
  /**
   * Luc (renoncement relu) reçoit une nouvelle entrée « renonce » plus récente et non relue (nouvelle source) : la production
   * garde l'ancienne. Le code reste hors périmètre, donc l'outil de relecture ne demande rien d'autre : seul l'avertissement s'allume.
   */
  const reprise =
    '  - code: renonce\n    motif: retrait\n    date: 2026-11-05\n    source:\n      type: candidat\n      titre: Annonce (fictive)\n' +
    '      url: https://luc-retire.exemple.invalid/retrait-confirme\n      date_consultation: 2026-11-06\n    statut_relecture: brouillon\n';
  const valider = (racine: string, mode: Mode) =>
    spawnSync(process.execPath, ['scripts/validate.ts', '--root', racine, '--mode', mode], { cwd: REPO_ROOT, encoding: 'utf8' });
  const avertissements = (sortie: string): string[] => sortie.split('\n').filter((l) => l.includes(CODE));

  it('validate : code 0 et l’avertissement affiché, en production et en preview', () => {
    const c = corpusRelecture();
    c.ecrire(LUC, c.lire(LUC) + reprise);
    for (const mode of ['production', 'preview'] as const) {
      const p = valider(c.racine, mode);
      assert.equal(p.status, 0, p.stdout + p.stderr);
      assert.equal(avertissements(p.stdout).length, 1, p.stdout);
      assert.match(p.stdout, / 0 erreur\(s\)/);
    }
  });

  it('publier puis retirer réussissent pendant que l’avertissement s’affiche, et marquer règle la cause', () => {
    const c = corpusRelecture();
    themePret(c);
    c.ecrire(LUC, c.lire(LUC) + reprise);
    assert.equal(avertissements(valider(c.racine, 'production').stdout).length, 1);

    const t = contexteTest(c.racine);
    assert.equal(publier(THEME, { relecteur: 'Erwan Henry', date: DATE, dryRun: false }, { ctx: t.ctx }), 0, t.erreur.join(' | '));
    assert.equal(avertissements(valider(c.racine, 'production').stdout).length, 1, 'publier ne règle pas la cause');

    const r = contexteTest(c.racine);
    const code = retirer({ type: 'mesure', id: 'marie-fictive/aide-construction' }, { relecteur: 'Erwan Henry', date: '2026-11-30', dryRun: false }, { ctx: r.ctx });
    assert.equal(code, 0, r.erreur.join(' | '));
    assert.equal(avertissements(valider(c.racine, 'production').stdout).length, 1, 'retirer ne règle pas la cause');

    // marquer n’est pas bloqué non plus, et relire l’entrée de Luc fait disparaître l’avertissement.
    const luc = c.lancer('marquer', 'statut', 'luc-retire', '--hors-perimetre');
    assert.equal(luc.code, 0, luc.stderr);
    assert.deepEqual(avertissements(valider(c.racine, 'production').stdout), []);
  });
});
