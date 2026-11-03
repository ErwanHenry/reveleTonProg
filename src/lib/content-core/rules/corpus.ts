import { regleArchives, regleSources } from './archives.ts';
import { regleChamps } from './champs.ts';
import { regleIdsVerrouilles, regleReferences } from './references.ts';
import type { Famille } from './types.ts';

// Famille « corpus » (REGLE-01, 07, 08, 12) : enregistrée par le plan 02-04.
export const famille: Famille = {
  id: 'corpus',
  fichier: [regleChamps],
  entree: [],
  corpus: [regleSources, regleArchives, regleReferences, regleIdsVerrouilles],
};
