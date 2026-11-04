// CLI `npm run import:datagouv` : jeu data.gouv « statuts sourcés » (2027 et moi) -> fiches candidats.
// Instantané brut daté et haché sous data/import/, fiches sous src/content/candidats/, ids.lock complété.
// Le jeu amont est une entrée non fiable : voir scripts/lib/datagouv.ts.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { IDS_LOCK, ajouterIds, lireIdsLock } from '../src/lib/content-core/ids-lock.ts';
import type { IdsLock } from '../src/lib/content-core/ids-lock.ts';
import { formatText } from '../src/lib/content-core/diagnostics.ts';
import type { Diagnostic } from '../src/lib/content-core/diagnostics.ts';
import { checkContained, readContained, validateYamlText } from '../src/lib/content-core/load.ts';
import { ajouterStatutYaml, UnknownUpstreamIdsError, UpstreamShapeError, checkUpstream, lireCorrespondances, mapRow, mergeFiche, renderYaml, snapshotName } from './lib/datagouv.ts';
import type { UpstreamRow } from './lib/datagouv.ts';
import { FetchSafeError, fetchSafe } from './lib/fetch-safe.ts';

const URL_PAR_DEFAUT = 'https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493';
const PLAFOND_OCTETS = 5 * 1024 * 1024;
const DELAI_MS = 30_000;

const USAGE = `Usage : npm run import:datagouv -- [--file <json>] [--url <https>] [--dry-run] [--root <dossier>]

  --file <json>    lit un instantané local (hors ligne, tests) au lieu d'interroger data.gouv.fr
  --url <https>    ressource à télécharger (défaut : la ressource stable du jeu « statuts sourcés »)
  --dry-run        imprime le rapport sans rien écrire (ni instantané, ni fiche, ni ids.lock)
  --root <dossier> racine du dépôt (défaut : le dossier courant ; RTP_CONTENT_ROOT est ignorée)
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}
function fail(message: string): never {
  process.stderr.write(`import : ${message}\n`);
  process.exit(1);
}

let values: { file?: string; url?: string; 'dry-run'?: boolean; root?: string };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: { file: { type: 'string' }, url: { type: 'string' }, 'dry-run': { type: 'boolean' }, root: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}
if (values.file !== undefined && values.url !== undefined) usageError('Choisir --file ou --url, pas les deux');
const dryRun = values['dry-run'] === true;
const url = values.url ?? URL_PAR_DEFAUT;
if (values.file === undefined && (!URL.canParse(url) || new URL(url).protocol !== 'https:')) usageError('--url : URL https attendue');

const cwd = process.cwd();
const root = path.resolve(cwd, values.root ?? '.');
// Sans --root explicite, jamais d'écriture de contenu réel dans une fixture de test.
if (values.root === undefined && path.relative(cwd, root).split(path.sep).join('/').startsWith('tests/fixtures')) {
  usageError('refus : écriture dans tests/fixtures sans --root explicite');
}
const rel = path.relative(cwd, root).split(path.sep).join('/') || '.';
const importDir = path.join(root, 'data', 'import');
const contentDir = path.join(root, 'src', 'content');
const candidatsDir = path.join(contentDir, 'candidats');
const schemasDir = path.join(cwd, 'schemas');

const print = (d: Diagnostic): void => console.log(formatText(d, cwd));

// --- 1. lecture des octets bruts (fichier ou réseau) -------------------------------------------------
interface Brut {
  buffer: Buffer;
  urlInitiale: string | null;
  urlFinale: string | null;
  etag: string | null;
}

async function lireReseau(): Promise<Brut> {
  // fetchSafe : https seulement, adresses publiques seulement (redirections comprises), plafond et délai.
  try {
    const r = await fetchSafe(url, { maxOctets: PLAFOND_OCTETS, timeoutMs: DELAI_MS });
    return { buffer: Buffer.from(r.bytes), urlInitiale: url, urlFinale: r.finalUrl, etag: r.etag ?? null };
  } catch (e) {
    if (e instanceof FetchSafeError) return fail(`téléchargement refusé ou impossible (${e.code}) : ${e.message}`);
    throw e;
  }
}

function lireFichier(file: string): Brut {
  const full = path.resolve(cwd, file);
  let st;
  try {
    st = statSync(full);
  } catch (e) {
    return fail(`--file : fichier illisible (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!st.isFile()) return fail('--file : fichier régulier attendu');
  if (st.size > PLAFOND_OCTETS) return fail(`--file : fichier trop volumineux (plus de ${PLAFOND_OCTETS} octets)`);
  return { buffer: readFileSync(full), urlInitiale: null, urlFinale: null, etag: null };
}

