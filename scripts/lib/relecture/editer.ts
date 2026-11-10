// Éditeur de relecture : écrit les seuls champs de relecture d'un fichier de contenu par insertion de
// texte aux positions des nœuds YAML (node.range), jamais en re-sérialisant le document (Pitfall 3 de
// la phase 9 : une re-sérialisation reformate les scalaires repliés de 25 mesures réelles).
//
// D-04 : l'outil n'a aucune fonction capable d'écrire un champ de rédaction. Les clés modifiables
// forment une liste fermée (CLES_ECRIVIBLES) ; toute autre clé lève EditionRefusee.
//
// Module pur (texte en entrée, texte en sortie) sauf ecrireAtomique, seul point qui touche le disque.

import { lstatSync, realpathSync, renameSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';
import type { Document, Pair, YAMLMap } from 'yaml';
import { PARSE_OPTIONS, TO_JS_OPTIONS } from '../../../src/lib/content-core/load.ts';

/** Liste fermée des clés que l'outil de relecture peut écrire (D-04). */
export const CLES_ECRIVIBLES = ['statut_relecture', 'relecteur', 'date_relecture', 'verifie_le', 'verifie_par', 'etat', 'sources_consultees'] as const;
export type CleEcrivible = (typeof CLES_ECRIVIBLES)[number];

export type Chemin = readonly (string | number)[];
export interface Champ {
  cle: string;
  valeur: string | readonly string[];
}
export interface OptionsEdition {
  /** Clé existante après laquelle insérer le premier champ s'il est absent (sinon : après la dernière clé de l'objet). */
  apres?: string;
}

export class EditionRefusee extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditionRefusee';
  }
}

// --- Validation des valeurs (rien qui demanderait des guillemets YAML n'est jamais écrit) -------------------

