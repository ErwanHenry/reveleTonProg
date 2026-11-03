// Interfaces écrites à la main, alignées sur schemas/candidat.schema.json et
// schemas/defs/common.schema.json. Pas de Zod : content-core valide, ici on ne fait que typer.
// Toutes les dates sont des chaînes (AAAA-MM-JJ, AAAA-MM ou AAAA), jamais des Date.

export type TypeSource = 'candidat' | 'parti' | 'institution' | 'presse';
export type StatutRelecture = 'brouillon' | 'relu' | 'publie';
export type CodeStatut = 'declare' | 'primaire' | 'pressenti' | 'empeche' | 'renonce';
export type MotifRenoncement = 'retrait' | 'elimine_primaire' | 'ralliement' | 'non_candidat';

export interface Archive {
  extrait: string;
  sha256: string;
  capture_le: string;
  wayback_url?: string;
  binaire_sha256?: string;
}

export interface SourceStatut {
  type: TypeSource;
  titre?: string;
  url: string;
  date_publication?: string;
  date_consultation: string;
  archive?: Archive;
}

export interface StatutEntree {
  code: CodeStatut;
  motif?: MotifRenoncement;
  date: string;
  source: SourceStatut;
  statut_relecture: StatutRelecture;
  relecteur?: string;
  date_relecture?: string;
}

export interface Candidat {
  version_schema: 1;
  id: string;
  prenom: string;
  nom: string;
  nom_tri: string;
  parti: string | null;
  parti_source?: SourceStatut;
  site_officiel?: string;
  mandats_en_cours?: string[];
  ids_externes?: Record<string, string>;
  ordre_cc?: number;
  statuts: StatutEntree[];
}

export interface SousTheme {
  id: string;
  nom: string;
}

export interface Theme {
  version_schema: 1;
  id: string;
  nom: string;
  ordre: number;
  mots_cles?: string[];
  prioritaire_aine?: boolean;
  sous_themes: SousTheme[];
  statut_relecture: StatutRelecture;
  relecteur?: string;
  date_relecture?: string;
}

export type TypeSourcePrimaire = 'programme' | 'site_candidat' | 'site_parti' | 'discours' | 'tribune' | 'depot_cc';
export type AuteurSource = 'candidat' | 'parti_du_candidat' | 'coalition';

export interface Source {
  version_schema: 1;
  id: string;
  type: TypeSourcePrimaire;
  auteur: AuteurSource;
  candidats: string[];
  titre: string;
  url: string;
  date_publication: string;
  date_consultation: string;
  archive: Archive;
}

export interface Redactions {
  resume: string;
  detaille: string;
  enfant?: string;
  aine?: string;
}

export interface Chiffrage {
  texte: string;
  source_localisation?: string;
}

export interface Mesure {
  version_schema: 1;
  id: string;
  candidat: string;
  theme: string;
  sous_theme: string;
  titre: string;
  texte_source: string;
  source: string;
  source_localisation?: string;
  redactions: Redactions;
  chiffrage?: Chiffrage;
  statut_relecture: StatutRelecture;
  relecteur?: string;
  date_relecture?: string;
}

export type EtatCouverture = 'mesures' | 'non_precise' | 'programme_non_publie';

export interface CaseCouverture {
  candidat: string;
  etat: EtatCouverture;
  verifie_le: string;
  verifie_par: string;
  sources_consultees?: string[];
}

/** Aligné sur schemas/couverture.schema.json : une case par candidat du périmètre et par thème. */
export interface Couverture {
  version_schema: 1;
  id: string;
  theme: string;
  cases: CaseCouverture[];
}

/** Aligné sur schemas/glossaire.schema.json. */
export interface EntreeGlossaire {
  version_schema: 1;
  id: string;
  type: 'terme' | 'parti';
  libelle: string;
  definition: string;
  source?: SourceStatut;
}
