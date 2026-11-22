// Déploiement depuis le Mac : `npm run deploy:local` (phase 9.2, LOC-02 ; D-03 à D-07, D-10, D-13).
//
// Remplace pour Erwan les jobs construire et deploy de .github/workflows/ci.yml. Chaque étape du job deploy a ici son
// équivalent, ou une exclusion écrite avec sa raison : GARDES_DEPLOIEMENT et EXCLUSIONS_DEPLOY, plus bas, comparés
// aux noms des étapes de ci.yml par tests/repo/deploiement-local.test.ts.
//
// Ordre (la CLI a déjà refusé une entrée standard qui n'est pas un terminal, hors --dry-run) :
//   1. verrou local (WR-02), fichier local, Node 24, exécutables résolus en chemins absolus, rsync 3 exigé hors
//      --dry-run, instantané d'intégrité A (exécutables, .git/config, .git/hooks, fichiers de configuration et secrets) ;
//   2. garde de gel au départ ;
//   3. arbre propre, git fetch réussi, HEAD égal à origin/main (rien de non poussé ne part en ligne) ;
//   4. reçu vert de ci:local pour ce commit exact, sinon refus : ci:local n'est jamais lancé d'ici (CR-01 de la revue
//      de la phase 9.2 : il fait tourner les dépendances npm sans bac à sable, dans le terminal et juste avant que la
//      clé ne soit chargée) ;
//   5. build scellée (construire.ts, WR-04) puis instantané comparé à A : ci:local et la build n'ont rien changé ;
//   6. --dry-run : écran sans donnée du serveur, arrêt (ni agent, ni etat, ni journal) ;
//   7. agent ssh (phrase de passe tapée par Erwan), etat, site touché depuis la version en ligne (sinon --forcer),
//      fichiers qui changent, clé retirée de l'agent (CR-04 de la revue de la phase 9.2), écran, phrase tapée
//      (confirmation.ts) ;
//   8. après la confirmation, tout ce qui a pu changer pendant l'attente est rejoué : gel (CR-02), tête de main,
//      configuration et cible de la build, instantané A, empreinte de l'arbre et absence de lien (CR-01), commit de
//      version.json ; puis clé rechargée (phrase de passe tapée de nouveau, CR-04) ;
//   9. envoi, etat (version d'avant, WR-01), clé présente avec 12 min devant elle (sinon rechargée, CR-04), activer,
//      etat, test de fumée ; échec ou signal après activer : retour automatique vers la version exacte notée avant
//      (WR-01, IN-07), sauf retrait d'urgence.
// Codes : 0 déployé, rien à déployer, ou répétition à blanc ; 1 garde ou étape en échec, activation refusée (WR-01)
// ou signal reçu avant l'activation (WR-05), rien d'activé ; 2 usage ou
// configuration (rsync 3 absent compris) ; 3 pas de terminal, confirmation refusée, clé sans phrase de passe ;
// 4 échec après l'activation, version d'avant remise en ligne ; 5 échec après l'activation, version d'avant non
// remise (retrait d'urgence, aucune version avant, current changé entre-temps, retour automatique en échec).
//
// ctx.confirmer est obligatoire et sans défaut : la CLI passe toujours confirmerSurTerminal. Les crochets
// apresConstruction et apresActivation n'existent que pour les tests de la bibliothèque : la CLI ne les expose ni en
// option, ni en variable d'environnement, ni dans ses Dependances.
// Le processus qui tient la clé n'importe que des modules node:, des modules relatifs et scripts/garde-gel.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { envDeBase, type Lanceur } from '../processus.ts';
import { assurerCle, ouvrirAgent, type Agent } from './agent.ts';
import { cheminsSecrets, lireConfig, type ConfigDeploiement } from './config.ts';
import { lignesEcran, phraseAttendue, type Confirmateur } from './confirmation.ts';
import { construireDeploiement, type BuildDeploiement } from './construire.ts';
import { empreinteArbre, trouverSpecial } from './empreinte.ts';
import { prendreInstantane, resoudreExecutables, verifierIntegrite, type Executables, type Instantane } from './executables.ts';
import { arbrePropre, decisionGel, lireCheminsHorsSite, SITE_TOUCHE, siteTouche, Sortie, teteAdmise, teteOrigine, verifierRecu, type Outils } from './gardes.ts';
import { ajouterJournal, dejaDeploye, type EntreeJournal } from './journal.ts';
import { masquer } from './masque.ts';
import { prendreVerrouDeploiement } from './retour.ts';
import { appelerVerbe, EchecVerbe, envoyer, exigerRsync3, lireEtat, varianteRsync, versionServie } from './transport.ts';

export interface OptionsDeploiement {
  /** Déployer même si le site n'a pas changé depuis la version en ligne. */
  forcer: boolean;
  /** Retrait d'urgence (pendant un gel, avec justification) : jamais de retour automatique. */
  urgence: boolean;
  justification: string;
  /** Répétition à blanc : gardes, reçu et build scellée, aucun contact avec le serveur. */
  dryRun: boolean;
}

