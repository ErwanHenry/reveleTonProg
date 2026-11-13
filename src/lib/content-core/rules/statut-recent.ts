import { statutLePlusRecent, statutRetenu } from './equite.ts';
import type { CorpusRule, Finding } from './types.ts';

// D-08, option B (Phase 10, import de décembre), décidée par Erwan le 2026-11-13 (réponse « Tout par défaut »).
//
// Situation visée : une personne dont le statut a été relu (production : `relu` ou `publie`) reçoit en amont un
// statut plus récent. L'import ajoute une entrée `brouillon` sans toucher à l'ancienne (ADR-041) : la production
// continue d'afficher l'ancien statut relu jusqu'à la relecture du nouveau, sans que rien ne s'allume.
// Cette règle le signale, à chaque validation, en nommant les deux statuts et leurs dates.
//
// Toujours un avertissement, dans tous les modes, jamais une erreur : une erreur de production bloquerait tous les
// déploiements, retraits d'urgence compris, et la fusion de la pull request d'import avec des personnes encore en
// brouillon (D-07). C'est la même asymétrie de sévérité que celle de l'ADR-060. La définition du statut retenu est
// unique (equite.ts, ADR-041) : on l'importe, on ne la recopie pas.
//
// Cette règle ne corrige rien : relire le statut (`npm run relecture -- marquer statut <candidat>`) reste un geste
// de l'éditeur. Elle ne dit rien d'une personne sans aucun statut relu (nouvelle personne : invisible en production,
// les pièges D-05 s'en occupent), ni d'une entrée non relue plus ancienne que le statut relu.

const RELUS = ['relu', 'publie'];

const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const chaine = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));

export const regleStatutPlusRecent: CorpusRule = {
  id: 'statut-plus-recent',
  run(ctx) {
    // Un fichier invalide fait déjà échouer la CI par son erreur de schéma : pas de cascade.
    if (ctx.corpus.aDesInvalides('candidats')) return [];
    const out: Finding[] = [];
    for (const c of ctx.corpus.de('candidats')) {
      const retenu = statutRetenu(c.data.statuts, 'production');
      const recent = statutLePlusRecent(c.data.statuts);
      if (retenu === undefined || recent === undefined || recent === retenu) continue;
      if (RELUS.includes(chaine(recent.statut_relecture))) continue;
      const index = tableau(c.data.statuts).indexOf(recent);
      out.push({
        code: 'STATUT_PLUS_RECENT_NON_RELU',
        severity: 'warning',
        pointer: `/statuts/${index}/statut_relecture`,
        file: c.file,
        message: `le statut le plus récent de ${c.id} (${chaine(recent.code)}, ${chaine(recent.date)}) n'est pas relu : la production affiche encore ${chaine(retenu.code)} du ${chaine(retenu.date)}`,
      });
    }
    return out;
  },
};
