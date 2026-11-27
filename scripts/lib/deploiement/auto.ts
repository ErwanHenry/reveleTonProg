// Mise en ligne par la tâche planifiée : `npm run deploy:auto -- deployer <sha>` (10.3, D-04, SC-2, SC-3).
//
// Distinct de deploy:local, qui garde sa phrase de passe et sa confirmation tapée (ADR-063) : ici, aucun terminal,
// aucun agent ssh, aucune confirmation. La clé du fichier ~/.config/rtp/deploiement-auto.env est sans phrase de passe
// et lue directement par ssh (IdentityAgent=none) ; elle n'ouvre que la production, et seulement les quatre verbes de
// la commande forcée lancée avec --auto (ops/commande-deploiement.sh). La restriction est côté serveur ; ce module la
// prouve à chaque passage avant tout envoi : le verbe `etat essai` doit être refusé (code 64).
//
// Ordre :
//   1. verrou local, fichier local, Node 24, exécutables résolus, rsync 3, clé sans phrase de passe, instantané A ;
//   2. gel de l'automate (gel-auto.ts) : gels des scrutins et retenue du 10 au 15 décembre 2026 (code 7) ;
//   3. arbre propre, git fetch réussi, le commit demandé est la tête de origin/main ou en descend sans changer le site ;
//   4. reçu complet de ci:local pour ce commit exact ;
//   5. build scellée (construire.ts : worktree du commit, sandbox-exec, sans secret lisible) ;
//   6. sonde de restriction : `etat essai` refusé par la commande forcée, sinon code 6 ;
//   7. etat de la production : commit déjà en ligne, ou descendant : rien à faire ;
//   8. tout ce qui a pu changer est rejoué (gel, tête, configuration, intégrité, empreinte de la build) ;
//   9. envoi, etat, gel rejoué, activer, etat, test de fumée ; échec ou signal après activer : retour automatique vers
//      la version exacte d'avant (retourAutomatique, partagé avec deploy:local).
// Sortie : une dernière ligne `resultat=<résultat>` (liste fermée RESULTATS_DEPLOIEMENT_AUTO), masquée : ni hôte, ni
// utilisateur, ni URL, ni chemin de clé. Codes : table CODES_SORTIE_AUTO.
//
// Le processus qui tient la clé n'importe que des modules node: et des modules relatifs. ctx.construire et
// ctx.apresActivation n'existent que pour les tests : la CLI ne les expose pas.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { envDeBase, type Lanceur } from '../processus.ts';
import { cleChiffree } from './agent.ts';
import { cheminsSecrets, lireConfigAuto, type ConfigDeploiement } from './config.ts';
import { construireDeploiement, type BuildDeploiement } from './construire.ts';
import { empreinteArbre, trouverSpecial } from './empreinte.ts';
import { prendreInstantane, resoudreExecutables, verifierIntegrite, type Executables, type Instantane } from './executables.ts';
import { activationExclue, FICHIERS_DEPOT_SURVEILLES, FinApresActivation, retourAutomatique } from './deployer.ts';
import { evaluerGelAuto } from './gel-auto.ts';
import { arbrePropre, lireCheminsHorsSite, siteTouche, Sortie, teteAdmise, teteOrigine, verifierRecu, type Outils } from './gardes.ts';
import { ajouterJournal, type EntreeJournal } from './journal.ts';
import { masquer } from './masque.ts';
import { prendreVerrouDeploiement } from './retour.ts';
import { appelerVerbe, type AgentSsh, EchecVerbe, envoyer, exigerRsync3, lireEtat, varianteRsync, versionServie } from './transport.ts';

export const RESULTATS_DEPLOIEMENT_AUTO = [
  'publie',
  'deja_en_ligne',
  'etat_lu',
  'gel',
  'serveur_non_restreint',
  'deploiement_refuse',
  'smoke_echec_retour_ok',
  'smoke_echec_retour_ko',
  'verrou_pris',
  'hors_ligne',
  'config_absente',
] as const;
export type ResultatAuto = (typeof RESULTATS_DEPLOIEMENT_AUTO)[number];

