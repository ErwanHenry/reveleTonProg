// Lien avec le serveur pour le déploiement depuis le Mac (phase 9.2, D-04, D-07 ; LOC-02, LOC-03).
//
// Miroir des étapes ssh, rsync et curl du job deploy de .github/workflows/ci.yml : mêmes verbes de la commande
// forcée (etat, activer, retour, envoi rsync dans incoming/<cible>/<sha>/), mêmes options ssh épinglées, même test
// de fumée (/version.json, en-têtes HSTS et CSP, identifiants passés à curl par `--config -`).
//
// Ce qui diffère sur macOS, et pourquoi (recherche §2) :
// - `ssh -F /dev/null` : le ~/.ssh/config d'Erwan (alias, ProxyJump, IdentityFile) est ignoré ; seule la clé dédiée
//   passe (`IdentitiesOnly=yes`), par l'agent éphémère de agent.ts (`IdentityAgent=<socket>`), jamais par l'agent
//   habituel (SSH_AUTH_SOCK n'est pas transmis : envDeBase).
// - rsync 3 obligatoire pour un envoi : /usr/bin/rsync est openrsync, qui refuse l'option chmod de la CI (D755,F644) et dont la
//   commande serveur (`--dirs`) n'est pas vérifiée avec le rrsync du serveur. Une variante autre que rsync 3 est
//   refusée (code 2) avec le correctif : brew install rsync, puis RTP_RSYNC.
// - pas d'option chmod : les modes sont normalisés dans la build (empreinte.ts, normaliserModes) ; sans `-p`, le
//   serveur applique son umask 022, même résultat que l'option chmod D755,F644 de la CI.
// - CR-01 : `-rt` sans option de liens. Aucun lien symbolique n'est envoyé ; la commande forcée refuse de toute
//   façon un envoi qui en contient.
// WR-04 (revue de la phase 9.2) : ssh, rsync et curl tournent dans leur propre session (isole) : un Ctrl-C ou la
// fermeture du terminal ne tue pas un activer ou un retour en vol (BatchMode=yes : aucun terminal nécessaire) ; le
// déploiement décide lui-même quoi faire du signal (retour automatique après l'activation).
// Chaque verbe est construit à partir de jetons contrôlés (cible essai|production, sha de 40 hexadécimaux
// minuscules) avant tout lancement, sans shell. Chaque stdout et stderr de ssh, rsync et curl passe par masquer
// avant d'être rendu, affiché ou mis dans un message : aucun hôte, utilisateur ni URL du serveur dans un journal.
// N'importe que des modules node: et des modules relatifs.
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { envDeBase, type Lanceur, type Resultat } from '../processus.ts';
import type { Agent } from './agent.ts';
import type { ConfigDeploiement } from './config.ts';
import type { Executables } from './executables.ts';
import { Sortie } from './gardes.ts';
import { masquer } from './masque.ts';

export type Cible = 'essai' | 'production';
export type Verbe = 'etat' | 'activer' | 'retour';
export type VarianteRsync = 'rsync3' | 'openrsync' | 'inconnue';

export interface Etat {
  cible: Cible;
  courant: string | null;
  versions: number;
  libreMio: number;
}
export interface Active {
  cible: Cible;
  courant: string;
  versions: number;
}
export interface Retour {
  cible: Cible;
  courant: string;
  precedent: string | null;
}
export interface VersionServie {
  commit: string;
  hsts: boolean;
  csp: boolean;
}

type CfgSsh = Pick<ConfigDeploiement, 'cle' | 'knownHosts' | 'hote' | 'utilisateur' | 'url'>;

const MIN = 60_000;
const SHA = /^[0-9a-f]{40}$/;
const CIBLES: readonly string[] = ['essai', 'production'];
const VERBES: readonly string[] = ['etat', 'activer', 'retour'];

/** Codes de sortie de ops/commande-deploiement.sh (en-tête du script). */
const CODES_SERVEUR: Record<number, string> = {
  64: 'refusé par la commande forcée',
  65: 'envoi invalide',
  66: 'version introuvable',
  75: 'espace disque insuffisant',
  1: 'échec côté serveur (verrou, bascule ou espace illisible)',
  255: 'connexion ssh impossible',
};

