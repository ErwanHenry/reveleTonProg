// CLI `npm run migrate -- --check|--write` : aucune règle ici, tout passe par content-core.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SchemaLoadError, checkSchemas } from '../src/lib/content-core/ajv.ts';
import { formatGithub, formatText } from '../src/lib/content-core/diagnostics.ts';
import type { Diagnostic } from '../src/lib/content-core/diagnostics.ts';
import { loadAll } from '../src/lib/content-core/load.ts';
import { inspectVersions, runMigrations } from '../src/lib/content-core/migrate.ts';
import { resolveContentRoot, schemasDirOf } from '../src/lib/content-core/root.ts';
import { MIGRATIONS } from './migrations/index.ts';

const USAGE = `Usage : npm run migrate -- (--check | --write) [--root <dossier>] [--schemas <dossier>] [--format text|github]

  --check               signale tout fichier dont version_schema est en retard (lecture seule, code 1 si oui)
  --write               applique les migrations enregistrées, puis revalide le contenu
  --root <dossier>      racine du contenu (défaut : RTP_CONTENT_ROOT, sinon le vrai corpus « . »)
  --schemas <dossier>   dossier des schémas (défaut : schemas/)
  --format text|github  text (défaut) ou annotations GitHub Actions (10 erreurs au plus annotées)
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

let values: { check?: boolean; write?: boolean; root?: string; schemas?: string; format?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      check: { type: 'boolean' },
      write: { type: 'boolean' },
      root: { type: 'string' },
      schemas: { type: 'string' },
      format: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}

if (values.check === undefined && values.write === undefined) usageError('Un mode est obligatoire : --check ou --write');
if (values.check && values.write) usageError('--check et --write sont exclusifs');
const format = values.format ?? 'text';
if (format !== 'text' && format !== 'github') usageError(`Format inconnu : « ${format} » (attendu : text ou github)`);

const projectRoot = process.cwd();
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot);
const schemasDir = values.schemas !== undefined ? path.resolve(projectRoot, values.schemas) : schemasDirOf(projectRoot);
requireValidSchemas(schemasDir);
const rel = (p: string): string => path.relative(projectRoot, p).split(path.sep).join('/') || '.';

function print(ds: Diagnostic[]): void {
  const lines = format === 'github' ? formatGithub(ds, projectRoot) : ds.map((d) => formatText(d, projectRoot));
  for (const line of lines) console.log(line);
}
const countErrors = (ds: Diagnostic[]): number => ds.filter((d) => d.severity === 'error').length;

if (values.check) {
  const { fichiers, diagnostics } = inspectVersions(contentRoot, { schemasDir });
  print(diagnostics);
  const aJour = fichiers.filter((f) => f.etat === 'a_jour').length;
  const enRetard = fichiers.filter((f) => f.etat === 'en_retard').length;
  const enErreur = fichiers.length - aJour - enRetard;
  console.log(`migrate : ${aJour} fichier(s) à jour, ${enRetard} en retard, ${enErreur} en erreur — racine ${rel(contentRoot)}`);
  process.exit(countErrors(diagnostics) > 0 ? 1 : 0);
}

const migrated = runMigrations(contentRoot, { schemasDir, registry: MIGRATIONS, write: true });
for (const file of migrated.ecrits) console.log(`migré : ${rel(file)}`);
const validated = loadAll(contentRoot, { schemasDir });
// Le listage des fichiers alimente les deux sources : on dédoublonne pour ne rien afficher deux fois.
const seen = new Set<string>();
const all = [...migrated.diagnostics, ...validated.diagnostics].filter((d) => {
  const key = `${d.code}|${d.file}|${d.line}|${d.col}|${d.message}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
print(all);
console.log(`migrate : ${migrated.ecrits.length} fichier(s) réécrit(s), ${countErrors(all)} erreur(s) — racine ${rel(contentRoot)}`);
process.exit(countErrors(all) > 0 ? 1 : 0);
