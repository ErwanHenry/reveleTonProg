import { DUEL, FENETRES_BLOCAGE, SOMME_SONDAGE } from './config.ts';
import { citer } from './types.ts';
import type { EntryRule, Famille, Finding, LoadedEntry } from './types.ts';

// Famille « sondages » (REGLE-09) : somme des scores, tour et duel, doublons de candidat. Les seuils
// viennent de config.ts (jamais en dur ici). Aucun import node: : le module reste pur.

interface Score {
  candidat: string;
  pct: number;
}
interface Hypothese {
  nom: string;
  scores: Score[];
  autresPct: number;
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Lecture défensive d'une hypothèse : le schéma garantit la forme, mais la règle ne doit jamais lever. */
function lireHypothese(brut: unknown): Hypothese {
  const h = estObjet(brut) ? brut : {};
  const scores: Score[] = [];
  if (Array.isArray(h.scores)) {
    for (const s of h.scores) {
      const o = estObjet(s) ? s : {};
      scores.push({ candidat: typeof o.candidat === 'string' ? o.candidat : '', pct: typeof o.pct === 'number' ? o.pct : 0 });
    }
  }
  return {
    nom: typeof h.nom === 'string' ? h.nom : '',
    scores,
    autresPct: typeof h.autres_pct === 'number' ? h.autres_pct : 0,
  };
}

/** Pourcentage en centièmes entiers : 24,6 + 31,2 + 44,2 vaut exactement 10000 (pas de dérive flottante). */
const centiemes = (pct: number): number => Math.round(pct * 100);
const decimale = (centi: number): string => (centi / 100).toFixed(1).replace('.', ',');

/**
 * Fenêtre de blocage légal contenant cet instant, sinon undefined. `iso` porte son décalage horaire
 * (le schéma l'impose) : `Date.parse` donne un instant absolu, comparé aux bornes UTC de la config
 * (début inclus, fin exclue). Aucun constructeur de date en heure locale : le verdict ne dépend pas
 * du fuseau du processus.
 */
export function fenetreDe(iso: string): (typeof FENETRES_BLOCAGE)[number] | undefined {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return FENETRES_BLOCAGE.find((w) => t >= w.debut && t < w.fin);
}

const sondage: EntryRule = {
  id: 'sondage',
  run(e: LoadedEntry): Finding[] {
    // CR-02 : la règle ne vaut que pour les sondages ; une source (date_publication) ou toute
    // autre collection n'est pas un sondage publié.
    if (e.collection !== 'sondages') return [];
    const out: Finding[] = [];

    if (typeof e.data.date_publication === 'string') {
      const w = fenetreDe(e.data.date_publication);
      if (w) {
        out.push({
          code: 'SONDAGE_FENETRE_BLOCAGE',
          pointer: '/date_publication',
          message: `publication d'un sondage interdite ${w.libelle} (blocage légal, loi 77-808 art. 11)`,
        });
      }
    }

    const hypotheses = Array.isArray(e.data.hypotheses) ? e.data.hypotheses : [];
    const tour = e.data.tour;

    hypotheses.forEach((brut, i) => {
      const h = lireHypothese(brut);
      const pointer = `/hypotheses/${i}`;
      const sommeScores = h.scores.reduce((acc, s) => acc + centiemes(s.pct), 0);
      const somme = sommeScores + centiemes(h.autresPct);

      if (somme < SOMME_SONDAGE.min * 100 || somme > SOMME_SONDAGE.max * 100) {
        out.push({
          code: 'SONDAGE_SOMME_HORS_BORNES',
          pointer,
          message: `hypothèse « ${citer(h.nom)} » : les scores et « autres » totalisent ${decimale(somme)} % (bornes admises : ${SOMME_SONDAGE.min} à ${SOMME_SONDAGE.max} %)`,
        });
      }

      if (tour === 1) {
        // WR-07 : deux scores dont la somme est quasi complète, ou avec peu d'« autres » (blanc/nul).
        const duel = h.scores.length === DUEL.scores && (sommeScores >= DUEL.sommeMin * 100 || centiemes(h.autresPct) < DUEL.autresMax * 100);
        if (duel || DUEL.motif.test(h.nom)) {
          out.push({
            code: 'SONDAGE_TOUR2_EN_TOUR1',
            pointer,
            message: `hypothèse « ${citer(h.nom)} » : un duel de second tour ne peut pas figurer dans un sondage de premier tour (tour: 1)`,
          });
        }
      } else if (tour === 2 && h.scores.length !== DUEL.scores) {
        out.push({
          code: 'SONDAGE_TOUR1_EN_TOUR2',
          pointer,
          message: `hypothèse « ${citer(h.nom)} » : ${h.scores.length} scores dans un sondage de second tour (attendu : exactement ${DUEL.scores})`,
        });
      }

      const vus = new Set<string>();
      h.scores.forEach((s, j) => {
        if (vus.has(s.candidat)) {
          out.push({
            code: 'SONDAGE_CANDIDAT_DOUBLON',
            pointer: `${pointer}/scores/${j}`,
            message: `hypothèse « ${citer(h.nom)} » : le candidat « ${citer(s.candidat)} » apparaît deux fois`,
          });
        }
        vus.add(s.candidat);
      });
    });
    return out;
  },
};

export const famille: Famille = { id: 'sondages', fichier: [], entree: [sondage], corpus: [] };
