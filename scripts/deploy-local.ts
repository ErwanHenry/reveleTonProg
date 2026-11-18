// Déploiement depuis le Mac (LOC-02, LOC-03 ; D-01, D-04, D-07, D-09) : remplace pour Erwan le job deploy de
// .github/workflows/ci.yml et rollback.yml. Point d'entrée testable executer(argv, deps), comme scripts/ci-local.ts.
//
// Sous-commandes de cette version :
//   etat   lecture seule : version en ligne sur la cible du fichier local (verbe etat de la commande forcée),
//          sujet du commit s'il est connu du dépôt local, nombre de versions, espace libre, puis commit servi par
//          /version.json et en-têtes HSTS et CSP de la page d'accueil (si RTP_URL est renseignée).
// Même en lecture seule, la clé dédiée doit avoir une phrase de passe, tapée par Erwan à l'invite de ssh-add (D-09) :
// aucun agent ne contacte le serveur par ce chemin.
//
// Contrat que les plans 05 et 06 ajoutent (envoi et retour, D-06, D-08) : avant tout envoi ou retour, la phrase de
// confirmation est lue sur /dev/tty à l'intérieur du module ; l'entrée standard non terminal est refusée en premier ;
// aucune confirmation injectable (Dependances n'a ni terminal, ni lecture de ligne, ni confirmation) ; aucune option
// de contournement du type --oui.
//
// Fichier local : ~/.config/rtp/deploiement.env (hors dépôt). Les sorties de ssh et curl passent par le masque :
// ni hôte, ni utilisateur, ni URL du serveur à l'écran.
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { envDeBase, lancer as lancerParDefaut, type Lanceur } from './lib/processus.ts';
import { lireConfig } from './lib/deploiement/config.ts';
import { resoudreExecutables } from './lib/deploiement/executables.ts';
import { ouvrirAgent } from './lib/deploiement/agent.ts';
import { Sortie } from './lib/deploiement/gardes.ts';
import { masquer } from './lib/deploiement/masque.ts';
import { appelerVerbe, lireEtat, versionServie } from './lib/deploiement/transport.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage : npm run deploy:local -- etat
  etat : version en ligne sur la cible de ~/.config/rtp/deploiement.env, commit servi, en-têtes HSTS et CSP
         (lecture seule ; la phrase de passe de la clé dédiée est demandée par ssh-add).
  Codes de sortie : 0 état lu et cohérent, 1 anomalie (commit servi illisible ou différent, en-tête absent),
  2 usage ou configuration, 3 clé sans phrase de passe ou non chargée, autre : code du serveur ou de ssh.`;

export interface Dependances {
  lancer?: Lanceur;
  maintenant?: () => Date;
  home?: string;
  racine?: string;
  ecrire?: (l: string) => void;
}

const EXECUTABLES = ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'jq', 'git'];

function lireArguments(argv: string[]): { sousCommande: string } {
  let positionnels: string[];
  try {
    positionnels = parseArgs({ args: argv, options: {}, strict: true, allowPositionals: true }).positionals;
  } catch (e) {
    throw new Sortie(2, `${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
  }
  if (positionnels.length !== 1 || positionnels[0] !== 'etat') {
    throw new Sortie(2, `sous-commande inconnue ou absente : ${positionnels.join(' ') || '(aucune)'}\n${USAGE}`);
  }
  return { sousCommande: positionnels[0] };
}

async function etat(deps: Dependances, ecrire: (l: string) => void): Promise<number> {
  const lancer = deps.lancer ?? lancerParDefaut;
  const home = deps.home ?? homedir();
  const racine = deps.racine ?? RACINE;
  const cfg = lireConfig(home);
  const exe = resoudreExecutables(EXECUTABLES, envDeBase().PATH ?? '');
  const git = exe.git?.chemin ?? 'git';

  const agent = await ouvrirAgent(cfg, { exe, lancer, ecrire });
  let code = 0;
  try {
    const ligne = await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], lancer);
    const e = lireEtat(ligne);
    if (e === null || e.cible !== cfg.cible) throw new Sortie(1, `réponse de etat illisible : ${masquer(ligne, cfg)}`);

    ecrire(`Cible : ${e.cible}`);
    if (e.courant === null) {
      ecrire('Commit en ligne : aucune version en ligne');
    } else {
      const r = await lancer({ commande: git, args: ['log', '-1', '--format=%s', e.courant], cwd: racine, env: envDeBase(), delaiMs: 60_000, libelle: 'sujet du commit en ligne' });
      const sujet = r.code === 0 ? r.stdout.trim() : '';
      ecrire(`Commit en ligne : ${e.courant} (${sujet === '' ? 'inconnu du dépôt local' : sujet})`);
    }
    ecrire(`Versions sur le serveur : ${e.versions}`);
    ecrire(`Espace libre : ${e.libreMio} Mio`);

    if (cfg.url === null) {
      ecrire('Test HTTPS : sauté (RTP_URL vide)');
    } else {
      try {
        const v = await versionServie(cfg, exe, lancer);
        ecrire(`Commit servi (/version.json) : ${v.commit}`);
        if (v.commit !== e.courant) {
          ecrire('  anomalie : le commit servi diffère du commit en ligne');
          code = 1;
        }
        ecrire(`Strict-Transport-Security : ${v.hsts ? 'présent' : 'absent'}`);
        ecrire(`Content-Security-Policy : ${v.csp ? 'présent' : 'absent'}`);
        if (!v.hsts || !v.csp) code = 1;
      } catch (x) {
        if (!(x instanceof Sortie)) throw x;
        ecrire(`Commit servi (/version.json) : illisible : ${masquer(x.message, cfg)}`);
        code = 1;
      }
    }
  } finally {
    await agent.fermer();
  }
  return code;
}

async function executerSansCapture(argv: string[], deps: Dependances, ecrire: (l: string) => void): Promise<number> {
  lireArguments(argv);
  if (!process.version.startsWith('v24.')) {
    throw new Sortie(2, `Node 24 exigé (version actuelle ${process.version}) : lancer fnm exec --using=24 npm run deploy:local -- etat`);
  }
  return etat(deps, ecrire);
}

/** Point d'entrée testable : `argv` sans `node` ni le nom du script ; renvoie le code de sortie. */
export async function executer(argv: string[], deps: Dependances = {}): Promise<number> {
  const ecrire = deps.ecrire ?? ((l: string) => console.log(l));
  const erreur = deps.ecrire ?? ((l: string) => console.error(l));
  try {
    return await executerSansCapture(argv, deps, ecrire);
  } catch (e) {
    if (e instanceof Sortie) {
      erreur(e.message);
      return e.code;
    }
    throw e;
  }
}

if (import.meta.main) {
  try {
    process.exitCode = await executer(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exitCode = 1;
  }
}