const RE_ETAT = /^etat cible=(essai|production) courant=([0-9a-f]{40}|aucun) versions=([0-9]+) libre_mio=([0-9]+)$/;
const RE_ACTIVE = /^active cible=(essai|production) courant=([0-9a-f]{40}) versions=([0-9]+)$/;
const RE_RETOUR = /^retour cible=(essai|production) courant=([0-9a-f]{40}) precedent=([0-9a-f]{40}|aucun)$/;

function chemin(exe: Executables, nom: string): string {
  const e = exe[nom];
  if (e === undefined) throw new Sortie(2, `exécutable non résolu : ${nom}`);
  return e.chemin;
}

function controlerCible(cible: string): asserts cible is Cible {
  if (!CIBLES.includes(cible)) throw new Sortie(2, 'cible refusée : essai ou production attendue');
}

function controlerSha(sha: string): void {
  if (!SHA.test(sha)) throw new Sortie(2, 'commit refusé : 40 caractères hexadécimaux minuscules attendus');
}

/**
 * Échec d'un verbe de la commande forcée, avec ce qu'il faut pour savoir si le serveur a pu agir (WR-01 de la revue
 * de la phase 9.2) : code brut de ssh (null : signal ou délai), délai dépassé, sortie d'erreur masquée.
 */
export class EchecVerbe extends Sortie {
  readonly codeBrut: number | null;
  readonly delaiDepasse: boolean;
  readonly detail: string;
  constructor(code: number, message: string, r: { codeBrut: number | null; delaiDepasse: boolean; detail: string }) {
    super(code, message);
    this.name = 'EchecVerbe';
    this.codeBrut = r.codeBrut;
    this.delaiDepasse = r.delaiDepasse;
    this.detail = r.detail;
  }
}

/** Détail d'un processus terminé en échec, masqué. */
function detail(r: Resultat, cfg: CfgSsh): string {
  if (r.delaiDepasse) return 'délai dépassé';
  const texte = masquer(`${r.stderr}`.trim(), cfg);
  return texte === '' ? 'aucun message' : texte;
}

