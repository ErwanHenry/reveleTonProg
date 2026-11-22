// Retour arrière depuis le Mac : `npm run deploy:local -- retour [<sha>]` (phase 9.2, D-08 ; LOC-03 ; HEB-11).
//
// Remplace pour Erwan .github/workflows/rollback.yml, avec les mêmes gardes, dans le même ordre :
//   garde de gel (--urgence et --justification, mêmes règles que scripts/garde-gel.ts), cible lue dans le fichier
//   local ~/.config/rtp/deploiement.env, version vide (la précédente) ou 40 hexadécimaux minuscules, verbe
//   « retour <cible> [<sha>] » de la commande forcée, puis état relu (courant non vide, égal à la version demandée)
//   et commit servi par /version.json si RTP_URL est renseignée ; heures UTC de début et de fin affichées.
// Ce qui remplace l'approbation de l'Environment production : la phrase de passe de la clé dédiée (agent.ts, D-09),
// puis la phrase tapée « retour essai precedente » ou « retour en production <sha7> » (confirmation.ts, D-06),
// demandée après l'affichage de la cible, de la version en ligne et de la version visée.
//
// Revues de code reprises :
// - WR-02 : rollback.yml a son propre groupe de concurrence pour qu'un retour et un déploiement ne s'annulent pas.
//   Ici, l'équivalent est un verrou local commun au déploiement (plan 06) et au retour (prendreVerrouDeploiement) :
//   deux exécutions locales ne s'entremêlent pas ; le verrou flock du serveur sérialise de toute façon avec GitHub.
// - CR-02 : la garde de gel est rejouée juste après la confirmation, avec une heure relue : une confirmation tapée
//   la veille d'un gel et validée après minuit n'envoie rien.
//
// ctx.confirmer est obligatoire et sans valeur par défaut : la CLI passe toujours confirmerSurTerminal ; les tests
// passent un confirmateur factice. La répétition à blanc (--dry-run) ne contacte jamais le serveur : ni etat, ni
// agent ssh, ni curl ; elle n'écrit pas au journal.
// Codes : 0 retour fait et vérifié ; 1 garde ou vérification en échec (codes du serveur ou de ssh compris, cités
// dans le message) ; 2 usage, configuration ou verrou tenu ; 3 confirmation refusée ou clé sans phrase de passe.
// N'importe que des modules node:, des modules relatifs et scripts/garde-gel.ts (par gardes.ts).
import { envDeBase, type Lanceur } from '../processus.ts';
import { prendreVerrou, VerrouPris } from '../ci-local.ts';
import { assurerCle, ouvrirAgent, type Agent } from './agent.ts';
import { cheminsLocaux, lireConfig, type ConfigDeploiement } from './config.ts';
import { lignesEcran, phraseAttendue, type Confirmateur } from './confirmation.ts';
import { resoudreExecutables, type Executables } from './executables.ts';
import { decisionGel, Sortie } from './gardes.ts';
import { ajouterJournal, type EntreeJournal } from './journal.ts';
import { masquer } from './masque.ts';
import { appelerVerbe, lireEtat, lireRetour, versionServie } from './transport.ts';

export interface OptionsRetour {
  /** '' : version précédente ; sinon 40 hexadécimaux minuscules. */
  version: string;
  urgence: boolean;
  justification: string;
  dryRun: boolean;
}

export interface ContexteRetour {
  /** Obligatoire, sans défaut : confirmerSurTerminal dans la CLI. */
  confirmer: Confirmateur;
  lancer: Lanceur;
  maintenant: () => Date;
  home: string;
  racine: string;
  ecrire: (l: string) => void;
}

const MIN = 60_000;
/** CR-04 : temps de clé exigé avant le verbe retour (retour, puis etat : 1 min chacun, avec du jeu). */
const MARGE_RETOUR = 5 * MIN;
const SHA = /^[0-9a-f]{40}$/;
export const EXECUTABLES_RETOUR = ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'jq', 'git'];

/**
 * Verrou local commun au déploiement et au retour (WR-02, équivalent des groupes de concurrence de GitHub) :
 * ~/.cache/rtp/deploiement/.verrou. Tenu par un processus vivant : Sortie code 2 qui nomme son pid.
 */
export function prendreVerrouDeploiement(home: string, avertir: (m: string) => void = (m) => console.warn(m)): () => void {
  try {
    return prendreVerrou(cheminsLocaux(home).verrou, avertir);
  } catch (e) {
    if (e instanceof VerrouPris) throw new Sortie(2, `${e.message} : attendre la fin de l'autre déploiement ou retour`);
    throw e;
  }
}

const utc = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function sujet(ctx: ContexteRetour, exe: Executables, sha: string): Promise<string | undefined> {
  const r = await ctx.lancer({ commande: exe.git?.chemin ?? 'git', args: ['log', '-1', '--format=%s', sha], cwd: ctx.racine, env: envDeBase(), delaiMs: MIN, libelle: 'sujet du commit' });
  const s = r.code === 0 ? r.stdout.trim() : '';
  return s === '' ? 'inconnu du dépôt local' : s;
}

/** Un échec venu du serveur ou de ssh (64, 66, 255…) devient le code 1 ; son code reste cité dans le message. */
const normaliser = (code: number): number => ([1, 2, 3].includes(code) ? code : 1);

