// CLI `npm run check-dist` (après `astro build`) : contrôle du dist, QUAL-01. Toute la logique est
// dans scripts/lib/check-dist.ts ; ici, seulement les arguments, l'affichage et le code de sortie.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { escapeData, escapeProperty, safe } from '../src/lib/content-core/diagnostics.ts';
import { ModeInvalideError, resolveContentRoot, resolveMode } from '../src/lib/content-core/root.ts';
import { cellulesAttendues, checkDist } from './lib/check-dist.ts';

const USAGE = `Usage : node scripts/check-dist.ts [--dist <dossier>] [--root <dossier>] [--mode preview|production] [--format text|github]

  --dist <dossier>        dossier construit par « astro build » (défaut : dist/)
  --root <dossier>        racine du contenu, pour le nombre de cellules attendu (défaut : RTP_CONTENT_ROOT, sinon le corpus fictif de test)
  --mode preview|production  mode du build contrôlé (défaut : RTP_MODE, sinon production)
  --format text|github    text (défaut) ou annotations GitHub Actions en plus
  RTP_DEPLOIEMENT=1 (job de déploiement) : un contact provisoire (.invalid) devient une erreur au lieu d'un avertissement.
  Code de sortie : 0 sans erreur, 1 si au moins une erreur, 2 si les arguments ou le mode sont invalides.
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

let values: { dist?: string; root?: string; mode?: string; format?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { dist: { type: 'string' }, root: { type: 'string' }, mode: { type: 'string' }, format: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'github') usageError(`Format inconnu : « ${format} » (attendu : text ou github)`);

let mode: ReturnType<typeof resolveMode>;
try {
  mode = resolveMode(values.mode, process.env);
} catch (e) {
  if (e instanceof ModeInvalideError) usageError(e.message);
  throw e;
}

const projectRoot = process.cwd();
const dist = path.resolve(projectRoot, values.dist ?? 'dist');
if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) usageError(`Dossier introuvable : ${dist} (lancer « astro build » avant, ou passer --dist)`);
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot, process.env);

const attendues = cellulesAttendues(contentRoot, projectRoot, mode);
const deploiement = process.env.RTP_DEPLOIEMENT === '1';
const constats = checkDist(dist, { mode, cellulesParTheme: attendues, deploiement });

for (const c of constats) console.log(`${c.code} ${safe(c.fichier)} : ${safe(c.message)}`);
if (format === 'github') {
  for (const c of constats.slice(0, 10)) {
    const kind = c.severite === 'erreur' ? 'error' : 'warning';
    const fichier = path.relative(projectRoot, path.join(dist, c.fichier)).split(path.sep).join('/');
    console.log(`::${kind} file=${escapeProperty(fichier)},title=${escapeProperty(c.code)}::${escapeData(c.message)}`);
  }
}

const erreurs = constats.filter((c) => c.severite === 'erreur').length;
const avertissements = constats.length - erreurs;
const rel = path.relative(projectRoot, dist).split(path.sep).join('/') || '.';
console.log(`check-dist : ${erreurs} erreur(s), ${avertissements} avertissement(s) — dist ${rel}, mode ${mode}, ${attendues.size} thème(s) attendu(s)`);
process.exit(erreurs > 0 ? 1 : 0);
