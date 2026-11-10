import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync } from 'node:fs';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { LoadOptions } from '../../src/lib/content-core/load.ts';
import { publier } from '../../scripts/lib/relecture/commandes/publier.ts';
import { appliquerLot } from '../../scripts/lib/relecture/lot.ts';
import { lireJournal } from '../../scripts/lib/relecture/registre.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';
import { DATE, FICHIER_COUVERTURE, FICHIER_THEME, MESURE_ELISE, MESURE_MARIE_1, MESURE_MARIE_2, THEME, contexteTest, themePret } from './etat-publie.ts';

// Commande `publier` (09-06, PUB-02) sur une copie temporaire du corpus fictif M1 : deuxième temps de la relecture,
// tout ou rien, jamais sur le vrai corpus.

after(() => nettoyerCorpusRelecture());

const OPTIONS = { relecteur: 'Erwan Henry', date: '2026-11-25', dryRun: false };
const NOTE_LISTE = 'themes_ouverts: []\n';

function lancer(c: CorpusRelecture, options = OPTIONS, charger?: (r: string, o: LoadOptions) => ReturnType<typeof loadAll>) {
  const t = contexteTest(c.racine);
  const code = publier(THEME, options, charger ? { ctx: t.ctx, charger } : { ctx: t.ctx });
  return { code, sortie: t.sortie, erreur: t.erreur };
}

