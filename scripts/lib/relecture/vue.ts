// Fiche de relecture d'un candidat (D-04, PUB-01) : tout ce que la page locale affiche, calculé à partir du corpus
// (loadAll) et des diagnostics du validateur en mode production. Assemblage pur : aucun HTML, aucune écriture.
// Les alertes affichées sont celles de la CI (mêmes codes, mêmes messages) : aucune règle n'est recalculée ici.

import path from 'node:path';
import { readContained } from '../../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../../src/lib/content-core/diagnostics.ts';
import { cleanText, foldKey } from '../../../src/lib/content-core/rules/text/normalize.ts';
import { fragments } from '../../../src/lib/content-core/rules/text/verbatim.ts';
import { chargerCorpus, entreesDe, etatRelecture } from './etat.ts';
import type { Alerte, Corpus, EtatRelu, OptionsEtat } from './etat.ts';
import type { LigneNote } from './registre.ts';

/** Caractères affichés de part et d'autre de la citation localisée. */
export const MARGE_EXTRAIT = 400;
/** Caractères affichés quand la citation est introuvable (début de l'extrait). */
export const DEBUT_EXTRAIT = 800;

export interface Fenetre {
  trouve: boolean;
  avant: string;
  cite: string;
  apres: string;
}
export interface SourceFiche {
  id: string;
  titre: string;
  url: string;
  date_publication: string;
  date_consultation: string;
  capture_le: string;
  extrait_chemin: string;
  sha256: string;
  wayback_url?: string;
  wayback_exception?: string;
  alertes: Alerte[];
}
export interface MesureFiche {
  id: string;
  cible: string;
  titre: string;
  sous_theme: string;
  redactions: { resume: string; detaille: string; enfant: string; aine: string };
  texte_source: string;
  source_localisation: string;
  chiffrage?: { texte: string; source_localisation?: string };
  statut_relecture: string;
  etat: EtatRelu;
  notes: LigneNote[];
  source: SourceFiche | null;
  extrait: Fenetre | null;
  alertes: Alerte[];
}
export interface StatutFiche {
  cible: string;
  code: string;
  date: string;
  source: { type: string; titre: string; url: string; date_consultation: string } | null;
  statut_relecture: string;
  relecteur: string;
  date_relecture: string;
  etat: EtatRelu;
  notes: LigneNote[];
  alertes: Alerte[];
}
export interface SourceConsultee {
  id: string;
  titre: string;
  url: string;
  date_consultation: string;
}
export interface CaseFiche {
  cible: string;
  etat_case: string;
  sources_consultees: SourceConsultee[];
  verifie_le: string;
  verifie_par: string;
  etat: 'a_relire' | 'relu';
  /** Messages COUVERTURE_VERIFIEE_AVANT_SOURCE du validateur sur cette case (D-11, WR-05). */
  contradictions: string[];
  notes: LigneNote[];
  alertes: Alerte[];
}
export interface Fiche {
  theme: string;
  id: string;
  nom: string;
  parti: string;
  statut: StatutFiche | null;
  case: CaseFiche | null;
  mesures: MesureFiche[];
}
export interface ResumeCandidat {
  id: string;
  nom: string;
  a_relire: number;
  relu: number;
  a_revoir: number;
  notes_ouvertes: number;
}
export interface Resume {
  theme: string;
  reste: number;
  total: number;
  a_relire: number;
  relu: number;
  a_revoir: number;
  notes_ouvertes: number;
  candidats: ResumeCandidat[];
}

const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texte = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

// --- Fenêtre d'extrait --------------------------------------------------------------------------------------

/**
 * Texte « écrasé » pour la recherche : lettres et chiffres seulement, après cleanText (apostrophes, dont U+02BC,
 * espaces typographiques, invisibles) et foldKey (casse, accents, œ),
 * avec pour chaque caractère retenu l'offset (unité UTF-16) du caractère d'origine. Espaces, ponctuation,
 * apostrophes et caractères invisibles disparaissent : « l’école », « 1 500 » et « l'ecole », « 1500 » se rejoignent.
 */
function ecraser(s: string): { cle: string; debuts: number[]; fins: number[] } {
  let cle = '';
  const debuts: number[] = [];
  const fins: number[] = [];
  let i = 0;
  for (const ch of s) {
    const plie = foldKey(cleanText(ch)).replace(/[^\p{L}\p{N}]/gu, '');
    for (const c of plie) {
      cle += c;
      for (let k = 0; k < c.length; k++) {
        debuts.push(i);
        fins.push(i + ch.length);
      }
    }
    i += ch.length;
  }
  return { cle, debuts, fins };
}

const ESPACE = /\s/u;

/** Avance jusqu'au début du mot suivant (si `i` coupe un mot), sans dépasser `max`. */
function debutDeMot(s: string, i: number, max: number): number {
  if (i <= 0) return 0;
  let j = i;
  if (!ESPACE.test(s[j - 1] ?? ' ')) while (j < max && !ESPACE.test(s[j]!)) j++;
  while (j < max && ESPACE.test(s[j]!)) j++;
  return j;
}

