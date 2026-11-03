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
import type { Mode } from '../../src/lib/content-core/rules/types.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide');
const CLI = path.join(REPO_ROOT, 'scripts', 'check-dist.ts');

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
}

function page(o: OptsPage = {}): string {
  const lang = o.lang === null ? '' : ` lang="${o.lang ?? 'fr'}"`;
  const h1 = Array.from({ length: o.h1 ?? 1 }, (_, i) => `<h1>Titre ${i + 1}</h1>`).join('');
  const robots = o.noindex ? '<meta name="robots" content="noindex, nofollow">' : '';
  return (
    `<!doctype html><html${lang}><head><meta charset="utf-8"><title>${o.titre ?? 'Page'}</title>${robots}` +
    `<link rel="stylesheet" href="/_astro/a.css">${o.head ?? ''}</head>` +
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

function verifier(fichiers: Fichiers, mode: Mode = 'production', cellules: Record<string, number> | null = { logement: 2 }): Resultat {
  const dist = ecrireDist(fichiers);
  const constats = checkDist(dist, cellules === null ? { mode } : { mode, cellulesParTheme: new Map(Object.entries(cellules)) });
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

  it('SCRIPT_EN_LIGNE : <script> sans src', () => {
    exactement('SCRIPT_EN_LIGNE', { 'index.html': page({ head: '<script>var a=1;</script>' }) });
  });

  it('SCRIPT_DATA_URI : script data:', () => {
    exactement('SCRIPT_DATA_URI', { 'index.html': page({ head: '<script src="data:text/javascript;base64,AAAA"></script>' }) });
  });

  it('SCRIPT_NON_BLOQUANT : type=module, async ou defer', () => {
    exactement('SCRIPT_NON_BLOQUANT', { 'index.html': page({ head: '<script src="/_astro/n.js" type="module"></script>' }) });
    exactement('SCRIPT_NON_BLOQUANT', { 'index.html': page({ head: '<script src="/_astro/n.js" async></script>' }) });
    exactement('SCRIPT_NON_BLOQUANT', { 'index.html': page({ head: '<script src="/_astro/n.js" defer></script>' }) });
  });

  it('STYLE_EN_LIGNE : <style> ou attribut style', () => {
    exactement('STYLE_EN_LIGNE', { 'index.html': page({ head: '<style>p{color:red}</style>' }) });
    exactement('STYLE_EN_LIGNE', { 'index.html': page({ corps: '<p style="color:red">x</p>' }) });
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
    // un .js lié n'est pas du texte visible ; un script inline est déjà SCRIPT_EN_LIGNE
    const r = verifier(distPropre({ 'index.html': page({ head: '<script>var extrême=1;</script>' }) }));
    assert.deepEqual(r.codes, ['SCRIPT_EN_LIGNE']);
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

  it('dist introuvable : code 2', () => {
    const r = lancer(['--dist', path.join(os.tmpdir(), 'rtp-inexistant-dist'), '--root', CORPUS, '--mode', 'production']);
    assert.equal(r.status, 2);
  });
});
