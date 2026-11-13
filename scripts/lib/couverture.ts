import { foldKey } from '../../src/lib/content-core/rules/text/normalize.ts';
import { analyserYamlPlafonne, messageRefus } from '../../src/lib/content-core/yaml-plafonne.ts';

// Tableau de couverture des thèmes (CONT-04). Module PUR : aucun import node:, aucune lecture
// disque. Il valide la forme de data/couverture-themes.yaml et recalcule, à partir des seules cases
// (jamais de totaux saisis à la main), le classement des 10 thèmes de la spec et les 3 thèmes pilotes.

export interface ThemeSpec {
  id: string;
  nom: string;
  ordre: number;
  prioritaire_aine: boolean;
}

/** Les 10 thèmes de la spec, dans l'ordre de la spec. Les thèmes Aîné prioritaires partagent le départage. */
export const THEMES_SPEC: readonly ThemeSpec[] = [
  { id: 'logement', nom: 'Logement', ordre: 1, prioritaire_aine: true },
  { id: 'ecole', nom: 'École', ordre: 2, prioritaire_aine: false },
  { id: 'retraites', nom: 'Retraites', ordre: 3, prioritaire_aine: true },
  { id: 'sante', nom: 'Santé', ordre: 4, prioritaire_aine: true },
  { id: 'securite', nom: 'Sécurité', ordre: 5, prioritaire_aine: false },
  { id: 'climat', nom: 'Climat', ordre: 6, prioritaire_aine: false },
  { id: 'travail', nom: 'Travail', ordre: 7, prioritaire_aine: false },
  { id: 'impots', nom: 'Impôts', ordre: 8, prioritaire_aine: false },
  { id: 'europe-et-monde', nom: 'Europe et monde', ordre: 9, prioritaire_aine: false },
  { id: 'institutions', nom: 'Institutions', ordre: 10, prioritaire_aine: false },
];

export const NIVEAUX = ['fort', 'partiel', 'silence', 'aucun', 'inaccessible'] as const;
export const ACCES = ['ok', 'partiel', 'bloque', 'aucun_site'] as const;
/** Écart de candidats en dessous duquel deux thèmes sont à égalité (marge d'erreur de la mesure). */
export const MARGE_EGALITE = 2;

export type Niveau = (typeof NIVEAUX)[number];
export type Acces = (typeof ACCES)[number];

export interface CelluleCouverture {
  niveau: Niveau;
  note?: string;
}
export interface ThemeCouverture {
  id: string;
  nom?: string;
  prioritaire_aine?: boolean;
  mots_cles?: string[];
}
export interface CandidatCouverture {
  id: string;
  acces: Acces;
  urls_bloquees: string[];
  sources: string[];
  urls_consultees: string[];
  cellules: Record<string, CelluleCouverture>;
}
export interface PiloteCouverture {
  provisoires: string[];
  themes: string[];
  livres: string[];
  derogation: { raison: string; decide_par: string; date: string } | null;
  relecture_ouverte: boolean;
}
export interface CouvertureThemes {
  version: 1;
  mesure_le: string;
  mesure_par: string;
  regle: { marge_egalite: number };
  themes: ThemeCouverture[];
  candidats: CandidatCouverture[];
  pilote: PiloteCouverture;
}

// ---------------------------------------------------------------------------
// Lecture stricte
// ---------------------------------------------------------------------------

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estListeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const IDS_SPEC: readonly string[] = THEMES_SPEC.map((t) => t.id);
const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lit et valide data/couverture-themes.yaml. Ne lève jamais : toute anomalie devient un message
 * français dans `problemes`. Quand `problemes` n'est pas vide, `data` est partiel et ne doit pas être classé.
 * IMP-01 : lecture plafonnée (yaml-plafonne.ts) ; un refus donne une entrée par diagnostic, trois au plus,
 * chacune avec fichier, ligne, colonne et code, la dernière suivie de « (+N autre(s)) ».
 */
