import { PERIMETRE_EQUITE } from './config.ts';
import type { CorpusRule, Finding, Mode } from './types.ts';

// REGLE-08 : équité. Sur un thème publié, tout candidat déclaré ou primaire (statut le plus récent de
// statuts[] par date, parmi les statuts relus ou publiés en production, tous en preview : ADR-041) a soit une mesure
// publiée, soit une case de couverture. Erreur en production, avertissement en
// preview (comme TEXTE_SOURCE_TROP_LONG). Un thème publié dont ce périmètre est vide (W2 : statuts pas
// encore relus) ne passe pas la règle sans rien vérifier : EQUITE_PERIMETRE_VIDE, même gravité.

const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/**
 * Statut le plus récent par date, pas le dernier de la liste (WR-12) : ni le schéma ni une règle
 * n'imposent l'ordre chronologique, et en insérer un en tête ou en fin ne doit pas changer le
 * périmètre en silence. Les dates ISO (AAAA-MM ou AAAA-MM-JJ) se comparent comme des chaînes ; à date
 * égale, le dernier de la liste l'emporte.
 */
export function statutLePlusRecent(statuts: unknown): Record<string, unknown> | undefined {
  let meilleur: Record<string, unknown> | undefined;
  for (const brut of tableau(statuts)) {
    const s = objet(brut);
    if (meilleur === undefined || String(s.date ?? '') >= String(meilleur.date ?? '')) meilleur = s;
  }
  return meilleur;
}

const RELUS = ['relu', 'publie'];

/**
 * Statut qui fait foi dans `mode` (ADR-041) : le plus récent des statuts relus ou publiés en production
 * (un brouillon ne change jamais qui figure sur une page publiée), le plus récent de tous en preview.
 * C'est LA définition partagée par le validateur, le view-model des pages et `check-dist`.
 */
export function statutRetenu(statuts: unknown, mode: Mode): Record<string, unknown> | undefined {
  const liste = tableau(statuts);
  return statutLePlusRecent(mode === 'production' ? liste.filter((s) => RELUS.includes(String(objet(s).statut_relecture))) : liste);
}

/**
 * Vrai si le statut retenu dans `mode` (statutRetenu) est dans PERIMETRE_EQUITE. Seule définition du
 * périmètre d'équité : validateur, view-model des pages, contrôle du pilote et tests passent par ici (W5).
 */
export function dansPerimetre(statuts: unknown, mode: Mode): boolean {
  return (PERIMETRE_EQUITE as readonly unknown[]).includes(statutRetenu(statuts, mode)?.code);
}

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
      .filter((c) => dansPerimetre(c.data.statuts, ctx.mode))
      .map((c) => c.id)
      .sort();

    const mesuresPubliees = new Set<string>();
    for (const m of ctx.corpus.de('mesures')) {
      if (m.data.statut_relecture === 'publie') mesuresPubliees.add(`${String(m.data.theme)}\u0000${String(m.data.candidat)}`);
    }
    const aMesure = (theme: string, candidat: unknown): boolean => mesuresPubliees.has(`${theme}\u0000${String(candidat)}`);

    for (const theme of ctx.corpus.de('themes')) {
      if (theme.data.statut_relecture !== 'publie') continue;
      if (perimetre.length === 0) {
        out.push({
          code: 'EQUITE_PERIMETRE_VIDE',
          severity,
          pointer: '/statut_relecture',
          file: theme.file,
          message: `le thème publié « ${theme.id} » n'a aucun candidat dans le périmètre d'équité (aucun statut ${PERIMETRE_EQUITE.join(' ou ')}${ctx.mode === 'production' ? ' relu ou publié' : ''}) : relire les statuts des candidats ou repasser le thème en brouillon`,
        });
      }
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
