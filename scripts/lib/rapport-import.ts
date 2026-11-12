// Rapport de répétition à blanc de l'import data.gouv (D-06). Module PUR : des données simples en
// entrée, aucun accès disque ni réseau, pour que le terminal et le corps de la pull request d'import
// reçoivent exactement le même texte, octet pour octet (identifiants triés, aucune horloge).
//
// Ce que le rapport n'imprime jamais, et pourquoi (neutralité, A4) :
//   - aucune étiquette de parti ni qualificatif : il ne cite que des identifiants, des codes de statut,
//     des dates, des adresses publiques et le nom public du jeu amont (pour les personnes à décider) ;
//   - aucune transition de statut sans son adresse source et sa date (chaque ligne en porte une) ;
//   - aucune décision sur une personne : statut, motif et type de source sont décidés par le relecteur ;
//   - le mot de la feuille de route pour une absence du jeu n'est repris qu'une fois, dans la phrase
//     de vocabulaire de l'en-tête : une personne absente du jeu amont n'a pas forcément renoncé.
// Le périmètre d'équité vient de rules/equite.ts (statutRetenu, dansPerimetre, statutLePlusRecent) :
// aucune copie de la définition.
import { dansPerimetre, statutLePlusRecent, statutRetenu } from '../../src/lib/content-core/rules/equite.ts';
import type { UpstreamRow } from './datagouv.ts';

type Obj = Record<string, unknown>;

/** Une fiche candidat telle que l'import la planifie (données seules, pas de disque). */
export interface PlanRapport {
  /** Identifiant de la fiche (src/content/candidats/<id>.yaml). */
  id: string;
  /** Identifiant dans le jeu amont. */
  idAmont: string;
  /** Fiche existante avant l'import, ou null si elle serait créée. */
  avant: Obj | null;
  /** Fiche après l'import (identique à `avant` si rien ne change). */
  apres: Obj;
  /** Fiche issue de la ligne amont (mapRow) : statuts[0] est le statut amont. */
  mappe: Obj;
}

export interface EntreeRapport {
  instantane: { nom: string; sha256: string; miseAJour: string; lignes: number; precedent: string | null };
  plans: PlanRapport[];
  /** Lignes amont absentes de correspondances.yaml (faits amont seuls). */
  inconnus: UpstreamRow[];
  conflits: string[];
  /** Identifiants du jeu précédent (celui que pointe data/dataset-datagouv.yaml), ou null. */
  precedent: { miseAJour: string; ids: string[] } | null;
  /** Identifiants du nouveau jeu. */
  idsAmont: string[];
  /** Fiches dont ids_externes.2027etmoi n'est pas dans le nouveau jeu. */
  fichesAbsentes: { id: string; idAmont: string }[];
  /** Corpus avant import : statuts de chaque candidat, thèmes, mesures, cases de couverture. */
  candidats: { id: string; statuts: unknown }[];
  themes: { id: string; statutRelecture: string }[];
  mesures: { theme: string; candidat: string; statutRelecture: string }[];
  couvertures: { theme: string; candidat: string; etat: string }[];
  themesOuverts: string[];
}

export interface ConsequenceTheme {
  theme: string;
  cellulesMaintenant: number;
  cellulesApres: number;
  casAcreer: { id: string; code: string }[];
  sortants: { id: string; code: string; mesures: number; cas: string }[];
}

export interface Rapport {
  entete: { nom: string; sha256: string; miseAJour: string; lignes: number; precedent: string | null; cree: number; ajoutes: number; inchanges: number };
  nouveaux: string[];
  aDecider: string[];
  absents: string[];
  changes: string[];
  dejaRelus: string[];
  consequences: ConsequenceTheme[];
  derives: string[];
  conflits: string[];
}

const trier = (xs: string[]): string[] => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const objet = (v: unknown): Obj => (v !== null && typeof v === 'object' ? (v as Obj) : {});
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Texte venu de l'amont : aucun tiret long ou demi-long ne traverse (règle de typographie du projet). */
const propre = (s: string): string => s.replace(/[\u2013\u2014]/g, '-');
const codeMotif = (s: Obj): string => `${String(s.code)}${s.motif !== undefined ? `/${String(s.motif)}` : ''}`;
const sourceDe = (s: Obj): { url: string; date: string } => {
  const src = objet(s.source);
  return { url: String(src.url), date: String(src.date_publication ?? s.date) };
};
const memeCodeMotif = (a: Obj, b: Obj): boolean => a.code === b.code && a.motif === b.motif;