export function lireCouverture(texte: string, fichier = 'data/couverture-themes.yaml'): { data: CouvertureThemes; problemes: string[] } {
  const problemes: string[] = [];
  const analyse = analyserYamlPlafonne(texte, fichier);
  const refus = analyse.diagnostics.filter((d) => d.code !== 'YAML_RACINE_NON_OBJET');
  const montres = refus.slice(0, 3);
  montres.forEach((d, i) => {
    const reste = i === montres.length - 1 ? refus.length - montres.length : 0;
    problemes.push(`YAML illisible : ${messageRefus([d])}${reste > 0 ? ` (+${reste} autre(s))` : ''}`);
  });
  const brut: unknown = analyse.data;
  const vide: CouvertureThemes = {
    version: 1,
    mesure_le: '',
    mesure_par: '',
    regle: { marge_egalite: MARGE_EGALITE },
    themes: [],
    candidats: [],
    pilote: { provisoires: [], themes: [], livres: [], derogation: null, relecture_ouverte: false },
  };
  if (!estObjet(brut)) {
    if (problemes.length === 0) problemes.push('le tableau de couverture doit être un objet YAML');
    return { data: vide, problemes };
  }

  if (brut.version !== 1) problemes.push('version : la valeur attendue est 1');
  if (typeof brut.mesure_le !== 'string' || !DATE_JOUR.test(brut.mesure_le)) problemes.push('mesure_le : date AAAA-MM-JJ attendue');
  if (!estTexte(brut.mesure_par)) problemes.push('mesure_par : texte non vide attendu');
  if (!estObjet(brut.regle) || brut.regle.marge_egalite !== MARGE_EGALITE) {
    problemes.push(`regle.marge_egalite : la valeur attendue est ${MARGE_EGALITE} (marge appliquée par le classement)`);
  }

  // Thèmes : exactement THEMES_SPEC, dans l'ordre.
  const themes: ThemeCouverture[] = [];
  if (!Array.isArray(brut.themes)) {
    problemes.push('themes : liste attendue');
  } else {
    const ids = brut.themes.map((t) => (estObjet(t) && typeof t.id === 'string' ? t.id : '?'));
    if (ids.length !== IDS_SPEC.length || ids.some((id, i) => id !== IDS_SPEC[i])) {
      problemes.push(`thèmes : la liste doit être exactement (dans cet ordre) ${IDS_SPEC.join(', ')} ; reçu : ${ids.join(', ') || 'vide'}`);
    }
    for (const t of brut.themes) {
      if (!estObjet(t) || typeof t.id !== 'string') continue;
      if (t.mots_cles !== undefined && !estListeTextes(t.mots_cles)) problemes.push(`thème ${t.id} : mots_cles doit être une liste de textes`);
      if (t.prioritaire_aine !== undefined && typeof t.prioritaire_aine !== 'boolean') problemes.push(`thème ${t.id} : prioritaire_aine doit être un booléen`);
      themes.push({
        id: t.id,
        ...(typeof t.nom === 'string' ? { nom: t.nom } : {}),
        ...(typeof t.prioritaire_aine === 'boolean' ? { prioritaire_aine: t.prioritaire_aine } : {}),
        ...(estListeTextes(t.mots_cles) ? { mots_cles: t.mots_cles } : {}),
      });
    }
  }

  // Candidats
  const candidats: CandidatCouverture[] = [];
  const vus = new Set<string>();
  if (!Array.isArray(brut.candidats)) {
    problemes.push('candidats : liste attendue');
  } else {
    brut.candidats.forEach((c, i) => {
      if (!estObjet(c) || !estTexte(c.id)) {
        problemes.push(`candidats[${i}] : identifiant manquant`);
        return;
      }
      const nom = `candidat ${c.id}`;
      if (vus.has(c.id)) problemes.push(`${nom} : identifiant en double`);
      vus.add(c.id);
      const acces = ACCES.find((a) => a === c.acces);
      if (acces === undefined) problemes.push(`${nom} : acces inconnu « ${String(c.acces)} » (attendu : ${ACCES.join(', ')})`);
      for (const champ of ['urls_bloquees', 'sources', 'urls_consultees'] as const) {
        if (!estListeTextes(c[champ])) problemes.push(`${nom} : ${champ} doit être une liste de textes (éventuellement vide)`);
      }
      const urlsBloquees = estListeTextes(c.urls_bloquees) ? c.urls_bloquees : [];
      const cellules: Record<string, CelluleCouverture> = {};
      if (!estObjet(c.cellules)) {
        problemes.push(`${nom} : cellules doit être un objet (une entrée par thème)`);
      } else {
        for (const id of IDS_SPEC) {
          const cel = c.cellules[id];
          if (cel === undefined) {
            problemes.push(`${nom} : case manquante pour le thème ${id}`);
            continue;
          }
          const niveau = estObjet(cel) ? NIVEAUX.find((n) => n === cel.niveau) : undefined;
          if (niveau === undefined) {
            problemes.push(`${nom}, thème ${id} : niveau inconnu « ${estObjet(cel) ? String(cel.niveau) : String(cel)} » (attendu : ${NIVEAUX.join(', ')})`);
            continue;
          }
          cellules[id] = { niveau, ...(estObjet(cel) && typeof cel.note === 'string' ? { note: cel.note } : {}) };
        }
        for (const id of Object.keys(c.cellules)) {
          if (!IDS_SPEC.includes(id)) problemes.push(`${nom} : case en trop pour le thème inconnu « ${id} »`);
        }
      }
      const niveaux = Object.values(cellules).map((x) => x.niveau);
      if (acces === 'bloque') {
        if (niveaux.some((n) => n !== 'inaccessible')) problemes.push(`${nom} : acces bloque exige que toutes les cases soient « inaccessible »`);
        if (urlsBloquees.length === 0) problemes.push(`${nom} : acces bloque exige des urls_bloquees non vides`);
      } else if (acces === 'aucun_site') {
        if (niveaux.some((n) => n !== 'aucun')) problemes.push(`${nom} : acces aucun_site exige que toutes les cases soient « aucun »`);
        if (urlsBloquees.length > 0) problemes.push(`${nom} : acces aucun_site exige des urls_bloquees vides`);
      } else if (acces === 'partiel') {
        if (urlsBloquees.length === 0) problemes.push(`${nom} : acces partiel exige des urls_bloquees non vides`);
        if (niveaux.includes('inaccessible')) problemes.push(`${nom} : acces partiel n'admet aucune case « inaccessible » (la case reflète ce qui a été lu)`);
      } else if (acces === 'ok' && urlsBloquees.length > 0) {
        problemes.push(`${nom} : acces ok exige des urls_bloquees vides`);
      }
      candidats.push({
        id: c.id,
        acces: acces ?? 'ok',
        urls_bloquees: urlsBloquees,
        sources: estListeTextes(c.sources) ? c.sources : [],
        urls_consultees: estListeTextes(c.urls_consultees) ? c.urls_consultees : [],
        cellules,
      });
    });
  }

  // Bloc pilote
  const pilote: PiloteCouverture = { provisoires: [], themes: [], livres: [], derogation: null, relecture_ouverte: false };
  if (!estObjet(brut.pilote)) {
    problemes.push('pilote : objet attendu');
  } else {
    const p = brut.pilote;
    if (typeof p.relecture_ouverte !== 'boolean') problemes.push('pilote.relecture_ouverte : booléen attendu (false tant qu’Erwan n’a pas ouvert la relecture)');
    else pilote.relecture_ouverte = p.relecture_ouverte;
    if (!estListeTextes(p.provisoires) || p.provisoires.some((id) => !IDS_SPEC.includes(id))) problemes.push('pilote.provisoires : liste d’identifiants de thèmes attendue');
    else pilote.provisoires = p.provisoires;
    if (!estListeTextes(p.themes)) {
      problemes.push('pilote.themes : liste attendue (vide ou 3 thèmes)');
    } else if (p.themes.length !== 0 && (p.themes.length !== 3 || new Set(p.themes).size !== 3 || p.themes.some((id) => !IDS_SPEC.includes(id)))) {
      problemes.push(`pilote.themes : vide ou 3 identifiants de thèmes distincts attendus ; reçu : ${p.themes.join(', ')}`);
    } else {
      pilote.themes = p.themes;
    }
    if (!estListeTextes(p.livres)) {
      problemes.push('pilote.livres : liste attendue');
    } else {
      const hors = p.livres.filter((id) => !(estListeTextes(p.themes) ? p.themes : []).includes(id));
      if (hors.length > 0) problemes.push(`pilote.livres : thème(s) hors de pilote.themes : ${hors.join(', ')}`);
      pilote.livres = p.livres;
    }
    if (p.derogation !== null && p.derogation !== undefined) {
      if (!estObjet(p.derogation)) {
        problemes.push('pilote.derogation : null ou objet { raison, decide_par, date } attendu');
      } else {
        for (const champ of ['raison', 'decide_par', 'date'] as const) {
          if (!estTexte(p.derogation[champ])) problemes.push(`pilote.derogation : champ « ${champ} » manquant`);
        }
        if (estTexte(p.derogation.raison) && estTexte(p.derogation.decide_par) && estTexte(p.derogation.date)) {
          pilote.derogation = { raison: p.derogation.raison, decide_par: p.derogation.decide_par, date: p.derogation.date };
        }
      }
    }
  }

  return {
    data: {
      version: 1,
      mesure_le: typeof brut.mesure_le === 'string' ? brut.mesure_le : '',
      mesure_par: typeof brut.mesure_par === 'string' ? brut.mesure_par : '',
      regle: { marge_egalite: MARGE_EGALITE },
      themes,
      candidats,
      pilote,
    },
    problemes,
  };
}

