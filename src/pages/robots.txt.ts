import type { APIRoute } from 'astro';
import { getCorpus } from '../lib/corpus/index.ts';
import { texteRobots } from '../lib/sitemap.ts';

// Preview : aucune indexation (en plus du meta noindex de chaque page) et aucune ligne Sitemap.
// Production : tout est indexable, et la ligne Sitemap pointe sur https://<domaine>/sitemap.xml (config/site.yml).
// Le mode vient de getCorpus(), seul endroit où une page apprend le mode de build.
export const GET: APIRoute = async ({ site }) => {
  const { mode } = await getCorpus();
  return new Response(texteRobots(mode, site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
