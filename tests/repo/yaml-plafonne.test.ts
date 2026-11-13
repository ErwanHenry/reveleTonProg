// IMP-01 (D-03) : aucune lecture YAML directe dans le code livré. Tout script qui lit un fichier YAML du dépôt
// passe par src/lib/content-core/yaml-plafonne.ts (alias refusés, clés en double refusées, fichier, ligne et
// code dans le message). Ce test refuse tout import de `parse`, `parseDocument`, `parseAllDocuments` ou
// `Document` (valeur) depuis 'yaml' hors d'une liste blanche de huit fichiers, chacun avec sa raison :
// - src/lib/content-core/yaml-plafonne.ts : l'analyseur plafonné léger lui-même, gardé équivalent à load.ts par test ;
// - src/lib/content-core/load.ts : l'analyseur de content-core (PARSE_OPTIONS, parseYaml) ;
// - src/lib/content-core/migrate.ts : content-core, mêmes PARSE_OPTIONS, réécrit par positions ;
// - scripts/lib/relecture/editer.ts : éditeur par positions de nœuds, importe PARSE_OPTIONS, refuse tout alias ;
// - src/lib/site-config.ts, src/lib/hebergeur-config.ts, src/lib/publication-config.ts, src/lib/dataset-datagouv.ts :
//   lecteurs de configuration chargés par astro.config.mjs ou la CI, avec leur propre plafond (alias refusés,
//   uniqueKeys, merge false) ; les faire passer par load.ts ferait entrer ajv et les règles dans ce chemin.
//
// Formes détectées (chacune par un auto-contrôle) : import nommé (guillemets simples ou doubles, renommage `as`,
// sur plusieurs lignes), tout sous-chemin `yaml/…`, ré-export (`export { parse } from`, `export * from`), import
// par défaut, import d'espace de noms, `require('yaml')`, `import('yaml')` dynamique. Depuis WR-09 (revue de la
// phase 10) : l'analyseur bas niveau (`Parser`, `Composer`, `Lexer`, `parseCST`), tout paquet dont le nom finit
// par `/yaml` ou contient `yaml` (`@astrojs/internal-helpers/yaml`, `js-yaml`, sauf `yaml-lint`), tout appel avec
// un spécificateur YAML littéral (`createRequire(import.meta.url)('yaml')`), toute mention de `createRequire`,
// et les extensions .mts, .cts, .cjs, .tsx, .jsx. Les exports de valeur des huit fichiers de la liste blanche sont
// épinglés : une enveloppe générique nouvelle ne passe pas sans relecture.
// Non détecté (voulu) : `import type`, `stringify`, `isMap`, `visit` et les autres utilitaires sans lecture, une
// fonction locale nommée `parse` (scripts/lib/fetch-safe.ts), le mot parse dans un commentaire.
// Hors périmètre : tests/** (les tests lisent des fixtures de confiance avec `parse`).
//
// Le graphe d'import de la page Méthode est figé : src/pages/methode.astro importe scripts/lib/couverture.ts, dont
// la fermeture des imports relatifs (valeurs seulement) est épinglée. Elle ne doit contenir ni load.ts, ni ajv.ts,
// ni le moteur de règles (rules/index.ts, rules/corpus.ts) : la build de la page reste légère.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LISTE_BLANCHE: Readonly<Record<string, string>> = Object.freeze({
  'src/lib/content-core/yaml-plafonne.ts': 'analyseur plafonné léger des scripts, gardé équivalent à parseYaml de load.ts par tests/content-core/yaml-plafonne.test.ts',
  'src/lib/content-core/load.ts': 'analyseur de content-core : définit PARSE_OPTIONS et parseYaml (le plafond lui-même)',
  'src/lib/content-core/migrate.ts': 'content-core : mêmes PARSE_OPTIONS, réécrit les fichiers par positions de nœuds',
  'scripts/lib/relecture/editer.ts': 'éditeur de relecture par positions de nœuds : importe PARSE_OPTIONS et refuse tout alias',
  'src/lib/site-config.ts': 'lecteur de config/site.yml chargé par astro.config.mjs, plafond propre (alias refusés, uniqueKeys, merge false)',
  'src/lib/hebergeur-config.ts': 'lecteur de config/hebergeur.yml, plafond propre (alias refusés, uniqueKeys, merge false)',
  'src/lib/publication-config.ts': 'lecteur de config/publication.yml, plafond propre (alias refusés, uniqueKeys, merge false)',
  'src/lib/dataset-datagouv.ts': 'lecteur de data/dataset-datagouv.yaml, plafond propre (alias refusés, uniqueKeys, merge false)',
});

