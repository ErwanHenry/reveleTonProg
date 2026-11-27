// Phase 10.3, plan 08 : préparation d'un passage automatique, sur un monde simulé (copie du dépôt, origine nue locale,
// HOME temporaire, faux claude, faux ci:local). Aucun GitHub, aucun serveur, aucun vrai claude, aucun réseau.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MESSAGE_VERROU_CI, preparerPassage, MAX_PERSONNES, sortieVerrouCi, verrouTenu } from '../../scripts/lib/veille/auto.ts';
import { executer as executerCiLocal } from '../../scripts/ci-local.ts';
import type { Preparation } from '../../scripts/lib/veille/auto.ts';
import { cheminsLocaux } from '../../scripts/lib/deploiement/config.ts';
import { CODES_ARRET } from '../../scripts/lib/veille/codes-auto.ts';
import { ajouterMotif } from '../../scripts/lib/veille/decider.ts';
import type { TexteSource } from '../../scripts/lib/veille/sources-texte.ts';
import { creerMondeAuto, FICHE_FICTIVE, FICTIF, JETON_AGENT_SENTINELLE, ligneFictive, lignePersonneFictive, sortieAgent } from '../helpers/monde-auto.ts';
import type { JeuAmont, MondeAuto, OptionsMonde } from '../helpers/monde-auto.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const git = (cwd: string, args: string[]): string => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const statutReel = (): string => git(REPO_ROOT, ['status', '--porcelain']);

const PHRASE = "Cette page officielle présente la personne et sa démarche pour l'élection présidentielle de deux mille vingt-sept.";
const URL_S = 'https://exemple.test/s';
const URL_C = 'https://jeanne2027.example/';
const texte = (url: string): TexteSource => ({ ok: true, url, texte: `Titre de la page. ${PHRASE} Fin du texte.`, tronque: false });
const TEXTES: Record<string, TexteSource> = { [URL_S]: texte(URL_S), [URL_C]: texte(URL_C), 'https://exemple.test/desistement': texte('https://exemple.test/desistement') };
const CONFIRME = { stdout: sortieAgent('confirme', PHRASE) };

type Ligne = Record<string, unknown>;
const nouvelle =
  (surcharge: Ligne = {}) =>
  (j: JeuAmont): void => {
    j.candidats.push({
      id: 'duval',
      nom: 'Jeanne Duval',
      parti: 'Parti Fictif',
      bloc: 'centre',
      statut: 'declare',
      statut_detail: 'STATUT-DETAIL-SENTINELLE',
      source: { titre: 'Titre', url: URL_S, date: '2026-11-19' },
      propositions: ['PROPOSITION-SENTINELLE'],
      liens: { campagne: URL_C },
      verifie_le: '2026-11-19',
      ...surcharge,
    });
  };
// WR-11 (garde du projet) : les changements de statut inventés portent sur la personne fictive connue du monde simulé
// (`essai-fictif`, tests/helpers/monde-auto.ts), jamais sur une personne réelle du jeu.
const fictive = (j: JeuAmont): Ligne => lignePersonneFictive(j);
const changerStatut = (c: Ligne, statut: string, date: string, url = URL_S): void => {
  c.statut = statut;
  c.source = { titre: 'Titre', url, date };
};

const mondes: MondeAuto[] = [];
function monde(o: OptionsMonde = {}): MondeAuto {
  const m = creerMondeAuto({ textes: TEXTES, scenariosClaude: [CONFIRME], ...o });
  mondes.push(m);
  return m;
}
const nomsAppels = (m: MondeAuto): string[] => m.appels().map((a) => `${a.commande} ${a.args.join(' ')}`);
const sansWorktreeNiCommit = (m: MondeAuto, avant: string): void => {
  assert.equal(git(m.depot, ['status', '--porcelain']), '', 'le dépôt de travail est intact');
  assert.equal(git(m.depot, ['rev-parse', 'HEAD']), avant, 'HEAD du dépôt de travail inchangé');
  if (existsSync(path.join(m.worktree, '.git'))) assert.equal(git(m.worktree, ['rev-parse', 'HEAD']), git(m.depot, ['rev-parse', 'origin/main']), 'aucun commit dans le worktree dédié');
};
async function arret(m: MondeAuto, mode: 'a_blanc' | 'publier' = 'a_blanc'): Promise<Preparation> {
  const avant = git(m.depot, ['rev-parse', 'HEAD']);
  const r = await preparerPassage(m.deps, { mode });
  sansWorktreeNiCommit(m, avant);
  return r;
}

