// QUAL-01 : chaque règle du contrôle post-build est prouvée par injection de faute sur un dist
// synthétique (dossier temporaire, aucun `astro build` ici : seul tests/dist/site.test.ts en lance).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES_CHECK_DIST, LIMITES, cellulesAttendues, checkDist } from '../../scripts/lib/check-dist.ts';
import type { OptionsCheckDist } from '../../scripts/lib/check-dist.ts';
import { empreinteCsp } from '../../src/lib/csp-empreintes.ts';
import type { Mode } from '../../src/lib/content-core/rules/types.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const CLI = path.join(REPO_ROOT, 'scripts', 'check-dist.ts');
/** Texte exact de src/scripts/niveau.js : seul un script identique à une source est accepté en ligne. */
const NIVEAU = fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'niveau.js'), 'utf8');
const H_NIVEAU = `'${empreinteCsp(NIVEAU)}'`;

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

/** Dist synthétique propre : une page d'accueil, une page de thème à 2 cellules, un CSS, un script de 500 octets. */
function distPropre(surcharges: Record<string, string | Buffer | null> = {}, opts: { preview?: boolean } = {}): Fichiers {
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
  return base;
}

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
    assert.deepEqual(LIMITES, { brut: 500_000, gzip: 100_000, script: 2048 });
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
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps: '<a href="mailto:contact@domaine-a-definir.invalid?subject=S">m</a>' }) }));
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
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, env: { ...propre, ...env }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  };

  it('dist propre : code 0 et une ligne de résumé', () => {
    const dist = ecrireDist(distPropre());
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 0, r.out + r.err);
    const lignes = r.out.trim().split('\n');
    assert.equal(lignes.length, 1, r.out);
    assert.match(lignes[0] ?? '', /check-dist : .*0 erreur/);
  });

  it('dist fautif : code 1 et lignes « CODE chemin : message »', () => {
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps: '<img src="https://cdn.exemple.invalid/a.png" alt="">' }) }));
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out, /^RESSOURCE_TIERCE index\.html : .+$/m);
  });

  it('--format github : annotations ::error file=…::…', () => {
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps: '<p>extrême</p>' }) }));
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production', '--format', 'github']);
    assert.equal(r.status, 1);
    assert.match(r.out, /^::error file=.*index\.html.*title=MOT_INTERDIT::/m);
  });

  it('--format github (IN-03) : les erreurs passent avant les avertissements dans les 10 annotations', () => {
    const pages: Record<string, string> = {};
    for (let i = 1; i <= 11; i++) pages[`a${String(i).padStart(2, '0')}.html`] = page({ corps: '<a href="mailto:contact@domaine-a-definir.invalid">m</a>' });
    pages['z.html'] = page({ corps: '<p>extrême</p>' });
    const r = lancer(['--dist', ecrireDist(distPropre(pages)), '--root', CORPUS, '--mode', 'production', '--format', 'github']);
    assert.equal(r.status, 1, r.out + r.err);
    const annotations = r.out.split('\n').filter((l) => l.startsWith('::'));
    assert.equal(annotations.length, 10, r.out);
    assert.match(annotations[0] ?? '', /^::error file=.*z\.html.*title=MOT_INTERDIT::/);
  });

  it('--mode invalide : code 2 et message de ModeInvalideError', () => {
    const dist = ecrireDist(distPropre());
    const r = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'bidon']);
    assert.equal(r.status, 2);
    assert.match(r.err, /mode de validation inconnu/);
  });

  it('RTP_MODE=preview est lu quand --mode est absent', () => {
    const dist = ecrireDist(distPropre());
    const r = lancer(['--dist', dist, '--root', CORPUS], { RTP_MODE: 'preview' });
    assert.equal(r.status, 1, 'un dist de production sans noindex est indexable en preview');
    assert.match(r.out, /PREVIEW_INDEXABLE/);
  });

  it('RTP_DEPLOIEMENT invalide (IN-06) : code 2 ; RTP_DEPLOIEMENT=1 rend CONTACT_PROVISOIRE bloquant', () => {
    const dist = ecrireDist(distPropre({ 'index.html': page({ corps: '<a href="mailto:contact@domaine-a-definir.invalid">m</a>' }) }));
    const invalide = lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: 'true' });
    assert.equal(invalide.status, 2, invalide.out + invalide.err);
    assert.match(invalide.err, /RTP_DEPLOIEMENT doit valoir 1/);
    assert.equal(lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '0' }).status, 0);
    assert.equal(lancer(['--dist', dist, '--root', CORPUS, '--mode', 'production'], { RTP_DEPLOIEMENT: '1' }).status, 1);
  });

  it('dist introuvable : code 2', () => {
    const r = lancer(['--dist', path.join(os.tmpdir(), 'rtp-inexistant-dist'), '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 2);
  });
});
