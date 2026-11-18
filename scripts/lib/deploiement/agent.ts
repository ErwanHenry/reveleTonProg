// Clé dédiée du Mac chargée dans un agent ssh éphémère, seulement si elle a une phrase de passe (phase 9.2, D-09
// corrigée ; recherche §4.2 ; décision de l'orchestrateur du 2026-11-18, « bloquant 1 »).
//
// Pourquoi une phrase de passe obligatoire : la phrase de confirmation tapée avant un envoi protège contre l'erreur,
// pas contre un programme. Un agent (ou tout code qui tourne sous l'utilisateur d'Erwan) peut simuler un terminal
// ou appeler la bibliothèque directement. La seule barrière qu'il ne franchit pas est la phrase de passe de la clé,
// que seul Erwan connaît et qu'il tape lui-même à l'invite de ssh-add, sur son terminal (SSH_ASKPASS_REQUIRE=never,
// ni DISPLAY ni SSH_ASKPASS transmis : aucun programme d'invite graphique ne peut répondre à sa place).
// Une clé sans phrase de passe est donc refusée (code 3), détectée par `ssh-keygen -y -P '' -f <clé>`.
//
// Pourquoi `etat` y passe aussi : pas de régime à deux vitesses. Toute sous-commande qui contacte le serveur, en
// lecture comme en écriture, exige la clé protégée ; un agent ne contacte jamais le serveur par ce chemin.
//
// Pourquoi un agent de 15 minutes dans un dossier 0700 : le socket ne doit servir qu'à ce déploiement. Il vit dans
// un dossier temporaire lisible du seul utilisateur, la clé y expire au bout de 900 s (`ssh-add -t 900`), et l'agent
// est tué à la fin (fermer), sur SIGINT, SIGTERM ou SIGHUP, et à la sortie du processus. L'agent ssh habituel
// d'Erwan n'est jamais utilisé (SSH_AUTH_SOCK n'est pas transmis par envDeBase).
//
// Signaux : si personne d'autre n'écoute le signal, l'agent est fermé puis le signal est relancé (arrêt normal).
// Si un autre gestionnaire écoute (retour automatique après activation, plan 06), l'agent lui reste ouvert : c'est
// à ce gestionnaire d'appeler fermer, et la sortie du processus le tue de toute façon.
// N'importe que des modules node: et des modules relatifs.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { envDeBase, type Lanceur } from '../processus.ts';
import type { ConfigDeploiement } from './config.ts';
import type { Executables } from './executables.ts';
import { Sortie } from './gardes.ts';

export interface Agent {
  socket: string;
  fermer: () => Promise<void>;
}

const MIN = 60_000;
const SIGNAUX = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

function chemin(exe: Executables, nom: string): string {
  const e = exe[nom];
  if (e === undefined) throw new Sortie(2, `exécutable non résolu : ${nom}`);
  return e.chemin;
}

/**
 * true si la clé a une phrase de passe. `ssh-keygen -y -P '' -f <clé>` essaie la phrase vide : code 0 = clé
 * utilisable sans phrase. La commande n'imprime que la clé publique (non secrète) ; ses sorties sont jetées quand
 * même, jamais renvoyées ni affichées. Une fin anormale (délai, signal, exécutable absent) refuse par prudence.
 */
export async function cleChiffree(cle: string, exe: Executables, lancer: Lanceur): Promise<boolean> {
  const r = await lancer({
    commande: chemin(exe, 'ssh-keygen'),
    args: ['-y', '-P', '', '-f', cle],
    cwd: '/',
    env: envDeBase(),
    delaiMs: MIN,
    libelle: 'contrôle de la phrase de passe de la clé',
  });
  if (r.code === null) throw new Sortie(3, `impossible de vérifier que la clé ${cle} a une phrase de passe : refusée`);
  return r.code !== 0;
}

/**
 * Démarre un agent ssh propre à ce processus et y charge la clé, après que Erwan a tapé sa phrase de passe.
 * Clé sans phrase, agent qui ne démarre pas, clé non chargée : Sortie code 3, rien ne reste derrière.
 */
