// `relecture publier --theme <id>` : second temps de la relecture (D-07, PUB-02). Les mesures `relu` du thème
// passent à `publie`, le thème aussi (relecteur et date), en une seule opération tout ou rien. La commande ne
// marque jamais rien `relu` elle-même et refuse tant que le périmètre du thème n'est pas entièrement relu.
// Elle n'écrit jamais config/publication.yml : l'ouverture d'un thème est une décision humaine.

import { parseArgs } from 'node:util';
import { loadAll } from '../../../../src/lib/content-core/load.ts';
import { loadPublicationConfig } from '../../../../src/lib/publication-config.ts';
import { RE_SEGMENT, RELECTEUR_DEFAUT, chargerCorpus, empreinteMesure, empreinteStatut, entreesDe, erreursDuTheme, etatRelecture } from '../etat.ts';
import type { Contexte } from '../etat.ts';
import { dateValide, relecteurValide } from '../editer.ts';
import { afficherDiagnostic, appliquerLot } from '../lot.ts';
import type { Edition } from '../lot.ts';
import { ajouterJournal } from '../registre.ts';
import { aujourdhuiParis } from './marquer.ts';
import type { Dependances } from './marquer.ts';

export interface OptionsPublier {
  relecteur: string;
  date: string;
  dryRun: boolean;
}

export const PHRASE_ABSENT_LISTE = 'thème absent de config/publication.yml';

const texte = (v: unknown): string => (typeof v === 'string' ? v : v === undefined ? '' : String(v));

/**
 * Cœur de la commande (exporté pour les tests, qui injectent un chargeur). Renvoie le code de sortie :
 * 0 publié, déjà publié ou essai à blanc possible, 1 refusé pour une raison de contenu.
 */
