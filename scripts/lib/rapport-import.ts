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
  /**
   * Fichiers refusés par le chargeur (diagnostic d'erreur) : absents de `candidats`, `themes`, `mesures` et
   * `couvertures`, donc du calcul des conséquences (WR-03). Facultatif : absent, rien n'est signalé.
   */
  fichiersRefuses?: string[];
}

export interface ConsequenceTheme {
  theme: string;
  /** Vrai si le thème est publié mais absent de themes_ouverts : la règle d'équité le contrôle quand même. */
  horsListeBlanche: boolean;
  /** Personnes à décider (absentes de la table) dont le statut amont est dans le périmètre d'équité. */
  aDeciderDansPerimetre: { id: string; code: string }[];
  cellulesMaintenant: number;
  cellulesApres: number;
  casAcreer: { id: string; code: string }[];
  sortants: { id: string; code: string; mesures: number; cas: string }[];
}

export interface Rapport {
  entete: { nom: string; sha256: string; miseAJour: string; lignes: number; precedent: string | null; cree: number; ajoutes: number; inchanges: number; fichiersRefuses: string[] | null };
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

// ---- CR-01 : un seul point d'échappement pour tout ce qui entre dans le Markdown -------------------------------
// Le rapport devient le corps d'une pull request publique. Tout texte venu de l'amont (nom, adresses, clés de
// `liens`) ou d'un fichier est une donnée tierce : une valeur sûre (liste blanche de caractères stricte) est
// imprimée telle quelle, si bien qu'une ligne légitime ne change pas ; toute autre valeur est imprimée dans un span
// de code, où rien n'est interprété (ni titre, ni lien, ni image, ni balise, ni mention, ni tableau). Les caractères
// de contrôle, séparateurs de ligne, caractères invisibles et de direction deviennent des espaces : aucune valeur
// ne peut ouvrir une ligne, donc une section.
// eslint-disable-next-line no-control-regex
const INVISIBLES = /[\u0000-\u001f\u007f-\u009f\u00ad\u2028\u2029\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
/** Span de code CommonMark : la clôture est plus longue que toute suite d'accents graves du texte. */
function enCode(s: string): string {
  const t = propre(s).replace(INVISIBLES, ' ');
  if (t.trim() === '') return '` `';
  const plusLongue = Math.max(0, ...(t.match(/`+/g) ?? []).map((x) => x.length));
  if (plusLongue === 0) return `\`${t}\``;
  const cloture = '`'.repeat(plusLongue + 1);
  return `${cloture} ${t} ${cloture}`;
}
/** Jeton sûr : identifiant, code de statut, motif, date (lettres ASCII, chiffres, « - », « / », « _ », « . »). */
const JETON_SUR = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
const jeton = (v: unknown): string => {
  const s = String(v);
  return JETON_SUR.test(s) ? s : enCode(s);
};
/** Texte libre sûr (nom d'une personne) : lettres, chiffres, espaces simples, apostrophes, point, virgule, tirets, parenthèses. */
const TEXTE_SUR = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()\u2013\u2014-]*$/u;
const texteAmont = (v: unknown): string => {
  const s = String(v);
  return TEXTE_SUR.test(s) ? propre(s) : enCode(s);
};
/** Message d'un conflit (écrit par l'outil, cite des identifiants, codes, dates et chemins) : même règle, liste un peu plus large. */
const MESSAGE_SUR = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,:;'’«»()/=+_\u2013\u2014-]*$/u;
const messageSur = (s: string): string => (MESSAGE_SUR.test(s) ? propre(s) : enCode(s));
/**
 * Adresse : imprimée telle quelle seulement si c'est une URL https dont chaque caractère est dans une liste blanche
 * stricte (ni crochet, ni parenthèse, ni chevron, ni « @ », ni « ! », ni accent grave, ni espace) ; sinon sa forme
 * normalisée (`URL.href`, qui encode chevrons, guillemets et espaces) dans un span de code, sans lien.
 */
const URL_SURE = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][A-Za-z0-9._~:/?#=&%+,;-]*)?$/;
const urlAmont = (v: unknown): string => {
  const s = String(v);
  if (URL_SURE.test(s) && URL.canParse(s) && new URL(s).protocol === 'https:') return s;
  return enCode(URL.canParse(s) ? new URL(s).href : s);
};

const codeMotif = (s: Obj): string => `${jeton(s.code)}${s.motif !== undefined ? `/${jeton(s.motif)}` : ''}`;
const sourceDe = (s: Obj): { url: string; date: string } => {
  const src = objet(s.source);
  return { url: urlAmont(src.url), date: jeton(src.date_publication ?? s.date) };
};
const memeCodeMotif = (a: Obj, b: Obj): boolean => a.code === b.code && a.motif === b.motif;

/** Données seules en entrée, structure en sortie : le texte est rendu par rapportMarkdown. */
export function construireRapport(e: EntreeRapport): Rapport {
  const plans = [...e.plans].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const themesOuverts = new Set(e.themesOuverts);
  // WR-03 : mêmes thèmes que la règle d'équité (regleEquite contrôle tout thème publié, liste blanche ou non).
  const themesPublies = trier(e.themes.filter((t) => t.statutRelecture === 'publie').map((t) => t.id));

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
      nouveaux.push(`- ${jeton(p.id)} : ${jeton(amont.code)} (${jeton(amont.date)}), source ${srcAmont.url} du ${srcAmont.date}`);
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
      changes.push(`- ${jeton(p.id)} : statut : ${codeMotif(ancien)} (${jeton(ancien.date)}) -> ${codeMotif(nouveau)} (${jeton(nouveau.date)}), source ${src.url} du ${src.date}`);
      const prod = statutRetenu(avantStatuts, 'production');
      if (prod !== undefined && !memeCodeMotif(prod, nouveau)) {
        const a = sourceDe(prod);
        dejaRelus.push(`- ${jeton(p.id)} : relu ${codeMotif(prod)} (${jeton(prod.date)}), source ${a.url} du ${a.date} -> ${codeMotif(nouveau)} (${jeton(nouveau.date)}), source ${src.url} du ${src.date}`);
        if (dansPerimetre(avantStatuts, 'production')) {
          for (const t of themesPublies) dejaRelus.push(`  - thème ${jeton(t)} : ${mesuresPubliees(t, p.id)} mesure(s) publiée(s), case : ${jeton(caseDe(t, p.id))}`);
        }
      }
    } else {
      inchanges += 1;
      const srcAncien = sourceDe(ancien);
      if (srcAncien.url !== srcAmont.url || String(ancien.date) !== String(amont.date)) {
        derives.push(`- ${jeton(p.id)} : ${jeton(ancien.code)} inchangé ; fichier ${srcAncien.url} du ${srcAncien.date} ; amont ${srcAmont.url} du ${srcAmont.date}`);
      }
    }
    // Champs que l'import ne modifie jamais : signalés, jamais recopiés (aucune étiquette n'est imprimée).
    if (p.mappe.parti !== null && p.mappe.parti !== undefined && p.mappe.parti !== p.avant.parti) changes.push(`- ${jeton(p.id)} : parti : différent du fichier (non appliqué)`);
    if (p.mappe.site_officiel !== undefined && p.mappe.site_officiel !== p.avant.site_officiel) changes.push(`- ${jeton(p.id)} : site_officiel : différent du fichier (non appliqué)`);
  }

  const aDecider = [...e.inconnus]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => {
      const liens = trier(Object.keys(r.liens));
      return `- ${jeton(r.id)} : ${texteAmont(r.nom)}, ${jeton(r.statut)} (${jeton(r.source.date)}), source ${urlAmont(r.source.url)}, vérifié le ${jeton(r.verifie_le)}, liens : ${liens.length > 0 ? liens.map(jeton).join(', ') : 'aucun'}`;
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
    return `- ${jeton(cle)}${fiche !== null && fiche !== undefined ? ` (fiche ${jeton(fiche)})` : ''} : absent du jeu amont du ${jeton(e.instantane.miseAJour)}`;
  });

  // Conséquences sur les thèmes publiés : périmètre de production (ce que le site montre) et d'aperçu (ce que verra la relecture).
  const apres = new Map<string, unknown>(e.candidats.map((c) => [c.id, c.statuts]));
  for (const p of plans) apres.set(p.id, p.apres.statuts);
  const perimetreProd = trier(e.candidats.filter((c) => dansPerimetre(c.statuts, 'production')).map((c) => c.id));
  const perimetreApres = trier([...apres.entries()].filter(([, s]) => dansPerimetre(s, 'preview')).map(([id]) => id));
  const prod = new Set(perimetreProd);
  // WR-03 : une ligne à décider qui entrerait dans le périmètre une fois sa ligne de table écrite et son statut relu.
  const aDeciderDansPerimetre = [...e.inconnus]
    .filter((r) => dansPerimetre([{ code: r.statut }], 'preview'))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => ({ id: r.id, code: r.statut }));
  const consequences: ConsequenceTheme[] = themesPublies.map((theme) => {
    const casAcreer = perimetreApres
      .filter((id) => !prod.has(id) && mesuresPubliees(theme, id) === 0 && caseDe(theme, id) === 'aucune')
      .map((id) => ({ id, code: String(statutRetenu(apres.get(id), 'preview')?.code) }));
    const nouveauSet = new Set(perimetreApres);
    const sortants = perimetreProd
      .filter((id) => !nouveauSet.has(id))
      .map((id) => ({ id, code: String(statutRetenu(apres.get(id), 'preview')?.code), mesures: mesuresPubliees(theme, id), cas: caseDe(theme, id) }));
    return {
      theme,
      horsListeBlanche: !themesOuverts.has(theme),
      cellulesMaintenant: perimetreProd.length,
      cellulesApres: perimetreApres.length,
      casAcreer,
      sortants,
      aDeciderDansPerimetre,
    };
  });