export async function ouvrirAgent(
  cfg: Pick<ConfigDeploiement, 'cle'>,
  o: { exe: Executables; lancer: Lanceur; ecrire: (l: string) => void },
): Promise<Agent> {
  const { exe, lancer, ecrire } = o;
  if (!(await cleChiffree(cfg.cle, exe, lancer))) {
    throw new Sortie(3, `la clé ${cfg.cle} n'a pas de phrase de passe : refusée ; la poser avec ssh-keygen -p -f ${cfg.cle}`);
  }
  const sshAgent = chemin(exe, 'ssh-agent');
  const sshAdd = chemin(exe, 'ssh-add');

  const dossier = mkdtempSync(path.join(tmpdir(), 'rtp-agent-'));
  chmodSync(dossier, 0o700);
  const socket = path.join(dossier, 'agent.sock');
  let pid: string | null = null;
  let ferme: Promise<void> | null = null;

  const envAgent = (): Record<string, string> => ({ ...envDeBase(), SSH_AUTH_SOCK: socket, ...(pid === null ? {} : { SSH_AGENT_PID: pid }) });

  const retirerGestionnaires = (): void => {
    for (const s of SIGNAUX) process.removeListener(s, surSignal);
    process.removeListener('exit', surSortie);
  };

  const fermer = (): Promise<void> => {
    if (ferme !== null) return ferme;
    ferme = (async () => {
      retirerGestionnaires();
      try {
        if (pid !== null) {
          await lancer({ commande: sshAgent, args: ['-k'], cwd: '/', env: envAgent(), delaiMs: MIN, libelle: 'arrêt de l\'agent ssh' });
        }
      } finally {
        rmSync(dossier, { recursive: true, force: true });
      }
    })();
    return ferme;
  };

  // Sortie du processus sans fermer : seul le synchrone est permis ici.
  function surSortie(): void {
    if (ferme !== null) return;
    ferme = Promise.resolve();
    if (pid !== null) spawnSync(sshAgent, ['-k'], { cwd: '/', env: envAgent(), stdio: 'ignore', timeout: MIN });
    rmSync(dossier, { recursive: true, force: true });
  }

  function surSignal(signal: NodeJS.Signals): void {
    // Un autre gestionnaire (retour automatique) a besoin de l'agent : il fermera lui-même.
    if (process.listenerCount(signal) > 1) return;
    void fermer().finally(() => {
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    });
  }

  for (const s of SIGNAUX) process.on(s, surSignal);
  process.on('exit', surSortie);

  try {
    const r = await lancer({ commande: sshAgent, args: ['-a', socket, '-s'], cwd: '/', env: envDeBase(), delaiMs: MIN, libelle: 'démarrage de l\'agent ssh' });
    const m = /SSH_AGENT_PID=(\d+);/.exec(r.stdout);
    if (r.code !== 0 || m === null || !existsSync(socket)) {
      throw new Sortie(3, 'agent ssh non démarré : clé non chargée');
    }
    pid = m[1];

    ecrire(`Clé dédiée ${cfg.cle} : tapez sa phrase de passe à l'invite de ssh-add ci-dessous (clé chargée 15 min dans un agent propre à cette commande).`);
    const ajout = await lancer({
      commande: sshAdd,
      args: ['-t', '900', cfg.cle],
      cwd: '/',
      env: { ...envDeBase(), SSH_AUTH_SOCK: socket, SSH_ASKPASS_REQUIRE: 'never' },
      delaiMs: 10 * MIN,
      libelle: 'chargement de la clé (phrase de passe)',
      heriter: true,
    });
    if (ajout.code !== 0) {
      throw new Sortie(3, 'clé non chargée : la phrase de passe doit être tapée par Erwan dans un terminal');
    }
  } catch (e) {
    await fermer();
    throw e;
  }

  return { socket, fermer };
}
