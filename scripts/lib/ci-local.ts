// CI locale (LOC-01, D-02) : rejoue sur le Mac les jobs verifier, secrets et e2e de .github/workflows/ci.yml.
// Chaque étape locale porte le nom exact de l'étape de ci.yml qu'elle rejoue (nomCi) ; les étapes de ci.yml qui
// n'ont pas d'équivalent local sont listées dans EXCLUSIONS_CI avec leur raison et leur rang. Le test
// tests/repo/ci-local-parite.test.ts échoue à la moindre dérive (étape ajoutée, retirée, renommée, déplacée,
// commande ou RTP_CONTENT_ROOT / RTP_MODE changés).
// Ce module n'importe que des modules node: (et processus.ts) : le processus de déploiement (plan 06), qui tiendra
// la clé, lit les reçus à travers lui, et aucun code de dépendance npm ne doit y entrer.
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { envDeBase, type Lanceur } from './processus.ts';
export type Job = 'verifier' | 'e2e' | 'secrets';

export interface EtapeLocale {
  /** Identifiant court, pour --etapes. */
  id: string;
  job: Job;
  /** Nom exact de l'étape de ci.yml. */
  nomCi: string;
  commande: string[];
  /** Variables propres à l'étape, ajoutées à envDeBase(). */
  env: Record<string, string>;
  /** identique : même commande et mêmes RTP_ que ci.yml ; substitution : équivalent local, raison obligatoire. */
  parite: 'identique' | 'substitution';
  raison?: string;
  special?: 'ids-lock' | 'gitleaks';
  delaiMs: number;
  /** Sortie affichée en direct (étapes longues) ; sinon capturée et montrée en cas d'échec seulement. */
  heriter?: true;
}

export interface ExclusionCi {
  job: Job;
  nomCi: string;
  raison: string;
  /** Rang (à partir de 0) de l'étape dans son job de ci.yml : une exclusion déplacée dans ci.yml est signalée. */
  rang: number;
}

const MIN = 60_000;
const FICTIF = { RTP_CONTENT_ROOT: 'tests/fixtures/corpus-valide' };
const REEL = { RTP_CONTENT_ROOT: '.' };

