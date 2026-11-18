// CI locale sur le Mac (LOC-01, D-01 à D-03) : rejoue les jobs verifier, secrets et e2e de .github/workflows/ci.yml
// dans l'arbre de travail, une ligne par étape, puis écrit un reçu daté hors du dépôt (~/.cache/rtp/ci/<sha>.json)
// si l'arbre était propre au début et à la fin et que HEAD n'a pas bougé. deploy:local (plan 06) exige ce reçu.
// Usage : npm run ci:local [-- --etapes <id,id>] [-- --liste] [-- --aide]
// Ne pas lancer en même temps qu'un autre build ou npm test dans le même dossier (un verrou l'empêche entre deux
// ci:local).
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { envDeBase, lancer as lancerParDefaut, type Lanceur } from './lib/processus.ts';
import {
  ETAPES,
  VerrouPris,
  cheminRecu,
  dossierRecus,
  duree,
  ecrireRecu,
  executerEtapes,
  prendreVerrou,
  type Recu,
} from './lib/ci-local.ts';

const AIDE = `Usage : npm run ci:local [-- --etapes <id,id>] [-- --liste] [-- --aide]
  Rejoue sur le Mac les contrôles des jobs verifier, secrets et e2e de la CI GitHub (ci.yml).
  --etapes : seulement ces étapes (reçu partiel, jamais valide pour un déploiement) ; --liste pour les identifiants
  --liste  : affiche chaque identifiant d'étape et le nom de l'étape de ci.yml qu'elle rejoue
  Reçu : ~/.cache/rtp/ci/<commit>.json, écrit seulement pour un arbre propre et un HEAD immobile.
  Codes de sortie : 0 toutes les étapes lancées sont vertes, 1 une étape a échoué, 2 usage, Node autre que 24,
  pas un dépôt git, ou une autre exécution en cours.`;

export class Sortie extends Error {
  readonly code: 1 | 2;
  constructor(code: 1 | 2, message: string) {
    super(message);
    this.name = 'Sortie';
    this.code = code;
  }
}

export interface Dependances {
  lancer?: Lanceur;
  maintenant?: () => Date;
  home?: string;
  racine?: string;
  ecrire?: (ligne: string) => void;
  /** Version de Node vérifiée au départ (tests) ; par défaut process.version. */
  versionNode?: string;
}

function lireArguments(argv: string[]): { etapes?: string; liste: boolean; aide: boolean } {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { etapes: { type: 'string' }, liste: { type: 'boolean' }, aide: { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    });
    return { etapes: values.etapes, liste: values.liste === true, aide: values.aide === true };
  } catch (e) {
    throw new Sortie(2, `${e instanceof Error ? e.message : String(e)}\n${AIDE}`);
  }
}

function choisirEtapes(liste: string | undefined): typeof ETAPES {
  if (liste === undefined) return ETAPES;
  const ids = liste.split(',').map((x) => x.trim()).filter((x) => x !== '');
  const connus = new Set(ETAPES.map((e) => e.id));
  const inconnus = ids.filter((x) => !connus.has(x));
  if (ids.length === 0 || inconnus.length > 0) {
    throw new Sortie(2, `étape inconnue : ${inconnus.join(', ') || '(aucune)'} ; identifiants : ${ETAPES.map((e) => e.id).join(', ')}`);
  }
  return ETAPES.filter((e) => ids.includes(e.id));
}

async function git(lancer: Lanceur, racine: string, args: string[]): Promise<{ ok: boolean; sortie: string }> {
  const r = await lancer({ commande: 'git', args, cwd: racine, env: envDeBase(), delaiMs: 120_000, libelle: `git ${args[0] ?? ''}` });
  return { ok: r.code === 0, sortie: r.stdout.trim() };
}

/** Arbre propre : aucune modification, aucun fichier non suivi et non ignoré. */
async function arbrePropre(lancer: Lanceur, racine: string): Promise<boolean> {
  const r = await git(lancer, racine, ['status', '--porcelain', '--untracked-files=all']);
  return r.ok && r.sortie === '';
}