export const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const RE_RELECTEUR = /^\p{L}[\p{L} .'’-]{1,79}$/u;
export const RE_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const STATUTS_RELECTURE = ['brouillon', 'relu', 'publie'] as const;
export const ETATS_CASE = ['mesures', 'non_precise', 'programme_non_publie'] as const;
// Mots que le schéma YAML « core » lirait comme null ou booléen s'ils étaient écrits sans guillemets.
const MOTS_RESERVES = /^(?:null|true|false|~)$/i;

export function dateValide(s: string): boolean {
  const m = RE_DATE.exec(s);
  if (!m) return false;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j;
}

export function relecteurValide(s: string): boolean {
  return RE_RELECTEUR.test(s) && s === s.trim() && !/\s{2}/.test(s) && !MOTS_RESERVES.test(s);
}

function validerValeur(cle: string, valeur: string | readonly string[]): void {
  if (!(CLES_ECRIVIBLES as readonly string[]).includes(cle)) {
    throw new EditionRefusee(`clé « ${cle} » non modifiable par l’outil de relecture (clés permises : ${CLES_ECRIVIBLES.join(', ')})`);
  }
  const k = cle as CleEcrivible;
  if (k === 'sources_consultees') {
    if (!Array.isArray(valeur) || valeur.length === 0 || !valeur.every((v) => typeof v === 'string' && RE_SLUG.test(v))) {
      throw new EditionRefusee(`${cle} : liste non vide d’identifiants attendue`);
    }
    return;
  }
  if (typeof valeur !== 'string') throw new EditionRefusee(`${cle} : valeur texte attendue`);
  const ok =
    k === 'statut_relecture'
      ? (STATUTS_RELECTURE as readonly string[]).includes(valeur)
      : k === 'etat'
        ? (ETATS_CASE as readonly string[]).includes(valeur)
        : k === 'date_relecture' || k === 'verifie_le'
          ? dateValide(valeur)
          : relecteurValide(valeur);
  if (!ok) throw new EditionRefusee(`${cle} : valeur refusée « ${valeur} »`);
}

// --- Outils de texte ----------------------------------------------------------------------------------------

function finDeLigne(texte: string): string {
  return texte.includes('\r\n') ? '\r\n' : '\n';
}

function debutDeLigne(texte: string, offset: number): number {
  return texte.lastIndexOf('\n', offset - 1) + 1;
}

/** Offset juste après le saut de ligne qui termine la ligne contenant `offset` (ou la fin du texte). */
function apresLigne(texte: string, offset: number): number {
  const nl = texte.indexOf('\n', offset);
  return nl === -1 ? texte.length : nl + 1;
}

function analyser(texte: string): Document.Parsed {
  const doc = parseDocument(texte, { ...PARSE_OPTIONS, keepSourceTokens: false });
  if (doc.errors.length > 0 || doc.warnings.length > 0) {
    throw new EditionRefusee(`YAML illisible : ${[...doc.errors, ...doc.warnings][0]?.message.split('\n')[0]}`);
  }
  let alias = false;
  visit(doc, { Alias: () => void (alias = true) });
  if (alias) throw new EditionRefusee('alias YAML présent : fichier refusé');
  return doc;
}

function versJS(texte: string): unknown {
  return analyser(texte).toJS(TO_JS_OPTIONS);
}

function carte(doc: Document.Parsed, chemin: Chemin): YAMLMap {
  const noeud = chemin.length === 0 ? doc.contents : doc.getIn(chemin, true);
  if (!isMap(noeud)) throw new EditionRefusee(`chemin ${JSON.stringify(chemin)} : objet YAML introuvable`);
  return noeud as YAMLMap;
}

function paire(m: YAMLMap, cle: string): Pair | undefined {
  return m.items.find((p) => isScalar(p.key) && p.key.value === cle) as Pair | undefined;
}

/** Dernier offset (inclus) occupé par une paire : fin de la valeur, ou de la clé si la valeur est vide. */
function finDePaire(p: Pair): number {
  const v = p.value as { range?: [number, number, number] } | null;
  const k = p.key as { range?: [number, number, number] };
  const fin = v?.range ? v.range[1] : (k.range?.[1] ?? 0);
  const debut = k.range?.[0] ?? 0;
  return Math.max(fin - 1, debut);
}

function lignesListe(valeur: readonly string[], indentation: string, eol: string): string {
  return valeur.map((v) => `${indentation}  - ${v}${eol}`).join('');
}

function egal(a: unknown, b: string | readonly string[]): boolean {
  return isDeepStrictEqual(a, Array.isArray(b) ? [...b] : b);
}

// --- Écriture d'un champ ------------------------------------------------------------------------------------

function definirUnChamp(texte: string, chemin: Chemin, champ: Champ, precedente: string | undefined): string {
  const eol = finDeLigne(texte);
  const doc = analyser(texte);
  const m = carte(doc, chemin);
  if (m.flow) throw new EditionRefusee(`chemin ${JSON.stringify(chemin)} : objet en style flux, non modifiable`);
  const p = paire(m, champ.cle);
  const premiere = m.items[0];
  if (!premiere || !isScalar(premiere.key) || !premiere.key.range) throw new EditionRefusee('objet vide : insertion impossible');
  const colonne = premiere.key.range[0] - debutDeLigne(texte, premiere.key.range[0]);
  const indentation = ' '.repeat(colonne);
  const liste = Array.isArray(champ.valeur);

  if (p) {
    const v = p.value as { range?: [number, number, number] } | null;
    if (!v || !v.range) throw new EditionRefusee(`${champ.cle} : valeur vide, remplacement refusé`);
    if (liste) {
      if (!isSeq(v) || (v as { flow?: boolean }).flow) throw new EditionRefusee(`${champ.cle} : liste en bloc attendue`);
      const debut = apresLigne(texte, (p.key as { range: [number, number, number] }).range[0]);
      const fin = apresLigne(texte, finDePaire(p));
      const cleLigne = texte.slice(debutDeLigne(texte, (p.key as { range: [number, number, number] }).range[0]), debut);
      if (!new RegExp(`^\\s*(?:- )?${champ.cle}:\\s*(?:#.*)?\\r?\\n$`).test(cleLigne)) throw new EditionRefusee(`${champ.cle} : forme de liste inattendue`);
      return texte.slice(0, debut) + lignesListe(champ.valeur as readonly string[], indentation, eol) + texte.slice(fin);
    }
    if (!isScalar(v) || !['PLAIN', 'QUOTE_SINGLE', 'QUOTE_DOUBLE'].includes(String(v.type))) {
      throw new EditionRefusee(`${champ.cle} : valeur existante non scalaire sur une ligne, remplacement refusé`);
    }
    const ancien = texte.slice(v.range[0], v.range[1]);
    if (ancien.includes('\n')) throw new EditionRefusee(`${champ.cle} : valeur existante sur plusieurs lignes, remplacement refusé`);
    return texte.slice(0, v.range[0]) + (champ.valeur as string) + texte.slice(v.range[1]);
  }

  // Clé absente : nouvelle ligne après la dernière ligne de la clé précédente (ou de l'ancre, ou de l'objet).
  let ancre: Pair | undefined;
  if (precedente !== undefined) {
    ancre = paire(m, precedente);
    if (!ancre) throw new EditionRefusee(`clé d’ancrage « ${precedente} » absente`);
  } else {
    ancre = m.items[m.items.length - 1] as Pair;
  }
  const point = apresLigne(texte, finDePaire(ancre));
  const ligne = liste ? `${indentation}${champ.cle}:${eol}${lignesListe(champ.valeur as readonly string[], indentation, eol)}` : `${indentation}${champ.cle}: ${champ.valeur as string}${eol}`;
  // Fichier sans saut de ligne final : la nouvelle ligne est précédée du saut et le fichier reste sans saut final.
  if (point === texte.length && !texte.endsWith('\n')) return texte + eol + ligne.slice(0, -eol.length);
  return texte.slice(0, point) + ligne + texte.slice(point);
}

/**
 * Pose `champs` (dans l'ordre) dans l'objet YAML désigné par `chemin`. Une clé existante voit sa valeur
 * remplacée entre node.range[0] et node.range[1] ; une clé absente est insérée sur une nouvelle ligne juste
 * après la clé précédente de la liste (ou après `options.apres` pour la première). Le reste du texte est
 * conservé octet pour octet ; le résultat passe verifierSeulesCles avant d'être renvoyé.
 */
export function definirChamps(texte: string, chemin: Chemin, champs: readonly Champ[], options: OptionsEdition = {}): string {
  if (champs.length === 0) throw new EditionRefusee('aucun champ à écrire');
  const cles = champs.map((c) => c.cle);
  if (new Set(cles).size !== cles.length) throw new EditionRefusee('clé répétée dans la demande');
  for (const c of champs) validerValeur(c.cle, c.valeur);
  if (options.apres !== undefined && !/^[a-z_]+$/.test(options.apres)) {
    throw new EditionRefusee('clé d’ancrage invalide');
  }
  let courant = texte;
  champs.forEach((c, i) => {
    courant = definirUnChamp(courant, chemin, c, i === 0 ? options.apres : champs[i - 1]?.cle);
  });
  const lu = carte(analyser(courant), chemin);
  for (const c of champs) {
    const p = paire(lu, c.cle);
    const valeur = p && (isScalar(p.value) ? p.value.value : (p.value as { toJSON?: () => unknown } | null)?.toJSON?.());
    if (!egal(valeur, c.valeur)) throw new EditionRefusee(`${c.cle} : la valeur relue ne correspond pas à la valeur écrite`);
  }
  verifierSeulesCles(texte, courant, chemin, cles);
  return courant;
}

// --- Garde : seules les clés nommées ont changé -------------------------------------------------------------

export interface BilanLignes {
  ajoutees: number;
  modifiees: number;
  supprimees: number;
  /** Lignes de `apres` ajoutées ou modifiées (texte, sans fin de ligne). */
  touchees: string[];
}

/** Diff ligne à ligne (plus longue sous-suite commune) : chaque bloc de changements compte min(retirées, ajoutées) lignes modifiées. */
export function comparerLignes(avant: string, apres: string): BilanLignes {
  const a = avant.split('\n');
  const b = apres.split('\n');
  // Préfixe et suffixe communs d'abord : la table LCS ne couvre que la zone qui diffère.
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let fa = a.length;
  let fb = b.length;
  while (fa > debut && fb > debut && a[fa - 1] === b[fb - 1]) {
    fa--;
    fb--;
  }
  const za = a.slice(debut, fa);
  const zb = b.slice(debut, fb);
  const n = za.length;
  const m = zb.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i]![j] = za[i] === zb[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  const bilan: BilanLignes = { ajoutees: 0, modifiees: 0, supprimees: 0, touchees: [] };
  let retirees = 0;
  let ajoutees = 0;
  const clore = (): void => {
    const mod = Math.min(retirees, ajoutees);
    bilan.modifiees += mod;
    bilan.ajoutees += ajoutees - mod;
    bilan.supprimees += retirees - mod;
    retirees = 0;
    ajoutees = 0;
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && za[i] === zb[j]) {
      clore();
      i++;
      j++;
    } else if (j < m && (i >= n || t[i]![j + 1]! >= t[i + 1]![j]!)) {
      bilan.touchees.push(zb[j]!.replace(/\r$/, ''));
      ajoutees++;
      j++;
    } else {
      retirees++;
      i++;
    }
  }
  clore();
  return bilan;
}