const brut = values.file !== undefined ? lireFichier(values.file) : await lireReseau();
const sha256 = createHash('sha256').update(brut.buffer).digest('hex');

// --- 2. forme amont et table à la main -------------------------------------------------------------------
let amont: ReturnType<typeof checkUpstream>;
try {
  amont = checkUpstream(JSON.parse(brut.buffer.toString('utf8')));
} catch (e) {
  fail(e instanceof UpstreamShapeError ? `jeu amont invalide : ${e.message}` : `jeu amont illisible (${e instanceof Error ? e.message : String(e)})`);
}
for (const a of amont.avertissements) console.log(`avertissement : ${a}`);

if (!existsSync(contentDir) || !statSync(contentDir).isDirectory()) fail(`${rel === '.' ? '' : `${rel}/`}src/content introuvable : vérifier --root`);
for (const p of [path.join(root, 'src'), contentDir, candidatsDir]) {
  if (existsSync(p) && lstatSync(p).isSymbolicLink()) fail(`lien symbolique refusé : ${path.relative(cwd, p)}`);
}

const corrPath = path.join(importDir, 'correspondances.yaml');
if (lstatSync(corrPath, { throwIfNoEntry: false }) === undefined) fail(`table introuvable : data/import/correspondances.yaml (sous ${rel})`);
const corrLue = readContained(root, corrPath);
if ('diagnostic' in corrLue) fail(`${corrLue.diagnostic.message} (${corrPath})`);
let table: ReturnType<typeof lireCorrespondances>;
try {
  table = lireCorrespondances(parse(corrLue.text, { schema: 'core', uniqueKeys: true }));
} catch (e) {
  fail(`data/import/correspondances.yaml invalide : ${e instanceof Error ? e.message : String(e)}`);
}

// Les identifiants amont inconnus sont tous listés avant l'arrêt : jamais de découpage deviné.
const inconnus = amont.rows.filter((r) => !Object.hasOwn(table, r.id)).map((r) => r.id);
if (inconnus.length > 0) {
  process.stderr.write(`import : ${new UnknownUpstreamIdsError(inconnus).message}\n`);
  process.stderr.write('Ajouter une ligne à la main (prénom, nom, nom_tri, motif, type de source) puis relancer ; rien n\'a été écrit.\n');
  process.exit(1);
}

// --- 3. mapping, fusion, validation (rien n'est écrit tant que tout n'est pas bon) -------------------
interface Plan {
  row: UpstreamRow;
  id: string;
  file: string;
  action: 'cree' | 'statut_ajoute' | 'inchange';
  texte: string;
  notes: string[];
}
const plans: Plan[] = [];
const conflits: string[] = [];
let invalide = false;