/** Données seules en entrée, structure en sortie : le texte est rendu par rapportMarkdown. */
export function construireRapport(e: EntreeRapport): Rapport {
  const plans = [...e.plans].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const themesOuverts = new Set(e.themesOuverts);
  const themesPublies = trier(e.themes.filter((t) => t.statutRelecture === 'publie' && themesOuverts.has(t.id)).map((t) => t.id));

  const nouveaux: string[] = [];
  const changes: string[] = [];
  const dejaRelus: string[] = [];
  const derives: string[] = [];
  let cree = 0;
  let ajoutes = 0;
  let inchanges = 0;

  const mesuresPubliees = (theme: string, id: string): number => e.mesures.filter((m) => m.theme === theme && m.candidat === id && m.statutRelecture === 'publie').length;
  const caseDe = (theme: string, id: string): string => e.couvertures.find((c) => c.theme === theme && c.candidat === id)?.etat ?? 'aucune';

  for (const p of plans) {
    const amont = objet(tableau(p.mappe.statuts)[0]);
    const srcAmont = sourceDe(amont);
    if (p.avant === null) {
      cree += 1;
      nouveaux.push(`- ${p.id} : ${String(amont.code)} (${String(amont.date)}), source ${srcAmont.url} du ${srcAmont.date}`);
      continue;
    }
    const avantStatuts = tableau(p.avant.statuts);
    const apresStatuts = tableau(p.apres.statuts);
    const action = apresStatuts.length > avantStatuts.length ? 'statut_ajoute' : 'inchange';
    const ancien = statutLePlusRecent(avantStatuts) ?? {};
    if (action === 'statut_ajoute') {
      ajoutes += 1;
      const nouveau = statutLePlusRecent(apresStatuts) ?? {};
      const src = sourceDe(nouveau);
      changes.push(`- ${p.id} : statut : ${codeMotif(ancien)} (${String(ancien.date)}) -> ${codeMotif(nouveau)} (${String(nouveau.date)}), source ${src.url} du ${src.date}`);
      const prod = statutRetenu(avantStatuts, 'production');
      if (prod !== undefined && !memeCodeMotif(prod, nouveau)) {
        const a = sourceDe(prod);
        dejaRelus.push(`- ${p.id} : relu ${codeMotif(prod)} (${String(prod.date)}), source ${a.url} du ${a.date} -> ${codeMotif(nouveau)} (${String(nouveau.date)}), source ${src.url} du ${src.date}`);
        if (dansPerimetre(avantStatuts, 'production')) {
          for (const t of themesPublies) dejaRelus.push(`  - thème ${t} : ${mesuresPubliees(t, p.id)} mesure(s) publiée(s), case : ${caseDe(t, p.id)}`);
        }
      }
    } else {
      inchanges += 1;
      const srcAncien = sourceDe(ancien);
      if (srcAncien.url !== srcAmont.url || String(ancien.date) !== String(amont.date)) {
        derives.push(`- ${p.id} : ${String(ancien.code)} inchangé ; fichier ${srcAncien.url} du ${srcAncien.date} ; amont ${srcAmont.url} du ${srcAmont.date}`);
      }
    }
    // Champs que l'import ne modifie jamais : signalés, jamais recopiés (aucune étiquette n'est imprimée).
    if (p.mappe.parti !== null && p.mappe.parti !== undefined && p.mappe.parti !== p.avant.parti) changes.push(`- ${p.id} : parti : différent du fichier (non appliqué)`);
    if (p.mappe.site_officiel !== undefined && p.mappe.site_officiel !== p.avant.site_officiel) changes.push(`- ${p.id} : site_officiel : différent du fichier (non appliqué)`);
  }

  const aDecider = [...e.inconnus]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => {
      const liens = trier(Object.keys(r.liens));
      return `- ${propre(r.id)} : ${propre(r.nom)}, ${r.statut} (${r.source.date}), source ${r.source.url}, vérifié le ${r.verifie_le}, liens : ${liens.length > 0 ? liens.join(', ') : 'aucun'}`;
    });

  // Absents du jeu amont : fiches dont la clé amont a disparu, et lignes du jeu précédent qui ne sont plus là.
  const absentsParCle = new Map<string, string | null>();
  for (const f of e.fichesAbsentes) absentsParCle.set(f.idAmont, f.id);
  if (e.precedent !== null) {
    const maintenant = new Set(e.idsAmont);
    for (const id of e.precedent.ids) if (!maintenant.has(id) && !absentsParCle.has(id)) absentsParCle.set(id, null);
  }
  const absents = trier([...absentsParCle.keys()]).map((cle) => {
    const fiche = absentsParCle.get(cle);
    return `- ${propre(cle)}${fiche !== null && fiche !== undefined ? ` (fiche ${fiche})` : ''} : absent du jeu amont du ${e.instantane.miseAJour}`;
  });

  // Conséquences sur les thèmes publiés : périmètre de production (ce que le site montre) et d'aperçu (ce que verra la relecture).
  const apres = new Map<string, unknown>(e.candidats.map((c) => [c.id, c.statuts]));
  for (const p of plans) apres.set(p.id, p.apres.statuts);
  const perimetreProd = trier(e.candidats.filter((c) => dansPerimetre(c.statuts, 'production')).map((c) => c.id));
  const perimetreApres = trier([...apres.entries()].filter(([, s]) => dansPerimetre(s, 'preview')).map(([id]) => id));
  const prod = new Set(perimetreProd);
  const consequences: ConsequenceTheme[] = themesPublies.map((theme) => {
    const casAcreer = perimetreApres
      .filter((id) => !prod.has(id) && mesuresPubliees(theme, id) === 0 && caseDe(theme, id) === 'aucune')
      .map((id) => ({ id, code: String(statutRetenu(apres.get(id), 'preview')?.code) }));
    const nouveauSet = new Set(perimetreApres);
    const sortants = perimetreProd
      .filter((id) => !nouveauSet.has(id))
      .map((id) => ({ id, code: String(statutRetenu(apres.get(id), 'preview')?.code), mesures: mesuresPubliees(theme, id), cas: caseDe(theme, id) }));
    return { theme, cellulesMaintenant: perimetreProd.length, cellulesApres: perimetreApres.length, casAcreer, sortants };
  });

  const conflits = e.conflits.map((c) => `- ${propre(c.replace(/\s[\u2013\u2014]\s/g, ' : '))}`);

  return {
    entete: { ...e.instantane, cree, ajoutes, inchanges },
    nouveaux,
    aDecider,
    absents,
    changes,
    dejaRelus,
    consequences,
    derives,
    conflits,
  };
}

