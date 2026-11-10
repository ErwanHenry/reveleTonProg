// QUAL-01 : chaque règle du contrôle post-build est prouvée par injection de faute sur un dist
// synthétique (dossier temporaire, aucun `astro build` ici : seul tests/dist/site.test.ts en lance).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES_CHECK_DIST, LIMITES, TYPES_AUTORISES, cellulesAttendues, checkDist } from '../../scripts/lib/check-dist.ts';
import type { OptionsCheckDist } from '../../scripts/lib/check-dist.ts';
import { empreinteCsp } from '../../src/lib/csp-empreintes.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const CLI = path.join(REPO_ROOT, 'scripts', 'check-dist.ts');
/** Texte exact de src/scripts/niveau.js : seul un script identique à une source est accepté en ligne. */
const NIVEAU = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'niveau.js'), 'utf8');
const H_NIVEAU = `'${empreinteCsp(NIVEAU)}'`;
/**
 * Configuration réelle du dépôt, celle que lit le CLI (env vide : pas de garde de déploiement dans le processus de
 * test). Le nom d'hôte du site n'est jamais écrit ici (tests/repo/hote-en-dur.test.ts) ; les cas unitaires du
 * domaine utilisent example.org (nom réservé par la RFC 2606, mais pas un TLD réservé : un « vrai » domaine pour la
 * garde) et exemple.invalid, exemple.test, exemple.example, exemple.localhost (provisoires, IN-04).
 */
const SITE = loadSiteConfig(REPO_ROOT, {});
/** Domaine synthétique par défaut des dists propres appelés directement (jamais un TLD réservé : estHoteProvisoire). */
const DOMAINE_TEST = 'example.org';

const tmpDirs: string[] = [];
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

type Fichiers = Record<string, string | Buffer>;

