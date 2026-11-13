// CLI d'archivage d'une source (CONT-03) : capture une URL (ou un fichier enregistré par Erwan),
// écrit l'extrait texte normalisé `archives/<candidat>/<sha12>.txt` et la source YAML dans le dépôt
// public, range le binaire (PDF, HTML) dans le dépôt privé `reveleTonProg-archives`, et soumet
// l'URL à l'Internet Archive. Le contenu téléchargé est une donnée non fiable : jamais exécuté,
// évalué ni interpolé dans une commande. Ne modifie jamais src/content/mesures.
import { execFile } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { readContained, validateYamlText } from '../src/lib/content-core/load.ts';
import { schemasDirOf } from '../src/lib/content-core/root.ts';
import { YamlRefuse, lireYamlPlafonne } from '../src/lib/content-core/yaml-plafonne.ts';
import {
  TAILLE_MAX_BINAIRE,
  buildSourceYaml,
  checkExtract,
  diffUnifie,
  extractName,
  normalizeExtract,
  paramsDeSource,
  refreshDecision,
  sha256Hex,
  type DonneesSource,
  type ParamsSource,
} from './lib/archive.ts';
import { FetchSafeError, fetchSafe, type Adresse } from './lib/fetch-safe.ts';
import { decodeHtml, htmlToText, looksClientRendered } from './lib/html-text.ts';
import { DepotPriveError, readMeta, resolveArchivesDir, storeBinary, syncPrivate, type MetaBinaire } from './lib/private-store.ts';
import { extraitDansInstantane, lireInstantane, parseSnapshotLocation, submitWayback, urlInstantane } from './lib/wayback.ts';

