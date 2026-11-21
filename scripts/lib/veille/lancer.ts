// Veille des candidatures (phase 10.1) : un passage de la veille.
//
// Ce qu'un passage fait, dans l'ordre : verrou ; worktree détaché de la veille aligné sur la référence suivie
// (origin/main par défaut) ; téléchargement du jeu data.gouv par fetchSafe ; octets gardés sous amont/<sha256>.json ;
// si l'empreinte est déjà connue, rien d'autre (ni rapport, ni alerte) ; sinon répétition à blanc
// (`import-datagouv --dry-run --format json --file`) DANS le worktree de la veille, classement, rapport daté, alerte
// si quelque chose est à décider ou à relire. Ping Healthchecks de succès ou de panne.
//
// Ce qu'un passage ne fait jamais : écrire dans le dossier de travail d'Erwan ou dans un worktree de session, créer
// une branche, pousser, ouvrir une pull request, décider quoi que ce soit sur une personne.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prendreVerrou } from '../ci-local.ts';
import type { EntreeRapport, MotifADecider } from '../rapport-import.ts';
import { SERVICES, envoyerTelegram, lireSecret, masquer, notifierMac, pingHealthchecks, texteAlerte } from './alertes.ts';
import type { Executer, Fetch } from './alertes.ts';
import { classerVeille, comptesVeille, detailsLocauxMarkdown, resumeVeilleMarkdown } from './classer.ts';
import { dossierAmont, dossierArbre, dossierRapports, dossierVerrou, ecrireEtat, ecrirePrive, lireEtat } from './etat.ts';
import type { EtatVeille } from './etat.ts';

export const REFERENCE_PAR_DEFAUT = 'origin/main';

export interface DependancesLancer {
  dossier: string;
  /** Racine d'un checkout du dépôt (n'importe lequel : seul son dépôt git commun sert, en lecture et pour le worktree). */
  depot: string;
  executer: Executer;
  telecharger: () => Promise<Buffer>;
  fetch: Fetch;
  maintenant: () => Date;
  /** Exécutable node utilisé pour la répétition à blanc (process.execPath). */
  node: string;
  journal: (ligne: string) => void;
  lireSecret?: (service: string) => string | null;
  /** Pause avant le second essai Telegram (tests : immédiate). */
  pause?: (ms: number) => Promise<void>;
}

export interface OptionsLancer {
  reference?: string;
  /** Aucune alerte (essais) ; le ping Healthchecks reste. */
  sansAlerte?: boolean;
}

export interface ResultatLancer {
  code: 0 | 1;
  passage: 'nouveau' | 'deja_vu' | 'panne';
  rapport: string | null;
  notable: boolean;
}

class PanneVeille extends Error {}

function git(d: DependancesLancer, args: string[], cwd?: string): string {
  const r = d.executer('git', args, { cwd: cwd ?? d.depot, timeoutMs: 120_000 });
  if (r.status !== 0) throw new PanneVeille(`git ${args[0]} a échoué (${r.status}) : ${r.stderr.trim().split('\n').slice(-1)[0] ?? ''}`);
  return r.stdout.trim();
}

/** Worktree détaché propre à la veille, aligné sur la référence ; refuse s'il a été modifié à la main. */
function preparerArbre(d: DependancesLancer, reference: string): { arbre: string; commit: string } {
  const arbre = dossierArbre(d.dossier);
  git(d, ['fetch', '--quiet', 'origin']);
  const commit = git(d, ['rev-parse', '--verify', `${reference}^{commit}`]);
  if (!existsSync(path.join(arbre, '.git'))) {
    git(d, ['worktree', 'add', '--detach', '--quiet', arbre, commit]);
  } else {
    if (git(d, ['status', '--porcelain', '--untracked-files=normal'], arbre) !== '') {
      throw new PanneVeille(`le worktree de la veille (${arbre}) contient des modifications : la veille ne l'écrase pas ; le remettre à zéro à la main (RUNBOOK)`);
    }
    git(d, ['checkout', '--quiet', '--detach', commit], arbre);
  }
  // Dépendances : npm ci seulement si le lockfile a changé depuis la dernière installation dans ce worktree.
  const lock = createHash('sha256').update(readFileSync(path.join(arbre, 'package-lock.json'))).digest('hex');
  const marque = path.join(d.dossier, 'arbre-lock.sha256');
  const installe = existsSync(marque) ? readFileSync(marque, 'utf8').trim() : '';
  if (installe !== lock || !existsSync(path.join(arbre, 'node_modules'))) {
    const r = d.executer('npm', ['ci', '--no-audit', '--no-fund', '--silent'], { cwd: arbre, timeoutMs: 600_000 });
    if (r.status !== 0) throw new PanneVeille(`npm ci a échoué dans le worktree de la veille (${r.status})`);
    ecrirePrive(marque, `${lock}\n`);
  }
  return { arbre, commit };
}

/** `statut_detail` par identifiant amont (texte amont non relu, rapport local seulement). */
function detailsAmont(octets: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const j = JSON.parse(octets.toString('utf8')) as { candidats?: { id?: unknown; statut_detail?: unknown }[] };
    for (const c of j.candidats ?? []) if (typeof c.id === 'string' && typeof c.statut_detail === 'string') out[c.id] = c.statut_detail.slice(0, 500);
  } catch {
    // jeu illisible : la répétition à blanc le dira
  }
  return out;
}

