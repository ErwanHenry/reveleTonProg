// `relecture retirer <candidat/slug>` ou `relecture retirer --theme <id>` : retrait d'urgence (LEG-03, D-10).
// Une mesure publiée repasse à brouillon ; si c'était la seule publiée du candidat sur un thème publié, la case de
// couverture change dans la même opération (sinon EQUITE_COUVERTURE_INCOHERENTE). Le choix de l'état de la case est
// éditorial : la commande ne le fait jamais seule. `--theme` est le repli le plus rapide, sans décision éditoriale.
// Tout passe par l'éditeur à positions de 09-01 et par appliquerLot : rien d'autre que des champs de relecture et
// de couverture n'est écrit, et toute erreur de validation de production restaure les octets d'origine.

import { parseArgs } from 'node:util';
import { loadAll } from '../../../../src/lib/content-core/load.ts';
import { FENETRES_GEL, dateParis } from '../../../garde-gel.ts';
import { RE_SEGMENT, RELECTEUR_DEFAUT, empreinteCase, empreinteMesure, empreinteStatut, entreesDe } from '../etat.ts';
import type { Contexte } from '../etat.ts';
import { dateValide, relecteurValide } from '../editer.ts';
import type { Champ } from '../editer.ts';
import { afficherDiagnostic, appliquerLot } from '../lot.ts';
import type { Edition } from '../lot.ts';
import { ajouterJournal } from '../registre.ts';
import { aujourdhuiParis } from './marquer.ts';
import type { Dependances } from './marquer.ts';

export type CibleRetrait = { type: 'mesure'; id: string } | { type: 'theme'; theme: string };
export type CasDemande = { etat: 'non_precise'; sources: string[] } | { etat: 'programme_non_publie' };
export interface OptionsRetirer {
  relecteur: string;
  date: string;
  dryRun: boolean;
  cas?: CasDemande;
}

const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Lignes de suite : validation, commit, push, approbation ; et les deux formes `gh` dans une fenêtre de gel. */
function suites(ctx: Contexte, justification: string): void {
  ctx.sortie('étapes suivantes : relire le diff, commiter, pousser sur main, approuver le déploiement (bouton « Review deployments » du run).');
  const date = dateParis(ctx.maintenant());
  const fenetre = FENETRES_GEL.find((f) => f.debut <= date && date <= f.fin);
  if (fenetre !== undefined) {
    ctx.sortie(`gel du tour ${fenetre.tour} en cours (${fenetre.debut} au ${fenetre.fin}) : après le push, relancer avec le retrait d'urgence.`);
    ctx.sortie(`  gh workflow run ci.yml --ref main -f retrait_urgence=true -f justification="${justification}"`);
    ctx.sortie('  gh workflow run rollback.yml -f cible=production -f retrait_urgence=true -f justification="<motif du retour arrière>"');
  }
}

/**
 * Cœur de la commande (exporté pour les tests, qui injectent un chargeur). Renvoie le code de sortie :
 * 0 retiré ou essai à blanc possible, 1 refusé pour une raison de contenu.
 */