const execFileAsync = promisify(execFile);
const SCHEMAS_DIR = schemasDirOf(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const TYPES = ['programme', 'site_candidat', 'site_parti', 'discours', 'tribune', 'depot_cc'] as const;
const AUTEURS = ['candidat', 'parti_du_candidat', 'coalition'] as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_CANDIDAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const ECART_WAYBACK_MS = 20_000;
const ANCIENNETE_MAX_H = 24;

const USAGE = `Usage :
  archive-source.ts <url> --candidat <id> [--candidat <id>...] --source-id <slug> --type <type> --auteur <auteur>
                    --titre "<titre>" --date-publication <AAAA-MM[-JJ]> [--file <page.html|doc.pdf>]
                    [--wayback] [--push] [--dry-run] [--allow-replacement-chars] [--capture-le <ISO>] [--root <dossier>]
  archive-source.ts --refresh <source-id> [--file <fichier>] [--capture-le <ISO>] [--push] [--dry-run] [--root <dossier>]
  archive-source.ts --wayback-only <source-id>... [--root <dossier>]
  archive-source.ts --wayback-missing [--candidat <id>] [--root <dossier>]
  archive-source.ts --wayback-adopter <source-id> --instantane <14 chiffres> [--nouvelle-url <https://…>] [--dry-run] [--root <dossier>]
  archive-source.ts --sync-private

  --wayback-adopter : adopte un instantané Wayback déjà existant (lecture seule de web.archive.org, aucune
                      soumission), seulement si chaque paragraphe de l'extrait archivé y figure ; --nouvelle-url
                      corrige aussi l'adresse de la source. L'extrait, son sha256 et les dates ne changent pas.
  Une source portant archive.wayback_exception (exception motivée) n'est jamais soumise ni adoptée.

  type    : ${TYPES.join(' | ')}
  auteur  : ${AUTEURS.join(' | ')}
  --root  : racine de contenu (défaut : dossier courant ; RTP_CONTENT_ROOT est ignorée)
  Dépôt privé des binaires : RTP_ARCHIVES_DIR, sinon ../reveleTonProg-archives à côté de la racine.
  Codes de sortie : 0 ok, 1 contenu refusé, 2 usage ou configuration.
`;

export class Sortie extends Error {
  readonly code: 1 | 2;
  constructor(code: 1 | 2, message: string) {
    super(message);
    this.name = 'Sortie';
    this.code = code;
  }
}

type Mode = 'capture' | 'refresh' | 'wayback-only' | 'wayback-missing' | 'wayback-adopter' | 'sync-private';

/** Dépendances réseau injectables (tests) ; par défaut, le `fetch` global et le DNS du système. */
export interface Dependances {
  fetch?: typeof fetch;
  lookup?: (hote: string) => Promise<Adresse[]>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const avertir = (message: string): void => console.warn(`AVERTISSEMENT : ${message}`);

// ---------- dates (Europe/Paris) ----------

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function enParis(d: Date): { jour: string; iso: string } {
  const p: Record<string, string> = {};
  for (const part of FORMAT_PARIS.formatToParts(d)) p[part.type] = part.value;
  const jour = `${p.year}-${p.month}-${p.day}`;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  const decalage = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const signe = decalage < 0 ? '-' : '+';
  const abs = Math.abs(decalage);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return { jour, iso: `${jour}T${p.hour}:${p.minute}:${p.second}${signe}${hh}:${mm}` };
}

const ISO_AVEC_DECALAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function datePublicationValide(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m === null) return false;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j;
}

// ---------- sûreté des écritures ----------

function verifierEcriture(racine: string, abs: string): void {
  const racineReelle = realpathSync(racine);
  const absolu = path.resolve(abs);
  if (!absolu.startsWith(path.resolve(racine) + path.sep)) throw new Sortie(2, `écriture hors de la racine de contenu refusée : ${abs}`);
  let ancetre = path.dirname(absolu);
  while (!existsSync(ancetre)) ancetre = path.dirname(ancetre);
  const reel = realpathSync(ancetre);
  if (reel !== racineReelle && !reel.startsWith(racineReelle + path.sep)) throw new Sortie(2, `le dossier ${ancetre} sort de la racine de contenu (lien symbolique ?) : refusé`);
  if (existsSync(absolu) && lstatSync(absolu).isSymbolicLink()) throw new Sortie(2, `lien symbolique refusé : ${abs}`);
}

function ecrireAtomique(racine: string, rel: string, contenu: string | Uint8Array): void {
  const abs = path.join(racine, rel);
  verifierEcriture(racine, abs);
  mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  rmSync(tmp, { force: true }); // reste d'une exécution interrompue (ou lien posé à l'avance) : retiré sans le suivre
  writeFileSync(tmp, contenu, { flag: 'wx' });
  renameSync(tmp, abs);
}

// ---------- contexte et sources ----------

interface Contexte {
  racine: string;
  push: boolean;
  dryRun: boolean;
  wayback: boolean;
  allowReplacement: boolean;
  archivesDir: string | undefined;
}

interface SourceLue {
  fichier: string;
  rel: string;
  data: DonneesSource;
}

const relSource = (id: string): string => `src/content/sources/${id}.yaml`;

function lireSource(racine: string, id: string): SourceLue {
  if (!SLUG.test(id)) throw new Sortie(2, `identifiant de source invalide : « ${id} »`);
  const rel = relSource(id);
  const fichier = path.join(racine, rel);
  if (!existsSync(fichier)) throw new Sortie(2, `source introuvable : ${rel} (racine ${racine})`);
  const lu = readContained(racine, fichier);
  if ('diagnostic' in lu) throw new Sortie(1, `${rel} : ${lu.diagnostic.message}`);
  const res = validateYamlText('source', lu.text, fichier, { schemasDir: SCHEMAS_DIR });
  const erreurs = res.diagnostics.filter((d) => d.severity === 'error');
  if (erreurs.length > 0) throw new Sortie(1, `${rel} invalide : ${erreurs.map((d) => `${d.code} ${d.pointer} ${d.message}`).join(' ; ')}`);
  return { fichier, rel, data: res.data as SourceLue['data'] };
}

const paramsDe = paramsDeSource;

/** Une exception Wayback motivée (D-08) interdit toute soumission ou adoption d'instantané. */
function refusSiException(src: SourceLue, action: string): void {
  if (src.data.archive.wayback_exception !== undefined) {
    throw new Sortie(1, `${src.data.id} porte une exception Wayback motivée (archive.wayback_exception, décidée par ${src.data.archive.wayback_exception.decide_par} le ${src.data.archive.wayback_exception.decide_le}) : ${action} refusée`);
  }
}

/** Valide puis écrit la source (atomique) ; une erreur de schéma interdit l'écriture. */
function ecrireSource(ctx: Contexte, p: ParamsSource): void {
  const yaml = buildSourceYaml(p);
  const fichier = path.join(ctx.racine, relSource(p.id));
  const res = validateYamlText('source', yaml, fichier, { schemasDir: SCHEMAS_DIR });
  const erreurs = res.diagnostics.filter((d) => d.severity === 'error');
  if (erreurs.length > 0) throw new Sortie(1, `la source générée ne passe pas le schéma : ${erreurs.map((d) => `${d.code} ${d.pointer} ${d.message}`).join(' ; ')}`);
  ecrireAtomique(ctx.racine, relSource(p.id), yaml);
}

function validerSeulement(ctx: Contexte, p: ParamsSource): void {
  const res = validateYamlText('source', buildSourceYaml(p), path.join(ctx.racine, relSource(p.id)), { schemasDir: SCHEMAS_DIR });
  const erreurs = res.diagnostics.filter((d) => d.severity === 'error');
  if (erreurs.length > 0) throw new Sortie(1, `la source générée ne passe pas le schéma : ${erreurs.map((d) => `${d.code} ${d.pointer} ${d.message}`).join(' ; ')}`);
}

// ---------- capture ----------

interface Prise {
  urlDemandee: string;
  urlFinale: string;
  statut: number | null;
  contentType: string | null;
  octets: Uint8Array;
  outil: 'fetch' | 'fichier-manuel';
  captureLe: string;
  dateConsultation: string;
}

function instantDeCapture(captureLeOpt: string | undefined): { captureLe: string; dateConsultation: string } {
  if (captureLeOpt !== undefined) {
    if (!ISO_AVEC_DECALAGE.test(captureLeOpt) || Number.isNaN(Date.parse(captureLeOpt))) {
      throw new Sortie(2, `--capture-le doit être un instant ISO avec décalage (ex. 2026-11-03T10:00:00+01:00), reçu « ${captureLeOpt} »`);
    }
    return { captureLe: captureLeOpt, dateConsultation: enParis(new Date(captureLeOpt)).jour };
  }
  const p = enParis(new Date());
  return { captureLe: p.iso, dateConsultation: p.jour };
}

async function obtenir(urlDemandee: string, fichier: string | undefined, captureLeOpt: string | undefined): Promise<Prise> {
  if (captureLeOpt !== undefined && fichier === undefined) throw new Sortie(2, '--capture-le n’est admis qu’avec --file (capture manuelle) : une capture en ligne est datée par l’outil');
  const instant = instantDeCapture(captureLeOpt);
  if (fichier !== undefined) {
    const abs = path.resolve(fichier);
    let st;
    try {
      st = statSync(abs);
    } catch {
      throw new Sortie(2, `fichier introuvable : ${fichier}`);
    }
    if (!st.isFile()) throw new Sortie(2, `--file doit désigner un fichier : ${fichier}`);
    if (st.size > TAILLE_MAX_BINAIRE) throw new Sortie(1, `binaire trop volumineux : ${st.size} octets (maximum ${TAILLE_MAX_BINAIRE}, soit 50 Mio)`);
    return {
      urlDemandee,
      urlFinale: urlDemandee,
      statut: null,
      contentType: null,
      octets: readFileSync(abs),
      outil: 'fichier-manuel',
      ...instant,
    };
  }
  try {
    const r = await fetchSafe(urlDemandee);
    return {
      urlDemandee,
      urlFinale: r.finalUrl,
      statut: r.status,
      contentType: r.contentType ?? null,
      octets: r.bytes,
      outil: 'fetch',
      ...instantDeCapture(undefined),
    };
  } catch (e) {
    if (e instanceof FetchSafeError) throw new Sortie(e.code === 'SCHEMA' || e.code === 'ADRESSE_PRIVEE' ? 2 : 1, e.message);
    throw e;
  }
}

function trouverDansPath(nom: string): string | undefined {
  for (const dossier of (process.env.PATH ?? '').split(path.delimiter)) {
    if (dossier === '') continue;
    const candidat = path.join(dossier, nom);
    try {
      if (statSync(candidat).isFile()) return candidat;
    } catch {
      // suivant
    }
  }
  return undefined;
}

async function pdfVersTexte(octets: Uint8Array): Promise<string> {
  const exe = trouverDansPath('pdftotext');
  if (exe === undefined) {
    throw new Sortie(2, 'pdftotext (poppler) est introuvable. Installer : brew install poppler   ou   sudo port install poppler');
  }
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'rtp-pdf-'));
  try {
    const fichier = path.join(dossier, 'document.pdf');
    writeFileSync(fichier, octets);
    const { stdout } = await execFileAsync(exe, ['-enc', 'UTF-8', fichier, '-'], { timeout: 60_000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    return stdout;
  } catch (e) {
    throw new Sortie(1, `pdftotext a échoué (PDF illisible, protégé ou trop gros ?) : ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

interface Analyse {
  texte: string;
  nom: string;
  sha256: string;
  extension: 'pdf' | 'html';
  avertissements: string[];
}

async function analyser(prise: Prise, allowReplacement: boolean): Promise<Analyse> {
  if (prise.octets.byteLength > TAILLE_MAX_BINAIRE) {
    throw new Sortie(1, `binaire trop volumineux : ${prise.octets.byteLength} octets (maximum ${TAILLE_MAX_BINAIRE}, soit 50 Mio)`);
  }
  const avertissements: string[] = [];
  const estPdf = Buffer.from(prise.octets.subarray(0, 5)).toString('latin1') === '%PDF-';
  let brut: string;
  if (estPdf) {
    brut = await pdfVersTexte(prise.octets);
  } else {
    const html = decodeHtml(prise.octets, prise.contentType ?? undefined);
    const { text, entitesResiduelles } = htmlToText(html);
    if (looksClientRendered(html, text)) {
      throw new Sortie(
        1,
        `page rendue côté client (HTML de plus de 30 Ko mais ${text.trim().length} caractères de texte visible) : le texte n'est pas dans le HTML reçu. ` +
          'Ouvrir la page dans votre navigateur, l’enregistrer (« Page web, complète » ou PDF), puis relancer avec --file <fichier>.',
      );
    }
    for (const e of entitesResiduelles) {
      avertissements.push(`entité HTML non décodée ${e.entite} (${e.occurrences} fois) : une citation contenant ce texte brut ne correspondrait pas`);
    }
    brut = text;
  }
  const texte = normalizeExtract(brut);
  const verdict = checkExtract(texte, { allowReplacement });
  if (verdict.erreurs.length > 0) throw new Sortie(1, `extrait refusé : ${verdict.erreurs.join(' ; ')}`);
  avertissements.push(...verdict.avertissements);
  return { texte, nom: extractName(texte), sha256: sha256Hex(texte), extension: estPdf ? 'pdf' : 'html', avertissements };
}

