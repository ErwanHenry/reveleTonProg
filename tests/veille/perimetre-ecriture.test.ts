import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ligneRelectureAutorisee, verifierPerimetre } from '../../scripts/lib/veille/perimetre-ecriture.ts';
import type { Executer } from '../../scripts/lib/veille/alertes.ts';

const executer: Executer = (commande, args, options) => {
  const r = spawnSync(commande, args, { cwd: options?.cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

const racine = mkdtempSync(path.join(tmpdir(), 'rtp-perimetre-'));
after(() => rmSync(racine, { recursive: true, force: true }));

const git = (...args: string[]): void => {
  const r = spawnSync('git', args, { cwd: racine, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
};
const ecrire = (rel: string, texte: string): void => {
  mkdirSync(path.dirname(path.join(racine, rel)), { recursive: true });
  writeFileSync(path.join(racine, rel), texte);
};
const indexer = (...rels: string[]): void => git('add', '--', ...rels);

const BASE: Record<string, string> = {
  'data/import/correspondances.yaml': 'version: 1\ncorrespondances:\n  a:\n    id: a-b\n',
  'data/couverture-themes.yaml': 'version: 1\ncandidats:\n  - id: a-b\n',
  'src/content/candidats/a.yaml': 'id: a-b\n',
  'src/content/couverture/sante.yaml': 'cases:\n  - candidat: a-b\n',
  'src/content/mesures/a/x.yaml': 'texte_source: "abc"\n',
  'src/content/sources/s.yaml': 'url: https://exemple.invalid/\n',
  'archives/x.txt': 'archive\n',
  'relecture/journal.jsonl': '{}\n',
  'ids.lock': 'a-b\n',
  LICENSE: 'licence\n',
  'src/pages/index.astro': '<p>x</p>\n',
};

beforeEach(() => {
  rmSync(path.join(racine, '.git'), { recursive: true, force: true });
  for (const [rel, texte] of Object.entries(BASE)) ecrire(rel, texte);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
});

const AGENT = "l'agent d'IA Claude";
const relecture = (cible: string, relecteur = AGENT, action = 'marquer'): string =>
  JSON.stringify({ horodatage: '2026-11-26T10:00:00.000Z', action, cible, relecteur, date: '2026-11-26', sha256: 'a'.repeat(64) });

const raisonsDe = (): string[] => {
  const r = verifierPerimetre(racine, executer);
  return r.ok ? [] : r.raisons.map((x) => x.raison);
};

describe('verifierPerimetre', () => {
  it('accepte les écritures de l’automate', () => {
    ecrire('data/import/correspondances.yaml', `${BASE['data/import/correspondances.yaml']}  b:\n    id: c-d\n`);
    ecrire('src/content/candidats/c-d.yaml', 'id: c-d\n');
    ecrire('data/couverture-themes.yaml', `${BASE['data/couverture-themes.yaml']}  - id: c-d\n`);
    ecrire('relecture/journal.jsonl', `{}\n${relecture('case:sante/c-d')}\n${relecture('statut:c-d')}\n`);
    ecrire('ids.lock', 'a-b\nc-d\n');
    ecrire('data/dataset-datagouv.yaml', 'x: 1\n');
    ecrire('data/import/2027etmoi-candidats-2026-11-26-abc.json', '{"texte":"extrêmement — enfin"}\n');
    indexer('data', 'src/content/candidats', 'relecture', 'ids.lock');
    assert.deepEqual(verifierPerimetre(racine, executer), { ok: true });
  });

  it('refuse un fichier hors liste', () => {
    ecrire('src/pages/index.astro', '<p>y</p>\n');
    indexer('src/pages/index.astro');
    assert.deepEqual(raisonsDe(), ['hors_liste']);
  });

  it('refuse une archive modifiée', () => {
    ecrire('archives/x.txt', 'autre\n');
    indexer('archives/x.txt');
    assert.deepEqual(raisonsDe(), ['archives']);
  });

  it('refuse une mesure modifiée', () => {
    ecrire('src/content/mesures/a/x.yaml', 'titre: y\n');
    indexer('src/content/mesures/a/x.yaml');
    assert.ok(raisonsDe().includes('mesures'));
  });

  it('refuse une source modifiée', () => {
    ecrire('src/content/sources/s.yaml', 'url: https://exemple.invalid/b\n');
    indexer('src/content/sources/s.yaml');
    assert.ok(raisonsDe().includes('sources'));
  });

  it('refuse un texte_source ajouté dans un fichier autorisé', () => {
    ecrire('src/content/candidats/a.yaml', 'id: a-b\ntexte_source: "x"\n');
    indexer('src/content/candidats/a.yaml');
    assert.deepEqual(raisonsDe(), ['texte_source']);
  });

  it('refuse un texte_source retiré', () => {
    ecrire('src/content/mesures/a/x.yaml', 'a: 1\n');
    indexer('src/content/mesures/a/x.yaml');
    const r = raisonsDe();
    assert.ok(r.includes('texte_source') && r.includes('mesures'));
  });

  it('refuse une ligne existante de correspondances modifiée', () => {
    ecrire('data/import/correspondances.yaml', BASE['data/import/correspondances.yaml']?.replace('a-b', 'z-z') as string);
    indexer('data/import/correspondances.yaml');
    assert.deepEqual(raisonsDe(), ['correspondances_existantes']);
  });

  it('refuse une ligne existante de correspondances supprimée', () => {
    ecrire('data/import/correspondances.yaml', 'version: 1\ncorrespondances:\n');
    indexer('data/import/correspondances.yaml');
    assert.deepEqual(raisonsDe(), ['correspondances_existantes']);
  });

  it('refuse un tiret long ou moyen dans une ligne de gabarit', () => {
    ecrire('data/couverture-themes.yaml', `${BASE['data/couverture-themes.yaml']}    note: a \u2014 b\n`);
    indexer('data/couverture-themes.yaml');
    assert.deepEqual(raisonsDe(), ['tiret']);
    git('reset', '-q');
    ecrire('src/content/couverture/sante.yaml', `${BASE['src/content/couverture/sante.yaml']}    verifie_par: a \u2013 b\n`);
    indexer('src/content/couverture/sante.yaml');
    assert.deepEqual(raisonsDe(), ['tiret']);
  });

  it('refuse un mot interdit dans une ligne de gabarit', () => {
    ecrire('data/couverture-themes.yaml', `${BASE['data/couverture-themes.yaml']}    note: enfin une note\n`);
    indexer('data/couverture-themes.yaml');
    assert.deepEqual(raisonsDe(), ['mot_interdit']);
    git('reset', '-q');
    ecrire('data/couverture-themes.yaml', `${BASE['data/couverture-themes.yaml']}    note: extrêmement\n`);
    indexer('data/couverture-themes.yaml');
    assert.deepEqual(raisonsDe(), ['mot_interdit']);
  });

  it('refuse un fichier supprimé ou renommé', () => {
    rmSync(path.join(racine, 'src/content/candidats/a.yaml'));
    indexer('src/content/candidats/a.yaml');
    assert.deepEqual(raisonsDe(), ['suppression']);
    git('reset', '-q', '--hard');
    renameSync(path.join(racine, 'src/content/candidats/a.yaml'), path.join(racine, 'src/content/candidats/b.yaml'));
    git('add', '-A', 'src/content/candidats');
    assert.ok(raisonsDe().includes('suppression'));
  });

  it('WR-06 : sous relecture/, seules des relectures de statut ou de case par l\'agent sont acceptées', () => {
    assert.equal(ligneRelectureAutorisee(relecture('statut:c-d')), true);
    assert.equal(ligneRelectureAutorisee(relecture('case:sante/c-d')), true);
    assert.equal(ligneRelectureAutorisee(relecture('case:europe-et-monde/c-d')), true);
    for (const l of [
      relecture('mesure:c-d/sante-une-mesure'),
      relecture('statut:c-d', 'Erwan Henry'),
      relecture('statut:c-d', AGENT, 'retirer'),
      relecture('case:sante'),
      relecture('case:/c-d'),
      relecture('statut:'),
      relecture('statut:C D'),
      relecture('source:c-d'),
      '{}',
      'pas du JSON',
      '[1]',
    ]) assert.equal(ligneRelectureAutorisee(l), false, l);
  });

  for (const [nom, ligne] of [
    ['relecture d\'une mesure', relecture('mesure:a-b/sante-une-mesure')],
    ['autre relecteur', relecture('statut:a-b', 'Erwan Henry')],
    ['ligne illisible', 'pas du JSON'],
  ] as const) {
    it(`WR-06 : refuse une ligne ajoutée au journal de relecture (${nom})`, () => {
      ecrire('relecture/journal.jsonl', `${BASE['relecture/journal.jsonl']}${relecture('statut:a-b')}\n${ligne}\n`);
      indexer('relecture/journal.jsonl');
      assert.deepEqual(raisonsDe(), ['relecture']);
    });
  }

  it('WR-06 : refuse une ligne retirée du journal et tout autre fichier sous relecture/', () => {
    ecrire('relecture/journal.jsonl', '');
    indexer('relecture/journal.jsonl');
    assert.deepEqual(raisonsDe(), ['relecture']);
    git('reset', '-q', '--hard');
    ecrire('relecture/notes.jsonl', `${relecture('statut:a-b')}\n`);
    indexer('relecture/notes.jsonl');
    assert.deepEqual(raisonsDe(), ['hors_liste']);
  });

  it('ne cite jamais le contenu des lignes dans ses raisons', () => {
    ecrire('data/couverture-themes.yaml', `${BASE['data/couverture-themes.yaml']}    note: SECRETXYZ \u2014\n`);
    indexer('data/couverture-themes.yaml');
    const r = verifierPerimetre(racine, executer);
    assert.ok(!JSON.stringify(r).includes('SECRETXYZ'));
  });
});
