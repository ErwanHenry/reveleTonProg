import { loadPublicationConfig } from '../../publication-config.ts';
import type { PublicationConfig } from '../../publication-config.ts';
import type { CorpusRule, Finding } from './types.ts';

// REGLE-13 : liste blanche de publication (D-07). Un thème n'est visible en production que s'il est
// `publie` ET listé dans config/publication.yml (lu depuis la racine de contenu). Sens dangereux (publié mais
// pas ouvert) : erreur en production, avertissement en preview. Sens sûr (listé mais pas publié) : avertissement,
// pour qu'un retrait d'urgence qui repasse un thème en brouillon ne bloque jamais un déploiement.

const AU_DEBUT = { line: 1, col: 1 } as const;

export const reglePublication: CorpusRule = {
  id: 'publication',
  run(ctx) {
    const out: Finding[] = [];
    let cfg: PublicationConfig;
    try {
      cfg = loadPublicationConfig(ctx.contentRoot);
    } catch (e) {
      const fichier = `${ctx.contentRoot.replace(/[\\/]+$/, '')}/config/publication.yml`;
      return [{ code: 'PUBLICATION_LISTE_INVALIDE', pointer: '', file: fichier, at: AU_DEBUT, message: e instanceof Error ? e.message : String(e) }];
    }
    // Un fichier de thème invalide fait déjà échouer la CI par son erreur de schéma : pas de cascade.
    if (ctx.corpus.aDesInvalides('themes')) return out;

    const severity = ctx.mode === 'production' ? 'error' : 'warning';
    const ouverts = new Set(cfg.themesOuverts);
    const themes = ctx.corpus.de('themes');
    const connus = new Map(themes.map((t) => [t.id, t] as const));

    for (const theme of themes) {
      if (theme.data.statut_relecture !== 'publie' || ouverts.has(theme.id)) continue;
      out.push({
        code: 'PUBLICATION_THEME_NON_OUVERT',
        severity,
        pointer: '/statut_relecture',
        file: theme.file,
        message: `le thème « ${theme.id} » est publié mais ne figure pas dans themes_ouverts de config/publication.yml : l'ajouter (décision éditoriale) ou le repasser en brouillon`,
      });
    }
    for (const id of cfg.themesOuverts) {
      const theme = connus.get(id);
      if (theme === undefined) {
        out.push({
          code: 'PUBLICATION_THEME_INCONNU',
          pointer: '',
          file: cfg.fichier,
          at: AU_DEBUT,
          message: `themes_ouverts cite « ${id} », qui n'est pas un thème du corpus : corriger l'identifiant ou retirer la ligne`,
        });
      } else if (theme.data.statut_relecture !== 'publie') {
        out.push({
          code: 'PUBLICATION_THEME_OUVERT_NON_PUBLIE',
          severity: 'warning',
          pointer: '',
          file: cfg.fichier,
          at: AU_DEBUT,
          message: `le thème « ${id} » est listé dans themes_ouverts mais n'est pas publié : il n'apparaît pas sur le site`,
        });
      }
    }
    return out;
  },
};
