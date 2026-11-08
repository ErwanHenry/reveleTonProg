// Garde de gel des scrutins (HEB-13, D-10) : fenêtres calculées depuis TOURS, dates lues à Paris quel que soit le
// fuseau du processus, retrait d'urgence avec justification écrite, CLI qui écrit ok= dans GITHUB_OUTPUT.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURS } from '../../src/lib/dates-tours.ts';
import { dateParis, evaluerGel, FENETRES_GEL, nettoyerJustification } from '../../scripts/garde-gel.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'scripts', 'garde-gel.ts');
const JUSTIF = 'Retrait demandé par le candidat, courriel du 18 avril';

describe('garde-gel : fenêtres depuis TOURS', () => {
  it('veille au lendemain de chaque tour, bornes incluses', () => {
    assert.deepEqual(FENETRES_GEL, [
      { debut: '2027-04-17', fin: '2027-04-19', tour: 1 },
      { debut: '2027-05-01', fin: '2027-05-03', tour: 2 },
    ]);
    assert.equal(FENETRES_GEL.length, TOURS.length);
  });
});

describe('garde-gel : dateParis', () => {
  it('rend la date civile de Paris (UTC+2 en avril, UTC+1 en novembre)', () => {
    assert.equal(dateParis(new Date('2027-04-16T21:59:59Z')), '2027-04-16');
    assert.equal(dateParis(new Date('2027-04-16T22:00:00Z')), '2027-04-17');
    assert.equal(dateParis(new Date('2026-11-08T22:59:59Z')), '2026-11-08');
    assert.equal(dateParis(new Date('2026-11-08T23:00:00Z')), '2026-11-09');
  });
});

describe('garde-gel : evaluerGel sans urgence', () => {
  const cas: [string, boolean][] = [
    ['2027-04-16T21:59:59Z', true],
    ['2027-04-16T22:00:00Z', false],
    ['2027-04-16T23:30:00Z', false],
    ['2027-04-19T21:59:59Z', false],
    ['2027-04-19T22:00:00Z', true],
    ['2027-04-30T21:59:59Z', true],
    ['2027-05-01T00:00:00Z', false],
    ['2027-05-03T21:59:59Z', false],
    ['2027-05-03T22:00:00Z', true],
    ['2026-11-08T12:00:00Z', true],
  ];
  for (const [iso, ok] of cas) {
    it(`${iso} : ${ok ? 'autorisé' : 'gelé'}`, () => {
      const d = evaluerGel(new Date(iso), false, '');
      assert.equal(d.ok, ok, d.motif);
      assert.equal(d.gele, !ok);
      assert.equal(d.urgence, false);
      assert.ok(d.motif.length > 0);
      if (!ok) assert.match(d.motif, /gel/i);
    });
  }

  it('la fenêtre et le tour sont rendus quand la date est gelée', () => {
    const d = evaluerGel(new Date('2027-05-02T10:00:00Z'), false, '');
    assert.equal(d.tour, 2);
    assert.equal(d.date, '2027-05-02');
    assert.match(d.motif, /2027-05-01/);
    assert.match(d.motif, /2027-05-03/);
    assert.equal(evaluerGel(new Date('2026-11-08T12:00:00Z'), false, '').tour, null);
  });
});

describe('garde-gel : retrait d’urgence', () => {
  it('gelé + urgence + justification de 20 caractères ou plus : autorisé, motif d’urgence', () => {
    const d = evaluerGel(new Date('2027-04-18T10:00:00Z'), true, JUSTIF);
    assert.equal(d.ok, true);
    assert.equal(d.gele, true);
    assert.equal(d.urgence, true);
    assert.match(d.motif, /urgence/i);
    assert.equal(evaluerGel(new Date('2027-04-18T10:00:00Z'), true, 'x'.repeat(20)).ok, true);
  });

  it('urgence sans justification valable : refusé', () => {
    for (const j of ['', '   ', 'x'.repeat(19), 'trop court\n\n\n\n\n\n\n\n']) {
      const d = evaluerGel(new Date('2027-04-18T10:00:00Z'), true, j);
      assert.equal(d.ok, false, JSON.stringify(j));
      assert.equal(d.urgence, true);
      assert.match(d.motif, /justification/i);
    }
  });

  it('urgence hors gel : la justification reste exigée (une case cochée par erreur se voit)', () => {
    assert.equal(evaluerGel(new Date('2026-11-08T12:00:00Z'), true, '').ok, false);
    const d = evaluerGel(new Date('2026-11-08T12:00:00Z'), true, JUSTIF);
    assert.equal(d.ok, true);
    assert.equal(d.gele, false);
  });

  it('nettoyerJustification : une seule ligne, sans caractère de contrôle, 300 caractères au plus', () => {
    assert.equal(nettoyerJustification('a\nb\r\nc d\te'), 'a b c d e');
    assert.equal(nettoyerJustification('  x  \n\n ::error::y  '), 'x ::error::y');
    assert.equal([...nettoyerJustification('é'.repeat(400))].length, 300);
    assert.equal(nettoyerJustification('a\u0000\u001bb'), 'a b');
  });
});

type Resultat = { status: number | null; out: string; err: string; sortie: string; resume: string };

