// Classement « le site est-il touché ? » (ops/site-touche.sh) et ses deux usages dans ci.yml : le job changements
// (un push de documentation seule ne demande aucun déploiement) et le contrôle de la tête de main du job deploy
// (une tête plus récente n'est admise que si elle descend du commit du run et ne change pas le site).
// Les corps de script sont lus dans ci.yml et lancés avec bash dans des dépôts git temporaires ; un remplaçant de
// git en tête de PATH répond à ls-remote et sert fetch depuis un dépôt local, le reste passe au vrai git.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'ops', 'site-touche.sh');

type Step = { id?: string; run?: string; env?: Record<string, string> };
type Job = { steps: Step[] };
const ci = parse(fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')) as {
  env: Record<string, string>;
  jobs: Record<string, Job>;
};
const LISTE = ci.env.CHEMINS_HORS_SITE as string;
const corpsChangements = (): string => ci.jobs.changements?.steps.find((s) => s.id === 'classer')?.run ?? '';
const corpsGarde = (): string => ci.jobs.deploy?.steps.find((s) => s.run?.includes('git ls-remote'))?.run ?? '';

function classer(chemins: string[], liste: string | null = LISTE): { status: number | null; out: string; err: string } {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
  if (liste !== null) env.CHEMINS_HORS_SITE = liste;
  const r = spawnSync('bash', [SCRIPT], { input: chemins.map((c) => `${c}\0`).join(''), env, encoding: 'utf8' });
  return { status: r.status, out: r.stdout.trim(), err: r.stderr };
}

describe('ops/site-touche.sh : classement des chemins changés', () => {
  it('passe bash -n', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });

  const cas: [string, string[], 'true' | 'false'][] = [
    ['documentation et planification seules', ['docs/RUNBOOK.md', '.planning/STATE.md'], 'false'],
    ['tests, e2e, audit, ops, deploy, workflows', ['tests/repo/ci.test.ts', 'e2e/a.spec.ts', 'audit/x.md', 'ops/battement.sh', 'deploy/caddy/essai.caddy', '.github/workflows/ci.yml'], 'false'],
    ['fichiers de la racine listés', ['README.md', 'LICENSE', 'CHANGELOG.md', '.editorconfig'], 'false'],
    ['.gitattributes compte comme le site (eol, encodage, filtres : IN-04)', ['.gitattributes'], 'true'],
    ['.gitattributes parmi de la documentation', ['README.md', '.gitattributes'], 'true'],
    ['aucun chemin', [], 'false'],
    ['une page du site', ['src/pages/index.astro'], 'true'],
    ['un .md hors de la racine (le motif *.md ne vaut qu’à la racine)', ['src/content/notes.md'], 'true'],
    ['contenu, configuration, scripts, dépendances', ['content/mesures/x.yaml'], 'true'],
    ['package.json', ['package.json'], 'true'],
    ['scripts/ (check-dist, build) compte comme le site', ['scripts/check-dist.ts'], 'true'],
    ['un fichier nommé comme un dossier listé, sans barre', ['docs'], 'true'],
    ['un dossier dont le nom commence comme un dossier listé', ['docsx/a.md'], 'true'],
    ['un chemin du site parmi de la documentation', ['docs/a.md', 'public/robots.txt', 'tests/b.ts'], 'true'],
    ['espaces dans les noms', ['docs/a b.md', 'src/c d.astro'], 'true'],
  ];
  for (const [nom, chemins, attendu] of cas) {
    it(`${nom} : ${attendu}`, () => {
      const r = classer(chemins);
      assert.equal(r.status, 0, r.err);
      assert.equal(r.out, attendu);
    });
  }

  it('dernier chemin sans octet nul final : lu quand même', () => {
    const r = spawnSync('bash', [SCRIPT], { input: 'docs/a\0src/b', env: { PATH: process.env.PATH ?? '', CHEMINS_HORS_SITE: LISTE }, encoding: 'utf8' });
    assert.equal(r.stdout.trim(), 'true');
  });

  it('CHEMINS_HORS_SITE absente ou vide : code 2, aucun verdict', () => {
    for (const liste of [null, '']) {
      const r = classer(['docs/a.md'], liste);
      assert.equal(r.status, 2);
      assert.equal(r.out, '');
    }
  });

  it('une longue liste ne casse pas « git diff | site-touche » sous pipefail (toute l’entrée est lue)', () => {
    const fichier = path.join(os.tmpdir(), `rtp-site-touche-${process.pid}`);
    fs.writeFileSync(fichier, Array.from({ length: 20000 }, (_, i) => `src/f${i}-${'x'.repeat(60)}\0`).join(''));
    try {
      const r = spawnSync('bash', ['-c', 'set -euo pipefail; V=$(cat "$1" | bash "$2"); echo "$V"', 'bash', fichier, SCRIPT], {
        env: { PATH: process.env.PATH ?? '', CHEMINS_HORS_SITE: LISTE },
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout.trim(), 'true');
    } finally {
      fs.rmSync(fichier, { force: true });
    }
  });
});

