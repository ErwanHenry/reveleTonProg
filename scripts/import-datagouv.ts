// CLI `npm run import:datagouv` : jeu data.gouv « statuts sourcés » (2027 et moi) -> fiches candidats.
// Instantané brut daté et haché sous data/import/, fiches sous src/content/candidats/, ids.lock complété.
// Le jeu amont est une entrée non fiable : voir scripts/lib/datagouv.ts.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { IDS_LOCK, ajouterIds, lireIdsLock } from '../src/lib/content-core/ids-lock.ts';
import type { IdsLock } from '../src/lib/content-core/ids-lock.ts';
import { formatText } from '../src/lib/content-core/diagnostics.ts';
import type { Diagnostic } from '../src/lib/content-core/diagnostics.ts';
import { checkContained, loadAll, readContained, validateYamlText } from '../src/lib/content-core/load.ts';
import { loadDatasetDatagouv } from '../src/lib/dataset-datagouv.ts';
import { loadPublicationConfig } from '../src/lib/publication-config.ts';
import { YamlRefuse, lireYamlPlafonne } from '../src/lib/content-core/yaml-plafonne.ts';
import { ajouterStatutYaml, UnknownUpstreamIdsError, UpstreamShapeError, checkUpstream, lireCorrespondances, mapRow, mergeFiche, renderYaml, snapshotName } from './lib/datagouv.ts';
import type { UpstreamRow } from './lib/datagouv.ts';
import { FetchSafeError, fetchSafe } from './lib/fetch-safe.ts';
import { chargerEtatDepot } from './lib/instantane-depot.ts';
import { comparerInstantane, formaterEcart } from './lib/instantane.ts';
import { construireRapport, rapportMarkdown } from './lib/rapport-import.ts';
import type { EntreeRapport, PlanRapport } from './lib/rapport-import.ts';

const URL_PAR_DEFAUT = 'https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493';
const PLAFOND_OCTETS = 5 * 1024 * 1024;
const DELAI_MS = 30_000;