describe('relecture publier (corpus M1 temporaire)', () => {
  let c: CorpusRelecture;
  beforeEach(() => {
    c = corpusRelecture();
    themePret(c);
  });

  it('chemin nominal : seules les lignes attendues changent, la validation de production ne signale aucune erreur', () => {
    const avant = c.arbre();
    const r = lancer(c);
    assert.equal(r.code, 0, r.erreur.join('\n'));
    assert.match(r.sortie.join('\n'), /^3 mesures publiées, thème logement publié$/m);
    const apres = c.arbre();
    const modifies = [...apres.keys()].filter((k) => avant.get(k) !== apres.get(k)).sort();
    assert.deepEqual(modifies, [FICHIER_THEME, MESURE_ELISE, MESURE_MARIE_1, MESURE_MARIE_2].sort());
    for (const f of [MESURE_ELISE, MESURE_MARIE_1, MESURE_MARIE_2]) {
      assert.deepEqual(apres.get(f)!.split('\n'), avant.get(f)!.replace('statut_relecture: relu\n', 'statut_relecture: publie\n').split('\n'));
    }
    const theme = apres.get(FICHIER_THEME)!;
    assert.match(theme, /^statut_relecture: publie$/m);
    assert.match(theme, /^relecteur: Erwan Henry$/m);
    assert.match(theme, /^date_relecture: 2026-11-25$/m);
    const prod = loadAll(c.racine, { mode: 'production', schemasDir: contexteTest(c.racine).ctx.schemasDir });
    assert.deepEqual(prod.diagnostics.filter((d) => d.severity === 'error'), []);
    const publies = lireJournal(c.racine).filter((l) => l.action === 'publier').map((l) => l.cible).sort();
    assert.deepEqual(publies, ['mesure:elise-erard/guichet-unique', 'mesure:marie-fictive/aide-construction', 'mesure:marie-fictive/encadrement-loyers', 'theme:logement']);
  });

  it('idempotent : le second passage ne change rien et dit « déjà publié »', () => {
    assert.equal(lancer(c).code, 0);
    const apres = c.arbre();
    const r = lancer(c);
    assert.equal(r.code, 0, r.erreur.join('\n'));
    assert.match(r.sortie.join('\n'), /déjà publié/);
    assert.deepEqual(c.arbre(), apres);
  });

  it('--dry-run : décrit ce qui changerait, n’écrit rien (ni fichier ni registre)', () => {
    const avant = c.arbre();
    const journal = lireJournal(c.racine).length;
    const r = lancer(c, { ...OPTIONS, dryRun: true });
    assert.equal(r.code, 0);
    assert.match(r.sortie.join('\n'), /3 mesure\(s\) passeraient à publie/);
    assert.deepEqual(c.arbre(), avant);
    assert.equal(lireJournal(c.racine).length, journal);
  });

  const refus: [string, (c: CorpusRelecture) => void, RegExp][] = [
    ['thème absent de la liste blanche', (k) => k.ecrire('config/publication.yml', NOTE_LISTE), /thème absent de config\/publication\.yml/],
    ['une mesure pas encore relue', (k) => k.ecrire(MESURE_ELISE, k.lire(MESURE_ELISE).replace('statut_relecture: relu\n', 'statut_relecture: brouillon\n')), /mesure:elise-erard\/guichet-unique : mesure pas encore relue/],
    ['un texte modifié depuis la relecture (a_revoir)', (k) => k.ecrire(MESURE_ELISE, k.lire(MESURE_ELISE).replace(/^(\s+resume: .*)$/m, '$1 Précision.')), /texte modifié depuis la relecture/],
    ['un statut déclaré pas relu', (k) => k.ecrire('src/content/candidats/elise-erard.yaml', k.lire('src/content/candidats/elise-erard.yaml').replace('statut_relecture: relu', 'statut_relecture: brouillon')), /statut:elise-erard/],
    ['une case de couverture pas relue', (k) => k.ecrire(FICHIER_COUVERTURE, k.lire(FICHIER_COUVERTURE).replace(/(candidat: marie-fictive[\s\S]*?verifie_par: )Erwan Henry/, '$1Autre Relecteur')), /case:logement\//],
    ['une note ouverte', (k) => appendFileSync(`${k.racine}/relecture/notes.jsonl`, `${JSON.stringify({ horodatage: '2026-11-21T10:00:00.000Z', cible: 'mesure:marie-fictive/aide-construction', texte: 'à corriger', etat: 'ouverte' })}\n`), /1 note\(s\) ouverte\(s\)/],
  ];
  for (const [nom, preparer, motif] of refus) {
    it(`refuse (code 1, rien d’écrit) : ${nom}`, () => {
      preparer(c);
      const avant = c.arbre();
      const r = lancer(c);
      assert.equal(r.code, 1);
      assert.match(r.erreur.join('\n'), motif);
      assert.deepEqual(c.arbre(), avant);
    });
  }

  it('refuse une mesure d’un candidat hors du périmètre d’équité', () => {
    const f = 'src/content/mesures/elise-erard/guichet-unique.yaml';
    // Une mesure de plus du thème, au nom d’un candidat hors périmètre (luc-retire a renoncé).
    mkdirSync(c.chemin('src/content/mesures/luc-retire'), { recursive: true });
    c.ecrire('src/content/mesures/luc-retire/une-mesure.yaml', c.lire(f).replace('candidat: elise-erard', 'candidat: luc-retire'));
    const r = lancer(c);
    assert.equal(r.code, 1);
    assert.match(r.erreur.join('\n'), /hors du périmètre|luc-retire/);
  });

  it('échec après les écritures : chaque fichier retrouve ses octets et le registre reste intact', () => {
    const avant = c.arbre();
    const journal = lireJournal(c.racine).length;
    let faux = false;
    // Chargeur qui, une fois le thème publié sur disque, déclare une erreur d’équité (le périmètre perd un candidat).
    const charger = (racine: string, opts: LoadOptions): ReturnType<typeof loadAll> => {
      const r = loadAll(racine, opts);
      if (opts.mode === 'production' && c.lire(FICHIER_THEME).includes('statut_relecture: publie')) {
        faux = true;
        return { ...r, diagnostics: [...r.diagnostics, { code: 'EQUITE_CANDIDAT_MANQUANT', severity: 'error', file: c.chemin(FICHIER_THEME), line: 1, col: 1, pointer: '', message: 'candidat sans mesure ni case' }] };
      }
      return r;
    };
    const r = lancer(c, OPTIONS, charger);
    assert.ok(faux, 'le chargeur de vérification n’a pas été appelé après écriture');
    assert.equal(r.code, 1);
    assert.match(r.erreur.join('\n'), /EQUITE_CANDIDAT_MANQUANT/);
    assert.match(r.erreur.join('\n'), /fichiers restaurés/);
    assert.deepEqual(c.arbre(), avant);
    assert.equal(lireJournal(c.racine).length, journal);
  });

  it('échec réel de la validation de production (case incohérente) : restauration complète', () => {
    // Élise a une mesure publiée mais sa case dit non_precise : la règle d’équité de production refuse.
    const couv = c.lire(FICHIER_COUVERTURE);
    c.ecrire(FICHIER_COUVERTURE, couv.replace('  - candidat: elise-erard\n    etat: mesures\n', '  - candidat: elise-erard\n    etat: programme_non_publie\n'));
    const avant = c.arbre();
    const r = lancer(c);
    assert.equal(r.code, 1);
    assert.match(r.erreur.join('\n'), /EQUITE_COUVERTURE_INCOHERENTE/);
    assert.deepEqual(c.arbre(), avant);
  });
});

describe('appliquerLot', () => {
  it('deux éditions sur le même fichier s’appliquent à la suite ; un refus en mémoire n’écrit rien', () => {
    const c = corpusRelecture();
    const fichier = c.chemin(MESURE_ELISE);
    const avant = c.lire(MESURE_ELISE);
    const refus = appliquerLot(c.racine, [{ fichier, chemin: [], champs: [{ cle: 'statut_relecture', valeur: 'relu' }] }, { fichier, chemin: [], champs: [{ cle: 'statut_relecture', valeur: 'nimporte' }] }], () => []);
    assert.equal(refus.ok, false);
    assert.equal(c.lire(MESURE_ELISE), avant);
    const ok = appliquerLot(c.racine, [{ fichier, chemin: [], champs: [{ cle: 'statut_relecture', valeur: 'relu' }] }, { fichier, chemin: [], champs: [{ cle: 'relecteur', valeur: 'Anne Relectrice' }, { cle: 'date_relecture', valeur: DATE }] }], () => []);
    assert.equal(ok.ok, true);
    assert.match(c.lire(MESURE_ELISE), /statut_relecture: relu\nrelecteur: Anne Relectrice\ndate_relecture: 2026-11-20\n/);
  });

  it('une vérification qui lève restaure tout', () => {
    const c = corpusRelecture();
    const avant = c.arbre();
    const r = appliquerLot(c.racine, [{ fichier: c.chemin(MESURE_ELISE), chemin: [], champs: [{ cle: 'statut_relecture', valeur: 'relu' }] }], () => {
      throw new Error('boum');
    });
    assert.equal(r.ok, false);
    assert.deepEqual(r.erreurs, ['boum']);
    assert.deepEqual(c.arbre(), avant);
  });
});

describe('relecture publier (outil en ligne de commande)', () => {
  it('sur un thème de la liste blanche mais pas relu : refus code 1, thème absent de la liste cité en clair', () => {
    const c = corpusRelecture();
    c.ecrire('config/publication.yml', NOTE_LISTE);
    const r = c.lancer('publier', '--theme', 'logement', '--dry-run');
    assert.equal(r.code, 1);
    assert.match(r.stderr, /thème absent de config\/publication\.yml/);
    assert.equal(c.lancer('publier').code, 2);
    assert.equal(c.lancer('publier', '--theme', '../x').code, 2);
    void REPO_ROOT;
  });
});