export async function executerRetour(o: OptionsRetour, ctx: ContexteRetour): Promise<number> {
  const { ecrire } = ctx;
  const debut = ctx.maintenant();
  let rendre: (() => void) | null = null;
  let agent: Agent | null = null;
  let cfg: ConfigDeploiement | null = null;
  let journaliser = false;
  let refus = false;
  let courantAvant: string | null = null;
  let nouveau: string | null = null;
  let resultat: EntreeJournal['resultat'] = 'echec';
  let message: string | undefined;
  let code = 1;

  try {
    rendre = prendreVerrouDeploiement(ctx.home, ecrire);
    cfg = lireConfig(ctx.home);
    const exe = resoudreExecutables(EXECUTABLES_RETOUR, envDeBase().PATH ?? '');
    if (o.version !== '' && !SHA.test(o.version)) {
      throw new Sortie(2, 'version : vide (version précédente) ou commit de 40 caractères hexadécimaux en minuscules attendu');
    }
    const version = o.version === '' ? null : o.version;
    journaliser = !o.dryRun;

    const gel = decisionGel(debut, o.urgence, o.justification);
    ecrire(`Garde de gel : ${gel.motif}`);
    if (!gel.ok) {
      refus = true;
      throw new Sortie(1, "retour arrière refusé par la garde de gel ; pendant un gel, seul un retrait d'urgence justifié passe (--urgence --justification \"…\", 20 caractères au moins)");
    }

    if (o.dryRun) {
      for (const l of lignesEcran({ action: 'retour', cible: cfg.cible, commit: version, gel: gel.motif })) ecrire(l);
      ecrire(`Phrase qui sera demandée : ${phraseAttendue('retour', cfg.cible, version)}`);
      ecrire('répétition à blanc : aucun contact avec le serveur (ni etat, ni agent ssh, ni retour, ni HTTPS)');
      code = 0;
      return code;
    }

    agent = await ouvrirAgent(cfg, { exe, lancer: ctx.lancer, ecrire, maintenant: () => ctx.maintenant().getTime() });
    const ligneAvant = await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], ctx.lancer);
    const avant = lireEtat(ligneAvant);
    if (avant === null || avant.cible !== cfg.cible) throw new Sortie(1, `réponse de etat illisible : ${masquer(ligneAvant, cfg)}`);
    courantAvant = avant.courant;
    // CR-04 : la clé n'attend pas la phrase de confirmation chargée.
    await agent.retirer();

    ecrire('');
    for (const l of lignesEcran({
      action: 'retour',
      cible: cfg.cible,
      commit: version,
      ...(version === null ? {} : { sujet: await sujet(ctx, exe, version) }),
      enLigne: courantAvant,
      ...(courantAvant === null ? {} : { sujetEnLigne: await sujet(ctx, exe, courantAvant) }),
      gel: gel.motif,
    })) ecrire(l);
    ecrire("Clé retirée de l'agent pendant cet écran : sa phrase de passe sera redemandée juste avant le retour.");
    await ctx.confirmer(phraseAttendue('retour', cfg.cible, version));

    // CR-02 : la garde rejouée après la confirmation, avec l'heure du moment.
    const gelApres = decisionGel(ctx.maintenant(), o.urgence, o.justification);
    if (!gelApres.ok) {
      refus = true;
      throw new Sortie(1, `garde de gel rejouée après la confirmation : ${gelApres.motif} ; rien n'a été envoyé`);
    }
    // CR-04 : clé rechargée juste avant d'écrire sur le serveur (phrase de passe tapée de nouveau).
    await assurerCle(agent, MARGE_RETOUR, 'avant le retour', ecrire);

    let ligneRetour: string;
    try {
      ligneRetour = await appelerVerbe(cfg, agent, exe, 'retour', version === null ? [cfg.cible] : [cfg.cible, version], ctx.lancer);
    } catch (e) {
      if (e instanceof Sortie) throw new Sortie(1, `retour arrière en échec : ${e.message}`);
      throw e;
    }
    if (lireRetour(ligneRetour) === null) throw new Sortie(1, `réponse de retour illisible : ${masquer(ligneRetour, cfg)}`);
    ecrire(ligneRetour);

    const ligneApres = await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], ctx.lancer);
    const apres = lireEtat(ligneApres);
    if (apres === null || apres.courant === null) throw new Sortie(1, 'état illisible ou aucune version courante après le retour arrière');
    nouveau = apres.courant;
    if (version !== null && nouveau !== version) throw new Sortie(1, `current pointe ${nouveau} au lieu de ${version}`);
    ecrire(`Version active sur le serveur : ${nouveau} (${cfg.cible})`);

    if (cfg.url === null) {
      ecrire('vérification HTTPS sautée : RTP_URL vide');
    } else {
      const v = await versionServie(cfg, exe, ctx.lancer);
      if (v.commit !== nouveau) throw new Sortie(1, `/version.json ne sert pas le commit ${nouveau} (sert ${v.commit})`);
      ecrire(`Version servie : ${nouveau} (/version.json)`);
    }
    resultat = 'succes';
    code = 0;
    return code;
  } catch (e) {
    if (!(e instanceof Sortie)) {
      message = e instanceof Error ? e.message : String(e);
      throw e;
    }
    code = normaliser(e.code);
    resultat = e.code === 3 || refus ? 'refus' : 'echec';
    message = e.message;
    ecrire(cfg === null ? e.message : masquer(e.message, cfg));
    return code;
  } finally {
    try {
      if (agent !== null) await agent.fermer();
    } finally {
      if (journaliser && cfg !== null) {
        const entree: EntreeJournal = {
          date: ctx.maintenant().toISOString(),
          action: 'retour',
          cible: cfg.cible,
          commit: nouveau ?? (o.version === '' ? null : o.version),
          precedent: courantAvant,
          resultat,
          urgence: o.urgence,
        };
        if (o.urgence) entree.justification = o.justification;
        if (message !== undefined) entree.message = message;
        ajouterJournal(ctx.home, entree, cfg, ecrire);
      }
      if (rendre !== null) {
        ecrire(`Retour arrière : début ${utc(debut)}, fin ${utc(ctx.maintenant())} (UTC)`);
        rendre();
      }
    }
  }
}
