// CLI `npm run validate` : aucune règle ici, tout passe par content-core.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SchemaLoadError, checkSchemas } from '../src/lib/content-core/ajv.ts';
import { formatGithub, formatText } from '../src/lib/content-core/diagnostics.ts';
import { loadAll } from '../src/lib/content-core/load.ts';
import { ModeInvalideError, resolveContentRoot, resolveMode, schemasDirOf } from '../src/lib/content-core/root.ts';

const USAGE = `Usage : npm run validate -- [--root <dossier>] [--schemas <dossier>] [--format text|github] [--mode preview|production]

  --root <dossier>        racine du contenu (défaut : RTP_CONTENT_ROOT, sinon le corpus fictif de test)
  --schemas <dossier>     dossier des schémas (défaut : schemas/)
  --format text|github    text (défaut) ou annotations GitHub Actions (10 erreurs au plus annotées)
  --mode preview|production  mode de validation (défaut : RTP_MODE, sinon production ; la CI force production)
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

// Schémas illisibles, invalides ou manquants : erreur de configuration (code 2), distincte des erreurs de contenu (code 1).
function requireValidSchemas(dir: string): void {
  try {
    checkSchemas(dir);
  } catch (e) {
    if (e instanceof SchemaLoadError) {
      process.stderr.write(`Schémas inutilisables : ${e.message}\n`);
      process.exit(2);
    }
    throw e;
  }
}

let values: { root?: string; schemas?: string; format?: string; mode?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { root: { type: 'string' }, schemas: { type: 'string' }, format: { type: 'string' }, mode: { type: 'string' } },
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
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot);
const schemasDir = values.schemas !== undefined ? path.resolve(projectRoot, values.schemas) : schemasDirOf(projectRoot);
requireValidSchemas(schemasDir);
const result = loadAll(contentRoot, { schemasDir, mode });

const lines = format === 'github' ? formatGithub(result.diagnostics, projectRoot) : result.diagnostics.map((d) => formatText(d, projectRoot));
for (const line of lines) console.log(line);

const errors = result.diagnostics.filter((d) => d.severity === 'error').length;
const warnings = result.diagnostics.length - errors;
const rel = path.relative(projectRoot, contentRoot).split(path.sep).join('/') || '.';
console.log(`content-core : ${result.files} fichier(s), ${errors} erreur(s), ${warnings} avertissement(s) — racine ${rel}, mode ${mode}`);
process.exit(errors > 0 ? 1 : 0);