export const CODES_SORTIE_AUTO: Record<ResultatAuto, number> = {
  publie: 0,
  deja_en_ligne: 0,
  etat_lu: 0,
  deploiement_refuse: 1,
  config_absente: 2,
  smoke_echec_retour_ok: 4,
  smoke_echec_retour_ko: 5,
  serveur_non_restreint: 6,
  gel: 7,
  verrou_pris: 8,
  hors_ligne: 9,
};

export interface ContexteAuto {
  lancer: Lanceur;
  maintenant: () => Date;
  home: string;
  racine: string;
  ecrire: (l: string) => void;
  /** Tests seulement : remplace construireDeploiement. */
  construire?: typeof construireDeploiement;
  /** Tests seulement : appelé juste après le verbe activer. */
  apresActivation?: () => void | Promise<void>;
}

/** Équivalent automatique de chaque garde du déploiement manuel (comparé à GARDES_DEPLOIEMENT par un test). */
export const GARDES_AUTO: readonly { etapeCi: string; auto: string }[] = [
  {
    etapeCi: "Rejouer la garde de gel au moment de l'approbation (dates de Paris, retrait d'urgence justifié)",
    auto: "evaluerGelAuto (gels des scrutins et retenue du 10 au 15 décembre 2026) au départ, rejoué après la préparation et juste avant activer avec une heure relue ; pas de retrait d'urgence en automatique",
  },
  {
    etapeCi: 'Refuser le déploiement approuvé pendant le gel',
    auto: "code 7 (gel) : rien n'est envoyé ni activé, résultat gel",
  },
  {
    etapeCi: 'Vérifier la cible et que le commit est encore la tête de main, ou que la tête ne change pas le site (approbation périmée refusée)',
    auto: "cible production imposée par lireConfigAuto ; arbre propre, git fetch réussi, teteAdmise au départ et rejouée avant l'envoi",
  },
  {
    etapeCi: "Vérifier la build téléchargée (empreinte de l'arbre, cible, commit de version.json, aucun lien)",
    auto: "après la sonde : cible de la build égale à la cible relue, trouverSpecial nul, empreinteArbre égale à celle de la build, jq sur version.json, instantané A inchangé",
  },
  {
    etapeCi: 'Envoyer la build dans incoming/<cible>/<sha>/ (rsync sans suppression ni lien symbolique)',
    auto: 'envoyer : rsync 3 exigé, -rt sans option de liens, clé directe (IdentityAgent=none)',
  },
  {
    etapeCi: "Noter la version courante avant l'activation (cible exacte d'un retour automatique)",
    auto: "etat juste après l'envoi : version d'avant notée ; réponse illisible ou version changée depuis la sonde : rien n'est activé",
  },
  {
    etapeCi: 'Activer la version (bascule atomique de current)',
    auto: "gestionnaires SIGINT, SIGTERM, SIGHUP posés, version marquée active avant l'envoi du verbe activer ; un refus net n'active rien",
  },
  {
    etapeCi: "Vérifier l'état (current pointe le commit du run)",
    auto: 'etat doit répondre courant=<sha>',
  },
  {
    etapeCi: 'Test de fumée HTTPS (version servie, en-têtes HSTS et CSP)',
    auto: "versionServie : /version.json du commit, HSTS et CSP ; RTP_URL obligatoire dans deploiement-auto.env (jamais sauté en automatique)",
  },
  {
    etapeCi: "Retour arrière automatique (une étape a échoué, ou le run a été annulé, après l'activation)",
    auto: 'retourAutomatique (exportée par deployer.ts) vers la version exacte notée avant ; code 4 si remise, 5 sinon',
  },
];

/** Étapes du déploiement manuel sans équivalent automatique, avec la raison. Aucune aujourd'hui. */
export const EXCLUSIONS_AUTO: readonly { etapeCi: string; raison: string }[] = [];

const MIN = 60_000;
const SIGNAUX = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
const NOMS_FIXES = ['git', 'bash', 'ssh', 'ssh-keygen', 'curl', 'jq', 'sandbox-exec', 'npm'];
const CI_YML = fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url));
const DIRECT: AgentSsh = { socket: null };
/**
 * Pannes réseau transitoires de ssh (code 255) : résolution de nom, route, délai, refus, coupure pendant l'échange de
 * clés ou en cours de session (WR-07). Elles donnent hors_ligne (reprise au passage suivant), jamais
 * serveur_non_restreint, qui est un arrêt définitif.
 */
