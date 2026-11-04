// Vue-modèle pur du corpus M1 : ce que le visiteur voit, calculé depuis les données brutes et le mode.
// Module PUR : ni `astro:content` ni `node:` (testable seul, importable par toute page ou composant).
// Le mode est un paramètre : seul `index.ts` lit l'environnement. Aucune horloge : toutes les dates
// viennent des données.
import { PERIMETRE_EQUITE } from '../content-core/rules/config.ts';
import { statutLePlusRecent, statutRetenu } from '../content-core/rules/equite.ts';
import type {
  Candidat,
  CaseCouverture,
  CodeStatut,
  Couverture,
  EntreeGlossaire,
  Mesure,
  MotifRenoncement,
  Source,
  SourceStatut,
  StatutEntree,
  StatutRelecture,
  Theme,
} from './types.ts';

export type Mode = 'preview' | 'production';

export const NIVEAUX = ['resume', 'detaille', 'enfant', 'aine'] as const;

export const LIBELLES_NIVEAUX = {
  resume: 'En bref',
  detaille: 'En détail',
  enfant: 'Pour les enfants',
  aine: 'Gros caractères',
} as const;

export const LIBELLES_STATUT: Record<CodeStatut, string> = {
  declare: 'Candidature déclarée',
  primaire: 'Candidature à une primaire',
  pressenti: 'Candidature pressentie',
  empeche: 'Candidature empêchée',
  renonce: 'Ne se présente pas',
};

/** Motifs de renoncement, noms neutres au genre (à confirmer au point de contrôle du plan 04-09). */
export const LIBELLES_MOTIF: Record<MotifRenoncement, string> = {
  retrait: 'retrait de la candidature',
  elimine_primaire: 'élimination lors d\'une primaire',
  ralliement: 'ralliement à une autre candidature',
  non_candidat: 'déclaration de non-candidature',
};

export const BADGES = { brouillon: 'brouillon, non relu', relu: 'relu, pas encore publié' } as const;

/** Textes des deux cases vides datées, de part et d'autre de la date (partagés par EtatVide et la page Méthode). */
export const ETAT_VIDE_TEXTES = {
  non_precise: { avant: 'Non précisé dans les sources consultées le', apres: '.' },
  programme_non_publie: { avant: 'Programme non publié à ce jour. Vérifié le', apres: '.' },
} as const;

export type EtatCellule = 'mesures' | 'non_precise' | 'programme_non_publie' | 'non_verifie';

export interface Brut {
  themes: Theme[];
  candidats: Candidat[];
  mesures: Mesure[];
  sources: Source[];
  couverture: Couverture[];
  glossaire: EntreeGlossaire[];
}

export type Contexte = { type: 'theme'; id: string } | { type: 'candidat'; id: string } | { type: 'hall' };

export interface VueCandidat {
  id: string;
  nomAffiche: string;
  parti: string | null;
  rang: number;
  perimetre: boolean;
  statutRecent: StatutEntree;
  statutAffiche: StatutEntree | null;
  donnees: Candidat;
}

/** `ancre` = « m- » + id de la mesure, « / » remplacé par « - ». */
export interface VueMesure {
  mesure: Mesure;
  source: Source;
  ancre: string;
  badge: string | null;
}

export interface VueCellule {
  candidat: VueCandidat;
  theme: string;
  etat: EtatCellule;
  mesures: VueMesure[];
  premiere: VueMesure | undefined;
  autres: number;
  verifieLe: string | undefined;
  sourcesConsultees: Source[];
}

export interface CompteCouverture {
  total: number;
  mesures: number;
  nonPrecise: number;
  programmeNonPublie: number;
  nonVerifie: number;
}

export interface VueTheme {
  theme: Theme;
  badge: string | null;
  cellules: VueCellule[];
  renonces: VueCandidat[];
  autresPersonnalites: number;
  couverture: CompteCouverture;
  miseAJour: string | undefined;
}

/** Une section de page candidat : le thème et la case du candidat, avec toutes ses mesures visibles (`cellule.mesures`). */
export interface SectionCandidat {
  theme: VueTheme;
  cellule: VueCellule;
}

