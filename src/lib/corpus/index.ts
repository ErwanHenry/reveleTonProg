// Vue-modèle du corpus : les pages passent ici, jamais par getCollection directement.
import { getCollection } from 'astro:content';
import type { Candidat, StatutEntree } from './types.ts';

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
