// Module PUR (ni node: ni astro:) : la définition unique de « thème ouvert » (D-07), partagée par le validateur,
// le view-model des pages (src/lib/corpus/vue.ts, qui reste pur) et check-dist. Réexportée par publication-config.ts.

/** Vrai si le thème est dans la liste blanche de publication. */
export function estOuvert(themesOuverts: ReadonlySet<string> | readonly string[], id: string): boolean {
  return Array.isArray(themesOuverts) ? themesOuverts.includes(id) : (themesOuverts as ReadonlySet<string>).has(id);
}
