// Build de déploiement depuis le Mac (LOC-02, D-05) : équivalent local du job construire de
// .github/workflows/ci.yml et de la séparation WR-04. Sur GitHub, la build (code de dépendances npm) et la clé SSH
// vivent sur deux machines ; sur le Mac, elles tournent sous le même utilisateur Unix (recherche §4.1). La build est
// donc :
//   - faite dans un worktree git temporaire du commit exact (npm ci --ignore-scripts, npm audit signatures,
//     npm run build, npm run check-dist -- --mode production), avec un environnement en liste blanche
//     (RTP_CONTENT_ROOT=., RTP_DEPLOIEMENT 1 en production et 0 en essai, GITHUB_SHA pour version.json) ;
//   - lancée sous sandbox-exec avec un profil qui interdit toute écriture sauf le worktree, son dossier
//     .git/worktrees/<nom> dans le dépôt principal, un dossier temporaire propre à cette build (<worktree>-tmp, donné
//     comme TMPDIR) et un cache npm propre à ces builds (~/.cache/rtp/npm-build, CR-03), qui interdit la lecture de chaque chemin secret configuré, de ~/.config/rtp,
//     ~/.ssh, ~/.config/gh et des dossiers d'agents ssh (~/.cache/rtp/agents), et toute connexion à un socket Unix
//     hors du résolveur DNS. La build est refusée si l'un de ces chemins se trouve sous un dossier où elle peut écrire,
//     ou si un tel dossier contient le dossier personnel ou le .git ;
//   - lancée dans sa propre session (setsid, sans terminal de contrôle), groupe de processus tué à la fin de chaque
//     étape ;
//   - encadrée par un instantané (executables.ts) pris avant et comparé après : il constate ce que le profil ne
//     peut pas garantir seul (hooks git, configuration git, fichiers de configuration, binaire du même nom glissé
//     plus tôt dans le PATH) ;
//   - copiée, une fois les étapes finies, dans un dossier privé que le profil ne laisse pas écrire
//     (~/.cache/rtp/deploiement/build-<hasard>, 0700), puis le worktree est retiré : l'empreinte, les contrôles
//     d'après la confirmation et l'envoi portent sur cette copie seule (CR-02 de la revue de la phase 9.2 : un
//     processus resté de la build ne peut plus réécrire ce qui part en ligne entre l'empreinte et rsync).
// Aucun agent SSH n'existe à ce stade : le plan 06 le démarre après la build. Aucun secret n'est lu ici : les chemins
// sont seulement résolus pour le profil et l'instantané (sha256 des fichiers surveillés, jamais affiché).
// N'importe que des modules node: et des modules relatifs.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir as tmpdirSysteme } from 'node:os';
import path from 'node:path';
import { envDeBase, type Lanceur } from '../processus.ts';
import { empreinteArbre, normaliserModes, trouverSpecial } from './empreinte.ts';
import { prendreInstantane, resoudreExecutables, verifierIntegrite, type Executables, type Instantane } from './executables.ts';
import { Sortie } from './gardes.ts';

const MIN = 60_000;
const SHA = /^[0-9a-f]{40}$/;

/** Commande des tests du bac à sable, quand l'exécuteur ne peut pas les jouer (bac à sable imbriqué refusé). */
export const COMMANDE_TESTS_BAC_A_SABLE = 'TZ=Europe/Paris fnm exec --using=24 node --test --test-timeout=900000 tests/deploiement/construire.test.ts';

/** Chemin réel : realpath de l'ancêtre existant le plus profond, suivi du reste (le bac à sable compare des chemins réels). */
export function reel(p: string): string {
  const abs = path.resolve(p);
  const reste: string[] = [];
  let courant = abs;
  for (;;) {
    try {
      return path.join(realpathSync(courant), ...reste.slice().reverse());
    } catch {
      const parent = path.dirname(courant);
      if (parent === courant) return abs;
      reste.push(path.basename(courant));
      courant = parent;
    }
  }
}

/** p est-il racine elle-même ou sous racine ? */
const sous = (p: string, racine: string): boolean => p === racine || p.startsWith(racine.endsWith('/') ? racine : `${racine}/`);

