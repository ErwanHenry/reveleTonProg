// Déploiement depuis le Mac (LOC-02, LOC-03 ; D-01, D-04, D-06, D-07, D-08, D-09) : remplace pour Erwan le job
// deploy de .github/workflows/ci.yml et rollback.yml. Point d'entrée testable executer(argv, deps), comme
// scripts/ci-local.ts.
//
// Sans sous-commande : déploiement du commit poussé (scripts/lib/deploiement/deployer.ts), options --forcer,
// --urgence, --justification "<texte>", --dry-run (répétition à blanc : gardes, reçu, build scellée, aucun contact
// avec le serveur, aucun terminal requis).
// Sous-commandes :
//   etat   lecture seule : version en ligne sur la cible du fichier local (verbe etat de la commande forcée),
//          sujet du commit s'il est connu du dépôt local, nombre de versions, espace libre, puis commit servi par
//          /version.json et en-têtes HSTS et CSP de la page d'accueil (si RTP_URL est renseignée).
//   retour remplace rollback.yml (D-08) : remet en ligne la version précédente ou le commit donné, avec la garde de
//          gel, la confirmation tapée et les vérifications de rollback.yml (scripts/lib/deploiement/retour.ts).
// Même en lecture seule, la clé dédiée doit avoir une phrase de passe, tapée par Erwan à l'invite de ssh-add (D-09) :
// aucun agent ne contacte le serveur par ce chemin.
//
// Confirmation (D-06) : pour le déploiement et retour, la toute première vérification, avant le
// verrou, la configuration ou le moindre contact avec le serveur, refuse une entrée standard qui n'est pas un
// terminal (code 3), sauf --dry-run. La phrase est ensuite lue sur /dev/tty par confirmerSurTerminal, le seul
// confirmateur que cette CLI passe : Dependances n'a ni terminal, ni lecture de ligne, ni confirmation, et aucune
// option de contournement du type --oui n'existe. Limite assumée (ADR-063) : la phrase protège contre l'erreur, pas
// contre un programme qui simulerait un terminal ; la barrière réelle est la phrase de passe de la clé.
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
import { confirmerSurTerminal } from './lib/deploiement/confirmation.ts';
import { executerRetour } from './lib/deploiement/retour.ts';
import { executerDeploiement } from './lib/deploiement/deployer.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage : npm run deploy:local -- etat
        npm run deploy:local -- retour [<sha>] [--urgence --justification "<texte>"] [--dry-run]
        npm run deploy:local [-- --forcer] [--urgence --justification "<texte>"] [--dry-run]
  sans sous-commande : construit le commit poussé (HEAD égal à origin/main, arbre propre, reçu vert de ci:local
         exigé : sinon refus, lancer npm run ci:local d'abord), puis l'envoie, l'active et le vérifie sur la cible de
         ~/.config/rtp/deploiement.env. À lancer dans un terminal : phrase de passe de la clé, puis phrase tapée
         (« deployer essai <sha7> », « deployer en production <sha7> »). --forcer : déployer même si le site n'a
         pas changé depuis la version en ligne. --urgence --justification : retrait d'urgence pendant un gel (aucun
         retour automatique). --dry-run : répétition à blanc (gardes, reçu, build scellée), aucun contact avec le
         serveur, aucun journal.
         Codes : 0 déployé, rien à déployer ou répétition à blanc ; 1 garde ou étape en échec, activation
         refusée ou interruption (Ctrl-C) avant l'activation, rien d'activé ;
         2 usage ou configuration (rsync 3 absent compris) ; 3 pas de terminal, confirmation refusée ou clé sans
         phrase de passe ; 4 échec après l'activation, version d'avant remise en ligne ; 5 échec après
         l'activation, version d'avant non remise (vérifier avec npm run deploy:local -- etat).
  etat : version en ligne sur la cible de ~/.config/rtp/deploiement.env, commit servi, en-têtes HSTS et CSP
         (lecture seule ; la phrase de passe de la clé dédiée est demandée par ssh-add).
         Codes : 0 état lu et cohérent, 1 anomalie (commit servi illisible ou différent, en-tête absent),
         2 usage ou configuration, 3 clé sans phrase de passe ou non chargée, autre : code du serveur ou de ssh.
  retour [<sha>] : remet en ligne la version précédente, ou le commit donné (40 caractères hexadécimaux en
         minuscules), sur la cible du fichier local ; remplace rollback.yml. À lancer dans un terminal : phrase de
         passe de la clé, puis phrase de confirmation tapée (« retour essai precedente », « retour en production
         <sha7> »…). Pendant un gel des scrutins : --urgence --justification "<20 caractères au moins>".
         --dry-run : répétition à blanc, aucun contact avec le serveur.
         Codes : 0 fait et vérifié, 1 garde ou vérification en échec, 2 usage, configuration ou verrou tenu,
         3 pas de terminal, confirmation refusée ou clé sans phrase de passe.`;

export interface Dependances {
  lancer?: Lanceur;
  maintenant?: () => Date;
  home?: string;
  racine?: string;
  ecrire?: (l: string) => void;
}

const EXECUTABLES = ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'jq', 'git'];

type Arguments =
  | { sousCommande: 'etat' }
  | { sousCommande: 'deployer'; forcer: boolean; urgence: boolean; justification: string; dryRun: boolean }
  | { sousCommande: 'retour'; version: string; urgence: boolean; justification: string; dryRun: boolean };

function lireArguments(argv: string[]): Arguments {
  let lu: { values: { forcer?: boolean; urgence?: boolean; justification?: string; 'dry-run'?: boolean }; positionals: string[] };
  try {
    lu = parseArgs({
      args: argv,
      options: { forcer: { type: 'boolean' }, urgence: { type: 'boolean' }, justification: { type: 'string' }, 'dry-run': { type: 'boolean' } },
      strict: true,
      allowPositionals: true,
    });
  } catch (e) {
    throw new Sortie(2, `${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
  }
  const { values, positionals } = lu;
  const [sousCommande, ...reste] = positionals;
  const options = Object.keys(values);
  if (values.justification !== undefined && values.urgence !== true) {
    throw new Sortie(2, `--justification n'a de sens qu'avec --urgence (retrait d'urgence pendant un gel)\n${USAGE}`);
  }
  if (sousCommande === undefined) {
    return {
      sousCommande: 'deployer',
      forcer: values.forcer === true,
      urgence: values.urgence === true,
      justification: values.justification ?? '',
      dryRun: values['dry-run'] === true,
    };
  }
  if (sousCommande === 'etat') {
    if (reste.length > 0 || options.length > 0) throw new Sortie(2, `etat ne prend ni argument ni option\n${USAGE}`);
    return { sousCommande };
  }
  if (sousCommande === 'retour') {
    if (reste.length > 1) throw new Sortie(2, `retour : un seul commit au plus\n${USAGE}`);
    if (values.forcer !== undefined) throw new Sortie(2, `--forcer ne vaut que pour le déploiement\n${USAGE}`);
    return {
      sousCommande,
      version: reste[0] ?? '',
      urgence: values.urgence === true,
      justification: values.justification ?? '',
      dryRun: values['dry-run'] === true,
    };
  }
  throw new Sortie(2, `sous-commande inconnue ou absente : ${positionals.join(' ') || '(aucune)'}\n${USAGE}`);
}