/** Dépôt temporaire : un commit initial (site + ops/site-touche.sh), identité locale fixée. */
type Depot = { racine: string; origine: string; bin: string; git: (...a: string[]) => string; commit: (fichiers: Record<string, string>, msg: string) => string };

function creerDepot(): Depot {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-depot-'));
  const travail = path.join(racine, 'travail');
  const bin = path.join(racine, 'bin');
  fs.mkdirSync(travail);
  fs.mkdirSync(bin);
  const git = (...a: string[]): string => {
    const r = spawnSync('git', a, { cwd: travail, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')} : ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const commit = (fichiers: Record<string, string>, msg: string): string => {
    for (const [f, contenu] of Object.entries(fichiers)) {
      fs.mkdirSync(path.dirname(path.join(travail, f)), { recursive: true });
      fs.writeFileSync(path.join(travail, f), contenu);
      git('add', '--', f);
    }
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  commit({ 'src/pages/index.astro': 'a\n', 'docs/RUNBOOK.md': 'a\n', 'ops/site-touche.sh': fs.readFileSync(SCRIPT, 'utf8') }, 'initial');
  // Remplaçant de git : ls-remote répond FAUX_TETE, fetch lit la branche main du dépôt de travail lui-même.
  const vraiGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  fs.writeFileSync(
    path.join(bin, 'git'),
    `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  ls-remote) printf '%s\\trefs/heads/main\\n' "$FAUX_TETE" ;;
  fetch) exec "${vraiGit}" fetch --quiet --no-tags "$FAUX_ORIGINE" "$FAUX_TETE" ;;
  *) exec "${vraiGit}" "$@" ;;
esac
`,
    { mode: 0o755 },
  );
  return { racine, origine: travail, bin, git, commit };
}

function lancer(d: Depot, corps: string, env: Record<string, string>): { status: number | null; out: string; sortie: string; resume: string } {
  const sortie = path.join(d.racine, 'output');
  const resume = path.join(d.racine, 'summary');
  fs.writeFileSync(sortie, '');
  fs.writeFileSync(resume, '');
  const r = spawnSync('bash', ['-c', corps], {
    cwd: d.origine,
    env: {
      PATH: `${d.bin}:${process.env.PATH ?? ''}`,
      HOME: d.racine,
      CHEMINS_HORS_SITE: LISTE,
      GITHUB_OUTPUT: sortie,
      GITHUB_STEP_SUMMARY: resume,
      FAUX_ORIGINE: d.origine,
      ...env,
    },
    encoding: 'utf8',
  });
  return { status: r.status, out: r.stdout + r.stderr, sortie: fs.readFileSync(sortie, 'utf8'), resume: fs.readFileSync(resume, 'utf8') };
}

describe('ci.yml, job changements : sortie site', () => {
  let d: Depot;
  before(() => {
    d = creerDepot();
  });
  after(() => fs.rmSync(d.racine, { recursive: true, force: true }));

  const site = (env: Record<string, string>): string => {
    const r = lancer(d, corpsChangements(), env);
    assert.equal(r.status, 0, r.out);
    const m = r.sortie.match(/^site=(true|false)$/m);
    assert.ok(m, `sortie site absente : ${r.sortie}`);
    return m[1] as string;
  };

  it('push de documentation seule : site=false', () => {
    const avant = d.git('rev-parse', 'HEAD');
    const apres = d.commit({ 'docs/RUNBOOK.md': 'b\n', '.planning/STATE.md': 'x\n' }, 'docs');
    assert.equal(site({ EVENT_NAME: 'push', AVANT: avant, APRES: apres }), 'false');
  });

  it('push qui touche le site : site=true', () => {
    const avant = d.git('rev-parse', 'HEAD');
    const apres = d.commit({ 'src/pages/index.astro': 'b\n', 'docs/RUNBOOK.md': 'c\n' }, 'site');
    assert.equal(site({ EVENT_NAME: 'push', AVANT: avant, APRES: apres }), 'true');
  });

  it('renommage d’une page vers docs/ : site=true (les deux côtés comptent)', () => {
    const avant = d.git('rev-parse', 'HEAD');
    d.git('mv', 'src/pages/index.astro', 'docs/index.astro');
    d.git('commit', '-q', '-m', 'renommage');
    assert.equal(site({ EVENT_NAME: 'push', AVANT: avant, APRES: d.git('rev-parse', 'HEAD') }), 'true');
  });

  it('commit de base vide, à 40 zéros, introuvable ou hors de l’historique : site=true par prudence', () => {
    const apres = d.git('rev-parse', 'HEAD');
    d.git('checkout', '-q', '--orphan', 'autre');
    const etranger = d.commit({ 'docs/x.md': 'x\n' }, 'étranger');
    d.git('checkout', '-q', 'main');
    for (const avant of ['', '0'.repeat(40), 'f'.repeat(40), etranger]) {
      assert.equal(site({ EVENT_NAME: 'push', AVANT: avant, APRES: apres }), 'true', `avant=${avant}`);
    }
  });

  it('lancement à la main : site=true (deployer ou retrait_urgence décide)', () => {
    assert.equal(site({ EVENT_NAME: 'workflow_dispatch', AVANT: '', APRES: d.git('rev-parse', 'HEAD') }), 'true');
  });
});

describe('ci.yml, job deploy : contrôle de la tête de main (approbation périmée)', () => {
  let d: Depot;
  before(() => {
    d = creerDepot();
  });
  after(() => fs.rmSync(d.racine, { recursive: true, force: true }));

  const garde = (sha: string, tete: string) => lancer(d, corpsGarde(), { CIBLE: 'essai', SHA: sha, REPO: 'ErwanHenry/reveleTonProg', FAUX_TETE: tete });

  it('commit encore tête de main : autorisé', () => {
    const sha = d.git('rev-parse', 'HEAD');
    const r = garde(sha, sha);
    assert.equal(r.status, 0, r.out);
    assert.match(r.resume, /encore la tête de main/);
  });

  it('tête plus récente qui ne change que la documentation : autorisé, avec le message attendu', () => {
    const sha = d.git('rev-parse', 'HEAD');
    const tete = d.commit({ '.planning/STATE.md': 'y\n', 'docs/RUNBOOK.md': 'z\n' }, 'docs');
    const r = garde(sha, tete);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /tête plus récente sans changement du site : déploiement autorisé/);
    assert.match(r.resume, /sans changement du site/);
  });

  it('tête plus récente qui change le site : refusé', () => {
    const sha = d.git('rev-parse', 'HEAD');
    d.commit({ 'docs/a.md': '1\n' }, 'docs');
    const tete = d.commit({ 'src/pages/index.astro': 'nouveau\n' }, 'site');
    const r = garde(sha, tete);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /::error::main a avancé[^\n]*changements du site/);
    assert.doesNotMatch(r.out, /déploiement autorisé/);
  });

  it('tête qui ne descend pas du commit du run (historique réécrit) : refusé, même sans changement du site', () => {
    const base = d.git('rev-parse', 'HEAD');
    const sha = d.commit({ 'docs/run.md': 'r\n' }, 'commit du run');
    d.git('reset', '-q', '--hard', base);
    const tete = d.commit({ 'docs/autre.md': 'o\n' }, 'réécrit');
    const r = garde(sha, tete);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /::error::La tête de main[^\n]*ne descend pas/);
  });

  it('cible hors essai et production : refusé avant tout', () => {
    const sha = d.git('rev-parse', 'HEAD');
    const r = lancer(d, corpsGarde(), { CIBLE: 'autre', SHA: sha, REPO: 'x/y', FAUX_TETE: sha });
    assert.equal(r.status, 1);
    assert.match(r.out, /DEPLOY_CIBLE doit valoir essai ou production/);
  });
});
