// Table des collections de contenu : nom -> schéma + disposition des fichiers.
// Aucun import Astro ici : content-core sert aussi la CLI et la CI.

export const COLLECTIONS = {
  candidats: { schema: 'candidat', layout: 'flat' },
  themes: { schema: 'theme', layout: 'flat' },
  mesures: { schema: 'mesure', layout: 'par-candidat' }, // mesures/<candidat>/<slug>.yaml
  sources: { schema: 'source', layout: 'flat' },
  couverture: { schema: 'couverture', layout: 'flat' },
  glossaire: { schema: 'glossaire', layout: 'flat' },
  sondages: { schema: 'sondage', layout: 'flat' },
  journal: { schema: 'journal', layout: 'flat' },
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as readonly CollectionName[];
