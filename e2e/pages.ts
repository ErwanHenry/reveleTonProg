// Découverte des pages à tester, à partir du dossier `E2E_DIST` (jamais d'identifiant de thème en dur :
// le vrai corpus et la fixture ne publient pas les mêmes thèmes).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const NIVEAUX = ['resume', 'detaille', 'enfant', 'aine'] as const;
export type Niveau = (typeof NIVEAUX)[number];

export interface PageDist {
  url: string;
  fichier: string;
  aSelecteur: boolean;
  estTheme: boolean;
}

function marcher(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    return e.isDirectory() ? marcher(p) : [p];
  });
}

function lister(): readonly PageDist[] {
  const dist = path.resolve(process.env.E2E_DIST ?? 'dist-e2e/reel');
  return marcher(dist)
    .filter((f) => path.basename(f) === 'index.html')
    .sort()
    .map((fichier) => {
      const rel = path.relative(dist, path.dirname(fichier)).split(path.sep).join('/');
      const url = rel === '' ? '/' : `/${rel}/`;
      return {
        url,
        fichier,
        aSelecteur: readFileSync(fichier, 'utf8').includes('id="niv-resume"'),
        estTheme: /^\/themes\/[^/]+\/$/.test(url),
      };
    });
}

export const PAGES: readonly PageDist[] = lister();

/** Première page qui satisfait le prédicat ; erreur explicite sinon. */
export function premierePage(pred: (p: PageDist) => boolean, description = 'le prédicat'): PageDist {
  const p = PAGES.find(pred);
  if (!p) throw new Error(`Aucune page de ${process.env.E2E_DIST ?? 'dist-e2e/reel'} ne satisfait ${description}`);
  return p;
}
