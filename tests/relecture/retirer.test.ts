import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { LoadOptions } from '../../src/lib/content-core/load.ts';
import { retirer } from '../../scripts/lib/relecture/commandes/retirer.ts';
import type { CibleRetrait, OptionsRetirer } from '../../scripts/lib/relecture/commandes/retirer.ts';
import { lireJournal } from '../../scripts/lib/relecture/registre.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import { FICHIER_COUVERTURE, FICHIER_THEME, MESURE_ELISE, MESURE_MARIE_1, MESURE_MARIE_2, THEME, contexteTest, themePublie } from './etat-publie.ts';

// Commande `retirer` (09-06, LEG-03) sur une copie temporaire du corpus fictif M1 mis dans l'état « logement publié » :
// Marie a deux mesures publiées, Élise une seule (sa case dit `mesures`).

after(() => nettoyerCorpusRelecture());

const OPTIONS: OptionsRetirer = { relecteur: 'Erwan Henry', date: '2026-11-30', dryRun: false };
const BLOC_ELISE = '  - candidat: elise-erard\n    etat: mesures\n    verifie_le: 2026-11-20\n    verifie_par: Erwan Henry\n';

function lancer(c: CorpusRelecture, cible: CibleRetrait, options: Partial<OptionsRetirer> = {}, opts: { maintenant?: Date; charger?: (r: string, o: LoadOptions) => ReturnType<typeof loadAll> } = {}) {
  const t = contexteTest(c.racine, opts.maintenant);
  const code = retirer(cible, { ...OPTIONS, ...options }, opts.charger ? { ctx: t.ctx, charger: opts.charger } : { ctx: t.ctx });
  return { code, sortie: t.sortie.join('\n'), erreur: t.erreur.join('\n') };
}
const erreursProduction = (c: CorpusRelecture) => loadAll(c.racine, { mode: 'production', schemasDir: SCHEMAS_DIR }).diagnostics.filter((d) => d.severity === 'error');
const u8 = (t: string | undefined): string => Buffer.from(t ?? '', 'latin1').toString('utf8');
const modifies = (avant: Map<string, string>, apres: Map<string, string>) => [...new Set([...avant.keys(), ...apres.keys()])].filter((k) => avant.get(k) !== apres.get(k)).sort();

