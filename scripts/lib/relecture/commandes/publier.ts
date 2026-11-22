// `relecture publier --theme <id>` : second temps de la relecture (D-07, PUB-02). Les mesures `relu` du thème
// passent à `publie`, le thème aussi (relecteur et date), en une seule opération tout ou rien. La commande ne
// marque jamais rien `relu` elle-même et refuse tant que le périmètre du thème n'est pas entièrement relu.
// Elle n'écrit jamais config/publication.yml : l'ouverture d'un thème est une décision humaine.
// `--case-mesures <candidat,…>` (revue de la phase 9, WR-03) : sur un thème où une personne publie sa première mesure,
// sa case de couverture passe à `mesures` dans le même lot (sinon EQUITE_COUVERTURE_INCOHERENTE fait tout refuser).
// Le choix reste explicite, comme `--case` de retirer : sans l'option, la commande refuse en nommant la case.

import { parseArgs } from 'node:util';
import { loadAll } from '../../../../src/lib/content-core/load.ts';
import { loadPublicationConfig } from '../../../../src/lib/publication-config.ts';
import { RE_SEGMENT, RELECTEUR_OBLIGATOIRE, chargerCorpus, empreinteCase, empreinteMesure, empreinteStatut, entreesDe, erreursDuTheme, etatRelecture } from '../etat.ts';
import type { Contexte } from '../etat.ts';
import { dateValide, relecteurValide } from '../editer.ts';
import { afficherDiagnostic, appliquerLot, essayerLot } from '../lot.ts';
import type { Edition } from '../lot.ts';
import { ajouterJournal } from '../registre.ts';
import { aujourdhuiParis } from './marquer.ts';
import type { Dependances } from './marquer.ts';

