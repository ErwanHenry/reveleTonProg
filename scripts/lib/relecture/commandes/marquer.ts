// `relecture marquer mesure <candidat/slug> | statut <candidat> | case <theme> <candidat>` : écrit `relu`, le
// relecteur et la date (ou verifie_le et verifie_par pour une case), et rien d'autre (D-04). Validation avant
// et après l'écriture ; toute nouvelle erreur restaure les octets d'origine.

import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadAll, readContained } from '../../../../src/lib/content-core/load.ts';
import type { Diagnostic } from '../../../../src/lib/content-core/diagnostics.ts';
import { statutRetenu } from '../../../../src/lib/content-core/rules/equite.ts';
import { RE_DATE, EditionRefusee, dateValide, definirChamps, ecrireAtomique, relecteurValide } from '../editer.ts';
import type { Champ, Chemin } from '../editer.ts';
import { RELECTEUR_DEFAUT, RE_SEGMENT, codeDansPerimetre, empreinteCase, empreinteMesure, empreinteStatut, entreesDe, nomCible } from '../etat.ts';
import type { Chargeur, Cible, Contexte } from '../etat.ts';
import { ajouterJournal, lireNotes, notesOuvertes } from '../registre.ts';

export interface OptionsMarquer {
  relecteur: string;
  date: string;
  malgreNote: boolean;
  horsPerimetre: boolean;
}
export interface Dependances {
  ctx: Contexte;
  charger?: Chargeur;
}

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Date du jour à Paris, AAAA-MM-JJ. */
export function aujourdhuiParis(d: Date): string {
  return FORMAT_PARIS.format(d);
}

const objet = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const cleDiag = (d: Diagnostic): string => `${d.code}\u0000${d.file}\u0000${d.message}`;

interface Plan {
  file: string;
  chemin: Chemin;
  champs: Champ[];
  apres?: string;
  empreinte: (data: Record<string, unknown>) => string;
}

/**
 * Cœur de la commande (exporté pour les tests, qui injectent un chargeur). Renvoie le code de sortie :
 * 0 écrit, 1 refusé pour une raison de contenu.
 */
export function marquer(cible: Cible, options: OptionsMarquer, deps: Dependances): number {
  const { ctx } = deps;
  const charger = deps.charger ?? loadAll;
  const nom = nomCible(cible);
  const refuser = (message: string): number => {
    ctx.erreur(`refusé : ${nom} : ${message}`);
    return 1;
  };
  const avant = charger(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'production' });
  const erreursAvant = avant.diagnostics.filter((d) => d.severity === 'error');

  // Résolution de la cible dans la liste chargée (jamais un chemin reçu en argument).
  let plan: Plan;
  if (cible.type === 'mesure') {
    const m = entreesDe(avant, 'mesures').find((e) => e.id === cible.id);
    if (!m) return refuser('mesure inconnue (ou fichier invalide : voir npm run validate)');
    if (m.data.statut_relecture === 'publie') return refuser('mesure déjà publiée : la repasser en brouillon passe par la commande retirer');
    plan = {
      file: m.file,
      chemin: [],
      champs: [
        { cle: 'statut_relecture', valeur: 'relu' },
        { cle: 'relecteur', valeur: options.relecteur },
        { cle: 'date_relecture', valeur: options.date },
      ],
      empreinte: (d) => empreinteMesure(d),
    };
  } else if (cible.type === 'statut') {
    const c = entreesDe(avant, 'candidats').find((e) => e.id === cible.candidat);
    if (!c) return refuser('candidat inconnu');
    const statuts = tableau(c.data.statuts);
    // Statut retenu en preview : le plus récent de tous, celui que la production retiendra une fois relu (ADR-041).
    const retenu = statutRetenu(statuts, 'preview');
    if (retenu === undefined) return refuser('aucun statut');
    const index = statuts.indexOf(retenu);
    if (!codeDansPerimetre(retenu.code) && !options.horsPerimetre) {
      return refuser(`statut « ${String(retenu.code)} » hors du périmètre d’équité : seuls les statuts déclarés sont relus pour l’ouverture (D-06) ; --hors-perimetre pour passer outre`);
    }
    if (typeof retenu.date !== 'string' || !RE_DATE.test(retenu.date)) return refuser(`date du statut incomplète (« ${String(retenu.date)} ») : un statut relu exige une date complète`);
    if (retenu.statut_relecture === 'publie') return refuser('statut déjà publié');
    plan = {
      file: c.file,
      chemin: ['statuts', index],
      champs: [
        { cle: 'statut_relecture', valeur: 'relu' },
        { cle: 'relecteur', valeur: options.relecteur },
        { cle: 'date_relecture', valeur: options.date },
      ],
      empreinte: (d) => empreinteStatut(objet(tableau(d.statuts)[index])),
    };
  } else {
    const couv = entreesDe(avant, 'couverture').find((e) => e.data.theme === cible.theme);
    if (!couv) return refuser(`aucun fichier de couverture pour le thème ${cible.theme}`);
    const index = tableau(couv.data.cases).findIndex((k) => objet(k).candidat === cible.candidat);
    if (index < 0) return refuser(`aucune case pour ${cible.candidat} dans la couverture du thème ${cible.theme}`);
    plan = {
      file: couv.file,
      chemin: ['cases', index],
      champs: [
        { cle: 'verifie_le', valeur: options.date },
        { cle: 'verifie_par', valeur: options.relecteur },
      ],
      empreinte: (d) => empreinteCase(objet(tableau(d.cases)[index])),
    };
  }

  const erreursFichier = erreursAvant.filter((d) => d.file === plan.file);
  if (erreursFichier.length > 0) {
    for (const d of erreursFichier) ctx.erreur(`erreur : ${afficher(ctx, d)}`);
    return refuser('le fichier a des erreurs de validation');
  }
  const ouvertes = notesOuvertes(lireNotes(ctx.racine)).get(nom) ?? [];
  if (ouvertes.length > 0 && !options.malgreNote) {
    for (const n of ouvertes) ctx.erreur(`note ouverte (${n.horodatage}) : ${n.texte}`);
    return refuser(`${ouvertes.length} note(s) ouverte(s) : corriger puis « note --resoudre ${nom} », ou --malgre-note`);
  }

  const lu = readContained(ctx.racine, plan.file);
  if ('diagnostic' in lu) return refuser(lu.diagnostic.message);
  const original = lu.text;
  let nouveau: string;
  try {
    nouveau = definirChamps(original, plan.chemin, plan.champs, plan.apres !== undefined ? { apres: plan.apres } : {});
  } catch (e) {
    if (e instanceof EditionRefusee) return refuser(e.message);
    throw e;
  }
  ecrireAtomique(ctx.racine, plan.file, nouveau);

  // Validation après écriture : toute erreur nouvelle (code, fichier, message) restaure le fichier d'origine.
  let apres;
  try {
    apres = charger(ctx.racine, { schemasDir: ctx.schemasDir, mode: 'production' });
  } catch (e) {
    ecrireAtomique(ctx.racine, plan.file, original);
    throw e;
  }
  const connues = new Set(erreursAvant.map(cleDiag));
  const nouvelles = apres.diagnostics.filter((d) => d.severity === 'error' && !connues.has(cleDiag(d)));
  if (nouvelles.length > 0) {
    ecrireAtomique(ctx.racine, plan.file, original);
    for (const d of nouvelles) ctx.erreur(`erreur : ${afficher(ctx, d)}`);
    return refuser(`${nouvelles.length} nouvelle(s) erreur(s) de validation après écriture : fichier restauré`);
  }
  const relu = apres.entries.find((e) => e.file === plan.file);
  const empreinte = plan.empreinte(relu?.data ?? {});
  ajouterJournal(ctx.racine, {
    horodatage: ctx.maintenant().toISOString(),
    action: 'marquer',
    cible: nom,
    relecteur: options.relecteur,
    date: options.date,
    sha256: empreinte,
  });
  ctx.sortie(`relu : ${nom} (${options.relecteur}, ${options.date})`);
  return 0;
}

