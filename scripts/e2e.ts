// Tests navigateur : construit les deux corpus l'un après l'autre (un seul `astro build` à la fois : cache
// .astro partagé), puis lance Playwright sur chaque dist.
// Usage : node scripts/e2e.ts [--jeu m1|reel|tous] [--reutiliser] [-- <arguments playwright>]
// Se termine par e2e/relecture.spec.ts (config à part, playwright.relecture.config.ts : ni dist ni serveur de dist).
// Ne pas lancer en même temps que `npm test` dans le même dossier.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { materialiserCorpusM1, nettoyerCorpusM1 } from '../tests/helpers/corpus-m1.ts';
import { REPO_ROOT } from '../tests/helpers/validate-yaml.ts';

type Jeu = 'm1' | 'reel';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const options = sep === -1 ? argv : argv.slice(0, sep);
const argsPlaywright = sep === -1 ? [] : argv.slice(sep + 1);

const iJeu = options.indexOf('--jeu');
const choix = iJeu === -1 ? 'tous' : (options[iJeu + 1] ?? '');
if (!['m1', 'reel', 'tous'].includes(choix)) {
  console.error(`--jeu doit valoir m1, reel ou tous (reçu « ${choix} »)`);
  process.exit(2);
}
const reutiliser = options.includes('--reutiliser');
const jeux: Jeu[] = choix === 'tous' ? ['m1', 'reel'] : [choix as Jeu];

const PORTS: Record<Jeu, number> = { m1: 4173, reel: 4174 };
const BIN = (nom: string): string => path.join(REPO_ROOT, 'node_modules', '.bin', nom);

function construire(jeu: Jeu, outDir: string): boolean {
  const env: NodeJS.ProcessEnv = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' };
  delete env.RTP_DEPLOIEMENT;
  if (jeu === 'm1') {
    // Fixture en production : la phrase piège du brouillon ne doit pas y sortir.
    env.RTP_CONTENT_ROOT = materialiserCorpusM1();
    env.RTP_MODE = 'production';
  } else {
    // Vrai corpus (pas encore la racine par défaut) en preview : brouillons visibles et signalés.
    env.RTP_CONTENT_ROOT = REPO_ROOT;
    env.RTP_MODE = 'preview';
  }
  const res = spawnSync(BIN('astro'), ['build', '--outDir', outDir], { cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 180_000 });
  if (res.status !== 0) process.stderr.write(`${res.stdout ?? ''}${res.stderr ?? ''}`);
  return res.status === 0;
}

const bilan: string[] = [];
let echec = false;
try {
  mkdirSync(path.join(REPO_ROOT, 'dist-e2e'), { recursive: true });
  for (const jeu of jeux) {
    const outDir = path.join(REPO_ROOT, 'dist-e2e', jeu);
    if (!(reutiliser && existsSync(outDir)) && !construire(jeu, outDir)) {
      bilan.push(`${jeu} : ECHEC du build`);
      echec = true;
      continue;
    }
    const res = spawnSync(BIN('playwright'), ['test', ...argsPlaywright], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, E2E_DIST: outDir, E2E_PORT: String(PORTS[jeu]) },
    });
    bilan.push(`${jeu} : ${res.status === 0 ? 'OK' : 'ECHEC'}`);
    if (res.status !== 0) echec = true;
  }
  // Page locale de relecture dans un vrai navigateur : ni dist ni serveur de dist, donc une seule fois (pas une par jeu).
  // Sauté quand l'appel désigne des fichiers précis (`-- e2e/axe.spec.ts`).
  if (argsPlaywright.length === 0) {
    const res = spawnSync(BIN('playwright'), ['test', '-c', 'playwright.relecture.config.ts'], { cwd: REPO_ROOT, stdio: 'inherit' });
    bilan.push(`relecture : ${res.status === 0 ? 'OK' : 'ECHEC'}`);
    if (res.status !== 0) echec = true;
  }
} finally {
  nettoyerCorpusM1();
}
for (const l of bilan) console.log(`e2e ${l}`);
process.exit(echec ? 1 : 0);
