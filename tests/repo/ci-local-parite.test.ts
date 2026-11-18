// Parité de la CI locale (scripts/lib/ci-local.ts, LOC-01, D-02) avec les jobs verifier, e2e et secrets de
// .github/workflows/ci.yml : mêmes étapes, même ordre, mêmes commandes et mêmes RTP_CONTENT_ROOT / RTP_MODE pour
// chaque étape « identique ». Une étape ajoutée, retirée, renommée ou déplacée dans ci.yml sans le même changement
// dans le catalogue local fait échouer ce test. Les cas de mutation montrent que la comparaison ne passe pas
// seulement sur le fichier du jour.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ETAPES, EXCLUSIONS_CI, ecartsParite, type CiParite } from '../../scripts/lib/ci-local.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ci = parse(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) as CiParite;
const copie = (): CiParite => structuredClone(ci);
const MIN = 60_000;

describe('CI locale : parité avec ci.yml', () => {
  it('aucun écart entre le catalogue local et les jobs verifier, e2e, secrets', () => {
    assert.deepEqual(ecartsParite(ci, ETAPES, EXCLUSIONS_CI), []);
  });

  it('compte : 19 étapes locales (15 verifier, 2 e2e, 2 secrets) et 9 exclusions', () => {
    assert.equal(ETAPES.length, 19);
    assert.equal(ETAPES.filter((e) => e.job === 'verifier').length, 15);
    assert.equal(ETAPES.filter((e) => e.job === 'e2e').length, 2);
    assert.equal(ETAPES.filter((e) => e.job === 'secrets').length, 2);
    assert.equal(EXCLUSIONS_CI.length, 9);
    assert.equal(ci.jobs.verifier?.steps.length, 18);
    assert.equal(ci.jobs.e2e?.steps.length, 7);
    assert.equal(ci.jobs.secrets?.steps.length, 3);
  });

  it('ordre d’exécution : verifier, puis secrets, puis e2e (le plus long en dernier)', () => {
    const jobs = ETAPES.map((e) => e.job);
    const premierSecrets = jobs.indexOf('secrets');
    const premierE2e = jobs.indexOf('e2e');
    assert.ok(jobs.lastIndexOf('verifier') < premierSecrets);
    assert.ok(jobs.lastIndexOf('secrets') < premierE2e);
  });

  it('identifiants uniques', () => {
    assert.equal(new Set(ETAPES.map((e) => e.id)).size, ETAPES.length);
  });

  it('chaque exclusion et chaque substitution a une raison non vide', () => {
    for (const x of EXCLUSIONS_CI) assert.ok(x.raison.trim().length > 10, `raison vide : ${x.nomCi}`);
    for (const e of ETAPES.filter((x) => x.parite === 'substitution')) {
      assert.ok((e.raison ?? '').trim().length > 10, `raison vide : ${e.nomCi}`);
    }
  });

  it('délais : 10 min au moins, builds 20 min, npm test 30 min, e2e 45 min', () => {
    for (const e of ETAPES) assert.ok(e.delaiMs >= 10 * MIN, `délai trop court : ${e.id}`);
    for (const e of ETAPES.filter((x) => x.commande.join(' ').startsWith('npm run build'))) assert.ok(e.delaiMs >= 20 * MIN, e.id);
    assert.ok((ETAPES.find((e) => e.commande.join(' ') === 'npm test')?.delaiMs ?? 0) >= 30 * MIN);
    assert.ok((ETAPES.find((e) => e.commande.join(' ') === 'npm run e2e')?.delaiMs ?? 0) >= 45 * MIN);
  });

  it('ids.lock et gitleaks sont des étapes spéciales, npm ci est remplacé par npm ls --all', () => {
    assert.equal(ETAPES.find((e) => e.nomCi.startsWith('ids.lock'))?.special, 'ids-lock');
    assert.deepEqual(ETAPES.find((e) => e.nomCi === 'Analyser l\'historique git')?.commande, [
      'gitleaks', 'git', '--no-banner', '--redact', '-v', '.',
    ]);
    assert.deepEqual(ETAPES.find((e) => e.nomCi.startsWith('Installer gitleaks'))?.commande, ['gitleaks', 'version']);
    assert.deepEqual(ETAPES.find((e) => e.nomCi === 'Installer les dépendances (npm ci)')?.commande, ['npm', 'ls', '--all']);
    assert.deepEqual(ETAPES.find((e) => e.job === 'e2e' && e.nomCi.startsWith('Installer Chromium'))?.commande, [
      'npx', 'playwright', 'install', 'chromium',
    ]);
  });
});