// ---------------------------------------------------------------------------
// Classement et choix des 3 thèmes pilotes
// ---------------------------------------------------------------------------

export interface LigneClassement {
  theme: string;
  positions: number;
  forts: number;
  partiels: number;
  silences: number;
  aucuns: number;
  inaccessibles: number;
  prioritaire_aine: boolean;
}
export interface ResultatClassement {
  classement: LigneClassement[];
  choix: [string, string, string];
  top3Litteral: [string, string, string];
  explication: string[];
}

const ordre = (id: string): number => THEMES_SPEC.find((t) => t.id === id)?.ordre ?? 99;

/** Tri simple : positions décroissantes, puis forts décroissants, puis ordre de la spec. */
const parPositions = (a: LigneClassement, b: LigneClassement): number =>
  b.positions - a.positions || b.forts - a.forts || ordre(a.theme) - ordre(b.theme);

export function classer(data: CouvertureThemes): ResultatClassement {
  const lignes: LigneClassement[] = THEMES_SPEC.map((spec) => {
    const l: LigneClassement = { theme: spec.id, positions: 0, forts: 0, partiels: 0, silences: 0, aucuns: 0, inaccessibles: 0, prioritaire_aine: spec.prioritaire_aine };
    for (const c of data.candidats) {
      switch (c.cellules[spec.id]?.niveau) {
        case 'fort':
          l.forts++;
          l.positions++;
          break;
        case 'partiel':
          l.partiels++;
          l.positions++;
          break;
        case 'silence':
          l.silences++;
          break;
        case 'aucun':
          l.aucuns++;
          break;
        case 'inaccessible':
          l.inaccessibles++;
          break;
        default:
          break;
      }
    }
    return l;
  });
  const classement = [...lignes].sort(parPositions);
  const top3Litteral = classement.slice(0, 3).map((l) => l.theme) as [string, string, string];

  // Règle de la marge : P4 = positions du 4e ; les thèmes à P4 + marge ou plus sont assurés (3 au plus) ;
  // chaque place restante va, dans la bande des thèmes à `marge` positions du meilleur reste, au thème
  // Aîné prioritaire d'abord, puis aux positions, aux forts et à l'ordre de la spec.
  const p4 = classement[3]?.positions ?? 0;
  const choisis: LigneClassement[] = classement.filter((l) => l.positions >= p4 + MARGE_EGALITE).slice(0, 3);
  const reste = classement.filter((l) => !choisis.includes(l));
  while (choisis.length < 3 && reste.length > 0) {
    const meilleur = Math.max(...reste.map((l) => l.positions));
    const bande = reste.filter((l) => l.positions >= meilleur - MARGE_EGALITE);
    bande.sort((a, b) => Number(b.prioritaire_aine) - Number(a.prioritaire_aine) || parPositions(a, b));
    const pris = bande[0] as LigneClassement;
    choisis.push(pris);
    reste.splice(reste.indexOf(pris), 1);
  }
  const choix = choisis.map((l) => l.theme) as [string, string, string];

  const explication = [
    `Mesure du ${data.mesure_le || 'jour non renseigné'} sur ${data.candidats.length} candidats, ${THEMES_SPEC.length} thèmes.`,
    'Une position est une case « fort » ou « partiel » : « silence », « aucun » et « inaccessible » ne comptent jamais.',
    'Classement : positions décroissantes, puis nombre de cases « fort » décroissant, puis ordre de la spec.',
    `Règle des trois thèmes : un écart de ${MARGE_EGALITE} candidats au plus = égalité (marge d’erreur de la mesure).`,
    `Les thèmes qui devancent le quatrième du classement de ${MARGE_EGALITE} positions ou plus (P4 = ${p4}, seuil ${p4 + MARGE_EGALITE}) sont retenus d’office, trois au plus.`,
    `Pour chaque place restante, on garde les thèmes à ${MARGE_EGALITE} positions ou moins du meilleur reste, et on retient d’abord le thème prioritaire Aîné (${THEMES_SPEC.filter((t) => t.prioritaire_aine).map((t) => t.id).join(', ')}), puis celui qui a le plus de positions, de cases « fort », puis le premier de l’ordre de la spec.`,
    `Thèmes retenus (règle de la marge) : ${choix.join(', ')}.`,
    `Trois premiers du classement littéral (sans marge ni départage Aîné) : ${top3Litteral.join(', ')}.`,
    `Comparaison côte à côte : marge = ${choix.join(', ')} ; littéral = ${top3Litteral.join(', ')}.`,
  ];
  return { classement, choix, top3Litteral, explication };
}

