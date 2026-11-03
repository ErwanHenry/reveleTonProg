// CLI `npm run ids -- --check | --write` : verrou append-only des identifiants de candidats (REGLE-07).
import { existsSync, lstatSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatText } from '../src/lib/content-core/diagnostics.ts';
import type { Diagnostic } from '../src/lib/content-core/diagnostics.ts';
import { IDS_LOCK, ajouterIds, comparerIdsLock, lireIdsLock } from '../src/lib/content-core/ids-lock.ts';
import type { IdsLock, ProblemeIds } from '../src/lib/content-core/ids-lock.ts';
import { checkContained, listContentFiles, readContained } from '../src/lib/content-core/load.ts';
import { resolveContentRoot } from '../src/lib/content-core/root.ts';

const USAGE = `Usage : npm run ids -- (--check [--base <fichier>] | --write) [--root <dossier>]

  --check          vérifie que ids.lock couvre exactement les candidats (code 1 sinon)
  --base <fichier> avec --check : ids.lock du commit de base ; tout identifiant qu'il verrouille
                   et que le ids.lock courant ne contient plus est refusé (ajout seul, REGLE-07)
  --write          ajoute au verrou les nouveaux identifiants de candidats (jamais de retrait)
  --root <dossier> racine du contenu (défaut : RTP_CONTENT_ROOT, sinon le corpus fictif de test)
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

let values: { root?: string; check?: boolean; write?: boolean; base?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { root: { type: 'string' }, check: { type: 'boolean' }, write: { type: 'boolean' }, base: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}
if (values.check === values.write) usageError(values.check ? 'Choisir --check ou --write, pas les deux' : 'Choisir --check ou --write');
if (values.base !== undefined && !values.check) usageError('--base ne s\'utilise qu\'avec --check');

const projectRoot = process.cwd();
const basePath = values.base !== undefined ? path.resolve(projectRoot, values.base) : undefined;
if (basePath !== undefined && !(existsSync(basePath) && statSync(basePath).isFile())) {
  usageError(`--base : fichier introuvable (${values.base})`);
}
const contentRoot = values.root !== undefined ? path.resolve(projectRoot, values.root) : resolveContentRoot(projectRoot);
const rel = path.relative(projectRoot, contentRoot).split(path.sep).join('/') || '.';
const lockPath = path.join(contentRoot, IDS_LOCK);

const print = (d: Diagnostic): void => console.log(formatText(d, projectRoot));
const fail = (diagnostics: Diagnostic[]): never => {
  for (const d of diagnostics) print(d);
  process.exit(1);
};
const diagOf = (p: ProblemeIds, file: string): Diagnostic => ({ code: p.code, severity: 'error', file, line: p.ligne, col: 1, pointer: '', message: p.message });

const listed = listContentFiles(contentRoot);
if (listed.diagnostics.length > 0) fail(listed.diagnostics);
const candidats = listed.files.filter((f) => f.collection === 'candidats');
const fichierDe = new Map(candidats.map((f) => [f.id, f.file]));
const ids = candidats.map((f) => f.id);

// Le verrou est lu avec les mêmes garde-fous que le contenu : ni lien symbolique, ni hors racine.
function lireLock(): IdsLock | undefined {
  try {
    lstatSync(lockPath);
  } catch {
    return undefined;
  }
  const read = readContained(contentRoot, lockPath);
  if ('diagnostic' in read) return fail([read.diagnostic]);
  return lireIdsLock(read.text);
}

const lock = lireLock();

if (values.check) {
  const problemes = comparerIdsLock(lock, ids);
  for (const p of problemes) print(diagOf(p, p.code === 'ID_NON_VERROUILLE' && p.id !== undefined ? (fichierDe.get(p.id) ?? lockPath) : lockPath));
  if (basePath !== undefined) {
    // Ajout seul contre le commit de base : retirer une ligne d'ids.lock en même temps que le
    // fichier candidat passerait la vérification locale, pas celle-ci.
    const base = lireIdsLock(readFileSync(basePath, 'utf8'));
    const courants = new Set(lock?.ids ?? []);
    for (const id of base.ids) {
      if (courants.has(id)) continue;
      const retire: ProblemeIds = {
        code: 'ID_VERROUILLE_DISPARU',
        ligne: base.lignes.get(id) ?? 1,
        id,
        message: `identifiant « ${id} » retiré de ids.lock depuis la base : interdit`,
      };
      problemes.push(retire);
      print(diagOf(retire, basePath));
    }
  }
  console.log(`ids : ${ids.length} candidat(s), ${lock?.ids.length ?? 0} verrouillé(s), ${problemes.length} problème(s) — racine ${rel}`);
  process.exit(problemes.length > 0 ? 1 : 0);
}

const res = ajouterIds(lock, ids);
if ('refus' in res) {
  for (const p of res.refus) print(diagOf(p, lockPath));
  console.log(`ids : écriture refusée, ${IDS_LOCK} inchangé — racine ${rel}`);
  process.exit(1);
}
if (lock !== undefined && res.ajoutes.length === 0) {
  console.log(`ids : 0 id(s) ajouté(s) — racine ${rel}`);
  process.exit(0);
}
// Écriture atomique : fichier temporaire dans le même dossier, puis renommage.
const tmp = path.join(contentRoot, `${IDS_LOCK}.tmp-${process.pid}`);
try {
  writeFileSync(tmp, res.texte, { flag: 'wx' });
  if (lock !== undefined) {
    const d = checkContained(contentRoot, lockPath);
    if (d) {
      unlinkSync(tmp);
      fail([d]);
    }
  }
  renameSync(tmp, lockPath);
} catch (e) {
  try {
    unlinkSync(tmp);
  } catch {
    // déjà absent
  }
  process.stderr.write(`ids : écriture impossible (${e instanceof Error ? e.message : String(e)})\n`);
  process.exit(1);
}
console.log(`ids : ${res.ajoutes.length} id(s) ajouté(s) — racine ${rel}`);
process.exit(0);
