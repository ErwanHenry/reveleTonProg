// Mise à jour autonome des statuts (phase 10.3, plan 08) : préparation d'un passage, du jeu amont gardé par la veille
// jusqu'à un commit LOCAL couvert par un reçu complet de ci:local. La publication (push, déploiement, reprise,
// alertes, état) est le plan 10.3-09, qui appelle `preparerPassage`.
//
// Principes :
//   - tout se fait dans le worktree dédié ~/.cache/rtp/veille/auto, jamais dans le dossier de travail d'Erwan ;
//   - chaque cas réservé arrête la préparation AVANT tout commit (sauf ci_rouge et verrou_pris, qui suivent le commit
//     et précèdent toute publication), avec un code fermé de codes-auto.ts ;
//   - rien n'est deviné : identités par règles fixes, statuts et constats de programme vérifiés par deux agents dont
//     les citations sont retrouvées par le code, écritures par gabarits, garde de périmètre sur le diff indexé ;
//   - le rapport local (noms, citations, coûts, raisons) reste hors dépôt, en 0600 ; le journal, les comptes et les
//     fiches renvoyés ne contiennent que des identifiants de fiche et des nombres.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';
import { evaluerGelAuto } from '../deploiement/gel-auto.ts';
import { prendreVerrou, VerrouPris } from '../ci-local.ts';
import { lireCheminsHorsSite, siteTouche, verifierRecu } from '../deploiement/gardes.ts';
import { dernierCommitEnLigne } from '../deploiement/journal.ts';
import { lireCorrespondances } from '../datagouv.ts';
import { envDeBase, type Lanceur } from '../processus.ts';
import { enCode } from '../rapport-import.ts';
import type { EntreeRapport, MotifADecider } from '../rapport-import.ts';
import { lireConfigAgent, verifierAvecDeuxAgents, LIBELLES_CODE } from './agent-claude.ts';
import type { CodeStatut, ConfigAgent, QuestionAgent, ResultatDouble } from './agent-claude.ts';
import type { Fetch } from './alertes.ts';
import { classerVeille, comptesVeille } from './classer.ts';
import type { ClassementVeille, Mouvement } from './classer.ts';
import { CODES_TRANSITOIRES } from './codes-auto.ts';
import type { CodeArret, CodeAuto } from './codes-auto.ts';
import { ajouterBoite, envoyerAlerteAuto, texteAlerteAuto, viderBoite } from './alertes-auto.ts';
import { ecrireEtatAuto, lireEtatAuto } from './etat-auto.ts';
import type { EtatAuto } from './etat-auto.ts';
import { ligneAmont } from './decider.ts';
import { dossierVerrou, ecrirePrive, lireEtat } from './etat.ts';
import { ID_CANDIDAT, idsPris, ligneCorrespondance } from './identite.ts';
import type { LigneCorrespondanceAuto } from './identite.ts';
import { CasesNonVerifiees, ecartsCouverture, ecrireCasesManquantes, ecrireCorrespondances, relireParAgent, synchroniserCouverture } from './ecriture-auto.ts';
import { cheminsAuto, modeAuto } from './mode-auto.ts';
import { verifierPerimetre } from './perimetre-ecriture.ts';
import { miseAJourMecanique } from './preparer.ts';
import { lireConfigPush, preparerPush, pousserAvanceRapide } from './pousser.ts';
import type { ExecuterEnv } from './pousser.ts';
import { lireDomainesInstitutions } from './type-source.ts';
import type { TexteSource } from './sources-texte.ts';

/** Au plus 6 personnes par passage : au-delà, le jeu amont est trop surprenant pour être pris sans regard humain. */
export const MAX_PERSONNES = 6;

export interface DependancesAuto {
  dossier: string;
  /** Dépôt git commun (le dossier de travail d'Erwan) : seuls son `.git` et ses refs servent, jamais son contenu. */
  depot: string;
  home: string;
  executer: ExecuterEnv;
  lancer: Lanceur;
  recupererTexte: (url: string) => Promise<TexteSource>;
  fetch: Fetch;
  maintenant: () => Date;
  node: string;
  journal: (ligne: string) => void;
  /** Injection de test (plan 09) : moyen de push. Jamais exposée par la CLI. */
  push?: () => { destination: string; env: Record<string, string>; configGit: string[] };
  /** Injection de test : appelée après l'écriture, avant la garde de périmètre. Jamais exposée par la CLI. */
  apresEcriture?: (worktree: string) => void;
}

export type Preparation =
  | { code: 'pret'; sha: string; comptes: string; fiches: string[]; rapport: string; empreinte: string }
  | { code: 'rien_a_faire'; empreinte: string }
  | { code: CodeArret; comptes: string | null; fiches: string[]; rapport: string | null; empreinte: string };

class Arret extends Error {
  readonly code: CodeArret;
  readonly fiches: string[];
  constructor(code: CodeArret, message: string, fiches: string[] = []) {
    super(message);
    this.code = code;
    this.fiches = fiches;
  }
}

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const SEPARATEUR_TEXTES = '\n\n=====\n\n';
const MIN = 60_000;