async function etat(deps: Dependances, ecrire: (l: string) => void): Promise<number> {
  const lancer = deps.lancer ?? lancerParDefaut;
  const home = deps.home ?? homedir();
  const racine = deps.racine ?? RACINE;
  const cfg = lireConfig(home);
  const exe = resoudreExecutables(EXECUTABLES, envDeBase().PATH ?? '');
  const git = exe.git?.chemin ?? 'git';

  const agent = await ouvrirAgent(cfg, { exe, lancer, ecrire, home });
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
  const a = lireArguments(argv);
  // Première vérification, non injectable (D-06, T-09.2-25) : sans terminal, rien n'est fait, ni verrou, ni
  // configuration, ni serveur. La répétition à blanc ne contacte pas le serveur : elle peut tourner sans terminal.
  if (a.sousCommande !== 'etat' && !a.dryRun && process.stdin.isTTY !== true) {
    throw new Sortie(
      3,
      "l'entrée standard n'est pas un terminal : la confirmation doit être tapée par Erwan dans son terminal ; rien n'a été fait (--dry-run pour une répétition à blanc)",
    );
  }
  if (!process.version.startsWith('v24.')) {
    throw new Sortie(2, `Node 24 exigé (version actuelle ${process.version}) : lancer fnm exec --using=24 npm run deploy:local${a.sousCommande === 'deployer' ? '' : ` -- ${a.sousCommande}`}`);
  }
  if (a.sousCommande === 'etat') return etat(deps, ecrire);
  const contexte = {
    confirmer: confirmerSurTerminal,
    lancer: deps.lancer ?? lancerParDefaut,
    maintenant: deps.maintenant ?? (() => new Date()),
    home: deps.home ?? homedir(),
    racine: deps.racine ?? RACINE,
    ecrire,
  };
  if (a.sousCommande === 'deployer') {
    return executerDeploiement({ forcer: a.forcer, urgence: a.urgence, justification: a.justification, dryRun: a.dryRun }, contexte);
  }
  return executerRetour(
    { version: a.version, urgence: a.urgence, justification: a.justification, dryRun: a.dryRun },
    contexte,
  );
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
  // WR-04 : après un SIGHUP (fenêtre fermée), écrire sur un terminal raccroché ne doit pas faire échouer le processus
  // pendant un retour automatique ; le journal local garde la trace.
  process.stdout.on('error', () => {});
  process.stderr.on('error', () => {});
  try {
    process.exitCode = await executer(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exitCode = 1;
  }
}
