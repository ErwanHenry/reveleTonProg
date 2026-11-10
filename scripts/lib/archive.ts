// Règles de l'extrait archivé et de la source YAML (CONT-03). Module PUR : ni fichier, ni réseau,
// ni processus. L'horloge, le réseau et le disque sont gérés par scripts/archive-source.ts.
import { createHash } from 'node:crypto';
import { stringify } from 'yaml';

export const TAILLE_MAX_EXTRAIT = 5 * 1024 * 1024;
export const TAILLE_MAX_BINAIRE = 50 * 1024 * 1024;
export const LONGUEUR_MIN_EXTRAIT = 500;

export const sha256Hex = (octets: Uint8Array | string): string => createHash('sha256').update(octets).digest('hex');

/**
 * Normalise un extrait : NFC, fins de ligne LF, espaces de fin de ligne retirés, sauts de page
 * (U+000C, séparateurs de pages d'un PDF) conservés, pas de BOM, exactement un `\n` final.
 */
export function normalizeExtract(texte: string): string {
  const lignes = texte
    .normalize('NFC')
    .replace(/^\ufeff/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''));
  while (lignes.length > 0 && lignes[lignes.length - 1] === '') lignes.pop();
  return `${lignes.join('\n')}\n`;
}

/** Nom du fichier d'extrait (sans extension) : 12 premiers hex du sha256 des octets UTF-8. */
export const extractName = (texte: string): string => sha256Hex(texte).slice(0, 12);

export interface VerdictExtrait {
  erreurs: string[];
  avertissements: string[];
  octets: number;
  caracteres: number;
}

/** Contrôles de l'extrait normalisé : les erreurs refusent la capture, les avertissements informent. */
export function checkExtract(texte: string, opts: { allowReplacement?: boolean } = {}): VerdictExtrait {
  const octets = Buffer.byteLength(texte, 'utf8');
  const caracteres = [...texte.trim()].length;
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  if (octets > TAILLE_MAX_EXTRAIT) {
    erreurs.push(`extrait trop volumineux : ${octets} octets (maximum ${TAILLE_MAX_EXTRAIT} octets, soit 5 Mio)`);
  }
  if (caracteres < LONGUEUR_MIN_EXTRAIT) {
    erreurs.push(`extrait trop court : ${caracteres} caractères (minimum ${LONGUEUR_MIN_EXTRAIT}) ; mauvaise page, page vide ou contenu rendu côté client`);
  }
  const remplacements = texte.split('\ufffd').length - 1;
  if (remplacements > 0) {
    const message = `${remplacements} caractère(s) de remplacement U+FFFD dans l'extrait (ligature PDF perdue ou mauvais jeu de caractères) : une citation qui les traverse ne pourra jamais correspondre`;
    if (opts.allowReplacement === true) avertissements.push(message);
    else erreurs.push(`${message} ; choisir un autre passage ou un autre document, ou relancer avec --allow-replacement-chars`);
  }
  const cesures = texte.split('\u00ad').length - 1;
  if (cesures > 0) avertissements.push(`${cesures} trait(s) d'union conditionnel(s) (U+00AD) dans l'extrait`);
  const invisibles = (texte.match(/[\u200b-\u200d\u2060\ufeff]/g) ?? []).length;
  if (invisibles > 0) avertissements.push(`${invisibles} caractère(s) de largeur nulle dans l'extrait`);
  const coupures = texte.split('\n').filter((l) => l.endsWith('-')).length;
  if (coupures > 0) avertissements.push(`${coupures} ligne(s) se terminent par « - » (mot coupé ? rien n'est recollé automatiquement)`);
  return { erreurs, avertissements, octets, caracteres };
}

export interface ExceptionWayback {
  motif: string;
  decide_par: string;
  decide_le: string;
}

export interface ArchiveSource {
  extrait: string;
  sha256: string;
  capture_le: string;
  wayback_url?: string;
  wayback_exception?: ExceptionWayback;
  binaire_sha256?: string;
}

/** Données d'une source telles que lues dans son YAML (schéma validé). */
export interface DonneesSource {
  id: string;
  type: string;
  auteur: string;
  candidats: string[];
  titre: string;
  url: string;
  date_publication: string;
  date_consultation: string;
  archive: ArchiveSource;
}

export interface ParamsSource {
  id: string;
  type: string;
  auteur: string;
  candidats: readonly string[];
  titre: string;
  url: string;
  datePublication: string;
  dateConsultation: string;
  archive: {
    extrait: string;
    sha256: string;
    captureLe: string;
    waybackUrl?: string;
    /** Exception motivée (D-08) : jamais à côté de waybackUrl (le schéma le refuse). */
    waybackException?: { motif: string; decidePar: string; decideLe: string };
    binaireSha256?: string;
  };
}

/** YAML d'une source, clés dans l'ordre fixe du contrat, sans commentaire. */
export function buildSourceYaml(p: ParamsSource): string {
  const archive: Record<string, string | Record<string, string>> = { extrait: p.archive.extrait, sha256: p.archive.sha256, capture_le: p.archive.captureLe };
  if (p.archive.waybackUrl !== undefined) archive.wayback_url = p.archive.waybackUrl;
  if (p.archive.waybackException !== undefined) {
    const e = p.archive.waybackException;
    archive.wayback_exception = { motif: e.motif, decide_par: e.decidePar, decide_le: e.decideLe };
  }
  if (p.archive.binaireSha256 !== undefined) archive.binaire_sha256 = p.archive.binaireSha256;
  return stringify(
    {
      version_schema: 1,
      id: p.id,
      type: p.type,
      auteur: p.auteur,
      candidats: [...p.candidats],
      titre: p.titre,
      url: p.url,
      date_publication: p.datePublication,
      date_consultation: p.dateConsultation,
      archive,
    },
    { lineWidth: 0, schema: 'core' },
  );
}