export function publier(theme: string, options: OptionsPublier, deps: Dependances): number {
  const { ctx } = deps;
  const charger = deps.charger ?? loadAll;
  const corpus = chargerCorpus(ctx.racine, ctx.schemasDir, charger);
  const etat = etatRelecture(ctx.racine, ctx.schemasDir, theme, { corpus, relecteur: options.relecteur });
  const raisons: string[] = [];

  const entreeTheme = entreesDe(corpus.preview, 'themes').find((e) => e.id === theme);
  if (entreeTheme === undefined) raisons.push(`le thème « ${theme} » n’existe pas`);

  try {
    if (!loadPublicationConfig(ctx.racine).themesOuverts.includes(theme)) {
      raisons.push(`${PHRASE_ABSENT_LISTE} : l’ouverture d’un thème est une décision à part (commit dédié, jamais faite par cet outil)`);
    }
  } catch (e) {
    raisons.push(e instanceof Error ? e.message : String(e));
  }

  const perimetre = new Set(etat.candidats.map((c) => c.id));
  for (const m of entreesDe(corpus.preview, 'mesures')) {
    if (m.data.theme === theme && !perimetre.has(texte(m.data.candidat))) {
      raisons.push(`mesure ${m.id} : candidat hors du périmètre d’équité (à retirer du thème ou à traiter à la main)`);
    }
  }

  const aPublier: { id: string; file: string; data: Record<string, unknown> }[] = [];
  const mesures = new Map(entreesDe(corpus.preview, 'mesures').map((m) => [m.id, m]));
  const signaler = (cible: string, etatCible: string, notes: number, alertes: readonly { code: string; message: string }[], attendu: string): void => {
    if (etatCible !== 'relu' && etatCible !== 'publie') raisons.push(`${cible} : ${etatCible === 'a_revoir' ? 'texte modifié depuis la relecture (à revoir)' : attendu}`);
    if (notes > 0) raisons.push(`${cible} : ${notes} note(s) ouverte(s)`);
    for (const a of alertes) if (a.code === 'ARCHIVE_WAYBACK_ABSENTE') raisons.push(`${cible} : ${a.message}`);
  };
  for (const c of etat.candidats) {
    for (const m of c.mesures) {
      signaler(m.cible, m.etat, m.notes.length, m.alertes, 'mesure pas encore relue');
      const e = mesures.get(m.id);
      if (m.etat === 'relu' && e) aPublier.push({ id: m.id, file: e.file, data: e.data });
    }
    if (c.statut === undefined) raisons.push(`statut:${c.id} : aucun statut`);
    else signaler(c.statut.cible, c.statut.etat, c.statut.notes.length, c.statut.alertes, 'statut déclaré pas encore relu');
    if (c.case === undefined) {
      if (c.mesures.length === 0) raisons.push(`case:${theme}/${c.id} : ni mesure ni case de couverture pour ce candidat du périmètre`);
    } else {
      signaler(c.case.cible, c.case.etat, c.case.notes.length, c.case.alertes, 'case de couverture pas encore relue');
    }
  }
  for (const d of erreursDuTheme(corpus, theme)) raisons.push(`validation : ${afficherDiagnostic(ctx.racine, d)}`);

  if (raisons.length > 0) {
    for (const r of raisons) ctx.erreur(`refusé : ${r}`);
    ctx.erreur(`publier ${theme} : ${raisons.length} raison(s) de refus, rien n’a été écrit`);
    return 1;
  }
  const dejaPublie = entreeTheme?.data.statut_relecture === 'publie';
  if (aPublier.length === 0 && dejaPublie) {
    ctx.sortie(`thème ${theme} : déjà publié, rien à changer`);
    return 0;
  }

  const editions: Edition[] = aPublier.map((m) => ({ fichier: m.file, chemin: [], champs: [{ cle: 'statut_relecture', valeur: 'publie' }] }));
  editions.push({
    fichier: entreeTheme!.file,
    chemin: [],
    champs: [
      { cle: 'statut_relecture', valeur: 'publie' },
      { cle: 'relecteur', valeur: options.relecteur },
      { cle: 'date_relecture', valeur: options.date },
    ],
  });
  if (options.dryRun) {
    ctx.sortie(`essai à blanc : ${aPublier.length} mesure(s) passeraient à publie, le thème ${theme} aussi (${options.relecteur}, ${options.date}) ; rien n’est écrit`);
    for (const e of editions) ctx.sortie(`  ${e.fichier.slice(ctx.racine.length + 1)}`);
    return 0;
  }

  const lot = appliquerLot(ctx.racine, editions, () =>
    charger(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'production' })
      .diagnostics.filter((d) => d.severity === 'error')
      .map((d) => afficherDiagnostic(ctx.racine, d)),
  );
  if (!lot.ok) {
    for (const e of lot.erreurs) ctx.erreur(`erreur : ${e}`);
    ctx.erreur(`refusé : publication de ${theme} annulée, ${lot.fichiers.length > 0 ? 'fichiers restaurés' : 'rien n’a été écrit'}`);
    return 1;
  }
  const horodatage = ctx.maintenant().toISOString();
  for (const m of aPublier) {
    ajouterJournal(ctx.racine, { horodatage, action: 'publier', cible: `mesure:${m.id}`, relecteur: options.relecteur, date: options.date, sha256: empreinteMesure(m.data) });
  }
  ajouterJournal(ctx.racine, { horodatage, action: 'publier', cible: `theme:${theme}`, relecteur: options.relecteur, date: options.date, sha256: empreinteStatut(entreeTheme!.data) });
  ctx.sortie(`${aPublier.length} mesures publiées, thème ${theme} publié`);
  ctx.sortie('étapes suivantes : relire le diff, commiter, pousser, approuver le déploiement.');
  return 0;
}

const USAGE = 'usage : relecture publier --theme <id> [--relecteur <nom>] [--date AAAA-MM-JJ] [--dry-run]';

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { theme?: string; relecteur?: string; date?: string; 'dry-run'?: boolean };
  try {
    ({ values: v } = parseArgs({ args: argv, options: { theme: { type: 'string' }, relecteur: { type: 'string' }, date: { type: 'string' }, 'dry-run': { type: 'boolean' } }, allowPositionals: false, strict: true }));
  } catch (e) {
    ctx.erreur(`publier : ${e instanceof Error ? e.message : String(e)}`);
    ctx.erreur(USAGE);
    return 2;
  }
  const usage = (message: string): number => {
    ctx.erreur(`publier : ${message}`);
    ctx.erreur(USAGE);
    return 2;
  };
  if (v.theme === undefined || !RE_SEGMENT.test(v.theme)) return usage('--theme <id> attendu (identifiant, jamais un chemin)');
  const relecteur = v.relecteur ?? RELECTEUR_DEFAUT;
  if (!relecteurValide(relecteur)) return usage(`nom de relecteur refusé « ${relecteur} »`);
  const date = v.date ?? aujourdhuiParis(ctx.maintenant());
  if (!dateValide(date)) return usage(`date invalide « ${date} » (AAAA-MM-JJ)`);
  return publier(v.theme, { relecteur, date, dryRun: v['dry-run'] === true }, { ctx });
}
