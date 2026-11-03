import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string): string => fs.readFileSync(path.join(ROOT, f), 'utf8');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  'continue-on-error'?: unknown;
};
type Job = { 'timeout-minutes'?: number; permissions?: unknown; steps: Step[] };
type Workflow = {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  env: Record<string, string>;
  jobs: { verifier: Job; secrets: Job } & Record<string, Job>;
};
type Update = {
  'package-ecosystem': string;
  schedule: { interval: string; timezone: string };
  cooldown: Record<string, number>;
};
type Dependabot = { version: number; updates: Update[] };

const ciRaw = read('.github/workflows/ci.yml');
const ci = parse(ciRaw) as Workflow;
const dependabot = parse(read('.github/dependabot.yml')) as Dependabot;

const allSteps = (): Step[] => Object.values(ci.jobs).flatMap((j) => j.steps);
const runsOf = (job: Job): string[] =>
  job.steps.filter((s) => typeof s.run === 'string').map((s) => (s.run as string).trim());

describe('ci.yml : déclencheurs et droits', () => {
  it('push limité à main : une PR ne déclenche pas la CI deux fois (WR-07)', () => {
    assert.deepEqual((ci.on.push as { branches?: string[] } | null)?.branches, ['main']);
  });

  it('se déclenche sur push et pull_request, jamais pull_request_target', () => {
    assert.ok('push' in ci.on);
    assert.ok('pull_request' in ci.on);
    assert.ok(!('pull_request_target' in ci.on));
    assert.ok(!ciRaw.includes('pull_request_target'));
  });

  it('permissions de workflow = contents: read, aucun job ne les redéfinit', () => {
    assert.deepEqual(ci.permissions, { contents: 'read' });
    for (const [name, job] of Object.entries(ci.jobs)) {
      assert.ok(!('permissions' in job), `le job ${name} ne doit pas déclarer permissions`);
    }
  });

  it('env : fuseau Paris et télémétrie Astro coupée', () => {
    assert.equal(ci.env.TZ, 'Europe/Paris');
    assert.equal(ci.env.ASTRO_TELEMETRY_DISABLED, '1');
  });

  it('chaque job a un timeout, aucun continue-on-error', () => {
    for (const [name, job] of Object.entries(ci.jobs)) {
      assert.equal(typeof job['timeout-minutes'], 'number', `timeout manquant : ${name}`);
    }
    for (const step of allSteps()) {
      assert.notEqual(step['continue-on-error'], true);
    }
    assert.ok(!/continue-on-error:\s*true/.test(ciRaw));
  });
});

