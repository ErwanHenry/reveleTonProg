// Contrôle post-build (QUAL-01) : lit le dist d'Astro et refuse une page qui casse le budget,
// appelle un tiers, colle des mots, montre une mesure sans source datée ou un brouillon.
// Aucune règle éditoriale n'est copiée ici : les mots interdits et le périmètre d'équité viennent
// de content-core (même liste que le validateur et la future page Méthode).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { PERIMETRE_EQUITE } from '../../src/lib/content-core/rules/config.ts';
import { statutRetenu } from '../../src/lib/content-core/rules/equite.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';
import { schemasDirOf } from '../../src/lib/content-core/root.ts';
import { empreinteCsp, scriptsEnLigne } from '../../src/lib/csp-empreintes.ts';
import { estOuvert } from '../../src/lib/publication-config.ts';
import { HAUTEUR_PARTAGE, LARGEUR_PARTAGE } from '../../src/lib/partage.ts';
import { estHoteProvisoire } from '../../src/lib/site-config.ts';
import { aClasse, analyserHtml, trouver } from './html.ts';

/** Page d'erreur 404 d'Astro (src/pages/404.astro donnerait dist/404.html) : exclue des canoniques et du sitemap (IN-07). */
export const PAGE_ERREUR = '404.html';
import type { Noeud } from './html.ts';

/** 1 Ko = 1000 octets (plus strict et sans ambiguïté). Poids d'une page = HTML + CSS/JS liés du même site. */
export const LIMITES = {
  brut: 500_000, // 500 Ko bruts par page
  gzip: 100_000, // 100 Ko compressés par page : c'est cette limite qui mord en premier
  script: 2048, // un script classique du site pèse moins de 2 Ko
  favicon: 4096, // public/favicon.ico (D-11) : l'icône générée par scripts/favicon.ts pèse quelques centaines d'octets
  partage: 100_000, // public/partage.png (09.1, proposition 6) : image de partage 1200 x 630 générée par scripts/partage.ts
} as const;

/**
 * Extensions permises dans le dist (HEB-08), passées par le CLI à `typesAutorises`. `.ico` ne couvre que
 * favicon.ico à la racine, 4 096 octets au plus (D-11) : toute autre icône reste TYPE_FICHIER_INATTENDU.
 * `.png` ne couvre que partage.png à la racine, 100 000 octets au plus (09.1) : tout autre PNG reste refusé.
 */
export const TYPES_AUTORISES = ['.html', '.txt', '.xml', '.json', '.ico', '.png'] as const;
/** Seule icône admise, à la racine du dist (copie de public/favicon.ico). */
export const FAVICON = 'favicon.ico';
/** Seul PNG admis, à la racine du dist (copie de public/partage.png, cité par og:image seulement). */
export const IMAGE_PARTAGE = 'partage.png';

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Écart d'un fichier avec un PNG de `largeur` x `hauteur` bien formé, ou undefined (IN-02 de la revue 09.1). Règle
 * étroite : signature, IHDR en premier morceau (13 octets) aux bonnes dimensions, morceaux qui tiennent dans le fichier,
 * IEND en dernier. Aucune décompression, aucun CRC lu ; chaque tour avance d'au moins 12 octets, la boucle est bornée
 * par la taille du fichier.
 */
export function problemePng(png: Buffer, largeur: number, hauteur: number): string | undefined {
  if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE_PNG)) return 'signature PNG absente';
  let i = 8;
  let ihdr = false;
  let iend = false;
  while (i < png.length) {
    if (iend) return 'octets après le morceau IEND';
    if (png.length - i < 12) return 'morceau tronqué';
    const longueur = png.readUInt32BE(i);
    if (longueur > png.length - i - 12) return 'morceau tronqué';
    const type = png.subarray(i + 4, i + 8).toString('latin1');
    if (!ihdr) {
      if (type !== 'IHDR' || longueur !== 13) return `premier morceau « ${type.replace(/[^A-Za-z]/g, '?')} » au lieu de IHDR`;
      const l = png.readUInt32BE(i + 8);
      const h = png.readUInt32BE(i + 12);
      if (l !== largeur || h !== hauteur) return `dimensions ${l} x ${h} au lieu de ${largeur} x ${hauteur}`;
      ihdr = true;
    }
    if (type === 'IEND') iend = true;
    i += 12 + longueur;
  }
  if (!ihdr) return 'IHDR absent';
  if (!iend) return 'morceau IEND absent';
  return undefined;
}

/** Tous les codes que le contrôle peut produire (la page Méthode de la Phase 5 les affichera). */
export const CODES_CHECK_DIST = [
  'POIDS_BRUT',
  'POIDS_GZIP',
  'SCRIPT_TROP_LOURD',
  'RESSOURCE_TIERCE',
  'LIEN_EXTERNE_NON_PROTEGE',
  'SCRIPT_EN_LIGNE',
  'SCRIPT_DATA_URI',
  'SCRIPT_NON_BLOQUANT',
  'STYLE_EN_LIGNE',
  'ID_DUPLIQUE',
  'ESPACE_PERDU',
  'MOT_INTERDIT',
  'MESURE_SANS_SOURCE_DATEE',
  'CELLULES_INCOHERENTES',
  'THEME_INATTENDU',
  'THEME_HORS_LISTE_BLANCHE',
  'THEME_OUVERT_ABSENT',
  'PUBLICATION_VIDE',
  'BROUILLON_EN_PRODUCTION',
  'RELECTURE_ABSENTE',
  'CANDIDAT_NON_RELU_EN_PRODUCTION',
  'PREVIEW_INDEXABLE',
  'LIEN_INTERNE_CASSE',
  'LANG_ABSENTE',
  'H1_NOMBRE',
  'MARQUEUR_RESIDUEL',
  'DIST_VIDE',
  'CONTACT_PROVISOIRE',
  'HEBERGEUR_PREVU',
  'META_REFRESH',
  'BASE_INTERDITE',
  'CSP_ABSENTE',
  'CSP_TROP_PERMISSIVE',
  'SCRIPT_SANS_EMPREINTE',
  'STYLE_SANS_EMPREINTE',
  'CANONIQUE_ABSENT',
  'CANONIQUE_INCORRECT',
  'PARTAGE_INCORRECT',
  'SITEMAP_INCOHERENT',
  'ROBOTS_SANS_SITEMAP',
  'DOMAINE_PROVISOIRE',
  'VERSION_ABSENTE',
  'VERSION_INVALIDE',
  'TYPE_FICHIER_INATTENDU',
  'FICHIER_NON_REGULIER',
] as const;

/** Commit écrit dans version.json : 40 hexadécimaux minuscules (GITHUB_SHA), ou « dev » hors CI. */
export const COMMIT_VERSION = /^(?:[0-9a-f]{40}|dev)$/;
export type CodeCheckDist = (typeof CODES_CHECK_DIST)[number];

export interface Constat {
  code: CodeCheckDist;
  severite: 'erreur' | 'avertissement';
  /** Chemin relatif au dist, séparateurs « / ». */
  fichier: string;
  message: string;
}