function lancer(args: string[], opts: { tz?: string; fichiers?: boolean } = {}): Resultat {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-gel-'));
  const sortie = path.join(dossier, 'output');
  const resume = path.join(dossier, 'summary');
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', TZ: opts.tz ?? 'Europe/Paris' };
  if (opts.fichiers !== false) {
    fs.writeFileSync(sortie, 'avant=1\n');
    fs.writeFileSync(resume, '');
    env.GITHUB_OUTPUT = sortie;
    env.GITHUB_STEP_SUMMARY = resume;
  }
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, env, encoding: 'utf8' });
  const lire = (f: string): string => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  const res = { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '', sortie: lire(sortie), resume: lire(resume) };
  fs.rmSync(dossier, { recursive: true, force: true });
  return res;
}

describe('garde-gel : CLI', () => {
  it('hors gel : ok=true ajouté à GITHUB_OUTPUT, résumé écrit, code 0', () => {
    const r = lancer(['--urgence', '', '--justification', '', '--date', '2026-11-08T12:00:00Z']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(r.sortie, 'avant=1\nok=true\n');
    assert.match(r.resume, /gel/i);
    assert.ok(!r.out.includes('::warning::'));
    assert.ok(!r.out.includes('::error::'));
  });

  it('gelé sans urgence : ok=false, ::warning::, code 0', () => {
    const r = lancer(['--urgence', 'false', '--justification', '', '--date', '2027-04-18T12:00:00+02:00']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.sortie, /^ok=false$/m);
    assert.match(r.out, /^::warning::/m);
    assert.match(r.resume, /2027-04-17/);
  });

  it('gelé avec urgence justifiée : ok=true, ::notice:: avec la justification, code 0', () => {
    const r = lancer(['--urgence', 'true', '--justification', JUSTIF, '--date', '2027-05-02T09:00:00Z']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.sortie, /^ok=true$/m);
    const notice = r.out.split('\n').find((l) => l.startsWith('::notice::'));
    assert.ok(notice, r.out);
    assert.ok(notice.includes(JUSTIF));
    assert.ok(r.resume.includes(JUSTIF));
  });

  it('urgence sans justification valable : ::error::, ok=false, code 1', () => {
    const r = lancer(['--urgence', 'true', '--justification', 'court', '--date', '2027-05-02T09:00:00Z']);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.out + r.err, /^::error::/m);
    assert.match(r.sortie, /^ok=false$/m);
  });

  it('la justification ne peut pas injecter de commande de workflow (une ligne, 300 caractères)', () => {
    const piege = `${JUSTIF}\n::error::injecte\n::add-mask::x %0A::warning::y ${'z'.repeat(400)}`;
    const r = lancer(['--urgence', 'true', '--justification', piege, '--date', '2027-05-02T09:00:00Z']);
    assert.equal(r.status, 0, r.out + r.err);
    const lignes = (r.out + r.err).split('\n');
    assert.ok(!lignes.some((l) => l.startsWith('::error::') || l.startsWith('::add-mask::')), r.out);
    assert.equal(lignes.filter((l) => l.startsWith('::warning::')).length, 0);
    assert.ok(!r.resume.split('\n').some((l) => l.startsWith('::')));
    const notice = lignes.find((l) => l.startsWith('::notice::')) ?? '';
    assert.ok(!notice.includes('%0A'), 'le % est échappé dans le message d’annotation');
    assert.ok(notice.length < 600);
  });

  it('sans GITHUB_OUTPUT : décision affichée, code 0 (exemple de la fenêtre du premier tour)', () => {
    const r = lancer(['--urgence', '', '--justification', '', '--date', '2027-04-18T12:00:00+02:00'], { fichiers: false });
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.out, /^::warning::/m);
  });

  it('indépendant du fuseau du processus (UTC, Pacific/Auckland)', () => {
    for (const tz of ['UTC', 'Pacific/Auckland']) {
      const gele = lancer(['--urgence', '', '--justification', '', '--date', '2027-04-16T22:00:00Z'], { tz });
      assert.match(gele.sortie, /^ok=false$/m, tz);
      const libre = lancer(['--urgence', '', '--justification', '', '--date', '2027-04-16T21:59:59Z'], { tz });
      assert.match(libre.sortie, /^ok=true$/m, tz);
      const fin = lancer(['--urgence', '', '--justification', '', '--date', '2027-05-03T22:00:00Z'], { tz });
      assert.match(fin.sortie, /^ok=true$/m, tz);
    }
  });

  it('sans --date : utilise l’horloge (aujourd’hui hors gel en 2026)', () => {
    const r = lancer(['--urgence', '', '--justification', '']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.sortie, /^ok=(true|false)$/m);
  });

  it('erreurs d’usage : code 2', () => {
    const mauvais: string[][] = [
      ['--inconnue', 'x'],
      ['--urgence', 'oui'],
      ['--urgence', 'TRUE'],
      ['--date', 'demain'],
      ['--date', '2027-02-30'],
      ['--date', '2027-04-18 12:00'],
      ['positionnel'],
    ];
    for (const args of mauvais) {
      const r = lancer(args);
      assert.equal(r.status, 2, `${args.join(' ')} : ${r.out}${r.err}`);
      assert.ok(!/^ok=/m.test(r.sortie), 'rien écrit dans GITHUB_OUTPUT');
    }
  });
});