  const conflits = e.conflits.map((c) => `- ${messageSur(c.replace(/\s[\u2013\u2014]\s/g, ' : '))}`);

  return {
    entete: { ...e.instantane, cree, ajoutes, inchanges, fichiersRefuses: e.fichiersRefuses === undefined ? null : trier(e.fichiersRefuses) },
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
  out.push(`- instantané : ${jeton(h.nom)}`);
  out.push(`- empreinte SHA-256 : ${jeton(h.sha256)}`);
  out.push(`- mise à jour amont : ${jeton(h.miseAJour)}`);
  out.push(`- lignes amont : ${jeton(h.lignes)}`);
  out.push(h.precedent === null ? '- aucun instantané précédent référencé' : `- instantané précédent : ${jeton(h.precedent)}`);
  out.push(`- fiches : ${h.cree} créée(s), ${h.ajoutes} statut(s) ajouté(s), ${h.inchanges} inchangée(s)`);
  if (h.fichiersRefuses !== null) {
    out.push(
      h.fichiersRefuses.length === 0
        ? '- fichiers refusés par le chargeur : aucun'
        : `- fichiers refusés par le chargeur, absents du calcul des conséquences (la règle d’équité se tait tant qu’il en reste) : ${h.fichiersRefuses.map(jeton).join(', ')}`,
    );
  }
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
    out.push(`### ${jeton(c.theme)}${c.horsListeBlanche ? ' (hors liste blanche)' : ''}`, '');
    out.push(`- cellules attendues : ${c.cellulesMaintenant} maintenant, ${c.cellulesApres} après relecture de tous les statuts en attente (importés ou déjà en brouillon)`);
    out.push(`- case de couverture à créer avant de relire le statut : ${c.casAcreer.length > 0 ? c.casAcreer.map((x) => `${jeton(x.id)} (${jeton(x.code)})`).join(', ') : 'aucun'}`);
    out.push(
      `- sort du périmètre après relecture : ${c.sortants.length > 0 ? c.sortants.map((x) => `${jeton(x.id)} (${jeton(x.code)}), ${x.mesures} mesure(s) publiée(s), case : ${jeton(x.cas)}`).join(' ; ') : 'aucun'}`,
    );
    if (c.aDeciderDansPerimetre.length > 0) {
      out.push(`- à décider, entreraient dans le périmètre une fois la table écrite et le statut relu : ${c.aDeciderDansPerimetre.map((x) => `${jeton(x.id)} (${jeton(x.code)})`).join(', ')}`);
    }
    out.push('');
  }
  out.push('## Dérives de source (information)', '', liste(r.derives), '');
  out.push('## Conflits', '', liste(r.conflits), '');
  out.push('---', '');
  out.push("Aucune décision sur une personne n'est prise par cet outil : statut, motif et type de source sont décidés par le relecteur.", '');
  return out.join('\n');
}
