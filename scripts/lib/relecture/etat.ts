// État de la relecture d'un thème : ce qui reste à relire (mesures, statut retenu, case de couverture) pour
// chaque candidat du périmètre d'équité, calculé à partir de loadAll et du registre hors contenu.
// Toutes les alertes affichées viennent des diagnostics du moteur de règles (mêmes codes que la CI).

import { createHash } from 'node:crypto';
import { loadAll } from '../../../src/lib/content-core/load.ts';
import type { Entry, LoadOptions, LoadResult } from '../../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../../src/lib/content-core/diagnostics.ts';
import { PERIMETRE_EQUITE } from '../../../src/lib/content-core/rules/config.ts';
import { dansPerimetre, statutRetenu } from '../../../src/lib/content-core/rules/equite.ts';
import { dernieresEmpreintes, lireJournal, lireNotes, notesOuvertes } from './registre.ts';
import type { LigneNote } from './registre.ts';

/** Nom public du relecteur par défaut (D-04, D-05) : jamais lu dans l'environnement. */
export const RELECTEUR_DEFAUT = 'Erwan Henry';

export interface Contexte {
  racine: string;
  schemasDir: string;
  sortie(ligne: string): void;
  erreur(ligne: string): void;
  maintenant(): Date;
}
export type Commande = (argv: string[], ctx: Contexte) => Promise<number>;
export type Chargeur = (racine: string, opts: LoadOptions) => LoadResult;

export type EtatRelu = 'a_relire' | 'relu' | 'a_revoir' | 'publie';
export interface Alerte {
  code: string;
  severity: string;
  message: string;
}
interface CibleBase {
  cible: string;
  file: string;
  alertes: Alerte[];
  notes: LigneNote[];
}
export interface CibleMesure extends CibleBase {
  type: 'mesure';
  id: string;
  titre: string;
  etat: EtatRelu;
}
export interface CibleStatut extends CibleBase {
  type: 'statut';
  candidat: string;
  index: number;
  code: string;
  date: string;
  etat: EtatRelu;
}
export interface CibleCase extends CibleBase {
  type: 'case';
  theme: string;
  candidat: string;
  index: number;
  etat_case: string;
  verifie_le: string;
  verifie_par: string;
  etat: 'a_relire' | 'relu';
}
export interface EtatCandidat {
  id: string;
  nom: string;
  mesures: CibleMesure[];
  statut: CibleStatut | undefined;
  case: CibleCase | undefined;
}
export interface EtatTheme {
  theme: string;
  reste: number;
  total: number;
  candidats: EtatCandidat[];
}

// --- Cibles -------------------------------------------------------------------------------------------------

const SEG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RE_MESURE = new RegExp(`^(?:mesure:)?(${SEG})/(${SEG})$`);
const RE_STATUT = new RegExp(`^statut:(${SEG})$`);
const RE_CASE = new RegExp(`^case:(${SEG})/(${SEG})$`);
export const RE_SEGMENT = new RegExp(`^${SEG}$`);

export type Cible = { type: 'mesure'; id: string } | { type: 'statut'; candidat: string } | { type: 'case'; theme: string; candidat: string };

/** Identifiant de cible (jamais un chemin) : `mesure:<candidat>/<slug>` (ou `<candidat>/<slug>`), `statut:<candidat>`, `case:<theme>/<candidat>`. */
export function analyserCible(texte: string): Cible | undefined {
  let m = RE_MESURE.exec(texte);
  if (m) return { type: 'mesure', id: `${m[1]}/${m[2]}` };
  m = RE_STATUT.exec(texte);
  if (m) return { type: 'statut', candidat: m[1]! };
  m = RE_CASE.exec(texte);
  if (m) return { type: 'case', theme: m[1]!, candidat: m[2]! };
  return undefined;
}

export function nomCible(c: Cible): string {
  return c.type === 'mesure' ? `mesure:${c.id}` : c.type === 'statut' ? `statut:${c.candidat}` : `case:${c.theme}/${c.candidat}`;
}

// --- Empreinte du contenu relu ------------------------------------------------------------------------------

