import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_CORPUS } from './overlay.ts';
import { REPO_ROOT } from './validate-yaml.ts';

// Corpus M1 : surcouche fictive posée sur `corpus-valide` pour exercer toutes les pages de la
// phase 4 (périmètre, renoncement, « pressenti », états vides typés, glossaire, brouillon à ne
// jamais publier). Le corpus est ENTIÈREMENT FICTIF : n'y ajoutez jamais de contenu réel.
//
// La surcouche ne remplace que trois chemins du corpus de base : `ids.lock` (sur-ensemble de 6 ids),
// `src/content/couverture/logement.yaml` (cases ajoutées) et `config/publication.yml` (liste blanche : logement et climat). Tout autre fichier de la surcouche
// est nouveau ; `corpus-valide` lui-même n'est jamais modifié.
//
// Pour le parcourir à la main :
//   fnm exec --using=24 node tests/helpers/corpus-m1.ts /tmp/rtp-m1
//   RTP_CONTENT_ROOT=/tmp/rtp-m1 RTP_MODE=preview npm run dev

/** Dossier de la surcouche. */
export const CORPUS_M1 = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-m1');

/** Chemins du corpus de base que la surcouche a le droit de remplacer (POSIX, relatifs à la racine). */
export const SURCHARGES_AUTORISEES: readonly string[] = ['ids.lock', 'src/content/couverture/logement.yaml', 'config/publication.yml'];

/** Phrase piège présente uniquement dans le titre de la mesure en brouillon : elle ne doit jamais sortir dans le HTML. */
export const TRAPPE_BROUILLON = 'Guichet unique départemental';

const racines: string[] = [];

/**
 * Copie `corpus-valide`, puis y superpose la surcouche M1. Sans `dest`, crée un dossier temporaire
 * (supprimé par `nettoyerCorpusM1`) ; avec `dest`, le dossier ne doit pas exister ou doit être vide
 * et n'est jamais supprimé par ce module. Renvoie la racine de contenu absolue.
 */
export function materialiserCorpusM1(dest?: string): string {
  let racine: string;
  if (dest === undefined) {
    racine = mkdtempSync(path.join(os.tmpdir(), 'rtp-m1-'));
    racines.push(racine);
  } else {
    racine = path.resolve(dest);
    if (existsSync(racine) && readdirSync(racine).length > 0) {
      throw new Error(`materialiserCorpusM1 : « ${racine} » existe et n'est pas vide`);
    }
    mkdirSync(racine, { recursive: true });
  }
  cpSync(BASE_CORPUS, racine, { recursive: true });
  cpSync(CORPUS_M1, racine, { recursive: true, force: true });
  return racine;
}

/** Supprime les racines temporaires créées par `materialiserCorpusM1()` (jamais un `dest` fourni). */
export function nettoyerCorpusM1(): void {
  for (const r of racines.splice(0)) rmSync(r, { recursive: true, force: true });
}

// Ligne de commande : `node tests/helpers/corpus-m1.ts <dest>`.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dest = process.argv[2];
  if (dest === undefined || dest === '') {
    console.error('usage : node tests/helpers/corpus-m1.ts <dossier-destination>');
    process.exit(2);
  }
  console.log(materialiserCorpusM1(dest));
}