// ---------------------------------------------------------------------------
// Scanner d'un extrait archivé (aide à la lecture, jamais une preuve)
// ---------------------------------------------------------------------------

/**
 * Radicaux français par thème, utilisés quand le tableau de couverture ne fournit pas de liste. Chaque
 * entrée est un préfixe de mot après pliage (casse et accents) : « retrait » apparie « retraites »,
 * jamais « portrait ». Un radical de 3 lettres ou moins (ric, tva, csg...) doit être un mot entier.
 */
export const MOTS_CLES_DEFAUT: Readonly<Record<string, readonly string[]>> = {
  logement: ['logement', 'loyer', 'locataire', 'propriétaire', 'hlm', 'immobilier', 'habitat', 'hébergement', 'sans-abri', 'mal-logé'],
  ecole: ['école', 'enseignant', 'professeur', 'élève', 'collège', 'lycée', 'éducation', 'scolaire', 'maternelle', 'baccalauréat', 'universit', 'étudiant'],
  retraites: ['retraite', 'pension', 'âge de départ', 'âge légal', 'cotis', 'régime', 'annuité', 'trimestre'],
  sante: ['santé', 'hôpital', 'hospitali', 'médecin', 'médical', 'soignant', 'médicament', 'urgences', 'infirmier', 'ehpad', 'dépendance', 'assurance maladie'],
  securite: ['sécurité', 'police', 'gendarm', 'délinquan', 'criminalité', 'justice', 'prison', 'pénal', 'terroris', 'défense', 'armée'],
  climat: ['climat', 'écolog', 'énergie', 'carbone', 'nucléaire', 'renouvelable', 'transition', 'émission', 'biodiversité', 'pollution', 'réchauffement'],
  travail: ['travail', 'emploi', 'chômage', 'salaire', 'smic', 'entreprise', 'syndica', 'apprentissage', 'licenci', 'contrat de travail'],
  impots: ['impôt', 'impot', 'fiscal', 'taxe', 'tva', 'csg', 'prélèvement', 'niche', 'cotisation', 'redevance'],
  'europe-et-monde': ['europe', 'européen', 'union européenne', 'otan', 'diplomat', 'international', 'politique étrangère', 'traité', 'migrat', 'frontière', 'commerce', 'onu'],
  institutions: ['constitution', 'référendum', 'ric', 'proportionnelle', 'assemblée', 'sénat', 'parlement', 'mandat', 'quinquennat', 'septennat', '49.3', 'élection', 'démocratie'],
};

