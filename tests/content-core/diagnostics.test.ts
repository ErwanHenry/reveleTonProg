import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { escapeData, escapeProperty, formatGithub, formatText, safe } from '../../src/lib/content-core/diagnostics.ts';
import type { Diagnostic } from '../../src/lib/content-core/diagnostics.ts';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import { REPO_ROOT, SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

const FIXTURE_TEXT = readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'corpus-valide', 'src', 'content', 'candidats', 'marie-fictive.yaml'), 'utf8');
const FILE = path.join(REPO_ROOT, 'src', 'content', 'candidats', 'x.yaml');
const lines = (text: string): string[] => text.split('\n');

function run(text: string): Diagnostic[] {
  return validateYamlText('candidat', text, FILE, { schemasDir: SCHEMAS_DIR }).diagnostics;
}

describe('pointeur vers position', () => {
  it('propriété inconnue : ligne de sa clé', () => {
    const text = `${FIXTURE_TEXT}photo: https://exemple.invalid/p.jpg\n`;
    const d = run(text).find((x) => x.code === 'SCHEMA_UNEVALUATEDPROPERTIES');
    assert.ok(d);
    assert.equal(d.pointer, '/photo');
    assert.equal(lines(text)[d.line - 1]?.startsWith('photo:'), true);
    assert.equal(d.col, 1);
  });

  it('propriété obligatoire manquante : ligne de l’objet parent', () => {
    // statuts[1] (déclaré, relu) sans relecteur : l'objet commence à la ligne "- code: declare".
    const text = FIXTURE_TEXT.replace('    relecteur: Erwan Henry\n', '');
    const d = run(text).find((x) => x.code === 'SCHEMA_REQUIRED' && x.pointer === '/statuts/1');
    assert.ok(d);
    assert.match(lines(text)[d.line - 1] ?? '', /code: declare/);
  });

  it('URL invalide dans un mapping de flux : sa propre ligne et colonne', () => {
    const text = FIXTURE_TEXT.replace(
      /parti_source:\n(?: {2}.*\n)+/,
      'parti_source: { type: parti, url: http://x.invalid/a, date_consultation: 2026-10-20 }\n',
    );
    const d = run(text).find((x) => x.code === 'SCHEMA_FORMAT' && x.pointer === '/parti_source/url');
    assert.ok(d, JSON.stringify(run(text)));
    const line = lines(text)[d.line - 1] ?? '';
    assert.ok(line.startsWith('parti_source: {'));
    assert.equal(line.slice(d.col - 1, d.col - 1 + 3), 'url');
    assert.ok(d.col > 1);
  });
});

describe('formatText', () => {
  it('chemin relatif POSIX, position, code, message, pointeur', () => {
    const d: Diagnostic = { code: 'SCHEMA_REQUIRED', severity: 'error', file: path.join('/proj', 'src', 'content', 'candidats', 'a.yaml'), line: 3, col: 5, pointer: '/statuts', message: 'manque' };
    assert.equal(formatText(d, '/proj'), 'src/content/candidats/a.yaml:3:5 SCHEMA_REQUIRED manque (/statuts)');
  });
});

describe('échappement des commandes GitHub', () => {
  it('escapeData encode % \\r \\n', () => {
    assert.equal(escapeData('100% a\r\nb:c,d'), '100%25 a%0D%0Ab:c,d');
  });
  it('escapeProperty encode aussi : et ,', () => {
    assert.equal(escapeProperty('a:b,c%\n'), 'a%3Ab%2Cc%25%0A');
  });
});

describe('formatGithub', () => {
  const mk = (i: number, severity: 'error' | 'warning'): Diagnostic => ({
    code: 'SCHEMA_REQUIRED', severity, file: path.join('/proj', `f${i}.yaml`), line: i + 1, col: 2, pointer: '', message: `msg ${i}\nsuite`,
  });
  it('12 erreurs + 1 avertissement : 13 lignes de texte, 10 ::error, 1 ::warning', () => {
    const ds = [...Array.from({ length: 12 }, (_, i) => mk(i, 'error')), mk(99, 'warning')];
    const out = formatGithub(ds, '/proj');
    assert.equal(out.filter((l) => l.startsWith('::error ')).length, 10);
    assert.equal(out.filter((l) => l.startsWith('::warning ')).length, 1);
    assert.equal(out.filter((l) => !l.startsWith('::')).length, 13);
    assert.equal(out.length, 24);
    assert.equal(out.find((l) => l.startsWith('::error '))?.startsWith('::error file=f0.yaml,line=1,col=2,title=SCHEMA_REQUIRED::msg 0%0Asuite'), true);
  });
});

describe('neutralisation des caractères de contrôle (WR-01)', () => {
  it('safe remplace \n, \r, ESC, NEL et U+2028 par \\uXXXX, laisse les accents', () => {
    assert.equal(safe('a\nb\rc\u001bd\u0085e\u2028f é « »'), 'a\\u000ab\\u000dc\\u001bd\\u0085e\\u2028f é « »');
  });

  it('une clé YAML à retour à la ligne ne produit jamais une ligne de commande ::', () => {
    const text = `${FIXTURE_TEXT}"x\\n::warning title=PWNED::injected\\n::stop-commands::abc": 1\n`;
    const ds = run(text);
    assert.ok(ds.some((d) => d.message.includes('::warning title=PWNED::injected')), JSON.stringify(ds));
    const printed = ds.flatMap((d) => formatText(d, REPO_ROOT).split(/\r?\n/));
    assert.ok(printed.length === ds.length, 'un diagnostic = une seule ligne de texte');
    const github = formatGithub(ds, REPO_ROOT).flatMap((l) => l.split(/\r?\n/));
    // Seules les annotations légitimes (::error file=...) peuvent commencer par « :: ».
    assert.deepEqual(github.filter((l) => l.startsWith('::') && !l.startsWith('::error file=')), []);
  });
});
