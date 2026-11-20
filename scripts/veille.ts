// CLI `npm run veille` : veille des candidatures (phase 10.1).
//
//   npm run veille                      un passage (même chose que `lancer`)
//   npm run veille -- lancer [--reference <ref>] [--sans-alerte]
//   npm run veille -- etat              état du dernier passage, sans aucun secret
//   npm run veille -- decider <id-amont> décision d'Erwan sur une personne, tapée dans un terminal
//   npm run veille -- preparer          branche d'import locale (jamais poussée)
//   npm run veille -- installer | retirer   planification launchd (8 h et 19 h)
//
// La veille détecte et propose ; Erwan décide. Voir docs/RUNBOOK.md, section « Veille des candidatures ».
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchSafe } from './lib/fetch-safe.ts';
import type { Executer } from './lib/veille/alertes.ts';
import { RefusDecider, decider, ligneAmont, ouvrirTerminal } from './lib/veille/decider.ts';
import { dossierVeille, lireEtat, lignesEtat } from './lib/veille/etat.ts';
import { ArretPreparer, preparerImport } from './lib/veille/preparer.ts';
import { HEURES, LABEL, cheminJournal, cheminLanceur, cheminPlist, lanceur, plist } from './lib/veille/launchd.ts';
import { REFERENCE_PAR_DEFAUT, lancerVeille } from './lib/veille/lancer.ts';

export const URL_JEU = 'https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493';
const PLAFOND_OCTETS = 5 * 1024 * 1024;

export const SOUS_COMMANDES = ['lancer', 'etat', 'decider', 'preparer', 'installer', 'retirer'] as const;

const USAGE = `Usage : npm run veille -- [lancer] [--reference <ref>] [--sans-alerte]
        npm run veille -- etat
        npm run veille -- decider <id-amont>
        npm run veille -- preparer [--dossier-import <dossier>]
        npm run veille -- installer [--reference <ref>]
        npm run veille -- retirer

  lancer          un passage : jeu data.gouv lu, répétition à blanc dans le worktree de la veille, rapport daté,
                  alerte seulement s'il y a une sortie, une entrée, un retour ou une décision à prendre
  etat            dernier passage, dernière empreinte, dernier rapport, canaux configurés (oui ou non)
  decider         décision d'Erwan sur une personne (ligne de correspondances.yaml ou motif d'un désistement), tapée
                  dans un terminal ; refusée sans terminal ; écrite dans le worktree d'import seulement
  preparer        refusé pendant un gel ; worktree ../reveleTonProg-import sur import/statuts-AAAA-MM-JJ, import du
                  dernier jeu lu, pointeur et dates, contrôles, commits locaux ; ne pousse jamais
  installer       planification launchd à 8 h et 19 h (agent utilisateur ${LABEL}) et lanceur ; idempotent
  retirer         retire la planification et le lanceur (le dossier de données et ses rapports restent)
  --reference     référence suivie (défaut : ${REFERENCE_PAR_DEFAUT})
  --sans-alerte   aucune notification ni message (essais) ; le ping Healthchecks reste

Dossier de données : ~/.cache/rtp/veille (RTP_VEILLE_DIR pour un autre dossier). Rien n'est écrit dans le dépôt.
`;

const executer: Executer = (commande, args, options = {}) => {
  const r = spawnSync(commande, args, { cwd: options.cwd, encoding: 'utf8', timeout: options.timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error.message) : '') };
};