let statutAvant = '';
before(() => {
  statutAvant = statutReel();
});
after(() => {
  assert.equal(statutReel(), statutAvant, 'le dépôt réel est inchangé par les tests');
  for (const m of mondes) m.detruire();
});

describe('préparation : arrêts avant tout calcul coûteux', () => {
  it('jeu inchangé : rien_a_faire, aucun commit, aucun agent, aucun rapport', async () => {
    const m = monde();
    const r = await arret(m);
    assert.equal(r.code, 'rien_a_faire');
    assert.equal(m.fauxClaude.journal().length, 0);
    assert.ok(!existsSync(path.join(m.dossier, 'rapports-auto')));
  });

  it('désistement d’une personne connue sans motif : motif_a_decider, fiche citée', async () => {
    const m = monde({ modifierAmont: (j) => changerStatut(fictive(j), 'renonce', '2026-11-18') });
    const r = await arret(m);
    assert.equal(r.code, 'motif_a_decider');
    assert.deepEqual('fiches' in r ? r.fiches : [], [FICHE_FICTIVE]);
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  it('statut amont daté au mois : date_au_mois', async () => {
    const m = monde({ modifierAmont: (j) => changerStatut(fictive(j), 'primaire', '2027-01') });
    const r = await arret(m);
    assert.equal(r.code, 'date_au_mois');
  });

  it(`plus de ${MAX_PERSONNES} personnes : volume_anormal`, async () => {
    const m = monde({
      modifierAmont: (j) => {
        // Personnes fictives nouvelles, en nombre : aucune ligne réelle n'est modifiée.
        for (let i = 0; i <= MAX_PERSONNES; i++) j.candidats.push(ligneFictive({ id: `essai-volume-${i}`, nom: `Essai Volume${'a'.repeat(i + 1)}`, source: { titre: 'Annonce (fictive)', url: `https://exemple.test/essai-volume-${i}`, date: '2026-11-18' } }));
      },
    });
    const r = await arret(m);
    assert.equal(r.code, 'volume_anormal');
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  it('beaucoup de lignes retirées du jeu : garde_volume', async () => {
    const m = monde({ modifierAmont: (j) => (j.candidats = j.candidats.slice(0, 10)) });
    assert.equal((await arret(m)).code, 'garde_volume');
  });

  it('régression de date d’un statut : conflit_import', async () => {
    const m = monde({ modifierAmont: (j) => changerStatut(fictive(j), 'primaire', '2020-01-01') });
    assert.equal((await arret(m)).code, 'conflit_import');
  });

  it('origine injoignable : hors_ligne', async () => {
    const m = monde();
    git(m.depot, ['remote', 'set-url', 'origin', path.join(m.racine, 'inexistant.git')]);
    assert.equal((await arret(m)).code, 'hors_ligne');
  });

  it('octets amont altérés depuis la veille : controle_rouge', async () => {
    const m = monde();
    appendFileSync(m.amont, ' ');
    assert.equal((await arret(m)).code, 'controle_rouge');
  });

  it('mode publier, main contient des changements du site non déployés : main_non_deploye', async () => {
    const m = monde();
    const ancien = m.shaOrigine();
    m.commitOrigine('src/pages/nouvelle-page.astro', '---\n---\n<p>autre session</p>\n', 'feat: page d’une autre session');
    const deps = creerSecondeVersion(m, [[`courant=${ancien} restreint=oui`, 'resultat=etat_lu']]);
    const r = await preparerPassage(deps, { mode: 'publier' });
    assert.equal(r.code, 'main_non_deploye');
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  it('mode publier, seule la documentation a changé depuis la version en ligne : la préparation continue', async () => {
    const m = monde();
    const ancien = m.shaOrigine();
    m.commitOrigine('docs/note-de-test.md', 'note\n', 'docs: note');
    const deps = creerSecondeVersion(m, [[`courant=${ancien} restreint=oui`, 'resultat=etat_lu']]);
    const r = await preparerPassage(deps, { mode: 'publier' });
    assert.equal(r.code, 'rien_a_faire');
  });

  it('mode publier, version en ligne inconnue : main_non_deploye', async () => {
    const m = monde({ deployAuto: [['courant=aucun restreint=oui', 'resultat=etat_lu']] });
    assert.equal((await arret(m, 'publier')).code, 'main_non_deploye');
  });

  it('mode publier, serveur non restreint : serveur_non_restreint', async () => {
    const m = monde({ deployAuto: [['resultat=serveur_non_restreint']] });
    assert.equal((await arret(m, 'publier')).code, 'serveur_non_restreint');
  });

  it('mode à blanc, journal local sans ligne : avertissement, la préparation continue', async () => {
    const m = monde();
    const r = await arret(m);
    assert.equal(r.code, 'rien_a_faire');
    assert.ok(m.journal.some((l) => /avertissement : version en ligne inconnue/.test(l)));
  });

  it('à blanc, journal local à jour mais page du site changée depuis : main_non_deploye', async () => {
    const m = monde();
    const journal = cheminsLocaux(m.home).journal;
    mkdirSync(path.dirname(journal), { recursive: true });
    appendFileSync(journal, `${JSON.stringify({ date: '2026-11-19T10:00:00Z', action: 'deployer-auto', cible: 'production', commit: m.shaOrigine(), precedent: null, resultat: 'succes', urgence: false })}\n`);
    m.commitOrigine('src/pages/autre.astro', '---\n---\n<p>x</p>\n', 'feat: page');
    assert.equal((await arret(m)).code, 'main_non_deploye');
  });
});

/** Dépendances du monde avec des sorties scriptées pour `deploy-auto etat`. */
function creerSecondeVersion(m: MondeAuto, scripts: string[][]): MondeAuto['deps'] {
  const base = m.deps.executer;
  return {
    ...m.deps,
    executer: (c, a, o) => {
      if ((a[0] ?? '').endsWith('scripts/deploy-auto.ts')) {
        const lignes = scripts[0] as string[];
        return { status: 0, stdout: `${lignes.join('\n')}\n`, stderr: '' };
      }
      return base(c, a, o);
    },
  };
}

describe('préparation : identités, sources et vérification par deux agents', () => {
  it('nom ambigu : identite_ambigue, aucun agent appelé', async () => {
    const m = monde({ modifierAmont: nouvelle({ nom: 'JEAN DUPONT', id: 'dupont' }) });
    const r = await arret(m);
    assert.equal(r.code, 'identite_ambigue');
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  it('programme signalé par le jeu amont : programme_signale', async () => {
    const m = monde({ modifierAmont: nouvelle({ liens: { campagne: URL_C, programme: 'https://jeanne2027.example/programme' } }) });
    assert.equal((await arret(m)).code, 'programme_signale');
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  it('configuration de l’agent absente : config_absente, aucun agent appelé', async () => {
    const m = monde({ modifierAmont: nouvelle(), sansConfigAgent: true });
    assert.equal((await arret(m)).code, 'config_absente');
    assert.equal(m.fauxClaude.journal().length, 0);
  });

  for (const echec of ['inaccessible', 'coquille_js', 'non_html', 'vide'] as const) {
    it(`texte de la source en échec (${echec}) : source_inaccessible`, async () => {
      const m = monde({ modifierAmont: nouvelle(), textes: { ...TEXTES, [URL_S]: { ok: false, echec } } });
      const r = await arret(m);
      assert.equal(r.code, 'source_inaccessible');
      assert.equal(m.fauxClaude.journal().length, 0);
    });
  }

  const doutes: [string, { stdout: string; code?: number }[]][] = [
    ['insuffisant', [{ stdout: sortieAgent('insuffisant', '') }]],
    ['désaccord', [CONFIRME, { stdout: sortieAgent('infirme', PHRASE) }]],
    ['infirmé par les deux', [{ stdout: sortieAgent('infirme', PHRASE) }]],
    ['citation absente du texte', [{ stdout: sortieAgent('confirme', 'une phrase qui ne figure nulle part dans le texte récupéré') }]],
    ['sortie invalide', [{ stdout: 'pas du JSON' }]],
    ['échec du processus', [{ stdout: '', code: 1 }]],
  ];
  for (const [nom, scenarios] of doutes) {
    it(`agents : ${nom} : doute_agent, fiche citée, rien d’écrit`, async () => {
      const m = monde({ modifierAmont: nouvelle(), scenariosClaude: scenarios });
      const r = await arret(m);
      assert.equal(r.code, 'doute_agent');
      assert.deepEqual('fiches' in r ? r.fiches : [], ['jeanne-duval']);
      assert.ok(!nomsAppels(m).some((l) => l.includes('import-datagouv.ts --file')), 'aucun import réel');
    });
  }

  it('le prompt de l’agent ne contient ni statut_detail ni propositions du jeu amont, ni le jeton', async () => {
    const m = monde({ modifierAmont: nouvelle(), scenariosClaude: [{ stdout: sortieAgent('insuffisant', '') }] });
    await arret(m);
    const entrees = m.fauxClaude.entrees();
    assert.ok(entrees.length >= 1);
    for (const e of entrees) {
      assert.doesNotMatch(e, /STATUT-DETAIL-SENTINELLE|PROPOSITION-SENTINELLE/);
      assert.ok(!e.includes(JETON_AGENT_SENTINELLE));
    }
    assert.ok(m.fauxClaude.journal().every((a) => a.jetonAttendu), 'le jeton passe par l’environnement du seul processus claude');
  });
});

describe('préparation : écriture, garde de périmètre, commit et ci:local', () => {
  it('nouvelle personne déclarée : commit local testé, relu par l’agent, rapport privé', async () => {
    const m = monde({ modifierAmont: nouvelle() });
    const avant = git(m.depot, ['rev-parse', 'HEAD']);
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'pret', JSON.stringify(r));
    if (r.code !== 'pret') return;
    assert.deepEqual(r.fiches, ['jeanne-duval']);
    assert.equal(r.empreinte, m.empreinte);

    // Le commit : sha, auteur, message sans nom de personne, arbre propre, reçu ci:local vert.
    assert.equal(git(m.worktree, ['rev-parse', 'HEAD']), r.sha);
    assert.equal(git(m.worktree, ['status', '--porcelain']), '');
    assert.equal(git(m.worktree, ['log', '-1', '--format=%an <%ae>']), 'automate reveleTonProg <automate@exemple.invalid>');
    const message = git(m.worktree, ['log', '-1', '--format=%B']);
    assert.match(message, /^import\(statuts\): mise à jour autonome, jeu data\.gouv du 2026-11-20 \(/);
    assert.doesNotMatch(message, /Jeanne|Duval/i);
    assert.equal(git(m.worktree, ['rev-parse', 'HEAD^']), git(m.depot, ['rev-parse', 'origin/main']));
    const recu = JSON.parse(readFileSync(path.join(m.home, '.cache', 'rtp', 'ci', `${r.sha}.json`), 'utf8')) as { commit: string; partiel: boolean };
    assert.equal(recu.commit, r.sha);
    assert.equal(recu.partiel, false);

    // Contenu du commit.
    const fichiers = git(m.worktree, ['show', '--name-only', '--format=', 'HEAD']).split('\n');
    for (const attendu of ['data/import/correspondances.yaml', 'src/content/candidats/jeanne-duval.yaml', 'data/dataset-datagouv.yaml', 'data/couverture-themes.yaml', 'relecture/journal.jsonl', 'ids.lock']) {
      assert.ok(fichiers.includes(attendu), `${attendu} dans le commit`);
    }
    assert.ok(fichiers.some((f) => /^data\/import\/2027etmoi-candidats-2026-11-20-[0-9a-f]{12}\.json$/.test(f)));
    assert.ok(fichiers.every((f) => /^(data\/|src\/content\/(candidats|couverture)\/|relecture\/|ids\.lock$|LICENSE$)/.test(f)), fichiers.join('\n'));
    const table = readFileSync(path.join(m.worktree, 'data/import/correspondances.yaml'), 'utf8');
    assert.match(table, /\n {2}duval:\n {4}id: jeanne-duval\n {4}prenom: Jeanne\n {4}nom: Duval\n {4}nom_tri: Duval\n {4}type_source_statut: presse\n$/);
    const couverture = readFileSync(path.join(m.worktree, 'data/couverture-themes.yaml'), 'utf8');
    assert.match(couverture, / {2}- id: jeanne-duval\n {4}acces: aucun_site\n/);
    const cases = readdirSync(path.join(m.worktree, 'src/content/couverture')).filter((f) => readFileSync(path.join(m.worktree, 'src/content/couverture', f), 'utf8').includes('candidat: jeanne-duval'));
    assert.equal(cases.length, 3, 'une case par thème pilote');
    for (const f of cases) assert.match(readFileSync(path.join(m.worktree, 'src/content/couverture', f), 'utf8'), /candidat: jeanne-duval\n {4}etat: programme_non_publie\n/);

    // Relecture par l'agent : les cases avant le statut.
    const lignes = readFileSync(path.join(m.worktree, 'relecture/journal.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { cible: string; relecteur: string });
    const iStatut = lignes.findIndex((l) => l.cible === 'statut:jeanne-duval');
    const iCases = lignes.map((l, i) => (l.cible.startsWith('case:') && l.cible.endsWith('/jeanne-duval') ? i : -1)).filter((i) => i >= 0);
    assert.ok(iStatut >= 0 && iCases.length === 3 && iCases.every((i) => i < iStatut));
    assert.equal(lignes[iStatut]?.relecteur, "l'agent d'IA Claude");

    // Rapport local en 0600, sans jeton, avec les verdicts ; aucun nom dans le journal ni les comptes.
    assert.equal(statSync(r.rapport).mode & 0o777, 0o600);
    const rapport = readFileSync(r.rapport, 'utf8');
    assert.match(rapport, /code : pret/);
    assert.match(rapport, /Jeanne Duval/);
    assert.ok(!rapport.includes(JETON_AGENT_SENTINELLE));
    assert.ok(!m.journal.join('\n').match(/Jeanne|Duval/));
    assert.doesNotMatch(r.comptes, /Jeanne|Duval/);

    // Aucune écriture dans le dépôt de travail, aucune sentinelle dans les entrées des agents, aucun push.
    assert.equal(git(m.depot, ['status', '--porcelain']), '');
    assert.equal(git(m.depot, ['rev-parse', 'HEAD']), avant);
    assert.equal(git(m.origine, ['rev-parse', 'refs/heads/main']), m.shaOrigine());
    assert.equal(git(m.origine, ['rev-parse', 'refs/heads/main']), git(m.depot, ['rev-parse', 'origin/main']));
    for (const e of m.fauxClaude.entrees()) assert.doesNotMatch(e, /SENTINELLE/);
    assert.equal(m.fauxClaude.entrees().length, 4, 'deux agents pour le statut, deux pour le constat de programme');
    assert.ok(!nomsAppels(m).some((l) => /^git .*push/.test(l)));
  });

  it('sortie d’une personne connue dont le motif est dans la table : couverture retirée, cases gardées, statut relu hors périmètre', async () => {
    const m = monde({ modifierAmont: (j) => changerStatut(fictive(j), 'renonce', '2026-11-18', 'https://exemple.test/desistement') });
    const table = readFileSync(path.join(m.depot, 'data/import/correspondances.yaml'), 'utf8');
    m.commitOrigine('data/import/correspondances.yaml', ajouterMotif(table, FICTIF, 'non_candidat'), 'chore: motif décidé');
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'pret', JSON.stringify(r));
    if (r.code !== 'pret') return;
    assert.deepEqual(r.fiches, [FICHE_FICTIVE]);
    const couverture = readFileSync(path.join(m.worktree, 'data/couverture-themes.yaml'), 'utf8');
    assert.doesNotMatch(couverture, /- id: essai-fictif\n/);
    assert.equal(m.fauxClaude.entrees().length, 2, 'un statut, deux agents, aucun constat de programme');
    const lignes = readFileSync(path.join(m.worktree, 'relecture/journal.jsonl'), 'utf8');
    assert.match(lignes, /"cible":"statut:essai-fictif"/);
  });

  it('WR-05 : case manquante pour une personne connue non examinée par les agents : controle_rouge, aucune case écrite', async () => {
    const m = monde({ modifierAmont: nouvelle() });
    const rel = 'src/content/couverture/sante.yaml';
    const avant = readFileSync(path.join(m.depot, rel), 'utf8');
    const bloc = /^ {2}- candidat: essai-fictif\n(?: {4}.*\n)+/m;
    assert.match(avant, bloc);
    m.commitOrigine(rel, avant.replace(bloc, ''), 'test: case fictive retirée');
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'controle_rouge', JSON.stringify(r));
    assert.ok('fiches' in r && r.fiches.includes(FICHE_FICTIVE), 'fiche citée');
    assert.equal(git(m.worktree, ['status', '--porcelain']), '', 'écritures annulées');
    assert.equal(git(m.worktree, ['rev-parse', 'HEAD']), git(m.depot, ['rev-parse', 'origin/main']), 'aucun commit');
  });

  it('constat de programme infirmé par les deux agents : programme_signale', async () => {
    const m = monde({ modifierAmont: nouvelle(), scenariosClaude: [CONFIRME, CONFIRME, { stdout: sortieAgent('infirme', PHRASE) }] });
    const r = await arret(m);
    assert.equal(r.code, 'programme_signale');
    assert.deepEqual('fiches' in r ? r.fiches : [], ['jeanne-duval']);
  });

  it('constat de programme insuffisant : doute_agent', async () => {
    const m = monde({ modifierAmont: nouvelle(), scenariosClaude: [CONFIRME, CONFIRME, { stdout: sortieAgent('insuffisant', '') }] });
    assert.equal((await arret(m)).code, 'doute_agent');
  });

  it('contrôle rouge pendant la préparation : controle_rouge, aucun commit', async () => {
    const m = monde({ modifierAmont: nouvelle() });
    const base = m.deps.executer;
    const deps = { ...m.deps, executer: ((c, a, o) => ((a[0] ?? '').endsWith('scripts/ids.ts') ? { status: 1, stdout: '', stderr: 'ids en échec' } : base(c, a, o))) as typeof base };
    const avant = git(m.depot, ['rev-parse', 'HEAD']);
    const r = await preparerPassage(deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'controle_rouge');
    sansWorktreeNiCommit(m, avant);
    assert.equal(git(m.worktree, ['status', '--porcelain']), '', 'écritures annulées dans le worktree dédié');
  });

  const parasites: [string, (wt: string) => void][] = [
    ['page du site modifiée', (wt) => appendFileSync(path.join(wt, 'src/pages/index.astro'), '\n<!-- parasite -->\n')],
    [
      'ligne texte_source modifiée',
      (wt) => {
        const dir = path.join(wt, 'src/content/mesures');
        const f = readdirSync(dir, { recursive: true }).map(String).find((x) => x.endsWith('.yaml')) as string;
        appendFileSync(path.join(dir, f), '\ntexte_source: modifié\n');
      },
    ],
    ['tiret long ajouté à la couverture', (wt) => appendFileSync(path.join(wt, 'data/couverture-themes.yaml'), '# note \u2014 parasite\n')],
    [
      'relecture d’une mesure ajoutée au journal (WR-06)',
      (wt) =>
        appendFileSync(
          path.join(wt, 'relecture/journal.jsonl'),
          `${JSON.stringify({ horodatage: '2026-11-26T09:00:00.000Z', action: 'marquer', cible: 'mesure:essai-fictif/sante-mesure-fictive', relecteur: "l'agent d'IA Claude", date: '2026-11-26', sha256: 'a'.repeat(64) })}\n`,
        ),
    ],
    ['archive ajoutée', (wt) => {
      mkdirSync(path.join(wt, 'archives'), { recursive: true });
      writeFileSync(path.join(wt, 'archives', 'parasite.txt'), 'x');
    }],
  ];
  for (const [nom, parasite] of parasites) {
    it(`écriture parasite (${nom}) : perimetre_ecriture, aucun commit`, async () => {
      const m = monde({ modifierAmont: nouvelle() });
      m.deps.apresEcriture = parasite;
      const r = await arret(m);
      assert.equal(r.code, 'perimetre_ecriture');
      assert.equal(git(m.worktree, ['status', '--porcelain']), '');
    });
  }

  it('ci:local rouge : ci_rouge, le commit local existe, rien n’est poussé', async () => {
    const m = monde({ modifierAmont: nouvelle(), ciLocal: 'rouge' });
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'ci_rouge');
    assert.notEqual(git(m.worktree, ['rev-parse', 'HEAD']), git(m.depot, ['rev-parse', 'origin/main']));
    assert.equal(git(m.origine, ['rev-parse', 'refs/heads/main']), git(m.depot, ['rev-parse', 'origin/main']));
  });

  it('verrou de ci:local tenu avant le lancement : verrou_pris, ci:local non lancé', async () => {
    const m = monde({ modifierAmont: nouvelle() });
    const verrou = path.join(m.home, '.cache', 'rtp', 'ci', '.verrou');
    mkdirSync(verrou, { recursive: true });
    writeFileSync(path.join(verrou, 'pid'), `${process.pid}\n`);
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'verrou_pris');
    assert.ok(!nomsAppels(m).some((l) => l.includes('ci-local.ts')));
  });

  it('verrou de ci:local apparu pendant le lancement : verrou_pris', async () => {
    const m = monde({ modifierAmont: nouvelle(), ciLocal: 'verrou' });
    assert.equal((await preparerPassage(m.deps, { mode: 'a_blanc' })).code, 'verrou_pris');
  });

  it('WR-08 : verrou relâché avant la relecture, message réel de ci:local : verrou_pris, jamais ci_rouge', async () => {
    const m = monde({ modifierAmont: nouvelle(), ciLocal: 'verrou_fini' });
    assert.equal((await preparerPassage(m.deps, { mode: 'a_blanc' })).code, 'verrou_pris');
  });

  it('WR-08 : verrou tout juste créé, sans fichier pid : verrou_pris, ci:local non lancé', async () => {
    const m = monde({ modifierAmont: nouvelle() });
    mkdirSync(path.join(m.home, '.cache', 'rtp', 'ci', '.verrou'), { recursive: true });
    const r = await preparerPassage(m.deps, { mode: 'a_blanc' });
    assert.equal(r.code, 'verrou_pris');
    assert.ok(!nomsAppels(m).some((l) => l.includes('ci-local.ts')));
  });

  it('tous les codes d’arrêt renvoyés appartiennent à la liste fermée', () => {
    for (const c of ['motif_a_decider', 'date_au_mois', 'garde_volume', 'conflit_import', 'identite_ambigue', 'programme_signale', 'volume_anormal', 'doute_agent', 'source_inaccessible', 'controle_rouge', 'perimetre_ecriture', 'ci_rouge', 'verrou_pris', 'hors_ligne', 'main_non_deploye']) {
      assert.ok((CODES_ARRET as readonly string[]).includes(c), c);
    }
  });
});

describe('verrou de ci:local (WR-08)', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'rtp-verrou-ci-'));
  after(() => rmSync(base, { recursive: true, force: true }));
  let n = 0;
  const dossier = (): string => path.join(base, `v${n++}`, '.verrou');

  it('verrouTenu lit le verrou comme ci-local : pid vivant, ou dossier sans pid de moins d’une minute', () => {
    const absent = dossier();
    assert.equal(verrouTenu(absent), false);
    const vivant = dossier();
    mkdirSync(vivant, { recursive: true });
    writeFileSync(path.join(vivant, 'pid'), `${process.pid}\n`);
    assert.equal(verrouTenu(vivant), true);
    const mort = dossier();
    mkdirSync(mort, { recursive: true });
    const fini = spawnSync(process.execPath, ['-e', '0']);
    writeFileSync(path.join(mort, 'pid'), `${fini.pid}\n`);
    assert.equal(verrouTenu(mort), false, 'pid d’un processus terminé');
    const sansPid = dossier();
    mkdirSync(sansPid, { recursive: true });
    assert.equal(verrouTenu(sansPid), true, 'dossier sans pid tout juste créé');
    const ancien = new Date(Date.now() - 5 * 60_000);
    utimesSync(sansPid, ancien, ancien);
    assert.equal(verrouTenu(sansPid), false, 'dossier sans pid abandonné depuis plus d’une minute');
  });

  it('sortieVerrouCi : message de ci-local, sinon verrou encore tenu ; autre sortie 2 sans verrou : non', () => {
    assert.equal(sortieVerrouCi('ci:local : une autre exécution tourne déjà (pid 12, verrou /x)\n', dossier()), true);
    assert.equal(sortieVerrouCi('Node 24 exigé (version actuelle v22.0.0)', dossier()), false);
    const vivant = dossier();
    mkdirSync(vivant, { recursive: true });
    writeFileSync(path.join(vivant, 'pid'), `${process.pid}\n`);
    assert.equal(sortieVerrouCi('', vivant), true);
  });

  it('contrat : le vrai ci-local sort en 2 avec le message reconnu quand son verrou est tenu', async () => {
    const home = path.join(base, 'home');
    const verrou = path.join(home, '.cache', 'rtp', 'ci', '.verrou');
    mkdirSync(verrou, { recursive: true });
    writeFileSync(path.join(verrou, 'pid'), `${process.pid}\n`);
    const lignes: string[] = [];
    const code = await executerCiLocal([], { home, racine: REPO_ROOT, versionNode: 'v24.12.0', ecrire: (l) => lignes.push(l) });
    assert.equal(code, 2);
    assert.match(lignes.join('\n'), MESSAGE_VERROU_CI);
    assert.ok(existsSync(path.join(verrou, 'pid')), 'le verrou d’autrui est laissé en place');
  });
});