async function executerSansCapture(argv: string[], deps: Dependances, ecrire: (l: string) => void): Promise<number> {
  const a = lireArguments(argv);
  if (a.aide) {
    ecrire(AIDE);
    return 0;
  }
  if (a.liste) {
    for (const e of ETAPES) ecrire(`${e.id.padEnd(20)} ${e.job.padEnd(9)} ${e.parite.padEnd(13)} ${e.nomCi}`);
    return 0;
  }
  const etapes = choisirEtapes(a.etapes);
  const partiel = a.etapes !== undefined;
  const versionNode = deps.versionNode ?? process.version;
  if (!versionNode.startsWith('v24.')) {
    throw new Sortie(2, `Node 24 exigé (version actuelle ${versionNode}) : lancer fnm exec --using=24 npm run ci:local`);
  }
  const lancer = deps.lancer ?? lancerParDefaut;
  const demandee = deps.racine ?? process.cwd();
  const sommet = await git(lancer, demandee, ['rev-parse', '--show-toplevel']);
  if (!sommet.ok || sommet.sortie === '') throw new Sortie(2, `pas un dépôt git : ${demandee}`);
  const racine = deps.racine ?? sommet.sortie;
  const home = deps.home ?? homedir();
  const maintenant = deps.maintenant ?? (() => new Date());

  let rendre: () => void;
  try {
    rendre = prendreVerrou(path.join(dossierRecus(home), '.verrou'), ecrire);
  } catch (e) {
    if (e instanceof VerrouPris) throw new Sortie(2, `ci:local : ${e.message}`);
    throw e;
  }
  const surSignal = (signal: NodeJS.Signals): void => {
    rendre();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', surSignal);
  process.once('SIGTERM', surSignal);

  try {
    const debut = Date.now();
    const date = maintenant();
    const head = (await git(lancer, racine, ['rev-parse', 'HEAD'])).sortie;
    const branche = (await git(lancer, racine, ['rev-parse', '--abbrev-ref', 'HEAD'])).sortie;
    const propreDebut = await arbrePropre(lancer, racine);
    ecrire(`CI locale : commit ${head}, branche ${branche}, ${date.toISOString()}`);
    ecrire(`Reçu : ${/^[0-9a-f]{40}$/.test(head) ? cheminRecu(home, head) : '(commit illisible)'}`);
    if (partiel) ecrire('Exécution partielle (--etapes) : reçu partiel, jamais valide pour un déploiement');
    if (!propreDebut) ecrire('Attention : arbre de travail non propre, aucun reçu ne sera écrit');

    const bilan = await executerEtapes(etapes, { lancer, racine, ecrire });

    const headFin = (await git(lancer, racine, ['rev-parse', 'HEAD'])).sortie;
    const propreFin = await arbrePropre(lancer, racine);
    const echecs = bilan.etapes.filter((e) => e.resultat === 'echec');

    ecrire('');
    ecrire(`Bilan : ${bilan.etapes.length - echecs.length} étape(s) sans échec, ${echecs.length} en échec, durée totale ${duree(Date.now() - debut)}`);
    if (headFin !== head) {
      ecrire('HEAD a changé pendant l\'exécution : aucun reçu');
    } else if (!propreDebut || !propreFin) {
      ecrire('arbre de travail non propre : aucun reçu');
    } else {
      const recu: Recu = {
        version: 1,
        commit: head,
        date: date.toISOString(),
        node: versionNode,
        arbre_propre: true,
        partiel,
        base_ids: bilan.base_ids,
        secrets: bilan.secrets,
        gitleaks: bilan.gitleaks,
        etapes: bilan.etapes,
      };
      const chemin = ecrireRecu(home, recu);
      ecrire(`reçu écrit : ${chemin}${partiel ? ' (partiel : ne permet pas de déployer)' : ''}`);
    }
    if (bilan.secrets === 'non_executee' && etapes.some((e) => e.special === 'gitleaks')) {
      ecrire('recherche de secrets non exécutée : ce reçu ne permet pas de déployer (brew install gitleaks)');
    }
    if (echecs.some((e) => e.id === 'e2e')) {
      ecrire('Tests navigateur en échec : le rapport Playwright est dans playwright-report/ (npx playwright show-report)');
    }
    for (const e of echecs) ecrire(`en échec : ${e.nomCi}`);
    return echecs.length > 0 ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', surSignal);
    process.removeListener('SIGTERM', surSignal);
    rendre();
  }
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
    if (e instanceof Sortie) {
      console.error(e.message);
      process.exitCode = e.code;
    } else {
      console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
      process.exitCode = 1;
    }
  }
}