export interface ContexteDeploiement {
  /** Obligatoire, sans défaut : confirmerSurTerminal dans la CLI. */
  confirmer: Confirmateur;
  lancer: Lanceur;
  maintenant: () => Date;
  home: string;
  racine: string;
  ecrire: (l: string) => void;
  /** Tests seulement : appelé après la build, avant tout contact avec le serveur. */
  apresConstruction?: (build: BuildDeploiement) => void | Promise<void>;
  /** Tests seulement : appelé juste après le verbe activer. */
  apresActivation?: () => void | Promise<void>;
}

/** Une étape du job deploy de ci.yml et son équivalent local. */
export interface GardeDeploiement {
  etapeCi: string;
  revue?: string;
  locale: string;
}

/** Une étape du job deploy sans équivalent local, avec sa raison et son rang dans le job (0 = première). */
export interface ExclusionDeploiement {
  etapeCi: string;
  rang: number;
  raison: string;
}

export const GARDES_DEPLOIEMENT: readonly GardeDeploiement[] = [
  {
    etapeCi: "Rejouer la garde de gel au moment de l'approbation (dates de Paris, retrait d'urgence justifié)",
    revue: 'CR-02',
    locale: 'decisionGel au départ, puis rejouée avec une heure relue juste après la confirmation tapée',
  },
  {
    etapeCi: 'Refuser le déploiement approuvé pendant le gel',
    revue: 'CR-02',
    locale: "code 1 au départ ou après la confirmation, rien n'est envoyé ; journal refus",
  },
  {
    etapeCi:
      "Vérifier la cible et que le commit est encore la tête de main, ou que la tête ne change pas le site (approbation périmée refusée)",
    locale:
      "cible essai ou production (lireConfig) ; arbre propre, git fetch réussi et HEAD = origin/main au départ ; après la confirmation, nouveau fetch (échec : refus) et teteAdmise",
  },
  {
    etapeCi: "Vérifier la build téléchargée (empreinte de l'arbre, cible, commit de version.json, aucun lien)",
    revue: 'CR-01',
    locale:
      "après la confirmation : cible de la build égale à la cible relue, trouverSpecial nul, empreinteArbre égale à celle de la build, jq sur version.json ; instantané A inchangé",
  },
  {
    etapeCi: 'Envoyer la build dans incoming/<cible>/<sha>/ (rsync sans suppression ni lien symbolique)',
    revue: 'CR-01',
    locale: 'envoyer : rsync 3 exigé, -rt sans option de liens, modes normalisés dans la build',
  },
  {
    etapeCi: "Noter la version courante avant l'activation (cible exacte d'un retour automatique)",
    revue: 'WR-01',
    locale: 'etat juste après l\'envoi : COURANT_AVANT ; réponse illisible : code 1, rien n\'est activé',
  },
  {
    etapeCi: 'Activer la version (bascule atomique de current)',
    revue: 'IN-07',
    locale: 'gestionnaires SIGINT, SIGTERM, SIGHUP posés, version marquée active avant l\'envoi du verbe activer',
  },
  {
    etapeCi: "Vérifier l'état (current pointe le commit du run)",
    locale: 'etat doit répondre courant=<sha>',
  },
  {
    etapeCi: 'Test de fumée HTTPS (version servie, en-têtes HSTS et CSP)',
    locale: 'versionServie : /version.json du commit, HSTS et CSP ; RTP_URL vide : sauté, dit en toutes lettres',
  },
  {
    etapeCi: "Retour arrière automatique (une étape a échoué, ou le run a été annulé, après l'activation)",
    revue: 'WR-01, IN-07',
    locale:
      "retourAutomatique : sur échec ou signal après activer, retour vers COURANT_AVANT, sauf urgence, aucune version avant, sha déjà en ligne ou current changé ; échec du retour : code 5",
  },
];

export const EXCLUSIONS_DEPLOY: readonly ExclusionDeploiement[] = [
  {
    etapeCi: 'Récupérer le dépôt (historique complet, pour comparer le commit du run à la tête de main)',
    rang: 0,
    raison: "clone local d'Erwan, historique complet ; git fetch de origin/main au départ et après la confirmation",
  },
  {
    etapeCi: 'Installer Node (version de .nvmrc)',
    rang: 1,
    raison: 'Node fourni par fnm ; version v24 contrôlée par la CLI et au départ du déploiement',
  },
  {
    etapeCi: 'Télécharger la build du job construire (jamais la build preview)',
    rang: 5,
    raison: 'build faite sur le Mac par construireDeploiement (plan 02) : worktree du commit exact, bac à sable, sans secret (WR-04)',
  },
  {
    etapeCi: "Écrire la clé de déploiement et l'empreinte épinglée du serveur (jamais de scan de clé d'hôte)",
    rang: 7,
    raison: 'rien n\'est écrit : clé dédiée lue sur place, avec phrase de passe, dans un agent propre à la commande ; known_hosts épinglé dans ~/.config/rtp',
  },
  {
    etapeCi: "Effacer la clé et l'empreinte du runner",
    rang: 14,
    raison: 'rien n\'a été écrit ; l\'agent ssh de la commande est tué à la fin (fermer), sur signal et à la sortie du processus',
  },
];