const HORS_LIGNE =
  /Could not resolve hostname|Temporary failure in name resolution|Name or service not known|nodename nor servname|Network is (?:unreachable|down)|No route to host|Host is (?:down|unreachable)|Connection (?:refused|reset|closed)|timed out|kex_exchange_identification|ssh_exchange_identification|Broken pipe/i;

/** Vrai si le détail d'un échec ssh (code 255) décrit une panne réseau transitoire (hors_ligne). */
export const estHorsLigne = (detail: string): boolean => HORS_LIGNE.test(detail);
const utc = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

class FinAuto extends Error {
  readonly resultat: ResultatAuto;
  readonly journal: EntreeJournal['resultat'];
  constructor(resultat: ResultatAuto, message: string, journal: EntreeJournal['resultat'] = 'echec') {
    super(message);
    this.resultat = resultat;
    this.journal = journal;
  }
}

class Interruption extends Error {
  readonly signal: NodeJS.Signals;
  constructor(signal: NodeJS.Signals) {
    super(`signal ${signal} reçu après l'activation`);
    this.signal = signal;
  }
}

interface Session {
  cfg: ConfigDeploiement;
  exe: Executables;
  noms: string[];
  PATH: string;
  secrets: string[];
  outils: Outils;
}

/** Texte sans hôte, utilisateur, URL, adresse ni chemin de clé, de known_hosts, du mot de passe de la sonde ou du HOME. */
function proprete(texte: string, cfg: ConfigDeploiement | null, home: string): string {
  let t = texte;
  if (cfg !== null) {
    t = masquer(t, cfg);
    for (const [chemin, etiquette] of [
      [cfg.cle, '<clé>'],
      [`${cfg.cle}.pub`, '<clé>.pub'],
      [cfg.knownHosts, '<known_hosts>'],
      [cfg.fumeeMotDePasse ?? '', '<mot de passe de la sonde>'],
      [cfg.fichier, '<fichier de déploiement>'],
    ] as const) {
      if (chemin !== '') t = t.split(chemin).join(etiquette);
    }
  }
  return t.split(home).join('~');
}

const sha12 = (sha: string | null): string => (sha === null ? '' : ` sha=${sha.slice(0, 12)}`);

/**
 * Début commun au déploiement et à la lecture d'état : configuration automatique, Node 24, exécutables, rsync 3
 * (envoi seulement), clé sans phrase de passe. Toute anomalie : FinAuto config_absente.
 */
async function preparer(ctx: ContexteAuto, avecRsync: boolean): Promise<Session> {
  let cfg: ConfigDeploiement;
  try {
    cfg = lireConfigAuto(ctx.home);
  } catch (e) {
    if (e instanceof Sortie) throw new FinAuto('config_absente', e.message);
    throw e;
  }
  const verifier = (condition: boolean, message: string): void => {
    if (!condition) throw new FinAuto('config_absente', message);
  };
  verifier(process.version.startsWith('v24.'), `Node 24 exigé (version actuelle ${process.version})`);
  verifier(cfg.url !== null, 'RTP_URL doit être renseignée dans deploiement-auto.env : le test de fumée est obligatoire en automatique');
  const PATH = envDeBase().PATH ?? '';
  const noms = avecRsync ? [...NOMS_FIXES, cfg.rsync] : ['git', 'ssh', 'ssh-keygen'];
  let resolus: Executables;
  try {
    resolus = resoudreExecutables(noms, PATH);
  } catch (e) {
    if (e instanceof Sortie) throw new FinAuto('config_absente', e.message);
    throw e;
  }
  const exe: Executables = avecRsync ? { ...resolus, rsync: resolus[cfg.rsync] as { chemin: string; empreinte: string } } : resolus;
  try {
    if (avecRsync) exigerRsync3(await varianteRsync((exe.rsync as { chemin: string }).chemin, ctx.lancer));
    if (await cleChiffree(cfg.cle, exe, ctx.lancer)) {
      throw new Sortie(2, 'la clé automatique doit être sans phrase de passe ; deploy:local garde la sienne');
    }
  } catch (e) {
    if (e instanceof Sortie) throw new FinAuto('config_absente', e.message);
    throw e;
  }
  const outils: Outils = { git: (exe.git as { chemin: string }).chemin };
  if (exe.bash !== undefined) outils.bash = exe.bash.chemin;
  return { cfg, exe, noms, PATH, secrets: cheminsSecrets(cfg, ctx.home), outils };
}

