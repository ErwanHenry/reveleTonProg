// Mise à jour autonome des statuts (phase 10.3) : poussée en avance rapide sur main et sonde de push.
//
// Seul fichier de la veille qui pousse. Refspec exacte `<sha>:refs/heads/main`, jamais d'option de force.
// Moyen de push lu dans ~/.config/rtp/push-auto.env : clé de déploiement (ssh) ou jeton fin (credential helper qui lit
// son fichier 0600). Aucun secret en argument de processus ni dans l'environnement : seul le chemin du fichier passe.
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { lireFichierCles, ErreurConfigLocale } from '../config-locale.ts';
import { envDeBase } from '../processus.ts';

export const CLES_PUSH = ['RTP_PUSH_DEPOT', 'RTP_PUSH_CLE', 'RTP_PUSH_KNOWN_HOSTS', 'RTP_PUSH_JETON'] as const;

export const cheminConfigPush = (home: string): string => path.join(home, '.config', 'rtp', 'push-auto.env');

export type ConfigPush = { mode: 'cle'; depot: string; cle: string; knownHosts: string } | { mode: 'jeton'; depot: string; jetonFichier: string };

export type ExecuterEnv = (commande: string, args: string[], options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> }) => { status: number | null; stdout: string; stderr: string };

const DEPOT = /^(git@github\.com:|https:\/\/github\.com\/)ErwanHenry\/reveleTonProg\.git$/;

function fichierPrive(chemin: string, nom: string, erreurs: string[]): void {
  try {
    const st = lstatSync(chemin);
    if (!st.isFile()) erreurs.push(`${nom} : fichier régulier attendu`);
    else if ((st.mode & 0o077) !== 0) erreurs.push(`${nom} : droits trop larges (chmod 600)`);
  } catch {
    erreurs.push(`${nom} : fichier absent ou illisible`);
  }
}

export function lireConfigPush(home: string): ConfigPush {
  const fichier = cheminConfigPush(home);
  const v = lireFichierCles(fichier, CLES_PUSH, home);
  const erreurs: string[] = [];
  const depot = v.get('RTP_PUSH_DEPOT') ?? '';
  const cle = v.get('RTP_PUSH_CLE');
  const kh = v.get('RTP_PUSH_KNOWN_HOSTS');
  const jeton = v.get('RTP_PUSH_JETON');
  if (!DEPOT.test(depot)) erreurs.push('RTP_PUSH_DEPOT : dépôt non autorisé (git@github.com: ou https://github.com/, propriétaire et nom du projet exacts)');
  const ssh = depot.startsWith('git@');
  if (cle !== undefined && jeton !== undefined) erreurs.push('RTP_PUSH_CLE et RTP_PUSH_JETON : une seule voie à la fois');
  else if (cle === undefined && jeton === undefined) erreurs.push('RTP_PUSH_CLE ou RTP_PUSH_JETON requis');
  if (cle !== undefined && DEPOT.test(depot) && !ssh) erreurs.push('RTP_PUSH_CLE exige un dépôt en git@github.com:');
  if (jeton !== undefined && DEPOT.test(depot) && ssh) erreurs.push('RTP_PUSH_JETON exige un dépôt en https://github.com/');
  if (cle !== undefined) {
    if (!path.isAbsolute(cle)) erreurs.push('RTP_PUSH_CLE : chemin absolu ou ~/ attendu');
    else fichierPrive(cle, 'RTP_PUSH_CLE', erreurs);
    if (kh === undefined || !path.isAbsolute(kh)) erreurs.push('RTP_PUSH_KNOWN_HOSTS : chemin absolu ou ~/ requis avec une clé');
  }
  if (jeton !== undefined) {
    if (!path.isAbsolute(jeton)) erreurs.push('RTP_PUSH_JETON : chemin absolu ou ~/ attendu');
    else fichierPrive(jeton, 'RTP_PUSH_JETON', erreurs);
  }
  if (erreurs.length > 0) throw new ErreurConfigLocale(fichier, erreurs);
  if (cle !== undefined && kh !== undefined) return { mode: 'cle', depot, cle, knownHosts: kh };
  return { mode: 'jeton', depot, jetonFichier: jeton ?? '' };
}

const apostrophes = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

const HELPER = `!f() { printf 'username=x-access-token\\npassword=%s\\n' "$(cat "$RTP_PUSH_JETON_FICHIER")"; }; f`;

export function preparerPush(cfg: ConfigPush): { destination: string; env: Record<string, string>; configGit: string[] } {
  const env = envDeBase();
  env.GIT_TERMINAL_PROMPT = '0';
  if (cfg.mode === 'cle') {
    env.GIT_SSH_COMMAND = `ssh -F /dev/null -i ${apostrophes(cfg.cle)} -o IdentitiesOnly=yes -o IdentityAgent=none -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${apostrophes(cfg.knownHosts)}`;
    return { destination: cfg.depot, env, configGit: [] };
  }
  env.RTP_PUSH_JETON_FICHIER = cfg.jetonFichier;
  return { destination: cfg.depot, env, configGit: ['-c', 'credential.helper=', '-c', `credential.helper=${HELPER}`] };
}

export type IssuePush = 'pousse' | 'main_a_avance' | 'hors_ligne' | 'push_echec';

const HORS_LIGNE = /Could not resolve host|Network is unreachable|Operation timed out|Connection timed out/i;
const REFUSE = /\[rejected\]|non-fast-forward|fetch first/i;

export function pousserAvanceRapide(o: { worktree: string; sha: string; destination: string; env: Record<string, string>; configGit: string[]; executer: ExecuterEnv }): IssuePush {
  const poussee = ['push', '--porcelain', o.destination, `${o.sha}:refs/heads/main`];
  const r = o.executer('git', [...o.configGit, '-C', o.worktree, ...poussee], { timeoutMs: 120_000, env: o.env });
  if (r.status === 0) return 'pousse';
  const sortie = `${r.stdout}\n${r.stderr}`;
  if (REFUSE.test(sortie)) return 'main_a_avance';
  if (HORS_LIGNE.test(sortie)) return 'hors_ligne';
  return 'push_echec';
}

export function sonderPush(o: { destination: string; env: Record<string, string>; configGit: string[]; executer: ExecuterEnv }): { ok: true; main: string } | { ok: false; raison: string } {
  const r = o.executer('git', [...o.configGit, 'ls-remote', o.destination, 'refs/heads/main'], { timeoutMs: 60_000, env: o.env });
  if (r.status !== 0) return { ok: false, raison: HORS_LIGNE.test(r.stderr) ? 'dépôt distant injoignable (réseau)' : 'dépôt distant inaccessible avec ce moyen de push' };
  const m = /^([0-9a-f]{40})\trefs\/heads\/main$/m.exec(r.stdout);
  return m === null ? { ok: false, raison: 'branche main introuvable sur le dépôt distant' } : { ok: true, main: m[1] ?? '' };
}