const horodatage = (t: Date): string => {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t);
  const v = (k: string): string => p.find((x) => x.type === k)?.value ?? '00';
  return `${v('year')}-${v('month')}-${v('day')}-${v('hour')}${v('minute')}`;
};

export async function lancerVeille(d: DependancesLancer, o: OptionsLancer = {}): Promise<ResultatLancer> {
  const reference = o.reference ?? REFERENCE_PAR_DEFAUT;
  const secret = d.lireSecret ?? ((s: string) => lireSecret(s, d.executer));
  const hc = secret(SERVICES.healthchecks);
  const jeton = secret(SERVICES.telegramJeton);
  const conversation = secret(SERVICES.telegramConversation);
  const secrets = [hc, jeton, conversation];
  const etat: EtatVeille = lireEtat(d.dossier);
  etat.canaux = { telegram: jeton !== null && conversation !== null, healthchecks: hc !== null };
  etat.dernierPassage = d.maintenant().toISOString();

  const rendre = prendreVerrou(dossierVerrou(d.dossier), (m) => d.journal(m));
  try {
    const { arbre, commit } = preparerArbre(d, reference);
    const octets = await d.telecharger();
    const sha = createHash('sha256').update(octets).digest('hex');
    const amont = path.join(dossierAmont(d.dossier), `${sha}.json`);
    if (!existsSync(amont)) ecrirePrive(amont, octets);

    if (sha === etat.derniereEmpreinte) {
      etat.dernierCode = 'deja_vu';
      etat.derniereErreur = null;
      d.journal(`veille : jeu amont déjà vu (${sha.slice(0, 12)}), aucun rapport, aucune alerte`);
      if (hc !== null) {
        const e = await pingHealthchecks(hc, false, d.fetch);
        if (e !== null) etat.incidentAlerte = masquer(e, secrets);
      }
      ecrireEtat(d.dossier, etat);
      return { code: 0, passage: 'deja_vu', rapport: etat.dernierRapport, notable: false };
    }

    const r = d.executer(d.node, ['scripts/import-datagouv.ts', '--dry-run', '--format', 'json', '--file', amont, '--root', arbre], { cwd: arbre, timeoutMs: 300_000 });
    let sortie: { version: number; entree: EntreeRapport; motifsADecider: MotifADecider[]; markdown: string };
    try {
      sortie = JSON.parse(r.stdout) as typeof sortie;
    } catch {
      throw new PanneVeille(`répétition à blanc illisible (code ${r.status}) : ${r.stderr.trim().split('\n').slice(-1)[0] ?? ''}`);
    }
    if (sortie.version !== 1) throw new PanneVeille(`répétition à blanc : version de sortie ${String(sortie.version)} inconnue`);

    const classement = classerVeille(sortie.entree);
    const comptes = comptesVeille(classement);
    const entete = [
      `<!-- veille ${etat.dernierPassage} ; référence ${reference} ${commit} ; amont ${sha} -->`,
      '',
      `Calculé le ${etat.dernierPassage} sur ${reference} (${commit.slice(0, 12)}).${r.status !== 0 ? ` La répétition à blanc a signalé un problème (code ${r.status}) : voir « Conflits » ci-dessous.` : ''}`,
      '',
      '',
    ].join('\n');
    const texte = `${entete}${resumeVeilleMarkdown(classement)}\n${sortie.markdown}\n${detailsLocauxMarkdown(classement, detailsAmont(octets))}`;
    const rapport = path.join(dossierRapports(d.dossier), `${horodatage(d.maintenant())}-${sha.slice(0, 12)}.md`);
    ecrirePrive(rapport, texte);

    etat.dernierCode = 'nouveau';
    etat.derniereErreur = null;
    etat.derniereEmpreinte = sha;
    etat.dernierAmont = amont;
    etat.dernierRapport = rapport;
    etat.dernierCommit = commit;
    etat.dernierNotable = classement.notable;
    etat.dernierComptes = comptes;
    etat.incidentAlerte = null;
    d.journal(`veille : nouveau jeu amont ${sha.slice(0, 12)} ; ${comptes} ; rapport ${rapport}`);

    if (classement.notable && o.sansAlerte !== true) {
      const message = texteAlerte(comptes, rapport);
      if (!notifierMac(message, d.executer)) etat.incidentAlerte = 'notification macOS impossible';
      if (jeton !== null && conversation !== null) {
        const e = await envoyerTelegram(jeton, conversation, message, d.fetch, d.pause);
        if (e !== null) etat.incidentAlerte = masquer(e, secrets);
      }
    }
    if (hc !== null) {
      const e = await pingHealthchecks(hc, false, d.fetch);
      if (e !== null) etat.incidentAlerte = masquer(e, secrets);
    }
    ecrireEtat(d.dossier, etat);
    return { code: 0, passage: 'nouveau', rapport, notable: classement.notable };
  } catch (e) {
    const message = masquer(e instanceof Error ? e.message : String(e), secrets);
    etat.dernierCode = 'panne';
    etat.derniereErreur = message;
    d.journal(`veille : panne : ${message}`);
    if (hc !== null) await pingHealthchecks(hc, true, d.fetch, message);
    if (o.sansAlerte !== true) notifierMac(`${'Veille en panne'} : ${message}`.slice(0, 200), d.executer);
    ecrireEtat(d.dossier, etat);
    return { code: 1, passage: 'panne', rapport: null, notable: false };
  } finally {
    rendre();
  }
}