export interface OptionsCheckDist {
  mode: Mode;
  /** Nombre de cellules attendu par thème visible (sans elle, CELLULES_INCOHERENTES et THEME_INATTENDU sont inactifs). */
  cellulesParTheme?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
  /**
   * Liste blanche de publication (config/publication.yml de la racine de contenu, D-07). Donnée, elle active en
   * production THEME_HORS_LISTE_BLANCHE (erreur : une page de thème hors liste), THEME_OUVERT_ABSENT et PUBLICATION_VIDE
   * (avertissements : un thème listé sans page, un dist sans aucun thème). Sans elle, ces trois codes sont inactifs.
   */
  themesOuverts?: readonly string[];
  /**
   * Identifiants des personnes sans statut relu ou publié (`candidatsNonRelus` de la racine de contenu, D-06, plan 09-15).
   * Donnée, elle active en production CANDIDAT_NON_RELU_EN_PRODUCTION (erreur) : une page `candidats/<id>/index.html`,
   * un lien vers `/candidats/<id>/` ou une entrée de sitemap.xml pour l'une d'elles. Le CLI la remplit toujours ;
   * sans elle, ou en preview, le code est inactif.
   */
  candidatsNonRelus?: readonly string[];
  /**
   * Vrai pour un contrôle avant déploiement (RTP_DEPLOIEMENT=1) : un contact provisoire (CONTACT_PROVISOIRE, TLD réservé) et
   * une page qui annonce un hébergeur seulement prévu (HEBERGEUR_PREVU) deviennent des erreurs, sinon des avertissements.
   */
  deploiement?: boolean;
  /**
   * Textes acceptés comme corps d'un <script> en ligne (identité octet pour octet, ADR-056). Défaut : le contenu
   * des fichiers src/scripts/*.js du dépôt, ceux que Base.astro et LecteurNiveaux.astro incluent par `?raw`.
   */
  sourcesScripts?: readonly string[];
  /**
   * Domaine du site (config/site.yml) : nom d'hôte apex, sans schéma, port ni chemin (ex. exemple.fr). Le CLI le
   * passe toujours. Avec lui, en production, chaque page porte exactement une URL canonique égale à
   * `https://<domaine>` + son chemin, sitemap.xml liste exactement ces URL et robots.txt pointe vers le sitemap ;
   * un domaine provisoire (TLD réservé) donne DOMAINE_PROVISOIRE (erreur sous `deploiement`). Sans lui, ces règles sont inactives,
   * sauf DOMAINE_PROVISOIRE sur une page de production dont l'URL canonique vise un hôte provisoire.
   */
  domaine?: string;
  /**
   * Version servie (HEB-07, D-12). Avec elle, `version.json` doit exister à la racine du dist (VERSION_ABSENTE) et
   * contenir exactement `commit` (40 hexadécimaux ou « dev ») et `date` (horodatage ISO UTC) ; `commitAttendu`
   * (GITHUB_SHA en CI) impose ce commit, et « dev » est refusé sous `deploiement` (VERSION_INVALIDE). Le CLI la passe
   * toujours ; sans elle, ces règles sont inactives.
   */
  version?: { commitAttendu?: string };
  /**
   * Extensions permises dans le dist (ex. `['.html', '.txt', '.xml', '.json']`), point compris. Tout autre fichier,
   * y compris sans extension, donne TYPE_FICHIER_INATTENDU (HEB-08 : un fichier séparé demanderait une règle de cache
   * long dans le bloc Caddy, qui n'en a aucune depuis l'intégration de la Phase 7). Le CLI la passe toujours ; sans
   * elle, la règle est inactive.
   */
  typesAutorises?: readonly string[];
}

/** Racine du dépôt, déduite de l'emplacement de ce module (scripts/lib/). */
const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const SCHEMA = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Valeur d'attribut telle que la lit un navigateur : sans tabulations/retours internes, ni
 * caractères de contrôle C0 ou espaces de bord (« \u0001javascript:… » est lu comme « javascript:… »).
 */
const nettoyerUrl = (v: string): string => v.replace(/[\t\n\r]/g, '').replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
const estAbsolue = (v: string): boolean => SCHEMA.test(nettoyerUrl(v));

const posix = (p: string): string => p.split(path.sep).join('/');

/** Entrée du dist qui n'est ni un fichier ordinaire ni un dossier (revue de code WR-06). */
interface EntreeSpeciale {
  rel: string;
  type: string;
}

function typeEntree(e: fs.Dirent): string {
  if (e.isSymbolicLink()) return 'lien symbolique';
  if (e.isFIFO()) return 'tube nommé';
  if (e.isSocket()) return 'socket';
  if (e.isBlockDevice() || e.isCharacterDevice()) return 'périphérique';
  return 'type inconnu';
}

/**
 * Fichiers ordinaires du dist (chemins relatifs « / », triés). Tout le reste (lien symbolique, même vers un dossier,
 * tube, socket, périphérique) va dans `speciaux` sans être suivi ni lu : un lien serait servi par Caddy, qui le
 * suivrait dans son propre conteneur, et échapperait à toutes les règles de page.
 */
function lister(dir: string, speciaux: EntreeSpeciale[], base = dir): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...lister(p, speciaux, base));
    else if (e.isFile()) out.push(posix(path.relative(base, p)));
    else speciaux.push({ rel: posix(path.relative(base, p)), type: typeEntree(e) });
  }
  return out.sort();
}

const dansDist = (dist: string, abs: string): boolean => abs === dist || abs.startsWith(dist + path.sep);

/** Directives d'une politique CSP dans l'ordre du texte : nom en minuscules et jetons, répétitions comprises. */
function directivesCsp(contenu: string): Array<[string, string[]]> {
  const out: Array<[string, string[]]> = [];
  for (const brute of contenu.split(';')) {
    const [nom, ...jetons] = brute.trim().split(/[\t\n\f\r ]+/);
    if (nom === undefined || nom === '') continue;
    out.push([nom.toLowerCase(), jetons]);
  }
  return out;
}

/** Politique effective : une directive répétée est ignorée après la première, comme le fait le navigateur. */
function politiqueEffective(directives: ReadonlyArray<readonly [string, string[]]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [nom, jetons] of directives) if (!out.has(nom)) out.set(nom, jetons);
  return out;
}

/** Seules expressions de source permises dans la CSP du site : 'self', 'none' et une empreinte sha256/384/512. */
const JETON_CSP_PERMIS = /^'(?:self|none|sha(?:256|384|512)-[A-Za-z0-9+/_-]+={0,2})'$/i;

/** Liste effective d'une directive « …-elem », à défaut la directive générale, à défaut default-src. */
function sourcesEffectives(csp: ReadonlyMap<string, readonly string[]>, type: 'script' | 'style'): readonly string[] {
  return csp.get(`${type}-src-elem`) ?? csp.get(`${type}-src`) ?? csp.get('default-src') ?? [];
}

/** Type de <script> classique (exécuté et bloquant) : absent, vide ou text/javascript. */
const typeClassique = (type: string | undefined): boolean =>
  type === undefined || type.trim() === '' || type.trim().toLowerCase() === 'text/javascript';

