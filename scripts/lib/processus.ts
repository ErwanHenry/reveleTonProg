// Lancement de processus pour la CI et le déploiement depuis le Mac (phase 9.2, D-01, D-05) : jamais de shell,
// un environnement donné explicitement (jamais fusionné avec process.env), un délai au-delà duquel le processus est
// tué, et une ligne de progression toutes les minutes sur stderr pour les étapes longues d'une machine chargée.
// N'importe que des modules node: (le processus qui tiendra la clé de déploiement l'importe aussi).
import { spawn, type StdioOptions } from 'node:child_process';

export interface Lancement {
  commande: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  /** Texte écrit sur l'entrée standard du processus, puis fermée. Absent : entrée standard fermée. */
  entree?: string;
  delaiMs: number;
  libelle: string;
  /** Sorties héritées (affichées en direct) : pour les étapes longues dont Erwan lit la sortie. */
  heriter?: boolean;
}

export interface Resultat {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  dureeMs: number;
  delaiDepasse: boolean;
}

export type Lanceur = (l: Lancement) => Promise<Resultat>;

/** Variables gardées de l'environnement du terminal : ni agent SSH, ni jeton, ni variable RTP_. */
const VARIABLES_GARDEES = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM'] as const;

/** Environnement de base d'un processus enfant : liste blanche, plus le fuseau de Paris et la télémétrie Astro coupée. */
export function envDeBase(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const k of VARIABLES_GARDEES) {
    const v = source[k];
    if (typeof v === 'string') env[k] = v;
  }
  env.TZ = 'Europe/Paris';
  env.ASTRO_TELEMETRY_DISABLED = '1';
  return env;
}

/** Taille maximale gardée de chaque sortie capturée (la fin est gardée, c'est elle qu'on affiche en cas d'échec). */
const SORTIE_MAX = 4 * 1024 * 1024;
const PROGRESSION_MS = 60_000;
const GRACE_KILL_MS = 5_000;

const garderFin = (texte: string): string => (texte.length > SORTIE_MAX ? texte.slice(texte.length - SORTIE_MAX) : texte);

export const lancer: Lanceur = (l) =>
  new Promise<Resultat>((resolve) => {
    const debut = Date.now();
    let stdout = '';
    let stderr = '';
    let delaiDepasse = false;
    let fini = false;
    const sortie = l.heriter === true ? 'inherit' : 'pipe';
    const stdio: StdioOptions = [l.entree === undefined ? 'ignore' : 'pipe', sortie, sortie];
    const enfant = spawn(l.commande, l.args, { cwd: l.cwd, env: l.env, stdio, shell: false });

    const progression = setInterval(() => {
      const minutes = Math.round((Date.now() - debut) / 60_000);
      process.stderr.write(`… ${l.libelle} en cours depuis ${minutes} min\n`);
    }, PROGRESSION_MS);
    progression.unref();

    let tueur: NodeJS.Timeout | undefined;
    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      enfant.kill('SIGTERM');
      tueur = setTimeout(() => enfant.kill('SIGKILL'), GRACE_KILL_MS);
      tueur.unref();
    }, l.delaiMs);

    const terminer = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (fini) return;
      fini = true;
      clearInterval(progression);
      clearTimeout(minuteur);
      if (tueur !== undefined) clearTimeout(tueur);
      resolve({ code, signal, stdout, stderr, dureeMs: Date.now() - debut, delaiDepasse });
    };

    enfant.stdout?.setEncoding('utf8');
    enfant.stderr?.setEncoding('utf8');
    enfant.stdout?.on('data', (d: string) => {
      stdout = garderFin(stdout + d);
    });
    enfant.stderr?.on('data', (d: string) => {
      stderr = garderFin(stderr + d);
    });
    enfant.on('error', (e: NodeJS.ErrnoException) => {
      const raison = e.code === 'ENOENT' ? `commande introuvable : ${l.commande} (ENOENT)` : `lancement impossible : ${e.message}`;
      stderr = garderFin(`${stderr}${raison}\n`);
      terminer(null, null);
    });
    enfant.on('close', (code, signal) => terminer(code, signal));

    if (l.entree !== undefined && enfant.stdin) {
      enfant.stdin.on('error', () => {
        // Processus fermé avant d'avoir tout lu : son code de sortie dira ce qui s'est passé.
      });
      enfant.stdin.end(l.entree);
    }
  });
