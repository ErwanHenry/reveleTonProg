// Monde simulé de l'automate (phase 10.3, plan 08) : tout ce que la préparation touche, en version jetable.
//
// - `depot` : copie des fichiers SUIVIS du dépôt réel dans un dépôt git temporaire (identité locale fixée), un commit ;
// - `origine` : dépôt nu local, remote `origin` de `depot` (aucun GitHub) ;
// - `home` et `dossier` (~/.cache/rtp/veille) temporaires : aucune écriture dans ~/.config/rtp réel ;
// - jeu amont fictif : l'instantané pointé par data/dataset-datagouv.yaml, modifié par une fonction, nouvelle mise à jour ;
// - faux claude (tests/helpers/faux-claude.ts), textes de sources injectés (aucun réseau) ;
// - executer de test : `npm ci`, `scripts/ci-local.ts`, `scripts/deploy-auto.ts`, security et osascript sont remplacés ;
//   git, import-datagouv, ids et validate tournent pour de vrai sur la copie.
// Valeurs factices seulement. Rien de ce fichier ne contacte le serveur, GitHub, Telegram ou data.gouv.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ETAPES, ecrireRecu } from '../../scripts/lib/ci-local.ts';
import { CODES_SORTIE_AUTO, type ResultatAuto } from '../../scripts/lib/deploiement/auto.ts';
import { cheminsLocaux } from '../../scripts/lib/deploiement/config.ts';
import { envDeBase, lancer } from '../../scripts/lib/processus.ts';
import type { DependancesAuto } from '../../scripts/lib/veille/auto.ts';
import type { TexteSource } from '../../scripts/lib/veille/sources-texte.ts';
import { ecrireEtat, ETAT_VIDE } from '../../scripts/lib/veille/etat.ts';
import { cheminsAuto } from '../../scripts/lib/veille/mode-auto.ts';
import { ecrireCasesManquantes, relireParAgent, synchroniserCouverture } from '../../scripts/lib/veille/ecriture-auto.ts';
import { creerFauxClaude, type FauxClaude, type ScenarioClaude } from './faux-claude.ts';
import { REPO_ROOT } from './validate-yaml.ts';

export const JETON_AGENT_SENTINELLE = 'JETON-AGENT-SENTINELLE-0b7';
export const IDENTITE_GIT = { nom: 'Monde Auto Test', email: 'monde-auto@exemple.invalid' };

export interface JeuAmont {
  mise_a_jour: string;
  candidats: Record<string, unknown>[];
}

export interface OptionsMonde {
  modifierAmont?: (jeu: JeuAmont) => void;
  /** Instant de la préparation (ISO). */
  maintenant?: string;
  marqueurActif?: boolean;
  scenariosClaude?: ScenarioClaude[];
  /** Textes des sources par URL ; une URL absente est inaccessible. */
  textes?: Record<string, TexteSource>;
  /**
   * Faux ci:local : vert, rouge, verrou (verrou tenu par un processus vivant, message réel de ci-local, code 2) ou
   * verrou_fini (code 2 et message réel, mais l'exécution qui tenait le verrou a fini avant la relecture : plus de verrou).
   */
  ciLocal?: 'vert' | 'rouge' | 'verrou' | 'verrou_fini';
  /** Sorties scriptées de `deploy-auto.ts etat` (une par appel, la dernière se répète). */
  deployAuto?: string[][];
  telegram?: boolean;
  /** Commit mis en ligne d'après le journal local de déploiement (mode à blanc). */
  journalEnLigne?: string;
  /** Pas de configuration de l'agent dans le HOME temporaire. */
  sansConfigAgent?: boolean;
}

export interface AppelMonde {
  commande: string;
  args: string[];
}

export interface MondeAuto {
  racine: string;
  home: string;
  dossier: string;
  depot: string;
  origine: string;
  worktree: string;
  deps: DependancesAuto;
  fauxClaude: FauxClaude;
  journal: string[];
  appels(): AppelMonde[];
  telegramEnvoyes(): string[];
  /** Sha de refs/heads/main de l'origine nue. */
  shaOrigine(): string;
  /** Ajoute un commit sur l'origine (via `depot`, remis ensuite sur son état d'avant) et renvoie son sha. */
  commitOrigine(fichier: string, contenu: string, message: string): string;
  /** Empreinte (sha256) du jeu amont gardé par la veille, et chemin de ses octets. */
  empreinte: string;
  amont: string;
  /** Instantané pointé, tel quel (sans la ligne fictive, ajoutée au jeu simulé avant `modifierAmont`). */
  jeuDeBase: JeuAmont;
  detruire(): void;
}

const sh = (cwd: string, args: string[]): string => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...envDeBase(), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};