/** Recule jusqu'à la fin du mot précédent (si `i` coupe un mot), sans descendre sous `min`. */
function finDeMot(s: string, i: number, min: number): number {
  if (i >= s.length) return s.length;
  let j = i;
  if (!ESPACE.test(s[j] ?? ' ')) while (j > min && !ESPACE.test(s[j - 1]!)) j--;
  while (j > min && ESPACE.test(s[j - 1]!)) j--;
  return j;
}

/**
 * Fenêtre de l'extrait archivé autour du premier fragment de la citation (fonction `fragments` du moteur) :
 * MARGE_EXTRAIT caractères avant et après, coupés aux limites de mots, en trois morceaux du texte d'origine.
 * Introuvable : les DEBUT_EXTRAIT premiers caractères dans `avant`, et `trouve: false`.
 */
export function fenetreExtrait(extrait: string, citation: string): Fenetre {
  const premier = fragments(citation)[0];
  const aiguille = premier === undefined ? '' : ecraser(premier).cle;
  const meule = ecraser(extrait);
  const pos = aiguille === '' ? -1 : meule.cle.indexOf(aiguille);
  if (pos < 0) {
    const fin = extrait.length > DEBUT_EXTRAIT ? finDeMot(extrait, DEBUT_EXTRAIT, 0) : extrait.length;
    return { trouve: false, avant: extrait.slice(0, fin), cite: '', apres: '' };
  }
  const debutCite = meule.debuts[pos]!;
  const finCite = meule.fins[pos + aiguille.length - 1]!;
  const debut = debutDeMot(extrait, Math.max(0, debutCite - MARGE_EXTRAIT), debutCite);
  const fin = finDeMot(extrait, Math.min(extrait.length, finCite + MARGE_EXTRAIT), finCite);
  return { trouve: true, avant: extrait.slice(debut, debutCite), cite: extrait.slice(debutCite, finCite), apres: extrait.slice(finCite, fin) };
}

// --- Fiche d'un candidat ------------------------------------------------------------------------------------

function versAlertes(diags: readonly Diagnostic[], filtre: (d: Diagnostic) => boolean): Alerte[] {
  return diags.filter(filtre).map((d) => ({ code: d.code, severity: d.severity, message: d.message }));
}

const sousPointeur = (pointer: string, racine: string): boolean => pointer === racine || pointer.startsWith(`${racine}/`);

export interface OptionsFiche extends OptionsEtat {
  corpus?: Corpus;
}