export const ETAPES: readonly EtapeLocale[] = [
  // ---------- job verifier ----------
  {
    id: 'npm-ls',
    job: 'verifier',
    nomCi: 'Installer les dépendances (npm ci)',
    commande: ['npm', 'ls', '--all'],
    env: {},
    parite: 'substitution',
    raison:
      'npm ls --all refuse un node_modules qui ne suit pas le lockfile ; npm ci reconstruirait node_modules à chaque contrôle sur une machine chargée. La build de déploiement fait, elle, un vrai npm ci --ignore-scripts (D-05)',
    delaiMs: 10 * MIN,
  },
  {
    id: 'audit-signatures',
    job: 'verifier',
    nomCi: 'Vérifier les signatures des paquets',
    commande: ['npm', 'audit', 'signatures'],
    env: {},
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'migrate-fictif',
    job: 'verifier',
    nomCi: 'migrate (corpus fictif)',
    commande: ['npm', 'run', 'migrate', '--', '--check'],
    env: FICTIF,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'migrate-reel',
    job: 'verifier',
    nomCi: 'migrate (corpus réel)',
    commande: ['npm', 'run', 'migrate', '--', '--check'],
    env: REEL,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'validate-fictif',
    job: 'verifier',
    nomCi: 'validate (corpus fictif, mode production)',
    commande: ['npm', 'run', 'validate', '--', '--mode', 'production', '--format', 'github'],
    env: FICTIF,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'validate-reel',
    job: 'verifier',
    nomCi: 'validate (corpus réel, mode production)',
    commande: ['npm', 'run', 'validate', '--', '--mode', 'production', '--format', 'github'],
    env: REEL,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'ids-lock',
    job: 'verifier',
    nomCi: 'ids.lock en ajout seul (comparé au commit de base)',
    commande: ['npm', 'run', 'ids', '--', '--check', '--base', '<fichier>'],
    env: REEL,
    parite: 'substitution',
    raison:
      'base = git merge-base HEAD origin/main après git fetch, ou le premier parent de HEAD si le commit est déjà poussé (github.event.before n\'existe pas en local) ; mêmes cas d\'échec fermé (commit de base introuvable) et d\'introduction du fichier ; la base retenue est écrite dans le reçu',
    special: 'ids-lock',
    delaiMs: 10 * MIN,
  },
  {
    id: 'check',
    job: 'verifier',
    nomCi: 'Vérifier les types (astro check)',
    commande: ['npm', 'run', 'check'],
    env: {},
    parite: 'identique',
    delaiMs: 15 * MIN,
  },
  {
    id: 'test',
    job: 'verifier',
    nomCi: 'Lancer les tests',
    commande: ['npm', 'test'],
    env: {},
    parite: 'identique',
    delaiMs: 30 * MIN,
    heriter: true,
  },
  {
    id: 'build-fictif',
    job: 'verifier',
    nomCi: 'Construire le site (corpus fictif)',
    commande: ['npm', 'run', 'build'],
    env: FICTIF,
    parite: 'identique',
    delaiMs: 20 * MIN,
    heriter: true,
  },
  {
    id: 'check-dist-fictif',
    job: 'verifier',
    nomCi: 'Contrôler le site construit (corpus fictif, poids, tiers, sources datées, cellules, brouillons)',
    commande: ['npm', 'run', 'check-dist'],
    env: FICTIF,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'build-reel',
    job: 'verifier',
    nomCi: 'Construire le site du corpus réel (production)',
    commande: ['npm', 'run', 'build', '--', '--outDir', 'dist-reel'],
    env: REEL,
    parite: 'identique',
    delaiMs: 20 * MIN,
    heriter: true,
  },
  {
    id: 'check-dist-reel',
    job: 'verifier',
    nomCi: 'Contrôler le site du corpus réel (production)',
    commande: ['npm', 'run', 'check-dist', '--', '--dist', 'dist-reel', '--mode', 'production'],
    env: REEL,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  {
    id: 'build-preview',
    job: 'verifier',
    nomCi: 'Construire le site du corpus réel (preview)',
    commande: ['npm', 'run', 'build', '--', '--outDir', 'dist-preview'],
    env: { ...REEL, RTP_MODE: 'preview' },
    parite: 'identique',
    delaiMs: 20 * MIN,
    heriter: true,
  },
  {
    id: 'check-dist-preview',
    job: 'verifier',
    nomCi: 'Contrôler le site du corpus réel (preview, noindex et robots.txt)',
    commande: ['npm', 'run', 'check-dist', '--', '--dist', 'dist-preview', '--mode', 'preview'],
    env: REEL,
    parite: 'identique',
    delaiMs: 10 * MIN,
  },
  // ---------- job secrets ----------
  {
    id: 'gitleaks-version',
    job: 'secrets',
    nomCi: 'Installer gitleaks (binaire épinglé, somme de contrôle vérifiée)',
    commande: ['gitleaks', 'version'],
    env: {},
    parite: 'substitution',
    raison:
      'gitleaks installé par Erwan avec Homebrew (brew install gitleaks, 8.30.1 comme la CI) : sa présence est vérifiée ; absent, la recherche de secrets est « non exécutée » et bloque deploy:local (D-02)',
    special: 'gitleaks',
    delaiMs: 10 * MIN,
  },
  {
    id: 'gitleaks',
    job: 'secrets',
    nomCi: 'Analyser l\'historique git',
    commande: ['gitleaks', 'git', '--no-banner', '--redact', '-v', '.'],
    env: {},
    parite: 'substitution',
    raison:
      'binaire gitleaks du PATH au lieu de celui téléchargé dans RUNNER_TEMP ; mêmes arguments, comparés par le test de parité',
    special: 'gitleaks',
    delaiMs: 10 * MIN,
  },
  // ---------- job e2e (le plus long, en dernier) ----------
  {
    id: 'playwright-chromium',
    job: 'e2e',
    nomCi: 'Installer Chromium et ses dépendances système',
    commande: ['npx', 'playwright', 'install', 'chromium'],
    env: {},
    parite: 'substitution',
    raison:
      'sans --with-deps : apt n\'existe pas sur macOS ; idempotent, le cache ~/Library/Caches/ms-playwright contient déjà Chromium',
    delaiMs: 10 * MIN,
  },
  {
    id: 'e2e',
    job: 'e2e',
    nomCi: 'Lancer les tests navigateur (fixture et corpus réel)',
    commande: ['npm', 'run', 'e2e'],
    env: {},
    parite: 'identique',
    delaiMs: 45 * MIN,
    heriter: true,
  },
];

const RAISON_CLONE = 'on travaille sur le clone d\'Erwan ; git fetch origin main est fait au calcul de la base de ids.lock';
const RAISON_NODE = 'Node 24 fourni par fnm (fnm exec --using=24) ; la commande refuse une autre version au départ';
const RAISON_DEJA = 'déjà fait une fois par la partie verifier (même commande, même arbre)';

export const EXCLUSIONS_CI: readonly ExclusionCi[] = [
  { job: 'verifier', rang: 0, nomCi: 'Récupérer le dépôt (historique complet, pour comparer ids.lock au commit de base)', raison: RAISON_CLONE },
  { job: 'verifier', rang: 1, nomCi: 'Installer Node (version de .nvmrc)', raison: RAISON_NODE },
  {
    job: 'verifier',
    rang: 17,
    nomCi: 'Publier la build preview (artefact site-preview, URL de test du lot 2)',
    raison: 'dist-preview/ reste sur le Mac, aucun artefact à publier',
  },
  { job: 'e2e', rang: 0, nomCi: 'Récupérer le dépôt', raison: RAISON_CLONE },
  { job: 'e2e', rang: 1, nomCi: 'Installer Node (version de .nvmrc)', raison: RAISON_NODE },
  { job: 'e2e', rang: 2, nomCi: 'Installer les dépendances (npm ci)', raison: RAISON_DEJA },
  { job: 'e2e', rang: 3, nomCi: 'Vérifier les signatures des paquets', raison: RAISON_DEJA },
  {
    job: 'e2e',
    rang: 6,
    nomCi: 'Conserver le rapport Playwright en cas d\'échec',
    raison: 'playwright-report/ reste sur le Mac ; son chemin est rappelé en cas d\'échec',
  },
  { job: 'secrets', rang: 0, nomCi: 'Récupérer tout l\'historique', raison: RAISON_CLONE },
];

// ---------- parité avec ci.yml ----------

export interface EtapeCi {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
}
export interface CiParite {
  jobs: Partial<Record<string, { steps: EtapeCi[] }>>;
}

const JOBS: readonly Job[] = ['verifier', 'e2e', 'secrets'];
const BINAIRE_GITLEAKS_CI = '"$RUNNER_TEMP/gitleaks/gitleaks"';

const variablesRtp = (env: Record<string, string> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(env ?? {}).filter(([k]) => k.startsWith('RTP_')));

/**
 * Écarts entre le catalogue local et les jobs verifier, e2e, secrets de ci.yml (analysé par le test, ce module
 * n'importe pas le paquet yaml). Liste vide : parité tenue. Fonction pure, testée par mutation.
 */
export function ecartsParite(ci: CiParite, etapes: readonly EtapeLocale[], exclusions: readonly ExclusionCi[]): string[] {
  const ecarts: string[] = [];
  for (const job of JOBS) {
    const steps = ci.jobs[job]?.steps;
    if (!Array.isArray(steps)) {
      ecarts.push(`job ${job} absent de ci.yml`);
      continue;
    }
    const noms = steps.map((s) => s.name ?? `(étape sans nom, rang ${steps.indexOf(s)})`);
    const locales = etapes.filter((e) => e.job === job);
    const exclues = exclusions.filter((x) => x.job === job);
    const connus = new Set([...locales.map((e) => e.nomCi), ...exclues.map((x) => x.nomCi)]);
    for (const nom of noms) {
      if (!connus.has(nom)) ecarts.push(`${job} : étape « ${nom} » de ci.yml absente du catalogue local (ni étape, ni exclusion)`);
    }
    for (const nom of connus) {
      const n = noms.filter((x) => x === nom).length;
      if (n === 0) ecarts.push(`${job} : étape locale « ${nom} » absente de ci.yml`);
      if (n > 1) ecarts.push(`${job} : étape « ${nom} » présente ${n} fois dans ci.yml`);
    }
    for (const x of exclues) {
      if (locales.some((e) => e.nomCi === x.nomCi)) ecarts.push(`${job} : « ${x.nomCi} » est à la fois étape et exclusion`);
      const rang = noms.indexOf(x.nomCi);
      if (rang !== -1 && rang !== x.rang) ecarts.push(`${job} : exclusion « ${x.nomCi} » au rang ${rang} de ci.yml, attendue au rang ${x.rang}`);
      if (x.raison.trim() === '') ecarts.push(`${job} : exclusion « ${x.nomCi} » sans raison`);
    }
    const ordreCi = noms.filter((nom) => locales.some((e) => e.nomCi === nom));
    const ordreLocal = locales.map((e) => e.nomCi).filter((nom) => noms.includes(nom));
    if (ordreCi.join('\n') !== ordreLocal.join('\n')) {
      ecarts.push(`${job} : ordre des étapes différent de ci.yml (ci.yml : ${ordreCi.join(' | ')} ; local : ${ordreLocal.join(' | ')})`);
    }
    for (const e of locales) {
      const s = steps.find((x) => x.name === e.nomCi);
      if (s === undefined) continue;
      if (e.parite === 'substitution' && (e.raison ?? '').trim() === '') ecarts.push(`${job} : substitution « ${e.nomCi} » sans raison`);
      if (e.special === 'gitleaks' && e.commande[1] === 'git') {
        const attendu = (s.run ?? '').trim().replace(BINAIRE_GITLEAKS_CI, 'gitleaks');
        if (attendu !== e.commande.join(' ')) ecarts.push(`${job} : « ${e.nomCi} » : commande gitleaks de ci.yml « ${(s.run ?? '').trim()} », locale « ${e.commande.join(' ')} »`);
      }
      if (e.parite !== 'identique') continue;
      if (typeof s.run !== 'string') {
        ecarts.push(`${job} : « ${e.nomCi} » n'a plus de run dans ci.yml`);
        continue;
      }
      if (s.run.trim() !== e.commande.join(' ')) {
        ecarts.push(`${job} : « ${e.nomCi} » : run de ci.yml « ${s.run.trim()} », commande locale « ${e.commande.join(' ')} »`);
      }
      const rtpCi = variablesRtp(s.env);
      const rtpLocal = variablesRtp(e.env);
      for (const k of new Set([...Object.keys(rtpCi), ...Object.keys(rtpLocal), 'RTP_CONTENT_ROOT', 'RTP_MODE'])) {
        if (rtpCi[k] !== rtpLocal[k]) {
          ecarts.push(`${job} : « ${e.nomCi} » : ${k} vaut ${rtpCi[k] ?? '(absent)'} dans ci.yml, ${rtpLocal[k] ?? '(absent)'} en local`);
        }
      }
    }
  }
  return ecarts;
}

// ---------- reçu (D-03) ----------

export type ResultatEtape = 'ok' | 'echec' | 'non_executee';

export interface Recu {
  version: 1;
  commit: string;
  date: string;
  node: string;
  arbre_propre: boolean;
  partiel: boolean;
  base_ids: string | null;
  secrets: ResultatEtape;
  gitleaks: string | null;
  etapes: { id: string; nomCi: string; resultat: ResultatEtape; duree_ms: number }[];
}

const SHA = /^[0-9a-f]{40}$/;
const RESULTATS: readonly string[] = ['ok', 'echec', 'non_executee'];

/** Dossier des reçus et du verrou : hors du dépôt, dans le cache de l'utilisateur. */
export const dossierRecus = (home: string): string => path.join(home, '.cache', 'rtp', 'ci');

export function cheminRecu(home: string, sha: string): string {
  if (!SHA.test(sha)) throw new Error(`commit invalide pour un reçu (40 hexadécimaux attendus) : ${sha}`);
  return path.join(dossierRecus(home), `${sha}.json`);
}

/** Écrit le reçu (dossier 0700, fichier 0600, écriture atomique par renommage) et renvoie son chemin. */
export function ecrireRecu(home: string, recu: Recu): string {
  const chemin = cheminRecu(home, recu.commit);
  const dossier = path.dirname(chemin);
  mkdirSync(dossier, { recursive: true, mode: 0o700 });
  chmodSync(dossier, 0o700);
  const provisoire = `${chemin}.${process.pid}.provisoire`;
  writeFileSync(provisoire, `${JSON.stringify(recu, null, 2)}\n`, { mode: 0o600 });
  chmodSync(provisoire, 0o600);
  renameSync(provisoire, chemin);
  return chemin;
}

const estChaine = (v: unknown): v is string => typeof v === 'string';
const chaineOuNull = (v: unknown): boolean => v === null || typeof v === 'string';

function formeDeRecu(v: unknown): v is Recu {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.version !== 'number' || !estChaine(r.commit) || !estChaine(r.date) || !estChaine(r.node)) return false;
  if (typeof r.arbre_propre !== 'boolean' || typeof r.partiel !== 'boolean') return false;
  if (!chaineOuNull(r.base_ids) || !chaineOuNull(r.gitleaks) || !RESULTATS.includes(r.secrets as string)) return false;
  if (!Array.isArray(r.etapes)) return false;
  return r.etapes.every((e: unknown) => {
    if (typeof e !== 'object' || e === null) return false;
    const x = e as Record<string, unknown>;
    return estChaine(x.id) && estChaine(x.nomCi) && RESULTATS.includes(x.resultat as string) && typeof x.duree_ms === 'number';
  });
}

