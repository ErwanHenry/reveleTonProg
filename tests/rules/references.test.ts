import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { slugGlossaire } from '../../src/lib/content-core/rules/references.ts';
import { construireRacine, executerPiege, nettoyerRacines } from '../helpers/overlay.ts';
import type { PiegeSpec, Remplacement } from '../helpers/overlay.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

after(() => nettoyerRacines());

const MESURE = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
const THEME = 'src/content/themes/logement.yaml';
const COUVERTURE = 'src/content/couverture/logement.yaml';
const SONDAGE = 'src/content/sondages/sondage-fictif-1.yaml';
const JOURNAL = 'src/content/journal/20261103-001.yaml';
const JEAN = 'src/content/candidats/jean-imaginaire.yaml';
const MARIE = 'src/content/candidats/marie-fictive.yaml';

const spec = (remplacer: Remplacement[]): PiegeSpec => ({ piege: 'test', regle: 'REGLE-07', mode: 'production', remplacer, attendu: [] });
type Triplet = [string, string, string];

/** Diagnostics de la famille testée (les autres familles sont couvertes par leurs propres tests). */
const filtrer = (remplacer: Remplacement[], motif: RegExp): Triplet[] =>
  executerPiege(spec(remplacer))
    .filter((d) => motif.test(d.code))
    .map((d): Triplet => [d.code, d.fichier, d.pointer])
    .sort();

const refs = (remplacer: Remplacement[]): Triplet[] => filtrer(remplacer, /^REFERENCE_CASSEE$/);
const casse = (fichier: string, pointer: string): Triplet => ['REFERENCE_CASSEE', fichier, pointer];

describe('REFERENCE_CASSEE', () => {
  it('le corpus de référence ne produit aucune référence cassée ni problème d’identifiant', () => {
    assert.deepEqual(filtrer([], /^(REFERENCE_CASSEE|ID_|IDS_)/), []);
  });

  it('thème inexistant sur une mesure', () => {
    assert.deepEqual(refs([{ fichier: MESURE, de: 'theme: logement\n', par: 'theme: inexistant\n' }]), [casse(MESURE, '/theme')]);
  });

  it('sous-thème inexistant sur une mesure', () => {
    assert.deepEqual(refs([{ fichier: MESURE, de: 'sous_theme: loyers\n', par: 'sous_theme: inexistant\n' }]), [casse(MESURE, '/sous_theme')]);
  });

  it('couverture : thème et candidat inexistants', () => {
    assert.deepEqual(
      refs([
        { fichier: COUVERTURE, de: 'theme: logement\n', par: 'theme: inexistant\n' },
        { fichier: COUVERTURE, de: '  - candidat: jean-imaginaire\n', par: '  - candidat: jean-inconnu\n' },
      ]),
      [casse(COUVERTURE, '/cases/1/candidat'), casse(COUVERTURE, '/theme')],
    );
  });

  it('couverture : source consultée inexistante', () => {
    assert.deepEqual(
      refs([
        {
          fichier: COUVERTURE,
          de: '    etat: programme_non_publie\n',
          par: '    etat: programme_non_publie\n    sources_consultees:\n      - inconnue\n',
        },
      ]),
      [casse(COUVERTURE, '/cases/1/sources_consultees/0')],
    );
  });

  it('sondage : candidat inexistant dans un score', () => {
    assert.deepEqual(
      refs([{ fichier: SONDAGE, de: '      - candidat: jean-imaginaire\n', par: '      - candidat: jean-inconnu\n' }]),
      [casse(SONDAGE, '/hypotheses/0/scores/1/candidat')],
    );
  });

  it('journal : id_cible d’un ajout ou d’une correction qui ne mène nulle part', () => {
    const cible = { fichier: JOURNAL, de: 'id_cible: marie-fictive/encadrement-loyers\n', par: 'id_cible: marie-fictive/inconnue\n' };
    assert.deepEqual(refs([cible]), [casse(JOURNAL, '/id_cible')]);
    assert.deepEqual(refs([cible, { fichier: JOURNAL, de: 'type: ajout\n', par: 'type: correction\n' }]), [casse(JOURNAL, '/id_cible')]);
  });

  it('journal : la cible d’un retrait est exemptée', () => {
    assert.deepEqual(
      refs([
        { fichier: JOURNAL, de: 'id_cible: marie-fictive/encadrement-loyers\n', par: 'id_cible: marie-fictive/inconnue\n' },
        { fichier: JOURNAL, de: 'type: ajout\n', par: 'type: retrait\n' },
      ]),
      [],
    );
  });

  it('renvois au glossaire : un terme inconnu est cassé, un terme connu non', () => {
    const detaille = (par: string): Remplacement => ({ fichier: MESURE, de: "d'encadrer les loyers. La mesure", par });
    assert.deepEqual(refs([detaille("d'encadrer les [[inconnu]]. La mesure")]), [casse(MESURE, '/redactions/detaille')]);
    assert.deepEqual(refs([detaille("d'encadrer les [[Loyer|inconnu]]. La mesure")]), [casse(MESURE, '/redactions/detaille')]);
    assert.deepEqual(refs([detaille("d'encadrer le [[loyer]]. La mesure")]), []);
    assert.deepEqual(refs([detaille("d'encadrer les [[Loyers|loyer]]. La mesure")]), []);
    assert.deepEqual(refs([detaille("d'encadrer les [[Prêt à porter]]. La mesure")]), [casse(MESURE, '/redactions/detaille')]);
  });

  it('une cible qui existe mais échoue son schéma n’est pas re-signalée (pas de cascade)', () => {
    const res = executerPiege(spec([{ fichier: THEME, de: 'ordre: 1\n', par: '' }]));
    assert.ok(res.some((d) => d.fichier === THEME && d.code.startsWith('SCHEMA_')), 'le thème invalide doit échouer son schéma');
    assert.deepEqual(res.filter((d) => d.code === 'REFERENCE_CASSEE'), []);
  });
});

