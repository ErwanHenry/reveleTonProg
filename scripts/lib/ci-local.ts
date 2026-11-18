// CI locale (LOC-01, D-02) : rejoue sur le Mac les jobs verifier, secrets et e2e de .github/workflows/ci.yml.
// Chaque étape locale porte le nom exact de l'étape de ci.yml qu'elle rejoue (nomCi) ; les étapes de ci.yml qui
// n'ont pas d'équivalent local sont listées dans EXCLUSIONS_CI avec leur raison et leur rang. Le test
// tests/repo/ci-local-parite.test.ts échoue à la moindre dérive (étape ajoutée, retirée, renommée, déplacée,
// commande ou RTP_CONTENT_ROOT / RTP_MODE changés).
// Ce module n'importe que des modules node: (et processus.ts) : le processus de déploiement (plan 06), qui tiendra
// la clé, lit les reçus à travers lui, et aucun code de dépendance npm ne doit y entrer.
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
