// Veille des candidatures (phase 10.1) : classement des changements dans les termes de la demande d'Erwan
// (sorties, entrées, retours, décisions à prendre). Module PUR : l'entrée du rapport d'import (calculée par
// `import-datagouv --dry-run --format json`) en entrée, aucune horloge, aucun disque, aucun réseau.
//
// Ce module ne décide rien sur une personne : il range des faits amont déjà calculés par l'import et renvoie aux
// commandes par lesquelles Erwan décide. Le périmètre d'équité vient de rules/equite.ts (aucune copie).
// Neutralité : aucune étiquette de parti, aucun qualificatif ; tout texte amont passe par l'échappement du rapport.
import { PERIMETRE_EQUITE } from '../../../src/lib/content-core/rules/config.ts';
import { statutLePlusRecent } from '../../../src/lib/content-core/rules/equite.ts';
import { MOTIFS_RENONCEMENT, codeMotif, construireRapport, enCode, jeton, texteAmont, urlAmont } from '../rapport-import.ts';
import type { ConsequenceTheme, EntreeRapport, MotifADecider } from '../rapport-import.ts';

type Obj = Record<string, unknown>;
const objet = (v: unknown): Obj => (v !== null && typeof v === 'object' ? (v as Obj) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const parId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Codes qui font sortir une personne de la course. */
export const CODES_SORTIE = ['renonce', 'empeche'] as const;
const sortie = (code: unknown): boolean => (CODES_SORTIE as readonly unknown[]).includes(code);
const perimetre = (code: unknown): boolean => (PERIMETRE_EQUITE as readonly unknown[]).includes(code);

export interface Mouvement {
  /** Identifiant de la fiche, ou identifiant amont pour une personne absente de la table. */
  id: string;
  idAmont: string;
  /** Code (et motif) du dernier statut du fichier, null pour une personne nouvelle. */
  avant: string | null;
  dateAvant: string | null;
  /** Code (et motif) amont ; « motif à décider » si la table n'a pas de motif. */
  apres: string;
  date: string;
  url: string;
  motifADecider: boolean;
}

export interface Decision {
  genre: 'correspondance' | 'motif';
  idAmont: string;
  /** Nom public amont (correspondance seulement). */
  nom?: string;
  id?: string;
  code: string;
  date: string;
  url: string;
}

export interface ClassementVeille {
  sha256: string;
  miseAJour: string;
  lignes: number;
  sorties: Mouvement[];
  entrees: Mouvement[];
  retours: Mouvement[];
  autres: Mouvement[];
  decisions: Decision[];
  derives: number;
  consequences: ConsequenceTheme[];
  /** Vrai s'il y a quelque chose à décider ou à relire : seule condition d'une alerte. */
  notable: boolean;
}

function ranger(m: Mouvement, codeAvant: unknown, codeApres: unknown, c: Pick<ClassementVeille, 'sorties' | 'entrees' | 'retours' | 'autres'>): void {
  // Personne nouvelle : entrée si son statut est dans le périmètre, sinon simple information (déjà hors course).
  if (codeAvant === null || codeAvant === undefined) (perimetre(codeApres) ? c.entrees : c.autres).push(m);
  else if (sortie(codeApres) && !sortie(codeAvant)) c.sorties.push(m);
  else if (sortie(codeAvant) && !sortie(codeApres)) c.retours.push(m);
  else if (perimetre(codeApres) && !perimetre(codeAvant)) c.entrees.push(m);
  else c.autres.push(m);
}

/** Classement de la veille, à partir de la même entrée que le rapport d'import (aucun recalcul du périmètre). */
export function classerVeille(entree: EntreeRapport): ClassementVeille {
  const rapport = construireRapport(entree);
  const c: ClassementVeille = {
    sha256: entree.instantane.sha256,
    miseAJour: entree.instantane.miseAJour,
    lignes: entree.instantane.lignes,
    sorties: [],
    entrees: [],
    retours: [],
    autres: [],
    decisions: [],
    derives: rapport.derives.length,
    consequences: rapport.consequences,
    notable: false,
  };

  for (const p of [...entree.plans].sort(parId)) {
    const amont = objet(tableau(p.mappe.statuts)[0]);
    const src = objet(amont.source);
    if (p.avant === null) {
      ranger({ id: p.id, idAmont: p.idAmont, avant: null, dateAvant: null, apres: codeMotif(amont), date: String(amont.date), url: String(src.url), motifADecider: false }, null, amont.code, c);
      continue;
    }
    const avant = tableau(p.avant.statuts);
    const apres = tableau(p.apres.statuts);
    if (apres.length <= avant.length) continue;
    const ancien = statutLePlusRecent(avant) ?? {};
    const nouveau = statutLePlusRecent(apres) ?? {};
    const srcN = objet(nouveau.source);
    ranger(
      { id: p.id, idAmont: p.idAmont, avant: codeMotif(ancien), dateAvant: String(ancien.date), apres: codeMotif(nouveau), date: String(nouveau.date), url: String(srcN.url), motifADecider: false },
      ancien.code,
      nouveau.code,
      c,
    );
  }

  for (const m of [...(entree.motifsADecider ?? [])].sort(parId) as MotifADecider[]) {
    const ancien = statutLePlusRecent(m.avant);
    ranger(
      { id: m.id, idAmont: m.idAmont, avant: ancien === undefined ? null : codeMotif(ancien), dateAvant: ancien === undefined ? null : String(ancien.date), apres: m.code, date: m.date, url: m.url, motifADecider: true },
      ancien?.code ?? null,
      m.code,
      c,
    );
    c.decisions.push({ genre: 'motif', idAmont: m.idAmont, id: m.id, code: m.code, date: m.date, url: m.url });
  }

  for (const r of [...entree.inconnus].sort(parId)) {
    const m: Mouvement = { id: r.id, idAmont: r.id, avant: null, dateAvant: null, apres: r.statut, date: r.source.date, url: r.source.url, motifADecider: false };
    ranger(m, null, r.statut, c);
    c.decisions.push({ genre: 'correspondance', idAmont: r.id, nom: r.nom, code: r.statut, date: r.source.date, url: r.source.url });
  }

  for (const k of ['sorties', 'entrees', 'retours', 'autres'] as const) c[k].sort(parId);
  c.decisions.sort((a, b) => (a.idAmont < b.idAmont ? -1 : a.idAmont > b.idAmont ? 1 : a.genre < b.genre ? -1 : 1));
  c.notable = c.sorties.length + c.entrees.length + c.retours.length + c.autres.length + c.decisions.length > 0;
  return c;
}

const liste = (lignes: string[]): string => (lignes.length > 0 ? lignes.join('\n') : 'aucun');

function ligneMouvement(m: Mouvement): string {
  const depuis = m.avant === null ? 'nouvelle personne' : `${jeton(m.avant)} (${jeton(m.dateAvant)})`;
  const vers = m.motifADecider ? `${jeton(m.apres)}, motif à décider` : jeton(m.apres);
  const qui = m.id === m.idAmont ? jeton(m.id) : `${jeton(m.id)} (amont ${jeton(m.idAmont)})`;
  return `- ${qui} : ${depuis} -> ${vers} (${jeton(m.date)}), source ${urlAmont(m.url)}`;
}

/** Comptes de la veille, sans aucun nom : texte des alertes (notification, Telegram). */
export function comptesVeille(c: ClassementVeille): string {
  return `${c.sorties.length} sortie(s), ${c.entrees.length} entrée(s), ${c.retours.length} retour(s), ${c.autres.length} autre(s) changement(s), ${c.decisions.length} décision(s) à prendre`;
}

/** Résumé Markdown de la veille, placé au-dessus du rapport d'import (sûr pour un corps de pull request). */
export function resumeVeilleMarkdown(c: ClassementVeille): string {
  const out: string[] = [];
  out.push('# Veille des candidatures', '');
  out.push(`- jeu amont : empreinte ${jeton(c.sha256.slice(0, 12))}, mise à jour ${jeton(c.miseAJour)}, ${Number(c.lignes)} ligne(s)`);
  out.push(`- ${comptesVeille(c)} ; ${c.derives} dérive(s) de source (information, sans alerte)`);
  out.push('', 'Sortie : statut amont « renonce » ou « empeche » pour une personne qui ne l’avait pas. Entrée : personne nouvelle, ou statut qui passe à « declare » ou « primaire ». Retour : sortie annulée. Rien de ceci ne change le site avant une pull request relue.');
  out.push('', '## Sorties', '', liste(c.sorties.map(ligneMouvement)), '');
  out.push('## Entrées', '', liste(c.entrees.map(ligneMouvement)), '');
  out.push('## Retours', '', liste(c.retours.map(ligneMouvement)), '');
  out.push('## Autres changements de statut', '', liste(c.autres.map(ligneMouvement)), '');
  out.push('## Décisions à prendre (Erwan seul)', '');
  out.push(
    liste(
      c.decisions.map((d) =>
        d.genre === 'correspondance'
          ? `- ligne de correspondances.yaml à écrire : ${jeton(d.idAmont)} (${texteAmont(d.nom ?? '')}), ${jeton(d.code)} (${jeton(d.date)}) : npm run veille -- decider ${jeton(d.idAmont)}`
          : `- motif du désistement à choisir parmi ${MOTIFS_RENONCEMENT.join(', ')} : ${jeton(d.idAmont)} (fiche ${jeton(d.id)}) : npm run veille -- decider ${jeton(d.idAmont)}`,
      ),
    ),
    '',
  );
  out.push('## Effet sur les thèmes publiés', '');
  if (c.consequences.length === 0) out.push('aucun thème publié', '');
  for (const t of c.consequences) {
    out.push(
      `- ${jeton(t.theme)} : case de couverture à créer avant de relire le statut : ${t.casAcreer.length > 0 ? t.casAcreer.map((x) => jeton(x.id)).join(', ') : 'aucune'} ; sortira du périmètre une fois le statut relu : ${t.sortants.length > 0 ? t.sortants.map((x) => `${jeton(x.id)} (${x.mesures} mesure(s) publiée(s))`).join(', ') : 'personne'}${t.aDeciderDansPerimetre.length > 0 ? ` ; à décider, entreraient dans le périmètre : ${t.aDeciderDansPerimetre.map((x) => jeton(x.id)).join(', ')}` : ''}`,
    );
  }
  out.push('');
  return out.join('\n');
}

/**
 * Texte amont non relu (`statut_detail`), pour aider Erwan à choisir un motif. Rapport LOCAL seulement : jamais dans
 * `src/content/`, jamais dans le corps d'une pull request (dépôt public, texte non relu).
 */
export function detailsLocauxMarkdown(c: ClassementVeille, details: Record<string, string>): string {
  const ids = [...new Set([...c.sorties, ...c.entrees, ...c.retours, ...c.autres].map((m) => m.idAmont))].sort();
  const lignes = ids.filter((id) => typeof details[id] === 'string' && details[id].trim() !== '').map((id) => `- ${jeton(id)} : ${enCode(details[id] as string)}`);
  return ['## Texte amont non relu (rapport local seulement, jamais publié)', '', liste(lignes), ''].join('\n');
}