function retirerCles(js: unknown, chemin: Chemin, cles: readonly string[]): unknown {
  const copie = structuredClone(js) as unknown;
  let noeud: unknown = copie;
  for (const pas of chemin) {
    if (noeud === null || typeof noeud !== 'object') throw new EditionRefusee(`chemin ${JSON.stringify(chemin)} introuvable`);
    noeud = (noeud as Record<string | number, unknown>)[pas];
  }
  if (noeud === null || typeof noeud !== 'object' || Array.isArray(noeud)) throw new EditionRefusee(`chemin ${JSON.stringify(chemin)} : objet attendu`);
  for (const c of cles) delete (noeud as Record<string, unknown>)[c];
  return copie;
}

/**
 * Lève EditionRefusee sauf si `apres` ne diffère de `avant` que par les clés `cles` de l'objet `chemin` :
 * les deux textes se lisent sans erreur ni alias ; leurs valeurs sont égales une fois ces clés retirées ;
 * le diff ligne à ligne compte au plus `cles.length` lignes modifiées, au plus `cles.length` lignes
 * ajoutées (plus les éléments d'une liste), aucune supprimée, et chaque ligne touchée porte une clé
 * nommée (ou un élément de liste).
 */
export function verifierSeulesCles(avant: string, apres: string, chemin: Chemin, cles: readonly string[]): BilanLignes {
  for (const c of cles) {
    if (!(CLES_ECRIVIBLES as readonly string[]).includes(c)) throw new EditionRefusee(`clé « ${c} » non modifiable par l’outil de relecture`);
  }
  const jsAvant = versJS(avant);
  const jsApres = versJS(apres);
  if (!isDeepStrictEqual(retirerCles(jsAvant, chemin, cles), retirerCles(jsApres, chemin, cles))) {
    throw new EditionRefusee('une clé hors de la liste demandée a changé : écriture refusée');
  }
  const bilan = comparerLignes(avant, apres);
  const lignesDeListe = bilan.touchees.filter((l) => /^\s*- [a-z][a-z0-9-]*$/.test(l)).length;
  const lignesCle = new RegExp(`^\\s*(?:- )?(?:${cles.join('|')}):(?: .*)?$`);
  if (bilan.supprimees > 0) throw new EditionRefusee(`${bilan.supprimees} ligne(s) supprimée(s) : écriture refusée`);
  if (bilan.modifiees > cles.length) throw new EditionRefusee(`${bilan.modifiees} lignes modifiées pour ${cles.length} clé(s) : écriture refusée`);
  if (bilan.ajoutees > cles.length + lignesDeListe) throw new EditionRefusee(`${bilan.ajoutees} lignes ajoutées pour ${cles.length} clé(s) : écriture refusée`);
  for (const l of bilan.touchees) {
    if (!lignesCle.test(l) && !/^\s*- [a-z][a-z0-9-]*$/.test(l)) throw new EditionRefusee(`ligne touchée hors des clés demandées : « ${l} »`);
  }
  return bilan;
}

