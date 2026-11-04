// Dépôt privé des binaires d'archives (PDF, HTML) : `ErwanHenry/reveleTonProg-archives`, cloné à côté
// du projet. Aucun binaire n'entre jamais dans le dépôt public. `git` est lancé par `execFile`
// (tableau d'arguments, jamais de shell), avec délai et tampon bornés.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const NOM_DEPOT_PRIVE = 'reveleTonProg-archives';
const GIT_DELAI_MS = 120_000;
const GIT_TAMPON = 16 * 1024 * 1024;
const VERROU_ATTENTE_MAX_MS = 120_000;
const VERROU_PAS_MS = 1000;
const VERROU_PERIME_MS = 10 * 60 * 1000;
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class DepotPriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DepotPriveError';
  }
}

/**
 * Dossier du clone privé : `RTP_ARCHIVES_DIR` (une valeur relative se lit depuis la racine de contenu),
 * sinon le dossier voisin de la racine de contenu. Jamais relatif au dossier courant du processus.
 */
export function resolveArchivesDir(env: NodeJS.ProcessEnv, contentRoot: string): string {
  const racine = path.resolve(contentRoot);
  const choisi = env.RTP_ARCHIVES_DIR;
  const dossier = choisi !== undefined && choisi !== '' ? path.resolve(racine, choisi) : path.resolve(racine, '..', NOM_DEPOT_PRIVE);
  if (!existsSync(path.join(dossier, '.git'))) {
    throw new DepotPriveError(
      `clone du dépôt privé « ${NOM_DEPOT_PRIVE} » introuvable : ${dossier} n'est pas un dépôt git. ` +
        `Cloner ErwanHenry/${NOM_DEPOT_PRIVE} à côté du projet ou définir RTP_ARCHIVES_DIR.`,
    );
  }
  return dossier;
}

export interface MetaBinaire {
  source_id: string;
  url_demandee: string;
  url_finale: string;
  statut_http: number | null;
  content_type: string | null;
  bytes: number;
  binaire_sha256: string;
  extrait_sha256: string;
  capture_le: string;
  outil: 'fetch' | 'fichier-manuel';
}

export interface StoreBinaryParams {
  dossier: string;
  candidat: string;
  sourceId: string;
  binaire: Uint8Array;
  extension: 'pdf' | 'html';
  meta: MetaBinaire;
}

/** Chemins relatifs au clone, jamais sortis du clone. */
const cheminBinaire = (candidat: string, sha12: string, ext: string): string => `${candidat}/${sha12}.${ext}`;
export const cheminMeta = (candidat: string, sha12: string, sourceId: string): string => `${candidat}/${sha12}--${sourceId}.json`;

/**
 * Écrit `<candidat>/<sha12>.<ext>` seulement s'il est absent (mêmes octets : sans effet) et la fiche
 * `<candidat>/<sha12>--<source-id>.json` (une par source : deux sources qui partagent un binaire
 * n'écrivent jamais le même fichier). Renvoie les chemins réellement modifiés.
 */
export function storeBinary(p: StoreBinaryParams): { ecrits: string[] } {
  if (!SEGMENT.test(p.candidat)) throw new DepotPriveError(`nom de dossier candidat refusé : « ${p.candidat} »`);
  if (!SEGMENT.test(p.sourceId)) throw new DepotPriveError(`identifiant de source refusé : « ${p.sourceId} »`);
  const sha = createHash('sha256').update(p.binaire).digest('hex');
  if (sha !== p.meta.binaire_sha256) throw new DepotPriveError('le sha256 des métadonnées ne correspond pas aux octets du binaire');
  const sha12 = sha.slice(0, 12);
  const ecrits: string[] = [];
  mkdirSync(path.join(p.dossier, p.candidat), { recursive: true });

  const relBin = cheminBinaire(p.candidat, sha12, p.extension);
  const absBin = path.join(p.dossier, relBin);
  if (existsSync(absBin)) {
    const existant = createHash('sha256').update(readFileSync(absBin)).digest('hex');
    if (existant !== sha) throw new DepotPriveError(`${relBin} existe déjà avec un contenu différent (collision sur 12 caractères ?) : abandon`);
  } else {
    writeFileSync(absBin, p.binaire);
    ecrits.push(relBin);
  }

  const relMeta = cheminMeta(p.candidat, sha12, p.sourceId);
  const absMeta = path.join(p.dossier, relMeta);
  const json = `${JSON.stringify(p.meta, null, 2)}\n`;
  if (!existsSync(absMeta) || readFileSync(absMeta, 'utf8') !== json) {
    writeFileSync(absMeta, json);
    ecrits.push(relMeta);
  }
  return { ecrits };
}

