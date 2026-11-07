// sitemap.xml et robots.txt (HEB-05, D-03) : fonctions pures de (URL du site, chemins, mode), sans import
// d'Astro, testées avec des domaines synthétiques. Les endpoints src/pages/[fichier].xml.ts et
// src/pages/robots.txt.ts ne font que les appeler avec `context.site` (https:// + domaine de config/site.yml).
import type { Mode } from './corpus/vue.ts';

/** Ce dont cheminsDuSite a besoin du corpus : les thèmes visibles et les candidats du mode de build. */
export interface PagesDuCorpus {
  themes: readonly { theme: { id: string } }[];
  candidats: readonly { id: string }[];
}

// Pages fixes (trailingSlash 'always', aucune page 404) : à garder alignées sur src/pages/. Une future page 404
// n'entre jamais ici : check-dist l'exclut des URL canoniques et du sitemap (PAGE_ERREUR, IN-07).
const PAGES_FIXES = ['/', '/themes/', '/candidats/', '/methode/', '/mentions-legales/', '/qui-sommes-nous/'] as const;

/** Chemins de toutes les pages construites, triés, sans doublon. */
export function cheminsDuSite(corpus: PagesDuCorpus): string[] {
  const chemins = new Set<string>(PAGES_FIXES);
  for (const t of corpus.themes) chemins.add(`/themes/${t.theme.id}/`);
  for (const c of corpus.candidats) chemins.add(`/candidats/${c.id}/`);
  return [...chemins].sort();
}

const ECHAPPEMENTS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const echapperXml = (s: string): string => s.replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c] ?? c);

/** Adresse absolue d'un chemin du site ; refuse ce qui pourrait sortir du domaine (`//hôte`, chemin relatif). */
function adresse(site: URL, chemin: string): string {
  if (!chemin.startsWith('/') || chemin.startsWith('//')) throw new Error(`sitemap : chemin « ${chemin.slice(0, 60)} » invalide (attendu : /…)`);
  return new URL(chemin, site).href;
}

/** sitemap.xml (protocole sitemaps.org 0.9) : une entrée <url><loc> par chemin, adresses échappées. */
export function xmlSitemap(site: URL, chemins: readonly string[]): string {
  const urls = chemins.map((c) => `  <url><loc>${echapperXml(adresse(site, c))}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

/** robots.txt : preview, rien d'indexable et aucune ligne Sitemap ; production, tout permis + Sitemap absolu. */
export function texteRobots(mode: Mode, site: URL | undefined): string {
  if (mode === 'preview') return 'User-agent: *\nDisallow: /\n';
  if (site === undefined) throw new Error('robots.txt : `site` absent de la configuration Astro (attendu : https://<domaine> de config/site.yml)');
  return `User-agent: *\nAllow: /\nSitemap: ${adresse(site, '/sitemap.xml')}\n`;
}