// --- Écriture sur disque ------------------------------------------------------------------------------------

/**
 * Écrit `texte` dans `fichier` (fichier existant sous <racine>/src/content, jamais un lien symbolique) par
 * un fichier temporaire du même dossier puis un renommage atomique.
 */
export function ecrireAtomique(racine: string, fichier: string, texte: string): void {
  const base = path.join(path.resolve(racine), 'src', 'content');
  const cible = path.resolve(fichier);
  const relatif = path.relative(base, cible);
  if (relatif === '' || relatif.startsWith('..') || path.isAbsolute(relatif)) throw new EditionRefusee(`chemin hors de src/content : ${fichier}`);
  if (!existsSync(cible)) throw new EditionRefusee(`fichier introuvable : ${fichier}`);
  if (lstatSync(cible).isSymbolicLink()) throw new EditionRefusee(`lien symbolique refusé : ${fichier}`);
  if (!statSync(cible).isFile()) throw new EditionRefusee(`fichier non régulier refusé : ${fichier}`);
  const baseReelle = realpathSync(base);
  if (!realpathSync(cible).startsWith(baseReelle + path.sep)) throw new EditionRefusee(`le fichier se résout hors de src/content : ${fichier}`);
  const temporaire = path.join(path.dirname(cible), `.${path.basename(cible)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    writeFileSync(temporaire, texte, { encoding: 'utf8', flag: 'wx', mode: statSync(cible).mode & 0o777 });
    renameSync(temporaire, cible);
  } catch (e) {
    rmSync(temporaire, { force: true });
    throw e;
  }
}
