import type { APIRoute, GetStaticPaths } from 'astro';
import { getCorpus } from '../lib/corpus/index.ts';
import { cheminsDuSite, xmlSitemap } from '../lib/sitemap.ts';

// sitemap.xml écrit à la main (D-03, sans @astrojs/sitemap), en production seulement : en preview,
// getStaticPaths ne renvoie rien et aucun fichier n'est écrit (la build preview ne revendique pas le domaine).
// Route dynamique `[fichier].xml` parce qu'une route statique serait toujours construite.
export const getStaticPaths = (async () => {
  const { mode } = await getCorpus();
  return mode === 'production' ? [{ params: { fichier: 'sitemap' } }] : [];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ site }) => {
  if (site === undefined) throw new Error('sitemap.xml : `site` absent de la configuration Astro (attendu : https://<domaine> de config/site.yml)');
  const corpus = await getCorpus();
  return new Response(xmlSitemap(site, cheminsDuSite(corpus)), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
