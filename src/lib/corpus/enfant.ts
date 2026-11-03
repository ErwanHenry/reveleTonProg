// Texte « Pour les enfants » : découpe en segments texte / terme du glossaire. Module PUR (ni node:
// ni astro:), partagé avec le validateur pour la syntaxe des marqueurs [[affiché]] / [[affiché|id]].
import { MARQUEUR_GLOSSAIRE } from '../content-core/rules/config.ts';
import { slugGlossaire } from '../content-core/rules/text/normalize.ts';
import type { EntreeGlossaire } from './types.ts';

export type Segment =
  | { type: 'texte'; texte: string }
  | {
      type: 'terme';
      /** Mot tel qu'il apparaît dans la phrase. */
      affiche: string;
      /** Identifiant de l'entrée du glossaire. */
      id: string;
      /** Identifiant HTML du popover, unique dans la page : def-<prefixe>-<n>. */
      popId: string;
      definition: string;
      /** Pour une entrée `parti` : de qui viennent ces mots (date au format AAAA-MM-JJ). */
      source: { titre: string; date: string } | undefined;
    };

type Glossaire = ReadonlyMap<string, EntreeGlossaire>;

/** Identifiant visé par un marqueur : l'identifiant explicite, sinon le slug du mot affiché. */
function idDe(affiche: string, explicite: string | undefined): string {
  return explicite ?? slugGlossaire(affiche);
}

/**
 * Découpe un texte enfant en segments. Les segments texte gardent leurs espaces exacts (le JSX d'Astro
 * les conserve sous compressHTML). Un identifiant inconnu lève une erreur : le validateur garantit
 * la résolution pour tout contenu valide, donc c'est un défaut du build, pas une donnée à taire.
 */
export function segmenter(texte: string, glossaire: Glossaire, prefixe: string): Segment[] {
  const segments: Segment[] = [];
  let curseur = 0;
  let n = 0;
  // matchAll copie la regex globale : aucun état (lastIndex) n'est partagé entre appels.
  for (const m of texte.matchAll(MARQUEUR_GLOSSAIRE)) {
    const affiche = m[1] ?? '';
    const id = idDe(affiche, m[2]);
    const entree = glossaire.get(id);
    if (entree === undefined) {
      throw new Error(`Glossaire : « ${id} » (marqueur « ${m[0]} », ${prefixe}) n'existe pas`);
    }
    const debut = m.index ?? 0;
    if (debut > curseur) segments.push({ type: 'texte', texte: texte.slice(curseur, debut) });
    n += 1;
    segments.push({
      type: 'terme',
      affiche,
      id,
      popId: `def-${prefixe}-${n}`,
      definition: entree.definition,
      source:
        entree.type === 'parti' && entree.source !== undefined
          ? { titre: entree.source.titre ?? entree.libelle, date: entree.source.date_consultation }
          : undefined,
    });
    curseur = debut + m[0].length;
  }
  if (curseur < texte.length || segments.length === 0) segments.push({ type: 'texte', texte: texte.slice(curseur) });
  return segments;
}

/** Entrées distinctes utilisées par les textes enfant des mesures, triées par libellé (collation française). */
export function termesDe(
  mesures: readonly { mesure: { redactions: { enfant?: string | undefined } } }[],
  glossaire: Glossaire,
): EntreeGlossaire[] {
  const vus = new Map<string, EntreeGlossaire>();
  for (const { mesure } of mesures) {
    const enfant = mesure.redactions.enfant;
    if (enfant === undefined) continue;
    for (const m of enfant.matchAll(MARQUEUR_GLOSSAIRE)) {
      const id = idDe(m[1] ?? '', m[2]);
      const entree = glossaire.get(id);
      if (entree === undefined) throw new Error(`Glossaire : « ${id} » (marqueur « ${m[0]} ») n'existe pas`);
      vus.set(id, entree);
    }
  }
  const collateur = new Intl.Collator('fr');
  return [...vus.values()].sort((a, b) => collateur.compare(a.libelle, b.libelle));
}
