import type { APIRoute } from 'astro';
import { getCorpus } from '../lib/corpus/index.ts';

// Preview : aucune indexation (en plus du meta noindex de chaque page). Production : tout est indexable.
// Le mode vient de getCorpus(), seul endroit où une page apprend le mode de build.
export const GET: APIRoute = async () => {
  const { mode } = await getCorpus();
  const corps = mode === 'preview' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