export interface ThemeAScanner {
  id: string;
  mots_cles: readonly string[];
}
export interface ExtraitScan {
  page: number;
  texte: string;
}
export interface ResultatScan {
  theme: string;
  hits: number;
  engagements: number;
  extraits: ExtraitScan[];
}

interface Jeton {
  debut: number;
  fin: number;
  cle: string;
}

const JETON = /[\p{L}\p{N}\p{M}]+/gu;
const DEMI_FENETRE = 150;
const ECART_MIN_EXTRAITS = 60;
const REMONTEE_PHRASE_MAX = 400;
const PUCE = /^(?:[-–—•·▪●■◦*]\s|\d{1,2}[.)]\s)/u;
const FUTUR = /(?:rai|ras|ra|rons|rez|ront)$/;
const VERBES_ENGAGEMENT = new Set(['sera', 'seront', 'doit', 'doivent', 'devra', 'devront']);
// Mots en -er/-ir/-re/-oir qui ne sont pas des verbes à l'infinitif (heuristique, faux positifs assumés).
const PAS_INFINITIFS = new Set([
  'notre', 'votre', 'autre', 'autres', 'entre', 'contre', 'outre', 'nombre', 'titre', 'centre', 'membre', 'membres', 'ordre', 'chapitre',
  'premier', 'dernier', 'ouvrier', 'financier', 'entier', 'hier', 'avenir', 'plaisir', 'soir', 'pouvoir', 'devoir', 'savoir', 'cadre', 'monsieur',
]);

