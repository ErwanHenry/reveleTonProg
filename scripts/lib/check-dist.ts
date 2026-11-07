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
} as const;

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
  'BROUILLON_EN_PRODUCTION',
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
  'SITEMAP_INCOHERENT',
  'ROBOTS_SANS_SITEMAP',
  'DOMAINE_PROVISOIRE',
] as const;
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

function lister(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...lister(p, base));
    else if (e.isFile()) out.push(posix(path.relative(base, p)));
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
export function cellulesAttendues(contentRoot: string, projectRoot: string, mode: Mode): Map<string, number> {
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
    out.set(e.id, perimetre);
  }
  return out;
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

  const fichiers = lister(racineDist);
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
      if (tous.some((n) => n.attrs['data-badge'] !== undefined)) signaler('BROUILLON_EN_PRODUCTION', rel, 'pastille de preview (data-badge) en production');
      if (tous.some((n) => aClasse(n, 'banniere-preview'))) signaler('BROUILLON_EN_PRODUCTION', rel, 'bandeau de preview en production');
    } else {
      const noindex = trouver(racine, (n) => n.tag === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(n.attrs.content ?? ''));
      if (noindex.length === 0) signaler('PREVIEW_INDEXABLE', rel, 'page de preview sans <meta name="robots" content="noindex">');
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

  return constats.sort((a, b) => a.fichier.localeCompare(b.fichier) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}
