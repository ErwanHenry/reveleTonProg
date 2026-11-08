import type { APIRoute } from 'astro';

// Version servie (HEB-07, D-12) : dist/version.json, écrit à chaque build, donne le commit construit et la date de
// build. commit : GITHUB_SHA quand il compte 40 hexadécimaux (CI), sinon « dev » (build locale ou valeur incomplète).
// check-dist l'exige (VERSION_ABSENTE, VERSION_INVALIDE), le compare à GITHUB_SHA en CI et refuse « dev » sous
// RTP_DEPLOIEMENT=1. Ni hôte de build, ni chemin, ni secret : commit et date d'un dépôt public (T-08-22).
export const GET: APIRoute = () => {
  const sha = process.env.GITHUB_SHA ?? '';
  const commit = /^[0-9a-f]{40}$/.test(sha) ? sha : 'dev';
  const corps = `${JSON.stringify({ commit, date: new Date().toISOString() })}\n`;
  return new Response(corps, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