/** Reçu du commit, ou null s'il manque, n'est pas du JSON ou n'a pas la forme attendue. */
export function lireRecu(home: string, sha: string): Recu | null {
  let brut: string;
  try {
    brut = readFileSync(cheminRecu(home, sha), 'utf8');
  } catch {
    return null;
  }
  try {
    const v: unknown = JSON.parse(brut);
    return formeDeRecu(v) ? v : null;
  } catch {
    return null;
  }
}

/** Un reçu ne vaut pour un déploiement que s'il est complet, vert, d'un arbre propre, pour ce commit exact. */
export function recuValidePourDeploiement(recu: Recu | null, sha: string): { ok: boolean; motif: string } {
  if (recu === null) return { ok: false, motif: `aucun reçu de CI locale pour le commit ${sha} (lancer npm run ci:local)` };
  if (recu.version !== 1) return { ok: false, motif: `version de reçu inconnue (${String(recu.version)})` };
  if (recu.commit !== sha) return { ok: false, motif: `reçu d'un autre commit (${recu.commit}, attendu ${sha})` };
  if (recu.partiel) return { ok: false, motif: 'reçu d\'une exécution partielle (--etapes) : ne permet pas de déployer' };
  if (!recu.arbre_propre) return { ok: false, motif: 'reçu d\'un arbre de travail non propre' };
  if (recu.secrets !== 'ok') {
    return { ok: false, motif: `recherche de secrets (gitleaks) ${recu.secrets === 'non_executee' ? 'non exécutée' : 'en échec'} : installer gitleaks (brew install gitleaks) puis relancer npm run ci:local` };
  }
  for (const e of ETAPES) {
    const r = recu.etapes.find((x) => x.id === e.id);
    if (r === undefined) return { ok: false, motif: `étape absente du reçu : ${e.nomCi}` };
    if (r.resultat !== 'ok') return { ok: false, motif: `étape ${r.resultat === 'echec' ? 'en échec' : 'non exécutée'} : ${e.nomCi}` };
  }
  return { ok: true, motif: `reçu vert du ${recu.date}` };
}