const dateParis = (t: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

interface Sortie {
  version: number;
  entree: EntreeRapport;
  motifsADecider: MotifADecider[];
  markdown: string;
}

interface Journal {
  lignes: string[];
  verdicts: string[];
  coutUsd: number;
  comptes: string | null;
  fiches: string[];
  aNettoyer: boolean;
}

/** Version en ligne : journal local à blanc, `deploy-auto etat` en mode publier. Un échec devient le code d'arrêt de même nom. */
export async function versionEnLigne(d: DependancesAuto, mode: 'a_blanc' | 'publier', worktree: string): Promise<{ ok: true; courant: string | null } | { ok: false; code: CodeArret }> {
  if (mode === 'a_blanc') return { ok: true, courant: dernierCommitEnLigne(d.home, 'production') };
  const r = d.executer(d.node, ['scripts/deploy-auto.ts', 'etat'], { cwd: worktree, timeoutMs: 600_000, env: envDeBase() });
  const sortie = `${r.stdout}\n${r.stderr}`;
  const resultat = [...sortie.matchAll(LIGNE_RESULTAT)].pop()?.[1];
  if (resultat === 'etat_lu') {
    const courant = /^courant=([0-9a-f]{40}|aucun)(?: |$)/m.exec(sortie)?.[1];
    if (courant === undefined) return { ok: false, code: 'deploiement_refuse' };
    return { ok: true, courant: courant === 'aucun' ? null : courant };
  }
  const codes: Record<string, CodeArret> = {
    gel: 'gel',
    serveur_non_restreint: 'serveur_non_restreint',
    verrou_pris: 'verrou_pris',
    hors_ligne: 'hors_ligne',
    config_absente: 'config_absente',
    smoke_echec_retour_ok: 'smoke_echec_retour_ok',
    smoke_echec_retour_ko: 'smoke_echec_retour_ko',
  };
  return { ok: false, code: codes[resultat ?? ''] ?? 'deploiement_refuse' };
}

const codeSansMotif = (apres: string): string => apres.split('/')[0] ?? apres;
const ficheValide = (id: string): string[] => (ID_CANDIDAT.test(id) ? [id] : []);

function rapportMarkdown(d: DependancesAuto, j: Journal, code: string, mode: string, empreinte: string, erreur: string | null): string {
  const out = [`# Passage automatique du ${dateParis(d.maintenant())}, jeu ${empreinte.slice(0, 12)}`, ''];
  out.push(`- mode : ${mode}`, `- code : ${code}`, `- comptes : ${j.comptes ?? 'non calculés'}`, `- fiches concernées : ${j.fiches.length > 0 ? j.fiches.join(', ') : 'aucune'}`, `- coût des agents : ${j.coutUsd.toFixed(4)} USD`);
  if (erreur !== null) out.push(`- raison : ${enCode(erreur)}`);
  out.push('', '## Déroulé', '', ...(j.lignes.length > 0 ? j.lignes.map((l) => `- ${l}`) : ['aucune étape']), '', '## Verdicts des agents (rapport local, jamais publié)', '', ...(j.verdicts.length > 0 ? j.verdicts : ['aucun']), '');
  return out.join('\n');
}

function resumeVerdict(nom: string, q: string, r: ResultatDouble): string {
  const base = `- ${q} ${enCode(nom)} : `;
  return r.ok ? `${base}confirmé ; citations ${r.citations.map((c) => enCode(c)).join(' et ')} ; coût ${r.coutUsd.toFixed(4)} USD` : `${base}refusé (${r.raison}) ; coût ${r.coutUsd.toFixed(4)} USD`;
}

export async function preparerPassage(d: DependancesAuto, p: { mode: 'a_blanc' | 'publier' }): Promise<Preparation> {
  const j: Journal = { lignes: [], verdicts: [], coutUsd: 0, comptes: null, fiches: [], aNettoyer: false };
  const etat = lireEtat(d.dossier);
  const empreinte = etat.derniereEmpreinte ?? '';
  const chemins = cheminsAuto(d.home, d.dossier);
  const note = (l: string): void => {
    j.lignes.push(l);
    d.journal(l);
  };
  const ecrireRapport = (code: string, erreur: string | null): string => {
    const f = path.join(chemins.rapports, `${dateParis(d.maintenant())}-${empreinte.slice(0, 12) || 'sans-empreinte'}.md`);
    ecrirePrive(f, rapportMarkdown(d, j, code, p.mode, empreinte, erreur));
    return f;
  };
  try {
    const r = await executerPassage(d, p, j, note, empreinte, chemins);
    if (r.code === 'rien_a_faire') return r;
    return { ...r, rapport: ecrireRapport(r.code, null) } as Preparation;
  } catch (e) {
    const code: CodeArret = e instanceof Arret ? e.code : 'controle_rouge';
    const message = e instanceof Error ? e.message : String(e);
    if (j.aNettoyer) {
      d.executer('git', ['reset', '--hard', '--quiet', 'origin/main'], { cwd: chemins.worktree, timeoutMs: 120_000 });
      d.executer('git', ['clean', '-fdq'], { cwd: chemins.worktree, timeoutMs: 120_000 });
    }
    const fiches = [...new Set([...j.fiches, ...(e instanceof Arret ? e.fiches : [])])];
    j.fiches = fiches;
    d.journal(`arrêt : ${code}`);
    let rapport: string | null = null;
    try {
      rapport = ecrireRapport(code, message);
    } catch {
      rapport = null;
    }
    return { code, comptes: j.comptes, fiches, rapport, empreinte };
  }
}

type SansRapport = Exclude<Preparation, { code: CodeArret }> | { code: 'pret'; sha: string; comptes: string; fiches: string[]; rapport: string; empreinte: string };

async function executerPassage(
  d: DependancesAuto,
  p: { mode: 'a_blanc' | 'publier' },
  j: Journal,
  note: (l: string) => void,
  empreinte: string,
  chemins: ReturnType<typeof cheminsAuto>,
): Promise<SansRapport> {
  const wt = chemins.worktree;
  const env = envDeBase();
  const gitDepot = (args: string[]): { status: number | null; stdout: string; stderr: string } => d.executer('git', args, { cwd: d.depot, timeoutMs: 120_000 });
  const gitWt = (args: string[], timeoutMs = 120_000): { status: number | null; stdout: string; stderr: string } => d.executer('git', args, { cwd: wt, timeoutMs });
  const aujourdhui = dateParis(d.maintenant());

  // (1) Octets amont gardés par la veille, empreinte revérifiée.
  const etat = lireEtat(d.dossier);
  if (etat.dernierAmont === null || etat.derniereEmpreinte === null) return { code: 'rien_a_faire', empreinte: '' };
  if (!existsSync(etat.dernierAmont)) throw new Arret('controle_rouge', 'octets amont gardés introuvables');
  const octets = readFileSync(etat.dernierAmont);
  if (sha256(octets) !== etat.derniereEmpreinte) throw new Arret('controle_rouge', "empreinte des octets amont différente de celle de l'état de la veille");
  const amont = etat.dernierAmont;

  // (2) Dépôt à jour, worktree dédié sur origin/main, dépendances installées sans scripts.
  if (gitDepot(['fetch', '--quiet', 'origin']).status !== 0) throw new Arret('hors_ligne', 'git fetch origin impossible');
  const tete = gitDepot(['rev-parse', 'origin/main']);
  if (tete.status !== 0) throw new Arret('controle_rouge', 'origin/main introuvable');
  const teteSha = tete.stdout.trim();
  if (existsSync(path.join(wt, '.git'))) {
    if (gitWt(['reset', '--hard', '--quiet', 'origin/main']).status !== 0) throw new Arret('controle_rouge', 'remise à zéro du worktree impossible');
    gitWt(['clean', '-fdq']);
  } else {
    if (existsSync(wt)) {
      gitDepot(['worktree', 'prune']);
      rmSync(wt, { recursive: true, force: true });
    }
    if (gitDepot(['worktree', 'add', '--quiet', '--detach', wt, 'origin/main']).status !== 0) throw new Arret('controle_rouge', 'création du worktree dédié impossible');
  }
  j.aNettoyer = true;
  note(`worktree dédié prêt sur origin/main (${teteSha.slice(0, 12)})`);
  const verrouNpm = sha256(readFileSync(path.join(wt, 'package-lock.json')));
  let gardeNpm = '';
  try {
    gardeNpm = readFileSync(chemins.lockNpm, 'utf8').trim();
  } catch {
    gardeNpm = '';
  }
  if (gardeNpm !== verrouNpm || !existsSync(path.join(wt, 'node_modules'))) {
    const ci = d.executer('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--silent'], { cwd: wt, timeoutMs: 10 * MIN, env });
    if (ci.status !== 0) throw new Arret('controle_rouge', 'npm ci a échoué dans le worktree dédié');
    ecrirePrive(chemins.lockNpm, `${verrouNpm}\n`);
    note('dépendances installées (npm ci sans scripts)');
  }

  // (3) Garde de version en ligne : jamais publier des changements du site qu'une autre session n'a pas déployés.
  const enLigne = await versionEnLigne(d, p.mode, wt);
  if (!enLigne.ok) throw new Arret(enLigne.code, 'version en ligne illisible');
  if (enLigne.courant === null) {
    if (p.mode === 'publier') throw new Arret('main_non_deploye', 'version en ligne inconnue : site considéré comme touché par prudence');
    note('avertissement : version en ligne inconnue (journal local sans ligne), poursuite à blanc');
  } else {
    const chemins_hors_site = lireCheminsHorsSite(readFileSync(path.join(wt, '.github', 'workflows', 'ci.yml'), 'utf8'));
    const t = await siteTouche(d.lancer, wt, enLigne.courant, teteSha, chemins_hors_site);
    if (t.touche) throw new Arret('main_non_deploye', t.raison);
  }

  // (4) Répétition à blanc de l'import, cas réservés connus avant tout calcul coûteux.
  const rb = d.executer(d.node, ['scripts/import-datagouv.ts', '--dry-run', '--format', 'json', '--file', amont, '--root', wt], { cwd: wt, timeoutMs: 5 * MIN, env });
  let sortie: Sortie;
  try {
    sortie = JSON.parse(rb.stdout) as Sortie;
  } catch {
    throw new Arret('controle_rouge', `répétition à blanc illisible (code ${String(rb.status)})`);
  }
  const entree = sortie.entree;
  const classement: ClassementVeille = classerVeille(entree);
  j.comptes = comptesVeille(classement);
  const mouvements: Mouvement[] = [];
  for (const m of [...classement.sorties, ...classement.entrees, ...classement.retours, ...classement.autres]) if (!mouvements.some((x) => x.idAmont === m.idAmont)) mouvements.push(m);
  const fichesMouvement = (m: Mouvement): string[] => ficheValide(m.id);
  if (entree.conflits.length > 0) throw new Arret('conflit_import', `${entree.conflits.length} conflit(s) signalé(s) par l'import`);
  if (entree.gardeVolume?.refus === true) throw new Arret('garde_volume', `${entree.gardeVolume.disparus} identifiant(s) disparu(s) sur ${entree.gardeVolume.precedent}`);
  if (rb.status !== 0) throw new Arret('controle_rouge', `répétition à blanc en échec (code ${String(rb.status)})`);
  const aDecider = mouvements.filter((m) => m.motifADecider).flatMap(fichesMouvement);
  if (classement.decisions.some((x) => x.genre === 'motif') || aDecider.length > 0) {
    throw new Arret('motif_a_decider', 'désistement d\'une personne connue sans motif dans la table', [...new Set([...aDecider, ...classement.decisions.filter((x) => x.genre === 'motif').flatMap((x) => ficheValide(x.id ?? ''))])]);
  }
  const mauvaisesDates = [...mouvements.filter((m) => !DATE_JOUR.test(m.date)).flatMap(fichesMouvement), ...classement.decisions.filter((x) => !DATE_JOUR.test(x.date)).map((x) => x.idAmont)];
  if (mouvements.some((m) => !DATE_JOUR.test(m.date)) || classement.decisions.some((x) => !DATE_JOUR.test(x.date))) {
    throw new Arret('date_au_mois', 'une date de statut amont n\'est pas un jour complet', mauvaisesDates.flatMap(ficheValide));
  }
  const personnes = new Set([...mouvements.map((m) => m.idAmont), ...classement.decisions.map((x) => x.idAmont)]);
  if (personnes.size > MAX_PERSONNES) throw new Arret('volume_anormal', `${personnes.size} personnes concernées (au plus ${MAX_PERSONNES})`);
  if (!classement.notable && entree.plans.every((x) => x.avant !== null)) {
    note('aucun changement de statut ni personne nouvelle : rien à faire');
    return { code: 'rien_a_faire', empreinte };
  }
  note(`jeu du ${entree.instantane.miseAJour} : ${j.comptes}`);

  // (5) Lignes de correspondances des personnes nouvelles, par règles fixes.
  const pris = idsPris(wt);
  const institutions = lireDomainesInstitutions(wt);
  const lignes: LigneCorrespondanceAuto[] = [];
  for (const x of classement.decisions.filter((y) => y.genre === 'correspondance')) {
    const r = ligneCorrespondance(ligneAmont(octets, x.idAmont) as Parameters<typeof ligneCorrespondance>[0], pris, institutions);
    if ('refus' in r) throw new Arret(r.refus, r.raison, []);
    pris.add(r.entree.id);
    lignes.push(r);
    j.fiches.push(r.entree.id);
  }
  const ficheDe = (idAmont: string, repli: string): string => lignes.find((l) => l.idAmont === idAmont)?.entree.id ?? repli;
  for (const m of mouvements) j.fiches.push(...ficheValide(ficheDe(m.idAmont, m.id)));
  j.fiches = [...new Set(j.fiches)];

  // (6) Configuration de l'agent.
  let cfg: ConfigAgent;
  try {
    cfg = lireConfigAgent(d.home, d.dossier);
  } catch {
    throw new Arret('config_absente', "configuration de l'agent absente ou refusée");
  }

  // (7) Statuts : deux agents par statut, sur le texte de la source récupéré par le code.
  const aVerifier: { m: Mouvement; code: CodeStatut; nom: string; fiche: string }[] = [];
  for (const m of mouvements) {
    const code = codeSansMotif(m.apres);
    if (!Object.hasOwn(LIBELLES_CODE, code)) throw new Arret('controle_rouge', `code de statut amont inattendu : ${code}`);
    aVerifier.push({ m, code: code as CodeStatut, nom: ligneAmont(octets, m.idAmont).nom, fiche: ficheDe(m.idAmont, m.id) });
  }
  for (const v of aVerifier) {
    const t = await d.recupererTexte(v.m.url);
    if (!t.ok) throw new Arret('source_inaccessible', `source du statut inaccessible (${t.echec})`, ficheValide(v.fiche));
    const q: QuestionAgent = { genre: 'statut', personne: v.nom, code: v.code, date: v.m.date };
    const res = await verifierAvecDeuxAgents({ cfg, question: q, texte: t.texte, lancer: d.lancer });
    j.coutUsd += res.coutUsd;
    j.verdicts.push(resumeVerdict(v.nom, `statut ${v.code} au ${v.m.date}`, res));
    if (!res.ok) throw new Arret('doute_agent', `statut non confirmé par les deux agents (${res.raison})`, ficheValide(v.fiche));
  }
  note(`${aVerifier.length} statut(s) confirmé(s) par deux agents`);

  // (8) Correspondances, (9) import réel, mises à jour mécaniques, contrôles.
  if (lignes.length > 0) ecrireCorrespondances(wt, lignes);
  const imp = d.executer(d.node, ['scripts/import-datagouv.ts', '--file', amont, '--root', wt], { cwd: wt, timeoutMs: 5 * MIN, env });
  if (imp.status !== 0) throw new Arret('controle_rouge', `import réel refusé (code ${String(imp.status)})`);
  miseAJourMecanique(wt, entree.instantane.nom, entree.instantane.miseAJour, entree.instantane.lignes);
  for (const [nom, args] of [
    ['cohérence instantané et fiches', ['scripts/import-datagouv.ts', '--check', '--root', wt]],
    ['ids.lock', ['scripts/ids.ts', '--root', wt, '--check']],
  ] as [string, string[]][]) {
    if (d.executer(d.node, args, { cwd: wt, timeoutMs: 5 * MIN, env }).status !== 0) throw new Arret('controle_rouge', `contrôle en échec : ${nom}`);
  }
  note('import écrit, contrôles de cohérence et ids.lock verts');

  // (10) Couverture : constat « programme non publié » par deux agents pour chaque personne qui entre dans le périmètre.
  const table = lireCorrespondances(lireYamlPlafonne(readFileSync(path.join(wt, 'data', 'import', 'correspondances.yaml'), 'utf8'), 'correspondances.yaml'));
  const idAmontDe = (id: string): string | null => Object.entries(table).find(([, e]) => e.id === id)?.[0] ?? null;
  const ecarts = ecartsCouverture(wt);
  const urls: Record<string, string[]> = {};
  for (const id of ecarts.aAjouter) {
    const idAmont = idAmontDe(id);
    if (idAmont === null) throw new Arret('controle_rouge', `fiche ${id} absente de la table de correspondances`, ficheValide(id));
    const l = ligneAmont(octets, idAmont) as { nom: string; source: { url: string }; liens?: Record<string, string> };
    const candidates = [l.liens?.campagne, l.liens?.parti, l.source.url].filter((u): u is string => typeof u === 'string' && u !== '');
    const textes: string[] = [];
    urls[id] = [];
    for (const u of [...new Set(candidates)]) {
      const t = await d.recupererTexte(u);
      if (!t.ok) throw new Arret('source_inaccessible', `source consultée pour le programme inaccessible (${t.echec})`, ficheValide(id));
      textes.push(t.texte);
      if (!urls[id].includes(t.url)) urls[id].push(t.url);
    }
    const res = await verifierAvecDeuxAgents({ cfg, question: { genre: 'programme', personne: l.nom }, texte: textes.join(SEPARATEUR_TEXTES), lancer: d.lancer });
    j.coutUsd += res.coutUsd;
    j.verdicts.push(resumeVerdict(l.nom, 'programme non publié', res));
    if (!res.ok) throw new Arret(res.raison === 'infirme' ? 'programme_signale' : 'doute_agent', `constat de programme non confirmé (${res.raison})`, ficheValide(id));
    j.fiches.push(id);
  }
  j.fiches = [...new Set(j.fiches)];

  // (11) Couverture et cases par gabarits, relecture par l'agent (cases d'abord, statuts ensuite).
  synchroniserCouverture(wt, urls, aujourdhui);
  let cases: { theme: string; candidat: string }[];
  try {
    cases = ecrireCasesManquantes(wt, aujourdhui, new Set(ecarts.aAjouter));
  } catch (e) {
    if (e instanceof CasesNonVerifiees) throw new Arret('controle_rouge', e.message, e.ids.flatMap(ficheValide));
    throw e;
  }
  const relecture = relireParAgent(
    wt,
    { cases, statuts: aVerifier.map((v) => ({ candidat: v.fiche, code: v.code })) },
    aujourdhui,
    d.maintenant,
  );
  if (!relecture.ok) throw new Arret('controle_rouge', `relecture refusée pour ${relecture.refus} : ${relecture.messages.slice(-1)[0] ?? ''}`);
  note(`${cases.length} case(s) écrite(s), ${relecture.relus} élément(s) relu(s) par l'agent`);

  // (12) Validation de production, garde de périmètre sur le diff indexé, puis commit.
  if (d.executer(d.node, ['scripts/validate.ts', '--root', wt, '--mode', 'production'], { cwd: wt, timeoutMs: 10 * MIN, env }).status !== 0) throw new Arret('controle_rouge', 'validation de production en échec');
  d.apresEcriture?.(wt);
  const ajout = gitWt(['add', '--all', '--', 'data', 'src/content/candidats', 'src/content/couverture', 'relecture', 'ids.lock', 'LICENSE']);
  if (ajout.status !== 0) throw new Arret('controle_rouge', 'git add impossible');
  const perimetre = verifierPerimetre(wt, (c, a, o) => d.executer(c, a, o));
  const hors = gitWt(['status', '--porcelain', '--untracked-files=all']).stdout.split('\n').filter((l) => l !== '' && !/^[AMDR] /.test(l));
  if (!perimetre.ok || hors.length > 0) {
    const raisons = perimetre.ok ? [] : perimetre.raisons.map((r) => `${r.raison} : ${r.fichier}`);
    throw new Arret('perimetre_ecriture', [...raisons, ...hors.map((l) => `hors périmètre : ${l.slice(3)}`)].join(' ; '));
  }
  const message = `import(statuts): mise à jour autonome, jeu data.gouv du ${entree.instantane.miseAJour} (${empreinte.slice(0, 12)})`;
  const commit = gitWt(['-c', 'user.name=automate reveleTonProg', '-c', 'user.email=automate@exemple.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message, '-m', j.comptes]);
  if (commit.status !== 0) throw new Arret('controle_rouge', 'git commit impossible');
  const sha = gitWt(['rev-parse', 'HEAD']).stdout.trim();
  j.aNettoyer = false;
  note(`commit local ${sha.slice(0, 12)}`);

  // (14) ci:local complet sur ce commit exact, sauf si une exécution manuelle tient le verrou.
  if (verrouTenu(chemins.verrouCi)) throw new Arret('verrou_pris', 'ci:local est déjà en cours (verrou tenu)', j.fiches);
  const ci = d.executer(d.node, ['scripts/ci-local.ts'], { cwd: wt, timeoutMs: 60 * MIN, env });
  if (ci.status === 2 && verrouTenu(chemins.verrouCi)) throw new Arret('verrou_pris', 'ci:local a trouvé le verrou tenu', j.fiches);
  if (ci.status !== 0) throw new Arret('ci_rouge', `ci:local en échec (code ${String(ci.status)})`, j.fiches);
  const recu = verifierRecu(d.home, sha);
  if (!recu.ok) throw new Arret('ci_rouge', `reçu de ci:local refusé : ${recu.motif}`, j.fiches);
  note('ci:local complet et vert sur ce commit');

  return { code: 'pret', sha, comptes: j.comptes, fiches: j.fiches, rapport: '', empreinte };
}

/** Verrou de ci:local : dossier contenant le pid d'un processus vivant. */
function verrouTenu(dossier: string): boolean {
  if (!existsSync(dossier)) return false;
  try {
    const pid = Number.parseInt(readFileSync(path.join(dossier, 'pid'), 'utf8').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Plan 10.3-09 : passage complet (mode, verrou, boîte d'envoi, reprise, préparation, poussée, déploiement, alertes).
// Aucun pingHealthchecks ici : un contrôle partagé avec la veille masquerait la panne de l'une par le succès de l'autre.
// La supervision de l'automate passe par ses alertes et par `npm run veille -- etat`.
// ---------------------------------------------------------------------------------------------------------------

export interface OptionsAuto {
  reprendre?: boolean;
  sansAlerte?: boolean;
}

export interface ResultatAuto {
  code: CodeAuto;
  /** 0 issue (ou interrupteur), 3 arrêt, 1 exception inattendue rattrapée. */
  sortie: 0 | 1 | 3;
  sha: string | null;
  rapport: string | null;
}

type PhaseAuto = EtatAuto['phase'];

/** Traduction de la ligne `resultat=` de deploy:auto : code de l'automate et phase qui en découle. */
export const SUITE_DEPLOIEMENT: Record<string, { code: CodeAuto; phase: PhaseAuto }> = {
  publie: { code: 'publie', phase: 'repos' },
  deja_en_ligne: { code: 'deja_en_ligne', phase: 'repos' },
  smoke_echec_retour_ok: { code: 'smoke_echec_retour_ok', phase: 'retenu' },
  smoke_echec_retour_ko: { code: 'smoke_echec_retour_ko', phase: 'retenu' },
  serveur_non_restreint: { code: 'serveur_non_restreint', phase: 'retenu' },
  gel: { code: 'gel', phase: 'pousse_non_deploye' },
  verrou_pris: { code: 'verrou_pris', phase: 'pousse_non_deploye' },
  hors_ligne: { code: 'hors_ligne', phase: 'pousse_non_deploye' },
  deploiement_refuse: { code: 'deploiement_refuse', phase: 'pousse_non_deploye' },
  config_absente: { code: 'config_absente', phase: 'pousse_non_deploye' },
};

/** Issues qui sont annoncées à chaque fois (une publication n'est jamais « déjà dite »). */
const TOUJOURS_ANNONCEES: readonly CodeAuto[] = ['publie', 'deja_en_ligne'];
const SHA40 = /^[0-9a-f]{40}$/;
const REPORTS_VERROU_ALERTE = 3;

interface Passage {
  d: DependancesAuto;
  o: OptionsAuto;
  etat: EtatAuto;
  mode: 'a_blanc' | 'publier';
  chemins: ReturnType<typeof cheminsAuto>;
}

const modeLisible = (m: 'a_blanc' | 'publier'): string => (m === 'publier' ? 'publication' : 'à blanc');

function sauver(p: Passage, code: CodeAuto): void {
  p.etat.dernierCode = code;
  p.etat.dernierPassage = p.d.maintenant().toISOString();
  ecrireEtatAuto(p.d.dossier, p.etat);
}

async function envoyerTexte(p: Passage, texte: string): Promise<boolean> {
  const r = await envoyerAlerteAuto(texte, { executer: p.d.executer, fetch: p.d.fetch, sansAlerte: false });
  // Telegram configuré : seul son succès compte. Non configuré : la notification macOS tient lieu d'envoi.
  return r.telegram || (r.incident === 'Telegram non configuré' && r.mac);
}

async function vider(p: Passage): Promise<void> {
  if (p.o.sansAlerte === true || p.etat.boite.length === 0) return;
  const r = await viderBoite(p.etat.boite, (t) => envoyerTexte(p, t));
  p.etat.boite = r.restantes;
}

interface ContenuAlerte {
  code: CodeAuto;
  empreinte: string | null;
  comptes?: string | null;
  sha?: string | null;
  rapport?: string | null;
  fiches?: string[];
  mode?: 'a_blanc' | 'publier';
}

/** Une même alerte (code, empreinte) n'est envoyée qu'une fois, sauf les publications. Un envoi raté va en boîte. */
async function alerter(p: Passage, a: ContenuAlerte): Promise<void> {
  if (p.o.sansAlerte === true) return;
  const dejaDit = !TOUJOURS_ANNONCEES.includes(a.code) && p.etat.derniereAlerte?.code === a.code && p.etat.derniereAlerte.empreinte === a.empreinte;
  if (dejaDit) return;
  const texte = texteAlerteAuto({ code: a.code, mode: a.mode ?? p.mode, comptes: a.comptes ?? null, sha: a.sha ?? null, rapport: a.rapport ?? null, fiches: a.fiches ?? [], home: p.d.home });
  let envoye = false;
  try {
    envoye = await envoyerTexte(p, texte);
  } catch {
    envoye = false;
  }
  if (!envoye) {
    const b = ajouterBoite(p.etat.boite, texte);
    p.etat.boite = b.boite;
    p.etat.perdues += b.perdues;
  }
  p.etat.derniereAlerte = { code: a.code, empreinte: a.empreinte };
}

function termine(p: Passage, code: CodeAuto, sortie: 0 | 3, sha: string | null, rapport: string | null): ResultatAuto {
  sauver(p, code);
  p.d.journal(`auto : ${code} (${p.mode})${sha !== null ? ` commit ${sha.slice(0, 12)}` : ''}`);
  return { code, sortie, sha, rapport };
}

/**
 * Ligne `resultat=` de deploy:auto, au format réel : `resultat=<code>` (lecture d'état) ou `resultat=<code> sha=<12 hex>`
 * (déploiement, scripts/lib/deploiement/auto.ts). Ancrée en début et en fin de ligne : rien d'autre n'est accepté.
 */
export const LIGNE_RESULTAT = /^resultat=(\w+)(?: sha=[0-9a-f]{12})?$/gm;

/**
 * Dernière ligne `resultat=` de deploy:auto ; tout autre texte devient un refus (aucune confiance dans le reste).
 * Double contrôle par le code de sortie, dans le seul sens prudent : une issue de succès (code de sortie 0 attendu,
 * `publie` ou `deja_en_ligne`) annoncée avec un autre code de sortie devient un refus, qui garde la phase
 * `pousse_non_deploye` et fait relire la version en ligne au passage suivant. Une issue d'échec est toujours crue.
 */
export function lireResultat(sortie: string, status: number | null = null): string {
  const tous = [...sortie.matchAll(LIGNE_RESULTAT)];
  const dernier = tous[tous.length - 1]?.[1] ?? '';
  if (!Object.hasOwn(SUITE_DEPLOIEMENT, dernier)) return 'deploiement_refuse';
  if (status !== null && (dernier === 'publie' || dernier === 'deja_en_ligne') && status !== 0) return 'deploiement_refuse';
  return dernier;
}

/** Applique un résultat de déploiement (ou un code d'arrêt équivalent) à l'état, alerte, et termine le passage. */
async function appliquerSuite(p: Passage, resultat: string, sha: string): Promise<ResultatAuto> {
  const suite = SUITE_DEPLOIEMENT[resultat] ?? (SUITE_DEPLOIEMENT.deploiement_refuse as { code: CodeAuto; phase: PhaseAuto });
  const e = p.etat;
  const empreinte = e.empreinteEnCours;
  p.etat.phase = suite.phase;
  if (suite.phase === 'repos') {
    e.empreinteTraitee = e.empreinteEnCours ?? e.empreinteTraitee;
    e.empreinteEnCours = null;
  }
  const contenu: ContenuAlerte = { code: suite.code, empreinte, comptes: e.comptes, sha, rapport: e.rapport, fiches: e.fiches, mode: 'publier' };
  await alerter(p, contenu);
  if (suite.phase === 'repos') e.sha = null;
  return termine(p, suite.code, suite.phase === 'repos' ? 0 : 3, sha, e.rapport);
}

/** Lance deploy:auto deployer <sha> dans le worktree dédié et applique le résultat. */
async function deployer(p: Passage, sha: string): Promise<ResultatAuto> {
  const r = p.d.executer(p.d.node, ['scripts/deploy-auto.ts', 'deployer', sha], { cwd: p.chemins.worktree, timeoutMs: 45 * MIN, env: envDeBase() });
  return appliquerSuite(p, lireResultat(`${r.stdout}\n${r.stderr}`, r.status), sha);
}

/** Reprise d'un commit poussé mais non déployé : aucun nouveau commit, aucune réécriture d'historique. */
async function reprendreDeploiement(p: Passage, gel: { gele: boolean; motif: string }): Promise<ResultatAuto> {
  const { d, etat, chemins } = p;
  const sha = etat.sha;
  if (sha === null || !SHA40.test(sha)) {
    etat.phase = 'repos';
    return termine(p, 'rien_a_faire', 0, null, etat.rapport);
  }
  if (p.mode !== 'publier') {
    d.journal(`auto : reprise du déploiement suspendue (${gel.gele ? gel.motif : "automate non activé"})`);
    await alerter(p, { code: 'gel', empreinte: etat.empreinteEnCours, comptes: etat.comptes, sha, rapport: etat.rapport, fiches: etat.fiches, mode: 'a_blanc' });
    return termine(p, 'gel', 3, sha, etat.rapport);
  }
  const git = (args: string[], cwd: string): { status: number | null; stdout: string } => d.executer('git', args, { cwd, timeoutMs: 120_000 });
  if (git(['fetch', '--quiet', 'origin'], d.depot).status !== 0) return appliquerSuite(p, 'hors_ligne', sha);
  if (git(['merge-base', '--is-ancestor', sha, 'origin/main'], d.depot).status !== 0) return refuserReprise(p, sha);
  if (!existsSync(path.join(chemins.worktree, '.git'))) {
    git(['worktree', 'prune'], d.depot);
    if (git(['worktree', 'add', '--quiet', '--detach', chemins.worktree, sha], d.depot).status !== 0) return appliquerSuite(p, 'deploiement_refuse', sha);
  }
  const enLigne = await versionEnLigne(d, 'publier', chemins.worktree);
  if (!enLigne.ok) return appliquerSuite(p, enLigne.code, sha);
  if (enLigne.courant !== null && (enLigne.courant === sha || git(['merge-base', '--is-ancestor', sha, enLigne.courant], d.depot).status === 0)) {
    return appliquerSuite(p, 'deja_en_ligne', sha);
  }
  if (git(['checkout', '--quiet', '--detach', sha], chemins.worktree).status !== 0) return appliquerSuite(p, 'deploiement_refuse', sha);
  return deployer(p, sha);
}

/** Historique d'origin/main réécrit : le commit à reprendre n'existe plus, plus aucune tentative avant `--reprendre`. */
async function refuserReprise(p: Passage, sha: string): Promise<ResultatAuto> {
  p.etat.phase = 'retenu';
  await alerter(p, { code: 'deploiement_refuse', empreinte: p.etat.empreinteEnCours, comptes: p.etat.comptes, sha, rapport: p.etat.rapport, fiches: p.etat.fiches, mode: 'publier' });
  return termine(p, 'deploiement_refuse', 3, sha, p.etat.rapport);
}

export async function executerPassageAuto(d: DependancesAuto, o: OptionsAuto = {}): Promise<ResultatAuto> {
  const gel = evaluerGelAuto(d.maintenant());
  const calcul = modeAuto({ home: d.home, dossier: d.dossier, gel });
  const chemins = cheminsAuto(d.home, d.dossier);
  const empreinteVeille = (): string | null => lireEtat(d.dossier).derniereEmpreinte;

  // (1) Interrupteur : avant toute action, sans alerte.
  if (calcul.mode === 'desactive') {
    const e = lireEtatAuto(d.dossier);
    const p0: Passage = { d, o, etat: e, mode: 'a_blanc', chemins };
    d.journal(`auto : desactive (${calcul.raison})`);
    sauver(p0, 'desactive');
    return { code: 'desactive', sortie: 0, sha: null, rapport: null };
  }
  const mode: 'a_blanc' | 'publier' = calcul.mode;

  // (2) Verrou de la veille : un seul passage à la fois.
  let rendre: () => void;
  try {
    rendre = prendreVerrou(dossierVerrou(d.dossier), (m) => d.journal(m));
  } catch (e) {
    if (!(e instanceof VerrouPris)) throw e;
    const pv: Passage = { d, o, etat: lireEtatAuto(d.dossier), mode, chemins };
    pv.etat.reportsVerrou += 1;
    if (pv.etat.reportsVerrou >= REPORTS_VERROU_ALERTE) await alerter(pv, { code: 'verrou_pris', empreinte: empreinteVeille() });
    return termine(pv, 'verrou_pris', 3, null, null);
  }
  const p: Passage = { d, o, etat: lireEtatAuto(d.dossier), mode, chemins };
  try {
    p.etat.reportsVerrou = 0;
    // (3) Boîte d'envoi : les alertes en attente partent en premier.
    await vider(p);
    // (4) --reprendre : fait retraiter le jeu courant quel que soit l'état non transitoire (repos après un passage à
    // blanc ou après un arrêt définitif, état retenu) en effaçant l'empreinte traitée. Un commit poussé mais non
    // déployé garde la priorité : sa reprise de mise en ligne passe d'abord, l'option n'y change rien.
    if (o.reprendre === true && p.etat.phase !== 'pousse_non_deploye') {
      d.journal(`auto : --reprendre (phase ${p.etat.phase}) : le jeu courant sera retraité`);
      p.etat.phase = 'repos';
      p.etat.sha = null;
      p.etat.empreinteEnCours = null;
      p.etat.empreinteTraitee = null;
      p.etat.derniereAlerte = null;
    }
    // (5) Reprise d'un commit poussé mais non déployé, ou état retenu.
    if (p.etat.phase === 'pousse_non_deploye') return await reprendreDeploiement(p, gel);
    if (p.etat.phase === 'retenu') {
      const code = p.etat.dernierCode ?? 'deploiement_refuse';
      d.journal(`auto : retenu (${code}) : examiner puis npm run veille -- auto --reprendre`);
      sauver(p, code);
      return { code, sortie: 3, sha: p.etat.sha, rapport: p.etat.rapport };
    }
    // (6) Rien de nouveau depuis la veille, ou jeu déjà traité.
    const empreinte = empreinteVeille();
    if (empreinte === null || empreinte === p.etat.empreinteTraitee) return termine(p, 'rien_a_faire', 0, null, null);

    // (7) Préparation jusqu'au commit testé.
    const prep = await preparerPassage(d, { mode });
    if (prep.code === 'rien_a_faire') {
      p.etat.empreinteTraitee = prep.empreinte || empreinte;
      return termine(p, 'rien_a_faire', 0, null, null);
    }
    if (prep.code !== 'pret') {
      await alerter(p, { code: prep.code, empreinte: prep.empreinte, comptes: prep.comptes, rapport: prep.rapport, fiches: prep.fiches });
      if (!CODES_TRANSITOIRES.includes(prep.code)) p.etat.empreinteTraitee = prep.empreinte;
      return termine(p, prep.code, 3, null, prep.rapport);
    }
    const base = { empreinte: prep.empreinte, comptes: prep.comptes, sha: prep.sha, rapport: prep.rapport, fiches: prep.fiches };
    // (8) Mode à blanc : tout est prêt, rien n'est poussé.
    if (mode === 'a_blanc') {
      const parGel = gel.gele && calcul.raison === gel.motif;
      const code: CodeAuto = parGel ? 'gel' : 'pret_a_blanc';
      await alerter(p, { ...base, code });
      if (!parGel) p.etat.empreinteTraitee = prep.empreinte;
      return termine(p, code, parGel ? 3 : 0, prep.sha, prep.rapport);
    }
    // (9) Publication : gel rejoué, moyen de poussée, avance rapide, état avant déploiement.
    const gelTardif = evaluerGelAuto(d.maintenant());
    if (gelTardif.gele) {
      await alerter(p, { ...base, code: 'gel' });
      return termine(p, 'gel', 3, prep.sha, prep.rapport);
    }
    let moyen: ReturnType<typeof preparerPush>;
    try {
      moyen = d.push?.() ?? preparerPush(lireConfigPush(d.home));
    } catch {
      await alerter(p, { ...base, code: 'config_absente' });
      return termine(p, 'config_absente', 3, prep.sha, prep.rapport);
    }
    const issue = pousserAvanceRapide({ worktree: chemins.worktree, sha: prep.sha, destination: moyen.destination, env: moyen.env, configGit: moyen.configGit, executer: d.executer });
    if (issue !== 'pousse') {
      await alerter(p, { ...base, code: issue });
      return termine(p, issue, 3, prep.sha, prep.rapport);
    }
    p.etat.phase = 'pousse_non_deploye';
    p.etat.sha = prep.sha;
    p.etat.empreinteEnCours = prep.empreinte;
    p.etat.fiches = prep.fiches;
    p.etat.comptes = prep.comptes;
    p.etat.rapport = prep.rapport;
    sauver(p, p.etat.dernierCode ?? 'rien_a_faire');
    return await deployer(p, prep.sha);
  } catch (e) {
    d.journal(`auto : exception inattendue (${e instanceof Error ? e.name : 'inconnue'})`);
    try {
      await alerter(p, { code: 'controle_rouge', empreinte: empreinteVeille() });
    } catch {
      // l'alerte ne doit pas masquer l'exception
    }
    sauver(p, 'controle_rouge');
    return { code: 'controle_rouge', sortie: 1, sha: null, rapport: null };
  } finally {
    ecrireEtatAuto(d.dossier, p.etat);
    rendre();
  }
}