function ecrireDist(fichiers: Fichiers): string {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-checkdist-'));
  tmpDirs.push(dist);
  for (const [rel, contenu] of Object.entries(fichiers)) {
    const f = path.join(dist, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, contenu);
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Générateur de pages synthétiques
// ---------------------------------------------------------------------------

interface OptsPage {
  lang?: string | null;
  titre?: string;
  corps?: string;
  head?: string;
  noindex?: boolean;
  h1?: number;
  main?: string; // attributs de <main>
  /** Contenu du meta CSP ; `null` : aucun meta. Défaut : CSP_DEFAUT (aucun code en ligne autorisé). */
  csp?: string | null;
}

const CSP_DEFAUT = "default-src 'none'; script-src 'self'; style-src 'self'";
const metaCsp = (contenu: string): string => `<meta http-equiv="content-security-policy" content="${contenu}">`;

function page(o: OptsPage = {}): string {
  const lang = o.lang === null ? '' : ` lang="${o.lang ?? 'fr'}"`;
  const h1 = Array.from({ length: o.h1 ?? 1 }, (_, i) => `<h1>Titre ${i + 1}</h1>`).join('');
  const robots = o.noindex ? '<meta name="robots" content="noindex, nofollow">' : '';
  return (
    `<!doctype html><html${lang}><head><meta charset="utf-8"><title>${o.titre ?? 'Page'}</title>${robots}` +
    `<link rel="stylesheet" href="/_astro/a.css">${o.head ?? ''}${o.csp === null ? '' : metaCsp(o.csp ?? CSP_DEFAUT)}</head>` +
    `<body><main${o.main ? ` ${o.main}` : ''}>${h1}${o.corps ?? ''}</main><script src="/_astro/n.js"></script></body></html>`
  );
}

interface OptsMesure {
  statut?: string | null;
  source?: boolean;
  date?: string | null;
  lien?: string | null;
  id?: string;
}

function mesure(o: OptsMesure = {}): string {
  const statut = o.statut === null ? '' : ` data-statut-relecture="${o.statut ?? 'publie'}"`;
  const date = o.date === null ? '' : `, consulté le <time datetime="${o.date ?? '2026-10-20'}">20 octobre 2026</time>`;
  const lien =
    o.lien === null ? '' : ` <a href="${o.lien ?? 'https://x.exemple.invalid/p'}" rel="noopener noreferrer">Programme</a>`;
  const source = o.source === false ? '' : `<p class="source">Source :${lien}${date}</p>`;
  return `<article class="mesure"${statut}${o.id ? ` id="${o.id}"` : ''}><h3>Une mesure</h3><p>Texte de la mesure.</p>${source}</article>`;
}

function theme(id: string, cellules: number, opts: { mesure?: () => string; noindex?: boolean; corps?: string } = {}): string {
  const lis = Array.from({ length: cellules }, (_, i) => `<li class="cellule" id="c-${i}">${(opts.mesure ?? mesure)()}</li>`).join('');
  return page({
    main: `data-theme="${id}"`,
    corps: `<ul class="cellules">${lis}</ul><a href="/">Accueil</a>${opts.corps ?? ''}`,
    noindex: opts.noindex,
  });
}

const JS = 'a'.repeat(500);

/** Chemin public d'une page : `index.html` → `/`, `a/index.html` → `/a/`, `a.html` → `/a.html`. */
const cheminPage = (rel: string): string => (rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`);

/** sitemap.xml de la forme écrite par src/lib/sitemap.ts. */
const xmlSitemap = (urls: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>\n`)
    .join('')}</urlset>\n`;

/**
 * Dist synthétique propre : une page d'accueil, une page de thème à 2 cellules, un CSS, un script de 500 octets.
 * En production, chaque page reçoit (après les surcharges) son URL canonique `https://<domaine>` + chemin, et le dist
 * un sitemap.xml qui les liste et un robots.txt avec la ligne Sitemap, sauf si `sitemap.xml` ou `robots.txt` sont
 * surchargés. `domaine` : DOMAINE_TEST par défaut ; les cas du CLI passent celui de config/site.yml (SITE.domaine).
 */
function distPropre(surcharges: Record<string, string | Buffer | null> = {}, opts: { preview?: boolean; domaine?: string } = {}): Fichiers {
  const noindex = opts.preview === true;
  const base: Fichiers = {
    'index.html': page({
      noindex,
      corps:
        '<a href="/themes/logement/">Logement</a> ' +
        '<a href="mailto:contact@x.exemple.fr?subject=Signaler%20une%20erreur">Signaler une erreur</a>',
    }),
    'themes/logement/index.html': theme('logement', 2, { noindex }),
    '_astro/a.css': 'body{margin:0}.cellule{padding:1rem}',
    '_astro/n.js': JS,
  };
  if (opts.preview) base['robots.txt'] = 'User-agent: *\nDisallow: /\n';
  for (const [k, v] of Object.entries(surcharges)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  if (opts.preview !== true) {
    const origine = `https://${opts.domaine ?? DOMAINE_TEST}`;
    const pages = Object.keys(base).filter((k) => k.endsWith('.html')).sort();
    for (const rel of pages) {
      const html = base[rel];
      if (typeof html === 'string' && html.includes('</head>') && !html.includes('rel="canonical"')) {
        base[rel] = html.replace('</head>', `<link rel="canonical" href="${origine}${cheminPage(rel)}"></head>`);
      }
    }
    if (!('sitemap.xml' in surcharges)) base['sitemap.xml'] = xmlSitemap(pages.map((rel) => `${origine}${cheminPage(rel)}`));
    if (!('robots.txt' in surcharges)) base['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${origine}/sitemap.xml\n`;
  }
  return base;
}

/** Commit factice du version.json des dists du CLI (40 hexadécimaux : valable aussi sous RTP_DEPLOIEMENT=1). */
const COMMIT_CLI = '0123456789abcdef0123456789abcdef01234567';

/**
 * Adapte un dist synthétique au CLI, qui active toujours VERSION_* et TYPE_FICHIER_INATTENDU (08-04) : retire la
 * feuille et le script liés (le dist réel n'a que html, txt, xml et json depuis l'intégration de la Phase 7) et
 * ajoute un version.json valide, sauf si le dist en a déjà un.
 */
function pourCli(fichiers: Fichiers): Fichiers {
  const out: Fichiers = {};
  for (const [rel, contenu] of Object.entries(fichiers)) {
    if (rel.startsWith('_astro/')) continue;
    out[rel] =
      typeof contenu === 'string' && rel.endsWith('.html')
        ? contenu.replace('<link rel="stylesheet" href="/_astro/a.css">', '').replace('<script src="/_astro/n.js"></script>', '')
        : contenu;
  }
  if (!('version.json' in out)) out['version.json'] = `${JSON.stringify({ commit: COMMIT_CLI, date: '2026-11-08T20:30:00.000Z' })}\n`;
  return out;
}

/** Dist propre pour le CLI, qui lit toujours le domaine de config/site.yml. */
const distCli = (surcharges: Record<string, string | Buffer | null> = {}): Fichiers => pourCli(distPropre(surcharges, { domaine: SITE.domaine }));

interface Resultat {
  codes: string[];
  fichiers: string[];
  messages: string[];
}

function verifier(
  fichiers: Fichiers,
  mode: Mode = 'production',
  cellules: Record<string, number> | null = { logement: 2 },
  extra: Partial<OptionsCheckDist> = {},
): Resultat {
  const dist = ecrireDist(fichiers);
  const constats = checkDist(dist, { ...extra, mode, ...(cellules === null ? {} : { cellulesParTheme: new Map(Object.entries(cellules)) }) });
  return {
    codes: [...new Set(constats.map((c) => c.code))].sort(),
    fichiers: constats.map((c) => c.fichier),
    messages: constats.map((c) => c.message),
  };
}

function exactement(code: string, surcharges: Record<string, string | Buffer | null>, mode: Mode = 'production', opts: { preview?: boolean } = {}): Resultat {
  const r = verifier(distPropre(surcharges, opts), mode);
  assert.deepEqual(r.codes, [code], `attendu uniquement ${code}, vu : ${r.codes.join(', ')} (${r.messages.join(' | ')})`);
  return r;
}

/** Octets pseudo-aléatoires reproductibles (mulberry32), pour un texte incompressible sans test instable. */
function octetsAleatoires(n: number): Buffer {
  let a = 0x9e3779b9;
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
  }
  return out;
}

// ---------------------------------------------------------------------------

describe('checkDist : dist propre', () => {
  it('un dist propre ne produit aucun constat en production', () => {
    const r = verifier(distPropre());
    assert.deepEqual(r, { codes: [], fichiers: [], messages: [] });
  });

  it('un dist propre en preview (noindex, robots.txt, badge, brouillon) ne produit aucun constat', () => {
    const fichiers = distPropre(
      {
        'themes/logement/index.html': theme('logement', 2, {
          noindex: true,
          mesure: () => mesure({ statut: 'brouillon' }),
          corps: '<p class="banniere-preview" data-badge>Brouillon</p>',
        }),
      },
      { preview: true },
    );
    assert.deepEqual(verifier(fichiers, 'preview').codes, []);
  });

  it('expose les limites et la liste des codes', () => {
    assert.deepEqual(LIMITES, { brut: 500_000, gzip: 100_000, script: 2048, favicon: 4096 });
    for (const code of ['POIDS_BRUT', 'POIDS_GZIP', 'MOT_INTERDIT', 'BROUILLON_EN_PRODUCTION', 'CELLULES_INCOHERENTES']) {
      assert.ok((CODES_CHECK_DIST as readonly string[]).includes(code), `${code} absent de CODES_CHECK_DIST`);
    }
    assert.equal(new Set(CODES_CHECK_DIST).size, CODES_CHECK_DIST.length, 'codes en double');
  });

  it("un dist sans aucune page HTML est refusé (DIST_VIDE)", () => {
    const r = verifier({ '_astro/a.css': 'a{}' });
    assert.deepEqual(r.codes, ['DIST_VIDE']);
  });
});

describe('checkDist : poids', () => {
  it('POIDS_BRUT : une page de plus de 500 000 octets', () => {
    const corps = `<p>${'lorem ipsum '.repeat(42_000)}</p>`;
    const r = exactement('POIDS_BRUT', { 'index.html': page({ corps }) });
    assert.deepEqual(r.fichiers, ['index.html']);
  });

  it('POIDS_BRUT compte aussi le CSS et le JS liés', () => {
    exactement('POIDS_BRUT', { '_astro/a.css': `.a{}${' '.repeat(500_100)}` });
  });

  it('POIDS_GZIP : plus de 100 000 octets compressés, moins de 500 000 bruts', () => {
    const texte = octetsAleatoires(120_000).toString('base64'); // ~160 000 caractères incompressibles
    const html = page({ corps: `<p>${texte}</p>` });
    assert.ok(Buffer.byteLength(html) < LIMITES.brut);
    exactement('POIDS_GZIP', { 'index.html': html });
  });

  it('SCRIPT_TROP_LOURD : un .js de plus de 2048 octets', () => {
    const r = exactement('SCRIPT_TROP_LOURD', { '_astro/gros.js': 'a'.repeat(2049) });
    assert.deepEqual(r.fichiers, ['_astro/gros.js']);
    assert.deepEqual(verifier(distPropre({ '_astro/n.js': 'a'.repeat(2048) })).codes, []);
  });
});

describe('checkDist : ressources tierces, scripts et styles', () => {
  it('RESSOURCE_TIERCE : image absolue', () => {
    exactement('RESSOURCE_TIERCE', { 'index.html': page({ corps: '<img src="https://cdn.exemple.invalid/a.png" alt="">' }) });
  });

  it('RESSOURCE_TIERCE : feuille de style protocole-relatif', () => {
    exactement('RESSOURCE_TIERCE', { 'index.html': page({ head: '<link rel="stylesheet" href="//cdn.exemple.invalid/x.css">' }) });
  });

  it('RESSOURCE_TIERCE : @import et url(http…) dans un CSS', () => {
    const a = exactement('RESSOURCE_TIERCE', { '_astro/a.css': '@import url(https://fonts.exemple.invalid/f.css);body{margin:0}' });
    assert.deepEqual(a.fichiers, ['_astro/a.css']);
    exactement('RESSOURCE_TIERCE', { '_astro/a.css': '@import "//fonts.exemple.invalid/f.css";' });
    exactement('RESSOURCE_TIERCE', { '_astro/a.css': 'body{background:url("http://cdn.exemple.invalid/a.png")}' });
    exactement('RESSOURCE_TIERCE', { '_astro/a.css': 'body{background:url(data:image/png;base64,AAAA)}' });
  });

  it('RESSOURCE_TIERCE : iframe, srcset et action de formulaire', () => {
    exactement('RESSOURCE_TIERCE', { 'index.html': page({ corps: '<iframe src="https://video.exemple.invalid/v"></iframe>' }) });
    exactement('RESSOURCE_TIERCE', {
      'a.png': 'x',
      'index.html': page({ corps: '<img srcset="/a.png 1x, https://cdn.exemple.invalid/b.png 2x" src="/a.png" alt="">' }),
    });
    exactement('RESSOURCE_TIERCE', { 'index.html': page({ corps: '<form action="https://api.exemple.invalid/x"></form>' }) });
  });

  it('LIEN_EXTERNE_NON_PROTEGE : https sans noopener, http, javascript:, protocole-relatif ; mailto: jamais jugé', () => {
    exactement('LIEN_EXTERNE_NON_PROTEGE', { 'index.html': page({ corps: '<a href="https://x.exemple.invalid/">x</a>' }) });
    exactement('LIEN_EXTERNE_NON_PROTEGE', { 'index.html': page({ corps: '<a href="http://x.exemple.invalid/" rel="noopener">x</a>' }) });
    exactement('LIEN_EXTERNE_NON_PROTEGE', { 'index.html': page({ corps: '<a href="javascript:alert(1)">x</a>' }) });
    exactement('LIEN_EXTERNE_NON_PROTEGE', { 'index.html': page({ corps: '<a href="//x.exemple.invalid/" rel="noopener">x</a>' }) });
    const ok = page({ corps: '<a href="https://x.exemple.invalid/" rel="noopener noreferrer">x</a><a href="mailto:a@x.exemple.fr?subject=S%C3%A9">m</a>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ok })).codes, []);
  });

  it('CONTACT_PROVISOIRE (WR-03) : avertissement par défaut, erreur quand deploiement est vrai', () => {
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps: '<a href="mailto:contact@exemple-provisoire.invalid?subject=S">m</a>' }) }));
    const defaut = checkDist(dist, { mode: 'production' });
    assert.deepEqual(defaut.map((c) => [c.code, c.severite]), [['CONTACT_PROVISOIRE', 'avertissement']]);
    const deploiement = checkDist(dist, { mode: 'production', deploiement: true });
    assert.deepEqual(deploiement.map((c) => [c.code, c.severite]), [['CONTACT_PROVISOIRE', 'erreur']]);
    // Un contact réel ne déclenche rien, même au déploiement.
    const bon = ecrireDist(distPropre({}));
    assert.deepEqual(checkDist(bon, { mode: 'production', deploiement: true }), []);
  });

  it('HEBERGEUR_PREVU (WR-03) : avertissement par défaut, erreur quand deploiement est vrai, une fois par page', () => {
    const corps = '<p data-hebergeur="prevu">Pas en ligne.</p><p data-hebergeur="prevu">Relu avant la mise en ligne.</p>';
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps }) }));
    assert.deepEqual(checkDist(dist, { mode: 'production' }).map((c) => [c.code, c.severite]), [['HEBERGEUR_PREVU', 'avertissement']]);
    assert.deepEqual(checkDist(dist, { mode: 'production', deploiement: true }).map((c) => [c.code, c.severite]), [['HEBERGEUR_PREVU', 'erreur']]);
    // Un hébergeur actif (aucun marqueur) ne déclenche rien, même au déploiement ; un autre statut non plus.
    const actif = ecrireDist(distPropre({ 'index.html': page({ corps: '<p data-hebergeur="actif">Hébergeur.</p>' }) }));
    assert.deepEqual(checkDist(actif, { mode: 'production', deploiement: true }), []);
  });

  it('WR-05 : liste blanche de schémas de lien (data:, vbscript:, ftp:, file:, blob:, tel:) et contrôles C0 ignorés par le navigateur', () => {
    for (const href of ['data:text/html,x', 'vbscript:x', 'ftp://x.exemple.invalid/', 'file:///etc/passwd', 'blob:https://x', 'tel:+33123456789', '\u0001javascript:alert(1)', ' \u0000data:text/html,x']) {
      exactement('LIEN_EXTERNE_NON_PROTEGE', { 'index.html': page({ corps: `<a href="${href}">x</a>` }) });
    }
    const ok = page({ corps: '<a href="/themes/logement/">t</a><a href="mailto:a@x.exemple.fr">m</a>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ok })).codes, []);
  });

  it('WR-05 : gestionnaires on*, <meta http-equiv=refresh> et <base> sont refusés', () => {
    exactement('SCRIPT_EN_LIGNE', { 'index.html': page({ corps: '<p onclick="x()">t</p>' }) });
    exactement('SCRIPT_EN_LIGNE', { 'index.html': page({ corps: '<img src="/_astro/a.css" alt="" onerror="x()">' }) });
    exactement('META_REFRESH', { 'index.html': page({ head: '<meta http-equiv="refresh" content="0;url=https://x.exemple.invalid/">' }) });
    exactement('BASE_INTERDITE', { 'index.html': page({ head: '<base href="https://x.exemple.invalid/">' }) });
  });

  it('SCRIPT_EN_LIGNE : script en ligne différent de toutes les sources de src/scripts/ (même haché dans la CSP)', () => {
    for (const corps of [`${NIVEAU} `, ` ${NIVEAU}`, `${NIVEAU}\n`, NIVEAU.replace('rtp:niveau', 'rtp:niveaux'), 'var a=1;']) {
      const csp = `default-src 'none'; script-src 'self' '${empreinteCsp(corps)}'`;
      const r = exactement('SCRIPT_EN_LIGNE', { 'index.html': page({ csp, corps: `<script>${corps}</script>` }) });
      assert.match(r.messages.join(' '), /différent des sources de src\/scripts\//);
    }
  });

  it('SCRIPT_DATA_URI : script data:', () => {
    exactement('SCRIPT_DATA_URI', { 'index.html': page({ head: '<script src="data:text/javascript;base64,AAAA"></script>' }) });
  });

  it('SCRIPT_NON_BLOQUANT : type=module, async, defer ou type non classique, externe comme en ligne', () => {
    const attributs = ['type="module"', 'async', 'defer', 'type="text/plain"', 'type="application/ld+json"'];
    for (const a of attributs) {
      exactement('SCRIPT_NON_BLOQUANT', { 'index.html': page({ head: `<script src="/_astro/n.js" ${a}></script>` }) });
      const csp = `default-src 'none'; script-src 'self' ${H_NIVEAU}`;
      exactement('SCRIPT_NON_BLOQUANT', { 'index.html': page({ csp, corps: `<script ${a}>${NIVEAU}</script>` }) });
    }
    // type vide ou text/javascript (casse indifférente) : script classique, accepté
    const csp = `default-src 'none'; script-src 'self' ${H_NIVEAU}`;
    for (const a of ['type=""', 'type="text/javascript"', 'type="TEXT/JavaScript"']) {
      assert.deepEqual(verifier(distPropre({ 'index.html': page({ csp, corps: `<script ${a}>${NIVEAU}</script>` }) })).codes, [], a);
      assert.deepEqual(verifier(distPropre({ 'index.html': page({ head: `<script src="/_astro/n.js" ${a}></script>` }) })).codes, [], a);
    }
  });

  it('STYLE_EN_LIGNE : attribut style (un <style> haché est permis, voir STYLE_SANS_EMPREINTE)', () => {
    exactement('STYLE_EN_LIGNE', { 'index.html': page({ corps: '<p style="color:red">x</p>' }) });
    const css = 'p{color:red}';
    const csp = `default-src 'none'; style-src 'self' '${empreinteCsp(css)}'`;
    exactement('STYLE_EN_LIGNE', { 'index.html': page({ csp, head: `<style>${css}</style>`, corps: '<p style="color:red">x</p>' }) });
  });
});

describe('checkDist : CSP à empreintes (ADR-056, remplace les règles « aucun code en ligne » de l’ADR-037)', () => {
  const CSS = '.cellule{padding:1rem}';
  const H_CSS = `'${empreinteCsp(CSS)}'`;
  /** Page conforme : le vrai src/scripts/niveau.js en ligne, un <style>, un meta qui liste les deux empreintes. */
  const conforme = (o: { csp?: string; script?: string; style?: string } = {}): string =>
    page({
      csp: o.csp ?? `default-src 'none'; img-src 'self'; script-src 'self' ${H_NIVEAU}; style-src 'self' ${H_CSS}`,
      head: `<style>${o.style ?? CSS}</style>`,
      corps: `<fieldset></fieldset><script>${o.script ?? NIVEAU}</script>`,
    });

  it('une page conforme (script identique à la source, <style>, empreintes dans le meta) ne produit aucun constat', () => {
    assert.deepEqual(verifier(distPropre({ 'index.html': conforme() })), { codes: [], fichiers: [], messages: [] });
    // l'empreinte d'un script peut figurer dans script-src-elem seul, ou dans default-src à défaut de script-src
    assert.deepEqual(verifier(distPropre({ 'index.html': conforme({ csp: `default-src 'none'; script-src-elem ${H_NIVEAU}; style-src ${H_CSS}` }) })).codes, []);
    assert.deepEqual(verifier(distPropre({ 'index.html': conforme({ csp: `default-src 'self' ${H_NIVEAU} ${H_CSS}` }) })).codes, []);
  });

  it('un script placé avant le meta est accepté (le script d’ordre précède toujours le meta, Pitfall 1)', () => {
    const csp = `default-src 'none'; script-src 'self' ${H_NIVEAU}`;
    const html = page({ csp: null, head: `<script>${NIVEAU}</script>${metaCsp(csp)}` });
    assert.deepEqual(verifier(distPropre({ 'index.html': html })).codes, []);
  });

  it('la CSP peut lister des empreintes sans script correspondant (5 empreintes de directives d’îlots d’Astro)', () => {
    const autres = ['a', 'b', 'c', 'd', 'e'].map((x) => `'${empreinteCsp(x)}'`).join(' ');
    const html = conforme({ csp: `default-src 'none'; script-src 'self' ${H_NIVEAU} ${autres}; style-src 'self' ${H_CSS}` });
    assert.deepEqual(verifier(distPropre({ 'index.html': html })).codes, []);
  });

  it('CSP_ABSENTE : aucun meta, deux metas, ou un meta hors de <head>', () => {
    const r = exactement('CSP_ABSENTE', { 'index.html': page({ csp: null }) });
    assert.deepEqual(r.fichiers, ['index.html']);
    exactement('CSP_ABSENTE', { 'index.html': page({ head: metaCsp(CSP_DEFAUT) }) });
    exactement('CSP_ABSENTE', { 'index.html': page({ csp: null, corps: metaCsp(CSP_DEFAUT) }) });
    // http-equiv insensible à la casse : un meta « Content-Security-Policy » compte
    assert.deepEqual(verifier(distPropre({ 'index.html': page({ csp: null, head: `<meta http-equiv="Content-Security-Policy" content="${CSP_DEFAUT}">` }) })).codes, []);
  });

  it('CSP_TROP_PERMISSIVE : tout jeton autre que self, none ou une empreinte, dans toute directive', () => {
    const jetons = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'strict-dynamic'", "'nonce-abc123'", "'wasm-unsafe-eval'", '*', 'https:', 'http:', 'data:', 'blob:', 'https://x.exemple.invalid', 'x.exemple.invalid'];
    for (const j of jetons) {
      for (const directive of ['script-src', 'style-src', 'default-src', 'img-src', 'script-src-elem', 'style-src-attr']) {
        const csp = directive === 'default-src' ? `default-src 'self' ${j}` : `default-src 'none'; ${directive} 'self' ${j}`;
        const r = exactement('CSP_TROP_PERMISSIVE', { 'index.html': page({ csp }) });
        assert.match(r.messages.join(' '), new RegExp(directive), `${directive} ${j}`);
      }
    }
    // une directive répétée (ignorée par le navigateur) est vérifiée quand même
    exactement('CSP_TROP_PERMISSIVE', { 'index.html': page({ csp: "default-src 'none'; script-src 'self'; script-src 'unsafe-inline'" }) });
    // mots-clés et algorithme insensibles à la casse ; sha384 et sha512 acceptés
    const ok = `default-src 'NONE'; script-src 'Self' 'sha384-${'A'.repeat(64)}' 'sha512-${'B'.repeat(86)}=='; img-src 'self'`;
    assert.deepEqual(verifier(distPropre({ 'index.html': page({ csp: ok }) })).codes, []);
  });

  it('SCRIPT_SANS_EMPREINTE : script identique à la source mais empreinte absente de la directive effective', () => {
    // empreinte absente
    exactement('SCRIPT_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src 'self'; style-src ${H_CSS}` }) });
    // empreinte seulement dans style-src
    exactement('SCRIPT_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src 'self'; style-src ${H_CSS} ${H_NIVEAU}` }) });
    // script-src-elem prime sur script-src : une empreinte dans script-src seul ne suffit pas
    exactement('SCRIPT_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src-elem 'self'; script-src ${H_NIVEAU}; style-src ${H_CSS}` }) });
    // script-src prime sur default-src
    exactement('SCRIPT_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src ${H_NIVEAU}; script-src 'self'; style-src ${H_CSS}` }) });
    // empreinte d'un texte voisin (retour ligne final en plus) : jamais de trim
    exactement('SCRIPT_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src '${empreinteCsp(`${NIVEAU}\n`)}'; style-src ${H_CSS}` }) });
  });

  it('STYLE_SANS_EMPREINTE : <style> dont l’empreinte manque à style-src-elem, style-src ou default-src', () => {
    exactement('STYLE_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src ${H_NIVEAU}; style-src 'self'` }) });
    exactement('STYLE_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src ${H_NIVEAU} ${H_CSS}` }) });
    exactement('STYLE_SANS_EMPREINTE', { 'index.html': conforme({ csp: `default-src 'none'; script-src ${H_NIVEAU}; style-src-elem 'self'; style-src ${H_CSS}` }) });
    exactement('STYLE_SANS_EMPREINTE', { 'index.html': conforme({ style: `${CSS} ` }) });
    exactement('STYLE_SANS_EMPREINTE', { 'index.html': page({ head: '<style>p{color:red}</style>' }) });
  });

  it('SCRIPT_TROP_LOURD : script en ligne de plus de 2048 octets UTF-8, même identique à une source déclarée', () => {
    const gros = `/* é */${'a'.repeat(LIMITES.script - 7)}`; // 2049 octets UTF-8 pour 2048 caractères
    assert.equal(Buffer.byteLength(gros), LIMITES.script + 1);
    const csp = `default-src 'none'; script-src '${empreinteCsp(gros)}'`;
    const r = verifier(distPropre({ 'index.html': page({ csp, corps: `<script>${gros}</script>` }) }), 'production', { logement: 2 }, { sourcesScripts: [gros] });
    assert.deepEqual(r.codes, ['SCRIPT_TROP_LOURD']);
    const juste = gros.slice(1);
    const cspJuste = `default-src 'none'; script-src '${empreinteCsp(juste)}'`;
    const ok = verifier(distPropre({ 'index.html': page({ csp: cspJuste, corps: `<script>${juste}</script>` }) }), 'production', { logement: 2 }, { sourcesScripts: [juste] });
    assert.deepEqual(ok.codes, []);
  });

  it('sourcesScripts par défaut : les fichiers de src/scripts/ ; une liste fournie les remplace', () => {
    const html = conforme();
    assert.deepEqual(verifier(distPropre({ 'index.html': html }), 'production', { logement: 2 }, { sourcesScripts: ['autre'] }).codes, ['SCRIPT_EN_LIGNE']);
  });

  it('RESSOURCE_TIERCE : @import et url() externes ou data: dans un <style> en ligne', () => {
    for (const css of ['@import url(https://fonts.exemple.invalid/f.css);p{margin:0}', '@import "//fonts.exemple.invalid/f.css";', 'body{background:url("http://cdn.exemple.invalid/a.png")}', 'body{background:url(data:image/png;base64,AAAA)}']) {
      const csp = `default-src 'none'; style-src '${empreinteCsp(css)}'`;
      const r = exactement('RESSOURCE_TIERCE', { 'index.html': page({ csp, head: `<style>${css}</style>` }) });
      assert.deepEqual(r.fichiers, ['index.html'], css);
    }
  });

  it('script data: toujours refusé, script externe du même site toujours accepté et pesé', () => {
    exactement('SCRIPT_DATA_URI', { 'index.html': page({ head: '<script src="data:text/javascript;base64,AAAA"></script>' }) });
    // le dist propre lie /_astro/n.js : accepté ; un .js lié trop gros est compté dans le poids de la page
    const r = verifier(distPropre({ '_astro/n.js': ' '.repeat(500_100) }));
    assert.deepEqual(r.codes, ['POIDS_BRUT', 'SCRIPT_TROP_LOURD']);
    assert.ok(r.fichiers.includes('index.html') && r.fichiers.includes('_astro/n.js'), r.fichiers.join(', '));
  });
});

describe('checkDist : structure et texte', () => {
  it('ID_DUPLIQUE : deux éléments avec le même id sur une page', () => {
    exactement('ID_DUPLIQUE', { 'index.html': page({ corps: '<p id="x">a</p><p id="x">b</p>' }) });
  });

  it('ESPACE_PERDU : mot collé avant un bouton ou après un lien ; data-colle exempte', () => {
    exactement('ESPACE_PERDU', { 'index.html': page({ corps: '<p>le<button type="button">loyer</button></p>' }) });
    exactement('ESPACE_PERDU', { 'index.html': page({ corps: '<p><a href="/">loyer</a>est</p>' }) });
    const ok = page({ corps: '<p>le<button type="button" data-colle>loyer</button> <a href="/" data-colle>x</a>s</p>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ok })).codes, []);
    const ponct = page({ corps: '<p>le <button type="button">loyer</button>, <a href="/">x</a>.</p>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ponct })).codes, []);
  });

  it('MOT_INTERDIT : « extrême » dans le texte visible, sauf citation, liste dédiée, script ou « … »', () => {
    const r = exactement('MOT_INTERDIT', { 'index.html': page({ corps: '<p>Une mesure extrême.</p>' }) });
    assert.match(r.messages.join(' '), /extrême/);
    const exemptions = [
      '<p>Il dit <q data-citation>extrême</q>.</p>',
      '<blockquote data-citation><p>« extrême »</p></blockquote>',
      '<div class="source"><p>Source primaire : <span data-citation>Programme extrême</span></p></div>',
      '<ul data-liste-mots-interdits><li>extrême</li></ul>',
      '<p>Le candidat parle d’une « mesure extrême » dans le programme.</p>',
    ];
    for (const corps of exemptions) assert.deepEqual(verifier(distPropre({ 'index.html': page({ corps }) })).codes, [], corps);
  });

  it('WR-06 : mots interdits dans les attributs title, aria-label, alt et les meta description', () => {
    for (const corps of ['<p title="une mesure extrême">t</p>', '<button aria-label="enfin !">x</button>', '<img src="/_astro/a.css" alt="populiste">']) {
      exactement('MOT_INTERDIT', { 'index.html': page({ corps }) });
    }
    exactement('MOT_INTERDIT', { 'index.html': page({ head: '<meta name="description" content="Un programme irresponsable">' }) });
    exactement('MOT_INTERDIT', { 'index.html': page({ head: '<meta property="og:description" content="courageux">' }) });
    // Un attribut dans une citation exemptée reste exempté avec le reste du sous-arbre.
    const ok = page({ corps: '<blockquote data-citation><p title="extrême">« x »</p></blockquote>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ok })).codes, []);
  });

  it('WR-06 : data-citation n’exempte que les vraies citations (blockquote, q) et le titre de source', () => {
    for (const corps of [
      '<p data-citation>Une mesure extrême.</p>',
      '<div data-citation><p>Une mesure extrême.</p></div>',
      '<span data-citation>extrême</span>',
    ]) {
      exactement('MOT_INTERDIT', { 'index.html': page({ corps }) });
    }
  });

  it('MOT_INTERDIT : jamais dans <script> ni <style> (le texte brut y est ignoré)', () => {
    // un script en ligne inconnu est refusé par SCRIPT_EN_LIGNE et SCRIPT_SANS_EMPREINTE, jamais par MOT_INTERDIT
    const r = verifier(distPropre({ 'index.html': page({ head: '<script>var extrême=1;</script>' }) }));
    assert.deepEqual(r.codes, ['SCRIPT_EN_LIGNE', 'SCRIPT_SANS_EMPREINTE']);
    const css = '.extrême{margin:0}';
    const csp = `default-src 'none'; style-src 'self' '${empreinteCsp(css)}'`;
    assert.deepEqual(verifier(distPropre({ 'index.html': page({ csp, head: `<style>${css}</style>` }) })).codes, []);
  });

  it('MESURE_SANS_SOURCE_DATEE : pas de .source, pas de date, ou pas de lien https', () => {
    for (const m of [mesure({ source: false }), mesure({ date: null }), mesure({ lien: null }), mesure({ lien: 'http://x.exemple.invalid/p' })]) {
      const r = verifier(distPropre({ 'themes/logement/index.html': theme('logement', 2, { mesure: () => m }) }));
      assert.deepEqual(r.codes.filter((c) => c !== 'LIEN_EXTERNE_NON_PROTEGE'), ['MESURE_SANS_SOURCE_DATEE'], m);
    }
    const mauvaiseDate = mesure({ date: '20/10/2026' });
    exactement('MESURE_SANS_SOURCE_DATEE', { 'themes/logement/index.html': theme('logement', 2, { mesure: () => mauvaiseDate }) });
  });

  it('LANG_ABSENTE, H1_NOMBRE et MARQUEUR_RESIDUEL', () => {
    exactement('LANG_ABSENTE', { 'index.html': page({ lang: null }) });
    exactement('H1_NOMBRE', { 'index.html': page({ h1: 0 }) });
    exactement('H1_NOMBRE', { 'index.html': page({ h1: 2 }) });
    exactement('MARQUEUR_RESIDUEL', { 'index.html': page({ corps: '<p>Voir [[loyer|le loyer]] ici.</p>' }) });
  });
});

describe('checkDist : liens internes', () => {
  it('LIEN_INTERNE_CASSE : page absente', () => {
    exactement('LIEN_INTERNE_CASSE', { 'index.html': page({ corps: '<a href="/candidats/x/">x</a>' }) });
  });

  it('LIEN_INTERNE_CASSE : fragment absent de la page cible, et de la page courante', () => {
    exactement('LIEN_INTERNE_CASSE', { 'index.html': page({ corps: '<a href="/themes/logement/#m-absent">x</a>' }) });
    exactement('LIEN_INTERNE_CASSE', { 'index.html': page({ corps: '<a href="#nulle-part">x</a>' }) });
  });

  it('un lien interne valide (page, fragment, requête) passe', () => {
    const ok = page({ corps: '<a href="/themes/logement/#c-1">x</a><a href="/themes/logement/?a=1#c-0">y</a><a href="#haut" id="haut">z</a>' });
    assert.deepEqual(verifier(distPropre({ 'index.html': ok })).codes, []);
  });
});

describe('checkDist : cellules par thème', () => {
  it('CELLULES_INCOHERENTES : 3 cellules pour 2 attendues', () => {
    exactement('CELLULES_INCOHERENTES', { 'themes/logement/index.html': theme('logement', 3) });
  });

  it('THEME_INATTENDU : thème absent de la table attendue', () => {
    const r = verifier(distPropre({ 'themes/ecole/index.html': theme('ecole', 2) }));
    assert.deepEqual(r.codes, ['THEME_INATTENDU']);
  });

  it("sans table de cellules, ces deux règles ne s'appliquent pas", () => {
    const r = verifier(distPropre({ 'themes/logement/index.html': theme('logement', 3) }), 'production', null);
    assert.deepEqual(r.codes, []);
  });
});

describe('checkDist : liste blanche de publication', () => {
  const sev = (fichiers: Fichiers, extra: Partial<OptionsCheckDist>, mode: Mode = 'production'): Array<[string, string]> => {
    const dist = ecrireDist(fichiers);
    return checkDist(dist, { mode, cellulesParTheme: new Map([['logement', 2]]), ...extra }).map((c): [string, string] => [c.code, c.severite]);
  };

  it('THEME_HORS_LISTE_BLANCHE : page de thème hors liste, erreur en production', () => {
    const r = sev(distPropre(), { themesOuverts: ['climat'] });
    assert.deepEqual(r.filter(([c]) => c === 'THEME_HORS_LISTE_BLANCHE'), [['THEME_HORS_LISTE_BLANCHE', 'erreur']]);
  });

  it('thème listé et présent : aucun constat de publication', () => {
    assert.deepEqual(sev(distPropre(), { themesOuverts: ['logement'] }), []);
  });

  it('THEME_OUVERT_ABSENT : listé sans page, avertissement seulement', () => {
    assert.deepEqual(sev(distPropre(), { themesOuverts: ['logement', 'climat'] }), [['THEME_OUVERT_ABSENT', 'avertissement']]);
  });

  it('PUBLICATION_VIDE : dist sans aucun thème, avertissement seulement (retrait d\'urgence)', () => {
    const fichiers = distPropre({ 'themes/logement/index.html': null, 'index.html': page({ corps: '<a href="mailto:contact@x.exemple.fr?subject=Signaler%20une%20erreur">Signaler une erreur</a>' }) });
    const r = sev(fichiers, { themesOuverts: [] });
    assert.deepEqual(r, [['PUBLICATION_VIDE', 'avertissement']]);
  });

  it('sans l\'option, les trois codes sont inactifs ; en preview aussi', () => {
    assert.deepEqual(sev(distPropre(), {}), []);
    assert.deepEqual(sev(distPropre({}, { preview: true }), { themesOuverts: [] }, 'preview'), []);
  });
});

describe('checkDist : brouillons et indexation', () => {
  it('BROUILLON_EN_PRODUCTION : mesure sans statut publié, sans attribut, badge ou bandeau de preview', () => {
    exactement('BROUILLON_EN_PRODUCTION', { 'themes/logement/index.html': theme('logement', 2, { mesure: () => mesure({ statut: 'brouillon' }) }) });
    exactement('BROUILLON_EN_PRODUCTION', { 'themes/logement/index.html': theme('logement', 2, { mesure: () => mesure({ statut: null }) }) });
    exactement('BROUILLON_EN_PRODUCTION', { 'index.html': page({ corps: '<span data-badge>Brouillon</span>' }) });
    exactement('BROUILLON_EN_PRODUCTION', { 'index.html': page({ corps: '<div class="banniere-preview">Preview</div>' }) });
  });

  it('PREVIEW_INDEXABLE : page sans noindex, ou sans robots.txt Disallow: /', () => {
    const sansNoindex = distPropre({}, { preview: true });
    sansNoindex['index.html'] = page({ corps: '<a href="/themes/logement/">Logement</a>' });
    assert.deepEqual(verifier(sansNoindex, 'preview').codes, ['PREVIEW_INDEXABLE']);
    const sansRobots = distPropre({ 'robots.txt': null }, { preview: true });
    assert.deepEqual(verifier(sansRobots, 'preview').codes, ['PREVIEW_INDEXABLE']);
    const robotsOuvert = distPropre({ 'robots.txt': 'User-agent: *\nAllow: /\n' }, { preview: true });
    assert.deepEqual(verifier(robotsOuvert, 'preview').codes, ['PREVIEW_INDEXABLE']);
  });

  it("en production, noindex et robots.txt ne sont pas exigés", () => {
    assert.deepEqual(verifier(distPropre()).codes, []);
  });
});

describe('checkDist : domaine, URL canoniques, sitemap et robots (HEB-05, HEB-06)', () => {
  const D = DOMAINE_TEST;
  const ORIGINE = `https://${D}`;
  const avecDomaine = (fichiers: Fichiers, mode: Mode = 'production', extra: Partial<OptionsCheckDist> = {}): Resultat =>
    verifier(fichiers, mode, { logement: 2 }, { domaine: D, ...extra });
  const retoucher = (fichiers: Fichiers, rel: string, muter: (texte: string) => string): Fichiers => {
    const avant = String(fichiers[rel]);
    const apres = muter(avant);
    assert.notEqual(apres, avant, `faute non injectée dans ${rel}`);
    return { ...fichiers, [rel]: apres };
  };
  const CANONIQUE = /<link rel="canonical" href="[^"]*">/;
  const seul = (r: Resultat, code: string): void => assert.deepEqual(r.codes, [code], r.messages.join(' | '));

  it('dist propre de production avec son domaine : aucun constat, y compris pour a/index.html → /a/ et a.html → /a.html', () => {
    assert.deepEqual(avecDomaine(distPropre({}, { domaine: D })), { codes: [], fichiers: [], messages: [] });
    const pages = { 'a/index.html': page(), 'a.html': page(), 'x&y/index.html': page() };
    assert.deepEqual(avecDomaine(distPropre(pages, { domaine: D })).codes, []);
    // hôte en majuscules : même URL après normalisation
    const maj = retoucher(distPropre({}, { domaine: D }), 'index.html', (h) => h.replace(`href="${ORIGINE}/"`, `href="https://${D.toUpperCase()}/"`));
    assert.deepEqual(avecDomaine(maj).codes, []);
  });

  it('sans option domaine, les règles de domaine sont inactives (appels directs existants)', () => {
    const sansRien = distPropre({ 'sitemap.xml': null, 'robots.txt': null }, { domaine: D });
    assert.deepEqual(verifier(sansRien).codes, []);
  });

  it('CANONIQUE_ABSENT : page sans URL canonique, ou avec deux', () => {
    const sans = retoucher(distPropre({}, { domaine: D }), 'index.html', (h) => h.replace(CANONIQUE, ''));
    const r = avecDomaine(sans);
    seul(r, 'CANONIQUE_ABSENT');
    assert.deepEqual(r.fichiers, ['index.html']);
    assert.match(r.messages[0] ?? '', /0 <link rel="canonical">/);
    const deux = retoucher(distPropre({}, { domaine: D }), 'index.html', (h) => h.replace(CANONIQUE, (m) => m + m));
    seul(avecDomaine(deux), 'CANONIQUE_ABSENT');
  });

  it('CANONIQUE_INCORRECT : autre hôte, bon hôte mais mauvais chemin, http:, URL relative', () => {
    for (const href of ['https://autre.test/', `${ORIGINE}/themes/logement/`, `http://${D}/`, '/', `${ORIGINE}/index.html`, `https://www.${D}/`]) {
      const f = retoucher(distPropre({}, { domaine: D }), 'index.html', (h) => h.replace(CANONIQUE, `<link rel="canonical" href="${href}">`));
      const r = avecDomaine(f);
      seul(r, 'CANONIQUE_INCORRECT');
      assert.deepEqual(r.fichiers, ['index.html'], href);
      assert.match(r.messages[0] ?? '', new RegExp(`attendue « ${ORIGINE}/ »`), href);
    }
    const mauvaise = retoucher(distPropre({ 'a.html': page() }, { domaine: D }), 'a.html', (h) => h.replace(`${ORIGINE}/a.html`, `${ORIGINE}/a/`));
    seul(avecDomaine(mauvaise), 'CANONIQUE_INCORRECT');
  });

  it('SITEMAP_INCOHERENT : sitemap.xml absent, un <loc> en trop, un <loc> manquant, un doublon ; 3 écarts au plus listés', () => {
    seul(avecDomaine(distPropre({ 'sitemap.xml': null }, { domaine: D })), 'SITEMAP_INCOHERENT');
    const enTrop = retoucher(distPropre({}, { domaine: D }), 'sitemap.xml', (x) => x.replace('</urlset>', `  <url><loc>${ORIGINE}/fantome/</loc></url>\n</urlset>`));
    const r1 = avecDomaine(enTrop);
    seul(r1, 'SITEMAP_INCOHERENT');
    assert.deepEqual(r1.fichiers, ['sitemap.xml']);
    assert.match(r1.messages[0] ?? '', /1 <loc> sans page canonique : https:\/\/example\.org\/fantome\//);
    const manque = retoucher(distPropre({}, { domaine: D }), 'sitemap.xml', (x) => x.replace(`  <url><loc>${ORIGINE}/themes/logement/</loc></url>\n`, ''));
    const r2 = avecDomaine(manque);
    seul(r2, 'SITEMAP_INCOHERENT');
    assert.match(r2.messages[0] ?? '', /1 URL canonique\(s\) manquante\(s\) : https:\/\/example\.org\/themes\/logement\//);
    const double = retoucher(distPropre({}, { domaine: D }), 'sitemap.xml', (x) => x.replace('</urlset>', `  <url><loc>${ORIGINE}/</loc></url>\n</urlset>`));
    assert.match(avecDomaine(double).messages.join(' '), /1 <loc> en double/);
    const cinq = Array.from({ length: 5 }, (_, i) => `  <url><loc>${ORIGINE}/f${i}/</loc></url>\n`).join('');
    const beaucoup = retoucher(distPropre({}, { domaine: D }), 'sitemap.xml', (x) => x.replace('</urlset>', `${cinq}</urlset>`));
    const r3 = avecDomaine(beaucoup);
    assert.match(r3.messages[0] ?? '', /5 <loc> sans page canonique : [^;]*f0\/, [^;]*f1\/, [^;]*f2\/ … \(5 au total\)/);
    assert.doesNotMatch(r3.messages[0] ?? '', /f3\//);
    // un autre domaine dans le sitemap : toutes les URL en trop et toutes manquantes
    const autre = distPropre({ 'sitemap.xml': xmlSitemap(['https://autre.test/', 'https://autre.test/themes/logement/']) }, { domaine: D });
    assert.match(avecDomaine(autre).messages[0] ?? '', /2 URL canonique\(s\) manquante\(s\).*2 <loc> sans page canonique/);
  });

  it('sitemap.xml : entités XML décodées avant la comparaison (&amp;)', () => {
    const f = distPropre({ 'x&y/index.html': page() }, { domaine: D });
    assert.match(String(f['sitemap.xml']), /x&amp;y/);
    assert.deepEqual(avecDomaine(f).codes, []);
  });

  it('ROBOTS_SANS_SITEMAP : robots.txt absent, sans ligne Sitemap ou pointant vers un autre domaine', () => {
    for (const robots of [null, 'User-agent: *\nAllow: /\n', 'User-agent: *\nAllow: /\nSitemap: https://autre.test/sitemap.xml\n', `User-agent: *\n# Sitemap: ${ORIGINE}/sitemap.xml\n`]) {
      const r = avecDomaine(distPropre({ 'robots.txt': robots }, { domaine: D }));
      seul(r, 'ROBOTS_SANS_SITEMAP');
      assert.deepEqual(r.fichiers, ['robots.txt']);
    }
    // fins de ligne CRLF et espaces de bord tolérés
    const crlf = `User-agent: *\r\nAllow: /\r\n  Sitemap: ${ORIGINE}/sitemap.xml  \r\n`;
    assert.deepEqual(avecDomaine(distPropre({ 'robots.txt': crlf }, { domaine: D })).codes, []);
  });

  it('PREVIEW_INDEXABLE : en preview, une URL canonique, un sitemap.xml ou une ligne Sitemap dans robots.txt, avec ou sans domaine', () => {
    const propre = distPropre({}, { preview: true });
    assert.deepEqual(avecDomaine(propre, 'preview').codes, []);
    const canonique = retoucher(propre, 'index.html', (h) => h.replace('</head>', `<link rel="canonical" href="${ORIGINE}/"></head>`));
    const sitemap = { ...propre, 'sitemap.xml': xmlSitemap([`${ORIGINE}/`]) };
    const robots = { ...propre, 'robots.txt': `User-agent: *\nDisallow: /\nSitemap: ${ORIGINE}/sitemap.xml\n` };
    for (const [nom, f, fichier] of [['canonique', canonique, 'index.html'], ['sitemap', sitemap, 'sitemap.xml'], ['robots', robots, 'robots.txt']] as const) {
      for (const r of [avecDomaine(f, 'preview'), verifier(f, 'preview')]) {
        seul(r, 'PREVIEW_INDEXABLE');
        assert.deepEqual(r.fichiers, [fichier], nom);
      }
    }
    // la règle Disallow: / de la preview reste entière
    seul(avecDomaine({ ...propre, 'robots.txt': 'User-agent: *\nAllow: /\n' }, 'preview'), 'PREVIEW_INDEXABLE');
  });

  it('DOMAINE_PROVISOIRE : domaine .invalid signalé une fois sur le dist (« . »), avertissement par défaut, erreur au déploiement', () => {
    const P = 'exemple.invalid';
    const dist = ecrireDist(distPropre({}, { domaine: P }));
    const defaut = checkDist(dist, { mode: 'production', domaine: P });
    assert.deepEqual(defaut.map((c) => [c.code, c.fichier, c.severite]), [['DOMAINE_PROVISOIRE', '.', 'avertissement']]);
    assert.match(defaut[0]?.message ?? '', /exemple\.invalid.*config\/site\.yml/);
    const deploiement = checkDist(dist, { mode: 'production', domaine: P, deploiement: true });
    assert.deepEqual(deploiement.map((c) => [c.code, c.fichier, c.severite]), [['DOMAINE_PROVISOIRE', '.', 'erreur']]);
    // un vrai domaine ne déclenche rien, même au déploiement
    assert.deepEqual(checkDist(ecrireDist(distPropre({}, { domaine: D })), { mode: 'production', domaine: D, deploiement: true }), []);
  });

  it('IN-04 : .test, .example et .localhost sont provisoires comme .invalid (option domaine et URL canonique)', () => {
    for (const P of ['exemple.test', 'exemple.example', 'exemple.localhost', 'Exemple.TEST']) {
      const dist = ecrireDist(distPropre({}, { domaine: P.toLowerCase() }));
      const avecOption = checkDist(dist, { mode: 'production', domaine: P.toLowerCase(), deploiement: true });
      assert.deepEqual(avecOption.map((c) => [c.code, c.fichier, c.severite]), [['DOMAINE_PROVISOIRE', '.', 'erreur']], P);
      const sansOption = checkDist(dist, { mode: 'production', deploiement: true });
      assert.ok(sansOption.length > 0 && sansOption.every((c) => c.code === 'DOMAINE_PROVISOIRE' && c.severite === 'erreur'), P);
    }
    const contact = ecrireDist(distPropre({ 'index.html': page({ corps: '<a href="mailto:contact@exemple.test">m</a>' }) }));
    assert.deepEqual(checkDist(contact, { mode: 'production', deploiement: true }).map((c) => [c.code, c.severite]), [['CONTACT_PROVISOIRE', 'erreur']]);
  });

  it('IN-07 : une page 404.html n’attend ni URL canonique ni entrée de sitemap ; une canonique y est refusée', () => {
    const avec404 = (html: string): Fichiers => ({ ...distPropre({}, { domaine: D }), '404.html': html });
    assert.deepEqual(checkDist(ecrireDist(avec404(page({ titre: 'Page introuvable' }))), { mode: 'production', domaine: D }), []);
    const canonique = checkDist(ecrireDist(avec404(page({ head: `<link rel="canonical" href="https://${D}/404.html">` }))), { mode: 'production', domaine: D });
    assert.deepEqual(canonique.map((c) => [c.code, c.fichier]), [['CANONIQUE_INCORRECT', '404.html']]);
    // une autre page d'erreur ou une page 404 dans un sous-dossier reste une page ordinaire
    const ailleurs = checkDist(ecrireDist({ ...distPropre({}, { domaine: D }), 'a/404.html': page() }), { mode: 'production', domaine: D });
    assert.ok(ailleurs.some((c) => c.code === 'CANONIQUE_ABSENT' && c.fichier === 'a/404.html'), JSON.stringify(ailleurs));
  });

  it('DOMAINE_PROVISOIRE sans option domaine : une fois par page de production dont l’URL canonique vise un hôte .invalid', () => {
    const dist = ecrireDist(distPropre({}, { domaine: 'exemple.invalid' }));
    const defaut = checkDist(dist, { mode: 'production' });
    assert.deepEqual(defaut.map((c) => [c.code, c.fichier, c.severite]), [
      ['DOMAINE_PROVISOIRE', 'index.html', 'avertissement'],
      ['DOMAINE_PROVISOIRE', 'themes/logement/index.html', 'avertissement'],
    ]);
    assert.deepEqual(new Set(checkDist(dist, { mode: 'production', deploiement: true }).map((c) => c.severite)), new Set(['erreur']));
  });

  it('option domaine invalide (schéma, port, chemin) : exception, jamais un contrôle silencieusement faux', () => {
    const dist = ecrireDist(distPropre({}, { domaine: D }));
    for (const domaine of [`https://${D}`, `${D}:8443`, `${D}/x`, '']) {
      assert.throws(() => checkDist(dist, { mode: 'production', domaine }), /domaine .* invalide/, domaine);
    }
  });
});

describe('checkDist : version.json (HEB-07, D-12) et types de fichiers du dist (HEB-08)', () => {
  const SHA = '0123456789abcdef0123456789abcdef01234567';
  const DATE = '2026-11-08T20:30:00.000Z';
  const versionJson = (v: unknown): string => `${JSON.stringify(v)}\n`;
  const avecVersion = (contenu: string | null, extra: Partial<OptionsCheckDist>): Resultat =>
    verifier(distPropre(contenu === null ? {} : { 'version.json': contenu }), 'production', { logement: 2 }, extra);

  it('sans l’option version, un dist sans version.json ne donne rien (règle opt-in, cas existants inchangés)', () => {
    assert.deepEqual(verifier(distPropre()).codes, []);
  });

  it('version: {} sans version.json : une seule erreur VERSION_ABSENTE sur version.json', () => {
    const dist = ecrireDist(distPropre());
    const constats = checkDist(dist, { mode: 'production', cellulesParTheme: { logement: 2 }, version: {} });
    assert.equal(constats.length, 1, JSON.stringify(constats));
    assert.equal(constats[0]?.code, 'VERSION_ABSENTE');
    assert.equal(constats[0]?.fichier, 'version.json');
    assert.equal(constats[0]?.severite, 'erreur');
  });

  it('version.json valide (commit de 40 hexadécimaux ou dev, date ISO UTC) : aucun constat', () => {
    assert.deepEqual(avecVersion(versionJson({ commit: SHA, date: DATE }), { version: {} }).codes, []);
    assert.deepEqual(avecVersion(versionJson({ commit: 'dev', date: DATE }), { version: {} }).codes, []);
    assert.deepEqual(avecVersion(versionJson({ date: '2026-11-08T20:30:00Z', commit: SHA }), { version: {} }).codes, []);
  });

  it('JSON invalide, clés en trop ou manquantes, commit ou date malformés : VERSION_INVALIDE', () => {
    const fautifs: Array<[string, string]> = [
      ['JSON invalide', '{"commit": "dev",'],
      ['tableau', versionJson([SHA, DATE])],
      ['null', 'null\n'],
      ['clé en trop', versionJson({ commit: SHA, date: DATE, hote: 'build-01' })],
      ['date manquante', versionJson({ commit: SHA })],
      ['commit manquant', versionJson({ date: DATE })],
      ['commit court', versionJson({ commit: SHA.slice(0, 7), date: DATE })],
      ['commit en majuscules', versionJson({ commit: SHA.toUpperCase(), date: DATE })],
      ['commit vide', versionJson({ commit: '', date: DATE })],
      ['commit numérique', versionJson({ commit: 1234, date: DATE })],
      ['date sans heure', versionJson({ commit: SHA, date: '2026-11-08' })],
      ['date non UTC', versionJson({ commit: SHA, date: '2026-11-08T21:30:00.000+01:00' })],
      ['date impossible', versionJson({ commit: SHA, date: '2026-13-40T25:00:00.000Z' })],
      ['date libre', versionJson({ commit: SHA, date: 'hier soir' })],
    ];
    for (const [nom, contenu] of fautifs) {
      const r = avecVersion(contenu, { version: {} });
      assert.deepEqual(r.codes, ['VERSION_INVALIDE'], `${nom} : ${r.messages.join(' | ')}`);
      assert.deepEqual(r.fichiers, ['version.json'], nom);
    }
  });

  it('commitAttendu : un autre commit donne VERSION_INVALIDE qui nomme les deux, le même ne donne rien', () => {
    const autre = 'f'.repeat(40);
    const r = avecVersion(versionJson({ commit: SHA, date: DATE }), { version: { commitAttendu: autre } });
    assert.deepEqual(r.codes, ['VERSION_INVALIDE']);
    assert.ok(r.messages[0]?.includes(SHA) && r.messages[0]?.includes(autre), r.messages.join(' | '));
    assert.deepEqual(avecVersion(versionJson({ commit: SHA, date: DATE }), { version: { commitAttendu: SHA } }).codes, []);
    assert.deepEqual(avecVersion(versionJson({ commit: 'dev', date: DATE }), { version: { commitAttendu: SHA } }).codes, ['VERSION_INVALIDE']);
  });

  it('commit dev : erreur VERSION_INVALIDE sous deploiement, rien sans', () => {
    const dev = versionJson({ commit: 'dev', date: DATE });
    const r = avecVersion(dev, { version: {}, deploiement: true });
    assert.deepEqual(r.codes, ['VERSION_INVALIDE']);
    assert.match(r.messages[0] ?? '', /RTP_DEPLOIEMENT=1/);
    assert.deepEqual(avecVersion(dev, { version: {}, deploiement: false }).codes, []);
    assert.deepEqual(avecVersion(versionJson({ commit: SHA, date: DATE }), { version: {}, deploiement: true }).codes, []);
  });

  it('typesAutorises : une erreur TYPE_FICHIER_INATTENDU par fichier d’un autre type ; sans l’option, rien', () => {
    const TYPES = ['.html', '.txt', '.xml', '.json'] as const;
    const r = verifier(distPropre(), 'production', { logement: 2 }, { typesAutorises: TYPES });
    assert.deepEqual(r.codes, ['TYPE_FICHIER_INATTENDU']);
    assert.deepEqual(r.fichiers, ['_astro/a.css', '_astro/n.js']);
    assert.match(r.messages[0] ?? '', /cache long/);
    assert.match(r.messages[0] ?? '', /Caddy/);
    const sansExtension = verifier({ ...distPropre(), CNAME: 'x' }, 'production', { logement: 2 }, { typesAutorises: ['.html', '.txt', '.xml', '.json', '.css', '.js'] });
    assert.deepEqual(sansExtension.fichiers, ['CNAME']);
    assert.deepEqual(verifier(distPropre()).codes, []);
  });

  it('TYPES_AUTORISES : html, txt, xml, json et ico (pour le seul favicon.ico)', () => {
    assert.deepEqual([...TYPES_AUTORISES], ['.html', '.txt', '.xml', '.json', '.ico']);
  });

  describe('favicon.ico (D-11) : une seule icône, à la racine, 4 096 octets au plus', () => {
    const icone = (n: number): Buffer => Buffer.alloc(n, 1);
    const avecTypes = (fichiers: Record<string, string | Buffer | null>): Resultat =>
      verifier(pourCli(distPropre(fichiers)), 'production', { logement: 2 }, { typesAutorises: TYPES_AUTORISES });

    it('accepte favicon.ico à la racine, jusqu’à 4 096 octets', () => {
      assert.deepEqual(avecTypes({ 'favicon.ico': icone(300) }).codes, []);
      assert.deepEqual(avecTypes({ 'favicon.ico': icone(LIMITES.favicon) }).codes, []);
    });

    it('un dist sans favicon.ico reste valide', () => {
      assert.deepEqual(avecTypes({}).codes, []);
    });

    it('refuse une icône ailleurs qu’à la racine ou d’un autre nom (TYPE_FICHIER_INATTENDU)', () => {
      for (const rel of ['img/favicon.ico', 'autre.ico', 'Favicon.ico']) {
        const r = avecTypes({ 'favicon.ico': icone(300), [rel]: icone(300) });
        assert.deepEqual(r.codes, ['TYPE_FICHIER_INATTENDU'], rel);
        assert.deepEqual(r.fichiers, [rel]);
        assert.match(r.messages[0] ?? '', /seul favicon\.ico à la racine du dist/);
      }
    });

    it('refuse une icône trop lourde (5 000 octets) en disant la limite', () => {
      const r = avecTypes({ 'favicon.ico': icone(5000) });
      assert.deepEqual(r.codes, ['TYPE_FICHIER_INATTENDU']);
      assert.deepEqual(r.fichiers, ['favicon.ico']);
      assert.match(r.messages[0] ?? '', /5000 octets \(limite 4096\)/);
    });

    it('sans .ico dans les types permis, favicon.ico reste un type inattendu', () => {
      const r = verifier(pourCli(distPropre({ 'favicon.ico': icone(300) })), 'production', { logement: 2 }, { typesAutorises: ['.html', '.txt', '.xml', '.json'] });
      assert.deepEqual(r.fichiers, ['favicon.ico']);
    });
  });
});

describe('FICHIER_NON_REGULIER (WR-06) : lien symbolique ou fichier spécial dans le dist', () => {
  const avec = (preparer: (dist: string) => void, mode: Mode = 'production'): Resultat & { constats: ReturnType<typeof checkDist> } => {
    const dist = ecrireDist(distPropre());
    preparer(dist);
    const constats = checkDist(dist, { mode, cellulesParTheme: new Map([['logement', 2]]) });
    return {
      constats,
      codes: [...new Set(constats.map((c) => c.code))].sort(),
      fichiers: constats.map((c) => c.fichier),
      messages: constats.map((c) => c.message),
    };
  };

  it('lien symbolique vers un fichier hors du dist : erreur, jamais suivi', () => {
    const r = avec((d) => fs.symlinkSync('/etc/hosts', path.join(d, 'x.txt')));
    assert.deepEqual(r.codes, ['FICHIER_NON_REGULIER']);
    assert.deepEqual(r.fichiers, ['x.txt']);
    assert.equal(r.constats[0]?.severite, 'erreur');
    assert.match(r.messages[0] ?? '', /lien symbolique/);
  });

  it('page .html en lien symbolique, et lien vers un dossier : signalés, non lus ni parcourus', () => {
    const r = avec((d) => {
      fs.mkdirSync(path.join(d, 'sous'), { recursive: true });
      fs.symlinkSync(path.join(d, 'index.html'), path.join(d, 'sous', 'copie.html'));
      fs.symlinkSync('/etc', path.join(d, 'etc'));
    });
    assert.deepEqual(r.codes, ['FICHIER_NON_REGULIER']);
    assert.deepEqual([...r.fichiers].sort(), ['etc', 'sous/copie.html']);
  });

  it('lien symbolique cassé : signalé', () => {
    const r = avec((d) => fs.symlinkSync('/nulle/part', path.join(d, 'casse.json')));
    assert.deepEqual(r.fichiers, ['casse.json']);
  });

  it('tube nommé (fifo) : signalé, en preview aussi', () => {
    for (const mode of ['production', 'preview'] as const) {
      const r = avec((d) => {
        const m = spawnSync('mkfifo', [path.join(d, 'tube')], { encoding: 'utf8' });
        assert.equal(m.status, 0, m.stderr);
      }, mode);
      assert.ok(r.codes.includes('FICHIER_NON_REGULIER'), mode);
      assert.ok(r.fichiers.includes('tube'), mode);
      assert.match(r.messages[r.fichiers.indexOf('tube')] ?? '', /tube nommé/);
    }
  });
});

describe('cellulesAttendues', () => {
  it('corpus-valide en production : le thème publié « logement » attend 2 cellules', () => {
    assert.deepEqual(cellulesAttendues(CORPUS, REPO_ROOT, 'production'), new Map([['logement', 2]]));
  });
});

describe('CLI scripts/check-dist.ts', () => {
  const lancer = (args: string[], env: Record<string, string> = {}) => {
    const propre: NodeJS.ProcessEnv = { ...process.env };
    delete propre.RTP_MODE;
    delete propre.RTP_CONTENT_ROOT;
    delete propre.RTP_DEPLOIEMENT;
    // En CI, GITHUB_SHA est défini : le CLI l'exigerait dans version.json. Chaque cas le pose explicitement.
    delete propre.GITHUB_SHA;
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, env: { ...propre, ...env }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  };

  it('dist propre : code 0 et une ligne de résumé (plus l’avertissement DOMAINE_PROVISOIRE tant que le domaine est provisoire)', () => {
    const dist = ecrireDist(distCli());
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 0, r.out + r.err);
    const lignes = r.out.trim().split('\n');
    if (SITE.domaineProvisoire) {
      assert.equal(lignes.length, 2, r.out);
      assert.match(lignes[0] ?? '', /^DOMAINE_PROVISOIRE \. : domaine provisoire \(TLD réservé/);
      assert.match(lignes[1] ?? '', /check-dist : 0 erreur\(s\), 1 avertissement/);
    } else {
      assert.equal(lignes.length, 1, r.out);
      assert.match(lignes[0] ?? '', /check-dist : 0 erreur\(s\), 0 avertissement/);
    }
  });

  it('HEB-05 : le CLI passe le domaine de config/site.yml (URL canonique d’un autre domaine : CANONIQUE_INCORRECT)', () => {
    const autre = ecrireDist(pourCli(distPropre({}, { domaine: DOMAINE_TEST })));
    const r = lancer(['--dist', autre, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /^CANONIQUE_INCORRECT index\.html : /m);
    assert.match(r.out, /^SITEMAP_INCOHERENT sitemap\.xml : /m);
    assert.match(r.out, /^ROBOTS_SANS_SITEMAP robots\.txt : /m);
  });

  it('HEB-06 : RTP_DEPLOIEMENT=1 sur un dist propre : code 1 et DOMAINE_PROVISOIRE tant que le domaine est provisoire', () => {
    const dist = ecrireDist(distCli());
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '1' });
    if (SITE.domaineProvisoire) {
      assert.equal(r.status, 1, r.out + r.err);
      assert.match(r.out, /^DOMAINE_PROVISOIRE \. : domaine provisoire \(TLD réservé/m);
      assert.match(r.out, /check-dist : 1 erreur\(s\)/);
      const gh = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production', '--format', 'github'], { RTP_DEPLOIEMENT: '1' });
      assert.match(gh.out, /^::error file=.*title=DOMAINE_PROVISOIRE::/m);
    } else {
      assert.doesNotMatch(r.out, /DOMAINE_PROVISOIRE/);
    }
  });

  it('dist fautif : code 1 et lignes « CODE chemin : message »', () => {
    const dist = ecrireDist(distCli({ 'index.html': page({ corps: '<img src="https://cdn.exemple.invalid/a.png" alt="">' }) }));
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /^RESSOURCE_TIERCE index\.html : .+$/m);
  });

  it('--format github : annotations ::error file=…::…', () => {
    const dist = ecrireDist(distCli({ 'index.html': page({ corps: '<p>extrême</p>' }) }));
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production', '--format', 'github']);
    assert.equal(r.status, 1);
    assert.match(r.out, /^::error file=.*index\.html.*title=MOT_INTERDIT::/m);
  });

  it('--format github (IN-03) : les erreurs passent avant les avertissements dans les 10 annotations', () => {
    const pages: Record<string, string> = {};
    for (let i = 1; i <= 11; i++) pages[`a${String(i).padStart(2, '0')}.html`] = page({ corps: '<a href="mailto:contact@exemple-provisoire.invalid">m</a>' });
    pages['z.html'] = page({ corps: '<p>extrême</p>' });
    const r = lancer(['--dist', ecrireDist(distCli(pages)), '--root', CORPUS, '--mode', 'production', '--format', 'github']);
    assert.equal(r.status, 1, r.out + r.err);
    const annotations = r.out.split('\n').filter((l) => l.startsWith('::'));
    assert.equal(annotations.length, 10, r.out);
    assert.match(annotations[0] ?? '', /^::error file=.*z\.html.*title=MOT_INTERDIT::/);
  });

  it('--mode invalide : code 2 et message de ModeInvalideError', () => {
    const dist = ecrireDist(distCli());
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'bidon']);
    assert.equal(r.status, 2);
    assert.match(r.err, /mode de validation inconnu/);
  });

  it('RTP_MODE=preview est lu quand --mode est absent', () => {
    const dist = ecrireDist(distCli());
    const r = lancer(['--dist', dist, '--root', CORPUS], { RTP_MODE: 'preview' });
    assert.equal(r.status, 1, 'un dist de production sans noindex est indexable en preview');
    assert.match(r.out, /PREVIEW_INDEXABLE/);
  });

  it('RTP_DEPLOIEMENT invalide (IN-06) : code 2 ; RTP_DEPLOIEMENT=1 rend CONTACT_PROVISOIRE bloquant', () => {
    const dist = ecrireDist(distCli({ 'index.html': page({ corps: '<a href="mailto:contact@exemple-provisoire.invalid">m</a>' }) }));
    const invalide = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: 'true' });
    assert.equal(invalide.status, 2, invalide.out + invalide.err);
    assert.match(invalide.err, /RTP_DEPLOIEMENT doit valoir 1/);
    assert.equal(lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '0' }).status, 0);
    assert.equal(lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '1' }).status, 1);
  });

  it('HEB-07 : GITHUB_SHA de 40 hexadécimaux est exigé dans version.json (autre commit : code 1, VERSION_INVALIDE)', () => {
    const dist = ecrireDist(distCli());
    const args = ['--dist', dist, '--root', CORPUS, '--mode', 'production'];
    const autre = lancer(args, { GITHUB_SHA: 'b'.repeat(40) });
    assert.equal(autre.status, 1, autre.out + autre.err);
    assert.match(autre.out, new RegExp(`^VERSION_INVALIDE version\\.json : .*${COMMIT_CLI}.*${'b'.repeat(40)}`, 'm'));
    assert.equal(lancer(args, { GITHUB_SHA: COMMIT_CLI }).status, 0);
    // une valeur qui n'est pas un commit complet n'est pas une attente (le build écrit alors dev)
    assert.equal(lancer(args, { GITHUB_SHA: 'main' }).status, 0);
  });

  it('HEB-07 : version.json absent (VERSION_ABSENTE) ou commit dev sous RTP_DEPLOIEMENT=1 (VERSION_INVALIDE) : code 1', () => {
    const { 'version.json': _retire, ...sansVersion } = distCli();
    const sans = lancer(['--dist', ecrireDist(sansVersion), '--root', CORPUS, '--mode', 'production']);
    assert.equal(sans.status, 1, sans.out + sans.err);
    assert.match(sans.out, /^VERSION_ABSENTE version\.json : /m);
    const dev = ecrireDist(distCli({ 'version.json': `${JSON.stringify({ commit: 'dev', date: '2026-11-08T20:30:00.000Z' })}\n` }));
    assert.equal(lancer(['--dist', dev, '--root', CORPUS, '--mode', 'production']).status, 0);
    const deploiement = lancer(['--dist', dev, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '1' });
    assert.equal(deploiement.status, 1, deploiement.out + deploiement.err);
    assert.match(deploiement.out, /^VERSION_INVALIDE version\.json : /m);
  });

  it('HEB-08 : un fichier hors html, txt, xml, json donne TYPE_FICHIER_INATTENDU (code 1)', () => {
    const dist = ecrireDist({ ...distCli(), 'police.woff2': Buffer.from([0, 1, 2]) });
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /^TYPE_FICHIER_INATTENDU police\.woff2 : /m);
  });

  it('D-11 : le CLI accepte favicon.ico à la racine et refuse img/favicon.ico (code 1)', () => {
    const ok = lancer(['--dist', ecrireDist({ ...distCli(), 'favicon.ico': Buffer.alloc(300, 1) }), '--root', CORPUS, '--mode', 'production']);
    assert.equal(ok.status, 0, ok.out + ok.err);
    const ko = lancer(['--dist', ecrireDist({ ...distCli(), 'img/favicon.ico': Buffer.alloc(300, 1) }), '--root', CORPUS, '--mode', 'production']);
    assert.equal(ko.status, 1, ko.out + ko.err);
    assert.match(ko.out, /^TYPE_FICHIER_INATTENDU img\/favicon\.ico : /m);
  });

  it('WR-06 : un lien symbolique dans le dist donne FICHIER_NON_REGULIER (code 1)', () => {
    const dist = ecrireDist(distCli());
    fs.symlinkSync('/etc/hosts', path.join(dist, 'hosts.txt'));
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /^FICHIER_NON_REGULIER hosts\.txt : /m);
  });

  it('dist introuvable : code 2', () => {
    const r = lancer(['--dist', path.join(os.tmpdir(), 'rtp-inexistant-dist'), '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 2);
  });
});
