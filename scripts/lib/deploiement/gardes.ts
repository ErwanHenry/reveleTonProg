// Gardes qui précèdent un déploiement depuis le Mac (phase 9.2, D-04) : chacune reproduit une garde des jobs
// changements, gel et deploy de .github/workflows/ci.yml, sous forme de fonction pure ou qui n'appelle que git
// (et bash ops/site-touche.sh). Le plan 06 les enchaîne avant la build, puis rejoue le gel et la tête après la
// confirmation. Chaque appel de processus passe par le Lanceur injecté, avec envDeBase() (aucun secret transmis).
// N'importe que des modules node:, des modules relatifs et scripts/garde-gel.ts (lui-même sans dépendance npm).
import { fileURLToPath } from 'node:url';
import { evaluerGel, nettoyerJustification, type DecisionGel } from '../../garde-gel.ts';
import { lireRecu, recuValidePourDeploiement } from '../ci-local.ts';
import { envDeBase, type Lanceur } from '../processus.ts';

/** Arrêt d'une commande locale avec son code de sortie (partagé par les plans 03 à 06). */
export class Sortie extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'Sortie';
    this.code = code;
  }
}

const MIN = 60_000;
const SHA = /^[0-9a-f]{40}$/;
/** Classement du site : le script du dépôt qui exécute ce code, jamais celui de l'arbre examiné. */
export const SITE_TOUCHE = fileURLToPath(new URL('../../../ops/site-touche.sh', import.meta.url));

/**
 * WR-06 (revue de la phase 9.2) : chemins absolus de git et bash résolus et figés par l'appelant (instantané
 * d'intégrité) ; sans eux, le nom est cherché dans le PATH (tests, outils hors déploiement).
 */
export interface Outils {
  git?: string;
  bash?: string;
}

const git = (l: Lanceur, racine: string, args: string[], delaiMs = 2 * MIN, outils: Outils = {}) =>
  l({ commande: outils.git ?? 'git', args, cwd: racine, env: envDeBase(), delaiMs, libelle: `git ${args[0] ?? ''}` });

/**
 * Arbre de travail propre (D-04) : aucun changement indexé ou non, aucun fichier non suivi qui ne soit pas ignoré.
 * git en échec (dossier qui n'est pas un dépôt) : Sortie code 2.
 */
export async function arbrePropre(l: Lanceur, racine: string, outils: Outils = {}): Promise<boolean> {
  const r = await git(l, racine, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 2 * MIN, outils);
  if (r.code !== 0) throw new Sortie(2, `git status impossible dans ${racine} : ${r.stderr.trim()}`);
  return r.stdout === '';
}

/**
 * Tête de origin/main après un fetch (D-04 : rien de non poussé ne part en ligne). fetchOk false : le fetch a
 * échoué et la tête est celle connue localement (vide si inconnue) ; le plan 06 refuse alors de déployer, avant et
 * après la confirmation.
 */
export async function teteOrigine(l: Lanceur, racine: string, outils: Outils = {}): Promise<{ tete: string; fetchOk: boolean }> {
  const f = await git(l, racine, ['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'], 5 * MIN, outils);
  const r = await git(l, racine, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}'], 2 * MIN, outils);
  const tete = r.code === 0 ? r.stdout.trim() : '';
  return { tete, fetchOk: f.code === 0 };
}

/**
 * Valeur de CHEMINS_HORS_SITE lue dans le texte de ci.yml (seule source, dans l'env du workflow) sans paquet yaml :
 * une seule ligne « ··CHEMINS_HORS_SITE: "..." », sinon erreur (un test compare à l'analyse YAML).
 */
export function lireCheminsHorsSite(texte: string): string {
  const lignes = texte.split(/\r?\n/).map((ligne) => /^ {2}CHEMINS_HORS_SITE: "(.*)"$/.exec(ligne)).filter((m) => m !== null);
  if (lignes.length !== 1) {
    throw new Error(`CHEMINS_HORS_SITE : une seule ligne attendue dans ci.yml, ${lignes.length} trouvée(s)`);
  }
  return (lignes[0] as RegExpExecArray)[1] as string;
}

/**
 * Le site est-il touché entre base et tete ? Reproduit le job changements de ci.yml (IN-04) :
 * git diff --no-renames --name-only -z base tete | bash ops/site-touche.sh. Par prudence, true quand la base est
 * null (aucune version en ligne), introuvable dans l'historique local, ou n'est pas un ancêtre de la tête.
 * Un verdict autre que true ou false (liste vide, script en échec) lève une erreur.
 */
