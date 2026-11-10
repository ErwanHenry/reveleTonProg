// Adaptateur Astro du corpus : les pages et composants passent ici (getCorpus), jamais par
// getCollection directement. C'est le SEUL endroit où une page apprend le mode (RTP_MODE).
import { getCollection } from 'astro:content';
import { resolveContentRoot, resolveMode } from '../content-core/root.ts';
import { loadPublicationConfig } from '../publication-config.ts';
import type { Candidat, Couverture, EntreeGlossaire, Mesure, Source, Theme } from './types.ts';
import { construireCorpus } from './vue.ts';
import type { Brut, Corpus } from './vue.ts';

export * from './vue.ts';

let memo: Promise<Corpus> | undefined;

async function charger(): Promise<Corpus> {
  const [themes, candidats, mesures, sources, couverture, glossaire] = await Promise.all([
    getCollection('themes'),
    getCollection('candidats'),
    getCollection('mesures'),
    getCollection('sources'),
    getCollection('couverture'),
    getCollection('glossaire'),
  ]);
  // Les données sont déjà validées par content-core ; on caste une seule fois ici.
  const brut: Brut = {
    themes: themes.map((e) => e.data as unknown as Theme),
    candidats: candidats.map((e) => e.data as unknown as Candidat),
    mesures: mesures.map((e) => e.data as unknown as Mesure),
    sources: sources.map((e) => e.data as unknown as Source),
    couverture: couverture.map((e) => e.data as unknown as Couverture),
    glossaire: glossaire.map((e) => e.data as unknown as EntreeGlossaire),
  };
  // Liste blanche de publication (D-07), lue à la racine de contenu comme le loader : toujours passée, jamais optionnelle ici.
  const themesOuverts = new Set(loadPublicationConfig(resolveContentRoot(process.cwd())).themesOuverts);
  return construireCorpus(brut, resolveMode(undefined, process.env), themesOuverts);
}

/** Corpus tel que le visiteur le voit dans le mode du build (production par défaut, fail-closed). */
export function getCorpus(): Promise<Corpus> {
  memo ??= charger();
  return memo;
}