describe('ci.yml : actions épinglées', () => {
  it('chaque uses: est épinglé sur un SHA de 40 hex', () => {
    const uses = allSteps().filter((s) => s.uses !== undefined);
    assert.ok(uses.length >= 3);
    for (const s of uses) {
      assert.match(s.uses as string, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    }
  });

  it('chaque ligne uses: finit par un commentaire # v<chiffre>', () => {
    const lines = ciRaw.split('\n').filter((l) => /\buses:/.test(l));
    assert.ok(lines.length >= 3);
    for (const l of lines) {
      assert.match(l, /@[0-9a-f]{40} # v\d/, `commentaire de version manquant : ${l.trim()}`);
    }
  });

  it('checkout : persist-credentials false partout', () => {
    const checkouts = allSteps().filter((s) => s.uses?.startsWith('actions/checkout@'));
    assert.equal(checkouts.length, 2);
    for (const s of checkouts) {
      assert.equal(s.with?.['persist-credentials'], false);
    }
  });

  it('le checkout du job verifier récupère tout l’historique (comparaison d’ids.lock avec la base)', () => {
    const checkout = ci.jobs.verifier.steps.find((s) => s.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout?.with?.['fetch-depth'], 0);
    assert.equal(checkout?.with?.['persist-credentials'], false);
  });

  it('setup-node lit .nvmrc et met npm en cache', () => {
    const node = allSteps().filter((s) => s.uses?.startsWith('actions/setup-node@'));
    assert.equal(node.length, 1);
    assert.equal(node[0]?.with?.['node-version-file'], '.nvmrc');
    assert.equal(node[0]?.with?.cache, 'npm');
  });
});

describe('ci.yml : job verifier', () => {
  const runs = runsOf(ci.jobs.verifier);
  const expectedOrder = [
    'npm ci',
    'npm run migrate -- --check',
    'npm run validate -- --mode production --format github',
    'npm run check',
    'npm test',
    'npm run build',
    'npm run check-dist',
  ];

  it('enchaîne les commandes dans l’ordre attendu', () => {
    let from = 0;
    for (const cmd of expectedOrder) {
      const idx = runs.indexOf(cmd, from);
      assert.ok(idx >= 0, `commande absente ou hors ordre : ${cmd}`);
      from = idx + 1;
    }
  });

  it('valide et migre aussi le corpus réel (RTP_CONTENT_ROOT=.)', () => {
    const real = (cmd: string) =>
      ci.jobs.verifier.steps.some((s) => s.run?.trim().startsWith(cmd) && s.env?.RTP_CONTENT_ROOT === '.');
    assert.ok(real('npm run validate'));
    assert.ok(real('npm run migrate -- --check'));
  });

  it('toutes les étapes validate sont épinglées sur --mode production (T-02-21, T-02-30)', () => {
    const validations = ci.jobs.verifier.steps.filter((s) => s.run?.trim().startsWith('npm run validate'));
    assert.equal(validations.length, 2);
    for (const s of validations) {
      assert.ok(s.run?.includes('--mode production'), `mode non épinglé : ${s.run}`);
      assert.ok(s.run?.includes('--format github'), `annotations absentes : ${s.run}`);
    }
    assert.ok(!/RTP_MODE/.test(ciRaw), 'la CI ne doit pas dépendre de RTP_MODE');
  });

  it('ids.lock est comparé au commit de base (ajout seul), valeurs d’événement passées par env', () => {
    const steps = ci.jobs.verifier.steps;
    const iStep = steps.findIndex((s) => s.run?.includes('npm run ids -- --check --base') === true);
    assert.ok(iStep >= 0, 'étape de comparaison à la base absente');
    const step = steps[iStep] as Step;
    assert.equal(step.env?.RTP_CONTENT_ROOT, '.');
    assert.match(step.run as string, /git show "\$\{BASE\}:ids\.lock"/);
    assert.ok(!(step.run as string).includes('${{'), 'aucune interpolation ${{ }} dans le corps du script');
    for (const cle of ['EVENT_NAME', 'BASE_REF', 'PUSH_BEFORE']) assert.ok(step.env?.[cle]?.startsWith('${{'), `${cle} doit venir de l’événement via env`);
    const iValidate = steps.findIndex((s) => s.run?.trim().startsWith('npm run validate') && s.env?.RTP_CONTENT_ROOT === '.');
    assert.ok(iValidate >= 0 && iValidate < iStep, 'la comparaison suit les étapes validate');
  });

  it('WR-01 : la comparaison de ids.lock échoue fermé (merge-base, commit de base introuvable)', () => {
    const step = ci.jobs.verifier.steps.find((s) => s.run?.includes('npm run ids -- --check --base') === true) as Step;
    const run = step.run as string;
    assert.ok(!/merge-base[^\n]*\|\|\s*true/.test(run), 'merge-base ne doit pas être avalé par || true');
    assert.match(run, /merge-base[^\n]*\|\| \{[^\n]*exit 1/);
    assert.ok(!run.includes('::warning::'), 'un commit de base introuvable doit être une erreur, pas un avertissement');
    assert.match(run, /::error::Commit de base[^\n]*\n\s*exit 1/);
  });

  it('WR-01 : cancel-in-progress ne s’applique qu’aux pull requests (jamais à main)', () => {
    const conc = (ci as unknown as { concurrency: { 'cancel-in-progress': unknown } }).concurrency;
    assert.equal(conc['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
  });

  it('aucun corps de script ne contient d’interpolation ${{ }}', () => {
    for (const s of allSteps()) assert.ok(!(s.run ?? '').includes('${{'), `interpolation dans run : ${s.name}`);
  });

  it('npm audit signatures vient après npm ci et avant migrate', () => {
    const iCi = runs.indexOf('npm ci');
    const iAudit = runs.indexOf('npm audit signatures');
    const iMigrate = runs.indexOf('npm run migrate -- --check');
    assert.ok(iCi < iAudit && iAudit < iMigrate);
  });
});

describe('ci.yml : job secrets (gitleaks)', () => {
  const job = ci.jobs.secrets;

  it('récupère tout l’historique', () => {
    const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout?.with?.['fetch-depth'], 0);
  });

  it('épingle la version et la somme sha256 du binaire', () => {
    const install = job.steps.find((s) => s.env?.GITLEAKS_VERSION !== undefined);
    assert.ok(install, 'étape d’installation gitleaks absente');
    assert.equal(String(install.env?.GITLEAKS_VERSION), '8.30.1');
    assert.match(String(install.env?.GITLEAKS_SHA256), /^[0-9a-f]{64}$/);
  });

  it('vérifie la somme (sha256sum -c) avant d’extraire (tar)', () => {
    const scripts = runsOf(job).join('\n');
    const iSum = scripts.indexOf('sha256sum -c');
    const iTar = scripts.indexOf('tar ');
    assert.ok(iSum >= 0 && iTar >= 0 && iSum < iTar);
  });

  it('lance gitleaks git (pas les alias dépréciés detect/protect)', () => {
    const scripts = runsOf(job).join('\n');
    assert.match(scripts, /gitleaks"? git /);
    assert.doesNotMatch(scripts, /gitleaks"? (detect|protect)/);
  });
});

describe('dependabot.yml', () => {
  it('version 2 avec npm et github-actions, hebdomadaires à Paris, avec cooldown', () => {
    assert.equal(dependabot.version, 2);
    const ecosystems = dependabot.updates.map((u) => u['package-ecosystem']).sort();
    assert.deepEqual(ecosystems, ['github-actions', 'npm']);
    for (const u of dependabot.updates) {
      assert.equal(u.schedule.interval, 'weekly');
      assert.equal(u.schedule.timezone, 'Europe/Paris');
      assert.ok((u.cooldown['default-days'] ?? 0) >= 1);
    }
  });

  it('le cooldown de github-actions n’utilise pas les clés semver-*', () => {
    const actions = dependabot.updates.find((u) => u['package-ecosystem'] === 'github-actions');
    assert.ok(actions);
    for (const key of Object.keys(actions.cooldown)) {
      assert.ok(!key.startsWith('semver-'), `clé non supportée : ${key}`);
    }
  });
});