function jetons(texte: string): Jeton[] {
  const out: Jeton[] = [];
  for (const m of texte.matchAll(JETON)) out.push({ debut: m.index, fin: m.index + m[0].length, cle: foldKey(m[0]) });
  return out;
}

const correspond = (cleTexte: string, cleMot: string): boolean => (cleMot.length <= 3 ? cleTexte === cleMot : cleTexte.startsWith(cleMot));

/** Début de la phrase qui contient `pos`, ou -1 si aucune borne n'est trouvée dans la fenêtre de remontée. */
function debutPhrase(texte: string, pos: number): number {
  const borne = Math.max(0, pos - REMONTEE_PHRASE_MAX);
  for (let k = pos - 1; k >= borne; k--) {
    const c = texte.charAt(k);
    if (c === '\n' || c === '\f') return k + 1;
    if ((c === '.' || c === '!' || c === '?' || c === '…' || c === ';') && /\s/.test(texte.charAt(k + 1) || ' ')) return k + 1;
  }
  return borne === 0 ? 0 : -1;
}

/** La phrase commence-t-elle comme un engagement ? Heuristique de lecture, pas un verdict. */
function estEngagement(texte: string, pos: number): boolean {
  const debut = debutPhrase(texte, pos);
  if (debut < 0) return false;
  const tete = texte.slice(debut, debut + 160).trimStart();
  if (PUCE.test(tete)) return true;
  const mots = jetons(tete.slice(0, 120)).slice(0, 10).map((j) => j.cle);
  const premier = mots[0];
  if (premier === undefined) return false;
  if ((premier === 'nous' || premier === 'je' || premier === 'j') && mots.slice(1, 5).some((m) => m.length >= 5 && FUTUR.test(m))) return true;
  if (mots.some((m) => VERBES_ENGAGEMENT.has(m))) return true;
  return premier.length >= 4 && /(?:er|ir|re|oir)$/.test(premier) && !PAS_INFINITIFS.has(premier);
}