function configurerIdentite(depot: string): void {
  sh(depot, ['config', 'user.name', IDENTITE_GIT.nom]);
  sh(depot, ['config', 'user.email', IDENTITE_GIT.email]);
  sh(depot, ['config', 'commit.gpgsign', 'false']);
}

// WR-11 (garde du projet) : le dépôt est public. Un changement de statut, un désistement ou une date inventés ne
// portent jamais sur une personne réelle du jeu : ils portent sur `essai-fictif`, personne fictive connue du monde
// simulé (ligne amont, ligne de correspondances, fiche relue, ligne de couverture, cases des thèmes pilotes et ids.lock,
// écrits dans la copie temporaire seulement, par les gabarits de l'automate eux-mêmes).
export const FICTIF = 'essai-fictif';
export const FICHE_FICTIVE = 'essai-fictif';
export const URL_FICTIVE = 'https://exemple.test/essai-fictif/annonce';

/** Ligne amont fictive, complète : aucun champ recopié d'une ligne réelle. */
export function ligneFictive(surcharge: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: FICTIF,
    nom: 'Essai Fictif',
    parti: '',
    bloc: '',
    statut: 'declare',
    statut_detail: '',
    source: { titre: 'Annonce (fictive)', url: URL_FICTIVE, date: '2026-10-01' },
    propositions: [],
    liens: {},
    verifie_le: '2026-11-09',
    ...surcharge,
  };
}

/** Ligne amont fictive du jeu simulé (pour la modifier dans `modifierAmont`). */
export const lignePersonneFictive = (jeu: JeuAmont): Record<string, unknown> => {
  const l = jeu.candidats.find((c) => c.id === FICTIF);
  if (l === undefined) throw new Error('ligne fictive absente du jeu simulé');
  return l;
};

/** Ajoute la personne fictive connue au dépôt temporaire, dans l'état d'une personne déjà importée et relue. */
function ajouterPersonneFictive(depot: string): void {
  const table = path.join(depot, 'data', 'import', 'correspondances.yaml');
  writeFileSync(table, `${readFileSync(table, 'utf8')}  ${FICTIF}:\n    id: ${FICHE_FICTIVE}\n    prenom: Essai\n    nom: Fictif\n    nom_tri: Fictif\n    type_source_statut: presse\n`);
  writeFileSync(
    path.join(depot, 'src', 'content', 'candidats', `${FICHE_FICTIVE}.yaml`),
    [
      'version_schema: 1',
      `id: ${FICHE_FICTIVE}`,
      'prenom: Essai',
      'nom: Fictif',
      'nom_tri: Fictif',
      'parti: null',
      'ids_externes:',
      `  2027etmoi: ${FICTIF}`,
      'statuts:',
      '  - code: declare',
      '    date: 2026-10-01',
      '    source:',
      '      type: presse',
      '      titre: Annonce (fictive)',
      `      url: ${URL_FICTIVE}`,
      '      date_publication: 2026-10-01',
      '      date_consultation: 2026-11-09',
      '    statut_relecture: brouillon',
      '',
    ].join('\n'),
  );
  // Lancé depuis le dépôt réel (ses node_modules), mais n'écrit que dans la copie : --root vise le dépôt temporaire.
  const ids = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'ids.ts'), '--root', depot, '--write'], { cwd: REPO_ROOT, encoding: 'utf8', env: envDeBase() });
  if (ids.status !== 0) throw new Error(`ids.lock de la personne fictive : ${ids.stderr}`);
  const date = '2026-11-10';
  synchroniserCouverture(depot, { [FICHE_FICTIVE]: ['https://exemple.test/essai-fictif/'] }, date);
  const cases = ecrireCasesManquantes(depot, date, new Set([FICHE_FICTIVE]));
  const r = relireParAgent(depot, { cases, statuts: [{ candidat: FICHE_FICTIVE, code: 'declare' }] }, date, () => new Date('2026-11-10T10:00:00Z'));
  if (!r.ok) throw new Error(`relecture de la personne fictive refusée : ${r.messages.join(' ; ')}`);
}

let gabaritChemin: string | null = null;
function gabarit(): string {
  if (gabaritChemin !== null) return gabaritChemin;
  const g = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rtp-monde-auto-gabarit-')));
  const depot = path.join(g, 'depot');
  mkdirSync(depot);
  const fichiers = spawnSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter((f) => f !== '');
  for (const f of fichiers) {
    const src = path.join(REPO_ROOT, f);
    if (!existsSync(src)) continue;
    mkdirSync(path.dirname(path.join(depot, f)), { recursive: true });
    cpSync(src, path.join(depot, f), { dereference: false });
  }
  ajouterPersonneFictive(depot);
  sh(depot, ['init', '-q', '-b', 'main']);
  configurerIdentite(depot);
  writeFileSync(path.join(depot, '.git', 'info', 'exclude'), 'node_modules\n');
  sh(depot, ['add', '--all']);
  sh(depot, ['commit', '-q', '-m', 'base du monde simulé']);
  const origine = path.join(g, 'origine.git');
  sh(g, ['init', '-q', '--bare', '-b', 'main', origine]);
  sh(depot, ['remote', 'add', 'origin', origine]);
  sh(depot, ['push', '-q', 'origin', 'main']);
  gabaritChemin = g;
  process.on('exit', () => rmSync(g, { recursive: true, force: true }));
  return g;
}