/** Lit la fiche d'un binaire, ou undefined si elle est absente ou illisible. */
export function readMeta(dossier: string, candidat: string, binaireSha256: string, sourceId: string): MetaBinaire | undefined {
  if (!SEGMENT.test(candidat) || !SEGMENT.test(sourceId)) return undefined;
  try {
    return JSON.parse(readFileSync(path.join(dossier, cheminMeta(candidat, binaireSha256.slice(0, 12), sourceId)), 'utf8')) as MetaBinaire;
  } catch {
    return undefined;
  }
}

async function git(dossier: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: dossier,
      timeout: GIT_DELAI_MS,
      maxBuffer: GIT_TAMPON,
      encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return stdout;
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    throw new DepotPriveError(`git ${args[0] ?? ''} a échoué dans ${dossier} : ${(err.stderr ?? err.message ?? '').trim().slice(0, 600)}`);
  }
}

export interface OptionsSync {
  dossier: string;
  /** Chemins relatifs à ajouter ; absent = toutes les modifications en attente (`--sync-private`). */
  chemins?: readonly string[];
  message: string;
  attenteMaxMs?: number;
  pasMs?: number;
  perimeMs?: number;
  dormir?: (ms: number) => Promise<void>;
  maintenant?: () => number;
}

export interface ResultatSync {
  commit: boolean;
  pousse: boolean;
}

const dormirDefaut = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function prendreVerrou(verrou: string, o: OptionsSync): Promise<void> {
  const dormir = o.dormir ?? dormirDefaut;
  const maintenant = o.maintenant ?? Date.now;
  const attenteMax = o.attenteMaxMs ?? VERROU_ATTENTE_MAX_MS;
  const pas = o.pasMs ?? VERROU_PAS_MS;
  const perime = o.perimeMs ?? VERROU_PERIME_MS;
  const debut = maintenant();
  for (;;) {
    try {
      mkdirSync(verrou);
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    let age = 0;
    try {
      age = maintenant() - statSync(verrou).mtimeMs;
    } catch {
      continue; // libéré entre-temps
    }
    if (age > perime) {
      throw new DepotPriveError(
        `verrou ancien (${Math.round(age / 60000)} min) : ${verrou}. Vérifier qu'aucun autre archivage ne tourne, puis supprimer ce dossier à la main (l'outil ne le retire jamais seul).`,
      );
    }
    if (maintenant() - debut >= attenteMax) {
      throw new DepotPriveError(`verrou ${verrou} toujours pris après ${Math.round(attenteMax / 1000)} s : un autre archivage est en cours`);
    }
    await dormir(pas);
  }
}

/**
 * Sous verrou : ajoute (les fichiers écrits, ou tout), commit `message`, `pull --rebase`, `push`.
 * Rien à commiter n'empêche pas de pousser d'éventuels commits en retard.
 */
export async function syncPrivate(o: OptionsSync): Promise<ResultatSync> {
  const gitDir = (await git(o.dossier, ['rev-parse', '--absolute-git-dir'])).trim();
  const verrou = path.join(gitDir, 'rtp-archive.lock');
  await prendreVerrou(verrou, o);
  try {
    const cibles = o.chemins !== undefined && o.chemins.length > 0 ? ['--', ...o.chemins] : [];
    if (o.chemins === undefined) await git(o.dossier, ['add', '-A']);
    else if (o.chemins.length > 0) await git(o.dossier, ['add', ...cibles]);
    // Chemins fournis mais vides (relance idempotente) : rien n'a été écrit, donc rien à commiter ;
    // on ne regarde pas l'état global du clone (fichiers étrangers ou déjà indexés).
    const enAttente = o.chemins !== undefined && o.chemins.length === 0 ? '' : (await git(o.dossier, ['status', '--porcelain', ...cibles])).trim();
    let commit = false;
    if (enAttente !== '') {
      await git(o.dossier, ['commit', '--quiet', '-m', o.message, ...cibles]);
      commit = true;
    }
    const branche = (await git(o.dossier, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    const distante = (await git(o.dossier, ['ls-remote', '--heads', 'origin', branche])).trim();
    if (distante !== '') await git(o.dossier, ['pull', '--rebase', '--quiet', 'origin', branche]);
    await git(o.dossier, ['push', '--quiet', '-u', 'origin', 'HEAD']);
    return { commit, pousse: true };
  } finally {
    try {
      rmdirSync(verrou);
    } catch {
      // déjà libéré
    }
  }
}
