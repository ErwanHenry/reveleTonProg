// Contexte partagé par les modules de cas de tests/dist/cas/*.cas.ts.
//
// Seul tests/dist/site.test.ts lance `astro build` : node --test exécute les fichiers en parallèle et
// deux builds concurrents dans le même projet se corrompent (cache `.astro` partagé, un des deux
// échoue à chaque fois). Ajoutez vos assertions dans tests/dist/cas/<tranche>.cas.ts
// (export default (ctx: ContexteSite) => void, qui déclare des it()) ; ce fichier n'est pas un test
// (pas de suffixe .test.ts) et ne lance rien.

export interface Build {
  /** Code de sortie d'`astro build` (null si tué par le délai). */
  status: number | null;
  /** stdout + stderr. */
  output: string;
  /** Dossier de sortie (temporaire, supprimé en fin d'exécution). */
  outDir: string;
}

export interface ContexteSite {
  /**
   * Construit le site pour `racine` (RTP_CONTENT_ROOT) et `mode` (RTP_MODE ; sans mode, la variable est
   * supprimée de l'environnement du build, jamais héritée de l'appelant). Les builds sont séquentiels
   * et mémorisés par `cle` : deux appels avec la même clé renvoient le même résultat sans reconstruire.
   */
  construire(cle: string, opts: { racine: string; mode?: 'preview' | 'production' }): Build;
  /** Contenu texte d'un fichier du dist (chemin relatif, séparateurs « / »). */
  lire(outDir: string, chemin: string): string;
  /** Tous les fichiers du dist (chemins absolus, triés). */
  fichiers(outDir: string): string[];
  /** Toutes les pages .html du dist (chemins absolus, triés). */
  pagesHtml(outDir: string): string[];
  /** Nouveau dossier temporaire, supprimé en fin d'exécution. */
  tmp(): string;
  repoRoot: string;
}
