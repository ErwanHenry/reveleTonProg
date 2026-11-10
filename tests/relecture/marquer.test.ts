import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import type { LoadOptions } from '../../src/lib/content-core/load.ts';
import { marquer } from '../../scripts/lib/relecture/commandes/marquer.ts';
import type { Contexte } from '../../scripts/lib/relecture/etat.ts';
import { empreinteMesure } from '../../scripts/lib/relecture/etat.ts';
import { lireJournal, lireNotes } from '../../scripts/lib/relecture/registre.ts';
import { principal } from '../../scripts/relecture.ts';
import { corpusRelecture, lancerDepuis, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import { parse } from 'yaml';

// Commande `marquer` (09-01, PUB-01, D-04) sur une copie temporaire du corpus fictif M1 : chaque écriture ne
// touche que les champs de relecture du fichier visé, chaque refus laisse l'arbre octet pour octet.

const MESURE = 'src/content/mesures/elise-erard/guichet-unique.yaml';
const PAUL = 'src/content/candidats/paul-de-villefranche.yaml';
const COUV = 'src/content/couverture/logement.yaml';

after(() => nettoyerCorpusRelecture());

/** L'arbre a-t-il changé ailleurs que dans `sauf` ? Renvoie les chemins modifiés. */
function differences(avant: Map<string, string>, apres: Map<string, string>): string[] {
  const cles = new Set([...avant.keys(), ...apres.keys()]);
  return [...cles].filter((k) => avant.get(k) !== apres.get(k)).sort();
}

describe('relecture marquer (CLI, corpus M1 temporaire)', () => {
  let c: CorpusRelecture;
  beforeEach(() => {
    c = corpusRelecture();
  });

  it('marque une mesure en brouillon : 1 ligne modifiée, 2 ajoutées, aucun autre octet du corpus', () => {
    const avant = c.arbre();
    const original = c.lire(MESURE);
    const r = c.lancer('marquer', 'mesure', 'elise-erard/guichet-unique', '--date', '2026-11-20');
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^relu : mesure:elise-erard\/guichet-unique \(Erwan Henry, 2026-11-20\)$/m);
    assert.deepEqual(differences(avant, c.arbre()), [MESURE]);
    const attendu = original.replace('statut_relecture: brouillon\n', 'statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: 2026-11-20\n');
    assert.deepEqual(c.lire(MESURE).split('\n'), attendu.split('\n'));
    // Registre : une ligne, empreinte du contenu relu.
    const journal = lireJournal(c.racine);
    assert.equal(journal.length, 1);
    assert.equal(journal[0]?.cible, 'mesure:elise-erard/guichet-unique');
    assert.equal(journal[0]?.action, 'marquer');
    assert.equal(journal[0]?.relecteur, 'Erwan Henry');
    assert.equal(journal[0]?.date, '2026-11-20');
    assert.equal(journal[0]?.sha256, empreinteMesure(parse(original) as Record<string, unknown>));
  });

  it('marque un statut déclaré (3 champs sur statuts[0]) et une case (verifie_le, verifie_par)', () => {
    const avant = c.arbre();
    const s = c.lancer('marquer', 'statut', 'paul-de-villefranche', '--date', '2026-11-20');
    assert.equal(s.code, 0, s.stderr);
    assert.ok(c.lire(PAUL).endsWith('    statut_relecture: relu\n    relecteur: Erwan Henry\n    date_relecture: 2026-11-20\n'));
    const k = c.lancer('marquer', 'case', 'logement', 'paul-de-villefranche', '--date', '2026-11-21', '--relecteur', 'Anne Relectrice');
    assert.equal(k.code, 0, k.stderr);
    assert.ok(c.lire(COUV).endsWith('  - candidat: paul-de-villefranche\n    etat: programme_non_publie\n    verifie_le: 2026-11-21\n    verifie_par: Anne Relectrice\n'));
    assert.deepEqual(differences(avant, c.arbre()), [PAUL, COUV].sort());
    assert.deepEqual(lireJournal(c.racine).map((l) => l.cible), ['statut:paul-de-villefranche', 'case:logement/paul-de-villefranche']);
  });

  it('refus (code 1, rien d’écrit) : cible inconnue, mesure publiée, hors périmètre, date partielle, fichier invalide', () => {
    const cas: [string[], RegExp, (() => void)?][] = [
      [['mesure', 'elise-erard/inexistante'], /mesure inconnue/],
      [['mesure', 'marie-fictive/aide-construction'], /déjà publiée/],
      [['statut', 'nina-pressentie'], /hors du périmètre/],
      [['statut', 'inconnu-total'], /candidat inconnu/],
      [['case', 'logement', 'nina-pressentie'], /aucune case/],
      [['statut', 'paul-de-villefranche'], /date du statut incomplète/, () => c.ecrire(PAUL, c.lire(PAUL).replace('date: 2026-10-19', 'date: 2026-10'))],
      [['mesure', 'elise-erard/guichet-unique'], /mesure inconnue \(ou fichier invalide/, () => c.ecrire(MESURE, `${c.lire(MESURE)}cle_inconnue: 1\n`)],
    ];
    for (const [args, motif, preparer] of cas) {
      preparer?.();
      const avant = c.arbre();
      const r = c.lancer('marquer', ...args, '--date', '2026-11-20');
      assert.equal(r.code, 1, `${args.join(' ')} : ${r.stderr}`);
      assert.match(r.stderr, motif, args.join(' '));
      assert.deepEqual(differences(avant, c.arbre()), [], args.join(' '));
    }
    assert.equal(existsSync(path.join(c.racine, 'relecture', 'journal.jsonl')), false);
  });

  it('hors périmètre accepté avec --hors-perimetre (statut pressenti à date complète)', () => {
    const r = c.lancer('marquer', 'statut', 'nina-pressentie', '--hors-perimetre', '--date', '2026-11-20');
    assert.equal(r.code, 0, r.stderr);
  });

  it('usage (code 2) : chemin au lieu d’un identifiant, relecteur ou date invalides', () => {
    const avant = c.arbre();
    for (const args of [
      ['mesure', '../../etc/passwd'],
      ['mesure', 'src/content/mesures/elise-erard/guichet-unique.yaml'],
      ['mesure', 'elise-erard/guichet-unique', '--relecteur', 'x: y'],
      ['mesure', 'elise-erard/guichet-unique', '--date', '2026-13-01'],
      ['mesure'],
      ['tout'],
    ]) {
      const r = c.lancer('marquer', ...args);
      assert.equal(r.code, 2, `${args.join(' ')} : ${r.stderr}`);
    }
    assert.deepEqual(differences(avant, c.arbre()), []);
  });

  it('note ouverte : refus sans --malgre-note, écriture avec ; résolution', () => {
    const n = c.lancer('note', 'mesure:elise-erard/guichet-unique', 'vérifier', 'la', 'page', '2');
    assert.equal(n.code, 0, n.stderr);
    const avant = c.arbre();
    assert.deepEqual(differences(avant, c.arbre()), []);
    const refus = c.lancer('marquer', 'mesure', 'elise-erard/guichet-unique', '--date', '2026-11-20');
    assert.equal(refus.code, 1);
    assert.match(refus.stderr, /note\(s\) ouverte\(s\)/);
    assert.match(refus.stderr, /vérifier la page 2/);
    assert.deepEqual(differences(avant, c.arbre()), []);
    const ok = c.lancer('marquer', 'mesure', 'elise-erard/guichet-unique', '--date', '2026-11-20', '--malgre-note');
    assert.equal(ok.code, 0, ok.stderr);
    const res = c.lancer('note', '--resoudre', 'mesure:elise-erard/guichet-unique');
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(lireNotes(c.racine).map((l) => l.etat), ['ouverte', 'resolue']);
  });

  it('note : texte trop long, caractère de contrôle, cible inconnue ; jamais d’écriture dans src/content', () => {
    const avant = c.arbre();
    assert.equal(c.lancer('note', 'mesure:elise-erard/guichet-unique', 'x'.repeat(501)).code, 2);
    assert.equal(c.lancer('note', 'mesure:elise-erard/guichet-unique', 'a\u0007b').code, 2);
    assert.equal(c.lancer('note', 'mesure:elise-erard/autre', 'texte').code, 1);
    assert.equal(c.lancer('note', '../x', 'texte').code, 2);
    assert.equal(c.lancer('note', 'statut:paul-de-villefranche', 'x'.repeat(500)).code, 0);
    assert.equal(c.lancer('note', 'case:logement/paul-de-villefranche', 'date à revoir').code, 0);
    assert.deepEqual(differences(avant, c.arbre()), []);
    assert.equal(lireNotes(c.racine).length, 2);
  });

  it('restaure les octets d’origine quand une erreur nouvelle apparaît après écriture', () => {
    const original = readFileSync(c.chemin(MESURE));
    let appels = 0;
    const chargeur = (racine: string, opts: LoadOptions) => {
      const r = loadAll(racine, opts);
      appels++;
      if (appels === 2) r.diagnostics.push({ code: 'ERREUR_FORCEE', severity: 'error', file: c.chemin(MESURE), line: 1, col: 1, pointer: '', message: 'erreur injectée par le test' });
      return r;
    };
    const lignes: string[] = [];
    const ctx: Contexte = { racine: c.racine, schemasDir: SCHEMAS_DIR, sortie: (l) => lignes.push(l), erreur: (l) => lignes.push(l), maintenant: () => new Date('2026-11-20T10:00:00Z') };
    const code = marquer({ type: 'mesure', id: 'elise-erard/guichet-unique' }, { relecteur: 'Erwan Henry', date: '2026-11-20', malgreNote: false, horsPerimetre: false }, { ctx, charger: chargeur });
    assert.equal(code, 1);
    assert.equal(appels, 2);
    assert.ok(lignes.some((l) => l.includes('ERREUR_FORCEE')), lignes.join('\n'));
    assert.ok(lignes.some((l) => l.includes('fichier restauré')));
    assert.deepEqual(readFileSync(c.chemin(MESURE)), original);
    assert.equal(lireJournal(c.racine).length, 0);
  });
});

describe('relecture : répartiteur de commandes', () => {
  const muet = (): { ctx: Omit<Contexte, 'racine' | 'schemasDir'>; lignes: string[] } => {
    const lignes: string[] = [];
    return { lignes, ctx: { sortie: (l) => lignes.push(l), erreur: (l) => lignes.push(l), maintenant: () => new Date() } };
  };

  it('commande inconnue : code 2 et usage ; commande connue non installée : code 2', async () => {
    const a = muet();
    assert.equal(await principal(['inventer'], a.ctx, REPO_ROOT), 2);
    assert.ok(a.lignes.some((l) => l.includes('commande inconnue')));
    for (const nom of ['servir', 'publier', 'retirer']) {
      if (existsSync(path.join(REPO_ROOT, 'scripts', 'lib', 'relecture', 'commandes', `${nom}.ts`))) continue;
      const b = muet();
      assert.equal(await principal([nom], b.ctx, REPO_ROOT), 2);
      assert.ok(b.lignes.some((l) => l.includes('commande pas encore installée')), nom);
    }
    assert.equal(await principal(['--inconnue', 'x', 'liste'], muet().ctx, REPO_ROOT), 2);
  });

  it('refuse de tourner sous tests/fixtures/ sans --root', () => {
    const r = lancerDepuis(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-m1'), 'liste');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /tests\/fixtures/);
  });
});