const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

/** Sortie JSON de claude pour un verdict (forme `structured_output`, lue par lireSortieAgent). */
export function sortieAgent(verdict: 'confirme' | 'infirme' | 'insuffisant', citation: string, cout = 0.01): string {
  return JSON.stringify({ type: 'result', is_error: false, total_cost_usd: cout, structured_output: { verdict, citation: verdict === 'insuffisant' ? '' : citation, date_page: null } });
}

export function creerMondeAuto(o: OptionsMonde = {}): MondeAuto {
  const g = gabarit();
  const racine = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rtp-monde-auto-')));
  cpSync(path.join(g, 'depot'), path.join(racine, 'depot'), { recursive: true, dereference: false });
  cpSync(path.join(g, 'origine.git'), path.join(racine, 'origine.git'), { recursive: true, dereference: false });
  const depot = path.join(racine, 'depot');
  const origine = path.join(racine, 'origine.git');
  sh(depot, ['remote', 'set-url', 'origin', origine]);

  const home = path.join(racine, 'home');
  const dossier = path.join(home, '.cache', 'rtp', 'veille');
  mkdirSync(dossier, { recursive: true, mode: 0o700 });
  const chemins = cheminsAuto(home, dossier);

  // Jeu amont : l'instantané pointé, modifié, avec une nouvelle date de mise à jour.
  const pointeur = readFileSync(path.join(depot, 'data', 'dataset-datagouv.yaml'), 'utf8');
  const relatif = /^instantane: (.+)$/m.exec(pointeur)?.[1] ?? '';
  const jeuDeBase = JSON.parse(readFileSync(path.join(depot, relatif), 'utf8')) as JeuAmont;
  const jeu = JSON.parse(JSON.stringify(jeuDeBase)) as JeuAmont;
  jeu.mise_a_jour = '2026-11-20';
  jeu.candidats.push(ligneFictive());
  o.modifierAmont?.(jeu);
  const octets = Buffer.from(`${JSON.stringify(jeu, null, 2)}\n`);
  const empreinte = sha256(octets);
  const amont = path.join(dossier, 'amont', `${empreinte}.json`);
  mkdirSync(path.dirname(amont), { recursive: true, mode: 0o700 });
  writeFileSync(amont, octets, { mode: 0o600 });
  ecrireEtat(dossier, { ...ETAT_VIDE, dernierCode: 'nouveau', derniereEmpreinte: empreinte, dernierAmont: amont, dernierPassage: '2026-11-20T08:00:00.000Z' });

  // Faux claude et sa configuration locale.
  const fauxClaude = creerFauxClaude(o.scenariosClaude ?? [{ stdout: sortieAgent('insuffisant', '') }], { garderEntree: true, secretAttendu: { nom: 'CLAUDE_CODE_OAUTH_TOKEN', valeur: JETON_AGENT_SENTINELLE } });
  if (o.sansConfigAgent !== true) {
    mkdirSync(path.join(home, '.config', 'rtp'), { recursive: true, mode: 0o700 });
    const f = path.join(home, '.config', 'rtp', 'agent-claude.env');
    writeFileSync(f, `RTP_CLAUDE=${fauxClaude.chemin}\nCLAUDE_CODE_OAUTH_TOKEN=${JETON_AGENT_SENTINELLE}\n`, { mode: 0o600 });
    chmodSync(f, 0o600);
  }
  if (o.marqueurActif === true) writeFileSync(chemins.actif, 'actif\n', { mode: 0o600 });

  if (o.journalEnLigne !== undefined) {
    const j = cheminsLocaux(home).journal;
    mkdirSync(path.dirname(j), { recursive: true, mode: 0o700 });
    appendFileSync(j, `${JSON.stringify({ date: '2026-11-19T10:00:00Z', action: 'deployer-auto', cible: 'production', commit: o.journalEnLigne, precedent: null, resultat: 'succes', urgence: false })}\n`);
  }

  const appels: AppelMonde[] = [];
  const journal: string[] = [];
  const telegram: string[] = [];
  const scripts = [...(o.deployAuto ?? [])];
  const nodeReel = process.execPath;
  const nodeModules = realpathSync(path.join(REPO_ROOT, 'node_modules'));
  const shaOrigine = (): string => sh(origine, ['rev-parse', 'refs/heads/main']);

  const executer: DependancesAuto['executer'] = (commande, args, options) => {
    appels.push({ commande, args: [...args] });
    const ok = (stdout = ''): { status: number; stdout: string; stderr: string } => ({ status: 0, stdout, stderr: '' });
    if (commande === 'npm' && args[0] === 'ci') {
      const lien = path.join(options?.cwd ?? depot, 'node_modules');
      if (!existsSync(lien)) symlinkSync(nodeModules, lien);
      return ok();
    }
    if (commande === '/usr/bin/security') return o.telegram === true ? ok('secret-fictif\n') : { status: 44, stdout: '', stderr: 'introuvable' };
    if (commande === '/usr/bin/osascript') return ok();
    if (commande === nodeReel && (args[0] ?? '').endsWith('scripts/ci-local.ts')) {
      const cwd = options?.cwd ?? depot;
      if (o.ciLocal === 'rouge') return { status: 1, stdout: '', stderr: 'étape en échec' };
      if (o.ciLocal === 'verrou' || o.ciLocal === 'verrou_fini') {
        // Message réel de scripts/ci-local.ts (Sortie 2 sur VerrouPris de scripts/lib/ci-local.ts).
        const message = `ci:local : une autre exécution tourne déjà (pid ${process.pid}, verrou ${chemins.verrouCi})`;
        if (o.ciLocal === 'verrou') {
          mkdirSync(chemins.verrouCi, { recursive: true, mode: 0o700 });
          writeFileSync(path.join(chemins.verrouCi, 'pid'), `${process.pid}\n`);
        }
        return { status: 2, stdout: '', stderr: `${message}\n` };
      }
      const commit = sh(cwd, ['rev-parse', 'HEAD']);
      ecrireRecu(home, {
        version: 1,
        commit,
        date: new Date().toISOString(),
        node: process.version,
        arbre_propre: true,
        partiel: false,
        base_ids: null,
        secrets: 'ok',
        gitleaks: 'faux',
        etapes: ETAPES.map((e) => ({ id: e.id, nomCi: e.nomCi, resultat: 'ok' as const, duree_ms: 1 })),
      });
      return ok('ci:local simulé : vert\n');
    }
    if (commande === nodeReel && (args[0] ?? '').endsWith('scripts/deploy-auto.ts')) {
      const lignes = scripts.length > 1 ? (scripts.shift() as string[]) : (scripts[0] ?? [`courant=${shaOrigine()} restreint=oui`, 'resultat=etat_lu']);
      const resultat = (/^resultat=(\w+)(?: sha=[0-9a-f]{12})?$/.exec(lignes[lignes.length - 1] ?? '')?.[1] ?? 'deploiement_refuse') as ResultatAuto;
      return { status: CODES_SORTIE_AUTO[resultat] ?? 1, stdout: `${lignes.join('\n')}\n`, stderr: '' };
    }
    const r = spawnSync(commande, args, {
      cwd: options?.cwd ?? depot,
      encoding: 'utf8',
      timeout: options?.timeoutMs ?? 120_000,
      env: { ...(options?.env ?? envDeBase()), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };

  const textes = o.textes ?? {};
  const deps: DependancesAuto = {
    dossier,
    depot,
    home,
    executer,
    lancer,
    recupererTexte: async (url) => textes[url] ?? { ok: false, echec: 'inaccessible' },
    fetch: async (_url, init) => {
      telegram.push(init?.body ?? '');
      return { ok: true, status: 200 };
    },
    maintenant: () => new Date(o.maintenant ?? '2026-11-26T10:00:00+01:00'),
    node: nodeReel,
    journal: (l) => journal.push(l),
    push: () => ({ destination: origine, env: envDeBase(), configGit: [] }),
  };

  return {
    racine,
    home,
    dossier,
    depot,
    origine,
    worktree: chemins.worktree,
    deps,
    fauxClaude,
    journal,
    appels: () => appels,
    telegramEnvoyes: () => telegram,
    shaOrigine,
    commitOrigine: (fichier, contenu, message) => {
      const avant = sh(depot, ['rev-parse', 'HEAD']);
      const cible = path.join(depot, fichier);
      mkdirSync(path.dirname(cible), { recursive: true });
      writeFileSync(cible, contenu);
      sh(depot, ['add', '--', fichier]);
      sh(depot, ['commit', '-q', '-m', message]);
      sh(depot, ['push', '-q', 'origin', 'main']);
      const nouveau = sh(depot, ['rev-parse', 'HEAD']);
      sh(depot, ['reset', '-q', '--hard', avant]);
      return nouveau;
    },
    empreinte,
    amont,
    jeuDeBase,
    detruire: () => {
      fauxClaude.detruire();
      rmSync(racine, { recursive: true, force: true });
    },
  };
}
