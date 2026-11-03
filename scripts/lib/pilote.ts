import type { Entry } from '../../src/lib/content-core/load.ts';
import { MARQUEUR_GLOSSAIRE, PERIMETRE_EQUITE } from '../../src/lib/content-core/rules/config.ts';
import { slugGlossaire } from '../../src/lib/content-core/rules/references.ts';
import { foldKey } from '../../src/lib/content-core/rules/text/normalize.ts';
import type { CouvertureThemes } from './couverture.ts';

// Contrôles d'intégrité du corpus pilote (CONT-05, CONT-06) que le validateur de la Phase 2 ne couvre
// pas : plafond de 2 mesures, complétude des thèmes livrés, cohérence des cases de couverture,
// plancher d'hôtes interdits, marquage des partis et des termes du glossaire dans les textes enfant.
// Module PUR : reçoit les entrées déjà chargées et le tableau de couverture, ne lit jamais le disque.

export interface Probleme {
  code: string;
  severite: 'erreur' | 'avertissement';
  fichier?: string;
  message: string;
}

/** Nombre maximal de mesures par candidat et par thème pilote (CONTEXT). */
const PLAFOND_MESURES = 2;

/**
 * Plancher, pas une liste blanche : agrégateurs, encyclopédies, archives et presse. La règle de fond
 * reste le `type` de la source (schéma) et la relecture humaine. Une tribune publiée dans la presse
 * (type « tribune ») reste admise.
 */
export const HOTES_INTERDITS: readonly string[] = [
  '2027etmoi.fr', 'repere2027.fr', 'france-vote.fr', 'civiqo.com', 'poligraph.fr', 'elysee-market.com',
  'data.gouv.fr', 'wikipedia.org', 'web.archive.org',
  'lcp.fr', 'francetvinfo.fr', 'franceinfo.fr', 'lemonde.fr', 'lefigaro.fr', 'liberation.fr', 'bfmtv.com', 'ouest-france.fr',
  'jhm.fr', 'frontpopulaire.fr', 'leparisien.fr', 'lexpress.fr', 'lepoint.fr', 'mediapart.fr', '20minutes.fr', 'huffingtonpost.fr',
];

/** Sigles de partis et de fiscalité à développer dans un texte enfant (avertissement : la CI ne les connaît pas tous). */
export const SIGLES_ENFANT: readonly string[] = ['PS', 'LR', 'RN', 'LFI', 'PCF', 'EELV', 'NPA', 'LO', 'UPR', 'DLF', 'UDI', 'PRG', 'TVA', 'CSG', 'IFI', 'ISF', 'RIC'];

type Donnees = Record<string, unknown>;
const objet = (v: unknown): Donnees => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Donnees) : {});
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

const MOT = /[\p{L}\p{N}]+/gu;
const motsPlies = (s: string): string[] => foldKey(s).match(MOT) ?? [];

/** Le texte contient-il `phrase` comme suite de mots entiers (casse et accents pliés) ? */
function contientSuite(mots: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0) return false;
  for (let i = 0; i + phrase.length <= mots.length; i++) {
    if (phrase.every((m, j) => mots[i + j] === m)) return true;
  }
  return false;
}

/** Identifiants de glossaire visés par les marqueurs d'un texte (A2 : id explicite, sinon slug de l'affiché). */
function idsMarques(s: string): Set<string> {
  const ids = new Set<string>();
  for (const m of s.matchAll(MARQUEUR_GLOSSAIRE)) ids.add(m[2] ?? slugGlossaire(m[1] ?? ''));
  return ids;
}
const sansSpansMarqueurs = (s: string): string => s.replace(MARQUEUR_GLOSSAIRE, ' ');

function hoteInterdit(url: string): string | undefined {
  let hote: string;
  try {
    hote = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined; // une URL illisible est l'affaire du schéma, pas de ce contrôle
  }
  return HOTES_INTERDITS.find((h) => hote === h || hote.endsWith(`.${h}`));
}

/** Code du statut le plus récent par date (à date égale, le dernier de la liste), comme la règle d'équité (A6). */
function dernierCode(candidat: Donnees): string {
  let meilleur: Donnees | undefined;
  for (const s of liste(candidat.statuts)) {
    const st = objet(s);
    if (meilleur === undefined || texte(st.date) >= texte(meilleur.date)) meilleur = st;
  }
  return texte(meilleur?.code);
}

