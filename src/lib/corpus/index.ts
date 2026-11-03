// Vue-modèle du corpus : les pages passent ici, jamais par getCollection directement.
import { getCollection, getEntry } from 'astro:content';
import type { Candidat, Mesure, Source, StatutEntree } from './types.ts';

const collator = new Intl.Collator('fr');

export async function getCandidats(): Promise<Candidat[]> {
  const entries = await getCollection('candidats');
  // Les données sont déjà validées par content-core ; on caste une seule fois ici.
  const candidats = entries.map((e) => e.data as unknown as Candidat);
  return candidats.sort((a, b) => collator.compare(a.nom_tri, b.nom_tri));
}

/** Statut courant = dernière entrée de `statuts` (convention append-only). */
export function statutCourant(c: Candidat): StatutEntree {
  const dernier = c.statuts[c.statuts.length - 1];
  if (dernier === undefined) throw new Error(`candidat ${c.id} sans statut (le schéma exige minItems: 1)`);
  return dernier;
}

/** Mesures d'un candidat, triées par titre (ordre alphabétique français). */
export async function getMesuresDe(candidatId: string): Promise<Mesure[]> {
  const entries = await getCollection('mesures');
  const mesures = entries.map((e) => e.data as unknown as Mesure).filter((m) => m.candidat === candidatId);
  return mesures.sort((a, b) => collator.compare(a.titre, b.titre));
}

/** Source primaire par identifiant (slug) ; `undefined` si absente (règle de corpus en phase 2). */
export async function getSource(id: string): Promise<Source | undefined> {
  const entry = await getEntry('sources', id);
  return entry === undefined ? undefined : (entry.data as unknown as Source);
}
