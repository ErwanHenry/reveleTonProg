// `relecture servir --relecteur <nom> [--theme <id>] [--port <n>]` : page de relecture locale (D-04) sur
// http://127.0.0.1:<port>/. Chaque « Valider » signe au nom de --relecteur, obligatoire (revue de la phase 9, WR-02).
// Liée à la boucle locale seulement (vérifiée après listen), jamais déployée ; Ctrl+C l'arrête. Le jeton anti-CSRF
// est tiré à chaque lancement et n'apparaît jamais dans le terminal.

import type { Server } from 'node:http';
import { parseArgs } from 'node:util';
import { loadAll } from '../../../../src/lib/content-core/load.ts';
import { RELECTEUR_OBLIGATOIRE, RE_SEGMENT, entreesDe } from '../etat.ts';
import { relecteurValide } from '../editer.ts';
import type { Contexte } from '../etat.ts';
import { creerServeurRelecture } from '../serveur.ts';

export const PORT_DEFAUT = 4327;
export const THEME_DEFAUT = 'sante';
const HOTE = '127.0.0.1';

const USAGE = 'usage : relecture servir --relecteur <nom> [--theme <id>] [--port <n>] (défaut : thème sante, port 4327)';

/** Crée et lie le serveur ; renvoie le serveur, ou un code de sortie (1) si le port est pris ou l'adresse n'est pas locale. */
export async function demarrer(options: { theme: string; port: number; relecteur: string }, ctx: Contexte): Promise<{ serveur: Server } | number> {
  const serveur = creerServeurRelecture({
    racine: ctx.racine,
    schemasDir: ctx.schemasDir,
    theme: options.theme,
    relecteur: options.relecteur,
    maintenant: () => ctx.maintenant(),
    journal: (ligne) => ctx.sortie(ligne),
  });
  try {
    await new Promise<void>((ok, ko) => {
      serveur.once('error', ko);
      serveur.listen(options.port, HOTE, () => {
        serveur.off('error', ko);
        ok();
      });
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    ctx.erreur(code === 'EADDRINUSE' ? `port ${options.port} déjà occupé. Si la page de relecture tourne déjà dans un autre onglet du terminal, il n'y a rien à relancer : ouvrir http://${HOTE}:${options.port}/ dans le navigateur. Sinon, choisir un autre port avec --port` : `écoute impossible sur ${HOTE}:${options.port} (${e instanceof Error ? e.message : String(e)})`);
    return 1;
  }
  const adresse = serveur.address();
  if (adresse === null || typeof adresse === 'string' || adresse.address !== HOTE) {
    serveur.close();
    ctx.erreur(`adresse d'écoute inattendue (${JSON.stringify(adresse)}) : arrêt, le serveur ne doit écouter que sur ${HOTE}`);
    return 1;
  }
  ctx.sortie(`Page de relecture du thème ${options.theme} (validations signées : ${options.relecteur}) :`);
  ctx.sortie(`http://${HOTE}:${adresse.port}/`);
  ctx.sortie('Ctrl+C pour arrêter');
  ctx.sortie('Chaque requête s’affiche ci-dessous (heure UTC, action, code) : 303 = enregistré, 403 ou 409 = refusé, avec la raison.');
  return { serveur };
}

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { theme?: string; port?: string; relecteur?: string };
  try {
    ({ values: v } = parseArgs({ args: argv, options: { theme: { type: 'string' }, port: { type: 'string' }, relecteur: { type: 'string' } }, allowPositionals: false, strict: true }));
  } catch (e) {
    ctx.erreur(`servir : ${e instanceof Error ? e.message : String(e)}`);
    ctx.erreur(USAGE);
    return 2;
  }
  if (v.relecteur === undefined || !relecteurValide(v.relecteur)) {
    ctx.erreur(`servir : ${v.relecteur === undefined ? RELECTEUR_OBLIGATOIRE : `nom de relecteur refusé « ${v.relecteur} »`}`);
    ctx.erreur(USAGE);
    return 2;
  }
  const relecteur = v.relecteur;
  const theme = v.theme ?? THEME_DEFAUT;
  if (!RE_SEGMENT.test(theme)) {
    ctx.erreur(`servir : identifiant de thème invalide « ${theme} »`);
    ctx.erreur(USAGE);
    return 2;
  }
  const port = v.port === undefined ? PORT_DEFAUT : /^\d{1,5}$/.test(v.port) ? Number(v.port) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    ctx.erreur(`servir : port invalide « ${String(v.port)} » (0 à 65535)`);
    ctx.erreur(USAGE);
    return 2;
  }
  const corpus = loadAll(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'preview' });
  if (!entreesDe(corpus, 'themes').some((t) => t.id === theme)) {
    ctx.erreur(`refusé : thème inconnu dans le corpus : ${theme}`);
    return 1;
  }
  const r = await demarrer({ theme, port, relecteur }, ctx);
  if (typeof r === 'number') return r;
  return new Promise<number>((ok) => {
    const arreter = (): void => {
      process.off('SIGINT', arreter);
      process.off('SIGTERM', arreter);
      r.serveur.closeAllConnections();
      r.serveur.close(() => ok(0));
    };
    process.once('SIGINT', arreter);
    process.once('SIGTERM', arreter);
  });
}
