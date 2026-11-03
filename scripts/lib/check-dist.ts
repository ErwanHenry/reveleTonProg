// Contrôle post-build (QUAL-01) : lit le dist d'Astro et refuse une page qui casse le budget,
// appelle un tiers, colle des mots, montre une mesure sans source datée ou un brouillon.
// Aucune règle éditoriale n'est copiée ici : les mots interdits et le périmètre d'équité viennent
// de content-core (même liste que le validateur et la future page Méthode).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadAll } from '../../src/lib/content-core/load.ts';
import { PERIMETRE_EQUITE } from '../../src/lib/content-core/rules/config.ts';
import { statutRetenu } from '../../src/lib/content-core/rules/equite.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';
import { schemasDirOf } from '../../src/lib/content-core/root.ts';
import { aClasse, analyserHtml, trouver } from './html.ts';
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
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const SCHEMA = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Valeur d'attribut telle que la lit un navigateur : sans espaces de bord ni tabulations/retours internes. */
const nettoyerUrl = (v: string): string => v.replace(/[\t\n\r]/g, '').trim();
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
  const signaler = (code: CodeCheckDist, fichier: string, message: string): void => {
    const cle = `${code}\u0000${fichier}\u0000${message}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    constats.push({ code, severite: 'erreur', fichier, message });
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
      const css = fs.readFileSync(path.join(racineDist, f), 'utf8');
      const IMPORT = /@import\s+(?:url\(\s*)?["']?\s*((?:[a-z][a-z0-9+.-]*:|\/\/)[^"')\s;]*)/gi;
      for (const m of css.matchAll(IMPORT)) {
        signaler('RESSOURCE_TIERCE', f, `@import vers une ressource externe : ${m[1] ?? ''}`);
      }
      // un @import déjà signalé ne l'est pas une seconde fois comme url()
      for (const m of css.replace(IMPORT, '').matchAll(/url\(\s*["']?\s*((?:[a-z][a-z0-9+.-]*:|\/\/)[^"')]*)/gi)) {
        signaler('RESSOURCE_TIERCE', f, `url() vers une ressource externe ou data: : ${(m[1] ?? '').slice(0, 60)}`);
      }
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
        if (n.attrs.src === undefined) signaler('SCRIPT_EN_LIGNE', rel, '<script> sans src : le code doit être un fichier du site (CSP script-src \'self\')');
        else if (n.attrs.type?.toLowerCase() === 'module' || n.attrs.async !== undefined || n.attrs.defer !== undefined) {
          signaler('SCRIPT_NON_BLOQUANT', rel, `<script src="${nettoyerUrl(n.attrs.src)}"> doit rester bloquant (ni type=module, ni async, ni defer)`);
        }
      }
      if (n.tag === 'style') signaler('STYLE_EN_LIGNE', rel, "<style> interdit : la feuille de style doit être un fichier du site (CSP style-src 'self')");
      if (n.attrs.style !== undefined) signaler('STYLE_EN_LIGNE', rel, `attribut style sur <${n.tag}> interdit (CSP style-src 'self')`);
    }

    // liens
    for (const n of tous) {
      if (n.tag !== 'a' || n.attrs.href === undefined) continue;
      const href = nettoyerUrl(n.attrs.href);
      if (href === '' || /^(?:mailto|tel):/i.test(href)) continue;
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
      } else if (!SCHEMA.test(href)) {
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
    const texteHors = (exclure: (n: Noeud) => boolean): string => {
      const morceaux: string[] = [];
      const visiter = (n: Noeud): void => {
        for (const e of n.enfants) {
          if (typeof e === 'string') morceaux.push(e);
          else if (!exclure(e)) visiter(e);
        }
      };
      visiter(racine);
      return morceaux.join(' ');
    };
    const code = (n: Noeud): boolean => n.tag === 'script' || n.tag === 'style';
    const visible = texteHors(code);
    if (visible.includes('[[')) signaler('MARQUEUR_RESIDUEL', rel, 'marqueur « [[ » résiduel dans le texte visible (glossaire non résolu)');
    const horsCitations = texteHors((n) => code(n) || n.attrs['data-citation'] !== undefined || n.attrs['data-liste-mots-interdits'] !== undefined);
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

  // robots.txt en preview
  if (opts.mode === 'preview') {
    const robots = path.join(racineDist, 'robots.txt');
    const contenu = fs.existsSync(robots) ? fs.readFileSync(robots, 'utf8') : '';
    if (!/^\s*Disallow:\s*\/\s*$/m.test(contenu)) signaler('PREVIEW_INDEXABLE', 'robots.txt', 'robots.txt absent ou sans « Disallow: / » en preview');
  }

  return constats.sort((a, b) => a.fichier.localeCompare(b.fichier) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}