export function verifierPilote(entries: Entry[], couverture: CouvertureThemes): Probleme[] {
  const problemes: Probleme[] = [];
  const err = (code: string, fichier: string | undefined, message: string): void => {
    problemes.push({ code, severite: 'erreur', ...(fichier !== undefined ? { fichier } : {}), message });
  };
  const avert = (code: string, fichier: string | undefined, message: string): void => {
    problemes.push({ code, severite: 'avertissement', ...(fichier !== undefined ? { fichier } : {}), message });
  };

  const themesPilotes = new Set(couverture.pilote.themes);
  const livres = new Set(couverture.pilote.livres);
  const par = (collection: string): Entry[] => entries.filter((e) => e.collection === collection);
  const candidats = par('candidats');
  const sources = new Map(par('sources').map((e) => [e.id, e]));
  const perimetre = new Set(candidats.filter((c) => (PERIMETRE_EQUITE as readonly string[]).includes(dernierCode(c.data))).map((c) => c.id));
  const mesures = par('mesures').filter((m) => themesPilotes.has(texte(m.data.theme)));
  const fichiersCouverture = par('couverture').filter((c) => themesPilotes.has(texte(c.data.theme)));

  // --- PILOTE_PLAFOND : au plus 2 mesures par candidat et par thème pilote -----------------------------------
  const groupes = new Map<string, Entry[]>();
  for (const m of mesures) {
    const cle = `${texte(m.data.candidat)}\u0000${texte(m.data.theme)}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), m]);
  }
  for (const [cle, groupe] of groupes) {
    if (groupe.length <= PLAFOND_MESURES) continue;
    const [candidat, theme] = cle.split('\u0000');
    err(
      'PILOTE_PLAFOND',
      groupe[PLAFOND_MESURES]?.file,
      `${groupe.length} mesures pour ${candidat} sur le thème ${theme} (maximum ${PLAFOND_MESURES}) : ${groupe.map((m) => m.id).join(', ')}`,
    );
  }

  // --- PILOTE_NON_BROUILLON : tant que la relecture n'est pas ouverte, tout reste en brouillon -----------------
  if (!couverture.pilote.relecture_ouverte) {
    const hors = (d: Donnees): boolean => (d.statut_relecture !== undefined && d.statut_relecture !== 'brouillon') || d.relecteur !== undefined;
    const aSignaler = [
      ...mesures.map((e) => ({ e, quoi: `la mesure ${e.id}` })),
      ...par('themes').filter((t) => themesPilotes.has(t.id)).map((e) => ({ e, quoi: `le thème ${e.id}` })),
      ...fichiersCouverture.map((e) => ({ e, quoi: `la couverture du thème ${texte(e.data.theme)}` })),
    ];
    for (const { e, quoi } of aSignaler) {
      if (hors(e.data)) {
        err('PILOTE_NON_BROUILLON', e.file, `${quoi} n’est pas en brouillon (statut_relecture « ${texte(e.data.statut_relecture)} »${e.data.relecteur !== undefined ? ', relecteur renseigné' : ''}) alors que la relecture n’est pas ouverte (pilote.relecture_ouverte: false)`);
      }
    }
    for (const c of candidats) {
      const fautifs = liste(c.data.statuts).map((s, i) => ({ s: objet(s), i })).filter(({ s }) => hors(s));
      if (fautifs.length > 0) {
        err('PILOTE_NON_BROUILLON', c.file, `le candidat ${c.id} a ${fautifs.length} statut(s) hors brouillon (statuts[${fautifs.map((f) => f.i).join(', ')}]) alors que la relecture n’est pas ouverte (pilote.relecture_ouverte: false)`);
      }
    }
  }

  // --- Cases de couverture ----------------------------------------------------------------------------------
  const mesuresDe = (candidat: string, theme: string): Entry[] => mesures.filter((m) => m.data.candidat === candidat && m.data.theme === theme);
  const niveauTableau = (candidat: string, theme: string): string | undefined =>
    couverture.candidats.find((c) => c.id === candidat)?.cellules[theme]?.niveau;

  for (const theme of themesPilotes) {
    const fichiers = fichiersCouverture.filter((f) => f.data.theme === theme);
    const livre = livres.has(theme);
    if (livre && fichiers.length === 0) {
      err('PILOTE_CASE_MANQUANTE', undefined, `le thème livré ${theme} n’a pas de fichier de couverture (couverture/${theme}.yaml)`);
    }
    if (fichiers.length > 1) {
      err('PILOTE_CASE_DOUBLE', fichiers[1]?.file, `le thème ${theme} a ${fichiers.length} fichiers de couverture : ${fichiers.map((f) => f.id).join(', ')}`);
    }
    const cases = fichiers.flatMap((f) => liste(f.data.cases).map((c) => ({ c: objet(c), file: f.file })));

    // Doublons : toujours une erreur, livré ou non.
    const vus = new Set<string>();
    for (const { c, file } of cases) {
      const id = texte(c.candidat);
      if (vus.has(id)) err('PILOTE_CASE_DOUBLE', file, `le candidat ${id} a plusieurs cases dans la couverture du thème ${theme}`);
      vus.add(id);
    }

    // Sources consultées : celles du candidat, et seulement elles.
    for (const { c, file } of cases) {
      const id = texte(c.candidat);
      for (const sid of liste(c.sources_consultees).map(texte)) {
        const src = sources.get(sid);
        if (src === undefined || !liste(src.data.candidats).includes(id)) {
          err('PILOTE_SOURCE_CONSULTEE', file, `la case de ${id} (thème ${theme}) cite la source consultée « ${sid} », qui n’existe pas ou n’appartient pas à ${id}`);
        }
      }
      if (!perimetre.has(id)) {
        avert('PILOTE_HORS_PERIMETRE', file, `la couverture du thème ${theme} contient une case pour ${id}, hors du périmètre d’équité (statuts ${PERIMETRE_EQUITE.join(', ')})`);
      }
    }

    if (!livre) continue;

    // Thème livré : chaque candidat du périmètre a sa case, et la case dit la même chose que les mesures.
    const presents = new Set(cases.map(({ c }) => texte(c.candidat)));
    if (fichiers.length > 0) {
      for (const id of [...perimetre].sort()) {
        if (!presents.has(id)) err('PILOTE_CASE_MANQUANTE', fichiers[0]?.file, `le candidat ${id} n’a pas de case dans la couverture du thème livré ${theme}`);
      }
    }
    for (const { c, file } of cases) {
      const id = texte(c.candidat);
      const etat = texte(c.etat);
      const nb = mesuresDe(id, theme).length;
      if (etat === 'mesures' && nb === 0) {
        err('PILOTE_INCOHERENCE', file, `la case de ${id} (thème ${theme}) indique « mesures » mais aucune mesure n’existe pour ce candidat et ce thème`);
      }
      if ((etat === 'non_precise' || etat === 'programme_non_publie') && nb > 0) {
        err('PILOTE_INCOHERENCE', file, `la case de ${id} (thème ${theme}) indique « ${etat} » alors que ${nb} mesure(s) existent : ${mesuresDe(id, theme).map((m) => m.id).join(', ')}`);
      }
      const niveau = niveauTableau(id, theme);
      const attendu: Record<string, string> = { fort: 'mesures', partiel: 'mesures', silence: 'non_precise', aucun: 'programme_non_publie' };
      if (niveau !== undefined && attendu[niveau] !== undefined && attendu[niveau] !== etat) {
        avert('PILOTE_ECART_MESURE', file, `la case de ${id} (thème ${theme}) indique « ${etat} » alors que le tableau de couverture mesure « ${niveau} » : la mesure a changé, à relire`);
      }
    }
  }

  // --- Mesures des thèmes pilotes ---------------------------------------------------------------------------
  for (const m of mesures) {
    const candidat = texte(m.data.candidat);
    const theme = texte(m.data.theme);
    if (!perimetre.has(candidat)) {
      avert('PILOTE_HORS_PERIMETRE', m.file, `la mesure ${m.id} concerne ${candidat}, hors du périmètre d’équité (statuts ${PERIMETRE_EQUITE.join(', ')})`);
    }

    const source = sources.get(texte(m.data.source));
    if (source !== undefined && source.data.type !== 'tribune') {
      const hote = hoteInterdit(texte(source.data.url));
      if (hote !== undefined) {
        err('PILOTE_HOTE_INTERDIT', m.file, `la mesure ${m.id} (${candidat}, thème ${theme}) s’appuie sur la source ${source.id} hébergée sur ${hote}, un agrégateur ou un média : une mesure se source sur un document du candidat`);
      }
    }

    const enfant = texte(objet(m.data.redactions).enfant);
    if (enfant === '') continue;
    const visible = sansSpansMarqueurs(enfant);
    const mots = motsPlies(visible);
    const marques = idsMarques(enfant);

    const noms = new Set<string>();
    for (const c of candidats) {
      const parti = texte(c.data.parti).trim();
      if (parti !== '') noms.add(parti);
    }
    for (const g of par('glossaire')) if (g.data.type === 'parti') noms.add(texte(g.data.libelle));
    for (const nom of [...noms].sort()) {
      if (contientSuite(mots, motsPlies(nom))) {
        err('PILOTE_PARTI_NON_MARQUE', m.file, `le texte enfant de ${m.id} (${candidat}, thème ${theme}) nomme le parti « ${nom} » sans marqueur de glossaire ([[${nom}|id]])`);
      }
    }

    for (const g of par('glossaire')) {
      if (g.data.type !== 'terme') continue;
      const libelle = texte(g.data.libelle);
      if (contientSuite(mots, motsPlies(libelle)) && !marques.has(g.id)) {
        err('PILOTE_TERME_NON_MARQUE', m.file, `le texte enfant de ${m.id} (${candidat}, thème ${theme}) emploie le terme « ${libelle} » du glossaire sans marqueur ([[${libelle}]])`);
      }
    }

    // Sigles nus : mots entièrement en majuscules, hors marqueurs (casse conservée, jamais pliée).
    const nus = new Set((visible.match(MOT) ?? []).filter((w) => SIGLES_ENFANT.includes(w)));
    for (const sigle of nus) {
      avert('PILOTE_SIGLE_ENFANT', m.file, `le texte enfant de ${m.id} (${candidat}, thème ${theme}) contient le sigle « ${sigle} » : le développer et le marquer ([[nom complet]])`);
    }
  }

  return problemes;
}