for (const row of amont.rows) {
  const mapped = mapRow(row, table);
  const id = String(mapped.id);
  const file = path.join(candidatsDir, `${id}.yaml`);
  let existant: Record<string, unknown> | undefined;
  let texteExistant: string | undefined;
  if (lstatSync(file, { throwIfNoEntry: false }) !== undefined) {
    const lu = readContained(root, file);
    if ('diagnostic' in lu) {
      print(lu.diagnostic);
      invalide = true;
      continue;
    }
    const doc: unknown = parse(lu.text, { schema: 'core', uniqueKeys: true });
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      conflits.push(`${id} — fichier existant illisible (objet YAML attendu)`);
      continue;
    }
    existant = doc as Record<string, unknown>;
    texteExistant = lu.text;
  }
  const fusion = mergeFiche(existant, mapped);
  if ('conflit' in fusion) {
    conflits.push(`${id} — ${fusion.conflit}`);
    continue;
  }
  let texte: string;
  if (fusion.action === 'statut_ajoute' && texteExistant !== undefined) {
    // Édition en place : commentaires et mise en forme du fichier existant conservés.
    const statuts = fusion.fiche.statuts as unknown[];
    try {
      texte = ajouterStatutYaml(texteExistant, statuts[statuts.length - 1]);
    } catch (e) {
      conflits.push(`${id} — ajout du statut impossible (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
  } else {
    texte = renderYaml(fusion.fiche);
  }
  if (fusion.action !== 'inchange') {
    const res = validateYamlText('candidat', texte, file, { schemasDir, mode: 'preview' });
    if (res.diagnostics.length > 0) {
      for (const d of res.diagnostics) print(d);
      invalide = true;
      continue;
    }
  }
  plans.push({ row, id, file, action: fusion.action, texte, notes: fusion.notes });
}
if (invalide) fail('fiche(s) invalide(s) : rien n\'a été écrit');
if (conflits.length > 0) {
  for (const c of conflits) console.log(`conflit : ${c}`);
  fail(`${conflits.length} conflit(s) : rien n'a été écrit. Corriger data/import/correspondances.yaml ou attendre la correction amont ; ne jamais modifier une ancienne entrée de statuts[].`);
}

// --- 4. ids.lock -------------------------------------------------------------------------------------------
const lockPath = path.join(root, IDS_LOCK);
let lock: IdsLock | undefined;
if (lstatSync(lockPath, { throwIfNoEntry: false }) !== undefined) {
  const lu = readContained(root, lockPath);
  if ('diagnostic' in lu) fail(lu.diagnostic.message);
  lock = lireIdsLock(lu.text);
}
const presents = existsSync(candidatsDir)
  ? readdirSync(candidatsDir).filter((n) => n.endsWith('.yaml')).map((n) => n.slice(0, -'.yaml'.length))
  : [];
const apresImport = [...new Set([...presents, ...plans.map((p) => p.id)])];
const verrou = ajouterIds(lock, apresImport);
if ('refus' in verrou) {
  for (const p of verrou.refus) console.log(`ids.lock : ${p.message}`);
  fail(`${IDS_LOCK} refusé : rien n'a été écrit`);
}

// --- 5. écriture atomique ------------------------------------------------------------------------------------
function ecrireAtomique(file: string, contenu: string | Buffer): void {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  const racineReelle = realpathSync(root);
  const dirReel = realpathSync(dir);
  if (dirReel !== racineReelle && !dirReel.startsWith(racineReelle + path.sep)) fail(`écriture hors de la racine refusée : ${file}`);
  if (lstatSync(file, { throwIfNoEntry: false }) !== undefined) {
    const d = checkContained(root, file);
    if (d) return fail(d.message);
  }
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}`);
  try {
    writeFileSync(tmp, contenu, { flag: 'wx' });
    renameSync(tmp, file);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      // déjà absent
    }
    fail(`écriture impossible : ${path.relative(cwd, file)} (${e instanceof Error ? e.message : String(e)})`);
  }
}

const nom = snapshotName(amont.miseAJour, sha256);
const sha12 = sha256.slice(0, 12);
const dejaDansImport = values.file !== undefined && path.dirname(path.resolve(cwd, values.file)) === importDir;
if (!dryRun && !dejaDansImport && !existsSync(path.join(importDir, nom))) {
  ecrireAtomique(path.join(importDir, nom), brut.buffer);
  const meta = {
    url_initiale: brut.urlInitiale,
    url_finale: brut.urlFinale,
    etag: brut.etag,
    fetched_at: new Date().toISOString(),
    sha256,
    bytes: brut.buffer.byteLength,
    mise_a_jour: amont.miseAJour,
    rows: amont.rows.length,
    licence: 'Licence Ouverte 2.0',
    producteur: '2027 et moi (https://2027etmoi.fr)',
  };
  ecrireAtomique(path.join(importDir, nom.replace(/\.json$/, '.meta.json')), `${JSON.stringify(meta, null, 2)}\n`);
}
if (!dryRun) {
  for (const p of plans) if (p.action !== 'inchange') ecrireAtomique(p.file, p.texte);
  if (lock === undefined || verrou.ajoutes.length > 0) ecrireAtomique(lockPath, verrou.texte);
}

// --- 6. rapport -------------------------------------------------------------------------------------------------
const nb = { cree: 0, statut_ajoute: 0, inchange: 0 };
for (const p of plans) {
  nb[p.action] += 1;
  if (p.action === 'cree') console.log(`créé : ${p.id} (${p.row.statut}, ${p.row.source.date})`);
  else if (p.action === 'statut_ajoute') console.log(`statut ajouté : ${p.id} -> ${p.row.statut} (${p.row.source.date})`);
  for (const n of p.notes) console.log(`note : ${p.id} — ${n}`);
}
const amontIds = new Set(amont.rows.map((r) => r.id));
const absents: string[] = [];
for (const id of presents) {
  const f = path.join(candidatsDir, `${id}.yaml`);
  const lu = readContained(root, f);
  if ('diagnostic' in lu) continue;
  const doc = parse(lu.text, { schema: 'core' }) as { ids_externes?: Record<string, string> } | null;
  const externe = doc?.ids_externes?.['2027etmoi'];
  if (externe !== undefined && !amontIds.has(externe)) absents.push(id);
}
if (absents.length > 0) console.log(`absent en amont : ${absents.join(', ')}`);
console.log(
  `import : ${amont.rows.length} ligne(s), ${nb.cree} créé(s), ${nb.statut_ajoute} statut(s) ajouté(s), ${nb.inchange} inchangé(s), ${absents.length} absent(s) en amont, 0 conflit(s) — instantané ${sha12} du ${amont.miseAJour}, racine ${rel}`,
);
if (dryRun) console.log('simulation (--dry-run) : aucun fichier écrit');
process.exit(0);