// ---------- base de ids.lock ----------

const lancerGit = (lancer: Lanceur, racine: string, args: string[], delaiMs = 2 * MIN) =>
  lancer({ commande: 'git', args, cwd: racine, env: envDeBase(), delaiMs, libelle: `git ${args[0] ?? ''}` });

/**
 * Commit de base de la comparaison de ids.lock : git fetch origin main (échec : avertissement, origin/main local
 * gardé), puis merge-base de HEAD et origin/main ; s'il vaut HEAD (commit déjà poussé), le premier parent de HEAD.
 * base null : aucune base (échec fermé de l'étape).
 */
export async function baseIdsLock(lancer: Lanceur, racine: string): Promise<{ base: string | null; message: string }> {
  const messages: string[] = [];
  const fetch = await lancerGit(lancer, racine, ['fetch', '--quiet', '--no-tags', 'origin', 'main'], 5 * MIN);
  if (fetch.code !== 0) messages.push('avertissement : git fetch origin main impossible, origin/main local gardé');
  const head = (await lancerGit(lancer, racine, ['rev-parse', 'HEAD'])).stdout.trim();
  const mb = await lancerGit(lancer, racine, ['merge-base', 'HEAD', 'origin/main']);
  const fusion = mb.stdout.trim();
  if (mb.code !== 0 || !SHA.test(fusion)) {
    messages.push('merge-base de HEAD et origin/main introuvable : impossible de comparer ids.lock');
    return { base: null, message: messages.join(' ; ') };
  }
  if (fusion !== head) {
    messages.push(`base = merge-base avec origin/main (${fusion})`);
    return { base: fusion, message: messages.join(' ; ') };
  }
  const parent = await lancerGit(lancer, racine, ['rev-parse', '--verify', '--quiet', 'HEAD^1']);
  const p = parent.stdout.trim();
  if (parent.code !== 0 || !SHA.test(p)) {
    messages.push('HEAD est déjà sur origin/main et n\'a pas de parent : impossible de comparer ids.lock');
    return { base: null, message: messages.join(' ; ') };
  }
  messages.push(`commit déjà poussé : base = premier parent de HEAD (${p})`);
  return { base: p, message: messages.join(' ; ') };
}