describe('relecture retirer (corpus M1 temporaire, logement publié)', () => {
  let c: CorpusRelecture;
  beforeEach(() => {
    c = corpusRelecture();
    themePublie(c);
  });

  it('état de départ sain : zéro erreur de production', () => {
    assert.deepEqual(erreursProduction(c), []);
  });

  it('candidat avec deux mesures publiées : une ligne change, aucune case touchée, --case refusé', () => {
    const avant = c.arbre();
    const inutile = lancer(c, { type: 'mesure', id: 'marie-fictive/aide-construction' }, { cas: { etat: 'programme_non_publie' } });
    assert.equal(inutile.code, 1);
    assert.match(inutile.erreur, /--case inutile : marie-fictive garde 1 autre/);
    assert.deepEqual(c.arbre(), avant);

    const r = lancer(c, { type: 'mesure', id: 'marie-fictive/aide-construction' });
    assert.equal(r.code, 0, r.erreur);
    assert.deepEqual(modifies(avant, c.arbre()), [MESURE_MARIE_1]);
    assert.deepEqual(c.lire(MESURE_MARIE_1).split('\n'), u8(avant.get(MESURE_MARIE_1)).replace('statut_relecture: publie\n', 'statut_relecture: brouillon\n').split('\n'));
    assert.deepEqual(erreursProduction(c), []);
    assert.match(r.sortie, /étapes suivantes/);
    assert.equal(lireJournal(c.racine).filter((l) => l.action === 'retirer').length, 1);
  });

  it('seule mesure publiée du candidat, sans --case : refus avec le piège et les deux lignes prêtes à copier', () => {
    const avant = c.arbre();
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' });
    assert.equal(r.code, 1);
    assert.match(r.erreur, /EQUITE_COUVERTURE_INCOHERENTE/);
    assert.match(r.erreur, /retirer elise-erard\/guichet-unique --case non_precise --sources programme-commun-fictif$/m);
    assert.match(r.erreur, /retirer elise-erard\/guichet-unique --case programme_non_publie$/m);
    assert.deepEqual(c.arbre(), avant);
  });

  it('--case non_precise : mesure à brouillon et case mise à jour ensemble, octets hors lignes touchées inchangés', () => {
    const avant = c.arbre();
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' }, { cas: { etat: 'non_precise', sources: ['programme-commun-fictif'] } });
    assert.equal(r.code, 0, r.erreur);
    assert.deepEqual(modifies(avant, c.arbre()), [FICHIER_COUVERTURE, MESURE_ELISE].sort());
    assert.deepEqual(c.lire(MESURE_ELISE).split('\n'), u8(avant.get(MESURE_ELISE)).replace('statut_relecture: publie\n', 'statut_relecture: brouillon\n').split('\n'));
    const attendu = u8(avant.get(FICHIER_COUVERTURE)).replace(BLOC_ELISE, '  - candidat: elise-erard\n    etat: non_precise\n    sources_consultees:\n      - programme-commun-fictif\n    verifie_le: 2026-11-30\n    verifie_par: Erwan Henry\n');
    assert.notEqual(attendu, avant.get(FICHIER_COUVERTURE));
    assert.deepEqual(c.lire(FICHIER_COUVERTURE).split('\n'), attendu.split('\n'));
    assert.deepEqual(erreursProduction(c), []);
    assert.deepEqual(lireJournal(c.racine).filter((l) => l.action === 'retirer').map((l) => l.cible).sort(), ['case:logement/elise-erard', 'mesure:elise-erard/guichet-unique']);
  });

  it('--case programme_non_publie : l’état et les deux champs de vérification changent, pas de liste de sources', () => {
    const avant = c.arbre();
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' }, { cas: { etat: 'programme_non_publie' }, relecteur: 'Anne Relectrice' });
    assert.equal(r.code, 0, r.erreur);
    const attendu = u8(avant.get(FICHIER_COUVERTURE)).replace(BLOC_ELISE, '  - candidat: elise-erard\n    etat: programme_non_publie\n    verifie_le: 2026-11-30\n    verifie_par: Anne Relectrice\n');
    assert.deepEqual(c.lire(FICHIER_COUVERTURE).split('\n'), attendu.split('\n'));
    assert.deepEqual(erreursProduction(c), []);
  });

  it('refuse une source qui n’est pas celle du candidat (rien d’écrit)', () => {
    const avant = c.arbre();
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' }, { cas: { etat: 'non_precise', sources: ['marie-fictive-programme'] } });
    assert.equal(r.code, 1);
    assert.match(r.erreur, /pas une source de elise-erard/);
    assert.deepEqual(c.arbre(), avant);
  });

  it('refuse une mesure inconnue ou non publiée', () => {
    assert.equal(lancer(c, { type: 'mesure', id: 'elise-erard/inexistante' }).code, 1);
    c.ecrire(MESURE_MARIE_2, c.lire(MESURE_MARIE_2).replace('statut_relecture: publie\n', 'statut_relecture: brouillon\n'));
    const r = lancer(c, { type: 'mesure', id: 'marie-fictive/encadrement-loyers' });
    assert.equal(r.code, 1);
    assert.match(r.erreur, /n’est pas publiée/);
  });

  it('--theme : le thème repasse à brouillon, aucune mesure ni case touchée, zéro erreur', () => {
    const avant = c.arbre();
    const r = lancer(c, { type: 'theme', theme: THEME });
    assert.equal(r.code, 0, r.erreur);
    assert.deepEqual(modifies(avant, c.arbre()), [FICHIER_THEME]);
    assert.deepEqual(c.lire(FICHIER_THEME).split('\n'), u8(avant.get(FICHIER_THEME)).replace('statut_relecture: publie\n', 'statut_relecture: brouillon\n').split('\n'));
    assert.match(r.sortie, /config\/publication\.yml peut garder le thème/);
    assert.deepEqual(erreursProduction(c), []);
    assert.equal(lancer(c, { type: 'theme', theme: THEME }).code, 1);
    assert.equal(lancer(c, { type: 'theme', theme: 'inconnu' }).code, 1);
  });

  it('--dry-run : rien n’est écrit, ni fichier ni registre', () => {
    const avant = c.arbre();
    const journal = lireJournal(c.racine).length;
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' }, { dryRun: true, cas: { etat: 'programme_non_publie' } });
    assert.equal(r.code, 0);
    assert.match(r.sortie, /essai à blanc/);
    assert.equal(lancer(c, { type: 'theme', theme: THEME }, { dryRun: true }).code, 0);
    assert.deepEqual(c.arbre(), avant);
    assert.equal(lireJournal(c.racine).length, journal);
  });

  it('échec de la validation après écriture (chargeur injecté) : tous les octets restaurés', () => {
    const avant = c.arbre();
    const journal = lireJournal(c.racine).length;
    const charger = (racine: string, opts: LoadOptions): ReturnType<typeof loadAll> => {
      const r = loadAll(racine, opts);
      if (c.lire(MESURE_ELISE).includes('statut_relecture: brouillon')) {
        return { ...r, diagnostics: [...r.diagnostics, { code: 'EQUITE_COUVERTURE_INCOHERENTE', severity: 'error', file: c.chemin(FICHIER_COUVERTURE), line: 1, col: 1, pointer: '', message: 'incohérente (simulée)' }] };
      }
      return r;
    };
    const r = lancer(c, { type: 'mesure', id: 'elise-erard/guichet-unique' }, { cas: { etat: 'programme_non_publie' } }, { charger });
    assert.equal(r.code, 1);
    assert.match(r.erreur, /EQUITE_COUVERTURE_INCOHERENTE/);
    assert.match(r.erreur, /fichiers restaurés/);
    assert.deepEqual(c.arbre(), avant);
    assert.equal(lireJournal(c.racine).length, journal);
  });

  it('pendant une fenêtre de gel, rappelle les deux formes gh workflow run', () => {
    const r = lancer(c, { type: 'mesure', id: 'marie-fictive/aide-construction' }, {}, { maintenant: new Date('2027-04-17T10:00:00+02:00') });
    assert.equal(r.code, 0, r.erreur);
    assert.match(r.sortie, /gh workflow run ci\.yml --ref main -f retrait_urgence=true -f justification="Retrait de la mesure marie-fictive\/aide-construction"/);
    assert.match(r.sortie, /gh workflow run rollback\.yml -f cible=production -f retrait_urgence=true/);
  });

  it('hors gel, pas de rappel gh', () => {
    const r = lancer(c, { type: 'mesure', id: 'marie-fictive/aide-construction' });
    assert.doesNotMatch(r.sortie, /gh workflow run/);
  });
});