/** @import et url() vers une ressource externe ou data: dans un texte CSS (fichier du dist ou <style> en ligne). */
function ressourcesCss(css: string): string[] {
  const out: string[] = [];
  const IMPORT = /@import\s+(?:url\(\s*)?["']?\s*((?:[a-z][a-z0-9+.-]*:|\/\/)[^"')\s;]*)/gi;
  for (const m of css.matchAll(IMPORT)) out.push(`@import vers une ressource externe : ${m[1] ?? ''}`);
  // un @import déjà signalé ne l'est pas une seconde fois comme url()
  for (const m of css.replace(IMPORT, '').matchAll(/url\(\s*["']?\s*((?:[a-z][a-z0-9+.-]*:|\/\/)[^"')]*)/gi)) {
    out.push(`url() vers une ressource externe ou data: : ${(m[1] ?? '').slice(0, 60)}`);
  }
  return out;
}

/** Valeurs `rel` d'un <link> qui le désignent comme URL canonique de la page. */
const estCanonique = (n: Noeud): boolean => n.tag === 'link' && (n.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical');

/** Balise d'image de partage (Open Graph ou carte Twitter) : og:image, og:image:url, og:image:secure_url, twitter:image. */
const estImagePartage = (n: Noeud): boolean =>
  n.tag === 'meta' && /^(og:image(:url|:secure_url)?|twitter:image(:src)?)$/i.test((n.attrs.property ?? n.attrs.name ?? '').trim());
/** Balise og:url. */
const estUrlPartage = (n: Noeud): boolean => n.tag === 'meta' && (n.attrs.property ?? '').trim().toLowerCase() === 'og:url';

/** Premières URL d'un attribut srcset (« a.png 1x, b.png 2x » donne a.png et b.png). */
const urlsSrcset = (v: string): string[] =>
  v
    .split(',')
    .map((c) => c.trim().split(/\s+/)[0] ?? '')
    .filter((u) => u !== '');

/** Chemin public d'une page du dist : `index.html` → `/`, `a/index.html` → `/a/`, `a.html` → `/a.html`. */
function cheminPublic(rel: string): string {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** URL absolue normalisée (`new URL().href`), ou undefined si le texte n'en est pas une. */
function urlAbsolue(texte: string): string | undefined {
  try {
    return new URL(texte).href;
  } catch {
    return undefined;
  }
}

/** Valeurs des <loc> d'un sitemap.xml généré (entités XML décodées, &amp; en dernier). */
function locsSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) =>
    (m[1] ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'),
  );
}

/** Jusqu'à 3 éléments, puis « … (N au total) ». */
const extraitListe = (xs: readonly string[]): string => `${xs.slice(0, 3).join(', ')}${xs.length > 3 ? ` … (${xs.length} au total)` : ''}`;

// ---------------------------------------------------------------------------
// Cellules attendues
// ---------------------------------------------------------------------------

/**
 * Nombre de cellules attendu sur la page de chaque thème visible dans `mode` : tout thème publié
 * (tous en preview) montre une cellule par candidat du périmètre d'équité (statut retenu, ADR-041 :
 * `declare` ou `primaire`). Calculé depuis le contenu brut, indépendamment du view-model des pages.
 */
export function cellulesAttendues(contentRoot: string, projectRoot: string, mode: Mode, themesOuverts?: readonly string[]): Map<string, number> {
  const { entries } = loadAll(contentRoot, { schemasDir: schemasDirOf(projectRoot), mode });
  const perimetre = entries.filter(
    (e) =>
      e.collection === 'candidats' &&
      (PERIMETRE_EQUITE as readonly unknown[]).includes(statutRetenu(e.data.statuts, mode)?.code),
  ).length;
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.collection !== 'themes') continue;
    if (mode === 'production' && e.data.statut_relecture !== 'publie') continue;
    // Même intersection que le view-model (D-07) : la liste blanche ne peut que restreindre ce que `publie` montre.
    if (mode === 'production' && themesOuverts !== undefined && !estOuvert(themesOuverts, e.id)) continue;
    out.set(e.id, perimetre);
  }
  return out;
}

/**
 * Personnes sans statut relu ou publié (D-06, plan 09-15) : absentes de la production. Même définition que le view-model
 * et le validateur (ADR-041) : `statutRetenu(statuts, 'production')` indéfini. Calculé depuis le contenu brut.
 */
export function candidatsNonRelus(contentRoot: string, projectRoot: string): Set<string> {
  const { entries } = loadAll(contentRoot, { schemasDir: schemasDirOf(projectRoot), mode: 'production' });
  return new Set(entries.filter((e) => e.collection === 'candidats' && statutRetenu(e.data.statuts, 'production') === undefined).map((e) => e.id));
}

/** Identifiant de candidat visé par un chemin public `/candidats/<id>/` (avec ou sans index.html), sinon `undefined`. */
function idCandidatDuChemin(chemin: string): string | undefined {
  const m = /^\/candidats\/([^/]+)\/(?:index\.html)?$/.exec(chemin);
  if (m === null || m[1] === undefined) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// ---------------------------------------------------------------------------
// Contrôle
// ---------------------------------------------------------------------------

interface Page {
  rel: string;
  html: string;
  racine: Noeud;
}

export function checkDist(dist: string, opts: OptionsCheckDist): Constat[] {
  const racineDist = path.resolve(dist);
  const constats: Constat[] = [];
  const vus = new Set<string>();
  const signaler = (code: CodeCheckDist, fichier: string, message: string, severite: Constat['severite'] = 'erreur'): void => {
    const cle = `${code}\u0000${fichier}\u0000${message}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    constats.push({ code, severite, fichier, message });
  };

  const speciaux: EntreeSpeciale[] = [];
  const fichiers = lister(racineDist, speciaux);
  // Erreur dans tous les modes, sans option : rien d'autre qu'un fichier ordinaire ou un dossier ne part en ligne.
  for (const s of speciaux) {
    signaler(
      'FICHIER_NON_REGULIER',
      s.rel,
      `${s.type} dans le dist : seuls des fichiers ordinaires et des dossiers sont publiés (Caddy suivrait un lien dans son propre conteneur, et le serveur refuse l'envoi)`,
    );
  }
  const themesVus = new Set<string>();
  const cachePages = new Map<string, Page>();
  const lirePage = (rel: string): Page => {
    let p = cachePages.get(rel);
    if (!p) {
      const html = fs.readFileSync(path.join(racineDist, rel), 'utf8');
      p = { rel, html, racine: analyserHtml(html) };
      cachePages.set(rel, p);
    }
    return p;
  };
  const pages = fichiers.filter((f) => f.endsWith('.html')).map(lirePage);
  if (pages.length === 0) signaler('DIST_VIDE', '.', 'aucune page HTML dans le dist (build manquant ou mauvais dossier ?)');

  const sourcesScripts = opts.sourcesScripts ?? scriptsEnLigne(RACINE_DEPOT).map((s) => s.texte);
  const severiteDeploiement: Constat['severite'] = opts.deploiement === true ? 'erreur' : 'avertissement';

  // Domaine (HEB-05, HEB-06) : origine attendue des URL canoniques, du sitemap et de la ligne Sitemap de robots.txt.
  const origine = opts.domaine === undefined ? undefined : urlAbsolue(`https://${opts.domaine}/`);
  if (opts.domaine !== undefined && (origine === undefined || new URL(origine).hostname !== opts.domaine.toLowerCase())) {
    throw new Error(`checkDist : domaine « ${opts.domaine.slice(0, 60)} » invalide (nom d'hôte attendu, sans schéma, port ni chemin)`);
  }
  if (opts.domaine !== undefined && estHoteProvisoire(opts.domaine)) {
    signaler(
      'DOMAINE_PROVISOIRE',
      '.',
      `domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) : ${opts.domaine.slice(0, 60)} ; renseigner le vrai domaine dans config/site.yml avant de déployer`,
      severiteDeploiement,
    );
  }
  /** URL canonique attendue de chaque page de production sauf la page d'erreur (rempli seulement avec un domaine). */
  const canoniquesAttendues: string[] = [];

  const cellules = opts.cellulesParTheme
    ? opts.cellulesParTheme instanceof Map
      ? opts.cellulesParTheme
      : new Map(Object.entries(opts.cellulesParTheme))
    : undefined;

  /** Fichier du dist visé par une URL du même site, ou undefined s'il n'existe pas. */
  const cible = (pageRel: string, url: string): { rel: string; frag: string } | undefined => {
    const propre = nettoyerUrl(url);
    const [sansFrag = '', ...resteFrag] = propre.split('#');
    const frag = resteFrag.join('#');
    const chemin = (sansFrag.split('?')[0] ?? '');
    if (chemin === '') return { rel: pageRel, frag };
    let decode = chemin;
    try {
      decode = decodeURIComponent(chemin);
    } catch {
      // pourcentage mal formé : on garde le chemin brut
    }
    const abs = decode.startsWith('/')
      ? path.resolve(racineDist, `.${decode}`)
      : path.resolve(racineDist, path.dirname(pageRel), decode);
    if (!dansDist(racineDist, abs)) return undefined;
    const rel = posix(path.relative(racineDist, abs));
    const candidats = decode.endsWith('/')
      ? [path.posix.join(rel, 'index.html')]
      : path.posix.extname(rel) !== ''
        ? [rel]
        : [path.posix.join(rel, 'index.html'), `${rel}.html`];
    const trouve = candidats.find((c) => fichiers.includes(c));
    return trouve === undefined ? undefined : { rel: trouve, frag };
  };

  // --- scripts et CSS du dist ---------------------------------------------
  for (const f of fichiers) {
    if (/\.m?js$/.test(f)) {
      const taille = fs.statSync(path.join(racineDist, f)).size;
      if (taille > LIMITES.script) signaler('SCRIPT_TROP_LOURD', f, `script de ${taille} octets (limite ${LIMITES.script})`);
    }
    if (f.endsWith('.css')) {
      for (const message of ressourcesCss(fs.readFileSync(path.join(racineDist, f), 'utf8'))) signaler('RESSOURCE_TIERCE', f, message);
    }
  }

  // --- image de partage (PARTAGE_INCORRECT) -------------------------------
  /** Problème d'une URL d'image de partage, ou undefined si elle est valide : https, domaine configuré, fichier du dist. */
  const problemeImage = (url: string): string | undefined => {
    const v = nettoyerUrl(url);
    const abs = SCHEMA.test(v) ? urlAbsolue(v) : undefined;
    if (abs === undefined) return `URL d'image relative ou invalide (https://<domaine>/... attendu) : ${v.slice(0, 80)}`;
    const u = new URL(abs);
    if (u.protocol !== 'https:') return `image de partage non servie en https : ${v.slice(0, 80)}`;
    if (estHoteProvisoire(u.hostname)) return `image de partage sur un hôte provisoire : ${v.slice(0, 80)}`;
    if (origine !== undefined && u.origin !== new URL(origine).origin) return `image de partage hors du domaine configuré : ${v.slice(0, 80)}`;
    let chemin = u.pathname;
    try {
      chemin = decodeURIComponent(chemin);
    } catch {
      // pourcentage mal formé : on garde le chemin brut
    }
    if (!fichiers.includes(chemin.slice(1))) return `image de partage absente du dist : ${chemin.slice(0, 80)}`;
    return undefined;
  };
  /**
   * Images de partage, pour la règle « jamais chargée » : fichier du dist et origine + chemin de son URL absolue (sans
   * requête ni fragment). partage.png du dist y est toujours, préversion comprise (IN-03 de la revue 09.1), avec les
   * images valides citées par og:image et twitter:image en production.
   */
  const imagesPartage = new Map<string, Set<string>>();
  if (fichiers.includes(IMAGE_PARTAGE)) imagesPartage.set(IMAGE_PARTAGE, new Set<string>());
  const origineEtChemin = (u: URL): string => {
    let chemin = u.pathname;
    try {
      chemin = decodeURIComponent(chemin);
    } catch {
      // pourcentage mal formé : on garde le chemin brut
    }
    return `${u.origin}${chemin}`;
  };
  for (const p of pages) {
    if (opts.mode === 'preview' || p.rel === PAGE_ERREUR) continue;
    for (const n of trouver(p.racine, estImagePartage)) {
      const url = n.attrs.content ?? '';
      if (problemeImage(url) !== undefined) continue;
      const abs = new URL(nettoyerUrl(url));
      const cle = origineEtChemin(abs).slice(abs.origin.length + 1);
      const hrefs = imagesPartage.get(cle) ?? new Set<string>();
      hrefs.add(origineEtChemin(abs));
      imagesPartage.set(cle, hrefs);
    }
  }

  // --- pages --------------------------------------------------------------
  for (const page of pages) {
    const { rel, racine } = page;
    const tous = trouver(racine, () => true);

    // poids : HTML + feuilles et scripts liés du même site, brut et gzip séparément
    const liés = new Set<string>();
    for (const n of tous) {
      const url =
        n.tag === 'link' && /(^|\s)stylesheet(\s|$)/i.test(n.attrs.rel ?? '') ? n.attrs.href : n.tag === 'script' ? n.attrs.src : undefined;
      if (url === undefined || estAbsolue(url)) continue;
      const c = cible(rel, url);
      if (c === undefined) signaler('LIEN_INTERNE_CASSE', rel, `ressource liée introuvable dans le dist : ${nettoyerUrl(url)}`);
      else liés.add(c.rel);
    }
    let brut = Buffer.byteLength(page.html);
    let gzip = zlib.gzipSync(page.html).length;
    for (const asset of liés) {
      const octets = fs.readFileSync(path.join(racineDist, asset));
      brut += octets.length;
      gzip += zlib.gzipSync(octets).length;
    }
    if (brut > LIMITES.brut) signaler('POIDS_BRUT', rel, `page de ${brut} octets avec ses CSS/JS (limite ${LIMITES.brut})`);
    if (gzip > LIMITES.gzip) signaler('POIDS_GZIP', rel, `page de ${gzip} octets compressés avec ses CSS/JS (limite ${LIMITES.gzip})`);

    // politique CSP de la page (ADR-056) : un seul meta, enfant de <head>, sans aucune source permissive.
    // Le meta peut suivre des scripts (celui d'ordre le précède toujours, Pitfall 1) : on n'exige pas d'ordre.
    const metasCsp = tous.filter((n) => n.tag === 'meta' && (n.attrs['http-equiv'] ?? '').trim().toLowerCase() === 'content-security-policy');
    const metaCsp = metasCsp[0];
    if (metasCsp.length !== 1) {
      signaler('CSP_ABSENTE', rel, `${metasCsp.length} <meta http-equiv="content-security-policy"> (un seul attendu, dans <head>)`);
    } else if (metaCsp?.parent?.tag !== 'head') {
      signaler('CSP_ABSENTE', rel, `<meta http-equiv="content-security-policy"> hors de <head> (dans <${metaCsp?.parent?.tag ?? '?'}>) : le navigateur l'ignore`);
    }
    const directives = metasCsp.length === 1 && metaCsp?.parent?.tag === 'head' ? directivesCsp(metaCsp.attrs.content ?? '') : [];
    const csp = politiqueEffective(directives);
    // jetons vérifiés dans toutes les directives, même une répétition que le navigateur ignore (plus strict)
    for (const [directive, jetons] of directives) {
      for (const jeton of jetons) {
        if (!JETON_CSP_PERMIS.test(jeton)) {
          signaler('CSP_TROP_PERMISSIVE', rel, `CSP : « ${jeton.slice(0, 40)} » interdit dans ${directive} ('self', 'none' ou une empreinte sha256 seulement)`);
        }
      }
    }
    const cspScripts = sourcesEffectives(csp, 'script');
    const cspStyles = sourcesEffectives(csp, 'style');

    // ressources tierces, scripts, styles
    for (const n of tous) {
      const srcData = n.tag === 'script' && n.attrs.src !== undefined && /^data:/i.test(nettoyerUrl(n.attrs.src));
      if (srcData) signaler('SCRIPT_DATA_URI', rel, "<script src=\"data:…\"> interdit : le script doit être un fichier du site");
      for (const attr of ['src', 'poster', 'data', 'action'] as const) {
        const v = n.attrs[attr];
        if (v === undefined || (attr === 'src' && srcData)) continue;
        if (estAbsolue(v)) signaler('RESSOURCE_TIERCE', rel, `<${n.tag} ${attr}> charge une ressource externe : ${nettoyerUrl(v).slice(0, 80)}`);
      }
      if (n.attrs.srcset !== undefined) {
        for (const candidat of n.attrs.srcset.split(',')) {
          const url = candidat.trim().split(/\s+/)[0] ?? '';
          if (url !== '' && estAbsolue(url)) signaler('RESSOURCE_TIERCE', rel, `<${n.tag} srcset> charge une ressource externe : ${url.slice(0, 80)}`);
        }
      }
      if (n.tag === 'link' && n.attrs.href !== undefined && estAbsolue(n.attrs.href)) {
        const rels = (n.attrs.rel ?? '').toLowerCase().split(/\s+/);
        const nonChargeant = rels.some((r) => ['canonical', 'alternate', 'author', 'license', 'help', 'next', 'prev', 'bookmark'].includes(r));
        if (!nonChargeant) signaler('RESSOURCE_TIERCE', rel, `<link href> charge une ressource externe : ${nettoyerUrl(n.attrs.href).slice(0, 80)}`);
      }
      if (n.tag === 'script') {
        const libelle = n.attrs.src === undefined ? '<script> en ligne' : `<script src="${nettoyerUrl(n.attrs.src).slice(0, 80)}">`;
        if (!typeClassique(n.attrs.type) || n.attrs.async !== undefined || n.attrs.defer !== undefined) {
          signaler('SCRIPT_NON_BLOQUANT', rel, `${libelle} doit rester classique et bloquant (ni type=module ou autre type, ni async, ni defer)`);
        }
        if (n.attrs.src === undefined) {
          // corps exact, jamais trimé : c'est le texte que le navigateur hache
          const corps = n.enfants.filter((e): e is string => typeof e === 'string').join('');
          if (!sourcesScripts.includes(corps)) {
            signaler('SCRIPT_EN_LIGNE', rel, `script en ligne différent des sources de src/scripts/ (${Buffer.byteLength(corps)} octets) : seul un fichier du dépôt inclus tel quel est permis`);
          }
          const empreinte = empreinteCsp(corps);
          if (!cspScripts.includes(`'${empreinte}'`)) {
            signaler('SCRIPT_SANS_EMPREINTE', rel, `empreinte ${empreinte} du script en ligne absente de la CSP (script-src-elem, script-src ou default-src)`);
          }
          const taille = Buffer.byteLength(corps);
          if (taille > LIMITES.script) signaler('SCRIPT_TROP_LOURD', rel, `script en ligne de ${taille} octets (limite ${LIMITES.script})`);
        }
      }
      for (const nom of Object.keys(n.attrs)) {
        if (/^on/i.test(nom)) signaler('SCRIPT_EN_LIGNE', rel, `gestionnaire d'événement en ligne « ${nom.slice(0, 30)} » sur <${n.tag}> interdit (CSP sans 'unsafe-inline' ni 'unsafe-hashes')`);
      }
      if (n.tag === 'meta' && (n.attrs['http-equiv'] ?? '').toLowerCase() === 'refresh') {
        signaler('META_REFRESH', rel, `<meta http-equiv="refresh"> interdit (redirection hors de contrôle) : ${(n.attrs.content ?? '').slice(0, 60)}`);
      }
      if (n.tag === 'base') signaler('BASE_INTERDITE', rel, '<base> interdit : il réécrit tous les liens relatifs de la page');
      if (n.tag === 'style') {
        const css = n.enfants.filter((e): e is string => typeof e === 'string').join('');
        const empreinte = empreinteCsp(css);
        if (!cspStyles.includes(`'${empreinte}'`)) {
          signaler('STYLE_SANS_EMPREINTE', rel, `empreinte ${empreinte} du <style> absente de la CSP (style-src-elem, style-src ou default-src)`);
        }
        for (const message of ressourcesCss(css)) signaler('RESSOURCE_TIERCE', rel, `<style> : ${message}`);
      }
      if (n.attrs.style !== undefined) signaler('STYLE_EN_LIGNE', rel, `attribut style sur <${n.tag}> interdit (CSP sans 'unsafe-inline' ni 'unsafe-hashes')`);
    }

    // liens
    for (const n of tous) {
      if (n.tag !== 'a' || n.attrs.href === undefined) continue;
      const href = nettoyerUrl(n.attrs.href);
      if (/^mailto:/i.test(href)) {
        const adresse = href.slice('mailto:'.length).split('?')[0] ?? '';
        let decode = adresse;
        try {
          decode = decodeURIComponent(adresse);
        } catch {
          // pourcentage mal formé : on garde l'adresse brute
        }
        if (estHoteProvisoire(decode)) {
          signaler('CONTACT_PROVISOIRE', rel, `contact provisoire (TLD réservé) : ${decode.slice(0, 60)}`, severiteDeploiement);
        }
        continue;
      }
      if (href === '') continue;
      if (/^javascript:/i.test(href)) {
        signaler('LIEN_EXTERNE_NON_PROTEGE', rel, `lien javascript: interdit : ${href.slice(0, 60)}`);
      } else if (href.startsWith('//')) {
        signaler('LIEN_EXTERNE_NON_PROTEGE', rel, `lien protocole-relatif interdit (écrire https:) : ${href.slice(0, 80)}`);
      } else if (/^http:/i.test(href)) {
        signaler('LIEN_EXTERNE_NON_PROTEGE', rel, `lien http: non chiffré : ${href.slice(0, 80)}`);
      } else if (/^https:/i.test(href)) {
        if (!(n.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('noopener')) {
          signaler('LIEN_EXTERNE_NON_PROTEGE', rel, `lien externe sans rel="noopener noreferrer" : ${href.slice(0, 80)}`);
        }
      } else if (SCHEMA.test(href)) {
        // Liste blanche : seuls https:, mailto: et les liens relatifs passent (data:, vbscript:, ftp:, file:, blob:, tel:…).
        signaler('LIEN_EXTERNE_NON_PROTEGE', rel, `schéma de lien non autorisé (https:, mailto: ou lien relatif seulement) : ${href.slice(0, 60)}`);
      } else {
        const c = cible(rel, href);
        if (c === undefined) signaler('LIEN_INTERNE_CASSE', rel, `lien interne vers une page absente du dist : ${href.slice(0, 80)}`);
        else if (c.frag !== '' && c.rel.endsWith('.html')) {
          let id = c.frag;
          try {
            id = decodeURIComponent(c.frag);
          } catch {
            // fragment mal formé : on le compare tel quel
          }
          const ids = trouver(lirePage(c.rel).racine, (x) => x.attrs.id === id || (x.tag === 'a' && x.attrs.name === id));
          if (ids.length === 0) signaler('LIEN_INTERNE_CASSE', rel, `ancre introuvable dans ${c.rel} : #${id}`);
        }
      }
    }
    for (const n of tous) {
      if (n.tag === 'a' || n.tag === 'script' || n.tag === 'link') continue; // liens et ressources liées : traités plus haut
      const src = n.attrs.src;
      if (src === undefined || estAbsolue(src) || nettoyerUrl(src) === '') continue;
      if (cible(rel, src) === undefined) signaler('LIEN_INTERNE_CASSE', rel, `<${n.tag} src> introuvable dans le dist : ${nettoyerUrl(src).slice(0, 80)}`);
    }

    // URL canonique (HEB-05) : exactement une en production, égale à https://<domaine> + chemin ; aucune en preview
    const canoniques = tous.filter(estCanonique);
    if (opts.mode === 'preview') {
      if (canoniques.length > 0) signaler('PREVIEW_INDEXABLE', rel, `${canoniques.length} <link rel="canonical"> en preview (la preview n'a pas d'URL publique)`);
    } else if (rel === PAGE_ERREUR) {
      // IN-07 : une page d'erreur n'a pas d'URL publique à indexer : ni canonique ni entrée de sitemap.
      if (canoniques.length > 0) signaler('CANONIQUE_INCORRECT', rel, `${canoniques.length} <link rel="canonical"> sur la page d'erreur (aucun attendu, ni entrée de sitemap)`);
    } else {
      if (origine !== undefined) {
        const attendue = new URL(cheminPublic(rel), origine).href;
        canoniquesAttendues.push(attendue);
        if (canoniques.length !== 1) {
          signaler('CANONIQUE_ABSENT', rel, `${canoniques.length} <link rel="canonical"> (exactement un attendu : ${attendue})`);
        } else {
          const vue = urlAbsolue(nettoyerUrl(canoniques[0]?.attrs.href ?? ''));
          if (vue !== attendue) {
            signaler('CANONIQUE_INCORRECT', rel, `URL canonique « ${nettoyerUrl(canoniques[0]?.attrs.href ?? '').slice(0, 80)} », attendue « ${attendue} »`);
          }
        }
      } else {
        // Sans domaine (dist construit avant, appel direct) : seul un hôte provisoire est jugé.
        for (const c of canoniques) {
          const vue = urlAbsolue(nettoyerUrl(c.attrs.href ?? ''));
          if (vue !== undefined && estHoteProvisoire(new URL(vue).hostname)) {
            signaler('DOMAINE_PROVISOIRE', rel, `URL canonique vers un domaine provisoire (TLD réservé) : ${vue.slice(0, 80)}`, severiteDeploiement);
          }
        }
      }
    }

    // Balises de partage (FIN-02, 09.1-04) : og:url seulement en production, sur les pages qui ont une URL canonique,
    // et égal à elle ; jamais d'image de partage en preview ni sur la page d'erreur ; une image de partage valide est
    // un fichier du dist sur le domaine configuré, cité seulement par og:image et twitter:image (jamais chargée).
    const urlsOg = tous.filter(estUrlPartage);
    const imagesOg = tous.filter(estImagePartage);
    const lirePartage = (n: Noeud): string => nettoyerUrl(n.attrs.content ?? '');
    if (opts.mode === 'preview') {
      if (urlsOg.length > 0) signaler('PARTAGE_INCORRECT', rel, `${urlsOg.length} og:url en preview (la preview n'a pas d'URL publique)`);
      if (imagesOg.length > 0) signaler('PARTAGE_INCORRECT', rel, `${imagesOg.length} image(s) de partage en preview (la preview n'a pas d'URL publique)`);
    } else if (rel === PAGE_ERREUR) {
      if (urlsOg.length > 0) signaler('PARTAGE_INCORRECT', rel, `${urlsOg.length} og:url sur la page d'erreur (aucun attendu, comme pour l'URL canonique)`);
      if (imagesOg.length > 0) signaler('PARTAGE_INCORRECT', rel, `${imagesOg.length} image(s) de partage sur la page d'erreur`);
    } else {
      if (origine !== undefined) {
        const attendue = new URL(cheminPublic(rel), origine).href;
        if (urlsOg.length !== 1) {
          signaler('PARTAGE_INCORRECT', rel, `${urlsOg.length} og:url (exactement un attendu, égal à l'URL canonique : ${attendue})`);
        } else if (urlAbsolue(lirePartage(urlsOg[0] as Noeud)) !== attendue) {
          signaler('PARTAGE_INCORRECT', rel, `og:url « ${lirePartage(urlsOg[0] as Noeud).slice(0, 80)} », attendue « ${attendue} » (l'URL canonique)`);
        }
      } else {
        // Sans domaine (dist construit avant, appel direct) : seuls le nombre, le schéma et l'hôte provisoire sont jugés.
        if (urlsOg.length > 1) signaler('PARTAGE_INCORRECT', rel, `${urlsOg.length} og:url (un seul au plus)`);
        for (const n of urlsOg) {
          const vue = urlAbsolue(lirePartage(n));
          if (vue === undefined || new URL(vue).protocol !== 'https:' || estHoteProvisoire(new URL(vue).hostname)) {
            signaler('PARTAGE_INCORRECT', rel, `og:url « ${lirePartage(n).slice(0, 80)} » : https et un hôte non provisoire attendus`);
          }
        }
      }
      for (const n of imagesOg) {
        const probleme = problemeImage(n.attrs.content ?? '');
        if (probleme !== undefined) signaler('PARTAGE_INCORRECT', rel, probleme);
      }
    }
    // L'image de partage ne doit jamais être chargée par le visiteur : aucune autre référence qu'og:image et twitter:image.
    if (imagesPartage.size > 0) {
      const refs: string[] = [];
      for (const n of tous) {
        if ((n.tag === 'img' || n.tag === 'source') && n.attrs.srcset !== undefined) refs.push(...urlsSrcset(n.attrs.srcset));
        if (n.tag === 'img' && n.attrs.src !== undefined) refs.push(n.attrs.src);
        if (n.tag === 'link' && n.attrs.href !== undefined) refs.push(n.attrs.href);
        // IN-03 : autres attributs qui font charger une image
        if (n.tag === 'video' && n.attrs.poster !== undefined) refs.push(n.attrs.poster);
        if (n.tag === 'input' && n.attrs.src !== undefined) refs.push(n.attrs.src);
        if (n.tag === 'object' && n.attrs.data !== undefined) refs.push(n.attrs.data);
        if (n.tag === 'image') {
          if (n.attrs.href !== undefined) refs.push(n.attrs.href);
          if (n.attrs['xlink:href'] !== undefined) refs.push(n.attrs['xlink:href']);
        }
        if (n.tag === 'style') {
          const css = n.enfants.filter((e): e is string => typeof e === 'string').join('');
          for (const m of css.matchAll(/url\(\s*["']?([^"')]+)/gi)) refs.push(m[1] ?? '');
        }
      }
      for (const ref of refs) {
        const v = nettoyerUrl(ref);
        if (v === '') continue;
        const abs = SCHEMA.test(v) ? urlAbsolue(v) : undefined;
        const fichier = abs !== undefined ? [...imagesPartage].find(([, hrefs]) => hrefs.has(origineEtChemin(new URL(abs))))?.[0] : (() => {
          const c = cible(rel, v);
          return c !== undefined && imagesPartage.has(c.rel) ? c.rel : undefined;
        })();
        if (fichier !== undefined) {
          signaler('PARTAGE_INCORRECT', rel, `l'image de partage ne doit jamais être chargée par le visiteur : ${fichier.slice(0, 80)} est aussi référencée ici (${v.slice(0, 60)})`);
        }
      }
    }

    // hébergeur seulement prévu (WR-03) : Méthode et Mentions légales marquent leur texte d'avant la mise en ligne
    if (tous.some((n) => n.attrs['data-hebergeur'] === 'prevu')) {
      signaler(
        'HEBERGEUR_PREVU',
        rel,
        'hébergeur « prévu » (config/hebergeur.yml) : la page dit que le site n\'est pas en ligne ; passer statut à actif avant de déployer',
        opts.deploiement === true ? 'erreur' : 'avertissement',
      );
    }

    // ids uniques
    const comptes = new Map<string, number>();
    for (const n of tous) if (n.attrs.id !== undefined) comptes.set(n.attrs.id, (comptes.get(n.attrs.id) ?? 0) + 1);
    for (const [id, nb] of comptes) if (nb > 1) signaler('ID_DUPLIQUE', rel, `id « ${id.slice(0, 60)} » présent ${nb} fois`);

    // mots collés à un bouton ou à un lien (opt-out : data-colle)
    for (const n of tous) {
      if ((n.tag !== 'button' && n.tag !== 'a') || n.attrs['data-colle'] !== undefined || n.parent === null) continue;
      const i = n.parent.enfants.indexOf(n);
      const avant = n.parent.enfants[i - 1];
      const apres = n.parent.enfants[i + 1];
      if (typeof avant === 'string' && /[\p{L}\p{N}]$/u.test(avant)) {
        signaler('ESPACE_PERDU', rel, `mot collé avant <${n.tag}> : « …${avant.slice(-12)} »`);
      }
      if (typeof apres === 'string' && /^[\p{L}\p{N}]/u.test(apres)) {
        signaler('ESPACE_PERDU', rel, `mot collé après </${n.tag}> : « ${apres.slice(0, 12)}… »`);
      }
    }

    // texte visible : un espace entre deux nœuds de texte pour ne jamais recoller des blocs
    const ATTRIBUTS_TEXTE = ['title', 'aria-label', 'alt'] as const;
    const texteHors = (exclure: (n: Noeud) => boolean, avecAttributs = false): string => {
      const morceaux: string[] = [];
      const visiter = (n: Noeud): void => {
        for (const e of n.enfants) {
          if (typeof e === 'string') morceaux.push(e);
          else if (!exclure(e)) {
            if (avecAttributs) {
              for (const a of ATTRIBUTS_TEXTE) if (e.attrs[a] !== undefined) morceaux.push(e.attrs[a]);
              // description et métadonnées de partage (og:description, twitter:title…) : lues par les moteurs et les réseaux
              if (e.tag === 'meta' && e.attrs.content !== undefined && (e.attrs.name !== undefined || e.attrs.property !== undefined)) {
                const nom = (e.attrs.name ?? e.attrs.property ?? '').toLowerCase();
                if (nom !== 'viewport' && nom !== 'robots' && nom !== 'theme-color') morceaux.push(e.attrs.content);
              }
            }
            visiter(e);
          }
        }
      };
      visiter(racine);
      return morceaux.join(' ');
    };
    const code = (n: Noeud): boolean => n.tag === 'script' || n.tag === 'style';
    const visible = texteHors(code);
    if (visible.includes('[[')) signaler('MARQUEUR_RESIDUEL', rel, 'marqueur « [[ » résiduel dans le texte visible (glossaire non résolu)');
    // Exemptions étroites : la citation verbatim du candidat (blockquote ou q portant data-citation), le titre
    // d'une source primaire (span data-citation dans un bloc .source : c'est un titre, pas une rédaction) et la
    // liste des mots interdits de la page Méthode. Un data-citation posé ailleurs n'exempte rien.
    const dansSource = (n: Noeud): boolean => {
      for (let p = n.parent; p !== null; p = p.parent) if (aClasse(p, 'source')) return true;
      return false;
    };
    const exempte = (n: Noeud): boolean =>
      code(n) ||
      ((n.tag === 'blockquote' || n.tag === 'q') && n.attrs['data-citation'] !== undefined) ||
      (n.tag === 'span' && n.attrs['data-citation'] !== undefined && dansSource(n)) ||
      n.attrs['data-liste-mots-interdits'] !== undefined;
    const horsCitations = texteHors(exempte, true);
    for (const mot of motsInterdits(horsCitations)) signaler('MOT_INTERDIT', rel, `mot interdit hors citation : « ${mot} »`);

    // structure de page
    const html = trouver(racine, (n) => n.tag === 'html')[0];
    if (html === undefined || !/^fr(-|$)/i.test(html.attrs.lang ?? '')) signaler('LANG_ABSENTE', rel, '<html lang="fr"> manquant');
    const nbH1 = trouver(racine, (n) => n.tag === 'h1').length;
    if (nbH1 !== 1) signaler('H1_NOMBRE', rel, `${nbH1} balise(s) <h1> (une seule attendue)`);

    // mesures sourcées et brouillons
    const mesures = trouver(racine, (n) => aClasse(n, 'mesure'));
    for (const m of mesures) {
      const sources = trouver(m, (n) => aClasse(n, 'source'));
      const manque: string[] = [];
      if (sources.length === 0) manque.push('bloc .source');
      else {
        if (!sources.some((s) => trouver(s, (n) => n.tag === 'time' && /^\d{4}-\d{2}-\d{2}$/.test(n.attrs.datetime ?? '')).length > 0)) {
          manque.push('date <time datetime="AAAA-MM-JJ">');
        }
        if (!sources.some((s) => trouver(s, (n) => n.tag === 'a' && /^https:\/\//i.test(nettoyerUrl(n.attrs.href ?? ''))).length > 0)) {
          manque.push('lien https');
        }
      }
      if (manque.length > 0) {
        signaler('MESURE_SANS_SOURCE_DATEE', rel, `mesure${m.attrs.id ? ` « ${m.attrs.id} »` : ''} sans source datée (manque : ${manque.join(', ')})`);
      }
    }
    if (opts.mode === 'production') {
      for (const m of mesures) {
        if (m.attrs['data-statut-relecture'] !== 'publie') {
          signaler('BROUILLON_EN_PRODUCTION', rel, `mesure sans data-statut-relecture="publie"${m.attrs.id ? ` (« ${m.attrs.id} »)` : ''}`);
        }
      }
      // PUB-03 (D-05) : exactement une ligne « Relue par … le … » par mesure, avec un relecteur et une vraie date
      for (const m of mesures) {
        const lignes = trouver(m, (n) => n.attrs['data-relecture'] !== undefined);
        const fautes: string[] = [];
        if (lignes.length !== 1) fautes.push(`${lignes.length} ligne(s) de relecture (une seule attendue)`);
        else {
          const ligne = lignes[0] as Noeud;
          const dates = trouver(ligne, (n) => n.tag === 'time');
          const hors = ligne.enfants.filter((e): e is string => typeof e === 'string').join('').replace(/Relue par|\ble\b|[\s.]/g, '');
          if (hors === '') fautes.push('relecteur vide');
          if (dates.length !== 1 || !estDateCalendaire(dates[0]?.attrs.datetime ?? '')) fautes.push('date <time datetime> absente ou invalide');
        }
        if (fautes.length > 0) {
          signaler('RELECTURE_ABSENTE', rel, `mesure${m.attrs.id ? ` « ${m.attrs.id} »` : ''} : ${fautes.join(' ; ')}`);
        }
      }
      if (tous.some((n) => n.attrs['data-badge'] !== undefined)) signaler('BROUILLON_EN_PRODUCTION', rel, 'pastille de preview (data-badge) en production');
      if (tous.some((n) => aClasse(n, 'banniere-preview'))) signaler('BROUILLON_EN_PRODUCTION', rel, 'bandeau de preview en production');
    } else {
      const noindex = trouver(racine, (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(n.attrs.content ?? ''));
      if (noindex.length === 0) signaler('PREVIEW_INDEXABLE', rel, 'page de preview sans <meta name="robots" content="noindex">');
    }

    // liste blanche de publication
    if (opts.mode === 'production' && opts.themesOuverts !== undefined) {
      for (const main of trouver(racine, (n) => n.tag === 'main' && n.attrs['data-theme'] !== undefined)) {
        const id = main.attrs['data-theme'] ?? '';
        themesVus.add(id);
        if (!estOuvert(opts.themesOuverts, id)) {
          signaler('THEME_HORS_LISTE_BLANCHE', rel, `page du thème « ${id} » alors qu'il ne figure pas dans themes_ouverts de config/publication.yml`);
        }
      }
    }

    // cellules par thème
    if (cellules !== undefined) {
      for (const main of trouver(racine, (n) => n.tag === 'main' && n.attrs['data-theme'] !== undefined)) {
        const id = main.attrs['data-theme'] ?? '';
        const attendu = cellules.get(id);
        if (attendu === undefined) {
          signaler('THEME_INATTENDU', rel, `page du thème « ${id} » absente de la liste des thèmes visibles en ${opts.mode}`);
          continue;
        }
        const vues = trouver(main, (n) => n.tag === 'li' && aClasse(n, 'cellule')).length;
        if (vues !== attendu) signaler('CELLULES_INCOHERENTES', rel, `${vues} cellule(s) pour le thème « ${id} », ${attendu} attendue(s) d'après le contenu`);
      }
    }
  }

  if (opts.mode === 'production' && opts.themesOuverts !== undefined) {
    // Sens sûr : un retrait d'urgence d'un thème entier (brouillon) ou d'un site vide doit pouvoir se déployer.
    for (const id of opts.themesOuverts) {
      if (!themesVus.has(id)) signaler('THEME_OUVERT_ABSENT', `themes/${id}/index.html`, `le thème « ${id} » est listé dans themes_ouverts mais n'a pas de page dans le dist`, 'avertissement');
    }
    if (themesVus.size === 0) signaler('PUBLICATION_VIDE', 'index.html', 'le dist ne contient aucune page de thème : aucun thème n\'est ouvert au public', 'avertissement');
  }

  // Personnes sans statut relu (D-06, plan 09-15) : ni page, ni lien, ni entrée de sitemap en production.
  const nonRelus = opts.mode === 'production' && opts.candidatsNonRelus !== undefined ? new Set(opts.candidatsNonRelus) : new Set<string>();
  if (nonRelus.size > 0) {
    const raison = 'aucun statut relu ou publié (D-06) : la personne ne doit pas être publique';
    for (const rel of fichiers) {
      const id = idCandidatDuChemin(`/${rel}`);
      if (id !== undefined && nonRelus.has(id)) signaler('CANDIDAT_NON_RELU_EN_PRODUCTION', rel, `page de « ${id} » dans le dist : ${raison}`);
    }
    for (const p of pages) {
      for (const a of trouver(p.racine, (n) => n.tag === 'a' && n.attrs.href !== undefined)) {
        const href = nettoyerUrl(a.attrs.href ?? '');
        if (href === '' || href.startsWith('#')) continue; // la page elle-même : déjà signalée comme page
        let chemin: string;
        try {
          // Lien relatif (résolu depuis la page) ou absolu vers le domaine du site, avec ou sans « www. ».
          const u = new URL(href, `https://dist.invalid/${p.rel}`);
          const interne = u.host === 'dist.invalid' || (opts.domaine !== undefined && (u.host === opts.domaine || u.host === `www.${opts.domaine}`));
          if (!interne) continue;
          chemin = u.pathname;
        } catch {
          continue;
        }
        const id = idCandidatDuChemin(chemin);
        if (id !== undefined && nonRelus.has(id)) signaler('CANDIDAT_NON_RELU_EN_PRODUCTION', p.rel, `lien vers /candidats/${id}/ : ${raison}`);
      }
    }
    const plan = fs.existsSync(path.join(racineDist, 'sitemap.xml')) ? fs.readFileSync(path.join(racineDist, 'sitemap.xml'), 'utf8') : undefined;
    for (const loc of plan === undefined ? [] : locsSitemap(plan)) {
      let chemin: string;
      try {
        chemin = new URL(loc, 'https://dist.invalid/').pathname;
      } catch {
        continue;
      }
      const id = idCandidatDuChemin(chemin);
      if (id !== undefined && nonRelus.has(id)) signaler('CANDIDAT_NON_RELU_EN_PRODUCTION', 'sitemap.xml', `entrée <loc> pour /candidats/${id}/ : ${raison}`);
    }
  }

  // robots.txt et sitemap.xml
  const lireSiPresent = (rel: string): string | undefined => {
    const f = path.join(racineDist, rel);
    return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : undefined;
  };
  const robots = lireSiPresent('robots.txt');
  const sitemap = lireSiPresent('sitemap.xml');
  if (opts.mode === 'preview') {
    if (!/^\s*Disallow:\s*\/\s*$/m.test(robots ?? '')) signaler('PREVIEW_INDEXABLE', 'robots.txt', 'robots.txt absent ou sans « Disallow: / » en preview');
    if (/^\s*Sitemap\s*:/im.test(robots ?? '')) signaler('PREVIEW_INDEXABLE', 'robots.txt', 'ligne « Sitemap: » dans robots.txt en preview');
    if (sitemap !== undefined) signaler('PREVIEW_INDEXABLE', 'sitemap.xml', 'sitemap.xml présent en preview (la preview ne doit lister aucune URL)');
  } else if (origine !== undefined) {
    const ligne = `Sitemap: ${new URL('/sitemap.xml', origine).href}`;
    if (!(robots ?? '').split(/\r?\n/).some((l) => l.trim() === ligne)) {
      signaler('ROBOTS_SANS_SITEMAP', 'robots.txt', `robots.txt ${robots === undefined ? 'absent' : 'sans la ligne'} « ${ligne} »`);
    }
    if (sitemap === undefined) {
      signaler('SITEMAP_INCOHERENT', 'sitemap.xml', 'sitemap.xml absent en production');
    } else {
      const locs = locsSitemap(sitemap).map((l) => urlAbsolue(l) ?? l);
      const attendues = new Set(canoniquesAttendues);
      const vues = new Set(locs);
      const doublons = [...new Set(locs.filter((l, i) => locs.indexOf(l) !== i))];
      const enTrop = [...vues].filter((l) => !attendues.has(l)).sort();
      const manquantes = [...attendues].filter((l) => !vues.has(l)).sort();
      const ecarts = [
        manquantes.length > 0 && `${manquantes.length} URL canonique(s) manquante(s) : ${extraitListe(manquantes)}`,
        enTrop.length > 0 && `${enTrop.length} <loc> sans page canonique : ${extraitListe(enTrop)}`,
        doublons.length > 0 && `${doublons.length} <loc> en double : ${extraitListe(doublons)}`,
      ].filter((x): x is string => typeof x === 'string');
      if (ecarts.length > 0) signaler('SITEMAP_INCOHERENT', 'sitemap.xml', `sitemap.xml diffère des URL canoniques des pages : ${ecarts.join(' ; ')}`);
    }
  }

  // version.json (HEB-07, D-12) : commit et date de la build servie
  if (opts.version !== undefined) {
    const brut = lireSiPresent('version.json');
    if (brut === undefined) {
      signaler('VERSION_ABSENTE', 'version.json', 'version.json absent du dist (src/pages/version.json.ts : commit et date de build)');
    } else {
      for (const message of ecartsVersion(brut, opts.version.commitAttendu, opts.deploiement === true)) signaler('VERSION_INVALIDE', 'version.json', message);
    }
  }

  // types de fichiers (HEB-08) : aucun fichier qui demanderait une règle de cache long
  if (opts.typesAutorises !== undefined) {
    const permis = new Set(opts.typesAutorises);
    for (const f of fichiers) {
      const ext = path.posix.extname(f);
      if (ext === '.ico' && permis.has(ext)) {
        // Icône (D-11) : une seule, à la racine, sous LIMITES.favicon ; elle est revalidée comme les pages (no-cache).
        if (f !== FAVICON) {
          signaler('TYPE_FICHIER_INATTENDU', f, `icône refusée : seul favicon.ico à la racine du dist est permis (public/favicon.ico, généré par scripts/favicon.ts)`);
        } else {
          const taille = fs.statSync(path.join(dist, f)).size;
          if (taille > LIMITES.favicon) signaler('TYPE_FICHIER_INATTENDU', f, `favicon.ico de ${taille} octets (limite ${LIMITES.favicon}) : régénérer par node scripts/favicon.ts`);
        }
        continue;
      }
      if (ext === '.png' && permis.has(ext)) {
        // Image de partage (09.1) : un seul PNG, à la racine, sous LIMITES.partage ; jamais chargée par une page (PARTAGE_INCORRECT).
        if (f !== IMAGE_PARTAGE) {
          signaler('TYPE_FICHIER_INATTENDU', f, `image refusée : seul partage.png à la racine du dist est permis (public/partage.png, généré par scripts/partage.ts)`);
        } else {
          const taille = fs.statSync(path.join(dist, f)).size;
          if (taille > LIMITES.partage) {
            signaler('TYPE_FICHIER_INATTENDU', f, `partage.png de ${taille} octets (limite ${LIMITES.partage}) : régénérer par node scripts/partage.ts`);
          } else {
            const ecart = problemePng(fs.readFileSync(path.join(dist, f)), LARGEUR_PARTAGE, HAUTEUR_PARTAGE);
            if (ecart !== undefined) {
              signaler('TYPE_FICHIER_INATTENDU', f, `partage.png n'est pas un PNG ${LARGEUR_PARTAGE} x ${HAUTEUR_PARTAGE} bien formé (${ecart}) : régénérer par node scripts/partage.ts`);
            }
          }
        }
        continue;
      }
      if (permis.has(ext)) continue;
      signaler(
        'TYPE_FICHIER_INATTENDU',
        f,
        `type de fichier non prévu (permis : ${[...permis].join(', ')}) : un fichier séparé demanderait une règle de cache long dans le bloc Caddy (HEB-08), et le bloc n'en rend aucune depuis l'intégration du CSS et des scripts dans la page (Phase 7)`,
      );
    }
  }

  return constats.sort((a, b) => a.fichier.localeCompare(b.fichier) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}

/** Horodatage ISO 8601 en UTC (`Z`), millisecondes facultatives, date et heure réelles. */
/** AAAA-MM-JJ qui existe au calendrier (le 30 février est refusé). */
function estDateCalendaire(texte: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  if (m === null) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === texte;
}

function estHorodatageUtc(texte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(texte)) return false;
  const d = new Date(texte);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === texte.slice(0, 19);
}

/** Écarts de version.json : forme exacte { commit, date }, commit attendu, « dev » refusé avant déploiement. */
function ecartsVersion(brut: string, commitAttendu: string | undefined, deploiement: boolean): string[] {
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return ['version.json n\'est pas un JSON valide'];
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return ['version.json doit être un objet { "commit", "date" }'];
  const cles = Object.keys(v).sort();
  if (cles.join(',') !== 'commit,date') {
    return [`version.json doit avoir exactement les clés commit et date (vu : ${cles.map((c) => c.slice(0, 20)).join(', ') || 'aucune'})`];
  }
  const { commit, date } = v as { commit: unknown; date: unknown };
  const out: string[] = [];
  const commitTexte = typeof commit === 'string' ? commit.slice(0, 60) : JSON.stringify(commit)?.slice(0, 60);
  if (typeof commit !== 'string' || !COMMIT_VERSION.test(commit)) {
    out.push(`commit « ${commitTexte} » invalide (attendu : 40 hexadécimaux minuscules, ou dev hors CI)`);
  } else if (commitAttendu !== undefined && commit !== commitAttendu) {
    out.push(`commit « ${commit} » différent du commit construit « ${commitAttendu} » (GITHUB_SHA)`);
  } else if (commit === 'dev' && deploiement) {
    out.push('commit « dev » refusé quand RTP_DEPLOIEMENT=1 : construire en CI, où GITHUB_SHA donne le commit');
  }
  if (typeof date !== 'string' || !estHorodatageUtc(date)) {
    out.push(`date « ${typeof date === 'string' ? date.slice(0, 40) : JSON.stringify(date)?.slice(0, 40)} » invalide (attendu : horodatage ISO UTC, ex. 2026-11-08T20:30:00.000Z)`);
  }
  return out;
}
