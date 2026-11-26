// Mise en ligne par la tâche planifiée (10.3, D-04, SC-3) : `npm run deploy:auto -- deployer <sha>` et
// `npm run deploy:auto -- etat`. Point d'entrée testable executer(argv, deps), comme scripts/deploy-local.ts.
//
// Différence avec deploy:local (qui garde sa phrase de passe et sa confirmation tapée, ADR-063) : ici, ni terminal,
// ni phrase de passe, ni agent ssh, ni confirmation. La clé de ~/.config/rtp/deploiement-auto.env est sans phrase de
// passe, lue directement par ssh ; elle n'ouvre que la production, et seulement quatre verbes, par la commande
// forcée lancée avec --auto côté serveur. A chaque passage, le verbe interdit `etat essai` est envoyé avant tout
// envoi et doit être refusé (code 64) : la restriction est prouvée, pas supposée.
//
// Sous-commandes :
//   deployer <sha>  met en ligne le commit exact (40 hexadécimaux minuscules) couvert par un reçu complet de ci:local :
//                   gel, reçu, build scellée, sonde de restriction, envoi, activation, test de fumée, retour
//                   automatique vers la version d'avant en cas d'échec (scripts/lib/deploiement/auto.ts).
//   etat            lecture seule : `courant=<sha|aucun> restreint=oui`.
// Aucune option : ni --forcer, ni --urgence, ni --dry-run.
//
// La dernière ligne écrite est `resultat=<résultat>` (liste fermée), sans hôte, utilisateur, URL ni chemin de clé.
// Codes : 0 publié, déjà en ligne ou état lu ; 1 garde refusée ou étape en échec, rien d'activé ; 2 usage ou
// configuration ; 4 échec après l'activation, version d'avant remise ; 5 échec après l'activation, version d'avant non
// remise ; 6 serveur non restreint ; 7 gel ; 8 verrou local tenu ; 9 serveur injoignable.
// N'importe que des modules node: et des modules relatifs.
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancer as lancerParDefaut, type Lanceur } from './lib/processus.ts';
import { etatAuto, executerDeploiementAuto } from './lib/deploiement/auto.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;

const USAGE = `Usage : npm run deploy:auto -- deployer <sha>
        npm run deploy:auto -- etat
  deployer <sha> : met en ligne en production le commit (40 caractères hexadécimaux minuscules) couvert par un reçu
         complet de ci:local, sans terminal ni phrase de passe, avec la clé de ~/.config/rtp/deploiement-auto.env.
  etat : version en ligne en production et preuve que la clé automatique est restreinte (lecture seule).
  Aucune option. La dernière ligne est resultat=<résultat>.
  Codes : 0 publié, déjà en ligne ou état lu ; 1 garde refusée ou étape en échec ; 2 usage ou configuration ;
         4 échec après l'activation, version d'avant remise ; 5 échec après l'activation, version d'avant non
         remise ; 6 serveur non restreint ; 7 gel ; 8 verrou tenu ; 9 serveur injoignable.`;

export interface Dependances {
  lancer?: Lanceur;
  maintenant?: () => Date;
  home?: string;
  racine?: string;
  ecrire?: (l: string) => void;
}

export async function executer(argv: string[], deps: Dependances = {}): Promise<number> {
  const ecrire = deps.ecrire ?? ((l: string) => console.log(l));
  const [sousCommande, ...reste] = argv;
  const usage = (m: string): number => {
    ecrire(`${m}\n${USAGE}`);
    return 2;
  };
  if (process.version.startsWith('v24.') === false) {
    return usage(`Node 24 exigé (version actuelle ${process.version}) : lancer fnm exec --using=24 npm run deploy:auto`);
  }
  let sha: string | null = null;
  if (sousCommande === 'etat') {
    if (reste.length > 0) return usage('etat ne prend ni argument ni option');
  } else if (sousCommande === 'deployer') {
    if (reste.length !== 1) return usage('deployer : un commit de 40 caractères hexadécimaux minuscules attendu');
    sha = reste[0] as string;
    if (!SHA.test(sha)) return usage('deployer : commit de 40 caractères hexadécimaux minuscules attendu');
  } else {
    return usage(`sous-commande inconnue ou absente : ${argv.join(' ') || '(aucune)'}`);
  }
  const ctx = {
    lancer: deps.lancer ?? lancerParDefaut,
    maintenant: deps.maintenant ?? (() => new Date()),
    home: deps.home ?? homedir(),
    racine: deps.racine ?? RACINE,
    ecrire,
  };
  return sha === null ? etatAuto(ctx) : executerDeploiementAuto(sha, ctx);
}

if (import.meta.main) {
  // Fenêtre fermée ou tube coupé : écrire ne doit pas faire échouer un retour automatique en cours.
  process.stdout.on('error', () => {});
  process.stderr.on('error', () => {});
  try {
    process.exitCode = await executer(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exitCode = 1;
  }
}
