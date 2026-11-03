import { regleArchives, regleSources } from './archives.ts';
import type { Famille } from './types.ts';

// Famille « corpus » (REGLE-01, 07, 08, 12) : enregistrée par le plan 02-04.
export const famille: Famille = { id: 'corpus', fichier: [], entree: [], corpus: [regleSources, regleArchives] };