// ---------- exécution des étapes ----------

export interface ContexteExecution {
  lancer: Lanceur;
  racine: string;
  ecrire: (ligne: string) => void;
}

export interface BilanExecution {
  etapes: Recu['etapes'];
  base_ids: string | null;
  gitleaks: string | null;
  secrets: ResultatEtape;
}

export function duree(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

const dernieresLignes = (texte: string, n: number): string[] => {
  const lignes = texte.replace(/\s+$/, '').split('\n');
  return lignes.slice(Math.max(0, lignes.length - n));
};

/** Lance les étapes dans l'ordre ; un échec n'arrête pas la suite (le reçu liste chaque résultat). */
export async function executerEtapes(etapes: readonly EtapeLocale[], ctx: ContexteExecution): Promise<BilanExecution> {
  const { lancer, racine, ecrire } = ctx;
  const bilan: BilanExecution = { etapes: [], base_ids: null, gitleaks: null, secrets: 'non_executee' };
  let gitleaksAbsent = false;

  const lancerEtape = async (e: EtapeLocale, commande: string[]): Promise<boolean> => {
    const r = await lancer({
      commande: commande[0] ?? '',
      args: commande.slice(1),
      cwd: racine,
      env: { ...envDeBase(), ...e.env },
      delaiMs: e.delaiMs,
      libelle: e.nomCi,
      heriter: e.heriter === true,
    });
    const ok = r.code === 0 && !r.delaiDepasse;
    if (!ok) {
      if (r.delaiDepasse) ecrire(`    délai de ${Math.round(e.delaiMs / MIN)} min dépassé : processus arrêté`);
      if (e.heriter !== true) for (const l of dernieresLignes(`${r.stdout}\n${r.stderr}`, 40)) ecrire(`    ${l}`);
    }
    return ok;
  };

  for (const e of etapes) {
    const debut = Date.now();
    let resultat: ResultatEtape;
    const details: string[] = [];
    let ligne: string | undefined;

    if (e.special === 'gitleaks' && gitleaksAbsent) {
      resultat = 'non_executee';
      ligne = `[non exécutée] ${e.nomCi} : gitleaks absent`;
    } else if (e.special === 'gitleaks' && e.commande[1] === 'version') {
      const r = await lancer({ commande: 'gitleaks', args: ['version'], cwd: racine, env: envDeBase(), delaiMs: e.delaiMs, libelle: e.nomCi });
      if (r.code === 0) {
        resultat = 'ok';
        bilan.gitleaks = r.stdout.trim().split('\n')[0]?.trim() || null;
      } else {
        gitleaksAbsent = true;
        resultat = 'non_executee';
        ligne = '[non exécutée] Chercher des secrets : gitleaks absent (brew install gitleaks)';
      }
    } else if (e.special === 'ids-lock') {
      const { base, message } = await baseIdsLock(lancer, racine);
      bilan.base_ids = base;
      details.push(message);
      if (base === null) {
        resultat = 'echec';
      } else if ((await lancerGit(lancer, racine, ['cat-file', '-e', `${base}^{commit}`])).code !== 0) {
        details.push(`Commit de base ${base} introuvable (réécriture d'historique ?) : comparaison de ids.lock impossible, l'étape échoue plutôt que de la sauter`);
        resultat = 'echec';
      } else if ((await lancerGit(lancer, racine, ['cat-file', '-e', `${base}:ids.lock`])).code !== 0) {
        details.push(`ids.lock n'existe pas dans le commit de base ${base} (introduction du fichier) : comparaison ignorée`);
        resultat = 'ok';
      } else {
        const show = await lancerGit(lancer, racine, ['show', `${base}:ids.lock`]);
        if (show.code !== 0) {
          details.push(`lecture de ids.lock dans ${base} impossible`);
          resultat = 'echec';
        } else {
          const dossier = mkdtempSync(path.join(tmpdir(), 'rtp-ids-base-'));
          try {
            const fichier = path.join(dossier, 'ids-base.lock');
            writeFileSync(fichier, show.stdout);
            resultat = (await lancerEtape(e, ['npm', 'run', 'ids', '--', '--check', '--base', fichier])) ? 'ok' : 'echec';
          } finally {
            rmSync(dossier, { recursive: true, force: true });
          }
        }
      }
    } else {
      resultat = (await lancerEtape(e, e.commande)) ? 'ok' : 'echec';
    }

    const ms = Date.now() - debut;
    const marque = resultat === 'ok' ? '[ok]' : resultat === 'echec' ? '[échec]' : '[non exécutée]';
    ecrire(ligne ?? `${marque} ${e.nomCi} (${duree(ms)})`);
    for (const d of details) ecrire(`    ${d}`);
    bilan.etapes.push({ id: e.id, nomCi: e.nomCi, resultat, duree_ms: ms });
  }

  const analyse = bilan.etapes.find((x) => x.id === 'gitleaks');
  bilan.secrets = gitleaksAbsent || analyse === undefined ? 'non_executee' : analyse.resultat;
  return bilan;
}

// ---------- verrou ----------

export class VerrouPris extends Error {
  readonly pid: number | null;
  constructor(pid: number | null, dossier: string) {
    super(`une autre exécution tourne déjà (pid ${pid ?? 'inconnu'}, verrou ${dossier})`);
    this.name = 'VerrouPris';
    this.pid = pid;
  }
}

const vivant = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * Verrou par dossier (mkdir est atomique, flock n'existe pas sur macOS) contenant le pid du détenteur. Tenu par un
 * processus vivant : VerrouPris. Laissé par un processus mort (ou sans pid depuis plus d'une minute) : repris, avec
 * un avertissement. Renvoie la fonction qui rend le verrou.
 */
export function prendreVerrou(dossier: string, avertir: (m: string) => void = (m) => console.warn(m)): () => void {
  mkdirSync(path.dirname(dossier), { recursive: true, mode: 0o700 });
  const fichierPid = path.join(dossier, 'pid');
  try {
    mkdirSync(dossier, { mode: 0o700 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    let pid: number | null = null;
    try {
      const n = Number.parseInt(readFileSync(fichierPid, 'utf8').trim(), 10);
      pid = Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      pid = null;
    }
    if (pid !== null && vivant(pid)) throw new VerrouPris(pid, dossier);
    if (pid === null && Date.now() - statSync(dossier).mtimeMs < MIN) throw new VerrouPris(null, dossier);
    avertir(`avertissement : verrou abandonné par le processus ${pid ?? 'inconnu'} (${dossier}) : repris`);
    // IN-05 (revue de la phase 9.2) : le verrou abandonné est d'abord renommé vers un nom unique, puis son pid relu :
    // deux processus qui le reprennent en même temps ne suppriment jamais le verrou que l'autre vient de créer, et
    // le chemin principal n'est jamais supprimé ici.
    const abandon = `${dossier}.abandon-${process.pid}-${randomBytes(4).toString('hex')}`;
    try {
      renameSync(dossier, abandon);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    let pidRenomme: number | null = null;
    try {
      const n = Number.parseInt(readFileSync(path.join(abandon, 'pid'), 'utf8').trim(), 10);
      pidRenomme = Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      pidRenomme = null;
    }
    if (existsSync(abandon) && pidRenomme !== pid) {
      // Un autre processus a repris le verrou entre la lecture et le renommage : on le lui rend.
      try {
        renameSync(abandon, dossier);
      } catch {
        // Le chemin principal est déjà repris : le verrou renommé n'est plus celui de personne.
      }
      throw new VerrouPris(pidRenomme, dossier);
    }
    rmSync(abandon, { recursive: true, force: true });
    try {
      mkdirSync(dossier, { mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new VerrouPris(null, dossier);
      throw e;
    }
  }
  writeFileSync(fichierPid, String(process.pid), { mode: 0o600 });
  let rendu = false;
  return () => {
    if (rendu) return;
    rendu = true;
    try {
      if (readFileSync(fichierPid, 'utf8').trim() === String(process.pid)) rmSync(dossier, { recursive: true, force: true });
    } catch {
      // Verrou déjà retiré.
    }
  };
}