function usage(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

/** Racine du dépôt git commun (dossier de travail principal), quel que soit le worktree d'où la commande est lancée. */
function racineDepot(): string {
  const r = executer('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: process.cwd() });
  if (r.status !== 0) usage('veille : à lancer depuis un checkout du dépôt reveleTonProg');
  return path.dirname(r.stdout.trim());
}

const argv = process.argv.slice(2);
const sousCommande = argv[0] !== undefined && !argv[0].startsWith('--') ? argv[0] : 'lancer';
const reste = argv[0] === sousCommande ? argv.slice(1) : argv;
if (!(SOUS_COMMANDES as readonly string[]).includes(sousCommande)) usage(`veille : sous-commande « ${sousCommande.slice(0, 40)} » inconnue`);

const dossier = dossierVeille(process.env, os.homedir());

if (sousCommande === 'etat') {
  if (reste.length > 0) usage('veille etat : aucune option');
  for (const l of lignesEtat(dossier, lireEtat(dossier))) console.log(l);
  process.exit(0);
}

if (sousCommande === 'decider') {
  // Le terminal d'abord : sans lui, refus avant toute autre action (aucun agent ne répond à la place d'Erwan).
  let terminal: ReturnType<typeof ouvrirTerminal>;
  try {
    terminal = ouvrirTerminal();
  } catch (e) {
    process.stderr.write(`veille decider : ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(e instanceof RefusDecider ? e.code : 1);
  }
  try {
    if (reste.length !== 1 || reste[0]?.startsWith('--')) throw new RefusDecider(2, 'un identifiant amont attendu (celui du rapport de la veille)');
    const idAmont = reste[0] as string;
    const top = executer('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
    const branche = executer('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: process.cwd() });
    if (top.status !== 0 || branche.status !== 0) throw new RefusDecider(2, 'à lancer dans le worktree d’import');
    const racine = top.stdout.trim();
    if (path.resolve(racine) === path.resolve(racineDepot())) throw new RefusDecider(2, 'refus dans le dossier de travail principal : lancer dans le worktree d’import (npm run veille -- preparer le crée)');
    if (!branche.stdout.trim().startsWith('import/')) throw new RefusDecider(2, `branche « ${branche.stdout.trim()} » : une décision s’écrit sur une branche import/…`);
    const etat = lireEtat(dossier);
    if (etat.dernierAmont === null || !existsSync(etat.dernierAmont)) throw new RefusDecider(2, 'aucun jeu amont lu par la veille : lancer d’abord npm run veille');
    const octets = readFileSync(etat.dernierAmont);
    if (createHash('sha256').update(octets).digest('hex') !== etat.derniereEmpreinte) throw new RefusDecider(2, 'empreinte des octets amont gardés différente de l’état : refus');
    const r = decider(terminal, racine, ligneAmont(octets, idAmont));
    terminal.ecrire(`Écrit (${r.ajout}) : ${r.fichier}. Relancer npm run veille -- preparer.\n`);
    process.exit(0);
  } catch (e) {
    terminal.ecrire(`veille decider : ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(e instanceof RefusDecider ? e.code : 1);
  } finally {
    terminal.fermer();
  }
}

if (sousCommande === 'preparer') {
  let opts: { 'dossier-import'?: string };
  try {
    ({ values: opts } = parseArgs({ args: reste, options: { 'dossier-import': { type: 'string' } }, strict: true, allowPositionals: false }));
  } catch (e) {
    usage(e instanceof Error ? e.message : String(e));
  }
  try {
    const r = preparerImport(
      { dossier, depot: racineDepot(), executer, maintenant: () => new Date(), node: process.execPath, journal: (l) => console.log(l) },
      { dossierImport: opts['dossier-import'] },
    );
    process.exit(r.code);
  } catch (e) {
    process.stderr.write(`veille preparer : ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(e instanceof ArretPreparer ? e.code : 1);
  }
}

if (sousCommande === 'installer' || sousCommande === 'retirer') {
  let opts: { reference?: string } = {};
  try {
    ({ values: opts } = parseArgs({ args: reste, options: sousCommande === 'installer' ? { reference: { type: 'string' } } : {}, strict: true, allowPositionals: false }));
  } catch (e) {
    usage(e instanceof Error ? e.message : String(e));
  }
  const home = os.homedir();
  const uid = process.getuid?.() ?? 0;
  const fichierPlist = cheminPlist(home);
  // bootout échoue si l'agent n'est pas chargé : sans importance, l'étape suivante dit l'état réel.
  executer('/bin/launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
  if (sousCommande === 'retirer') {
    rmSync(fichierPlist, { force: true });
    rmSync(cheminLanceur(dossier), { force: true });
    console.log(`veille retirée : ${fichierPlist} et ${cheminLanceur(dossier)} supprimés ; rapports et état gardés dans ${dossier}`);
    process.exit(0);
  }
  const quel = (nom: string): string => {
    const r = executer('/usr/bin/which', [nom]);
    if (r.status !== 0 || r.stdout.trim() === '') usage(`veille installer : « ${nom} » introuvable dans le PATH`);
    return r.stdout.trim();
  };
  const fnm = quel('fnm');
  const gitBin = quel('git');
  const p = { dossier, depot: racineDepot(), reference: opts.reference ?? REFERENCE_PAR_DEFAUT, fnm, chemins: [path.dirname(gitBin)] };
  mkdirSync(dossier, { recursive: true, mode: 0o700 });
  writeFileSync(cheminLanceur(dossier), lanceur(p), { mode: 0o700 });
  chmodSync(cheminLanceur(dossier), 0o700);
  mkdirSync(path.dirname(fichierPlist), { recursive: true });
  writeFileSync(fichierPlist, plist(p), { mode: 0o644 });
  const r = executer('/bin/launchctl', ['bootstrap', `gui/${uid}`, fichierPlist]);
  if (r.status !== 0) {
    process.stderr.write(`veille installer : launchctl bootstrap a échoué (${r.status}) : ${r.stderr.trim()}\n`);
    process.exit(1);
  }
  console.log(`veille installée : ${LABEL}, passages à ${HEURES.map((h) => `${h} h`).join(' et ')} (heure du Mac), référence ${p.reference}`);
  console.log(`lanceur ${cheminLanceur(dossier)} ; journal ${cheminJournal(dossier)} ; essai immédiat : launchctl kickstart gui/${uid}/${LABEL}`);
  process.exit(0);
}

let values: { reference?: string; 'sans-alerte'?: boolean };
try {
  ({ values } = parseArgs({ args: reste, options: { reference: { type: 'string' }, 'sans-alerte': { type: 'boolean' } }, strict: true, allowPositionals: false }));
} catch (e) {
  usage(e instanceof Error ? e.message : String(e));
}
if (values.reference !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(values.reference)) usage('--reference : nom de référence git attendu');

const res = await lancerVeille(
  {
    dossier,
    depot: racineDepot(),
    executer,
    telecharger: async () => Buffer.from((await fetchSafe(URL_JEU, { maxOctets: PLAFOND_OCTETS, timeoutMs: 30_000 })).bytes),
    fetch: (url, init) => fetch(url, init),
    maintenant: () => new Date(),
    node: process.execPath,
    journal: (l) => console.log(l),
  },
  { reference: values.reference, sansAlerte: values['sans-alerte'] === true },
);
process.exit(res.code);