export interface PageCandidat {
  candidat: VueCandidat;
  /** Statut montré au visiteur (production : le plus récent des statuts relus ou publiés), `null` si aucun. */
  statut: StatutEntree | null;
  /** Pastille du statut affiché : `BADGES.brouillon` pour un statut en brouillon (aperçu seulement), sinon `null` (un statut relu est ce que montre la production). */
  badgeStatut: string | null;
  sections: SectionCandidat[];
  miseAJour: string | undefined;
}

export interface Corpus {
  mode: Mode;
  themes: VueTheme[];
  candidats: VueCandidat[];
  /** Toutes les mesures visibles dans ce mode, sur les thèmes visibles. */
  mesures: VueMesure[];
  perimetre: ReadonlySet<string>;
  glossaire: ReadonlyMap<string, EntreeGlossaire>;
  sources: ReadonlyMap<string, Source>;
  theme(id: string): VueTheme;
  candidat(id: string): VueCandidat;
  pageCandidat(id: string): PageCandidat;
  /** Date de mise à jour des pages d'index (accueil, thèmes, candidats), `undefined` si rien n'est publié. */
  miseAJourIndex(): string | undefined;
}

const collator = new Intl.Collator('fr');

// ---------------------------------------------------------------------------
// Dates et phrases
// ---------------------------------------------------------------------------

const JOUR_MOIS_ANNEE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const MOIS_ANNEE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' });

/** « 2026-10-21 » -> « 21 octobre 2026 », « 2026-11-01 » -> « 1er novembre 2026 », « 2026-10 » -> « octobre 2026 », « 2026 » -> « 2026 ». */
export function formatDate(d: string): string {
  const complete = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (complete) {
    const texte = JOUR_MOIS_ANNEE.format(Date.UTC(Number(complete[1]), Number(complete[2]) - 1, Number(complete[3])));
    return texte.replace(/^1 /, '1er ');
  }
  const mois = /^(\d{4})-(\d{2})$/.exec(d);
  if (mois) return MOIS_ANNEE.format(Date.UTC(Number(mois[1]), Number(mois[2]) - 1, 1));
  return d;
}

/** « depuis le 15 octobre 2026 », « depuis septembre 2026 », « depuis 2026 ». */
export function depuis(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `depuis le ${formatDate(date)}` : `depuis ${formatDate(date)}`;
}

/** Texte d'un lien vers la source d'un statut : le titre, sinon l'hôte de l'URL sans « www. ». */
export function texteSource(s: SourceStatut): string {
  if (s.titre !== undefined && s.titre !== '') return s.titre;
  try {
    return new URL(s.url).hostname.replace(/^www\./, '');
  } catch {
    return s.url;
  }
}

/** Date ISO maximale (comparaison de chaînes), `undefined` ignorés. */
export function dateMax(ds: readonly (string | undefined)[]): string | undefined {
  let max: string | undefined;
  for (const d of ds) if (d !== undefined && (max === undefined || d > max)) max = d;
  return max;
}