describe('CI locale : la comparaison signale chaque dérive (mutations de ci.yml)', () => {
  it('étape renommée', () => {
    const c = copie();
    const s = c.jobs.verifier?.steps.find((x) => x.name === 'Lancer les tests');
    assert.ok(s);
    s.name = 'Lancer les tests unitaires';
    const e = ecartsParite(c, ETAPES, EXCLUSIONS_CI);
    assert.ok(e.some((x) => x.includes('Lancer les tests unitaires')), e.join('\n'));
    assert.ok(e.some((x) => x.includes('« Lancer les tests »')), e.join('\n'));
  });

  it('étape ajoutée', () => {
    const c = copie();
    c.jobs.e2e?.steps.splice(3, 0, { name: 'Nouvelle étape', run: 'npm run nouveau' });
    const e = ecartsParite(c, ETAPES, EXCLUSIONS_CI);
    assert.ok(e.some((x) => x.includes('Nouvelle étape')), e.join('\n'));
  });

  it('étape retirée', () => {
    const c = copie();
    const steps = c.jobs.verifier?.steps ?? [];
    c.jobs.verifier = { steps: steps.filter((x) => x.name !== 'Vérifier les types (astro check)') };
    const e = ecartsParite(c, ETAPES, EXCLUSIONS_CI);
    assert.ok(e.some((x) => x.includes('Vérifier les types (astro check)')), e.join('\n'));
  });

  it('commande changée', () => {
    const c = copie();
    const s = c.jobs.verifier?.steps.find((x) => x.name === 'Lancer les tests');
    assert.ok(s);
    s.run = 'npm test -- --only';
    const e = ecartsParite(c, ETAPES, EXCLUSIONS_CI);
    assert.ok(e.some((x) => x.includes('Lancer les tests') && x.includes('npm test -- --only')), e.join('\n'));
  });

  it('RTP_MODE ou RTP_CONTENT_ROOT changé', () => {
    const c = copie();
    const s = c.jobs.verifier?.steps.find((x) => x.name === 'Construire le site du corpus réel (preview)');
    assert.ok(s?.env);
    s.env.RTP_MODE = 'production';
    assert.ok(ecartsParite(c, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('RTP_MODE')));
    const c2 = copie();
    const s2 = c2.jobs.verifier?.steps.find((x) => x.name === 'migrate (corpus fictif)');
    assert.ok(s2?.env);
    delete s2.env.RTP_CONTENT_ROOT;
    assert.ok(ecartsParite(c2, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('RTP_CONTENT_ROOT')));
  });

  it('deux étapes locales interverties', () => {
    const c = copie();
    const steps = c.jobs.verifier?.steps ?? [];
    const i = steps.findIndex((x) => x.name === 'Vérifier les types (astro check)');
    const a = steps[i];
    const b = steps[i + 1];
    assert.ok(a && b);
    steps[i] = b;
    steps[i + 1] = a;
    assert.ok(ecartsParite(c, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('ordre') || x.includes('rang')));
  });

  it('étape exclue déplacée', () => {
    const c = copie();
    const steps = c.jobs.verifier?.steps ?? [];
    const i = steps.findIndex((x) => x.name?.startsWith('Publier la build preview'));
    const [pub] = steps.splice(i, 1);
    assert.ok(pub);
    steps.splice(5, 0, pub);
    assert.ok(ecartsParite(c, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('Publier la build preview')));
  });

  it('arguments de gitleaks changés', () => {
    const c = copie();
    const s = c.jobs.secrets?.steps.find((x) => x.name === 'Analyser l\'historique git');
    assert.ok(s);
    s.run = '"$RUNNER_TEMP/gitleaks/gitleaks" git --no-banner -v .';
    assert.ok(ecartsParite(c, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('gitleaks')));
  });

  it('job absent', () => {
    const c = copie();
    delete c.jobs.secrets;
    assert.ok(ecartsParite(c, ETAPES, EXCLUSIONS_CI).some((x) => x.includes('secrets')));
  });
});