/** Sonde de restriction : le verbe interdit `etat essai` doit être refusé (code 64) ; sinon FinAuto. */
async function sonder(ctx: ContexteAuto, s: Session): Promise<void> {
  try {
    await appelerVerbe(s.cfg, DIRECT, s.exe, 'etat', ['essai'], ctx.lancer);
  } catch (e) {
    if (!(e instanceof EchecVerbe)) throw e;
    if (e.codeBrut === 64) return;
    if (e.codeBrut === 255 && estHorsLigne(e.detail)) throw new FinAuto('hors_ligne', 'serveur injoignable (connexion ssh impossible) : rien n\'a été envoyé');
    throw new FinAuto('serveur_non_restreint', `le serveur n'a pas refusé le verbe interdit à la clé automatique comme attendu (code ${e.codeBrut ?? 'aucun'}) : rien n'a été envoyé`);
  }
  throw new FinAuto('serveur_non_restreint', "le serveur a répondu au verbe interdit `etat essai` : la clé automatique n'est pas restreinte (--auto), rien n'a été envoyé");
}

/** Verbe etat de la production, lu et contrôlé. */
async function etatProduction(ctx: ContexteAuto, s: Session, moment: string): Promise<string | null> {
  try {
    const ligne = await appelerVerbe(s.cfg, DIRECT, s.exe, 'etat', ['production'], ctx.lancer);
    const e = lireEtat(ligne);
    if (e === null || e.cible !== 'production') throw new FinAuto('deploiement_refuse', `réponse de etat illisible ${moment}`);
    return e.courant;
  } catch (e) {
    if (e instanceof EchecVerbe && e.codeBrut === 255 && estHorsLigne(e.detail)) throw new FinAuto('hors_ligne', 'serveur injoignable (connexion ssh impossible)');
    throw e;
  }
}

/** Lecture d'état : `courant=<sha|aucun> restreint=oui`, résultat etat_lu. */
export async function etatAuto(ctx: ContexteAuto): Promise<number> {
  let rendre: (() => void) | null = null;
  let cfg: ConfigDeploiement | null = null;
  let resultat: ResultatAuto = 'deploiement_refuse';
  const sortie = (l: string): void => ctx.ecrire(proprete(l, cfg, ctx.home));
  try {
    try {
      rendre = prendreVerrouDeploiement(ctx.home, sortie);
    } catch (e) {
      if (e instanceof Sortie) throw new FinAuto('verrou_pris', e.message);
      throw e;
    }
    const s = await preparer(ctx, false);
    cfg = s.cfg;
    await sonder(ctx, s);
    const courant = await etatProduction(ctx, s, 'à la lecture');
    sortie(`courant=${courant ?? 'aucun'} restreint=oui`);
    resultat = 'etat_lu';
  } catch (e) {
    if (e instanceof FinAuto) {
      resultat = e.resultat;
      sortie(e.message);
    } else if (e instanceof Sortie) {
      sortie(e.message);
    } else {
      sortie(e instanceof Error ? e.message : String(e));
    }
  } finally {
    if (rendre !== null) rendre();
  }
  sortie(`resultat=${resultat}`);
  return CODES_SORTIE_AUTO[resultat];
}