function metaDe(sourceId: string, prise: Prise, binSha: string, extraitSha: string): MetaBinaire {
  return {
    source_id: sourceId,
    url_demandee: prise.urlDemandee,
    url_finale: prise.urlFinale,
    statut_http: prise.statut,
    content_type: prise.contentType,
    bytes: prise.octets.byteLength,
    binaire_sha256: binSha,
    extrait_sha256: extraitSha,
    capture_le: prise.captureLe,
    outil: prise.outil,
  };
}

/** Écrit l'extrait (sans effet s'il est identique), le binaire privé, et pousse si demandé. */
async function enregistrer(ctx: Contexte, p: ParamsSource, analyse: Analyse, prise: Prise, ecrireExtrait: boolean): Promise<void> {
  const candidat = p.candidats[0] ?? '';
  const dossier = ctx.archivesDir;
  if (dossier === undefined) throw new Sortie(2, 'dépôt privé reveleTonProg-archives non résolu');
  const binSha = sha256Hex(prise.octets);
  // Binaire privé d'abord (idempotent) : s'il échoue, le dépôt public ne référence pas un binaire absent.
  const { ecrits } = storeBinary({
    dossier,
    candidat,
    sourceId: p.id,
    binaire: prise.octets,
    extension: analyse.extension,
    meta: metaDe(p.id, prise, binSha, analyse.sha256),
  });
  if (ecrireExtrait) {
    const abs = path.join(ctx.racine, p.archive.extrait);
    if (!(existsSync(abs) && readFileSync(abs, 'utf8') === analyse.texte)) ecrireAtomique(ctx.racine, p.archive.extrait, analyse.texte);
  }
  ecrireSource(ctx, p);
  console.log(`Binaire privé : ${ecrits.length === 0 ? 'déjà présent' : ecrits.join(', ')} (dépôt ${dossier})`);
  if (ctx.push) {
    const r = await syncPrivate({ dossier, chemins: ecrits, message: `archive: ${p.id}` });
    console.log(`Dépôt privé : ${r.commit ? 'commit créé, ' : 'rien de nouveau à commiter, '}poussé.`);
  } else if (ecrits.length > 0) {
    avertir(`le dépôt privé n'est pas poussé (pas de --push) : lancer --sync-private avant de fermer la session (Règle d'or)`);
  }
}