/** Fiche de relecture d'un candidat du périmètre pour un thème ; undefined si le candidat n'y est pas. */
export function ficheCandidat(racine: string, schemasDir: string, theme: string, candidat: string, options: OptionsFiche = {}): Fiche | undefined {
  const corpus = options.corpus ?? chargerCorpus(racine, schemasDir, options.charger);
  const etat = etatRelecture(racine, schemasDir, theme, { ...options, corpus });
  const ec = etat.candidats.find((c) => c.id === candidat);
  if (ec === undefined) return undefined;
  const r = corpus.preview;
  const diags = corpus.production.diagnostics;
  const entree = r.entries.find((e) => e.collection === 'candidats' && e.id === candidat);
  const sources = new Map(entreesDe(r, 'sources').map((s) => [s.id, s]));
  const mesures = new Map(entreesDe(r, 'mesures').map((m) => [m.id, m]));
  const extraits = new Map<string, string | null>();

  const ficheSource = (id: string): SourceFiche | null => {
    const s = sources.get(id);
    if (s === undefined) return null;
    const a = objet(s.data.archive);
    const exception = objet(a.wayback_exception);
    return {
      id,
      titre: texte(s.data.titre),
      url: texte(s.data.url),
      date_publication: texte(s.data.date_publication),
      date_consultation: texte(s.data.date_consultation),
      capture_le: texte(a.capture_le),
      extrait_chemin: texte(a.extrait),
      sha256: texte(a.sha256),
      ...(typeof a.wayback_url === 'string' ? { wayback_url: a.wayback_url } : {}),
      ...(typeof exception.motif === 'string' ? { wayback_exception: exception.motif } : {}),
      alertes: versAlertes(diags, (d) => d.file === s.file),
    };
  };
  /** Texte de l'extrait archivé, lu par readContained ; null si l'archive est signalée inutilisable ou illisible. */
  const lireExtrait = (src: SourceFiche): string | null => {
    if (extraits.has(src.id)) return extraits.get(src.id)!;
    let out: string | null = null;
    const inutilisable = src.alertes.some((x) => x.code.startsWith('ARCHIVE_') && x.severity === 'error' && x.code !== 'ARCHIVE_WAYBACK_ABSENTE');
    if (!inutilisable && /^archives\//.test(src.extrait_chemin)) {
      const lu = readContained(racine, path.join(racine, ...src.extrait_chemin.split('/')));
      if ('text' in lu) out = lu.text;
    }
    extraits.set(src.id, out);
    return out;
  };

  const ficheMesures = ec.mesures.map((cm): MesureFiche => {
    const m = mesures.get(cm.id);
    const d = m?.data ?? {};
    const red = objet(d.redactions);
    const ch = objet(d.chiffrage);
    const source = ficheSource(texte(d.source));
    const lu = source === null ? null : lireExtrait(source);
    return {
      id: cm.id,
      cible: cm.cible,
      titre: texte(d.titre),
      sous_theme: texte(d.sous_theme),
      redactions: { resume: texte(red.resume), detaille: texte(red.detaille), enfant: texte(red.enfant), aine: texte(red.aine) },
      texte_source: texte(d.texte_source),
      source_localisation: texte(d.source_localisation),
      ...(d.chiffrage !== undefined ? { chiffrage: { texte: texte(ch.texte), ...(ch.source_localisation !== undefined ? { source_localisation: texte(ch.source_localisation) } : {}) } } : {}),
      statut_relecture: texte(d.statut_relecture),
      etat: cm.etat,
      notes: cm.notes,
      source,
      extrait: lu === null ? null : fenetreExtrait(lu, texte(d.texte_source)),
      alertes: versAlertes(diags, (x) => x.file === cm.file),
    };
  });

  let statut: StatutFiche | null = null;
  if (ec.statut !== undefined && entree !== undefined) {
    const s = ec.statut;
    const brut = objet(tableau(entree.data.statuts)[s.index]);
    const src = brut.source === undefined || brut.source === null ? null : objet(brut.source);
    statut = {
      cible: s.cible,
      code: s.code,
      date: s.date,
      source: src === null ? null : { type: texte(src.type), titre: texte(src.titre), url: texte(src.url), date_consultation: texte(src.date_consultation) },
      statut_relecture: texte(brut.statut_relecture),
      relecteur: texte(brut.relecteur),
      date_relecture: texte(brut.date_relecture),
      etat: s.etat,
      notes: s.notes,
      alertes: versAlertes(diags, (x) => x.file === s.file && (x.pointer === '' || sousPointeur(x.pointer, `/statuts/${s.index}`))),
    };
  }

  let laCase: CaseFiche | null = null;
  if (ec.case !== undefined) {
    const k = ec.case;
    const couv = r.entries.find((e) => e.file === k.file);
    const brut = objet(tableau(couv?.data.cases)[k.index]);
    const alertes = versAlertes(diags, (x) => x.file === k.file && sousPointeur(x.pointer, `/cases/${k.index}`));
    laCase = {
      cible: k.cible,
      etat_case: k.etat_case,
      sources_consultees: tableau(brut.sources_consultees).map((id): SourceConsultee => {
        const s = sources.get(texte(id));
        return { id: texte(id), titre: texte(s?.data.titre), url: texte(s?.data.url), date_consultation: texte(s?.data.date_consultation) };
      }),
      verifie_le: k.verifie_le,
      verifie_par: k.verifie_par,
      etat: k.etat,
      contradictions: alertes.filter((a) => a.code === 'COUVERTURE_VERIFIEE_AVANT_SOURCE').map((a) => a.message),
      notes: k.notes,
      alertes,
    };
  }

  return { theme, id: ec.id, nom: ec.nom, parti: texte(entree?.data.parti), statut, case: laCase, mesures: ficheMesures };
}

// --- Résumé du thème ----------------------------------------------------------------------------------------

/** Liste des candidats du périmètre avec leurs compteurs, dans l'ordre d'affichage du site (nom_tri). */
export function resume(racine: string, schemasDir: string, theme: string, options: OptionsFiche = {}): Resume {
  const etat = etatRelecture(racine, schemasDir, theme, options);
  const total = { a_relire: 0, relu: 0, a_revoir: 0, notes_ouvertes: 0 };
  const candidats = etat.candidats.map((c): ResumeCandidat => {
    const n = { a_relire: 0, relu: 0, a_revoir: 0, notes_ouvertes: 0 };
    const cibles = [...c.mesures, ...(c.statut ? [c.statut] : []), ...(c.case ? [c.case] : [])];
    for (const x of cibles) {
      if (x.etat === 'relu' || x.etat === 'publie') n.relu++;
      else if (x.etat === 'a_revoir') n.a_revoir++;
      else n.a_relire++;
      n.notes_ouvertes += x.notes.length;
    }
    total.a_relire += n.a_relire;
    total.relu += n.relu;
    total.a_revoir += n.a_revoir;
    total.notes_ouvertes += n.notes_ouvertes;
    return { id: c.id, nom: c.nom, ...n };
  });
  return { theme, reste: etat.reste, total: etat.total, ...total, candidats };
}