const MIN = 60_000;
/**
 * CR-04 : temps de clé exigé avant l'activation : activer et etat (1 min chacun), test de fumée (deux curl de 3 min
 * et jq), puis, en cas d'échec, retour automatique (etat, retour, etat : 1 min chacun).
 */
const MARGE_APRES_ACTIVATION = 12 * MIN;
/** CR-04 : temps de clé exigé avant l'envoi ; une clé qui expire pendant l'envoi n'active rien (code 1). */
const MARGE_ENVOI = 5 * MIN;
const SIGNAUX = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
/** ci.yml du dépôt qui exécute ce code (seule définition de CHEMINS_HORS_SITE), comme ops/site-touche.sh. */
const CI_YML = fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url));
/**
 * WR-06 (revue de la phase 9.2) : fichiers du dépôt qui exécute ce code, lus pendant le déploiement (classement du
 * site, CHEMINS_HORS_SITE) : ajoutés à l'instantané d'intégrité.
 */
export const FICHIERS_DEPOT_SURVEILLES: readonly string[] = [SITE_TOUCHE, CI_YML];
const NOMS_FIXES = ['git', 'bash', 'ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'jq', 'sandbox-exec', 'npm'];

const utc = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
/** Un échec venu du serveur, de ssh ou de rsync (64, 65, 255…) devient le code 1 ; son code reste dans le message. */
const normaliser = (code: number): number => ([1, 2, 3].includes(code) ? code : 1);

class Interruption extends Error {
  readonly signal: NodeJS.Signals;
  constructor(signal: NodeJS.Signals) {
    super(`signal ${signal} reçu après l'activation`);
    this.signal = signal;
  }
}

/** Fin d'un déploiement après l'activation : code 4 ou 5 (ou 1), résultat du journal. */
class FinApresActivation extends Error {
  readonly code: number;
  readonly resultat: EntreeJournal['resultat'];
  constructor(code: number, resultat: EntreeJournal['resultat'], message: string) {
    super(message);
    this.code = code;
    this.resultat = resultat;
  }
}

/**
 * WR-01 (revue de la phase 9.2) : l'échec du verbe activer prouve-t-il que rien n'a été activé ? Oui pour un refus de
 * la commande forcée (64, 65, 66, 75), un verrou du serveur occupé (1, « verrou occupé »), ou un refus de ssh avant
 * toute commande (255 : clé refusée, connexion refusée, clé d'hôte, nom introuvable). Un délai dépassé, un signal ou
 * toute autre fin laisse l'activation possible : retour automatique.
 */
export function activationExclue(e: unknown): boolean {
  if (!(e instanceof EchecVerbe) || e.delaiDepasse || e.codeBrut === null) return false;
  if ([64, 65, 66, 75].includes(e.codeBrut)) return true;
  if (e.codeBrut === 1) return /échec : verrou occupé/.test(e.detail);
  if (e.codeBrut === 255) return /Permission denied|Connection refused|Host key verification failed|Could not resolve hostname/.test(e.detail);
  return false;
}

function chemin(exe: Executables, nom: string): string {
  const e = exe[nom];
  if (e === undefined) throw new Sortie(2, `exécutable non résolu : ${nom}`);
  return e.chemin;
}

export async function executerDeploiement(o: OptionsDeploiement, ctx: ContexteDeploiement): Promise<number> {
  const { ecrire } = ctx;
  const debut = ctx.maintenant();
  // WR-06 : git et bash par leur chemin résolu et figé (instantané A), dès qu'il est connu.
  const outils: Outils = {};
  const gitL = (args: string[], delaiMs = 2 * MIN) =>
    ctx.lancer({ commande: outils.git ?? 'git', args, cwd: ctx.racine, env: envDeBase(), delaiMs, libelle: `git ${args[0] ?? ''}` });

  let rendre: (() => void) | null = null;
  let agent: Agent | null = null;
  let build: BuildDeploiement | null = null;
  let cfg: ConfigDeploiement | null = null;
  let journaliser = false;
  let refus = false;
  let sha: string | null = null;
  let courantAvant: string | null = null;
  let resultat: EntreeJournal['resultat'] = 'echec';
  let message: string | undefined;
  let code = 1;
  const gestionnaires: [NodeJS.Signals, (s: NodeJS.Signals) => void][] = [];
  // WR-05 (revue de la phase 9.2) : gestionnaires de SIGINT, SIGTERM et SIGHUP posés dès le début. Avant l'activation,
  // un signal arrête la commande (étape de build tuée avec son groupe, phrase de passe ou confirmation interrompues)
  // et le finally fait tout le nettoyage (agent, worktree, copie, journal, verrou) ; après l'activation, il déclenche
  // le retour automatique (IN-07).
  const arret = new AbortController();
  let signalAvant: NodeJS.Signals | null = null;
  let apresActivation: ((sig: NodeJS.Signals) => void) | null = null;
  const surSignal = (sig: NodeJS.Signals): void => {
    if (apresActivation !== null) {
      apresActivation(sig);
      return;
    }
    if (signalAvant !== null) return;
    signalAvant = sig;
    arret.abort();
  };
  for (const sig of SIGNAUX) {
    process.on(sig, surSignal);
    gestionnaires.push([sig, surSignal]);
  }
  const verifierArret = (): void => {
    if (signalAvant !== null) throw new Sortie(1, `interrompu par ${signalAvant} avant l'activation : rien n'a été activé`);
  };

  try {
    // ---------- 1. verrou, configuration, outils, instantané A ----------
    // WR-02 : verrou local commun au déploiement et au retour (équivalent des groupes de concurrence de GitHub).
    rendre = prendreVerrouDeploiement(ctx.home, ecrire);
    cfg = lireConfig(ctx.home);
    const c0 = cfg;
    if (!process.version.startsWith('v24.')) {
      throw new Sortie(2, `Node 24 exigé (version actuelle ${process.version}) : lancer fnm exec --using=24 npm run deploy:local`);
    }
    const PATH = envDeBase().PATH ?? '';
    const noms = [...NOMS_FIXES, c0.rsync];
    const resolus = resoudreExecutables(noms, PATH);
    // envoyer lit exe.rsync : le chemin résolu de RTP_RSYNC est rangé sous la clé rsync.
    const exe: Executables = { ...resolus, rsync: resolus[c0.rsync] as { chemin: string; empreinte: string } };
    const variante = await varianteRsync(chemin(exe, 'rsync'), ctx.lancer);
    if (!o.dryRun) exigerRsync3(variante);
    const secrets = cheminsSecrets(c0, ctx.home);
    outils.git = chemin(exe, 'git');
    outils.bash = chemin(exe, 'bash');
    const surveilles = [...secrets, ...FICHIERS_DEPOT_SURVEILLES];
    const optionsInstantane = { racine: ctx.racine, fichiers: surveilles, executables: { noms, path: PATH } };
    const instantaneA: Instantane = prendreInstantane(optionsInstantane);
    let chemins: string;
    try {
      chemins = lireCheminsHorsSite(readFileSync(CI_YML, 'utf8'));
    } catch (e) {
      throw new Sortie(2, `CHEMINS_HORS_SITE illisible dans ${CI_YML} : ${e instanceof Error ? e.message : String(e)}`);
    }
    journaliser = !o.dryRun;

    // ---------- 2. garde de gel au départ ----------
    const gel = decisionGel(debut, o.urgence, o.justification);
    ecrire(`Garde de gel : ${gel.motif}`);
    if (!gel.ok) {
      refus = true;
      throw new Sortie(1, "déploiement refusé par la garde de gel ; pendant un gel, seul un retrait d'urgence justifié passe (--urgence --justification \"…\", 20 caractères au moins)");
    }

    // ---------- 3. arbre propre, tête de origin/main ----------
    if (!(await arbrePropre(ctx.lancer, ctx.racine, outils))) {
      throw new Sortie(1, "arbre de travail non propre (changements ou fichiers non suivis) : committer et pousser d'abord");
    }
    const head = await gitL(['rev-parse', '--verify', 'HEAD^{commit}']);
    if (head.code !== 0) throw new Sortie(2, `HEAD illisible : ${head.stderr.trim()}`);
    const s = head.stdout.trim();
    sha = s;
    const origine = await teteOrigine(ctx.lancer, ctx.racine, outils);
    if (!origine.fetchOk) throw new Sortie(1, "git fetch impossible : rien de non vérifié ne part en ligne");
    if (origine.tete !== s) {
      throw new Sortie(1, `HEAD (${s}) n'est pas la tête de origin/main (${origine.tete || 'inconnue'}) : rien de non poussé ne part en ligne ; git pull ou git push d'abord`);
    }
    ecrire(`Commit : ${s}, tête de origin/main`);

    // ---------- 4. reçu de ci:local ----------
    // CR-01 : ci:local fait tourner les dépendances npm sans bac à sable ; il n'est plus lancé d'ici, juste avant que
    // la clé ne soit chargée dans ce même terminal. Erwan le lance lui-même, puis relance deploy:local dans un
    // nouveau terminal (un processus resté de ci:local ne garde pas ce terminal).
    const recu = verifierRecu(ctx.home, s);
    if (!recu.ok) {
      throw new Sortie(1, `reçu de ci:local : ${recu.motif} ; lancer fnm exec --using=24 npm run ci:local, puis relancer deploy:local dans un nouveau terminal ; rien n'est déployé`);
    }
    ecrire(`Reçu de ci:local : ${recu.motif}`);

    // ---------- 5. build scellée (WR-04) ----------
    // WR-04 : sur GitHub, la build (code de dépendances npm) et la clé vivent sur deux machines. Ici : build dans un
    // worktree du commit, sous sandbox-exec, sans aucun secret lisible, avant que l'agent ssh n'existe ; puis
    // l'instantané A (pris avant ci:local) est comparé : ni ci:local, ni la build n'ont changé un exécutable d'envoi,
    // .git/config, .git/hooks ou un fichier de configuration.
    build = await construireDeploiement({
      racine: ctx.racine,
      sha: s,
      cible: c0.cible,
      home: ctx.home,
      lecturesInterdites: secrets,
      fichiersSurveilles: surveilles,
      nomsExecutables: noms,
      lancer: ctx.lancer,
      ecrire,
      arret: arret.signal,
    });
    verifierArret();
    const b = build;
    verifierIntegrite(instantaneA, prendreInstantane(optionsInstantane), 'pendant ci:local ou la build');
    if (ctx.apresConstruction !== undefined) await ctx.apresConstruction(b);

    const sujet = async (x: string): Promise<string> => {
      const r = await gitL(['log', '-1', '--format=%s', x], MIN);
      const t = r.code === 0 ? r.stdout.trim() : '';
      return t === '' ? 'inconnu du dépôt local' : t;
    };
    const sujetS = await sujet(s);

    // ---------- 6. répétition à blanc ----------
    if (o.dryRun) {
      ecrire('');
      for (const l of lignesEcran({ action: 'deployer', cible: c0.cible, commit: s, sujet: sujetS, ...(recu.date === null ? {} : { dateRecu: recu.date }), empreinte: b.empreinte, rsync: variante, gel: gel.motif })) ecrire(l);
      ecrire('version en ligne : non lue, la répétition à blanc ne contacte pas le serveur');
      if (variante !== 'rsync3') ecrire('avertissement : un envoi réel exigera rsync 3 (brew install rsync, puis RTP_RSYNC dans ~/.config/rtp/deploiement.env)');
      ecrire(`Phrase qui sera demandée : ${phraseAttendue('deployer', c0.cible, s)}`);
      ecrire("répétition à blanc : rien n'a été envoyé");
      code = 0;
      return code;
    }

    // ---------- 7. agent, version en ligne, écran, confirmation ----------
    verifierArret();
    agent = await ouvrirAgent(c0, { exe, lancer: ctx.lancer, ecrire, home: ctx.home, maintenant: () => ctx.maintenant().getTime(), arret: arret.signal, gereSignaux: true });
    verifierArret();
    const ag = agent;
    const etatLu = async (moment: string) => {
      const ligne = await appelerVerbe(c0, ag, exe, 'etat', [c0.cible], ctx.lancer);
      const e = lireEtat(ligne);
      if (e === null || e.cible !== c0.cible) throw new Sortie(1, `réponse de etat illisible ${moment} : ${masquer(ligne, c0)}`);
      return e;
    };
    const enLigne = (await etatLu('avant la confirmation')).courant;
    const site = await siteTouche(ctx.lancer, ctx.racine, enLigne, s, chemins, outils);
    ecrire(`Site : ${site.raison}`);
    if (!site.touche && !o.forcer && !o.urgence) {
      ecrire('rien à déployer (--forcer pour déployer quand même)');
      journaliser = false;
      code = 0;
      return code;
    }
    const fichiers = await fichiersChanges(gitL, enLigne, s);
    // CR-04 : la clé n'attend pas la phrase de confirmation chargée (attente sans borne, expiration en cours de route).
    await ag.retirer();
    verifierArret();

    // IN-04 : l'écran est aussi passé au confirmateur, qui le réécrit sur le terminal si la sortie est redirigée.
    const ecran = [...lignesEcran({
      action: 'deployer',
      cible: c0.cible,
      commit: s,
      sujet: sujetS,
      enLigne,
      ...(enLigne === null ? {} : { sujetEnLigne: await sujet(enLigne) }),
      ...(recu.date === null ? {} : { dateRecu: recu.date }),
      fichiers: fichiers.resume,
      empreinte: b.empreinte,
      rsync: variante,
      gel: gel.motif,
    }),
      ...fichiers.lignes.map((l) => `  ${l}`),
      // IN-01 : version déjà rangée sur le serveur ? Elle serait réactivée telle quelle, l'envoi ignoré.
      ...(dejaDeploye(ctx.home, c0.cible, s)
        ? ["Ce commit a déjà été déployé sur cette cible (journal local) : si sa version est encore rangée sur le serveur, la copie envoyée sera ignorée et l'ancienne réactivée ; l'empreinte ci-dessus n'est alors pas celle servie."]
        : []),
      "Clé retirée de l'agent pendant cet écran : sa phrase de passe sera redemandée juste avant l'envoi."];
    ecrire('');
    for (const l of ecran) ecrire(l);
    await ctx.confirmer(phraseAttendue('deployer', c0.cible, s), { arret: arret.signal, ecran });
    verifierArret();

    // ---------- 8. tout ce qui a pu changer pendant l'attente est rejoué ----------
    // WR-06 : l'intégrité locale (exécutables, .git, fichiers surveillés) est contrôlée avant que git ou bash ne
    // tournent de nouveau, puis encore juste avant l'envoi.
    verifierIntegrite(instantaneA, prendreInstantane(optionsInstantane), 'pendant l\'attente de la confirmation');
    // CR-02 : garde de gel rejouée avec l'heure du moment (une confirmation tapée la veille d'un gel ne passe pas).
    const gelApres = decisionGel(ctx.maintenant(), o.urgence, o.justification);
    if (!gelApres.ok) {
      refus = true;
      throw new Sortie(1, `garde de gel rejouée après la confirmation : ${gelApres.motif} ; rien n'a été envoyé`);
    }
    const origineApres = await teteOrigine(ctx.lancer, ctx.racine, outils);
    if (!origineApres.fetchOk) throw new Sortie(1, "git fetch impossible après la confirmation : rien de non vérifié ne part en ligne");
    const admise = await teteAdmise(ctx.lancer, ctx.racine, s, origineApres.tete, chemins, outils);
    if (!admise.ok) throw new Sortie(1, admise.motif);
    ecrire(admise.motif);
    const relue = lireConfig(ctx.home);
    if (relue.cible !== c0.cible || b.cible !== relue.cible) {
      throw new Sortie(1, `cible de la build différente de la cible du déploiement (build ${b.cible}, fichier local ${relue.cible}) : rien n'a été envoyé`);
    }
    if (relue.hote !== c0.hote || relue.utilisateur !== c0.utilisateur) {
      throw new Sortie(1, "hôte ou utilisateur modifié dans le fichier local depuis le début : rien n'a été envoyé");
    }
    verifierIntegrite(instantaneA, prendreInstantane(optionsInstantane), 'depuis le début du déploiement');
    // CR-01 : l'arbre envoyé est celui construit et vérifié, sans lien symbolique ni fichier spécial.
    const special = trouverSpecial(b.dist);
    if (special !== null) throw new Sortie(1, `la build contient un lien symbolique ou un fichier spécial : ${special}`);
    const empreinte = empreinteArbre(b.dist);
    if (empreinte !== b.empreinte) throw new Sortie(1, `empreinte de la build modifiée depuis sa construction (${empreinte}, attendue ${b.empreinte}) : rien n'a été envoyé`);
    const v = await ctx.lancer({ commande: chemin(exe, 'jq'), args: ['-e', '--arg', 's', s, '.commit == $s', 'version.json'], cwd: b.dist, env: envDeBase(), delaiMs: MIN, libelle: 'jq version.json' });
    if (v.code !== 0) throw new Sortie(1, `dist/version.json ne porte pas le commit ${s}`);
    // CR-04 : clé rechargée juste avant d'écrire sur le serveur (phrase de passe tapée de nouveau).
    verifierArret();
    await assurerCle(ag, MARGE_ENVOI, "avant l'envoi", ecrire);
    verifierArret();

    // ---------- 9. envoi, version d'avant, activation, vérifications ----------
    const stats = await (async () => {
      try {
        return await envoyerBuild(c0, ag, exe, b.dist, s, ctx.lancer);
      } catch (e) {
        if (e instanceof Sortie) throw new Sortie(normaliser(e.code), e.message);
        throw e;
      }
    })();
    if (stats !== '') ecrire(stats);
    // WR-01 : la version en ligne juste avant l'activation est la seule cible d'un retour automatique.
    courantAvant = (await etatLu("avant l'activation : rien n'est activé")).courant;
    ecrire(`Version en ligne avant l'activation : ${courantAvant ?? 'aucune'}`);
    // WR-02 (revue de la phase 9.2) : l'activation remplace courantAvant ; l'écran et le classement « site touché »
    // portaient sur enLigne. Un retour ou un déploiement venu d'ailleurs (GitHub) pendant l'attente : refus.
    if (courantAvant !== enLigne) {
      throw new Sortie(1, `la version en ligne a changé depuis l'écran (${enLigne ?? 'aucune'} puis ${courantAvant ?? 'aucune'}) : rien n'est activé, relancer deploy:local`);
    }
    // CR-04 : la vérification d'après l'activation et le retour automatique ont besoin de la clé ; elle doit être là,
    // avec assez de temps devant elle, avant que activer ne parte (sinon rechargée, phrase de passe tapée de nouveau).
    await assurerCle(ag, MARGE_APRES_ACTIVATION, "avant l'activation", ecrire);

    // IN-07 : un Ctrl-C, SIGTERM ou SIGHUP reçu après l'activation déclenche le retour automatique, comme un run
    // annulé sur GitHub. Les gestionnaires posés au début basculent ici, sans attente entre le dernier contrôle
    // d'arrêt et l'envoi du verbe ; ils restent jusqu'à la fin (un second signal ne coupe pas le retour en cours).
    // L'agent ne gère pas les signaux (gereSignaux) : il est fermé dans le finally.
    let rejeter: (e: unknown) => void = () => {};
    const interruption = new Promise<never>((_, rej) => {
      rejeter = rej;
    });
    interruption.catch(() => {});
    let signalRecu: NodeJS.Signals | null = null;
    verifierArret();
    apresActivation = (sig: NodeJS.Signals): void => {
      if (signalRecu !== null) return;
      signalRecu = sig;
      rejeter(new Interruption(sig));
    };
    const course = <T>(p: Promise<T>): Promise<T> => Promise.race([p, interruption]);

    // Marquée active avant l'envoi du verbe : un délai dépassé alors que le serveur a basculé compte comme activé.
    let activerEnCours: Promise<unknown> | null = null;
    try {
      const pActiver = appelerVerbe(c0, ag, exe, 'activer', [c0.cible, s], ctx.lancer);
      activerEnCours = pActiver;
      ecrire(await course(pActiver));
      if (ctx.apresActivation !== undefined) await course(Promise.resolve(ctx.apresActivation()));
      const apres = await course(etatLu("après l'activation"));
      if (apres.courant !== s) throw new Sortie(1, `current ne pointe pas le commit ${s} après l'activation (pointe ${apres.courant ?? 'aucun'})`);
      ecrire(`Version active sur le serveur : ${s} (${c0.cible})`);
      if (c0.url === null) {
        ecrire('test de fumée HTTPS sauté : RTP_URL vide (etat fait foi)');
      } else {
        const vs = await course(versionServie(c0, exe, ctx.lancer));
        if (vs.commit !== s) throw new Sortie(1, `/version.json ne sert pas le commit ${s} (sert ${vs.commit})`);
        if (!vs.hsts) throw new Sortie(1, "en-tête Strict-Transport-Security absent de la page d'accueil");
        if (!vs.csp) throw new Sortie(1, "en-tête Content-Security-Policy absent de la page d'accueil");
        ecrire(`Version servie : ${s} (/version.json)`);
        ecrire('En-têtes Strict-Transport-Security et Content-Security-Policy présents');
      }
    } catch (e) {
      // IN-03 (revue de la phase 9.2) : toute erreur levée après l'activation (ENOSPC de versionServie, erreur de
      // programmation), pas seulement une Sortie, passe par le retour automatique, comme failure() dans ci.yml.
      const raison = e instanceof Interruption ? e.message : masquer(e instanceof Error ? e.message : String(e), c0);
      // Un activer encore en vol est attendu (son délai est borné) : le retour ne doit pas le précéder.
      const issueActiver: unknown = activerEnCours === null ? null : await activerEnCours.then(() => null, (x: unknown) => x);
      // WR-01 : un refus net du verbe activer n'a rien activé : ni retour automatique, ni « version incertaine ».
      if (activationExclue(issueActiver)) {
        const refus = masquer((issueActiver as EchecVerbe).message, c0);
        throw new Sortie(1, `activation refusée, rien n'a été activé (version en ligne : ${courantAvant ?? 'aucune'}) : ${refus}${e instanceof Interruption ? ` ; ${e.message}` : ''}`);
      }
      throw await retourAutomatique({ o, ctx, cfg: c0, agent: ag, exe, sha: s, courantAvant, raison });
    }

    resultat = 'succes';
    ecrire(`Déploiement fait et vérifié : ${s} en ligne sur ${c0.cible}`);
    code = 0;
    return code;
  } catch (e) {
    if (e instanceof FinApresActivation) {
      code = e.code;
      resultat = e.resultat;
      message = e.message;
      ecrire(cfg === null ? e.message : masquer(e.message, cfg));
      return code;
    }
    if (!(e instanceof Sortie)) {
      message = e instanceof Error ? e.message : String(e);
      throw e;
    }
    code = normaliser(e.code);
    resultat = e.code === 3 || refus ? 'refus' : 'echec';
    message = e.message;
    if (signalAvant !== null) {
      // WR-05 : ce qu'a rendu l'étape tuée importe peu ; la raison est le signal.
      code = 1;
      resultat = 'refus';
      message = `interrompu par ${signalAvant} avant l'activation : rien n'a été activé`;
    }
    ecrire(cfg === null ? message : masquer(message, cfg));
    return code;
  } finally {
    try {
      try {
        if (agent !== null) await agent.fermer();
      } finally {
        if (build !== null) await build.nettoyer();
      }
    } finally {
      for (const [sig, f] of gestionnaires) process.removeListener(sig, f);
      if (journaliser && cfg !== null) {
        const entree: EntreeJournal = {
          date: ctx.maintenant().toISOString(),
          action: 'deployer',
          cible: cfg.cible,
          commit: sha,
          precedent: courantAvant,
          resultat,
          urgence: o.urgence,
        };
        if (o.urgence) entree.justification = o.justification;
        if (message !== undefined) entree.message = message;
        ajouterJournal(ctx.home, entree, cfg, ecrire);
      }
      if (rendre !== null) {
        ecrire(`Déploiement : début ${utc(debut)}, fin ${utc(ctx.maintenant())} (UTC)`);
        rendre();
      }
    }
  }
}

/** rsync de la build : transport.envoyer, ses statistiques masquées. */
function envoyerBuild(cfg: ConfigDeploiement, agent: Agent, exe: Executables, dist: string, sha: string, lancer: Lanceur): Promise<string> {
  return envoyer(cfg, agent, exe, dist, cfg.cible, sha, lancer);
}

/** Fichiers qui changent depuis la version en ligne : 20 lignes au plus de git diff --name-status. */
async function fichiersChanges(
  gitL: (args: string[], delaiMs?: number) => ReturnType<Lanceur>,
  enLigne: string | null,
  sha: string,
): Promise<{ resume: string; lignes: string[] }> {
  if (enLigne === null) return { resume: 'aucune version en ligne : tout le site est envoyé', lignes: [] };
  const existe = await gitL(['cat-file', '-e', `${enLigne}^{commit}`]);
  if (existe.code !== 0) return { resume: "version en ligne inconnue de l'historique local", lignes: [] };
  const d = await gitL(['diff', '--no-renames', '--name-status', enLigne, sha]);
  if (d.code !== 0) return { resume: "version en ligne inconnue de l'historique local", lignes: [] };
  const toutes = d.stdout.split('\n').filter((l) => l !== '');
  const lignes = toutes.slice(0, 20);
  if (toutes.length > 20) lignes.push(`(+${toutes.length - 20} autres)`);
  return { resume: `${toutes.length} fichier(s) depuis ${enLigne.slice(0, 12)}`, lignes };
}

interface EntreeRetourAuto {
  o: OptionsDeploiement;
  ctx: ContexteDeploiement;
  cfg: ConfigDeploiement;
  agent: Agent;
  exe: Executables;
  sha: string;
  courantAvant: string | null;
  raison: string;
}

/**
 * Retour automatique après un échec ou un signal survenu après activer (WR-01, IN-07), mêmes conditions que l'étape
 * « Retour arrière automatique » de ci.yml. Rend toujours une FinApresActivation (code 4, 5 ou 1). Le retour vise la
 * version exacte notée avant l'activation, jamais « la précédente » de l'historique du serveur.
 */
async function retourAutomatique(r: EntreeRetourAuto): Promise<FinApresActivation> {
  const { ctx, cfg, agent, exe, sha, courantAvant } = r;
  const ecrire = (l: string): void => ctx.ecrire(masquer(l, cfg));
  const sha12 = sha.slice(0, 12);
  ecrire(`échec après l'activation : ${r.raison}`);
  if (r.o.urgence) {
    return new FinApresActivation(5, 'sans-retour', `retrait d'urgence : aucun retour automatique (le contenu retiré resterait sinon en ligne) ; vérifier à la main la version servie avec npm run deploy:local -- etat (${r.raison})`);
  }
  if (courantAvant === null) {
    return new FinApresActivation(5, 'sans-retour', `aucune version n'était en ligne avant l'activation : aucun retour automatique possible ; vérifier à la main avec npm run deploy:local -- etat (${r.raison})`);
  }
  if (courantAvant === sha) {
    return new FinApresActivation(1, 'echec', `${sha12} était déjà en ligne avant ce déploiement : current n'a pas changé, aucun retour (${r.raison})`);
  }
  const avant = courantAvant;
  const journalRetour = (resultat: 'succes' | 'echec', message?: string): void => {
    const e: EntreeJournal = { date: ctx.maintenant().toISOString(), action: 'retour-auto', cible: cfg.cible, commit: courantAvant, precedent: sha, resultat, urgence: false };
    if (message !== undefined) e.message = message;
    ajouterJournal(ctx.home, e, cfg, ctx.ecrire);
  };
  const enEchec = (detail: string): FinApresActivation => {
    const m = `retour automatique en échec : la version en ligne est peut-être ${sha12} ; vérifier avec npm run deploy:local -- etat (${detail})`;
    journalRetour('echec', m);
    return new FinApresActivation(5, 'sans-retour', m);
  };

  // current a-t-il bougé depuis l'activation (retour manuel lancé entre-temps) ? Alors il n'est pas défait.
  let actuel: string | null;
  try {
    const e = lireEtat(await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], ctx.lancer));
    if (e === null) return enEchec('réponse de etat illisible');
    actuel = e.courant;
  } catch (x) {
    if (!(x instanceof Sortie)) throw x;
    return enEchec(x.message);
  }
  // WR-01 : current pointe la version d'avant : rien de ce déploiement n'est en ligne, la version en ligne est sûre.
  if (actuel === avant) {
    return new FinApresActivation(1, 'echec', `current pointe la version d'avant ${avant} : rien de ce déploiement n'est en ligne (jamais activé, ou déjà remis par un retour manuel), aucun retour nécessaire (${r.raison})`);
  }
  if (actuel !== sha) {
    return new FinApresActivation(5, 'sans-retour', `current a changé depuis l'activation (pointe ${actuel ?? 'aucun'} : retour manuel entre-temps ?) : aucun retour automatique ; vérifier avec npm run deploy:local -- etat`);
  }

  ecrire(`retour automatique vers la version en ligne avant ce déploiement : ${courantAvant}`);
  try {
    ecrire(await appelerVerbe(cfg, agent, exe, 'retour', [cfg.cible, courantAvant], ctx.lancer));
    const e = lireEtat(await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], ctx.lancer));
    if (e?.courant !== courantAvant) return enEchec(`current ne pointe pas ${courantAvant} après le retour`);
  } catch (x) {
    if (!(x instanceof Sortie)) throw x;
    return enEchec(x.message);
  }
  journalRetour('succes');
  return new FinApresActivation(4, 'retour-auto', `déploiement en échec après l'activation (${r.raison}) : version d'avant ${courantAvant} remise en ligne`);
}