async function soumettre(ctx: Contexte, id: string): Promise<boolean> {
  const src = lireSource(ctx.racine, id);
  if (src.data.archive.wayback_exception !== undefined) {
    avertir(`${id} porte une exception Wayback motivée (archive.wayback_exception) : jamais soumise`);
    return false;
  }
  const r = await submitWayback(src.data.url, { fetch: globalThis.fetch, now: () => new Date() });
  if (!r.ok) {
    avertir(`Wayback pour ${id} : ${r.reason}. Reprise : node scripts/archive-source.ts --wayback-only ${id}`);
    return false;
  }
  const p = paramsDe(src.data);
  p.archive.waybackUrl = r.waybackUrl;
  ecrireSource(ctx, p);
  console.log(`Wayback ${id} : ${r.waybackUrl}`);
  const ecartH = (new Date(src.data.archive.capture_le).getTime() - r.instant.getTime()) / 3_600_000;
  if (ecartH > ANCIENNETE_MAX_H) {
    avertir(`l'instantané Wayback de ${id} date de ${Math.round(ecartH)} h avant la capture : il peut montrer un contenu plus ancien`);
  }
  return true;
}

// ---------- modes ----------

interface ArgsCapture {
  url: string;
  candidats: string[];
  sourceId: string;
  type: string;
  auteur: string;
  titre: string;
  datePublication: string;
  file: string | undefined;
  captureLe: string | undefined;
}

async function modeCapture(ctx: Contexte, a: ArgsCapture): Promise<void> {
  const rel = relSource(a.sourceId);
  if (existsSync(path.join(ctx.racine, rel))) {
    throw new Sortie(2, `la source ${rel} existe déjà : utiliser --refresh ${a.sourceId} pour la recapturer (l'identifiant est conservé)`);
  }
  const prise = await obtenir(a.url, a.file, a.captureLe);
  const analyse = await analyser(prise, ctx.allowReplacement);
  const candidat = a.candidats[0] ?? '';
  const binSha = sha256Hex(prise.octets);
  const p: ParamsSource = {
    id: a.sourceId,
    type: a.type,
    auteur: a.auteur,
    candidats: a.candidats,
    titre: a.titre,
    url: prise.urlFinale,
    datePublication: a.datePublication,
    dateConsultation: prise.dateConsultation,
    archive: { extrait: `archives/${candidat}/${analyse.nom}.txt`, sha256: analyse.sha256, captureLe: prise.captureLe, binaireSha256: binSha },
  };
  validerSeulement(ctx, p);
  for (const c of a.candidats) {
    if (!existsSync(path.join(ctx.racine, 'src', 'content', 'candidats', `${c}.yaml`))) avertir(`aucune fiche candidat « ${c} » dans cette racine : la validation signalera la référence`);
  }
  if (ctx.dryRun) {
    console.log(`[dry-run] ${rel} et ${p.archive.extrait} ne sont pas écrits.`);
  } else {
    await enregistrer(ctx, p, analyse, prise, true);
    if (ctx.wayback) await soumettre(ctx, a.sourceId);
  }
  resume(ctx, p, analyse, prise);
}