export function retirer(cible: CibleRetrait, options: OptionsRetirer, deps: Dependances): number {
  const { ctx } = deps;
  const charger = deps.charger ?? loadAll;
  const production = (): ReturnType<typeof loadAll> => charger(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'production' });
  const verifier = (): string[] => production().diagnostics.filter((d) => d.severity === 'error').map((d) => afficherDiagnostic(ctx.racine, d));
  const refuser = (message: string): number => {
    ctx.erreur(`refusé : ${message}`);
    return 1;
  };
  const avant = production();
  const horodatage = ctx.maintenant().toISOString();
  const editions: Edition[] = [];
  const traces: { cible: string; sha256: string }[] = [];
  const brouillon: Champ = { cle: 'statut_relecture', valeur: 'brouillon' };

  if (cible.type === 'theme') {
    if (options.cas !== undefined) return refuser('--case ne va pas avec --theme (le repli par thème ne touche à aucune case)');
    const t = entreesDe(avant, 'themes').find((e) => e.id === cible.theme);
    if (t === undefined) return refuser(`thème « ${cible.theme} » inconnu`);
    if (t.data.statut_relecture !== 'publie') return refuser(`le thème « ${cible.theme} » n’est pas publié (statut ${String(t.data.statut_relecture)})`);
    editions.push({ fichier: t.file, chemin: [], champs: [brouillon] });
    traces.push({ cible: `theme:${cible.theme}`, sha256: empreinteStatut(t.data) });
    if (options.dryRun) {
      ctx.sortie(`essai à blanc : le thème ${cible.theme} repasserait à brouillon ; aucune mesure ni case touchée ; rien n’est écrit`);
      return 0;
    }
  } else {
    const m = entreesDe(avant, 'mesures').find((e) => e.id === cible.id);
    if (m === undefined) return refuser(`mesure « ${cible.id} » inconnue (ou fichier invalide : voir npm run validate)`);
    if (m.data.statut_relecture !== 'publie') return refuser(`la mesure « ${cible.id} » n’est pas publiée (statut ${String(m.data.statut_relecture)})`);
    const theme = String(m.data.theme);
    const candidat = String(m.data.candidat);
    editions.push({ fichier: m.file, chemin: [], champs: [brouillon] });
    traces.push({ cible: `mesure:${cible.id}`, sha256: empreinteMesure(m.data) });

    const themePublie = entreesDe(avant, 'themes').some((e) => e.id === theme && e.data.statut_relecture === 'publie');
    const autres = entreesDe(avant, 'mesures').filter((e) => e.id !== m.id && e.data.theme === theme && e.data.candidat === candidat && e.data.statut_relecture === 'publie');
    const couv = entreesDe(avant, 'couverture').find((e) => e.data.theme === theme);
    const index = tableau(couv?.data.cases).findIndex((k) => objet(k).candidat === candidat);
    const caseDit = index >= 0 ? objet(tableau(couv?.data.cases)[index]).etat : undefined;
    const sources = entreesDe(avant, 'sources').filter((s) => tableau(s.data.candidats).includes(candidat)).map((s) => s.id);
    const besoinCase = themePublie && couv !== undefined && caseDit === 'mesures' && autres.length === 0;

    if (!besoinCase && options.cas !== undefined) {
      return refuser(
        autres.length > 0
          ? `--case inutile : ${candidat} garde ${autres.length} autre(s) mesure(s) publiée(s) sur le thème ${theme}`
          : `--case inutile : la couverture du thème ${theme} n’a pas à changer pour ${candidat} (thème non publié, case absente ou déjà non « mesures »)`,
      );
    }
    if (besoinCase && options.cas === undefined) {
      ctx.erreur(`refusé : « ${cible.id} » est la seule mesure publiée de ${candidat} sur le thème ${theme} : sans changer sa case de couverture dans la même opération, la CI passerait au rouge (EQUITE_COUVERTURE_INCOHERENTE).`);
      ctx.erreur('Choix éditorial à faire, puis relancer avec l’une de ces deux lignes :');
      ctx.erreur(`  npm run relecture -- retirer ${cible.id} --case non_precise --sources ${sources.length > 0 ? sources.join(',') : '<id-source,…>'}`);
      ctx.erreur(`  npm run relecture -- retirer ${cible.id} --case programme_non_publie`);
      ctx.erreur(`(repli sans décision éditoriale : npm run relecture -- retirer --theme ${theme})`);
      return 1;
    }
    if (besoinCase && options.cas !== undefined) {
      const champs: Champ[] = [{ cle: 'etat', valeur: options.cas.etat }];
      if (options.cas.etat === 'non_precise') {
        const inconnues = options.cas.sources.filter((s) => !sources.includes(s));
        if (inconnues.length > 0) return refuser(`source(s) « ${inconnues.join(', ')} » : pas une source de ${candidat} (sources de ce candidat : ${sources.join(', ') || 'aucune'})`);
        champs.push({ cle: 'sources_consultees', valeur: options.cas.sources });
      }
      champs.push({ cle: 'verifie_le', valeur: options.date }, { cle: 'verifie_par', valeur: options.relecteur });
      editions.push({ fichier: couv!.file, chemin: ['cases', index], champs });
      traces.push({ cible: `case:${theme}/${candidat}`, sha256: '' });
    }
    if (options.dryRun) {
      ctx.sortie(`essai à blanc : la mesure ${cible.id} repasserait à brouillon${besoinCase ? `, la case de ${candidat} passerait à ${options.cas?.etat}` : ''} ; rien n’est écrit`);
      return 0;
    }
  }

  const lot = appliquerLot(ctx.racine, editions, verifier);
  if (!lot.ok) {
    for (const e of lot.erreurs) ctx.erreur(`erreur : ${e}`);
    ctx.erreur(`refusé : retrait annulé, ${lot.fichiers.length > 0 ? 'fichiers restaurés' : 'rien n’a été écrit'}`);
    return 1;
  }

  // Registre : une ligne par cible ; l'empreinte de la case est celle de son état après écriture.
  const apres = production();
  for (const t of traces) {
    let sha = t.sha256;
    if (t.cible.startsWith('case:')) {
      const [theme, candidat] = t.cible.slice('case:'.length).split('/');
      const couv = entreesDe(apres, 'couverture').find((e) => e.data.theme === theme);
      sha = empreinteCase(objet(tableau(couv?.data.cases).find((k) => objet(k).candidat === candidat)));
    }
    ajouterJournal(ctx.racine, { horodatage, action: 'retirer', cible: t.cible, relecteur: options.relecteur, date: options.date, sha256: sha });
  }
  if (cible.type === 'theme') {
    ctx.sortie(`retiré : thème ${cible.theme} repassé à brouillon (sa page disparaît de la production ; aucune mesure ni case touchée).`);
    ctx.sortie('config/publication.yml peut garder le thème : un thème listé mais non publié n’est qu’un avertissement.');
    suites(ctx, `Retrait du thème ${cible.theme}`);
  } else {
    ctx.sortie(`retiré : mesure ${cible.id} repassée à brouillon${editions.length > 1 ? ' ; case de couverture mise à jour dans la même opération' : ''}.`);
    suites(ctx, `Retrait de la mesure ${cible.id}`);
  }
  return 0;
}