function cheminProfil(p: string): string {
  if (/["\\]/.test(p)) throw new Sortie(2, `chemin refusé dans le profil du bac à sable (guillemet ou barre oblique inverse) : ${p}`);
  const r = reel(p);
  if (/["\\]/.test(r)) throw new Sortie(2, `chemin refusé dans le profil du bac à sable (guillemet ou barre oblique inverse) : ${r}`);
  return r;
}

export interface OptionsProfil {
  home: string;
  worktree: string;
  gitWorktreeDir: string;
  tmpdir: string;
  cacheNpm: string;
  lecturesInterdites: string[];
}

/** Dossiers interdits en lecture à la build, sous HOME : clés et configuration, et sockets des agents ssh (CR-01). */
export const DOSSIERS_INTERDITS = ['.config/rtp', '.ssh', '.config/gh', '.cache/rtp/agents'] as const;

/** Socket du résolveur DNS de macOS, seule connexion Unix permise à la build (npm ci résout le registre). */
const RESOLVEUR = '/private/var/run/mDNSResponder';

/**
 * Profil sandbox-exec de la build : écriture refusée hors liste blanche, lecture refusée pour chaque secret et chaque
 * dossier d'agent ssh, connexion refusée à tout socket Unix sauf le résolveur DNS (CR-01 : un processus de la build
 * ne joint pas l'agent qui tiendra la clé).
 */
export function profilSandbox(o: OptionsProfil): string {
  const ecriture = [o.worktree, o.gitWorktreeDir, o.tmpdir, o.cacheNpm].map((p) => `(subpath "${cheminProfil(p)}")`);
  // WR-07 (revue de la phase 9.2) : /dev/tty n'est plus inscriptible ; il est même interdit en lecture et en écriture
  // plus bas. Avec la session propre de chaque étape (sans terminal de contrôle), un processus de la build ne peut ni
  // écrire de fausses lignes d'écran, ni injecter de frappes (TIOCSTI) pendant la confirmation.
  ecriture.push('(literal "/dev/null")');
  const lecture = o.lecturesInterdites.map((p) => `(literal "${cheminProfil(p)}")`);
  for (const rel of DOSSIERS_INTERDITS) lecture.push(`(subpath "${cheminProfil(path.join(o.home, rel))}")`);
  return (
    `(version 1)(allow default)(deny file-write*)(allow file-write* ${ecriture.join(' ')})(deny file-read* ${lecture.join(' ')})` +
    `(deny network-outbound (remote unix-socket))(allow network-outbound (remote unix-socket (path-literal "${RESOLVEUR}")))` +
    '(deny file-read* file-write* (literal "/dev/tty"))'
  );
}

/** Environnement de la build : liste blanche de envDeBase plus les variables du job construire de ci.yml. */
export function envConstruction(cible: 'essai' | 'production', sha: string, cacheNpm: string, source?: NodeJS.ProcessEnv): Record<string, string> {
  return {
    ...envDeBase(source),
    RTP_CONTENT_ROOT: '.',
    RTP_DEPLOIEMENT: cible === 'production' ? '1' : '0',
    GITHUB_SHA: sha,
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_cache: cacheNpm,
  };
}

/**
 * Le bac à sable fonctionne-t-il ici ? Une écriture permise doit réussir et une écriture hors liste être refusée.
 * Hors macOS : « macOS seulement » (CI GitHub sous Linux).
 */
export function sondeBacASable(): { ok: boolean; raison: string } {
  if (process.platform !== 'darwin') return { ok: false, raison: 'macOS seulement' };
  const refus = `bac à sable imbriqué refusé ici : à lancer par la session principale avec ${COMMANDE_TESTS_BAC_A_SABLE}`;
  const exe = '/usr/bin/sandbox-exec';
  if (!existsSync(exe)) return { ok: false, raison: refus };
  const permis = realpathSync(mkdtempSync(path.join(tmpdirSysteme(), 'rtp-sonde-permis-')));
  const interdit = realpathSync(mkdtempSync(path.join(tmpdirSysteme(), 'rtp-sonde-interdit-')));
  try {
    const profil = `(version 1)(allow default)(deny file-write*)(allow file-write* (subpath "${permis}"))`;
    const a = spawnSync(exe, ['-p', profil, '/usr/bin/touch', path.join(permis, 'f')], { stdio: 'ignore', timeout: 30_000 });
    const b = spawnSync(exe, ['-p', profil, '/usr/bin/touch', path.join(interdit, 'f')], { stdio: 'ignore', timeout: 30_000 });
    const ok = a.status === 0 && existsSync(path.join(permis, 'f')) && b.status !== 0 && !existsSync(path.join(interdit, 'f'));
    return ok ? { ok: true, raison: '' } : { ok: false, raison: refus };
  } finally {
    rmSync(permis, { recursive: true, force: true });
    rmSync(interdit, { recursive: true, force: true });
  }
}

export interface BuildDeploiement {
  cible: 'essai' | 'production';
  sha: string;
  /** Dossier privé de la copie (CR-02) ; dist est son sous-dossier. */
  dossierTravail: string;
  /** Worktree de la build, déjà retiré au retour de construireDeploiement (CR-02). */
  worktree: string;
  dist: string;
  empreinte: string;
  /** Instantané pris avant la build : le plan 06 le compare de nouveau après la confirmation. */
  instantane: Instantane;
  executables: Executables;
  nettoyer: () => Promise<void>;
}

export interface OptionsConstruction {
  racine: string;
  sha: string;
  cible: 'essai' | 'production';
  home: string;
  lecturesInterdites: string[];
  fichiersSurveilles: string[];
  nomsExecutables: string[];
  lancer: Lanceur;
  ecrire: (m: string) => void;
  /** Environnement d'où viennent PATH et la liste blanche (défaut : celui du processus). */
  source?: NodeJS.ProcessEnv;
  /** Dossier temporaire de la build (défaut : TMPDIR, sinon celui du système). */
  tmpdir?: string;
  /** Appelé hors du bac à sable après chaque étape npm (tests). */
  apresEtape?: (etape: string) => void | Promise<void>;
  /** WR-05 : signal reçu : l'étape en cours est tuée avec son groupe, la build s'arrête et se nettoie. */
  arret?: AbortSignal;
}

const ETAPES: readonly { args: string[]; delaiMs: number }[] = [
  { args: ['ci', '--ignore-scripts'], delaiMs: 20 * MIN },
  { args: ['audit', 'signatures'], delaiMs: 5 * MIN },
  { args: ['run', 'build'], delaiMs: 25 * MIN },
  { args: ['run', 'check-dist', '--', '--mode', 'production'], delaiMs: 10 * MIN },
];

/** Cache npm dédié aux builds de déploiement (CR-03), sous HOME, jamais celui de l'utilisateur. */
export function cheminCacheNpm(home: string): string {
  return path.join(home, '.cache', 'rtp', 'npm-build');
}

const fin = (texte: string, lignes = 20): string => texte.trim().split('\n').slice(-lignes).join('\n');

export async function construireDeploiement(o: OptionsConstruction): Promise<BuildDeploiement> {
  if (!SHA.test(o.sha)) throw new Sortie(2, `commit invalide (40 hexadécimaux attendus) : ${o.sha}`);
  if (o.cible !== 'essai' && o.cible !== 'production') throw new Sortie(2, `cible invalide : ${String(o.cible)} (essai ou production)`);
  const source = o.source ?? process.env;
  const chemin = source.PATH ?? '';

  // 1. Outils résolus en chemins absolus avant tout : sandbox-exec d'abord (sans lui, aucun cloisonnement).
  let sandboxExec: string;
  try {
    sandboxExec = (resoudreExecutables(['sandbox-exec'], chemin)['sandbox-exec'] as { chemin: string }).chemin;
  } catch {
    throw new Sortie(2, 'sandbox-exec introuvable : la build de déploiement ne peut pas être cloisonnée, déploiement refusé');
  }
  const outils = resoudreExecutables(['npm', 'git', 'jq'], chemin);
  const npm = (outils.npm as { chemin: string }).chemin;
  const gitExe = (outils.git as { chemin: string }).chemin;
  const jq = (outils.jq as { chemin: string }).chemin;
  const executables = resoudreExecutables(o.nomsExecutables, chemin);

  // 2. Refus avant tout appel de npm : aucun chemin protégé sous un dossier où la build peut écrire.
  const tmp = reel(o.tmpdir ?? source.TMPDIR ?? tmpdirSysteme());
  if (!existsSync(tmp) || !lstatSync(tmp).isDirectory()) throw new Sortie(2, `dossier temporaire de la build absent : ${tmp}`);
  const protégés = [...o.lecturesInterdites, ...DOSSIERS_INTERDITS.map((r) => path.join(o.home, r))].map(reel);
  const sensibles = [reel(o.home), reel(path.join(o.racine, '.git'))];
  const verifierEcrivable = (ecrivable: string, nom: string): void => {
    for (const p of protégés) {
      if (sous(p, ecrivable)) throw new Sortie(2, `chemin protégé ${p} sous ${nom} (${ecrivable}), où la build peut écrire : déploiement refusé`);
    }
    for (const s of sensibles) {
      if (sous(s, ecrivable)) throw new Sortie(2, `${nom} (${ecrivable}) contient ${s} (dossier personnel ou .git du dépôt) : déploiement refusé`);
    }
  };
  verifierEcrivable(tmp, 'le dossier temporaire');

  // 3. Instantané avant la build.
  const optionsInstantane = { racine: o.racine, fichiers: o.fichiersSurveilles, executables: { noms: o.nomsExecutables, path: chemin } };
  const instantane = prendreInstantane(optionsInstantane);

  // 4. Worktree détaché du commit exact, hors du bac à sable, sans hook du dépôt.
  const envGit = envDeBase(source);
  const git = (args: string[], cwd: string, delaiMs = 2 * MIN) => o.lancer({ commande: gitExe, args, cwd, env: envGit, delaiMs, libelle: `git ${args[0] ?? ''}` });
  const nom = `rtp-deploiement-${o.sha.slice(0, 12)}-${randomBytes(4).toString('hex')}`;
  const dossier = path.join(tmp, nom);
  // CR-01 : dossier temporaire propre à la build (TMPDIR de ses étapes) ; le TMPDIR de l'utilisateur ne lui est plus
  // ouvert en écriture.
  const dossierTmp = path.join(tmp, `${nom}-tmp`);
  let admin = path.join(reel(path.join(o.racine, '.git')), 'worktrees', nom);
  o.ecrire(`worktree temporaire du commit ${o.sha.slice(0, 12)} : ${dossier}`);
  const ajout = await git(['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--quiet', '--detach', dossier, o.sha], o.racine, 10 * MIN);

  let nettoye = false;
  const nettoyer = async (): Promise<void> => {
    if (nettoye) return;
    nettoye = true;
    // git worktree remove supprime le dossier nommé dans .git/worktrees/<nom>/gitdir, que la build pouvait écrire :
    // il n'est employé que si ce fichier désigne bien le worktree créé ici, sinon les deux dossiers connus sont
    // supprimés directement.
    let gitdirConforme = false;
    try {
      gitdirConforme = reel(readFileSync(path.join(admin, 'gitdir'), 'utf8').trim()) === path.join(dossier, '.git');
    } catch {
      gitdirConforme = false;
    }
    const retrait = gitdirConforme ? await git(['worktree', 'remove', '--force', dossier], o.racine, 5 * MIN) : null;
    if (retrait === null || retrait.code !== 0) {
      if (sous(dossier, tmp) && dossier !== tmp) rmSync(dossier, { recursive: true, force: true });
      if (sous(admin, path.join(reel(path.join(o.racine, '.git')), 'worktrees'))) rmSync(admin, { recursive: true, force: true });
    }
    await git(['worktree', 'prune'], o.racine);
    if (sous(dossierTmp, tmp) && dossierTmp !== tmp) rmSync(dossierTmp, { recursive: true, force: true });
  };

  if (ajout.code !== 0) {
    await nettoyer();
    throw new Sortie(2, `worktree du commit ${o.sha} impossible : ${fin(ajout.stderr)}`);
  }

  // CR-02 : copie privée de dist, supprimée avec la build.
  let copie: string | null = null;
  const retirerCopie = (): void => {
    if (copie !== null) rmSync(copie, { recursive: true, force: true });
    copie = null;
  };
  const nettoyerTout = async (): Promise<void> => {
    try {
      await nettoyer();
    } finally {
      retirerCopie();
    }
  };

  try {
    const gd = await git(['rev-parse', '--absolute-git-dir'], dossier);
    const gitdir = gd.code === 0 ? reel(gd.stdout.trim()) : '';
    if (gitdir !== admin) throw new Sortie(2, `dossier git du worktree inattendu (${gitdir || 'illisible'}, attendu ${admin})`);
    admin = gitdir;
    verifierEcrivable(dossier, 'le worktree');
    verifierEcrivable(admin, 'le dossier git du worktree');
    mkdirSync(dossierTmp, { mode: 0o700 });
    verifierEcrivable(dossierTmp, 'le dossier temporaire de la build');

    // 5. CR-03 (revue de la phase 9.2) : cache npm propre à la build, qu'aucun autre outil n'emploie. Le cache de
    // l'utilisateur (~/.npm) n'est plus ouvert en écriture : une build ne peut plus y déposer, sous _npx, du code
    // qu'un prochain npx lancerait hors de tout bac à sable.
    const cacheNpm = reel(cheminCacheNpm(o.home));
    mkdirSync(cacheNpm, { recursive: true, mode: 0o700 });
    chmodSync(cacheNpm, 0o700);
    verifierEcrivable(cacheNpm, 'le cache npm');

    // 6. Les quatre commandes du job construire, sous le bac à sable.
    const profil = profilSandbox({ home: o.home, worktree: dossier, gitWorktreeDir: admin, tmpdir: dossierTmp, cacheNpm, lecturesInterdites: o.lecturesInterdites });
    const env = envConstruction(o.cible, o.sha, cacheNpm, source);
    env.HOME = o.home;
    env.TMPDIR = dossierTmp;
    for (const e of ETAPES) {
      const libelle = `npm ${e.args.join(' ')}`;
      o.ecrire(`… ${libelle} (bac à sable)`);
      // CR-01, WR-07 : session propre, sans terminal de contrôle, groupe tué à la fin de l'étape.
      const r = await o.lancer({ commande: sandboxExec, args: ['-p', profil, npm, ...e.args], cwd: dossier, env, delaiMs: e.delaiMs, libelle, isole: true, ...(o.arret === undefined ? {} : { arret: o.arret }) });
      if (o.arret?.aborted === true) throw new Sortie(1, `${libelle} interrompue par un signal : build arrêtée`);
      if (r.code !== 0) {
        const delai = r.delaiDepasse ? `, délai de ${Math.round(e.delaiMs / MIN)} min dépassé` : '';
        throw new Sortie(1, `${libelle} en échec (code ${String(r.code)}${delai}) : ${fin(`${r.stdout}\n${r.stderr}`)}`);
      }
      if (o.apresEtape !== undefined) await o.apresEtape(e.args.join(' '));
    }

    // 7. Intégrité locale, arbre construit.
    verifierIntegrite(instantane, prendreInstantane(optionsInstantane));
    const distBuild = path.join(dossier, 'dist');
    if (!existsSync(distBuild) || !lstatSync(distBuild).isDirectory()) throw new Sortie(1, `la build n'a pas produit de dossier dist : ${distBuild}`);
    const specialBuild = trouverSpecial(distBuild);
    if (specialBuild !== null) throw new Sortie(1, `la build contient un lien symbolique ou un fichier spécial : ${specialBuild}`);

    // 8. CR-02 : copie dans un dossier privé que le profil ne laisse pas écrire, puis worktree retiré aussitôt.
    const parentCopies = path.join(o.home, '.cache', 'rtp', 'deploiement');
    mkdirSync(parentCopies, { recursive: true, mode: 0o700 });
    const prive = reel(mkdtempSync(path.join(parentCopies, 'build-')));
    copie = prive;
    chmodSync(prive, 0o700);
    for (const [ecrivable, nomEcrivable] of [
      [tmp, 'le dossier temporaire'],
      [dossier, 'le worktree'],
      [dossierTmp, 'le dossier temporaire de la build'],
      [admin, 'le dossier git du worktree'],
      [cacheNpm, 'le cache npm'],
    ] as const) {
      if (sous(prive, ecrivable)) throw new Sortie(2, `copie de la build sous ${nomEcrivable} (${ecrivable}), où la build peut écrire : déploiement refusé`);
    }
    const dist = path.join(prive, 'dist');
    try {
      // Liens copiés tels quels (jamais suivis) ; un fichier spécial fait échouer la copie.
      cpSync(distBuild, dist, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
    } catch (e) {
      throw new Sortie(1, `copie de la build impossible : ${e instanceof Error ? e.message : String(e)}`);
    }
    await nettoyer();

    // 9. Sur la copie seule : modes, aucun lien ni fichier spécial, commit de version.json, empreinte.
    normaliserModes(dist);
    const special = trouverSpecial(dist);
    if (special !== null) throw new Sortie(1, `la build contient un lien symbolique ou un fichier spécial : ${special}`);
    const v = await o.lancer({
      commande: jq,
      args: ['-e', '--arg', 's', o.sha, '.commit == $s', 'version.json'],
      cwd: dist,
      env: envDeBase(source),
      delaiMs: MIN,
      libelle: 'jq version.json',
    });
    if (v.code !== 0) throw new Sortie(1, `dist/version.json ne porte pas le commit ${o.sha}`);
    const empreinte = empreinteArbre(dist);
    o.ecrire(`build de déploiement prête (${o.cible}) : empreinte ${empreinte}`);
    return { cible: o.cible, sha: o.sha, dossierTravail: prive, worktree: dossier, dist, empreinte, instantane, executables, nettoyer: nettoyerTout };
  } catch (e) {
    await nettoyerTout();
    throw e;
  }
}
