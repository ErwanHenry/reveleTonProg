import { defineCollection } from 'astro:content';
import { contentCoreLoader } from './lib/content-core/astro-loader.ts';

// Aucun schéma ici : content-core valide tout (un seul parseur pour la CLI, la CI et Astro).
export const collections = {
  candidats: defineCollection({ loader: contentCoreLoader('candidats') }),
  themes: defineCollection({ loader: contentCoreLoader('themes') }),
  mesures: defineCollection({ loader: contentCoreLoader('mesures') }),
  sources: defineCollection({ loader: contentCoreLoader('sources') }),
  couverture: defineCollection({ loader: contentCoreLoader('couverture') }),
  glossaire: defineCollection({ loader: contentCoreLoader('glossaire') }),
  sondages: defineCollection({ loader: contentCoreLoader('sondages') }),
  journal: defineCollection({ loader: contentCoreLoader('journal') }),
};