/** Phrase de couverture d'un thème ; les clauses à zéro (sauf la première) sont omises. */
export function phraseCouverture(c: CompteCouverture): string {
  const pluriel = (n: number): boolean => n > 1;
  const clauses = [
    `${c.mesures} ${pluriel(c.mesures) ? 'candidats' : 'candidat'} sur ${c.total} ${pluriel(c.mesures) ? 'ont' : 'a'} une position publiée`,
  ];
  if (c.nonPrecise > 0) {
    clauses.push(`${c.nonPrecise} ${pluriel(c.nonPrecise) ? "n'ont" : "n'a"} rien de précisé dans les sources consultées`);
  }
  if (c.programmeNonPublie > 0) {
    clauses.push(`${c.programmeNonPublie} ${pluriel(c.programmeNonPublie) ? "n'ont" : "n'a"} pas publié de programme`);
  }
  if (c.nonVerifie > 0) {
    clauses.push(
      pluriel(c.nonVerifie)
        ? `${c.nonVerifie} cases ne sont pas encore vérifiées`
        : `${c.nonVerifie} case n'est pas encore vérifiée`,
    );
  }
  return `Sur ce thème, ${clauses.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------

/**
 * Statut montré au visiteur. Production : le plus récent des statuts relus ou publiés (un statut non
 * relu n'est jamais présenté comme un fait), `null` s'il n'y en a aucun. Preview : le plus récent.
 */
export function statutAffiche(c: Candidat, mode: Mode): StatutEntree | null {
  return (statutRetenu(c.statuts, mode) as unknown as StatutEntree | undefined) ?? null;
}

/**
 * Thèmes pilotes à marquer « livré » sur la page Méthode : ceux de `livres` qui sont visibles dans ce build.
 * En production, un thème livré mais pas encore publié n'est pas annoncé comme livré (W1).
 */
export function themesLivres(livres: readonly string[], corpus: Pick<Corpus, 'themes'>): string[] {
  const visibles = new Set(corpus.themes.map((t) => t.theme.id));
  return livres.filter((id) => visibles.has(id));
}

function badgeDe(statut: StatutRelecture): string | null {
  return statut === 'publie' ? null : BADGES[statut];
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function construireCorpus(brut: Brut, mode: Mode): Corpus {
  const production = mode === 'production';

  const themesVisibles = brut.themes
    .filter((t) => !production || t.statut_relecture === 'publie')
    .sort((a, b) => a.ordre - b.ordre || collator.compare(a.id, b.id));
  const idsThemesVisibles = new Set(themesVisibles.map((t) => t.id));

  const sources = new Map(brut.sources.map((s) => [s.id, s] as const));
  const glossaire = new Map(brut.glossaire.map((g) => [g.id, g] as const));

  const candidats: VueCandidat[] = [...brut.candidats]
    .sort((a, b) => collator.compare(a.nom_tri, b.nom_tri) || collator.compare(a.id, b.id))
    .map((c, rang) => {
      const statutRecent = statutLePlusRecent(c.statuts) as unknown as StatutEntree | undefined;
      if (statutRecent === undefined) throw new Error(`candidat « ${c.id} » sans statut (le schéma exige au moins un statut)`);
      return {
        id: c.id,
        nomAffiche: `${c.prenom} ${c.nom}`,
        parti: c.parti,
        rang,
        // Même définition que le statut affiché et que le validateur (ADR-041).
        perimetre: (PERIMETRE_EQUITE as readonly string[]).includes(statutAffiche(c, mode)?.code ?? ''),
        statutRecent,
        statutAffiche: statutAffiche(c, mode),
        donnees: c,
      };
    });
  const parId = new Map(candidats.map((c) => [c.id, c] as const));
  const perimetre = new Set(candidats.filter((c) => c.perimetre).map((c) => c.id));

  const vueMesure = (m: Mesure): VueMesure => {
    const source = sources.get(m.source);
    if (source === undefined) throw new Error(`mesure « ${m.id} » : source « ${m.source} » introuvable`);
    return { mesure: m, source, ancre: `m-${m.id.replaceAll('/', '-')}`, badge: badgeDe(m.statut_relecture) };
  };
  const mesures = brut.mesures
    .filter((m) => idsThemesVisibles.has(m.theme) && (!production || m.statut_relecture === 'publie'))
    .sort((a, b) => collator.compare(a.titre, b.titre) || collator.compare(a.id, b.id))
    .map(vueMesure);

  // Personnalités qui « ne se présentent pas » : statut affiché = renonce, hors périmètre.
  const renonces = candidats.filter((c) => !c.perimetre && c.statutAffiche?.code === 'renonce');
  const idsRenonces = new Set(renonces.map((c) => c.id));
  const autresPersonnalites = candidats.filter((c) => !c.perimetre && !idsRenonces.has(c.id)).length;

  const themes: VueTheme[] = themesVisibles.map((theme) => {
    const cases = new Map<string, CaseCouverture>();
    for (const couv of brut.couverture) {
      if (couv.theme !== theme.id) continue;
      for (const cas of couv.cases) cases.set(cas.candidat, cas);
    }

    const cellules: VueCellule[] = candidats
      .filter((c) => c.perimetre)
      .map((candidat) => {
        const siennes = mesures.filter((m) => m.mesure.theme === theme.id && m.mesure.candidat === candidat.id);
        const cas = cases.get(candidat.id);
        const base = { candidat, theme: theme.id, mesures: siennes, premiere: siennes[0], autres: Math.max(0, siennes.length - 1) };
        if (siennes.length > 0) return { ...base, etat: 'mesures', verifieLe: undefined, sourcesConsultees: [] };
        if (cas === undefined) {
          if (production) throw new Error(`« ${theme.id} » : aucune mesure visible ni case de couverture pour « ${candidat.id} »`);
          return { ...base, etat: 'non_verifie', verifieLe: undefined, sourcesConsultees: [] };
        }
        if (cas.etat === 'mesures') {
          if (production) throw new Error(`« ${theme.id} » : la case de couverture de « ${candidat.id} » annonce des mesures, mais aucune n'est visible`);
          return { ...base, etat: 'non_verifie', verifieLe: undefined, sourcesConsultees: [] };
        }
        const consultees = (cas.sources_consultees ?? []).flatMap((id) => {
          const s = sources.get(id);
          return s === undefined ? [] : [s];
        });
        return { ...base, etat: cas.etat, verifieLe: cas.verifie_le, sourcesConsultees: consultees };
      });

    const compte: CompteCouverture = {
      total: cellules.length,
      mesures: cellules.filter((c) => c.etat === 'mesures').length,
      nonPrecise: cellules.filter((c) => c.etat === 'non_precise').length,
      programmeNonPublie: cellules.filter((c) => c.etat === 'programme_non_publie').length,
      nonVerifie: cellules.filter((c) => c.etat === 'non_verifie').length,
    };

    const miseAJour = dateMax([
      theme.date_relecture,
      ...cellules.flatMap((c) => [c.premiere?.mesure.date_relecture, c.premiere?.source.date_consultation, c.verifieLe]),
      ...renonces.map((c) => c.statutAffiche?.date),
    ]);

    return { theme, badge: badgeDe(theme.statut_relecture), cellules, renonces, autresPersonnalites, couverture: compte, miseAJour };
  });

  const pageCandidat = (id: string): PageCandidat => {
    const candidat = parId.get(id);
    if (candidat === undefined) throw new Error(`candidat « ${id} » absent du corpus`);
    const sections: SectionCandidat[] = [];
    for (const vue of themes) {
      if (candidat.perimetre) {
        const cellule = vue.cellules.find((c) => c.candidat.id === id);
        if (cellule !== undefined) sections.push({ theme: vue, cellule });
        continue;
      }
      const siennes = mesures.filter((m) => m.mesure.theme === vue.theme.id && m.mesure.candidat === id);
      if (siennes.length === 0) continue;
      const premiere = siennes[0];
      sections.push({
        theme: vue,
        cellule: {
          candidat,
          theme: vue.theme.id,
          etat: 'mesures',
          mesures: siennes,
          premiere,
          autres: siennes.length - 1,
          verifieLe: undefined,
          sourcesConsultees: [],
        },
      });
    }
    const statut = candidat.statutAffiche;
    const miseAJour = dateMax([
      statut?.date,
      statut?.source.date_consultation,
      ...sections.flatMap((s) => [
        s.cellule.verifieLe,
        ...s.cellule.mesures.flatMap((m) => [m.mesure.date_relecture, m.source.date_consultation]),
      ]),
    ]);
    return { candidat, statut, badgeStatut: statut?.statut_relecture === 'brouillon' ? BADGES.brouillon : null, sections, miseAJour };
  };

  return {
    mode,
    themes,
    candidats,
    mesures,
    perimetre,
    glossaire,
    sources,
    theme(id) {
      const t = themes.find((x) => x.theme.id === id);
      if (t === undefined) throw new Error(`thème « ${id} » absent du corpus visible en ${mode}`);
      return t;
    },
    candidat(id) {
      const c = parId.get(id);
      if (c === undefined) throw new Error(`candidat « ${id} » absent du corpus`);
      return c;
    },
    pageCandidat,
    miseAJourIndex: () => dateMax([...themes.map((t) => t.miseAJour), ...candidats.map((c) => c.statutAffiche?.date)]),
  };
}