export interface OptionsPublier {
  relecteur: string;
  date: string;
  dryRun: boolean;
  /** Personnes dont la case passe à `mesures` dans le même lot (WR-03). */
  caseMesures?: readonly string[];
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
  const etat = etatRelecture(ctx.racine, ctx.schemasDir, theme, { corpus });
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
  // Cases à passer à `mesures` (WR-03) : seulement pour une personne qui aura au moins une mesure publiée sur le thème
  // après l'opération et dont la case dit autre chose ; toute autre demande est refusée.
  const demandees = new Set(options.caseMesures ?? []);
  const casesAChanger: { candidat: string; file: string; index: number }[] = [];
  for (const c of etat.candidats) {
    const aura = c.mesures.some((m) => m.etat === 'relu' || m.etat === 'publie');
    if (c.case === undefined || c.case.etat_case === 'mesures' || !aura) continue;
    if (demandees.has(c.id)) casesAChanger.push({ candidat: c.id, file: c.case.file, index: c.case.index });
    else raisons.push(`${c.case.cible} : la case dit « ${c.case.etat_case} » alors que ${c.id} aura une mesure publiée sur ce thème : relancer avec --case-mesures ${c.id} (la case passe à « mesures » dans la même opération)`);
  }
  const changees = new Set(casesAChanger.map((k) => k.candidat));
  for (const id of demandees) {
    if (!changees.has(id)) raisons.push(`--case-mesures ${id} : aucune case à changer (personne hors du périmètre, sans case, case déjà « mesures », ou aucune mesure relue ou publiée sur ce thème)`);
  }

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
    } else if (changees.has(c.id)) {
      // Case redécidée par cette opération : son ancien état de relecture ne compte plus, ses notes ouvertes si.
      signaler(c.case.cible, 'relu', c.case.notes.length, c.case.alertes, '');
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
  for (const k of casesAChanger) {
    editions.push({
      fichier: k.file,
      chemin: ['cases', k.index],
      champs: [
        { cle: 'etat', valeur: 'mesures' },
        { cle: 'verifie_le', valeur: options.date },
        { cle: 'verifie_par', valeur: options.relecteur },
      ],
    });
  }
  editions.push({
    fichier: entreeTheme!.file,
    chemin: [],
    champs: [
      { cle: 'statut_relecture', valeur: 'publie' },
      { cle: 'relecteur', valeur: options.relecteur },
      { cle: 'date_relecture', valeur: options.date },
    ],
  });
  const validationProduction = (racine: string): string[] =>
    charger(racine, { schemasDir: ctx.schemasDir, mode: 'production' })
      .diagnostics.filter((d) => d.severity === 'error')
      .map((d) => afficherDiagnostic(racine, d));
  if (options.dryRun) {
    // Même validation de production d'après écriture que la vraie commande, sur une copie (IN-04) : l'essai à blanc
    // n'annonce plus un succès que la vraie commande refuserait.
    const essai = essayerLot(ctx.racine, editions, validationProduction);
    if (!essai.ok) {
      for (const e of essai.erreurs) ctx.erreur(`erreur : ${e}`);
      ctx.erreur(`essai à blanc : la publication de ${theme} serait refusée après écriture (validation de production) ; rien n’est écrit`);
      return 1;
    }
    ctx.sortie(`essai à blanc : ${aPublier.length} mesure(s) passeraient à publie, le thème ${theme} aussi${casesAChanger.length > 0 ? `, ${casesAChanger.length} case(s) à « mesures » (${casesAChanger.map((k) => k.candidat).join(', ')})` : ''} (${options.relecteur}, ${options.date}) ; rien n’est écrit`);
    for (const e of editions) ctx.sortie(`  ${e.fichier.slice(ctx.racine.length + 1)}`);
    return 0;
  }

  const lot = appliquerLot(ctx.racine, editions, () => validationProduction(ctx.racine));
  if (!lot.ok) {
    for (const e of lot.erreurs) ctx.erreur(`erreur : ${e}`);
    ctx.erreur(`refusé : publication de ${theme} annulée, ${lot.fichiers.length > 0 ? 'fichiers restaurés' : 'rien n’a été écrit'}`);
    return 1;
  }
  const horodatage = ctx.maintenant().toISOString();
  for (const m of aPublier) {
    ajouterJournal(ctx.racine, { horodatage, action: 'publier', cible: `mesure:${m.id}`, relecteur: options.relecteur, date: options.date, sha256: empreinteMesure(m.data) });
  }
  if (casesAChanger.length > 0) {
    // Empreinte de la case après écriture (son contenu a changé), comme retirer.
    const apres = charger(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'production' });
    const couv = entreesDe(apres, 'couverture').find((e) => e.data.theme === theme);
    const cases = Array.isArray(couv?.data.cases) ? (couv.data.cases as Record<string, unknown>[]) : [];
    for (const k of casesAChanger) {
      const laCase = cases.find((x) => x.candidat === k.candidat) ?? {};
      ajouterJournal(ctx.racine, { horodatage, action: 'publier', cible: `case:${theme}/${k.candidat}`, relecteur: options.relecteur, date: options.date, sha256: empreinteCase(laCase) });
    }
  }
  ajouterJournal(ctx.racine, { horodatage, action: 'publier', cible: `theme:${theme}`, relecteur: options.relecteur, date: options.date, sha256: empreinteStatut(entreeTheme!.data) });
  ctx.sortie(`${aPublier.length} mesures publiées, thème ${theme} publié${casesAChanger.length > 0 ? `, ${casesAChanger.length} case(s) passée(s) à « mesures »` : ''}`);
  ctx.sortie('étapes suivantes : relire le diff, commiter, pousser, puis npm run ci:local et npm run deploy:local.');
  return 0;
}

const USAGE = 'usage : relecture publier --theme <id> --relecteur <nom> [--case-mesures <candidat,…>] [--date AAAA-MM-JJ] [--dry-run]';

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { theme?: string; relecteur?: string; date?: string; 'dry-run'?: boolean; 'case-mesures'?: string };
  try {
    ({ values: v } = parseArgs({ args: argv, options: { theme: { type: 'string' }, relecteur: { type: 'string' }, date: { type: 'string' }, 'dry-run': { type: 'boolean' }, 'case-mesures': { type: 'string' } }, allowPositionals: false, strict: true }));
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
  if (v.relecteur === undefined) return usage(RELECTEUR_OBLIGATOIRE);
  const relecteur = v.relecteur;
  if (!relecteurValide(relecteur)) return usage(`nom de relecteur refusé « ${relecteur} »`);
  const date = v.date ?? aujourdhuiParis(ctx.maintenant());
  if (!dateValide(date)) return usage(`date invalide « ${date} » (AAAA-MM-JJ)`);
  let caseMesures: string[] | undefined;
  if (v['case-mesures'] !== undefined) {
    caseMesures = v['case-mesures'].split(',').filter((s) => s !== '');
    if (caseMesures.length === 0 || !caseMesures.every((s) => RE_SEGMENT.test(s))) return usage('--case-mesures <candidat,…> : identifiants de candidats séparés par des virgules');
  }
  return publier(v.theme, { relecteur, date, dryRun: v['dry-run'] === true, ...(caseMesures !== undefined ? { caseMesures } : {}) }, { ctx });
}