export interface LectureYamlDirecte {
  chemin: string;
  ligne: number;
  api: string;
}

/**
 * Texte dont les commentaires sont remplacés par des espaces (sauts de ligne gardés, donc numéros de ligne
 * inchangés). Chaînes et littéraux d'expression régulière sont suivis pour qu'un « // » dans une URL ou un « /* »
 * dans un motif de fichiers ne soit pas pris pour un commentaire. Une chaîne ' ou " s'arrête en fin de ligne
 * (repli prudent dans le texte HTML d'un fichier .astro).
 */
export function sansCommentaires(texte: string): string {
  const out = texte.split('');
  let i = 0;
  let precedent = ''; // dernier caractère significatif hors commentaire
  const avantRegex = '(,=:[!&|?{};+-*%<>~^';
  while (i < texte.length) {
    const c = texte[i] as string;
    const d = texte[i + 1];
    if (c === '/' && d === '/') {
      while (i < texte.length && texte[i] !== '\n') out[i++] = ' ';
      continue;
    }
    if (c === '/' && d === '*') {
      out[i++] = ' ';
      out[i++] = ' ';
      while (i < texte.length && !(texte[i] === '*' && texte[i + 1] === '/')) {
        if (texte[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < texte.length) {
        out[i++] = ' ';
        out[i++] = ' ';
      }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < texte.length && texte[i] !== c) {
        if (c !== '`' && texte[i] === '\n') break;
        i += texte[i] === '\\' ? 2 : 1;
      }
      i++;
      precedent = c;
      continue;
    }
    if (c === '/' && (precedent === '' || avantRegex.includes(precedent))) {
      let j = i + 1;
      let classe = false;
      while (j < texte.length && texte[j] !== '\n') {
        const e = texte[j];
        if (e === '\\') j += 2;
        else {
          if (e === '[') classe = true;
          else if (e === ']') classe = false;
          else if (e === '/' && !classe) break;
          j++;
        }
      }
      if (j < texte.length && texte[j] === '/') {
        i = j + 1;
        precedent = '/';
        continue;
      }
    }
    if (!/\s/.test(c)) precedent = c;
    i++;
  }
  return out.join('');
}

const API_LECTURE = new Set(['parse', 'parseDocument', 'parseAllDocuments', 'Document', 'Parser', 'Composer', 'Lexer', 'parseCST']);
/** Paquets dont le nom contient « yaml » mais qui ne lisent pas de YAML en valeur (aucun aujourd'hui dans le code livré). */
const PAQUETS_YAML_PERMIS = new Set(['yaml-lint']);

/**
 * Vrai pour un spécificateur de paquet qui lit du YAML hors de l'API filtrée de « yaml » : sous-chemin `yaml/…`,
 * enveloppe d'un autre paquet (`…/yaml`, comme `@astrojs/internal-helpers/yaml`), ou autre analyseur (`js-yaml`).
 * Jamais un chemin relatif (l'analyseur plafonné s'importe par `./…/yaml-plafonne.ts`) ni un module `node:`.
 */
function moduleYamlLarge(spec: string): boolean {
  if (spec === 'yaml' || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || PAQUETS_YAML_PERMIS.has(spec)) return false;
  return /(^|[/@-])yaml($|[/.-])/i.test(spec);
}
const ligneDe = (texte: string, index: number): number => texte.slice(0, index).split('\n').length;

/** Noms lus dans une clause d'import ou de ré-export (`X`, `{ a, b as c }`, `* as Y`, `*`). */
function apisDeClause(clause: string, exporte: boolean): string[] {
  const c = clause.trim();
  if (c.startsWith('type ') || c === 'type') return [];
  const m = /^(?:([\w$]+)\s*(?:,|$))?\s*(?:\*(?:\s*as\s+([\w$]+))?|\{([^}]*)\})?\s*$/.exec(c);
  if (m === null) return [];
  const apis: string[] = [];
  if (m[1] !== undefined) apis.push(`défaut ${m[1]}`);
  if (c.includes('*')) apis.push(exporte ? (m[2] !== undefined ? `export * as ${m[2]}` : 'export *') : `* as ${m[2] ?? ''}`);
  for (const spec of (m[3] ?? '').split(',')) {
    const s = spec.trim();
    if (s === '' || s.startsWith('type ')) continue;
    const nom = (s.split(/\s+as\s+/)[0] ?? '').trim();
    if (API_LECTURE.has(nom)) apis.push(nom);
  }
  return apis;
}