function afficher(ctx: Contexte, d: Diagnostic): string {
  return `${path.relative(ctx.racine, d.file).split(path.sep).join('/')}:${d.line}:${d.col} ${d.code} ${d.message}`;
}

const USAGE = 'usage : relecture marquer mesure <candidat/slug> | statut <candidat> | case <theme> <candidat> [--relecteur <nom>] [--date AAAA-MM-JJ] [--malgre-note] [--hors-perimetre]';

export default async function commande(argv: string[], ctx: Contexte): Promise<number> {
  let v: { relecteur?: string; date?: string; 'malgre-note'?: boolean; 'hors-perimetre'?: boolean };
  let p: string[];
  try {
    ({ values: v, positionals: p } = parseArgs({
      args: argv,
      options: { relecteur: { type: 'string' }, date: { type: 'string' }, 'malgre-note': { type: 'boolean' }, 'hors-perimetre': { type: 'boolean' } },
      allowPositionals: true,
      strict: true,
    }));
  } catch (e) {
    ctx.erreur(`marquer : ${e instanceof Error ? e.message : String(e)}`);
    ctx.erreur(USAGE);
    return 2;
  }
  const usage = (message: string): number => {
    ctx.erreur(`marquer : ${message}`);
    ctx.erreur(USAGE);
    return 2;
  };
  let cible: Cible;
  const [type, a, b, ...reste] = p;
  if (type === 'mesure' && a !== undefined && b === undefined) {
    const [candidat, slug, ...autres] = a.split('/');
    if (candidat === undefined || slug === undefined || autres.length > 0 || !RE_SEGMENT.test(candidat) || !RE_SEGMENT.test(slug)) return usage(`identifiant de mesure invalide « ${a} » (attendu : <candidat>/<slug>, jamais un chemin)`);
    cible = { type: 'mesure', id: a };
  } else if (type === 'statut' && a !== undefined && b === undefined) {
    if (!RE_SEGMENT.test(a)) return usage(`identifiant de candidat invalide « ${a} »`);
    cible = { type: 'statut', candidat: a };
  } else if (type === 'case' && a !== undefined && b !== undefined && reste.length === 0) {
    if (!RE_SEGMENT.test(a) || !RE_SEGMENT.test(b)) return usage('identifiants de thème ou de candidat invalides');
    cible = { type: 'case', theme: a, candidat: b };
  } else {
    return usage('cible attendue');
  }
  const relecteur = v.relecteur ?? RELECTEUR_DEFAUT;
  if (!relecteurValide(relecteur)) return usage(`nom de relecteur refusé « ${relecteur} »`);
  const date = v.date ?? aujourdhuiParis(ctx.maintenant());
  if (!dateValide(date)) return usage(`date invalide « ${date} » (AAAA-MM-JJ)`);
  return marquer(cible, { relecteur, date, malgreNote: v['malgre-note'] === true, horsPerimetre: v['hors-perimetre'] === true }, { ctx });
}