describe('slugGlossaire', () => {
  it('plie les accents, la casse et la ponctuation', () => {
    assert.equal(slugGlossaire('Loyer'), 'loyer');
    assert.equal(slugGlossaire('Prêt à taux zéro'), 'pret-a-taux-zero');
    assert.equal(slugGlossaire("  l'État  "), 'l-etat');
  });
});

describe('identifiants verrouillés (ids.lock)', () => {
  const lock = (racine: string): string => path.join(racine, 'ids.lock');
  /** Charge une racine déjà préparée et ne garde que les codes ID_* / IDS_*. */
  const ids = (racine: string): { code: string; fichier: string; pointer: string; ligne: number }[] =>
    loadAll(racine, { schemasDir: SCHEMAS_DIR })
      .diagnostics.filter((d) => /^(ID_VERROUILLE|ID_NON_VERROUILLE|IDS_LOCK)/.test(d.code))
      .map((d) => ({ code: d.code, fichier: path.relative(racine, d.file).split(path.sep).join('/'), pointer: d.pointer, ligne: d.line }));

  it('ligne retirée du lock : ID_NON_VERROUILLE sur /id du candidat', () => {
    const racine = construireRacine(spec([]));
    writeFileSync(lock(racine), '# en-tête\njean-imaginaire\n');
    const r = ids(racine);
    assert.equal(r.length, 1);
    assert.equal(r[0]?.code, 'ID_NON_VERROUILLE');
    assert.equal(r[0]?.fichier, MARIE);
    assert.equal(r[0]?.pointer, '/id');
    assert.equal(r[0]?.ligne, 2);
  });

  it('candidat renommé : ID_VERROUILLE_DISPARU sur ids.lock, ID_NON_VERROUILLE pour le nouvel id', () => {
    const racine = construireRacine(
      spec([
        { fichier: JEAN, de: 'id: jean-imaginaire\n', par: 'id: jean-nouveau\n' },
        { fichier: COUVERTURE, de: '  - candidat: jean-imaginaire\n', par: '  - candidat: jean-nouveau\n' },
        { fichier: SONDAGE, de: '      - candidat: jean-imaginaire\n', par: '      - candidat: jean-nouveau\n' },
      ]),
    );
    renameSync(path.join(racine, JEAN), path.join(racine, 'src/content/candidats/jean-nouveau.yaml'));
    const r = ids(racine);
    assert.deepEqual(
      r.map((d) => [d.code, d.fichier, d.pointer]).sort(),
      [
        ['ID_NON_VERROUILLE', 'src/content/candidats/jean-nouveau.yaml', '/id'],
        ['ID_VERROUILLE_DISPARU', 'ids.lock', ''],
      ],
    );
    // jean-imaginaire est à la ligne 3 de la fixture (deux lignes d'en-tête).
    assert.equal(r.find((d) => d.code === 'ID_VERROUILLE_DISPARU')?.ligne, 3);
  });

  it('lock supprimé : IDS_LOCK_ABSENT ligne 1', () => {
    const racine = construireRacine(spec([]));
    rmSync(lock(racine));
    assert.deepEqual(ids(racine), [{ code: 'IDS_LOCK_ABSENT', fichier: 'ids.lock', pointer: '', ligne: 1 }]);
  });

  it('lock mal trié : IDS_LOCK_INVALIDE à la ligne fautive', () => {
    const racine = construireRacine(spec([]));
    writeFileSync(lock(racine), '# en-tête\nmarie-fictive\njean-imaginaire\n');
    assert.deepEqual(ids(racine), [{ code: 'IDS_LOCK_INVALIDE', fichier: 'ids.lock', pointer: '', ligne: 3 }]);
  });

  it('candidat invalide au schéma : son id reste verrouillé (pas d’ID_VERROUILLE_DISPARU)', () => {
    const racine = construireRacine(spec([{ fichier: JEAN, de: 'prenom: Jean\n', par: '' }]));
    assert.deepEqual(ids(racine), []);
  });

  it('aucun candidat et aucun lock : rien', () => {
    const racine = construireRacine({ ...spec([]), supprimer: ['src/content/candidats', 'ids.lock'] });
    assert.deepEqual(ids(racine), []);
  });
});