/** Imports de lecture YAML directe : `parse`, `parseDocument`, `parseAllDocuments`, `Document` (valeur), et toute forme large. */
export function trouverLecturesYamlDirectes(fichiers: { chemin: string; contenu: string }[]): LectureYamlDirecte[] {
  const out: LectureYamlDirecte[] = [];
  for (const { chemin, contenu } of fichiers) {
    const t = sansCommentaires(contenu);
    const trouves: { index: number; api: string }[] = [];
    const statique = /(^|[^.\w$])(import|export)\s+(type\s+)?([\w$\s,{}*]*?)\s*\bfrom\s*(['"])([^'"\n]+)\5/g;
    for (const m of t.matchAll(statique)) {
      if (m[3] !== undefined) continue;
      const index = (m.index ?? 0) + (m[1] ?? '').length;
      const module = m[6] as string;
      if (module === 'yaml') {
        for (const api of apisDeClause(m[4] ?? '', m[2] === 'export')) trouves.push({ index, api });
      } else if (moduleYamlLarge(module)) {
        if ((m[4] ?? '').trim().startsWith('type ')) continue;
        trouves.push({ index, api: module });
      }
    }
    const appel = /(^|[^.\w$])(require|import)\s*\(\s*(['"`])([^'"`\n]+)\3\s*\)/g;
    for (const m of t.matchAll(appel)) {
      const module = m[4] as string;
      if (module === 'yaml' || moduleYamlLarge(module)) trouves.push({ index: (m.index ?? 0) + (m[1] ?? '').length, api: `${m[2]}('${module}')` });
    }
    // WR-09 : tout autre appel avec un spécificateur YAML littéral (un require obtenu par createRequire, ou renommé).
    const autreAppel = /([\w$]+|\))\s*\(\s*(['"`])([^'"`\n]+)\2\s*\)/g;
    for (const m of t.matchAll(autreAppel)) {
      const module = m[3] as string;
      if (m[1] === 'require' || m[1] === 'import') continue;
      if (module === 'yaml' || module.startsWith('yaml/') || moduleYamlLarge(module)) trouves.push({ index: (m.index ?? 0) + (m[1] ?? '').length, api: `appel('${module}')` });
    }
    // WR-09 : createRequire permet un require('yaml') que rien d'autre ne verrait (spécificateur calculé) : signalé tel quel.
    const cr = /(^|[^.\w$])createRequire\b/.exec(t);
    if (cr !== null) trouves.push({ index: cr.index + (cr[1] ?? '').length, api: 'createRequire' });
    for (const f of trouves.sort((a, b) => a.index - b.index)) out.push({ chemin, ligne: ligneDe(t, f.index), api: f.api });
  }
  return out;
}

/** Fermeture des imports relatifs (valeurs seulement, `import type` et `export type` ignorés), triée. */
export function fermetureImports(depart: string, lire: (chemin: string) => string | undefined): string[] {
  const vus = new Set<string>();
  const pile = [depart];
  while (pile.length > 0) {
    const courant = pile.pop() as string;
    if (vus.has(courant)) continue;
    const contenu = lire(courant);
    if (contenu === undefined) throw new Error(`import introuvable : ${courant}`);
    vus.add(courant);
    const t = sansCommentaires(contenu);
    const cibles: string[] = [];
    for (const m of t.matchAll(/(^|[^.\w$])(?:import|export)\s+(type\s+)?([\w$\s,{}*]*?)\s*\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\4/g)) {
      if (m[2] === undefined && !(m[3] ?? '').trim().startsWith('type ')) cibles.push(m[5] as string);
    }
    for (const m of t.matchAll(/(^|[^.\w$])import\s*(['"])(\.{1,2}\/[^'"]+)\2/g)) cibles.push(m[3] as string);
    for (const c of cibles) pile.push(path.posix.normalize(path.posix.join(path.posix.dirname(courant), c)));
  }
  return [...vus].sort();
}

const un = (contenu: string): LectureYamlDirecte[] => trouverLecturesYamlDirectes([{ chemin: 'x.ts', contenu }]);

describe('trouverLecturesYamlDirectes : formes détectées', () => {
  const detectes: [string, string, string][] = [
    ['import nommé, guillemets simples', "import { parse } from 'yaml';\n", 'parse'],
    ['import nommé, guillemets doubles', 'import { parseDocument } from "yaml";\n', 'parseDocument'],
    ['parseAllDocuments', "import { parseAllDocuments } from 'yaml';\n", 'parseAllDocuments'],
    ['Document en valeur', "import { Document, isMap } from 'yaml';\n", 'Document'],
    ['renommage as', "import { parse as parseYamlText } from 'yaml';\n", 'parse'],
    ['import sur plusieurs lignes', "import {\n  isSeq,\n  parseDocument,\n  stringify,\n} from 'yaml';\n", 'parseDocument'],
    ['sous-chemin yaml/…', "import { stringify } from 'yaml/dist/index.js';\n", 'yaml/dist/index.js'],
    ['ré-export nommé', "export { parse } from 'yaml';\n", 'parse'],
    ['ré-export étoile', "export * from 'yaml';\n", 'export *'],
    ['import par défaut', "import YAML from 'yaml';\n", 'défaut YAML'],
    ['espace de noms', "import * as Y from 'yaml';\n", '* as Y'],
    ['require', "const y = require('yaml');\n", "require('yaml')"],
    ['import dynamique', "const y = import('yaml');\n", "import('yaml')"],
    ['await import guillemets doubles', 'const { parse } = await import("yaml");\n', "import('yaml')"],
    // WR-09 (revue de la phase 10) : analyseur bas niveau, enveloppes d'autres paquets, extensions de module.
    ['Parser (analyseur bas niveau)', "import { Parser } from 'yaml';\n", 'Parser'],
    ['Composer', "import { Composer, isMap } from 'yaml';\n", 'Composer'],
    ['Lexer', "import { Lexer } from 'yaml';\n", 'Lexer'],
    ['parseCST (ancienne API)', "import { parseCST } from 'yaml';\n", 'parseCST'],
    ['enveloppe @astrojs/internal-helpers/yaml', "import { parseFrontmatter } from '@astrojs/internal-helpers/yaml';\n", '@astrojs/internal-helpers/yaml'],
    ['autre analyseur YAML (js-yaml)', "import jsyaml from 'js-yaml';\n", 'js-yaml'],
    ['require d’une enveloppe', "const h = require('@astrojs/internal-helpers/yaml');\n", "require('@astrojs/internal-helpers/yaml')"],
    ['appel d’un require obtenu ailleurs', "const y = req('yaml');\n", "appel('yaml')"],
  ];
  for (const [nom, contenu, api] of detectes) {
    it(nom, () => {
      const r = un(contenu);
      assert.equal(r.length, 1, JSON.stringify(r));
      assert.equal(r[0]?.api, api);
      assert.equal(r[0]?.chemin, 'x.ts');
    });
  }

  it('createRequire : l’import de createRequire et l’appel avec « yaml » sont signalés', () => {
    const r = un("import { createRequire } from 'node:module';\nconst y = createRequire(import.meta.url)('yaml');\n");
    assert.deepEqual(
      r.map((x) => [x.ligne, x.api]),
      [
        [1, 'createRequire'],
        [2, "appel('yaml')"],
      ],
    );
    assert.deepEqual(un("const { createRequire } = require('module');\n").map((x) => x.api), ['createRequire']);
  });

  it('ligne de l’import, après d’autres lignes et un autre import', () => {
    const r = un("import path from 'node:path';\n// commentaire\n\nimport { isMap, parse } from 'yaml';\n");
    assert.deepEqual(r, [{ chemin: 'x.ts', ligne: 4, api: 'parse' }]);
  });

  it('extrait de scripts/import-datagouv.ts avant la migration (commit 55ea155) : signalé', () => {
    const extrait = [
      "import { createHash } from 'node:crypto';",
      "import path from 'node:path';",
      "import { parseArgs } from 'node:util';",
      "import { parse } from 'yaml';",
      "import { IDS_LOCK, ajouterIds, lireIdsLock } from '../src/lib/content-core/ids-lock.ts';",
      "import type { IdsLock } from '../src/lib/content-core/ids-lock.ts';",
      "  table = lireCorrespondances(parse(corrLue.text, { schema: 'core', uniqueKeys: true }));",
    ].join('\n');
    assert.deepEqual(trouverLecturesYamlDirectes([{ chemin: 'scripts/import-datagouv.ts', contenu: extrait }]), [
      { chemin: 'scripts/import-datagouv.ts', ligne: 4, api: 'parse' },
    ]);
  });
});

describe('trouverLecturesYamlDirectes : formes non détectées', () => {
  const ignores: [string, string][] = [
    ['import type { Document }', "import type { Document } from 'yaml';\n"],
    ['import { type Document } (spécificateur de type)', "import { type Document, isSeq } from 'yaml';\n"],
    ['stringify seul', "import { stringify } from 'yaml';\n"],
    ['isMap et visit', "import { isMap, visit } from 'yaml';\n"],
    ['fonction locale parse', "function parse(s: string): number[] { return []; }\nconst ip = parse('::1');\n"],
    ['le mot parse dans un commentaire', "// on parse le YAML avec parseDocument de 'yaml'\n/* import { parse } from 'yaml' */\nconst a = 1;\n"],
    ['autre paquet nommé yaml-…', "import { parse } from 'yaml-lint';\n"],
    ['export type', "export type { Document } from 'yaml';\n"],
    ['l’analyseur plafonné lui-même, par chemin relatif', "import { lireYamlPlafonne } from '../src/lib/content-core/yaml-plafonne.ts';\n"],
    ['LineCounter seul (positions, aucune lecture)', "import { LineCounter, isSeq } from 'yaml';\n"],
    ['un module node: qui n’est pas createRequire', "import { builtinModules } from 'node:module';\n"],
  ];
  for (const [nom, contenu] of ignores) {
    it(nom, () => assert.deepEqual(un(contenu), []));
  }
});

describe('fermetureImports : résolveur des imports relatifs (valeurs seulement)', () => {
  it('suit import et export relatifs, ignore import type et les paquets', () => {
    const fichiers: Record<string, string> = {
      'a/b.ts': "import { x } from './c.ts';\nimport type { T } from '../t.ts';\nimport { y } from 'yaml';\nexport { z } from '../d/e.ts';\n",
      'a/c.ts': "import {\n  w,\n} from '../d/e.ts';\n",
      'd/e.ts': 'export const z = 1;\n',
      't.ts': "import { lourd } from './lourd.ts';\n",
    };
    assert.deepEqual(fermetureImports('a/b.ts', (c) => fichiers[c]), ['a/b.ts', 'a/c.ts', 'd/e.ts']);
  });

  it('un fichier introuvable est une erreur', () => {
    assert.throws(() => fermetureImports('a.ts', (c) => (c === 'a.ts' ? "import './absent.ts';\n" : undefined)), /absent\.ts/);
  });
});

/** Vrai pour un fichier de code livré : sous scripts/, src/, e2e/, ou astro.config.*, toute extension de module JS ou TS. */
export function estCodeLivre(f: string): boolean {
  return (/^(scripts|src|e2e)\//.test(f) || /^astro\.config\.[cm]?[jt]s$/.test(f)) && /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx|astro)$/.test(f);
}

/** Fichiers suivis par Git que estCodeLivre retient. */
function codeLivre(): { chemin: string; contenu: string }[] {
  const git = spawnSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  return git.stdout
    .split('\u0000')
    .filter(estCodeLivre)
    .filter((f) => fs.existsSync(path.join(REPO, f)))
    .map((chemin) => ({ chemin, contenu: fs.readFileSync(path.join(REPO, chemin), 'utf8') }));
}

describe('estCodeLivre : extensions et dossiers balayés (WR-09)', () => {
  it('toutes les extensions de module JS et TS, sous scripts/, src/, e2e/, et astro.config', () => {
    for (const f of ['scripts/a.ts', 'scripts/a.mts', 'scripts/a.cts', 'src/a.tsx', 'src/a.js', 'src/a.mjs', 'src/a.cjs', 'e2e/a.jsx', 'src/pages/a.astro', 'astro.config.mjs', 'astro.config.ts']) {
      assert.ok(estCodeLivre(f), f);
    }
    for (const f of ['tests/a.ts', 'docs/a.md', 'src/a.yaml', 'scripts/a.json', 'node_modules/yaml/a.js']) assert.ok(!estCodeLivre(f), f);
  });
});

/**
 * WR-09 : un fichier de la liste blanche pourrait exporter une enveloppe générique (texte -> Document ou objet) que
 * le reste du code appellerait sans être vu. Les exports de valeur de chaque fichier sont épinglés : un export
 * nouveau demande une relecture (est-ce une lecture YAML générique ?) et la mise à jour de cette liste.
 */
const EXPORTS_LISTE_BLANCHE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'src/lib/content-core/yaml-plafonne.ts': ['YamlRefuse', 'analyserYamlPlafonne', 'lireDocumentPlafonne', 'lireYamlPlafonne', 'messageRefus'],
  'src/lib/content-core/load.ts': ['PARSE_OPTIONS', 'TO_JS_OPTIONS', 'checkContained', 'listContentFiles', 'loadAll', 'parseYaml', 'readContained', 'validateYamlText'],
  'src/lib/content-core/migrate.ts': ['TO_STRING_OPTS', 'inspectVersions', 'migrateText', 'runMigrations'],
  'scripts/lib/relecture/editer.ts': [
    'CLES_ECRIVIBLES',
    'ETATS_CASE',
    'EditionRefusee',
    'RE_DATE',
    'RE_RELECTEUR',
    'RE_SLUG',
    'STATUTS_RELECTURE',
    'comparerLignes',
    'dateValide',
    'definirChamps',
    'ecrireAtomique',
    'relecteurValide',
    'verifierSeulesCles',
  ],
  'src/lib/site-config.ts': ['TLD_PROVISOIRES', 'estDomaineValide', 'estHoteProvisoire', 'loadSiteConfig'],
  'src/lib/hebergeur-config.ts': ['loadHebergeurConfig'],
  'src/lib/publication-config.ts': ['estOuvert', 'loadPublicationConfig'],
  'src/lib/dataset-datagouv.ts': ['ecartAnnonce', 'loadDatasetDatagouv'],
});

/** Noms exportés en valeur (fonction, classe, constante, ré-export nommé) ; `export type` et `export interface` ignorés. */
export function exportsDeValeur(contenu: string): string[] {
  const t = sansCommentaires(contenu);
  const noms = new Set<string>();
  for (const m of t.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/gm)) noms.add(m[1] as string);
  for (const m of t.matchAll(/^export\s+\{([^}]*)\}/gm)) {
    for (const spec of (m[1] ?? '').split(',')) {
      const s = spec.trim();
      if (s === '' || s.startsWith('type ')) continue;
      noms.add((s.split(/\s+as\s+/)[1] ?? s).trim());
    }
  }
  if (/^export\s+\*/m.test(t)) noms.add('*');
  if (/^export\s+default\b(?!\s+(?:async\s+)?(?:function|class)\s+[\w$])/m.test(t)) noms.add('default');
  return [...noms].sort();
}

describe('exportsDeValeur : auto-contrôle (WR-09)', () => {
  it('fonctions, classes, constantes, ré-exports nommés, étoile et défaut ; jamais les types', () => {
    const texte = [
      'export function a() {}',
      'export async function b() {}',
      'export class C {}',
      'export const D = 1;',
      "export { e, f as g, type H } from './x.ts';",
      "export * from './y.ts';",
      'export default 3;',
      'export type T = string;',
      'export interface I { x: number }',
      '// export function commentee() {}',
    ].join('\n');
    assert.deepEqual(exportsDeValeur(texte), ['*', 'C', 'D', 'a', 'b', 'default', 'e', 'g']);
  });
});

describe('dépôt réel (IMP-01, D-03)', () => {
  it('aucune lecture YAML directe dans le code livré hors LISTE_BLANCHE', () => {
    const fichiers = codeLivre();
    assert.ok(fichiers.length > 50, `trop peu de fichiers lus : ${fichiers.length}`);
    assert.ok(fichiers.some((f) => f.chemin === 'scripts/import-datagouv.ts'));
    const trouves = trouverLecturesYamlDirectes(fichiers.filter((f) => !Object.hasOwn(LISTE_BLANCHE, f.chemin)));
    assert.deepEqual(
      trouves,
      [],
      `lecture YAML directe :\n${trouves.map((t) => `  ${t.chemin}:${t.ligne} ${t.api}`).join('\n')}\n` +
        'passer par src/lib/content-core/yaml-plafonne.ts, ou ajouter le fichier à LISTE_BLANCHE avec sa raison (décision relue, pas un contournement)',
    );
  });

  it('LISTE_BLANCHE : huit entrées, chacune existe et lit encore le YAML directement', () => {
    assert.equal(Object.keys(LISTE_BLANCHE).length, 8);
    for (const [chemin, raison] of Object.entries(LISTE_BLANCHE)) {
      assert.ok(raison.length > 20, `${chemin} : raison absente`);
      const abs = path.join(REPO, chemin);
      assert.ok(fs.existsSync(abs), `entrée de liste blanche périmée : ${chemin} n'existe plus`);
      const r = trouverLecturesYamlDirectes([{ chemin, contenu: fs.readFileSync(abs, 'utf8') }]);
      assert.ok(r.length > 0, `entrée de liste blanche périmée : ${chemin} ne lit plus le YAML directement`);
    }
  });

  it('WR-09 : les fichiers de la liste blanche n’exportent que les valeurs épinglées (aucune enveloppe de lecture nouvelle)', () => {
    assert.deepEqual(Object.keys(EXPORTS_LISTE_BLANCHE).sort(), Object.keys(LISTE_BLANCHE).sort());
    for (const [chemin, attendus] of Object.entries(EXPORTS_LISTE_BLANCHE)) {
      assert.deepEqual(exportsDeValeur(fs.readFileSync(path.join(REPO, chemin), 'utf8')), [...attendus].sort(), `${chemin} : export nouveau ou retiré, relire puis mettre à jour EXPORTS_LISTE_BLANCHE`);
    }
  });

  it('graphe d’import de la page Méthode : scripts/lib/couverture.ts ne tire que des modules légers', () => {
    const methode = fs.readFileSync(path.join(REPO, 'src', 'pages', 'methode.astro'), 'utf8');
    assert.match(methode, /from ['"]\.\.\/\.\.\/scripts\/lib\/couverture\.ts['"]/);
    const lire = (c: string): string | undefined => {
      const abs = path.join(REPO, c);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : undefined;
    };
    const fermeture = fermetureImports('scripts/lib/couverture.ts', lire);
    // Fermeture d'avant 10-01 (scripts/lib/couverture.ts, rules/config.ts, rules/text/normalize.ts) plus yaml-plafonne.ts.
    assert.deepEqual(fermeture, [
      'scripts/lib/couverture.ts',
      'src/lib/content-core/rules/config.ts',
      'src/lib/content-core/rules/text/normalize.ts',
      'src/lib/content-core/yaml-plafonne.ts',
    ]);
    for (const lourd of ['src/lib/content-core/load.ts', 'src/lib/content-core/ajv.ts', 'src/lib/content-core/rules/index.ts', 'src/lib/content-core/rules/corpus.ts']) {
      assert.ok(!fermeture.includes(lourd), lourd);
    }
  });
});
