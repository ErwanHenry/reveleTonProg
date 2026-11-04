// Import du jeu data.gouv « Candidatures à l'élection présidentielle 2027 — statuts sourcés »
// (2027 et moi, Licence Ouverte 2.0). Module PUR : aucun accès disque ni réseau, pour que les tests
// et la CLI (scripts/import-datagouv.ts) partagent exactement la même logique.
//
// Le jeu amont est une entrée non fiable : sa forme est vérifiée explicitement avant tout mapping, et
// `bloc`, `propositions`, `statut_detail` ne sont jamais lus par `mapRow` (ils ne survivent que dans
// l'instantané brut sous data/import/).
import { isSeq, parseDocument, stringify } from 'yaml';

export interface UpstreamRow {
  id: string;
  nom: string;
  parti: string;
  statut: string;
  source: { titre: string; url: string; date: string };
  liens: Record<string, string>;
  verifie_le: string;
  [k: string]: unknown;
}

export interface Correspondance {
  id: string;
  prenom: string;
  nom: string;
  nom_tri: string;
  motif?: 'retrait' | 'elimine_primaire' | 'ralliement' | 'non_candidat';
  type_source_statut: 'candidat' | 'parti' | 'institution' | 'presse';
}

export class UnknownUpstreamIdsError extends Error {
  ids: string[];
  constructor(ids: string[]) {
    super(`identifiant(s) amont absent(s) de data/import/correspondances.yaml : ${ids.join(', ')}`);
    this.name = 'UnknownUpstreamIdsError';
    this.ids = ids;
  }
}

/** Forme amont invalide (levée par checkUpstream et lireCorrespondances). */
export class UpstreamShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamShapeError';
  }
}

const CLES_RANG = ['id', 'nom', 'parti', 'bloc', 'statut', 'statut_detail', 'source', 'propositions', 'liens', 'verifie_le'] as const;
const CLES_HAUT = ['mise_a_jour', 'candidats'] as const;
const STATUTS = ['declare', 'primaire', 'pressenti', 'empeche', 'renonce'] as const;
const MOTIFS = ['retrait', 'elimine_primaire', 'ralliement', 'non_candidat'] as const;
const TYPES_SOURCE = ['candidat', 'parti', 'institution', 'presse'] as const;
const ID_AMONT = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_CANDIDAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/;

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function chaine(v: unknown, chemin: string): string {
  if (typeof v !== 'string') throw new UpstreamShapeError(`${chemin} : chaîne attendue`);
  if (CONTROLE.test(v)) throw new UpstreamShapeError(`${chemin} : caractère de contrôle refusé`);
  return v;
}

function urlHttps(v: unknown, chemin: string): string {
  const s = chaine(v, chemin);
  if (!URL.canParse(s) || new URL(s).protocol !== 'https:') throw new UpstreamShapeError(`${chemin} : URL https attendue`);
  return s;
}

function dateValide(v: unknown, chemin: string, partielle: boolean): string {
  const s = chaine(v, chemin);
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  const jour = m?.[3];
  const ok =
    m !== null &&
    (jour === undefined
      ? partielle && Number(m[2]) >= 1 && Number(m[2]) <= 12
      : new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(jour))).toISOString().slice(0, 10) === s);
  if (!ok) throw new UpstreamShapeError(`${chemin} : date AAAA-MM-JJ${partielle ? ' ou AAAA-MM' : ''} attendue`);
  return s;
}

/**
 * Vérifie la forme du jeu amont (aucune bibliothèque de schéma) et la renvoie typée.
 * Lève UpstreamShapeError sur toute anomalie ; les clés inconnues ne sont que signalées.
 */
