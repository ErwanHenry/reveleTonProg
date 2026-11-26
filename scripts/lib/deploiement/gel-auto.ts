// Gel propre à la tâche planifiée (10.3, D-04, SC-2) : les gels des scrutins (garde-gel.ts) plus une fenêtre de
// retenue de l'automate autour de l'import de décembre 2026. La retenue contient le gel d'import du RUNBOOK
// (13 décembre 2026 18:00 au 15 décembre 2026 23:59, heure de Paris) : un test le vérifie.
// Question ouverte 1 de la recherche : réponse par défaut appliquée (retenue du 10 au 15 décembre 2026), à confirmer
// par Erwan. Pendant la retenue, deploy:auto ne publie rien (code 7) ; deploy:local reste utilisable à la main.
// N'importe que des modules relatifs.
import { decisionGel } from './gardes.ts';

export const GEL_AUTO = {
  debut: new Date('2026-12-10T00:00:00+01:00'),
  fin: new Date('2026-12-15T23:59:59+01:00'),
} as const;

/** L'automate peut-il publier à cet instant ? gele vrai : non, avec le motif en français. */
export function evaluerGelAuto(instant: Date): { gele: boolean; motif: string } {
  if (instant.getTime() >= GEL_AUTO.debut.getTime() && instant.getTime() <= GEL_AUTO.fin.getTime()) {
    return { gele: true, motif: "retenue de l'automate du 10 au 15 décembre 2026 (import de décembre)" };
  }
  const d = decisionGel(instant, false, '');
  return { gele: d.gele, motif: d.motif };
}
