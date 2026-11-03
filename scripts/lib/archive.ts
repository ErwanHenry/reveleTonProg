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

export interface ArchiveSource {
  extrait: string;
  sha256: string;
  capture_le: string;
  wayback_url?: string;
  binaire_sha256?: string;
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
    binaireSha256?: string;
  };
}

/** YAML d'une source, clés dans l'ordre fixe du contrat, sans commentaire. */
export function buildSourceYaml(p: ParamsSource): string {
  const archive: Record<string, string> = { extrait: p.archive.extrait, sha256: p.archive.sha256, capture_le: p.archive.captureLe };
  if (p.archive.waybackUrl !== undefined) archive.wayback_url = p.archive.waybackUrl;
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