export async function siteTouche(
  l: Lanceur,
  racine: string,
  base: string | null,
  tete: string,
  chemins: string,
  outils: Outils = {},
): Promise<{ touche: boolean; raison: string; fichiers: string[] }> {
  if (base === null) return { touche: true, raison: 'aucune version en ligne connue : site considéré comme touché par prudence', fichiers: [] };
  const existe = SHA.test(base) ? await git(l, racine, ['cat-file', '-e', `${base}^{commit}`], 2 * MIN, outils) : null;
  if (existe === null || existe.code !== 0) {
    return { touche: true, raison: `version ${base} introuvable dans l'historique local : site considéré comme touché par prudence`, fichiers: [] };
  }
  const anc = await git(l, racine, ['merge-base', '--is-ancestor', base, tete], 2 * MIN, outils);
  if (anc.code !== 0) {
    return { touche: true, raison: `version ${base} n'est pas un ancêtre de ${tete} : site considéré comme touché par prudence`, fichiers: [] };
  }
  const diff = await git(l, racine, ['diff', '--no-renames', '--name-only', '-z', base, tete], 2 * MIN, outils);
  if (diff.code !== 0) throw new Error(`git diff ${base} ${tete} impossible : ${diff.stderr.trim()}`);
  const fichiers = diff.stdout.split('\0').filter((f) => f !== '');
  const r = await l({
    commande: outils.bash ?? 'bash',
    args: [SITE_TOUCHE],
    cwd: racine,
    env: { ...envDeBase(), CHEMINS_HORS_SITE: chemins },
    entree: diff.stdout,
    delaiMs: MIN,
    libelle: 'site-touche',
  });
  const verdict = r.stdout.trim();
  if (r.code !== 0 || (verdict !== 'true' && verdict !== 'false')) {
    throw new Error(`site-touche : verdict illisible (code ${String(r.code)}, sortie « ${verdict} ») ${r.stderr.trim()}`);
  }
  const touche = verdict === 'true';
  return {
    touche,
    raison: touche ? `le site change entre ${base.slice(0, 12)} et ${tete.slice(0, 12)}` : `aucun changement du site entre ${base.slice(0, 12)} et ${tete.slice(0, 12)}`,
    fichiers,
  };
}

/**
 * Règle de l'approbation périmée du job deploy de ci.yml : le commit construit doit être la tête de main, ou la
 * tête doit en descendre sans changer le site (même classement que le job changements). Le plan 06 l'applique
 * après la confirmation, la tête venant d'un nouveau fetch.
 */
export async function teteAdmise(l: Lanceur, racine: string, sha: string, tete: string, chemins: string, outils: Outils = {}): Promise<{ ok: boolean; motif: string }> {
  if (sha === tete) return { ok: true, motif: `commit ${sha}, encore la tête de main` };
  const anc = await git(l, racine, ['merge-base', '--is-ancestor', sha, tete], 2 * MIN, outils);
  if (anc.code !== 0) {
    return { ok: false, motif: `la tête de main (${tete}) ne descend pas du commit ${sha} (historique réécrit) : rien n'est déployé` };
  }
  const s = await siteTouche(l, racine, sha, tete, chemins, outils);
  if (s.touche) {
    return { ok: false, motif: `main a avancé (tête ${tete}) avec des changements du site depuis le commit ${sha} : rien n'est déployé` };
  }
  return { ok: true, motif: `tête plus récente sans changement du site : déploiement autorisé (tête ${tete}, commit ${sha})` };
}

/**
 * Garde de gel des scrutins (CR-02, rejouée après la confirmation par le plan 06) : evaluerGel de
 * scripts/garde-gel.ts, justification nettoyée (une ligne, 300 caractères) avant d'être comptée.
 */
export function decisionGel(instant: Date, urgence: boolean, justification: string): DecisionGel {
  return evaluerGel(instant, urgence, nettoyerJustification(justification));
}

/** Reçu de ci:local du commit exact (D-03) : vert, complet, d'un arbre propre. */
export function verifierRecu(home: string, sha: string): { ok: boolean; motif: string; date: string | null } {
  const recu = lireRecu(home, sha);
  if (recu === null) return { ok: false, motif: `aucun reçu de ci:local pour ${sha.slice(0, 12)}`, date: null };
  const v = recuValidePourDeploiement(recu, sha);
  return { ok: v.ok, motif: v.motif, date: recu.date };
}