function resume(ctx: Contexte, p: ParamsSource, analyse: Analyse, prise: Prise): void {
  console.log(`URL finale : ${prise.urlFinale}`);
  console.log(`Statut HTTP : ${prise.statut ?? 'sans objet (fichier manuel)'}`);
  console.log(`Extrait : ${[...analyse.texte].length} caractères, sha256 ${analyse.sha256} (sha12 ${analyse.nom})`);
  console.log(`Source : ${relSource(p.id)} — consultée le ${p.dateConsultation}, capturée le ${p.archive.captureLe}`);
  for (const w of analyse.avertissements) avertir(w);
  if (!ctx.dryRun) {
    console.log('Suite : citer la source dans une mesure (texte_source mot pour mot dans l’extrait), puis npm run validate.');
    if (!ctx.wayback && p.archive.waybackUrl === undefined) console.log(`Wayback : node scripts/archive-source.ts --wayback-only ${p.id}`);
  }
}

async function modeRefresh(ctx: Contexte, id: string, file: string | undefined, captureLeOpt: string | undefined): Promise<void> {
  const src = lireSource(ctx.racine, id);
  const archive = src.data.archive;
  const candidat = src.data.candidats[0] ?? '';
  const meta = ctx.archivesDir !== undefined && archive.binaire_sha256 !== undefined ? readMeta(ctx.archivesDir, candidat, archive.binaire_sha256, id) : undefined;
  if (meta?.outil === 'fichier-manuel' && file === undefined) {
    avertir(`${id} a été saisie à la main (fichier-manuel) : rafraîchissement ignoré. Pour la mettre à jour : --refresh ${id} --file <nouveau fichier>`);
    return;
  }
  if (meta === undefined && file === undefined) {
    avertir(`aucune fiche de capture trouvée dans le dépôt privé pour ${id} : on suppose une capture en ligne`);
  }
  const prise = await obtenir(src.data.url, file, captureLeOpt);
  const analyse = await analyser(prise, ctx.allowReplacement);
  const binSha = sha256Hex(prise.octets);
  const decision = refreshDecision({ sha256: archive.sha256, ...(archive.binaire_sha256 === undefined ? {} : { binaire_sha256: archive.binaire_sha256 }) }, analyse.sha256, binSha);
  const p = paramsDe(src.data);
  p.archive.captureLe = prise.captureLe;
  p.dateConsultation = prise.dateConsultation;
  p.archive.binaireSha256 = binSha;
  if (decision.decision === 'texte_modifie') {
    p.archive.extrait = `archives/${candidat}/${analyse.nom}.txt`;
    p.archive.sha256 = analyse.sha256;
    delete p.archive.waybackUrl;
  }
  if (prise.outil === 'fetch' && prise.urlFinale !== src.data.url) {
    avertir(`l'URL finale (${prise.urlFinale}) diffère de l'URL enregistrée (${src.data.url}) : conservée telle quelle, vérifier l'auteur et la page`);
  }
  validerSeulement(ctx, p);
  console.log(`Rafraîchissement de ${id} : ${decision.decision}`);
  for (const w of decision.avertissements) avertir(w);
  if (ctx.dryRun) {
    console.log('[dry-run] rien n’est écrit.');
  } else {
    await enregistrer(ctx, p, analyse, prise, decision.decision === 'texte_modifie');
    if (decision.decision === 'texte_modifie') {
      avertir(`l'ancien extrait ${archive.extrait} est conservé (supprimer le fichier s'il n'est plus cité)`);
      if (ctx.wayback) await soumettre(ctx, id);
      else console.log(`Wayback : node scripts/archive-source.ts --wayback-only ${id}`);
    }
  }
  resume(ctx, p, analyse, prise);
}

/**
 * Sources sans wayback_url ; celles qui portent une exception motivée sont listées à part, jamais soumises.
 * IMP-01 : chaque fichier passe par la lecture plafonnée ; une source refusée (alias, clé en double, racine non
 * objet) n'est plus écartée en silence : les refus sont réunis puis l'outil s'arrête (code 1) avant toute soumission.
 */
