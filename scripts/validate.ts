// CLI `npm run validate` : aucune règle ici, tout passe par content-core.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatGithub, formatText } from '../src/lib/content-core/diagnostics.ts';
import { loadAll } from '../src/lib/content-core/load.ts';
import { resolveContentRoot, schemasDirOf } from '../src/lib/content-core/root.ts';

const USAGE = `Usage : npm run validate -- [--root <dossier>] [--format text|github]

  --root <dossier>      racine du contenu (défaut : RTP_CONTENT_ROOT, sinon le corpus fictif de test)
  --format text|github  text (défaut) ou annotations GitHub Actions (10 erreurs au plus annotées)
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

let values: { root?: string; format?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { root: { type: 'string' }, format: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}

const format = values.format ?? 'text';
if (format !== 'text' && format !== 'github') usageError(`Format inconnu : « ${format} » (attendu : text ou github)`);

const projectRoot = process.cwd();
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot);
const result = loadAll(contentRoot, { schemasDir: schemasDirOf(projectRoot) });

const lines = format === 'github' ? formatGithub(result.diagnostics, projectRoot) : result.diagnostics.map((d) => formatText(d, projectRoot));
for (const line of lines) console.log(line);

const errors = result.diagnostics.filter((d) => d.severity === 'error').length;
const warnings = result.diagnostics.length - errors;
const rel = path.relative(projectRoot, contentRoot).split(path.sep).join('/') || '.';
console.log(`content-core : ${result.files} fichier(s), ${errors} erreur(s), ${warnings} avertissement(s) — racine ${rel}`);
process.exit(errors > 0 ? 1 : 0);