export function checkUpstream(json: unknown): { miseAJour: string; rows: UpstreamRow[]; avertissements: string[] } {
  if (!estObjet(json)) throw new UpstreamShapeError('racine : objet attendu');
  const avertissements: string[] = [];
  for (const k of Object.keys(json)) {
    if (!(CLES_HAUT as readonly string[]).includes(k)) avertissements.push(`clé de premier niveau inconnue ignorée : « ${k.slice(0, 40)} »`);
  }
  const miseAJour = dateValide(json.mise_a_jour, 'mise_a_jour', false);
  const liste = json.candidats;
  if (!Array.isArray(liste)) throw new UpstreamShapeError('candidats : tableau attendu');
  const vus = new Set<string>();
  const inconnues = new Set<string>();
  const rows: UpstreamRow[] = liste.map((brut: unknown, i: number) => {
    const at = `candidats[${i}]`;
    if (!estObjet(brut)) throw new UpstreamShapeError(`${at} : objet attendu`);
    for (const k of CLES_RANG) {
      if (!(k in brut)) throw new UpstreamShapeError(`${at} : clé « ${k} » absente`);
    }
    for (const k of Object.keys(brut)) {
      if (!(CLES_RANG as readonly string[]).includes(k)) inconnues.add(k.slice(0, 40));
    }
    const id = chaine(brut.id, `${at}.id`);
    if (!ID_AMONT.test(id)) throw new UpstreamShapeError(`${at}.id : identifiant amont invalide (minuscules, chiffres, tirets)`);
    if (vus.has(id)) throw new UpstreamShapeError(`${at}.id : identifiant « ${id} » en double`);
    vus.add(id);
    const nom = chaine(brut.nom, `${at}.nom`);
    if (nom === '') throw new UpstreamShapeError(`${at}.nom : vide`);
    const parti = chaine(brut.parti, `${at}.parti`);
    chaine(brut.bloc, `${at}.bloc`);
    const statut = chaine(brut.statut, `${at}.statut`);
    if (!(STATUTS as readonly string[]).includes(statut)) throw new UpstreamShapeError(`${at}.statut : « ${statut.slice(0, 40)} » inconnu (attendu : ${STATUTS.join(', ')})`);
    chaine(brut.statut_detail, `${at}.statut_detail`);
    if (!Array.isArray(brut.propositions)) throw new UpstreamShapeError(`${at}.propositions : tableau attendu`);
    if (!estObjet(brut.source)) throw new UpstreamShapeError(`${at}.source : objet attendu`);
    const source = {
      titre: chaine(brut.source.titre, `${at}.source.titre`),
      url: urlHttps(brut.source.url, `${at}.source.url`),
      date: dateValide(brut.source.date, `${at}.source.date`, true),
    };
    if (!estObjet(brut.liens)) throw new UpstreamShapeError(`${at}.liens : objet attendu`);
    const liens: Record<string, string> = {};
    for (const [k, v] of Object.entries(brut.liens)) liens[k] = urlHttps(v, `${at}.liens.${k}`);
    const verifie_le = dateValide(brut.verifie_le, `${at}.verifie_le`, false);
    return { id, nom, parti, statut, source, liens, verifie_le };
  });
  if (inconnues.size > 0) avertissements.push(`clé(s) de ligne inconnue(s) ignorée(s) : ${[...inconnues].sort().join(', ')}`);
  return { miseAJour, rows, avertissements };
}

