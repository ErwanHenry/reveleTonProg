// Adaptateur Astro du corpus : les pages et composants passent ici (getCorpus), jamais par
// getCollection directement. C'est le SEUL endroit où une page apprend le mode (RTP_MODE).
import { getCollection } from 'astro:content';
import { resolveMode } from '../content-core/root.ts';
import type { Candidat, Couverture, EntreeGlossaire, Mesure, Source, StatutEntree, Theme } from './types.ts';
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
  return construireCorpus(brut, resolveMode(undefined, process.env));
}

/** Corpus tel que le visiteur le voit dans le mode du build (production par défaut, fail-closed). */
export function getCorpus(): Promise<Corpus> {
  memo ??= charger();
  return memo;
}

// ---------------------------------------------------------------------------
// Aides historiques de l'ancienne page d'accueil : remplacé par getCorpus ; retiré par le plan 04-06
// avec l'ancienne page d'accueil. Réimplémentées sur getCorpus pour obéir au filtre de mode.
// ---------------------------------------------------------------------------

export async function getCandidats(): Promise<Candidat[]> {
  return (await getCorpus()).candidats.map((c) => c.donnees);
}

/** Statut courant = dernière entrée de `statuts` (convention append-only). */
export function statutCourant(c: Candidat): StatutEntree {
  const dernier = c.statuts[c.statuts.length - 1];
  if (dernier === undefined) throw new Error(`candidat ${c.id} sans statut (le schéma exige minItems: 1)`);
  return dernier;
}

/** Mesures visibles d'un candidat (thèmes visibles, mode du build), triées par titre. */
export async function getMesuresDe(candidatId: string): Promise<Mesure[]> {
  return (await getCorpus()).mesures.filter((m) => m.mesure.candidat === candidatId).map((m) => m.mesure);
}

/** Source primaire par identifiant (slug) ; `undefined` si absente. */
export async function getSource(id: string): Promise<Source | undefined> {
  return (await getCorpus()).sources.get(id);
}