const USAGE = [
  'usage : relecture retirer <candidat/slug> [--case non_precise --sources <id,id> | --case programme_non_publie] [--relecteur <nom>] [--date AAAA-MM-JJ] [--dry-run]',
  '        relecture retirer --theme <id> [--dry-run]',
].join('\n');

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { theme?: string; case?: string; sources?: string; relecteur?: string; date?: string; 'dry-run'?: boolean };
  let p: string[];
  try {
    ({ values: v, positionals: p } = parseArgs({
      args: argv,
      options: { theme: { type: 'string' }, case: { type: 'string' }, sources: { type: 'string' }, relecteur: { type: 'string' }, date: { type: 'string' }, 'dry-run': { type: 'boolean' } },
      allowPositionals: true,
      strict: true,
    }));
  } catch (e) {
    ctx.erreur(`retirer : ${e instanceof Error ? e.message : String(e)}`);
    ctx.erreur(USAGE);
    return 2;
  }
  const usage = (message: string): number => {
    ctx.erreur(`retirer : ${message}`);
    ctx.erreur(USAGE);
    return 2;
  };
  const relecteur = v.relecteur ?? RELECTEUR_DEFAUT;
  if (!relecteurValide(relecteur)) return usage(`nom de relecteur refusé « ${relecteur} »`);
  const date = v.date ?? aujourdhuiParis(ctx.maintenant());
  if (!dateValide(date)) return usage(`date invalide « ${date} » (AAAA-MM-JJ)`);
  const dryRun = v['dry-run'] === true;

  if (v.theme !== undefined) {
    if (p.length > 0) return usage('--theme et une mesure ne vont pas ensemble');
    if (!RE_SEGMENT.test(v.theme)) return usage('--theme <id> : identifiant invalide');
    if (v.case !== undefined || v.sources !== undefined) return usage('--case et --sources ne vont pas avec --theme');
    return retirer({ type: 'theme', theme: v.theme }, { relecteur, date, dryRun }, { ctx });
  }
  const [a, ...reste] = p;
  if (a === undefined || reste.length > 0) return usage('une mesure <candidat/slug> ou --theme <id> attendu');
  const [candidat, slug, ...autres] = a.split('/');
  if (candidat === undefined || slug === undefined || autres.length > 0 || !RE_SEGMENT.test(candidat) || !RE_SEGMENT.test(slug)) {
    return usage(`identifiant de mesure invalide « ${a} » (attendu : <candidat>/<slug>, jamais un chemin)`);
  }
  let cas: CasDemande | undefined;
  if (v.case === 'non_precise') {
    const ids = (v.sources ?? '').split(',').filter((s) => s !== '');
    if (ids.length === 0 || !ids.every((s) => RE_SEGMENT.test(s))) return usage('--case non_precise exige --sources <id,id> (identifiants de sources du candidat)');
    cas = { etat: 'non_precise', sources: ids };
  } else if (v.case === 'programme_non_publie') {
    if (v.sources !== undefined) return usage('--sources ne va qu’avec --case non_precise');
    cas = { etat: 'programme_non_publie' };
  } else if (v.case !== undefined) {
    return usage(`--case « ${v.case} » inconnu (non_precise ou programme_non_publie)`);
  } else if (v.sources !== undefined) {
    return usage('--sources ne va qu’avec --case non_precise');
  }
  return retirer({ type: 'mesure', id: a }, { relecteur, date, dryRun, ...(cas !== undefined ? { cas } : {}) }, { ctx });
}
