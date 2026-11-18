// Masque des identifiants du serveur (phase 9.2, risque §4.6 de la recherche, T-09.2-16).
// Tout texte venu de ssh, rsync ou curl passe par masquer avant affichage, journal ou message d'erreur : l'hôte,
// l'utilisateur et l'URL du fichier local de déploiement (dépôt public, transcriptions d'agents) deviennent
// `<hôte>`, `<utilisateur>`, `<url>`. Un seul passage d'une seule expression : une étiquette déjà posée n'est
// jamais remasquée, et la valeur la plus longue l'emporte à une même position.
// N'importe qu'un type du module relatif config.ts.
import type { ConfigDeploiement } from './config.ts';

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

export function masquer(texte: string, cfg: Pick<ConfigDeploiement, 'hote' | 'utilisateur' | 'url'>): string {
  const remplacements = new Map<string, string>();
  const url = cfg.url ?? '';
  if (url !== '') {
    remplacements.set(url, '<url>');
    const sansBarre = url.replace(/\/+$/, '');
    if (sansBarre !== '') remplacements.set(sansBarre, '<url>');
    try {
      const u = new URL(url);
      if (u.host !== '') remplacements.set(u.host, '<hôte>');
      if (u.hostname !== '') remplacements.set(u.hostname, '<hôte>');
    } catch {
      // URL illisible : seule sa valeur littérale est masquée.
    }
  }
  if (cfg.hote !== '') remplacements.set(cfg.hote, '<hôte>');
  if (cfg.utilisateur !== '') remplacements.set(`${cfg.utilisateur}@`, '<utilisateur>@');

  const alternatives: { motif: string; longueur: number; etiquette: string | null }[] = [...remplacements].map(([v, e]) => ({
    motif: echapper(v),
    longueur: v.length,
    etiquette: e,
  }));
  if (cfg.utilisateur !== '') {
    // Utilisateur comme mot entier (bornes de mot, valeur échappée).
    alternatives.push({ motif: `(?<![A-Za-z0-9_])${echapper(cfg.utilisateur)}(?![A-Za-z0-9_])`, longueur: cfg.utilisateur.length, etiquette: '<utilisateur>' });
  }
  if (alternatives.length === 0) return texte;
  alternatives.sort((a, b) => b.longueur - a.longueur);
  const re = new RegExp(alternatives.map((a) => `(${a.motif})`).join('|'), 'gi');
  return texte.replace(re, (...groupes: unknown[]) => {
    for (let i = 0; i < alternatives.length; i++) {
      if (groupes[i + 1] !== undefined) return alternatives[i].etiquette as string;
    }
    return String(groupes[0]);
  });
}