function sourcesSansWayback(racine: string, candidat: string | undefined): { ids: string[]; exceptions: string[] } {
  const dossier = path.join(racine, 'src', 'content', 'sources');
  const ids: string[] = [];
  const exceptions: string[] = [];
  const refus: string[] = [];
  if (!existsSync(dossier)) return { ids, exceptions };
  for (const nom of readdirSync(dossier).sort()) {
    if (!nom.endsWith('.yaml')) continue;
    const id = nom.slice(0, -5);
    let doc: Partial<DonneesSource>;
    try {
      doc = lireYamlPlafonne(readFileSync(path.join(dossier, nom), 'utf8'), `src/content/sources/${nom}`) as Partial<DonneesSource>;
    } catch (e) {
      refus.push(e instanceof YamlRefuse ? e.message : `src/content/sources/${nom} illisible (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (doc.archive?.wayback_url !== undefined) continue;
    if (candidat !== undefined && !(doc.candidats?.includes(candidat) ?? false)) continue;
    if (doc.archive?.wayback_exception !== undefined) exceptions.push(id);
    else ids.push(id);
  }
  if (refus.length > 0) {
    throw new Sortie(1, `${refus.length} source(s) au YAML refusé : ${refus.join(' ; ')}. Corriger le fichier puis relancer ; rien n'a été soumis.`);
  }
  return { ids, exceptions };
}

async function passeWayback(ctx: Contexte, ids: string[], candidat: string | undefined): Promise<void> {
  if (ids.length === 0) {
    console.log('Aucune source à soumettre.');
    return;
  }
  if (ctx.dryRun) {
    console.log(`[dry-run] soumission prévue pour : ${ids.join(', ')}`);
    return;
  }
  let premier = true;
  for (const id of ids) {
    if (!premier) await sleep(ECART_WAYBACK_MS);
    premier = false;
    try {
      await soumettre(ctx, id);
    } catch (e) {
      if (e instanceof Sortie) avertir(`${id} : ${e.message}`);
      else throw e;
    }
  }
  const restantes = sourcesSansWayback(ctx.racine, candidat).ids;
  console.log(restantes.length === 0 ? 'Toutes les sources ont une URL Wayback (hors exceptions motivées).' : `Sources encore sans wayback_url (${restantes.length}) : ${restantes.join(', ')}`);
}

function afficherExceptions(exceptions: string[]): void {
  if (exceptions.length > 0) console.log(`Exceptions motivées (archive.wayback_exception, jamais soumises) : ${exceptions.join(', ')}`);
}

// ---------- adoption d'un instantané existant (plan 09-03) ----------

interface ArgsAdoption {
  id: string;
  instantane: string;
  nouvelleUrl: string | undefined;
}

/**
 * Adopte un instantané Wayback déjà existant comme copie de la source : lecture seule de web.archive.org,
 * accepté seulement si chaque paragraphe de l'extrait archivé figure dans le texte de l'instantané.
 * N'écrit que le fichier de la source (url et wayback_url) ; jamais sous archives/.
 */
async function modeAdopter(ctx: Contexte, a: ArgsAdoption, deps: Dependances): Promise<void> {
  const src = lireSource(ctx.racine, a.id);
  refusSiException(src, 'adoption d’un instantané');
  const url = a.nouvelleUrl ?? src.data.url;
  const wayback = urlInstantane(a.instantane, url);
  if (wayback === null) throw new Sortie(2, `--instantane doit compter 14 chiffres (AAAAMMJJhhmmss, date réelle) et l'URL être en https : « ${a.instantane} », « ${url.slice(0, 200)} »`);

  const lu = readContained(ctx.racine, path.join(ctx.racine, src.data.archive.extrait));
  if ('diagnostic' in lu) throw new Sortie(1, `extrait archivé ${src.data.archive.extrait} : ${lu.diagnostic.message}`);
  if (sha256Hex(lu.text) !== src.data.archive.sha256) throw new Sortie(1, `l'extrait archivé ${src.data.archive.extrait} ne correspond plus à son sha256 : adoption refusée`);

  const instantane = await lireInstantane(a.instantane, url, deps);
  if (!instantane.ok) throw new Sortie(1, `instantané illisible : ${instantane.raison}`);
  const c = extraitDansInstantane(lu.text, instantane.texte);
  console.log(`Instantané lu : ${instantane.urlLue}`);
  console.log(`Paragraphes trouvés : ${c.trouves}/${c.total}`);
  if (c.total === 0 || c.trouves < c.total) {
    throw new Sortie(1, `adoption refusée : ${c.trouves}/${c.total} paragraphes de l'extrait trouvés dans l'instantané${c.premierManquant === null ? '' : ` ; premier absent : « ${c.premierManquant} »`}`);
  }

  const instant = parseSnapshotLocation(wayback)?.instant;
  if (instant !== undefined) {
    const jours = Math.round(Math.abs(instant.getTime() - new Date(src.data.archive.capture_le).getTime()) / 86_400_000);
    avertir(`écart entre la capture du dépôt (${src.data.archive.capture_le}) et l'instantané (${instant.toISOString()}) : ${jours} jour(s) ; contenu comparé paragraphe par paragraphe`);
  }
  if (src.data.archive.wayback_url !== undefined && src.data.archive.wayback_url !== wayback) {
    avertir(`la source avait déjà wayback_url ${src.data.archive.wayback_url} : remplacée`);
  }

  const p = paramsDe(src.data);
  p.url = url;
  p.archive.waybackUrl = wayback;
  const nouveau = buildSourceYaml(p);
  validerSeulement(ctx, p);
  const diff = diffUnifie(readFileSync(src.fichier, 'utf8'), nouveau, src.rel);
  if (ctx.dryRun) {
    console.log(diff === '' ? '[dry-run] aucun changement.' : `[dry-run] ${src.rel} n'est pas écrit ; diff proposé :\n${diff}`);
    return;
  }
  if (diff === '') {
    console.log(`${src.rel} : déjà à jour.`);
    return;
  }
  ecrireSource(ctx, p);
  console.log(`${src.rel} écrit :\n${diff}`);
}

// ---------- point d'entrée ----------

function lireArguments(argv: string[]): {
  mode: Mode;
  racine: string;
  ctx: Omit<Contexte, 'racine' | 'archivesDir'>;
  capture?: ArgsCapture;
  refresh?: string;
  adoption?: ArgsAdoption;
  ids: string[];
  candidat: string | undefined;
  file: string | undefined;
  captureLe: string | undefined;
} {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        candidat: { type: 'string', multiple: true },
        'source-id': { type: 'string' },
        type: { type: 'string' },
        auteur: { type: 'string' },
        titre: { type: 'string' },
        'date-publication': { type: 'string' },
        file: { type: 'string' },
        wayback: { type: 'boolean' },
        push: { type: 'boolean' },
        root: { type: 'string' },
        'dry-run': { type: 'boolean' },
        'allow-replacement-chars': { type: 'boolean' },
        'capture-le': { type: 'string' },
        refresh: { type: 'string' },
        'wayback-only': { type: 'boolean' },
        'wayback-missing': { type: 'boolean' },
        'sync-private': { type: 'boolean' },
        'wayback-adopter': { type: 'string' },
        instantane: { type: 'string' },
        'nouvelle-url': { type: 'string' },
        help: { type: 'boolean' },
      },
    });
  } catch (e) {
    throw new Sortie(2, e instanceof Error ? e.message : String(e));
  }
  const { values: v, positionals } = parsed;
  if (v.help === true) {
    console.log(USAGE);
    process.exit(0);
  }
  const modes = [
    v.refresh !== undefined ? 'refresh' : undefined,
    v['wayback-only'] === true ? 'wayback-only' : undefined,
    v['wayback-missing'] === true ? 'wayback-missing' : undefined,
    v['sync-private'] === true ? 'sync-private' : undefined,
    v['wayback-adopter'] !== undefined ? 'wayback-adopter' : undefined,
  ].filter((m): m is 'refresh' | 'wayback-only' | 'wayback-missing' | 'wayback-adopter' | 'sync-private' => m !== undefined);
  if (modes.length > 1) throw new Sortie(2, `modes incompatibles : ${modes.map((m) => `--${m}`).join(', ')}`);
  const mode: Mode = modes[0] ?? 'capture';

  if (v.root === undefined && path.resolve('.').split(path.sep).join('/').includes('/tests/fixtures/')) {
    throw new Sortie(2, 'le dossier courant est sous tests/fixtures/ : passer --root explicitement');
  }
  const racine = path.resolve(v.root ?? '.');
  const ctx = { push: v.push === true, dryRun: v['dry-run'] === true, wayback: v.wayback === true, allowReplacement: v['allow-replacement-chars'] === true };
  const base = { mode, racine, ctx, ids: [] as string[], candidat: v.candidat?.[0], file: v.file, captureLe: v['capture-le'] };

  if (mode === 'sync-private') {
    if (positionals.length > 0) throw new Sortie(2, '--sync-private n’accepte aucun argument');
    return base;
  }
  if (mode === 'wayback-only') {
    if (positionals.length === 0) throw new Sortie(2, '--wayback-only demande au moins un identifiant de source');
    return { ...base, ids: positionals };
  }
  if (mode === 'wayback-missing') {
    if (positionals.length > 0) throw new Sortie(2, '--wayback-missing n’accepte pas d’identifiant (voir --wayback-only)');
    if ((v.candidat?.length ?? 0) > 1) throw new Sortie(2, '--wayback-missing accepte un seul --candidat');
    return base;
  }
  if ((v.instantane !== undefined || v['nouvelle-url'] !== undefined) && mode !== 'wayback-adopter') {
    throw new Sortie(2, '--instantane et --nouvelle-url ne s’emploient qu’avec --wayback-adopter');
  }
  if (mode === 'wayback-adopter') {
    if (positionals.length > 0) throw new Sortie(2, '--wayback-adopter <source-id> n’accepte pas d’autre argument');
    if (v.instantane === undefined) throw new Sortie(2, '--wayback-adopter demande --instantane <14 chiffres>');
    if (!/^[0-9]{14}$/.test(v.instantane)) throw new Sortie(2, `--instantane doit compter 14 chiffres (AAAAMMJJhhmmss), reçu « ${v.instantane.slice(0, 40)} »`);
    const nouvelleUrl = v['nouvelle-url'];
    if (nouvelleUrl !== undefined && (!URL.canParse(nouvelleUrl) || new URL(nouvelleUrl).protocol !== 'https:')) {
      throw new Sortie(2, `--nouvelle-url doit être en https : « ${nouvelleUrl.slice(0, 200)} »`);
    }
    return { ...base, adoption: { id: v['wayback-adopter'] ?? '', instantane: v.instantane, nouvelleUrl } };
  }
  if (mode === 'refresh') {
    if (positionals.length > 0) throw new Sortie(2, '--refresh <source-id> n’accepte pas d’URL');
    return { ...base, refresh: v.refresh };
  }

  // capture
  if (positionals.length !== 1) throw new Sortie(2, `une URL est attendue (reçu ${positionals.length} argument(s))`);
  const url = positionals[0] ?? '';
  if (!URL.canParse(url) || new URL(url).protocol !== 'https:') throw new Sortie(2, `l'URL doit être en https : « ${url.slice(0, 200)} »`);
  const manquants = (['source-id', 'type', 'auteur', 'titre', 'date-publication'] as const).filter((k) => v[k] === undefined);
  if ((v.candidat?.length ?? 0) === 0) manquants.unshift('candidat' as never);
  if (manquants.length > 0) throw new Sortie(2, `options obligatoires manquantes : ${manquants.map((k) => `--${k}`).join(', ')}`);
  const candidats = v.candidat ?? [];
  const sourceId = v['source-id'] ?? '';
  const type = v.type ?? '';
  const auteur = v.auteur ?? '';
  const titre = v.titre ?? '';
  const datePublication = v['date-publication'] ?? '';
  for (const c of candidats) if (!ID_CANDIDAT.test(c)) throw new Sortie(2, `identifiant de candidat invalide : « ${c} »`);
  if (new Set(candidats).size !== candidats.length) throw new Sortie(2, '--candidat en double');
  if (!SLUG.test(sourceId) || sourceId.length > 80) throw new Sortie(2, `--source-id invalide (minuscules, chiffres et tirets, 80 caractères au plus) : « ${sourceId} »`);
  if (!(TYPES as readonly string[]).includes(type)) throw new Sortie(2, `--type invalide : « ${type} » (attendu : ${TYPES.join(', ')})`);
  if (!(AUTEURS as readonly string[]).includes(auteur)) throw new Sortie(2, `--auteur invalide : « ${auteur} » (attendu : ${AUTEURS.join(', ')})`);
  if (titre.trim() === '' || titre.length > 5000) throw new Sortie(2, '--titre doit faire entre 1 et 5000 caractères');
  if (!datePublicationValide(datePublication)) {
    throw new Sortie(2, `--date-publication invalide : « ${datePublication} » (attendu AAAA-MM ou AAAA-MM-JJ ; jamais devinée, voir RUNBOOK)`);
  }
  return { ...base, capture: { url, candidats, sourceId, type, auteur, titre, datePublication, file: v.file, captureLe: v['capture-le'] } };
}

