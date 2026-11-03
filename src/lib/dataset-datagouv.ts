import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml';
import { checkUpstream } from '../../scripts/lib/datagouv.ts';

// Faits sur le jeu data.gouv « statuts sourcés » (data/dataset-datagouv.yaml, racine du PROJET).
// Les nombres de lignes sont calculés depuis l'instantané versionné, dont le SHA-256 est vérifié
// contre son `.meta.json` : ils ne peuvent pas dériver de ce que la page Méthode affiche.

export interface DatasetDatagouv {
  page: string;
  producteur: string;
  licence: string;
  /** Nombre de personnes annoncé par la description du jeu (fait constaté). */
  annonce: number;
  descriptionConsulteeLe: string;
  instantane: {
    chemin: string;
    miseAJour: string;
    /** Calculé depuis l'instantané. */
    total: number;
    /** Calculé depuis l'instantané. */
    parStatut: Record<string, number>;
  };
}

const FICHIER = 'data/dataset-datagouv.yaml';
const CLES = ['page', 'producteur', 'licence', 'annonce', 'description_consultee_le', 'instantane'] as const;
const memo = new Map<string, DatasetDatagouv>();

function erreur(detail: string): Error {
  return new Error(`${FICHIER} : ${detail}`);
}

function dateReelle(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Lit et valide `data/dataset-datagouv.yaml` ; lève une Error qui nomme le fichier si quoi que ce soit cloche. */
export function loadDatasetDatagouv(projectRoot: string = process.cwd()): DatasetDatagouv {
  const racine = path.resolve(projectRoot);
  const connu = memo.get(racine);
  if (connu !== undefined) return connu;

  const fichier = path.join(racine, FICHIER);
  if (!existsSync(fichier)) throw erreur(`fichier introuvable (${fichier})`);

  const doc = parseDocument(readFileSync(fichier, 'utf8'), { schema: 'core', uniqueKeys: true, merge: false });
  if (doc.errors.length > 0) throw erreur(`YAML invalide (${(doc.errors[0]?.message ?? '').split('\n')[0]})`);
  let alias = false;
  visit(doc, {
    Alias: () => {
      alias = true;
    },
  });
  if (alias || isAlias(doc.contents)) throw erreur('les alias YAML ne sont pas acceptés');
  if (!isMap(doc.contents)) throw erreur(`la racine doit être un objet avec les clés ${CLES.join(', ')}`);

  const brut: Record<string, unknown> = {};
  for (const paire of doc.contents.items) {
    const cle = isScalar(paire.key) ? String(paire.key.value) : String(paire.key);
    if (!(CLES as readonly string[]).includes(cle)) throw erreur(`clé inconnue « ${cle.slice(0, 40)} » (attendu : ${CLES.join(', ')})`);
    brut[cle] = isScalar(paire.value) ? paire.value.value : undefined;
  }

  const { page, producteur, licence, annonce, description_consultee_le, instantane } = brut;
  if (typeof page !== 'string' || !page.startsWith('https://') || !URL.canParse(page)) throw erreur('« page » doit être une URL https:');
  if (typeof producteur !== 'string' || producteur.trim() === '') throw erreur('« producteur » est obligatoire');
  if (typeof licence !== 'string' || licence.trim() === '') throw erreur('« licence » est obligatoire');
  if (typeof annonce !== 'number' || !Number.isInteger(annonce) || annonce <= 0) throw erreur('« annonce » doit être un entier positif');
  if (!dateReelle(description_consultee_le)) throw erreur('« description_consultee_le » doit être une date réelle AAAA-MM-JJ');
  if (typeof instantane !== 'string' || !/^data\/import\/[A-Za-z0-9._-]+\.json$/.test(instantane) || instantane.endsWith('.meta.json')) {
    throw erreur('« instantane » doit être un fichier .json directement sous data/import/');
  }

  const cheminJson = path.join(racine, instantane);
  const cheminMeta = cheminJson.replace(/\.json$/, '.meta.json');
  if (!existsSync(cheminJson)) throw erreur(`instantané introuvable (${instantane})`);
  if (!existsSync(cheminMeta)) throw erreur(`méta de l'instantané introuvable (${path.basename(cheminMeta)})`);

  const octets = readFileSync(cheminJson);
  let meta: unknown;
  try {
    meta = JSON.parse(readFileSync(cheminMeta, 'utf8'));
  } catch {
    throw erreur(`${path.basename(cheminMeta)} n'est pas du JSON valide`);
  }
  const attendu = typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>).sha256 : undefined;
  if (typeof attendu !== 'string' || !/^[0-9a-f]{64}$/.test(attendu)) throw erreur(`${path.basename(cheminMeta)} : sha256 absent ou invalide`);
  const reel = createHash('sha256').update(octets).digest('hex');
  if (reel !== attendu) throw erreur(`SHA-256 de l'instantané différent de celui de sa méta (${instantane})`);

  let amont: ReturnType<typeof checkUpstream>;
  try {
    amont = checkUpstream(JSON.parse(octets.toString('utf8')));
  } catch (e) {
    throw erreur(`instantané invalide : ${(e as Error).message}`);
  }
  const parStatut: Record<string, number> = {};
  for (const r of amont.rows) parStatut[r.statut] = (parStatut[r.statut] ?? 0) + 1;

  const resultat: DatasetDatagouv = {
    page,
    producteur,
    licence,
    annonce,
    descriptionConsulteeLe: description_consultee_le,
    instantane: { chemin: instantane, miseAJour: amont.miseAJour, total: amont.rows.length, parStatut },
  };
  memo.set(racine, resultat);
  return resultat;
}