/** Options ssh épinglées (mêmes que ci.yml, plus -F /dev/null et l'agent éphémère). */
export function optionsSsh(cfg: Pick<ConfigDeploiement, 'cle' | 'knownHosts'>, agent: Pick<Agent, 'socket'>): string[] {
  return [
    '-F', '/dev/null',
    '-i', cfg.cle,
    '-o', 'IdentitiesOnly=yes',
    '-o', `IdentityAgent=${agent.socket}`,
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${cfg.knownHosts}`,
    '-o', 'ConnectTimeout=15',
  ];
}

/**
 * Appelle un verbe de la commande forcée : `ssh <options> <utilisateur>@<hôte> "<verbe> <cible>[ <sha>]"`.
 * Jetons contrôlés avant tout lancement (Sortie 2). Rend la ligne de stdout (masquée, sans blanc final) ; un code
 * non nul lève Sortie avec ce code et le stderr masqué.
 */
export async function appelerVerbe(
  cfg: CfgSsh,
  agent: Pick<Agent, 'socket'>,
  exe: Executables,
  verbe: Verbe,
  args: string[],
  lancer: Lanceur,
): Promise<string> {
  if (!VERBES.includes(verbe)) throw new Sortie(2, 'verbe refusé : etat, activer ou retour attendu');
  const [cible, sha, ...reste] = args;
  if (cible === undefined) throw new Sortie(2, `${verbe} : cible attendue`);
  controlerCible(cible);
  if (reste.length > 0) throw new Sortie(2, `${verbe} : trop d'arguments`);
  if (verbe === 'etat' && sha !== undefined) throw new Sortie(2, 'etat : la cible seule est attendue');
  if (verbe === 'activer' && sha === undefined) throw new Sortie(2, 'activer : cible et commit attendus');
  if (sha !== undefined) controlerSha(sha);
  const commande = sha === undefined ? `${verbe} ${cible}` : `${verbe} ${cible} ${sha}`;

  const r = await lancer({
    commande: chemin(exe, 'ssh'),
    args: [...optionsSsh(cfg, agent), `${cfg.utilisateur}@${cfg.hote}`, commande],
    cwd: '/',
    env: envDeBase(),
    delaiMs: MIN,
    libelle: `verbe ${verbe} ${cible}`,
    isole: true,
  });
  if (r.code !== 0) {
    const code = r.code ?? 1;
    const nom = CODES_SERVEUR[code] ?? 'échec';
    const d = detail(r, cfg);
    throw new EchecVerbe(code, `${verbe} ${cible} : ${nom} (code ${r.code ?? 'aucun'}) : ${d}`, { codeBrut: r.code, delaiDepasse: r.delaiDepasse, detail: d });
  }
  return masquer(r.stdout, cfg).trim();
}

/** `etat cible=<c> courant=<sha|aucun> versions=<n> libre_mio=<n>` ; aucun donne null ; autre ligne : null. */
export function lireEtat(ligne: string): Etat | null {
  const m = RE_ETAT.exec(ligne);
  if (m === null) return null;
  return { cible: m[1] as Cible, courant: m[2] === 'aucun' ? null : (m[2] as string), versions: Number(m[3]), libreMio: Number(m[4]) };
}

/** `active cible=<c> courant=<sha> versions=<n>` ; autre ligne : null. */
export function lireActive(ligne: string): Active | null {
  const m = RE_ACTIVE.exec(ligne);
  if (m === null) return null;
  return { cible: m[1] as Cible, courant: m[2] as string, versions: Number(m[3]) };
}

/** `retour cible=<c> courant=<sha> precedent=<sha|aucun>` ; autre ligne : null. */
export function lireRetour(ligne: string): Retour | null {
  const m = RE_RETOUR.exec(ligne);
  if (m === null) return null;
  return { cible: m[1] as Cible, courant: m[2] as string, precedent: m[3] === 'aucun' ? null : (m[3] as string) };
}

/** Variante du rsync désigné, d'après `--version` : openrsync, rsync 3, ou inconnue. */
export async function varianteRsync(rsync: string, lancer: Lanceur): Promise<VarianteRsync> {
  const r = await lancer({ commande: rsync, args: ['--version'], cwd: '/', env: envDeBase(), delaiMs: MIN, libelle: 'version de rsync' });
  if (r.code !== 0) return 'inconnue';
  const texte = `${r.stdout}\n${r.stderr}`;
  if (/openrsync/i.test(texte)) return 'openrsync';
  const premiere = r.stdout.split('\n')[0] ?? '';
  if (premiere.startsWith('rsync  version 3')) return 'rsync3';
  return 'inconnue';
}

/** Refuse tout envoi qui ne passerait pas par rsync 3 (code 2), avec le correctif. */
export function exigerRsync3(variante: VarianteRsync): void {
  if (variante !== 'rsync3') {
    throw new Sortie(
      2,
      "rsync 3 requis pour l'envoi (openrsync refuse les options de la CI et n'est pas vérifié avec le serveur) : brew install rsync, puis RTP_RSYNC=<chemin> dans ~/.config/rtp/deploiement.env",
    );
  }
}

/**
 * Envoie <dist>/ dans incoming/<cible>/<sha>/ du serveur : `rsync -rt --stats -e "<ssh> <options>"`. CR-01 : aucune
 * option de liens, donc aucun lien symbolique envoyé ; pas d'option chmod (modes normalisés dans la build).
 * rsync 3 exigé avant tout envoi. Rend la sortie de rsync (statistiques) masquée.
 */
export async function envoyer(
  cfg: CfgSsh,
  agent: Pick<Agent, 'socket'>,
  exe: Executables,
  dist: string,
  cible: string,
  sha: string,
  lancer: Lanceur,
): Promise<string> {
  controlerCible(cible);
  controlerSha(sha);
  const rsync = chemin(exe, 'rsync');
  exigerRsync3(await varianteRsync(rsync, lancer));
  let estDossier = false;
  try {
    estDossier = path.isAbsolute(dist) && statSync(dist).isDirectory();
  } catch {
    estDossier = false;
  }
  if (!estDossier) throw new Sortie(2, `build à envoyer absente ou non absolue : ${dist}`);
  const transport = [chemin(exe, 'ssh'), ...optionsSsh(cfg, agent)];
  // rsync découpe -e sur les blancs : un chemin qui en contient changerait les options passées à ssh.
  if (transport.some((m) => /\s/.test(m))) throw new Sortie(2, 'chemin avec espace dans la commande ssh de rsync : refusé');

  const r = await lancer({
    commande: rsync,
    args: ['-rt', '--stats', '-e', transport.join(' '), `${dist.replace(/\/+$/, '')}/`, `${cfg.utilisateur}@${cfg.hote}:${cible}/${sha}/`],
    cwd: '/',
    env: envDeBase(),
    delaiMs: 15 * MIN,
    libelle: `envoi de la build vers ${cible}`,
    isole: true,
  });
  if (r.code !== 0) {
    throw new Sortie(r.code ?? 1, `envoi vers ${cible} en échec (code ${r.code ?? 'aucun'}) : ${detail(r, cfg)}`);
  }
  return masquer(r.stdout, cfg).trim();
}

/** Ligne de configuration curl des identifiants, échappée comme config_curl de ci.yml. */
function entreeCurl(cfg: Pick<ConfigDeploiement, 'fumeeUtilisateur' | 'fumeeMotDePasse'>): string {
  if (cfg.fumeeUtilisateur === null || cfg.fumeeMotDePasse === null) return '';
  let mdp: string;
  try {
    mdp = readFileSync(cfg.fumeeMotDePasse, 'utf8');
  } catch {
    throw new Sortie(2, `mot de passe du test de fumée illisible : ${cfg.fumeeMotDePasse}`);
  }
  mdp = mdp.replace(/\r?\n$/, '');
  const echapper = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `user = "${echapper(cfg.fumeeUtilisateur)}:${echapper(mdp)}"\n`;
}

/**
 * Test de fumée HTTPS : /version.json (commit servi) puis en-têtes de la page d'accueil. Les identifiants vont à
 * curl par son entrée standard (`--config -`), jamais dans ses arguments. `-q` en tête : aucun ~/.curlrc lu.
 */
export async function versionServie(cfg: ConfigDeploiement, exe: Executables, lancer: Lanceur): Promise<VersionServie> {
  if (cfg.url === null) throw new Sortie(2, 'RTP_URL vide : test HTTPS impossible');
  const curl = chemin(exe, 'curl');
  const jq = chemin(exe, 'jq');
  const base = cfg.url.replace(/\/+$/, '');
  const entree = entreeCurl(cfg);
  const dossier = mkdtempSync(path.join(tmpdir(), 'rtp-fumee-'));
  try {
    chmodSync(dossier, 0o700);
    const options = ['-q', '-fsS', '--retry', '5', '--retry-all-errors', '--retry-delay', '3', '--max-time', '20', '--config', '-'];
    const version = path.join(dossier, 'version.json');
    const entetes = path.join(dossier, 'entetes');

    const r1 = await lancer({ commande: curl, args: [...options, '-o', version, `${base}/version.json`], cwd: '/', env: envDeBase(), entree, delaiMs: 3 * MIN, libelle: 'lecture de /version.json', isole: true });
    if (r1.code !== 0) throw new Sortie(1, `/version.json illisible (curl code ${r1.code ?? 'aucun'}) : ${detail(r1, cfg)}`);
    const j = await lancer({ commande: jq, args: ['-r', '.commit', version], cwd: '/', env: envDeBase(), delaiMs: MIN, libelle: 'commit de /version.json' });
    const commit = masquer(j.stdout, cfg).trim();
    if (j.code !== 0 || commit === '' || commit === 'null') throw new Sortie(1, '/version.json ne porte pas de commit lisible');

    const r2 = await lancer({ commande: curl, args: [...options, '-o', '/dev/null', '-D', entetes, `${base}/`], cwd: '/', env: envDeBase(), entree, delaiMs: 3 * MIN, libelle: "en-têtes de la page d'accueil", isole: true });
    if (r2.code !== 0) throw new Sortie(1, `page d'accueil illisible (curl code ${r2.code ?? 'aucun'}) : ${detail(r2, cfg)}`);
    let texte = '';
    try {
      texte = readFileSync(entetes, 'utf8');
    } catch {
      texte = '';
    }
    return {
      commit,
      hsts: /^strict-transport-security:/im.test(texte),
      csp: /^content-security-policy:/im.test(texte),
    };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
