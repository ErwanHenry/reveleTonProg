// D-05 au moment de la relecture : une personne déclarée ajoutée par l'import (piège
// EQUITE_CANDIDAT_MANQUANT--import-brouillon) ne peut pas être marquée relue tant que le thème publié
// n'a pas de case pour elle. `marquer statut` le refuse et restaure le fichier octet pour octet ; une
// fois la case posée, il réussit et la production est propre. Fixture fictive, racine temporaire.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { construireRacine, lirePiege, nettoyerRacines, PIEGES_DIR } from '../helpers/overlay.ts';
import { SCRIPT_RELECTURE } from '../helpers/corpus-relecture.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

after(() => nettoyerRacines());

const DOSSIER_BROUILLON = path.join(PIEGES_DIR, 'EQUITE_CANDIDAT_MANQUANT--import-brouillon');
const DOSSIER_AVEC_CASE = path.join(PIEGES_DIR, 'EQUITE_CANDIDAT_MANQUANT--import-relu-avec-case');
const FICHE = 'src/content/candidats/nouvelle-personne.yaml';
const COUVERTURE = 'src/content/couverture/logement.yaml';

function marquerStatut(racine: string): { code: number; sortie: string } {
  const r = spawnSync(process.execPath, [SCRIPT_RELECTURE, '--root', racine, 'marquer', 'statut', 'nouvelle-personne', '--date', '2026-11-12'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Europe/Paris' },
  });
  return { code: r.status ?? -1, sortie: `${r.stdout}${r.stderr}` };
}

describe('relecture marquer statut : personne ajoutée par l’import sur un thème publié (D-05)', () => {
  it('refuse tant que le thème publié n’a pas de case, restaure le fichier, puis réussit une fois la case posée', () => {
    const racine = construireRacine(lirePiege(DOSSIER_BROUILLON), DOSSIER_BROUILLON);
    const fiche = path.join(racine, FICHE);
    const original = readFileSync(fiche);

    // Avant tout : la production est propre, la personne en brouillon est invisible.
    assert.deepEqual(loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'production' }).diagnostics.filter((d) => d.severity === 'error'), []);

    const refus = marquerStatut(racine);
    assert.equal(refus.code, 1, refus.sortie);
    assert.match(refus.sortie, /EQUITE_CANDIDAT_MANQUANT/);
    assert.match(refus.sortie, /fichier restauré/);
    assert.deepEqual(readFileSync(fiche), original, 'le fichier doit retrouver ses octets d’origine');

    // La case est posée par le même texte que le piège --import-relu-avec-case.
    const patch = lirePiege(DOSSIER_AVEC_CASE).remplacer?.[0];
    assert.ok(patch, 'le piège --import-relu-avec-case doit porter le patch de la case');
    assert.equal(patch.fichier, COUVERTURE);
    const cheminCouverture = path.join(racine, COUVERTURE);
    const texte = readFileSync(cheminCouverture, 'utf8');
    assert.equal(texte.split(patch.de).length - 1, 1);
    writeFileSync(cheminCouverture, texte.replace(patch.de, () => patch.par));

    const succes = marquerStatut(racine);
    assert.equal(succes.code, 0, succes.sortie);
    const apres = parse(readFileSync(fiche, 'utf8'), { schema: 'core' }) as { statuts: Record<string, unknown>[] };
    assert.equal(apres.statuts[0]?.statut_relecture, 'relu');
    assert.equal(apres.statuts[0]?.relecteur, 'Erwan Henry');
    assert.equal(apres.statuts[0]?.date_relecture, '2026-11-12');
    const erreurs = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: 'production' }).diagnostics.filter((d) => d.severity === 'error');
    assert.deepEqual(erreurs, []);
  });
});