export async function executerDeploiementAuto(sha: string, ctx: ContexteAuto): Promise<number> {
  const debut = ctx.maintenant();
  let rendre: (() => void) | null = null;
  let cfg: ConfigDeploiement | null = null;
  let build: BuildDeploiement | null = null;
  let resultat: ResultatAuto = 'deploiement_refuse';
  let journalRes: EntreeJournal['resultat'] = 'echec';
  let message: string | undefined;
  let courantAvant: string | null = null;
  let journaliser = false;
  const sortie = (l: string): void => ctx.ecrire(proprete(l, cfg, ctx.home));

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
  for (const sig of SIGNAUX) process.on(sig, surSignal);
  const verifierArret = (): void => {
    if (signalAvant !== null) throw new FinAuto('deploiement_refuse', `interrompu par ${signalAvant} avant l'activation : rien n'a été activé`, 'refus');
  };

  try {
    // ---------- 1. verrou, configuration, outils, clé, instantané A ----------
    try {
      rendre = prendreVerrouDeploiement(ctx.home, sortie);
    } catch (e) {
      if (e instanceof Sortie) throw new FinAuto('verrou_pris', e.message);
      throw e;
    }
    const s = await preparer(ctx, true);
    const c0 = s.cfg;
    cfg = c0;
    const { exe, outils } = s;
    const surveilles = [...s.secrets, ...FICHIERS_DEPOT_SURVEILLES];
    const optionsInstantane = { racine: ctx.racine, fichiers: surveilles, executables: { noms: s.noms, path: s.PATH } };
    const instantaneA: Instantane = prendreInstantane(optionsInstantane);
    let chemins: string;
    try {
      chemins = lireCheminsHorsSite(readFileSync(CI_YML, 'utf8'));
    } catch (e) {
      throw new FinAuto('config_absente', `CHEMINS_HORS_SITE illisible dans ci.yml : ${e instanceof Error ? e.message : String(e)}`);
    }
    const git = (args: string[]) => ctx.lancer({ commande: outils.git ?? 'git', args, cwd: ctx.racine, env: envDeBase(), delaiMs: 2 * MIN, libelle: `git ${args[0] ?? ''}` });

    // ---------- 2. gel de l'automate ----------
    const gel = evaluerGelAuto(debut);
    sortie(`Gel : ${gel.gele ? 'oui, ' : 'non, '}${gel.motif}`);
    if (gel.gele) throw new FinAuto('gel', `publication retenue : ${gel.motif} ; rien n'est envoyé`);
    journaliser = true;

    // ---------- 3. arbre propre, tête de origin/main ----------
    if (!(await arbrePropre(ctx.lancer, ctx.racine, outils))) {
      throw new FinAuto('deploiement_refuse', 'arbre de travail non propre (changements ou fichiers non suivis) : rien n\'est déployé');
    }
    const existe = await git(['cat-file', '-e', `${sha}^{commit}`]);
    if (existe.code !== 0) throw new FinAuto('deploiement_refuse', `commit ${sha} inconnu du dépôt local : rien n'est déployé`);
    const origine = await teteOrigine(ctx.lancer, ctx.racine, outils);
    if (!origine.fetchOk) throw new FinAuto('deploiement_refuse', 'git fetch impossible : rien de non vérifié ne part en ligne');
    const admis = await teteAdmise(ctx.lancer, ctx.racine, sha, origine.tete, chemins, outils);
    if (!admis.ok) throw new FinAuto('deploiement_refuse', admis.motif);
    sortie(`Commit : ${sha} ; ${admis.motif}`);

    // ---------- 4. reçu de ci:local ----------
    const recu = verifierRecu(ctx.home, sha);
    if (!recu.ok) throw new FinAuto('deploiement_refuse', `reçu de ci:local : ${recu.motif} ; rien n'est déployé`);
    sortie(`Reçu de ci:local : ${recu.motif}`);

    // ---------- 5. build scellée ----------
    build = await (ctx.construire ?? construireDeploiement)({
      racine: ctx.racine,
      sha,
      cible: c0.cible,
      home: ctx.home,
      lecturesInterdites: s.secrets,
      fichiersSurveilles: surveilles,
      nomsExecutables: s.noms,
      lancer: ctx.lancer,
      ecrire: sortie,
      arret: arret.signal,
    });
    verifierArret();
    const b = build;
    verifierIntegrite(instantaneA, prendreInstantane(optionsInstantane), 'pendant la build');

    // ---------- 6. sonde de restriction ----------
    verifierArret();
    await sonder(ctx, s);
    sortie('Serveur restreint : le verbe interdit à la clé automatique est refusé (code 64)');

    // ---------- 7. version en ligne ----------
    const enLigne = await etatProduction(ctx, s, 'avant le déploiement');
    if (enLigne !== null) {
      const anc = enLigne === sha ? { code: 0 } : await git(['merge-base', '--is-ancestor', sha, enLigne]);
      if (anc.code === 0) {
        sortie(enLigne === sha ? `${sha} est déjà en ligne : rien à faire` : `la version en ligne ${enLigne} contient déjà ${sha} : rien à faire`);
        journaliser = false;
        resultat = 'deja_en_ligne';
        return CODES_SORTIE_AUTO[resultat];
      }
    }

    // ---------- 8. tout ce qui a pu changer est rejoué ----------
    verifierArret();
    verifierIntegrite(instantaneA, prendreInstantane(optionsInstantane), 'depuis le début du déploiement');
    const gelApres = evaluerGelAuto(ctx.maintenant());
    if (gelApres.gele) throw new FinAuto('gel', `gel rejoué avant l'envoi : ${gelApres.motif} ; rien n'a été envoyé`);
    const origineApres = await teteOrigine(ctx.lancer, ctx.racine, outils);
    if (!origineApres.fetchOk) throw new FinAuto('deploiement_refuse', 'git fetch impossible avant l\'envoi : rien de non vérifié ne part en ligne');
    const admise = await teteAdmise(ctx.lancer, ctx.racine, sha, origineApres.tete, chemins, outils);
    if (!admise.ok) throw new FinAuto('deploiement_refuse', admise.motif);
    let relue: ConfigDeploiement;
    try {
      relue = lireConfigAuto(ctx.home);
    } catch (e) {
      if (e instanceof Sortie) throw new FinAuto('config_absente', e.message);
      throw e;
    }
    if (relue.cible !== c0.cible || b.cible !== relue.cible) throw new FinAuto('deploiement_refuse', `cible de la build différente de la cible du déploiement (build ${b.cible}) : rien n'a été envoyé`);
    if (relue.hote !== c0.hote || relue.utilisateur !== c0.utilisateur) throw new FinAuto('deploiement_refuse', "hôte ou utilisateur modifié dans le fichier local depuis le début : rien n'a été envoyé");
    const special = trouverSpecial(b.dist);
    if (special !== null) throw new FinAuto('deploiement_refuse', `la build contient un lien symbolique ou un fichier spécial : ${special}`);
    const empreinte = empreinteArbre(b.dist);
    if (empreinte !== b.empreinte) throw new FinAuto('deploiement_refuse', `empreinte de la build modifiée depuis sa construction (${empreinte}, attendue ${b.empreinte}) : rien n'a été envoyé`);
    const v = await ctx.lancer({ commande: (exe.jq as { chemin: string }).chemin, args: ['-e', '--arg', 's', sha, '.commit == $s', 'version.json'], cwd: b.dist, env: envDeBase(), delaiMs: MIN, libelle: 'jq version.json' });
    if (v.code !== 0) throw new FinAuto('deploiement_refuse', `dist/version.json ne porte pas le commit ${sha}`);
    verifierArret();

    // ---------- 9. envoi, version d'avant, activation, vérifications ----------
    try {
      const stats = await envoyer(c0, DIRECT, exe, b.dist, c0.cible, sha, ctx.lancer);
      if (stats !== '') sortie(stats);
    } catch (e) {
      if (e instanceof Sortie) throw new FinAuto('deploiement_refuse', e.message);
      throw e;
    }
    courantAvant = await etatProduction(ctx, s, "avant l'activation");
    sortie(`Version en ligne avant l'activation : ${courantAvant ?? 'aucune'}`);
    if (courantAvant !== enLigne) {
      throw new FinAuto('deploiement_refuse', `la version en ligne a changé depuis la sonde (${enLigne ?? 'aucune'} puis ${courantAvant ?? 'aucune'}) : rien n'est activé`);
    }
    // Gel rejoué une dernière fois, juste avant activer : un envoi long ne franchit pas le début d'un gel.
    const gelAvantActiver = evaluerGelAuto(ctx.maintenant());
    if (gelAvantActiver.gele) throw new FinAuto('gel', `gel rejoué juste avant activer : ${gelAvantActiver.motif} ; rien n'est activé`);

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

    let activerEnCours: Promise<unknown> | null = null;
    try {
      const pActiver = appelerVerbe(c0, DIRECT, exe, 'activer', ['production', sha], ctx.lancer);
      activerEnCours = pActiver;
      sortie(await course(pActiver));
      if (ctx.apresActivation !== undefined) await course(Promise.resolve(ctx.apresActivation()));
      const apres = await course(etatProduction(ctx, s, "après l'activation"));
      if (apres !== sha) throw new Sortie(1, `current ne pointe pas le commit ${sha} après l'activation (pointe ${apres ?? 'aucun'})`);
      sortie(`Version active sur le serveur : ${sha} (production)`);
      const vs = await course(versionServie(c0, exe, ctx.lancer));
      if (vs.commit !== sha) throw new Sortie(1, `/version.json ne sert pas le commit ${sha} (sert ${vs.commit})`);
      if (!vs.hsts) throw new Sortie(1, "en-tête Strict-Transport-Security absent de la page d'accueil");
      if (!vs.csp) throw new Sortie(1, "en-tête Content-Security-Policy absent de la page d'accueil");
      sortie(`Version servie : ${sha} (/version.json)`);
      sortie('En-têtes Strict-Transport-Security et Content-Security-Policy présents');
    } catch (e) {
      const raison = e instanceof Interruption ? e.message : proprete(e instanceof Error ? e.message : String(e), c0, ctx.home);
      const issueActiver: unknown = activerEnCours === null ? null : await activerEnCours.then(() => null, (x: unknown) => x);
      if (activationExclue(issueActiver)) {
        throw new FinAuto('deploiement_refuse', `activation refusée, rien n'a été activé (version en ligne : ${courantAvant ?? 'aucune'}) : ${(issueActiver as EchecVerbe).message}`);
      }
      const fin = await retourAutomatique({
        o: { urgence: false },
        ctx: { ecrire: sortie, maintenant: ctx.maintenant, home: ctx.home, lancer: ctx.lancer },
        cfg: c0,
        agent: DIRECT,
        exe,
        sha,
        courantAvant,
        raison,
      });
      throw fin;
    }

    resultat = 'publie';
    journalRes = 'succes';
    sortie(`Déploiement fait et vérifié : ${sha} en ligne sur production`);
    return CODES_SORTIE_AUTO[resultat];
  } catch (e) {
    if (e instanceof FinApresActivation) {
      resultat = e.code === 4 ? 'smoke_echec_retour_ok' : e.code === 5 ? 'smoke_echec_retour_ko' : 'deploiement_refuse';
      journalRes = e.resultat;
      message = e.message;
      sortie(e.message);
    } else if (e instanceof FinAuto) {
      resultat = e.resultat;
      journalRes = e.resultat === 'gel' ? 'refus' : e.journal;
      message = e.message;
      sortie(e.message);
    } else if (e instanceof Sortie) {
      resultat = 'deploiement_refuse';
      message = e.message;
      sortie(e.message);
    } else {
      message = e instanceof Error ? e.message : String(e);
      sortie(message);
      resultat = 'deploiement_refuse';
    }
    if (signalAvant !== null && resultat !== 'publie') {
      resultat = 'deploiement_refuse';
      journalRes = 'refus';
    }
    return CODES_SORTIE_AUTO[resultat];
  } finally {
    try {
      if (build !== null) await build.nettoyer();
    } finally {
      for (const sig of SIGNAUX) process.removeListener(sig, surSignal);
      if (journaliser && cfg !== null) {
        const entree: EntreeJournal = {
          date: ctx.maintenant().toISOString(),
          action: 'deployer-auto',
          cible: cfg.cible,
          commit: sha,
          precedent: courantAvant,
          resultat: journalRes,
          urgence: false,
        };
        if (message !== undefined) entree.message = proprete(message, cfg, ctx.home);
        ajouterJournal(ctx.home, entree, cfg, sortie);
      }
      if (rendre !== null) {
        sortie(`Déploiement automatique : début ${utc(debut)}, fin ${utc(ctx.maintenant())} (UTC)`);
        rendre();
      }
      sortie(`resultat=${resultat}${sha12(sha)}`);
    }
  }
}