/** Valide la table à la main (déjà parsée) : forme, ids de candidat valides et uniques. */
export function lireCorrespondances(parsed: unknown): Record<string, Correspondance> {
  if (!estObjet(parsed) || parsed.version !== 1 || !estObjet(parsed.correspondances)) {
    throw new UpstreamShapeError('correspondances.yaml : « version: 1 » et « correspondances: » attendus');
  }
  const out: Record<string, Correspondance> = {};
  const ids = new Set<string>();
  for (const [amont, brut] of Object.entries(parsed.correspondances)) {
    const at = `correspondances.${amont}`;
    if (!estObjet(brut)) throw new UpstreamShapeError(`${at} : objet attendu`);
    const id = chaine(brut.id, `${at}.id`);
    if (!ID_CANDIDAT.test(id)) throw new UpstreamShapeError(`${at}.id : « ${id} » n'est pas un identifiant de candidat valide`);
    if (ids.has(id)) throw new UpstreamShapeError(`${at}.id : « ${id} » en double dans la table`);
    ids.add(id);
    const type = chaine(brut.type_source_statut, `${at}.type_source_statut`);
    if (!(TYPES_SOURCE as readonly string[]).includes(type)) throw new UpstreamShapeError(`${at}.type_source_statut : « ${type} » inconnu`);
    const entree: Correspondance = {
      id,
      prenom: chaine(brut.prenom, `${at}.prenom`),
      nom: chaine(brut.nom, `${at}.nom`),
      nom_tri: chaine(brut.nom_tri, `${at}.nom_tri`),
      type_source_statut: type as Correspondance['type_source_statut'],
    };
    if (brut.motif !== undefined) {
      const motif = chaine(brut.motif, `${at}.motif`);
      if (!(MOTIFS as readonly string[]).includes(motif)) throw new UpstreamShapeError(`${at}.motif : « ${motif} » inconnu`);
      entree.motif = motif as NonNullable<Correspondance['motif']>;
    }
    out[amont] = entree;
  }
  return out;
}

/** Fiche candidat issue d'une ligne amont, clés dans l'ordre fixe (rendu YAML déterministe). */
export function mapRow(row: UpstreamRow, corr: Record<string, Correspondance>): Record<string, unknown> {
  const c = Object.hasOwn(corr, row.id) ? corr[row.id] : undefined;
  if (c === undefined) throw new UnknownUpstreamIdsError([row.id]);
  const liens = row.liens;
  // A4 : un parti n'est affirmé que s'il existe une source de revendication (page du parti, à défaut
  // site de campagne du candidat). Sinon `parti: null`, jamais une étiquette sans source.
  const partiUrl = liens.parti ?? liens.campagne;
  const aParti = partiUrl !== undefined && row.parti !== '';
  const source: Record<string, unknown> = { type: c.type_source_statut };
  if (row.source.titre !== '') source.titre = row.source.titre;
  source.url = row.source.url;
  source.date_publication = row.source.date;
  source.date_consultation = row.verifie_le; // A3 : date de vérification amont, pas la date d'import
  const statut: Record<string, unknown> = { code: row.statut };
  if (row.statut === 'renonce' && c.motif !== undefined) statut.motif = c.motif;
  statut.date = row.source.date;
  statut.source = source;
  statut.statut_relecture = 'brouillon';
  const fiche: Record<string, unknown> = {
    version_schema: 1,
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    nom_tri: c.nom_tri,
    parti: aParti ? row.parti : null,
  };
  if (aParti) {
    fiche.parti_source = { type: liens.parti !== undefined ? 'parti' : 'candidat', url: partiUrl, date_consultation: row.verifie_le };
  }
  if (liens.campagne !== undefined) fiche.site_officiel = liens.campagne;
  fiche.ids_externes = { '2027etmoi': row.id };
  fiche.statuts = [statut];
  return fiche;
}

/** Date complète ou partielle -> chaîne comparable (AAAA-MM vaut le premier du mois). */
export function dateComparable(d: string): string {
  return d.length === 7 ? `${d}-01` : d;
}

type Obj = Record<string, unknown>;

/** Statut le plus récent par date (à date égale, le dernier de la liste) : même règle que la règle d'équité (A6). */
export function statutLePlusRecent(statuts: unknown[]): Obj {
  let meilleur = statuts[0] as Obj;
  for (const st of statuts) {
    if (dateComparable(String((st as Obj).date)) >= dateComparable(String(meilleur.date))) meilleur = st as Obj;
  }
  return meilleur;
}

