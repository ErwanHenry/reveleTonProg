import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from './validate-yaml.ts';

/** Corpus de référence valide, copié à chaque piège. */
export const BASE_CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
/** Dossier des pièges (un sous-dossier par piège). */
export const PIEGES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'pieges');

export interface Remplacement {
  fichier: string;
  de: string;
  par: string;
}

export interface ElementAttendu {
  code: string;
  severite: 'error' | 'warning';
  /** Chemin relatif à la racine de contenu, en POSIX. */
  fichier: string;
  pointer: string;
  /** Optionnelle : si présente, la ligne réelle doit être identique. */
  ligne?: number;
}

/** Contenu d'un `attendu.json`. */
export interface PiegeSpec {
  piege: string;
  regle: string;
  mode?: 'preview' | 'production';
  remplacer?: Remplacement[];
  supprimer?: string[];
  attendu: ElementAttendu[];
}

export interface DiagnosticPiege {
  code: string;
  severite: 'error' | 'warning';
  fichier: string;
  pointer: string;
  ligne: number;
}

const racines: string[] = [];

/** Supprime toutes les racines temporaires créées (à appeler depuis `after()`). */
export function nettoyerRacines(): void {
  for (const r of racines.splice(0)) rmSync(r, { recursive: true, force: true });
}

export function lirePiege(dossier: string): PiegeSpec {
  const brut = readFileSync(path.join(dossier, 'attendu.json'), 'utf8');
  const spec = JSON.parse(brut) as PiegeSpec;
  return spec;
}

/** Un chemin de piège est relatif à la racine de contenu et ne remonte jamais. */
function cheminSur(racine: string, rel: string): string {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new Error(`chemin de piège interdit (absolu ou avec « .. ») : ${rel}`);
  }
  const full = path.join(racine, rel);
  if (full !== racine && !full.startsWith(racine + path.sep)) throw new Error(`chemin de piège hors racine : ${rel}`);
  return full;
}

function copierSurcouche(dossier: string, racine: string, courant = dossier): void {
  for (const e of readdirSync(courant, { withFileTypes: true })) {
    const src = path.join(courant, e.name);
    const rel = path.relative(dossier, src);
    if (e.isDirectory()) {
      copierSurcouche(dossier, racine, src);
    } else if (e.isFile() && rel !== 'attendu.json') {
      const dst = cheminSur(racine, rel);
      mkdirSync(path.dirname(dst), { recursive: true });
      cpSync(src, dst);
    }
  }
}

/**
 * Copie le corpus valide dans un dossier temporaire, y superpose les fichiers du piège, supprime
 * les chemins `supprimer` puis applique les `remplacer` (exactement une occurrence, sinon erreur :
 * un patch sans effet ferait passer un piège à vide).
 */
export function construireRacine(piege: PiegeSpec, dossier?: string): string {
  const racine = mkdtempSync(path.join(os.tmpdir(), 'rtp-piege-'));
  racines.push(racine);
  cpSync(BASE_CORPUS, racine, { recursive: true });
  if (dossier !== undefined) copierSurcouche(dossier, racine);
  for (const rel of piege.supprimer ?? []) {
    const full = cheminSur(racine, rel);
    if (!existsSync(full)) throw new Error(`supprimer : « ${rel} » n'existe pas dans le corpus de base`);
    rmSync(full, { recursive: true, force: true });
  }
  for (const r of piege.remplacer ?? []) {
    const full = cheminSur(racine, r.fichier);
    if (!existsSync(full) || !statSync(full).isFile()) throw new Error(`remplacer : fichier « ${r.fichier} » introuvable`);
    const texte = readFileSync(full, 'utf8');
    const n = r.de === '' ? 0 : texte.split(r.de).length - 1;
    if (n !== 1) {
      throw new Error(`remplacer : le motif doit apparaître exactement une fois dans « ${r.fichier} » (${n} occurrence(s) pour ${JSON.stringify(r.de)})`);
    }
    // Fonction de remplacement : `par` est littéral, sans interprétation de `$&`.
    writeFileSync(full, texte.replace(r.de, () => r.par));
  }
  return racine;
}

/** Charge la racine temporaire et renvoie les diagnostics relativisés. */
export function executerPiege(piege: PiegeSpec, dossier?: string): DiagnosticPiege[] {
  const racine = construireRacine(piege, dossier);
  const res = loadAll(racine, { schemasDir: SCHEMAS_DIR, mode: piege.mode ?? 'production' });
  return res.diagnostics.map((d) => ({
    code: d.code,
    severite: d.severity,
    fichier: path.relative(racine, d.file).split(path.sep).join('/'),
    pointer: d.pointer,
    ligne: d.line,
  }));
}

const cle = (x: { code: string; severite: string; fichier: string; pointer: string }): string =>
  JSON.stringify([x.code, x.severite, x.fichier, x.pointer]);

/** Égalité d'ensembles exacte sur (code, severite, fichier, pointer) ; la ligne est vérifiée si attendue. */
export function comparer(reel: readonly DiagnosticPiege[], attendu: readonly ElementAttendu[]): void {
  const montrer = (xs: readonly (DiagnosticPiege | ElementAttendu)[]): string =>
    JSON.stringify(
      xs.map((x) => `${x.code} ${x.severite} ${x.fichier} « ${x.pointer} »${x.ligne === undefined ? '' : ` l.${x.ligne}`}`).sort(),
      null,
      2,
    );
  const r = [...reel].sort((a, b) => (cle(a) < cle(b) ? -1 : 1));
  const a = [...attendu].sort((x, y) => (cle(x) < cle(y) ? -1 : 1));
  const message = `diagnostics différents.\nattendu : ${montrer(a)}\nreçu : ${montrer(r)}`;
  assert.equal(r.length, a.length, message);
  for (let i = 0; i < a.length; i++) {
    const ra = r[i];
    const aa = a[i];
    assert.ok(ra !== undefined && aa !== undefined, message);
    assert.equal(cle(ra), cle(aa), message);
    if (aa.ligne !== undefined) assert.equal(ra.ligne, aa.ligne, `${message}\nligne différente pour ${aa.code} : attendu ${aa.ligne}, reçu ${ra.ligne}`);
  }
}