const USAGE = `Usage : npm run import:datagouv -- [--file <json>] [--url <https>] [--dry-run] [--format texte|markdown] [--accepter-absents] [--root <dossier>]
        npm run import:datagouv -- --check [--root <dossier>]

  --file <json>    lit un instantané local (hors ligne, tests) au lieu d'interroger data.gouv.fr
  --url <https>    ressource à télécharger (défaut : la ressource stable du jeu « statuts sourcés »)
  --dry-run        imprime le rapport sans rien écrire (ni instantané, ni fiche, ni ids.lock) ;
                   un identifiant amont inconnu de la table y est listé « à décider » au lieu d'arrêter
  --format <f>     texte (défaut) ou markdown : le rapport Markdown est le corps de la pull request d'import
  --accepter-absents
                   import réel d'un jeu dont plus de 20 % des identifiants de l'instantané précédent ont disparu
                   (sans elle : refus, rien n'est écrit) ; décision d'Erwan seul, jamais par défaut. Un jeu vide
                   est toujours refusé
  --check          vérifie, sans réseau, la cohérence instantané versionné / table / fiches candidats
                   (même contrôle que npm test) ; sort avec 1 et la liste des écarts s'il y en a
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

/** --check : D-04 sur le dépôt, sans réseau ni écriture (même contrôle que tests/corpus/instantane-coherence.test.ts). */
function verifierCoherence(racine: string): never {
  let rapport: ReturnType<typeof comparerInstantane>;
  try {
    rapport = comparerInstantane(chargerEtatDepot(racine));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  for (const ecart of rapport.erreurs) console.log(formaterEcart(ecart));
  for (const info of rapport.infos) console.log(`information : ${formaterEcart(info)}`);
  if (rapport.erreurs.length > 0) {
    console.log(`cohérence instantané / fiches : ${rapport.erreurs.length} écart(s)`);
    process.exit(1);
  }
  console.log('cohérence instantané / fiches : 0 écart');
  process.exit(0);
}

let values: { file?: string; url?: string; 'dry-run'?: boolean; root?: string; format?: string; check?: boolean; 'accepter-absents'?: boolean };
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: 'string' },
      url: { type: 'string' },
      'dry-run': { type: 'boolean' },
      root: { type: 'string' },
      format: { type: 'string' },
      check: { type: 'boolean' },
      'accepter-absents': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch (e) {
  usageError(e instanceof Error ? e.message : String(e));
}
if (values.check === true) {
  if (values.file !== undefined || values.url !== undefined || values['dry-run'] === true || values.format !== undefined || values['accepter-absents'] === true) {
    usageError('--check n\'accepte ni --file, ni --url, ni --dry-run, ni --format, ni --accepter-absents (seulement --root)');
  }
  verifierCoherence(path.resolve(process.cwd(), values.root ?? '.'));
}
if (values.format !== undefined && values.format !== 'texte' && values.format !== 'markdown') usageError('--format : « texte » ou « markdown » attendu');
const markdown = values.format === 'markdown';
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

// En mode markdown, stdout ne porte que le rapport : tout le reste va sur stderr.
const out = (ligne: string): void => {
  if (markdown) process.stderr.write(`${ligne}\n`);
  else console.log(ligne);
};
const print = (d: Diagnostic): void => out(formatText(d, cwd));

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
for (const a of amont.avertissements) out(`avertissement : ${a}`);

if (!existsSync(contentDir) || !statSync(contentDir).isDirectory()) fail(`${rel === '.' ? '' : `${rel}/`}src/content introuvable : vérifier --root`);
for (const p of [path.join(root, 'src'), contentDir, candidatsDir]) {
  if (existsSync(p) && lstatSync(p).isSymbolicLink()) fail(`lien symbolique refusé : ${path.relative(cwd, p)}`);
}

// WR-10 : garde de volume. Un jeu vide est toujours refusé ; un jeu dont plus de 20 % des identifiants de
// l'instantané pointé (data/dataset-datagouv.yaml) ont disparu est refusé en import réel, sauf --accepter-absents
// (décision d'Erwan, RUNBOOK). La répétition à blanc n'est jamais refusée : son rapport l'annonce dans l'en-tête.
const PLAFOND_DISPARUS = 0.2;
let gardeVolume: { disparus: number; precedent: number; refus: boolean } | null = null;
try {
  const ptr = loadDatasetDatagouv(root).instantane.chemin;
  const anciens = checkUpstream(JSON.parse(readFileSync(path.join(root, ptr), 'utf8'))).rows.map((r) => r.id);
  const nouveaux = new Set(amont.rows.map((r) => r.id));
  const disparus = anciens.filter((id) => !nouveaux.has(id)).length;
  gardeVolume = { disparus, precedent: anciens.length, refus: disparus > PLAFOND_DISPARUS * anciens.length };
} catch {
  // pas d'instantané précédent lisible sous cette racine : seule la garde du jeu vide s'applique
}
if (!dryRun && amont.rows.length === 0) fail('jeu amont vide ou tronqué : 0 ligne ; rien n\'a été écrit.');
if (!dryRun && gardeVolume?.refus === true && values['accepter-absents'] !== true) {
  fail(
    `jeu amont vide ou tronqué : ${amont.rows.length} ligne(s) contre ${gardeVolume.precedent} dans l’instantané précédent, ${gardeVolume.disparus} identifiant(s) disparu(s) (plus de 20 %) ; rien n'a été écrit. Si Erwan confirme ce jeu, relancer avec --accepter-absents (RUNBOOK).`,
  );
}

const corrPath = path.join(importDir, 'correspondances.yaml');
if (lstatSync(corrPath, { throwIfNoEntry: false }) === undefined) fail(`table introuvable : data/import/correspondances.yaml (sous ${rel})`);
const corrLue = readContained(root, corrPath);
if ('diagnostic' in corrLue) fail(`${corrLue.diagnostic.message} (${corrPath})`);
let table: ReturnType<typeof lireCorrespondances>;
try {
  // IMP-01 : lecture plafonnée (alias refusés, clés en double refusées), refus avec fichier, ligne et code.
  table = lireCorrespondances(lireYamlPlafonne(corrLue.text, 'data/import/correspondances.yaml'));
} catch (e) {
  if (e instanceof YamlRefuse) fail(`data/import/correspondances.yaml refusé : ${e.message}`);
  fail(`data/import/correspondances.yaml invalide : ${e instanceof Error ? e.message : String(e)}`);
}