/** Point d'entrée testable : `argv` sans `node` ni le nom du script ; lève `Sortie` pour un refus. */
export async function executer(argv: string[], deps: Dependances = {}): Promise<void> {
  const a = lireArguments(argv);
  if (!existsSync(path.join(a.racine, 'src', 'content'))) {
    throw new Sortie(2, `racine de contenu invalide : ${a.racine} ne contient pas src/content (voir --root)`);
  }
  const besoinDepot = a.mode === 'sync-private' || ((a.mode === 'capture' || a.mode === 'refresh') && !a.ctx.dryRun) || (a.mode === 'refresh' && a.ctx.dryRun);
  let archivesDir: string | undefined;
  if (besoinDepot) {
    try {
      archivesDir = resolveArchivesDir(process.env, a.racine);
    } catch (e) {
      if (a.mode === 'refresh' && a.ctx.dryRun) archivesDir = undefined;
      else if (e instanceof DepotPriveError) throw new Sortie(2, e.message);
      else throw e;
    }
  }
  const ctx: Contexte = { ...a.ctx, racine: a.racine, archivesDir };
  switch (a.mode) {
    case 'capture':
      if (a.capture === undefined) throw new Sortie(2, 'arguments de capture manquants');
      await modeCapture(ctx, a.capture);
      return;
    case 'refresh':
      await modeRefresh(ctx, a.refresh ?? '', a.file, a.captureLe);
      return;
    case 'wayback-only':
      // Refus avant toute soumission : une exception motivée n'est jamais envoyée (T-09-15).
      for (const id of a.ids) refusSiException(lireSource(ctx.racine, id), 'soumission à la Wayback Machine');
      await passeWayback(ctx, a.ids, undefined);
      return;
    case 'wayback-missing': {
      const { ids, exceptions } = sourcesSansWayback(ctx.racine, a.candidat);
      afficherExceptions(exceptions);
      await passeWayback(ctx, ids, a.candidat);
      return;
    }
    case 'wayback-adopter':
      if (a.adoption === undefined) throw new Sortie(2, 'arguments d’adoption manquants');
      await modeAdopter(ctx, a.adoption, deps);
      return;
    case 'sync-private': {
      if (archivesDir === undefined) throw new Sortie(2, 'dépôt privé reveleTonProg-archives non résolu');
      const r = await syncPrivate({ dossier: archivesDir, message: 'archive: synchronisation' });
      console.log(`Dépôt privé ${archivesDir} : ${r.commit ? 'commit créé, ' : 'rien à commiter, '}poussé.`);
      return;
    }
  }
}

if (import.meta.main) {
  executer(process.argv.slice(2)).catch((e: unknown) => {
    if (e instanceof Sortie) {
      console.error(e.message);
      process.exitCode = e.code;
    } else if (e instanceof DepotPriveError) {
      console.error(e.message);
      process.exitCode = 2;
    } else {
      console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
      process.exitCode = 1;
    }
  });
}