function canonique(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonique);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonique((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

function sha256(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonique(v)), 'utf8').digest('hex');
}

const CHAMPS_MESURE = ['titre', 'texte_source', 'source', 'source_localisation', 'chiffrage', 'redactions'] as const;

/** Empreinte des champs de rédaction et de sourçage d'une mesure (jamais des champs de relecture). */
export function empreinteMesure(data: Record<string, unknown>): string {
  return sha256(Object.fromEntries(CHAMPS_MESURE.filter((k) => data[k] !== undefined).map((k) => [k, data[k]])));
}

function sauf(o: Record<string, unknown>, cles: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !cles.includes(k)));
}

export function empreinteStatut(entree: Record<string, unknown>): string {
  return sha256(sauf(entree, ['statut_relecture', 'relecteur', 'date_relecture']));
}

export function empreinteCase(entree: Record<string, unknown>): string {
  return sha256(sauf(entree, ['verifie_le', 'verifie_par']));
}

// --- Chargement ---------------------------------------------------------------------------------------------

export interface Corpus {
  preview: LoadResult;
  production: LoadResult;
}

export function chargerCorpus(racine: string, schemasDir: string, charger: Chargeur = loadAll): Corpus {
  return { preview: charger(racine, { schemasDir, mode: 'preview' }), production: charger(racine, { schemasDir, mode: 'production' }) };
}

const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texte = (v: unknown): string => (typeof v === 'string' ? v : v === undefined ? '' : String(v));

export function entreesDe(r: LoadResult, collection: string): Entry[] {
  return r.entries.filter((e) => e.collection === collection);
}

/** Thèmes qui ont au moins une mesure, dans l'ordre des identifiants. */
export function themesAvecMesures(r: LoadResult): string[] {
  return [...new Set(entreesDe(r, 'mesures').map((m) => texte(m.data.theme)))].sort();
}

/** Diagnostics d'erreur des deux chargements, sans doublon (code, fichier, message). */
export function erreursDe(c: Corpus): Diagnostic[] {
  const vus = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of [...c.production.diagnostics, ...c.preview.diagnostics]) {
    if (d.severity !== 'error') continue;
    const k = `${d.code}\u0000${d.file}\u0000${d.message}`;
    if (vus.has(k)) continue;
    vus.add(k);
    out.push(d);
  }
  return out;
}

/** Fichiers qui concernent un thème : thème, couverture, mesures, fiches du périmètre ; plus tout fichier qui n'a pas pu se charger. */
export function erreursDuTheme(c: Corpus, theme: string): Diagnostic[] {
  const charges = new Set(c.production.entries.map((e) => e.file));
  const fichiers = new Set<string>();
  for (const e of c.production.entries) {
    if (e.collection === 'themes' && e.id === theme) fichiers.add(e.file);
    if (e.collection === 'couverture' && e.data.theme === theme) fichiers.add(e.file);
    if (e.collection === 'mesures' && e.data.theme === theme) fichiers.add(e.file);
    if (e.collection === 'candidats' && dansPerimetre(e.data.statuts, 'preview')) fichiers.add(e.file);
  }
  return erreursDe(c).filter((d) => fichiers.has(d.file) || !charges.has(d.file));
}

function alertes(diags: readonly Diagnostic[], filtre: (d: Diagnostic) => boolean): Alerte[] {
  return diags.filter((d) => d.severity !== 'error' && filtre(d)).map((d) => ({ code: d.code, severity: d.severity, message: d.message }));
}

// --- État d'un thème ----------------------------------------------------------------------------------------

export interface OptionsEtat {
  relecteur?: string;
  corpus?: Corpus;
  charger?: Chargeur;
}