const liste = (lignes: string[]): string => (lignes.length > 0 ? lignes.join('\n') : 'aucun');

/** Texte Markdown du rapport : sections toujours présentes, « aucun » quand elles sont vides. */
export function rapportMarkdown(r: Rapport): string {
  const h = r.entete;
  const out: string[] = [];
  out.push('# Rapport de répétition à blanc de l\'import data.gouv', '');
  out.push('## Instantané', '');
  out.push(`- instantané : ${h.nom}`);
  out.push(`- empreinte SHA-256 : ${h.sha256}`);
  out.push(`- mise à jour amont : ${h.miseAJour}`);
  out.push(`- lignes amont : ${h.lignes}`);
  out.push(h.precedent === null ? '- aucun instantané précédent référencé' : `- instantané précédent : ${h.precedent}`);
  out.push(`- fiches : ${h.cree} créée(s), ${h.ajoutes} statut(s) ajouté(s), ${h.inchanges} inchangée(s)`);
  out.push('');
  out.push('Vocabulaire : « absents du jeu amont » correspond aux « retirés » de la feuille de route ; une absence du jeu ne vaut pas retrait de candidature.');
  out.push('', '## Nouveaux', '', liste(r.nouveaux), '');
  out.push('## Nouveaux à décider (absents de correspondances.yaml)', '', liste(r.aDecider), '');
  out.push('## Absents du jeu amont', '', liste(r.absents), '');
  out.push('## Changés', '', liste(r.changes), '');
  out.push('## Statut déjà relu qui change', '', liste(r.dejaRelus), '');
  out.push('## Conséquences sur les thèmes publiés', '');
  if (r.consequences.length === 0) out.push('aucun thème publié', '');
  for (const c of r.consequences) {
    out.push(`### ${c.theme}`, '');
    out.push(`- cellules attendues : ${c.cellulesMaintenant} maintenant, ${c.cellulesApres} après relecture de tous les statuts importés`);
    out.push(`- case de couverture à créer avant de relire le statut : ${c.casAcreer.length > 0 ? c.casAcreer.map((x) => `${x.id} (${x.code})`).join(', ') : 'aucun'}`);
    out.push(
      `- sort du périmètre après relecture : ${c.sortants.length > 0 ? c.sortants.map((x) => `${x.id} (${x.code}), ${x.mesures} mesure(s) publiée(s), case : ${x.cas}`).join(' ; ') : 'aucun'}`,
    );
    out.push('');
  }
  out.push('## Dérives de source (information)', '', liste(r.derives), '');
  out.push('## Conflits', '', liste(r.conflits), '');
  out.push('---', '');
  out.push("Aucune décision sur une personne n'est prise par cet outil : statut, motif et type de source sont décidés par le relecteur.", '');
  return out.join('\n');
}
