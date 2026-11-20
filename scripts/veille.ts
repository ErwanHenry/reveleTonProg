// CLI `npm run veille` : veille des candidatures (phase 10.1).
//
//   npm run veille                      un passage (même chose que `lancer`)
//   npm run veille -- lancer [--reference <ref>] [--sans-alerte]
//   npm run veille -- etat              état du dernier passage, sans aucun secret
//
// La veille détecte et propose ; Erwan décide. Voir docs/RUNBOOK.md, section « Veille des candidatures ».
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchSafe } from './lib/fetch-safe.ts';
import type { Executer } from './lib/veille/alertes.ts';
import { dossierVeille, lireEtat, lignesEtat } from './lib/veille/etat.ts';
import { REFERENCE_PAR_DEFAUT, lancerVeille } from './lib/veille/lancer.ts';

export const URL_JEU = 'https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493';
const PLAFOND_OCTETS = 5 * 1024 * 1024;

export const SOUS_COMMANDES = ['lancer', 'etat'] as const;

const USAGE = `Usage : npm run veille -- [lancer] [--reference <ref>] [--sans-alerte]
        npm run veille -- etat

  lancer          un passage : jeu data.gouv lu, répétition à blanc dans le worktree de la veille, rapport daté,
                  alerte seulement s'il y a une sortie, une entrée, un retour ou une décision à prendre
  etat            dernier passage, dernière empreinte, dernier rapport, canaux configurés (oui ou non)
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
