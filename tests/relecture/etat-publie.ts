import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { etatRelecture } from '../../scripts/lib/relecture/etat.ts';
import type { Contexte } from '../../scripts/lib/relecture/etat.ts';
import { publier } from '../../scripts/lib/relecture/commandes/publier.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

// Aides de test (pas de suffixe .test.ts : ce module n'est pas lancé comme un test) pour publier.test.ts et
// retirer.test.ts. Tout se passe sur la copie temporaire du corpus fictif M1 ; rien n'écrit dans le dépôt.

export const THEME = 'logement';
export const FICHIER_THEME = 'src/content/themes/logement.yaml';
export const FICHIER_COUVERTURE = 'src/content/couverture/logement.yaml';
export const MESURE_ELISE = 'src/content/mesures/elise-erard/guichet-unique.yaml';
export const MESURE_MARIE_1 = 'src/content/mesures/marie-fictive/aide-construction.yaml';
export const MESURE_MARIE_2 = 'src/content/mesures/marie-fictive/encadrement-loyers.yaml';
export const DATE = '2026-11-20';

export interface ContexteTest {
  ctx: Contexte;
  sortie: string[];
  erreur: string[];
}

export function contexteTest(racine: string, maintenant = new Date('2026-11-20T10:00:00+01:00')): ContexteTest {
  const sortie: string[] = [];
  const erreur: string[] = [];
  return { ctx: { racine, schemasDir: SCHEMAS_DIR, sortie: (l) => sortie.push(l), erreur: (l) => erreur.push(l), maintenant: () => maintenant }, sortie, erreur };
}

function fichiersMesures(c: CorpusRelecture): string[] {
  const base = path.join(c.racine, 'src', 'content', 'mesures');
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => `src/content/mesures/${f.split(path.sep).join('/')}`);
}

/**
 * Met le thème `logement` du corpus M1 dans l'état « prêt à publier » : le thème et toutes ses mesures repassent
 * à brouillon (corpus fictif, copie temporaire), la case d'Élise dit `mesures` (sa mesure va être publiée), puis
 * chaque cible du périmètre est relue par la vraie commande `marquer`. La liste blanche de M1 contient déjà logement.
 */
export function themePret(c: CorpusRelecture): void {
  c.ecrire(FICHIER_THEME, c.lire(FICHIER_THEME).replace('statut_relecture: publie', 'statut_relecture: brouillon'));
  for (const f of fichiersMesures(c)) {
    const t = c.lire(f);
    if (/^theme: logement$/m.test(t)) c.ecrire(f, t.replace('statut_relecture: publie', 'statut_relecture: brouillon'));
  }
  const avant = '  - candidat: elise-erard\n    etat: non_precise\n    verifie_le: 2026-10-24\n    verifie_par: Erwan Henry\n    sources_consultees:\n      - programme-commun-fictif\n';
  const apres = '  - candidat: elise-erard\n    etat: mesures\n    verifie_le: 2026-10-24\n    verifie_par: Erwan Henry\n';
  const couv = c.lire(FICHIER_COUVERTURE);
  if (!couv.includes(avant)) throw new Error('fixture inattendue : case d’Élise');
  c.ecrire(FICHIER_COUVERTURE, couv.replace(avant, apres));

  const etat = etatRelecture(c.racine, SCHEMAS_DIR, THEME);
  for (const cand of etat.candidats) {
    const cibles = [...cand.mesures, ...(cand.statut ? [cand.statut] : []), ...(cand.case ? [cand.case] : [])];
    for (const t of cibles) {
      const args = t.type === 'mesure' ? ['mesure', t.id] : t.type === 'statut' ? ['statut', t.candidat] : ['case', t.theme, t.candidat];
      const r = c.lancer('marquer', ...args, '--date', DATE);
      if (r.code !== 0) throw new Error(`marquer ${args.join(' ')} : ${r.stderr}`);
    }
  }
  const reste = etatRelecture(c.racine, SCHEMAS_DIR, THEME);
  if (reste.reste !== 0) throw new Error(`thème pas prêt : reste ${reste.reste}`);
}

/** Thème prêt, puis publié par la vraie fonction `publier`. */
export function themePublie(c: CorpusRelecture): void {
  themePret(c);
  const t = contexteTest(c.racine);
  const code = publier(THEME, { relecteur: 'Erwan Henry', date: DATE, dryRun: false }, { ctx: t.ctx });
  if (code !== 0) throw new Error(`publier a refusé : ${t.erreur.join(' | ')}`);
}

export function lireFichier(c: CorpusRelecture, relatif: string): string {
  return readFileSync(c.chemin(relatif), 'utf8');
}