/** Paramètres d'écriture d'une source lue : `buildSourceYaml(paramsDeSource(d))` redonne le même fichier. */
export function paramsDeSource(s: DonneesSource): ParamsSource {
  const e = s.archive.wayback_exception;
  return {
    id: s.id,
    type: s.type,
    auteur: s.auteur,
    candidats: s.candidats,
    titre: s.titre,
    url: s.url,
    datePublication: s.date_publication,
    dateConsultation: s.date_consultation,
    archive: {
      extrait: s.archive.extrait,
      sha256: s.archive.sha256,
      captureLe: s.archive.capture_le,
      ...(s.archive.wayback_url === undefined ? {} : { waybackUrl: s.archive.wayback_url }),
      ...(e === undefined ? {} : { waybackException: { motif: e.motif, decidePar: e.decide_par, decideLe: e.decide_le } }),
      ...(s.archive.binaire_sha256 === undefined ? {} : { binaireSha256: s.archive.binaire_sha256 }),
    },
  };
}

/**
 * Diff unifié ligne à ligne de deux petits textes (une source YAML : quelques dizaines de lignes),
 * trois lignes de contexte, en-têtes `a/<nom>` et `b/<nom>`. Chaîne vide si les textes sont identiques.
 */
export function diffUnifie(avant: string, apres: string, nom: string): string {
  if (avant === apres) return '';
  const a = avant.split('\n');
  const b = apres.split('\n');
  if (a[a.length - 1] === '') a.pop();
  if (b[b.length - 1] === '') b.pop();
  // Plus longue sous-suite commune (programmation dynamique, suffixes).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  type Op = { t: ' ' | '-' | '+'; l: string; ia: number; ib: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) ops.push({ t: ' ', l: a[i++]!, ia: i, ib: ++j });
    else if (i < a.length && (j >= b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) ops.push({ t: '-', l: a[i++]!, ia: i, ib: j });
    else ops.push({ t: '+', l: b[j++]!, ia: i, ib: j });
  }
  const CONTEXTE = 3;
  const sortie = [`--- a/${nom}`, `+++ b/${nom}`];
  let k = 0;
  while (k < ops.length) {
    if (ops[k]!.t === ' ') {
      k++;
      continue;
    }
    const debut = Math.max(0, k - CONTEXTE);
    let fin = k;
    // Étend le bloc tant que deux changements sont séparés par au plus 2 × CONTEXTE lignes communes.
    for (;;) {
      while (fin < ops.length && ops[fin]!.t !== ' ') fin++;
      let n = fin;
      while (n < ops.length && ops[n]!.t === ' ') n++;
      if (n < ops.length && n - fin <= 2 * CONTEXTE) fin = n;
      else break;
    }
    const finBloc = Math.min(ops.length, fin + CONTEXTE);
    const bloc = ops.slice(debut, finBloc);
    const lignesA = bloc.filter((o) => o.t !== '+').length;
    const lignesB = bloc.filter((o) => o.t !== '-').length;
    const premierA = bloc.find((o) => o.t !== '+');
    const premierB = bloc.find((o) => o.t !== '-');
    const startA = lignesA === 0 ? (bloc[0]?.ia ?? 0) : (premierA?.ia ?? 1);
    const startB = lignesB === 0 ? (bloc[0]?.ib ?? 0) : (premierB?.ib ?? 1);
    const plage = (debutL: number, n: number): string => (n === 1 ? `${debutL}` : `${debutL},${n}`);
    sortie.push(`@@ -${plage(startA, lignesA)} +${plage(startB, lignesB)} @@`);
    for (const o of bloc) sortie.push(`${o.t}${o.l}`);
    k = finBloc;
  }
  return `${sortie.join('\n')}\n`;
}

export type DecisionRafraichissement =
  | { decision: 'inchange'; waybackConserve: true; avertissements: string[] }
  | { decision: 'binaire_modifie'; waybackConserve: true; avertissements: string[] }
  | { decision: 'texte_modifie'; waybackConserve: false; avertissements: string[] };

/**
 * Que faire quand une source déjà archivée est capturée de nouveau.
 * - texte identique, binaire identique (ou jamais enregistré) : seules les dates sont rafraîchies, Wayback conservé ;
 * - texte identique, binaire différent : le nouveau binaire est stocké, Wayback conservé ;
 * - texte différent : nouvel extrait, ancienne URL Wayback retirée (elle montre l'ancien contenu), mesures à revérifier.
 */
export function refreshDecision(
  existant: { sha256: string; binaire_sha256?: string },
  nouveauSha256Texte: string,
  nouveauSha256Binaire: string,
): DecisionRafraichissement {
  if (existant.sha256 !== nouveauSha256Texte) {
    return {
      decision: 'texte_modifie',
      waybackConserve: false,
      avertissements: ['contenu modifié : relancer validate, les mesures citant cette source doivent être revérifiées'],
    };
  }
  if (existant.binaire_sha256 !== undefined && existant.binaire_sha256 !== nouveauSha256Binaire) {
    return {
      decision: 'binaire_modifie',
      waybackConserve: true,
      avertissements: ['le texte est identique mais le binaire a changé (mise en page, scripts) : nouveau binaire stocké'],
    };
  }
  return { decision: 'inchange', waybackConserve: true, avertissements: [] };
}