// Les identifiants amont inconnus sont tous listés avant l'arrêt : jamais de découpage deviné.
const inconnus = amont.rows.filter((r) => !Object.hasOwn(table, r.id)).map((r) => r.id);
// Répétition à blanc : un identifiant inconnu est listé « à décider » et les autres lignes sont traitées.
// Import réel : toujours un arrêt (aucune personne n'est créée sans une ligne écrite à la main).
if (inconnus.length > 0 && !dryRun) {
  process.stderr.write(`import : ${new UnknownUpstreamIdsError(inconnus).message}\n`);
  process.stderr.write('Ajouter une ligne à la main (prénom, nom, nom_tri, motif, type de source) puis relancer ; rien n\'a été écrit.\n');
  process.exit(1);
}

// --- 3. mapping, fusion, validation (rien n'est écrit tant que tout n'est pas bon) -------------------
interface Plan {
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown>;
  mappe: Record<string, unknown>;
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
/** Chemin relatif à la racine importée, pour nommer un fichier refusé (src/content/candidats/<id>.yaml). */
const relatif = (f: string): string => path.relative(root, f).split(path.sep).join('/');

for (const row of amont.rows.filter((r) => Object.hasOwn(table, r.id))) {
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
    // IMP-01 (pitfall 6) : chaque fiche existante passe par la lecture plafonnée, même celle dont l'action
    // sera « inchangé » ; un alias, une clé en double ou une racine non objet est un conflit nommé.
    try {
      existant = lireYamlPlafonne(lu.text, relatif(file));
    } catch (e) {
      conflits.push(`${id} — fichier existant illisible (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`);
      continue;
    }
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
      texte = ajouterStatutYaml(texteExistant, statuts[statuts.length - 1], relatif(file));
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
  plans.push({ avant: existant ?? null, apres: fusion.fiche, mappe: mapped, row, id, file, action: fusion.action, texte, notes: fusion.notes });
}
if (invalide) fail('fiche(s) invalide(s) : rien n\'a été écrit');

// Fichiers présents avant l'import (lus avant toute écriture) et fiches dont la clé amont a disparu du jeu.
const presents = existsSync(candidatsDir)
  ? readdirSync(candidatsDir).filter((n) => n.endsWith('.yaml')).map((n) => n.slice(0, -'.yaml'.length))
  : [];
const amontIds = new Set(amont.rows.map((r) => r.id));
const absentsFiches: { id: string; idAmont: string }[] = [];
const illisibles: string[] = [];
for (const id of presents) {
  const f = path.join(candidatsDir, `${id}.yaml`);
  const lu = readContained(root, f);
  if ('diagnostic' in lu) continue;
  let doc: { ids_externes?: Record<string, string> };
  try {
    doc = lireYamlPlafonne(lu.text, relatif(f)) as { ids_externes?: Record<string, string> };
  } catch (e) {
    illisibles.push(`${id} (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`);
    continue;
  }
  const externe = doc.ids_externes?.['2027etmoi'];
  if (externe !== undefined && !amontIds.has(externe)) absentsFiches.push({ id, idAmont: externe });
}
const absents = absentsFiches.map((a) => a.id);

/** Écrit sur stdout et attend que le tampon soit vidé (un tube plein ne doit pas tronquer le rapport avant process.exit). */
const imprimer = (texte: string): Promise<void> => new Promise((resolve) => process.stdout.write(texte, () => resolve()));

/** Texte Markdown du rapport (D-06) : jeu précédent, corpus d'aperçu et liste blanche lus ici, calcul dans le module pur. */
function rapportDeCetteExecution(): string {
  let precedent: string | null = null;
  let precedentJeu: EntreeRapport['precedent'] = null;
  try {
    precedent = loadDatasetDatagouv(root).instantane.chemin;
    const ancien = checkUpstream(JSON.parse(readFileSync(path.join(root, precedent), 'utf8')));
    precedentJeu = { miseAJour: ancien.miseAJour, ids: ancien.rows.map((r) => r.id) };
  } catch {
    // pas de pointeur ou de jeu précédent lisible sous cette racine : l'en-tête le dit, rien n'est inventé
  }
  let themesOuverts: string[];
  try {
    themesOuverts = loadPublicationConfig(root).themesOuverts;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const charge = loadAll(root, { schemasDir, mode: 'preview' });
  const corpus = charge.entries;
  // WR-03 : un fichier refusé (diagnostic d'erreur, absent des entrées) est nommé dans l'en-tête du rapport.
  const charges = new Set(corpus.map((e) => e.file));
  const fichiersRefuses = [
    ...new Set(charge.diagnostics.filter((d) => d.severity === 'error' && !charges.has(d.file)).map((d) => path.relative(root, d.file).split(path.sep).join('/'))),
  ];
  const chaine = (v: unknown): string => String(v);
  const casDeCouverture: EntreeRapport['couvertures'] = [];
  for (const c of corpus.filter((e) => e.collection === 'couverture')) {
    for (const cas of Array.isArray(c.data.cases) ? (c.data.cases as Record<string, unknown>[]) : []) {
      casDeCouverture.push({ theme: chaine(c.data.theme), candidat: chaine(cas.candidat), etat: chaine(cas.etat) });
    }
  }
  const entree: EntreeRapport = {
    instantane: { nom: snapshotName(amont.miseAJour, sha256), sha256, miseAJour: amont.miseAJour, lignes: amont.rows.length, precedent },
    plans: plans.map((p): PlanRapport => ({ id: p.id, idAmont: p.row.id, avant: p.avant, apres: p.apres, mappe: p.mappe })),
    inconnus: amont.rows.filter((r) => !Object.hasOwn(table, r.id)),
    conflits,
    precedent: precedentJeu,
    idsAmont: amont.rows.map((r) => r.id),
    fichesAbsentes: absentsFiches,
    candidats: corpus.filter((e) => e.collection === 'candidats').map((e) => ({ id: e.id, statuts: e.data.statuts })),
    themes: corpus.filter((e) => e.collection === 'themes').map((e) => ({ id: e.id, statutRelecture: chaine(e.data.statut_relecture) })),
    mesures: corpus
      .filter((e) => e.collection === 'mesures')
      .map((e) => ({ theme: chaine(e.data.theme), candidat: chaine(e.data.candidat), statutRelecture: chaine(e.data.statut_relecture) })),
    couvertures: casDeCouverture,
    themesOuverts,
    fichiersRefuses,
    gardeVolume,
    illisibles,
  };
  return rapportMarkdown(construireRapport(entree));
}

if (conflits.length > 0) {
  for (const c of conflits) out(`conflit : ${c}`);
  if (markdown) await imprimer(rapportDeCetteExecution());
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
const apresImport = [...new Set([...presents, ...plans.map((p) => p.id)])];
const verrou = ajouterIds(lock, apresImport);
if ('refus' in verrou) {
  for (const p of verrou.refus) out(`ids.lock : ${p.message}`);
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
if (markdown) {
  await imprimer(rapportDeCetteExecution());
  process.exit(0);
}
const nb = { cree: 0, statut_ajoute: 0, inchange: 0 };
for (const p of plans) {
  nb[p.action] += 1;
  if (p.action === 'cree') out(`créé : ${p.id} (${p.row.statut}, ${p.row.source.date})`);
  else if (p.action === 'statut_ajoute') out(`statut ajouté : ${p.id} -> ${p.row.statut} (${p.row.source.date})`);
  for (const n of p.notes) out(`note : ${p.id} — ${n}`);
}
if (absents.length > 0) out(`absent en amont : ${absents.join(', ')}`);
if (inconnus.length > 0) out(`à décider : ${[...inconnus].sort().join(', ')}`);
if (illisibles.length > 0) out(`illisible (YAML refusé, ignoré pour le rapport « absent en amont ») : ${illisibles.join(', ')}`);
out(
  `import : ${amont.rows.length} ligne(s), ${nb.cree} créé(s), ${nb.statut_ajoute} statut(s) ajouté(s), ${nb.inchange} inchangé(s), ${absents.length} absent(s) en amont${inconnus.length > 0 ? `, ${inconnus.length} à décider` : ''}, 0 conflit(s) — instantané ${sha12} du ${amont.miseAJour}, racine ${rel}`,
);
if (dryRun) out('simulation (--dry-run) : aucun fichier écrit');
process.exit(0);