/** Vrai si `a` est strictement antérieure à `b`, au niveau de précision commun (une date AAAA-MM ne se compare qu'au mois). */
export function dateAvant(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length) >= 10 ? 10 : 7;
  return a.slice(0, n) < b.slice(0, n);
}

/**
 * Fusion append-only : une fiche absente est créée ; une fiche présente garde son identité, son
 * historique et ses relectures. Un changement de (code, motif) AJOUTE une entrée à `statuts[]`
 * (jamais de modification ni de retrait) ; une date qui recule est un conflit.
 */
export function mergeFiche(
  existing: Obj | undefined,
  mapped: Obj,
): { fiche: Obj; action: 'cree' | 'statut_ajoute' | 'inchange'; notes: string[] } | { conflit: string } {
  if (existing === undefined) return { fiche: mapped, action: 'cree', notes: [] };
  const anciens = existing.statuts;
  const nouveaux = mapped.statuts;
  if (!Array.isArray(anciens) || anciens.length === 0 || !Array.isArray(nouveaux) || nouveaux.length === 0) {
    return { conflit: 'fichier existant sans statuts[] lisible : corriger à la main' };
  }
  const dernier = statutLePlusRecent(anciens);
  const amont = nouveaux[0] as Obj;
  const notes: string[] = [];
  if (existing.id !== mapped.id) return { conflit: `identifiant « ${String(existing.id)} » différent de la table (« ${String(mapped.id)} »)` };
  if (mapped.parti !== null && mapped.parti !== existing.parti) {
    notes.push(`parti amont « ${String(mapped.parti)} » différent du fichier (non appliqué)`);
  }
  if (mapped.site_officiel !== undefined && mapped.site_officiel !== existing.site_officiel) {
    notes.push(`site de campagne amont ${String(mapped.site_officiel)} différent du fichier (non appliqué)`);
  }
  const memeStatut = dernier.code === amont.code && dernier.motif === amont.motif;
  if (memeStatut) {
    const srcA = (dernier.source ?? {}) as Obj;
    const srcN = (amont.source ?? {}) as Obj;
    if (srcA.url !== srcN.url || dernier.date !== amont.date) notes.unshift('source amont modifiée (non appliquée : même statut)');
    return { fiche: existing, action: 'inchange', notes };
  }
  if (dateAvant(String(amont.date), String(dernier.date))) {
    return { conflit: `régression de date : amont ${String(amont.code)} du ${String(amont.date)} antérieur au dernier statut ${String(dernier.code)} du ${String(dernier.date)}` };
  }
  return { fiche: { ...existing, statuts: [...anciens, amont] }, action: 'statut_ajoute', notes };
}

/** Rendu YAML déterministe, sans commentaire : dates non guillemetées, aller-retour sans perte. */
export function renderYaml(o: unknown): string {
  return stringify(o, { schema: 'core', indent: 2, indentSeq: true, lineWidth: 0 });
}

/**
 * Ajoute un statut en fin de `statuts[]` en éditant le document en place (API Document de `yaml`) :
 * commentaires, ordre des clés et mise en forme du fichier existant sont conservés. Lève une Error
 * si le texte n'a pas de séquence `statuts`.
 */
export function ajouterStatutYaml(texte: string, statut: unknown): string {
  const doc = parseDocument(texte, { schema: 'core', uniqueKeys: true });
  if (doc.errors.length > 0) throw new Error(`YAML illisible : ${doc.errors[0]?.message ?? ''}`);
  const seq = doc.get('statuts', true);
  if (!isSeq(seq)) throw new Error('séquence statuts absente');
  seq.add(doc.createNode(statut));
  return doc.toString({ indent: 2, indentSeq: true, lineWidth: 0 });
}

export function snapshotName(miseAJour: string, sha256: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(miseAJour)) throw new UpstreamShapeError(`mise_a_jour invalide : ${miseAJour}`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new UpstreamShapeError('sha256 invalide');
  return `2027etmoi-candidats-${miseAJour}-${sha256.slice(0, 12)}.json`;
}