function extraitAutour(texte: string, debut: number, fin: number): string {
  let a = Math.max(0, debut - DEMI_FENETRE);
  let b = Math.min(texte.length, fin + DEMI_FENETRE);
  const coupeAvant = a > 0;
  const coupeApres = b < texte.length;
  if (coupeAvant && !/\s/.test(texte.charAt(a - 1))) {
    const i = texte.slice(a, debut).search(/\s/);
    if (i >= 0) a += i + 1;
  }
  if (coupeApres && !/\s/.test(texte.charAt(b))) {
    const i = texte.slice(fin, b).search(/\s\S*$/);
    if (i >= 0) b = fin + i;
  }
  // Texte de tiers affiché dans un terminal : pas de séquence d'échappement ni de caractère bidi.
  const coeur = texte.slice(a, b).replace(/\p{Cf}/gu, '').replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return `${coupeAvant ? '… ' : ''}${coeur}${coupeApres ? ' …' : ''}`;
}

/**
 * Cherche, par thème, les mots-clés dans un extrait archivé : occurrences, occurrences dont la phrase
 * commence comme un engagement, et au plus `max` extraits (±150 caractères, coupés entre deux mots)
 * avec leur numéro de page (1 + sauts de page avant l'occurrence). Un seul passage sur les mots du
 * texte : le coût reste linéaire quelle que soit la taille de l'archive.
 */
export function scanner(texte: string, themes: readonly ThemeAScanner[], max = 8): ResultatScan[] {
  const t = texte.normalize('NFC');
  const mots = jetons(t);
  const sauts: number[] = [];
  for (let i = t.indexOf('\f'); i >= 0; i = t.indexOf('\f', i + 1)) sauts.push(i);
  const page = (pos: number): number => {
    let lo = 0;
    let hi = sauts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((sauts[mid] as number) < pos) lo = mid + 1;
      else hi = mid;
    }
    return 1 + lo;
  };

  return themes.map((theme) => {
    // Index par première lettre du premier mot du mot-clé, pour éviter de tester tous les mots-clés à chaque mot.
    const index = new Map<string, string[][]>();
    for (const brut of theme.mots_cles) {
      const cles = jetons(brut).map((j) => j.cle);
      const tete = cles[0];
      if (tete === undefined) continue;
      const seau = index.get(tete.charAt(0)) ?? [];
      seau.push(cles);
      index.set(tete.charAt(0), seau);
    }
    const trouvees: { debut: number; fin: number; engage: boolean }[] = [];
    let engagements = 0;
    for (let i = 0; i < mots.length; i++) {
      const mot = mots[i] as Jeton;
      const seau = index.get(mot.cle.charAt(0));
      if (seau === undefined) continue;
      for (const cles of seau) {
        let ok = true;
        for (let j = 0; j < cles.length; j++) {
          const cible = mots[i + j];
          if (cible === undefined || !correspond(cible.cle, cles[j] as string)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const fin = (mots[i + cles.length - 1] as Jeton).fin;
        const engage = estEngagement(t, mot.debut);
        if (engage) engagements++;
        trouvees.push({ debut: mot.debut, fin, engage });
        break;
      }
    }
    // Les formulations d'engagement d'abord, puis le reste ; on évite deux extraits sur la même occurrence.
    const ordre = [...trouvees.filter((h) => h.engage), ...trouvees.filter((h) => !h.engage)];
    const retenues: typeof trouvees = [];
    for (const h of ordre) {
      if (retenues.length >= max) break;
      if (retenues.some((r) => Math.abs(r.debut - h.debut) < ECART_MIN_EXTRAITS && page(r.debut) === page(h.debut))) continue;
      retenues.push(h);
    }
    retenues.sort((a, b) => a.debut - b.debut);
    return {
      theme: theme.id,
      hits: trouvees.length,
      engagements,
      extraits: retenues.map((h) => ({ page: page(h.debut), texte: extraitAutour(t, h.debut, h.fin) })),
    };
  });
}
