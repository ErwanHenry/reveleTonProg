import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTS_CLES_DEFAUT, THEMES_SPEC, scanner } from '../../scripts/lib/couverture.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE_ROOT = 'tests/fixtures/corpus-valide';
const ESTIMATION = 'tests/fixtures/couverture/estimation-2026-11-03.yaml';

const tmpDirs: string[] = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function cli(args: string[]): { status: number | null; stdout: string; stderr: string; tout: string } {
  const res = spawnSync(process.execPath, ['scripts/couverture-scan.ts', ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, tout: res.stdout + res.stderr };
}

describe('MOTS_CLES_DEFAUT', () => {
  it('couvre les 10 thèmes de la spec avec des radicaux français', () => {
    for (const t of THEMES_SPEC) assert.ok((MOTS_CLES_DEFAUT[t.id] ?? []).length >= 4, `mots-clés de ${t.id}`);
    assert.ok(MOTS_CLES_DEFAUT.retraites?.includes('retraite'));
    assert.ok(MOTS_CLES_DEFAUT.impots?.includes('csg'));
    assert.ok(MOTS_CLES_DEFAUT.institutions?.includes('49.3'));
  });
});

describe('scanner', () => {
  const themes = (id: string, mots: string[]) => [{ id, mots_cles: mots }];

  it('apparie un mot-clé comme préfixe de mot : retrait ~ retraites, pas portrait', () => {
    const r = scanner('Les retraites seront revalorisées. Un portrait du candidat.', themes('retraites', ['retrait']))[0]!;
    assert.equal(r.hits, 1);
    assert.match(r.extraits[0]!.texte, /retraites/);
  });

  it('ignore les accents et la casse', () => {
    const r = scanner('IMPÔT sur la fortune ; l’impot unique ; Impôts locaux', themes('impots', ['impôt']))[0]!;
    assert.equal(r.hits, 3);
  });

  it('un mot-clé court (3 lettres ou moins) doit être un mot entier', () => {
    const r = scanner('Un ric citoyen. Une richesse. Le RIC.', themes('institutions', ['ric']))[0]!;
    assert.equal(r.hits, 2);
  });

  it('apparie une expression de plusieurs mots et 49.3', () => {
    const r = scanner('Fixer l’âge de départ à 62 ans. Supprimer le 49.3.', [
      { id: 'retraites', mots_cles: ['âge de départ'] },
      { id: 'institutions', mots_cles: ['49.3'] },
    ]);
    assert.equal(r[0]!.hits, 1);
    assert.equal(r[1]!.hits, 1);
  });

  it('numérote les pages à partir des sauts de page', () => {
    const texte = 'Introduction sans rien.\fPage deux : le logement.\f\fPage quatre : le loyer.';
    const r = scanner(texte, themes('logement', ['logement', 'loyer']))[0]!;
    assert.deepEqual(r.extraits.map((e) => e.page), [2, 4]);
  });

  it('compte les engagements : infinitif, nous + futur, sera/doit/devra, puces', () => {
    const texte = [
      'Réformer le système de retraite dès 2027.',
      'Nous maintiendrons la retraite à 62 ans.',
      'La retraite sera revalorisée chaque année.',
      '- Retraite minimale à 1 200 euros',
      'Le candidat parle souvent de retraite dans ses discours.',
      'Notre retraite est un sujet de débat.',
    ].join('\n');
    const r = scanner(texte, themes('retraites', ['retraite']))[0]!;
    assert.equal(r.hits, 6);
    assert.equal(r.engagements, 4);
  });

  it('borne les extraits à max, ±150 caractères, coupés entre deux mots', () => {
    const bloc = 'alpha beta gamma delta '.repeat(40);
    const texte = Array.from({ length: 12 }, (_, i) => `${bloc}le logement numero${i} ${bloc}`).join('');
    const r = scanner(texte, themes('logement', ['logement']), 3)[0]!;
    assert.equal(r.hits, 12);
    assert.equal(r.extraits.length, 3);
    for (const e of r.extraits) {
      assert.ok(e.texte.length <= 150 * 2 + 40, `extrait trop long : ${e.texte.length}`);
      assert.doesNotMatch(e.texte, /\s{2,}/);
      assert.match(e.texte, /logement/);
      // coupé sur une frontière de mot : aucun mot tronqué à l'une ou l'autre extrémité
      const mots = e.texte.replace(/^…\s*|\s*…$/g, '').split(' ');
      for (const m of [mots[0]!, mots[mots.length - 1]!]) assert.match(m, /^(alpha|beta|gamma|delta|le|logement|numero\d+)$/);
    }
  });

  it('reste linéaire sur un gros texte', () => {
    const gros = 'La politique fiscale et le logement des familles. '.repeat(40000);
    const t0 = Date.now();
    const r = scanner(gros, THEMES_SPEC.map((t) => ({ id: t.id, mots_cles: MOTS_CLES_DEFAUT[t.id] ?? [] })));
    assert.ok(Date.now() - t0 < 10000, 'scan trop lent');
    assert.ok(r.find((x) => x.theme === 'logement')!.hits >= 40000);
  });
});

describe('CLI couverture-scan : scan d’un candidat', () => {
  it('affiche pour un thème les occurrences et un extrait contenant « loyers »', () => {
    const r = cli(['--candidat', 'marie-fictive', '--root', FIXTURE_ROOT, '--theme', 'logement']);
    assert.equal(r.status, 0, r.tout);
    assert.match(r.stdout, /logement : [1-9]\d* occurrence/);
    assert.match(r.stdout, /loyers/);
    assert.match(r.stdout, /p\. ?\d/);
  });

  it('sans --theme, parcourt les 10 thèmes', () => {
    const r = cli(['--candidat', 'marie-fictive', '--root', FIXTURE_ROOT]);
    assert.equal(r.status, 0, r.tout);
    for (const t of THEMES_SPEC) assert.ok(r.stdout.includes(`${t.id} : `), `ligne du thème ${t.id}`);
  });

  it('candidat inconnu : exit 1, « aucune source archivée »', () => {
    const r = cli(['--candidat', 'inconnu-x', '--root', FIXTURE_ROOT]);
    assert.equal(r.status, 1);
    assert.match(r.tout, /aucune source archivée/);
  });

  it('thème inconnu : exit 2', () => {
    const r = cli(['--candidat', 'marie-fictive', '--root', FIXTURE_ROOT, '--theme', 'cuisine']);
    assert.equal(r.status, 2);
  });

  it('--file sans --check-data : exit 2 ; aucun argument : exit 2', () => {
    assert.equal(cli(['--candidat', 'marie-fictive', '--file', ESTIMATION]).status, 2);
    assert.equal(cli([]).status, 2);
  });
});

describe('CLI couverture-scan --check-data', () => {
  it('classe l’estimation de recherche figée', () => {
    const r = cli(['--check-data', '--file', ESTIMATION]);
    assert.equal(r.status, 0, r.tout);
    assert.match(r.stdout, /choix : institutions, impots, retraites/);
    assert.match(r.stdout, /top3 littéral : institutions, impots, ecole/);
  });

  it('table absente : exit 1, « tableau de couverture introuvable »', () => {
    const r = cli(['--check-data', '--file', 'tests/fixtures/couverture/nexiste-pas.yaml']);
    assert.equal(r.status, 1);
    assert.match(r.tout, /tableau de couverture introuvable/);
  });

  function racine(niveau: string): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-couv-'));
    tmpDirs.push(dir);
    mkdirSync(path.join(dir, 'data'), { recursive: true });
    const ids = THEMES_SPEC.map((t) => t.id);
    const cellules = (n: string) => Object.fromEntries(ids.map((id, i) => [id, { niveau: i % 2 === 0 ? n : 'silence' }]));
    const table = {
      version: 1,
      mesure_le: '2026-11-04',
      mesure_par: 'test',
      regle: { marge_egalite: 2 },
      themes: THEMES_SPEC.map((t) => ({ id: t.id, nom: t.nom, prioritaire_aine: t.prioritaire_aine })),
      candidats: ['aa-aa', 'bb-bb', 'cc-cc', 'dd-dd'].map((id, i) => ({
        id,
        acces: 'ok',
        urls_bloquees: [],
        sources: [],
        urls_consultees: [],
        cellules: i === 3 ? cellules(niveau) : cellules('fort'),
      })),
      pilote: { provisoires: [], themes: [], livres: [], derogation: null, relecture_ouverte: false },
    };
    writeFileSync(path.join(dir, 'data', 'couverture-themes.yaml'), JSON.stringify(table));
    return dir;
  }

  it('--root <dossier> lit <dossier>/data/couverture-themes.yaml', () => {
    const r = cli(['--check-data', '--root', racine('fort')]);
    assert.equal(r.status, 0, r.tout);
    assert.match(r.stdout, /choix : /);
  });

  it('un niveau inconnu : exit 1 et la ligne nomme le candidat', () => {
    const r = cli(['--check-data', '--root', racine('moyen')]);
    assert.equal(r.status, 1);
    assert.match(r.tout, /dd-dd/);
    assert.match(r.tout, /niveau inconnu/);
  });
});