describe('relecture retirer (outil en ligne de commande)', () => {
  it('usage : cible absente, chemin, option inconnue, --case incomplet', () => {
    const c = corpusRelecture();
    const avant = c.arbre();
    for (const args of [[], ['../x/y'], ['a/b', '--zzz'], ['a/b', '--case', 'non_precise'], ['a/b', '--case', 'x'], ['a/b', '--sources', 'x'], ['--theme', 'logement', 'a/b'], ['--theme', '../x']]) {
      assert.equal(c.lancer('retirer', ...args).code, 2, args.join(' '));
    }
    assert.deepEqual(c.arbre(), avant);
  });

  it('en ligne de commande (--root) : dry-run sans écriture, puis retrait réel d’une mesure', () => {
    const c = corpusRelecture();
    const avant = c.arbre();
    const seche = c.lancer('retirer', 'marie-fictive/aide-construction', '--dry-run');
    assert.equal(seche.code, 0, seche.stderr);
    assert.match(seche.stdout, /essai à blanc/);
    assert.deepEqual(c.arbre(), avant);
    const r = c.lancer('retirer', 'marie-fictive/aide-construction');
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(modifies(avant, c.arbre()), [MESURE_MARIE_1]);
    assert.equal(c.lancer('retirer', 'marie-fictive/aide-construction').code, 1);
  });
});
