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
