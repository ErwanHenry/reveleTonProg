import { PERIMETRE_EQUITE } from './config.ts';
import type { CorpusRule, Finding } from './types.ts';

// REGLE-08 : équité. Sur un thème publié, tout candidat déclaré ou primaire (dernier statut de
// statuts[], quel que soit son statut de relecture : hypothèse A6, fail-closed) a soit une mesure
// publiée, soit une case de couverture. C'est la seule règle qui lit le mode : erreur en production,
// avertissement en preview.

const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export const regleEquite: CorpusRule = {
  id: 'equite',
  run(ctx) {
    // Un fichier invalide fait déjà échouer la CI par son erreur de schéma : pas de cascade.
    for (const c of ['candidats', 'themes', 'mesures', 'couverture'] as const) {
      if (ctx.corpus.aDesInvalides(c)) return [];
    }
    const severity = ctx.mode === 'production' ? 'error' : 'warning';
    const out: Finding[] = [];

    const perimetre = ctx.corpus
      .de('candidats')
      .filter((c) => {
        const statuts = tableau(c.data.statuts);
        const dernier = objet(statuts[statuts.length - 1]).code;
        return (PERIMETRE_EQUITE as readonly unknown[]).includes(dernier);
      })
      .map((c) => c.id)
      .sort();

    const mesuresPubliees = new Set<string>();
    for (const m of ctx.corpus.de('mesures')) {
      if (m.data.statut_relecture === 'publie') mesuresPubliees.add(`${String(m.data.theme)}\u0000${String(m.data.candidat)}`);
    }
    const aMesure = (theme: string, candidat: unknown): boolean => mesuresPubliees.has(`${theme}\u0000${String(candidat)}`);

    for (const theme of ctx.corpus.de('themes')) {
      if (theme.data.statut_relecture !== 'publie') continue;
      const couvertures = ctx.corpus.de('couverture').filter((c) => c.data.theme === theme.id);
      const casDeCouverture = new Set<string>();
      for (const couv of couvertures) {
        tableau(couv.data.cases).forEach((cas, i) => {
          const { candidat, etat } = objet(cas);
          casDeCouverture.add(String(candidat));
          const publiee = aMesure(theme.id, candidat);
          if (etat === 'mesures' && !publiee) {
            out.push({
              code: 'EQUITE_COUVERTURE_INCOHERENTE',
              severity,
              pointer: `/cases/${i}/etat`,
              file: couv.file,
              message: `la couverture du thème « ${theme.id} » dit que « ${String(candidat)} » a des mesures, mais aucune n'est publiée`,
            });
          } else if ((etat === 'non_precise' || etat === 'programme_non_publie') && publiee) {
            out.push({
              code: 'EQUITE_COUVERTURE_INCOHERENTE',
              severity,
              pointer: `/cases/${i}/etat`,
              file: couv.file,
              message: `la couverture du thème « ${theme.id} » indique « ${String(etat)} » pour « ${String(candidat)} », qui a pourtant une mesure publiée`,
            });
          }
        });
      }
      for (const id of perimetre) {
        if (aMesure(theme.id, id) || casDeCouverture.has(id)) continue;
        out.push({
          code: 'EQUITE_CANDIDAT_MANQUANT',
          severity,
          pointer: '/statut_relecture',
          file: theme.file,
          message: `le thème publié « ${theme.id} » n'a ni mesure publiée ni case de couverture pour le candidat « ${id} »`,
        });
      }
    }
    return out;
  },
};