export function etatRelecture(racine: string, schemasDir: string, theme: string, options: OptionsEtat = {}): EtatTheme {
  const corpus = options.corpus ?? chargerCorpus(racine, schemasDir, options.charger);
  const relecteur = options.relecteur ?? RELECTEUR_DEFAUT;
  const r = corpus.preview;
  const diags = corpus.production.diagnostics;
  const empreintes = dernieresEmpreintes(lireJournal(racine));
  const ouvertes = notesOuvertes(lireNotes(racine));
  const notes = (cible: string): LigneNote[] => ouvertes.get(cible) ?? [];
  const relu = (statut: unknown, cible: string, empreinte: string): EtatRelu => {
    if (statut !== 'relu' && statut !== 'publie') return 'a_relire';
    if (empreintes.get(cible)?.sha256 !== empreinte) return 'a_revoir';
    return statut === 'publie' ? 'publie' : 'relu';
  };
  const sources = new Map(entreesDe(r, 'sources').map((s) => [s.id, s.file]));
  const couverture = entreesDe(r, 'couverture').find((c) => c.data.theme === theme);
  const col = new Intl.Collator('fr');

  const candidats = entreesDe(r, 'candidats')
    .filter((c) => dansPerimetre(c.data.statuts, 'preview'))
    .sort((a, b) => col.compare(texte(a.data.nom_tri), texte(b.data.nom_tri)) || col.compare(a.id, b.id))
    .map((c): EtatCandidat => {
      const mesures = entreesDe(r, 'mesures')
        .filter((m) => m.data.candidat === c.id && m.data.theme === theme)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((m): CibleMesure => {
          const cible = `mesure:${m.id}`;
          const fichierSource = sources.get(texte(m.data.source));
          return {
            type: 'mesure',
            cible,
            id: m.id,
            file: m.file,
            titre: texte(m.data.titre),
            etat: relu(m.data.statut_relecture, cible, empreinteMesure(m.data)),
            alertes: alertes(diags, (d) => d.file === m.file || (d.file === fichierSource && d.code === 'ARCHIVE_WAYBACK_ABSENTE')),
            notes: notes(cible),
          };
        });
      const statuts = tableau(c.data.statuts);
      const retenu = statutRetenu(statuts, 'preview');
      const index = retenu === undefined ? -1 : statuts.indexOf(retenu);
      const cibleStatut = `statut:${c.id}`;
      const statut: CibleStatut | undefined =
        retenu === undefined
          ? undefined
          : {
              type: 'statut',
              cible: cibleStatut,
              candidat: c.id,
              file: c.file,
              index,
              code: texte(retenu.code),
              date: texte(retenu.date),
              etat: relu(retenu.statut_relecture, cibleStatut, empreinteStatut(retenu)),
              alertes: alertes(diags, (d) => d.file === c.file && (d.pointer === '' || d.pointer.startsWith(`/statuts/${index}`))),
              notes: notes(cibleStatut),
            };
      const cases = tableau(couverture?.data.cases);
      const indexCase = cases.findIndex((k) => objet(k).candidat === c.id);
      const cibleCase = `case:${theme}/${c.id}`;
      const k = objet(cases[indexCase]);
      const laCase: CibleCase | undefined =
        couverture === undefined || indexCase < 0
          ? undefined
          : {
              type: 'case',
              cible: cibleCase,
              theme,
              candidat: c.id,
              file: couverture.file,
              index: indexCase,
              etat_case: texte(k.etat),
              verifie_le: texte(k.verifie_le),
              verifie_par: texte(k.verifie_par),
              etat: k.verifie_par === relecteur ? 'relu' : 'a_relire',
              alertes: alertes(diags, (d) => d.file === couverture.file && d.pointer.startsWith(`/cases/${indexCase}/`)),
              notes: notes(cibleCase),
            };
      return { id: c.id, nom: `${texte(c.data.prenom)} ${texte(c.data.nom)}`.trim(), mesures, statut, case: laCase };
    });

  let total = 0;
  let reste = 0;
  const compter = (etat: string): void => {
    total++;
    if (etat !== 'relu' && etat !== 'publie') reste++;
  };
  for (const c of candidats) {
    for (const m of c.mesures) compter(m.etat);
    if (c.statut) compter(c.statut.etat);
    if (c.case) compter(c.case.etat);
  }
  return { theme, reste, total, candidats };
}

/** Le code de statut est-il dans le périmètre d'équité (declare, primaire) ? */
export function codeDansPerimetre(code: unknown): boolean {
  return (PERIMETRE_EQUITE as readonly unknown[]).includes(code);
}
