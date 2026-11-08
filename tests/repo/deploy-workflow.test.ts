// Livraison et sonde (HEB-02, HEB-10 à HEB-14, OPS-01 ; D-08 à D-11, D-14) : structure et propriétés de sécurité des
// jobs gel et deploy de ci.yml. Les workflows sont lus avec le paquet yaml, comme le reste des tests de dépôt.
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
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  env?: Record<string, unknown>;
  with?: Record<string, unknown>;
};
type Job = {
  name?: string;
  needs?: string[];
  if?: string;
  environment?: unknown;
  concurrency?: unknown;
  outputs?: Record<string, string>;
  env?: Record<string, unknown>;
  'timeout-minutes'?: number;
  steps: Step[];
};
type Workflow = {
  name?: string;
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: unknown;
  jobs: Record<string, Job>;
};

const ciRaw = read('.github/workflows/ci.yml');
const ci = parse(ciRaw) as Workflow;
const job = (wf: Workflow, nom: string): Job => {
  const j = wf.jobs[nom];
  assert.ok(j, `job ${nom} absent`);
  return j;
};

/** Options ssh attendues sur chaque appel, guillemets retirés (copiées telles quelles d'un fichier à l'autre). */
const OPTIONS_SSH = [
  '-i $RUNNER_TEMP/cle',
  '-o IdentitiesOnly=yes',
  '-o BatchMode=yes',
  '-o StrictHostKeyChecking=yes',
  '-o UserKnownHostsFile=$RUNNER_TEMP/kh',
  '-o ConnectTimeout=15',
];
/** Expression exacte de RTP_DEPLOIEMENT : la production est toujours construite avec la garde (HEB-14). */
const EXPR_DEPLOIEMENT = "${{ vars.DEPLOY_CIBLE == 'production' && '1' || '0' }}";

const runs = (j: Job): string[] => j.steps.map((s) => s.run ?? '').filter((r) => r !== '');
const lignesCode = (run: string): string[] =>
  run
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('echo '));

/** Lignes de code qui appellent ssh (directement ou comme transport de rsync). */
function appelsSsh(j: Job): string[] {
  return runs(j)
    .flatMap(lignesCode)
    .filter((l) => /(^|[\s"'(=$])ssh\s/.test(l));
}

function verifierOptionsSsh(j: Job, minimum: number): void {
  const appels = appelsSsh(j);
  assert.ok(appels.length >= minimum, `au moins ${minimum} appels ssh attendus, ${appels.length} trouvés`);
  for (const l of appels) {
    const sansGuillemets = l.replace(/["']/g, '');
    for (const o of OPTIONS_SSH) assert.ok(sansGuillemets.includes(o), `option « ${o} » absente : ${l}`);
  }
}

/** Chemins (job, étape, clé) de toutes les chaînes du workflow qui contiennent « secrets. ». */
function cheminsSecrets(valeur: unknown, chemin: string[] = []): string[][] {
  if (typeof valeur === 'string') return valeur.includes('secrets.') ? [chemin] : [];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => cheminsSecrets(v, [...chemin, String(i)]));
  if (valeur !== null && typeof valeur === 'object') {
    return Object.entries(valeur).flatMap(([k, v]) => cheminsSecrets(v, [...chemin, k]));
  }
  return [];
}

const indexEtape = (j: Job, predicat: (s: Step) => boolean, quoi: string): number => {
  const i = j.steps.findIndex(predicat);
  assert.ok(i >= 0, `étape absente : ${quoi}`);
  return i;
};

describe('ci.yml : déclencheurs du déploiement', () => {
  it('workflow_dispatch avec retrait_urgence (booléen, faux) et justification (texte, vide)', () => {
    const wd = ci.on.workflow_dispatch as { inputs: Record<string, { type: string; default: unknown }> };
    assert.ok(wd?.inputs, 'workflow_dispatch sans inputs');
    assert.deepEqual(Object.keys(wd.inputs).sort(), ['justification', 'retrait_urgence']);
    assert.equal(wd.inputs.retrait_urgence?.type, 'boolean');
    assert.equal(wd.inputs.retrait_urgence?.default, false);
    assert.equal(wd.inputs.justification?.type, 'string');
    assert.equal(wd.inputs.justification?.default, '');
    assert.deepEqual((ci.on.push as { branches: string[] }).branches, ['main']);
    assert.ok('pull_request' in ci.on);
  });

  it('commentaire au-dessus de la concurrence : groupe par exécution sur main', () => {
    const avant = ciRaw.slice(0, ciRaw.indexOf('\nconcurrency:'));
    const iConc = ciRaw.indexOf('\nconcurrency:');
    const bloc = ciRaw.slice(iConc, ciRaw.indexOf('\nenv:'));
    assert.match(avant.split('\n').slice(-4).join('\n') + bloc, /#.*(run_id|exécution)/);
  });
});

describe('ci.yml : job gel (HEB-13)', () => {
  const gel = job(ci, 'gel');

  it('après les trois jobs, seulement sur main (push ou dispatch) et quand DEPLOY_CIBLE est posée', () => {
    assert.deepEqual(gel.needs, ['verifier', 'e2e', 'secrets']);
    assert.equal(
      gel.if,
      "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main' && vars.DEPLOY_CIBLE != ''",
    );
    assert.equal(gel['timeout-minutes'], 5);
    assert.match(gel.name ?? '', /^Garde/);
    assert.equal(gel.environment, undefined);
  });

  it('sortie ok lue depuis l’étape gel, qui appelle garde-gel avec les entrées passées par env', () => {
    assert.deepEqual(gel.outputs, { ok: '${{ steps.gel.outputs.ok }}' });
    const etape = gel.steps.find((s) => s.id === 'gel');
    assert.ok(etape);
    assert.equal(etape.run?.trim(), 'node scripts/garde-gel.ts --urgence "$URGENCE" --justification "$JUSTIFICATION"');
    assert.deepEqual(etape.env, { URGENCE: '${{ inputs.retrait_urgence }}', JUSTIFICATION: '${{ inputs.justification }}' });
    assert.match(gel.steps[0]?.uses ?? '', /^actions\/checkout@/);
    assert.match(gel.steps[1]?.uses ?? '', /^actions\/setup-node@/);
    assert.equal(gel.steps[0]?.with?.['persist-credentials'], false);
  });

  it('aucun secret dans le job gel', () => {
    assert.ok(!JSON.stringify(gel).includes('secrets.'));
  });
});

describe('ci.yml : job deploy (HEB-02, HEB-12, HEB-14)', () => {
  const dep = job(ci, 'deploy');
  const s = dep.steps;

  it('après les trois jobs et la garde, Environment production, concurrence sans annulation, 15 min', () => {
    assert.deepEqual(dep.needs, ['verifier', 'e2e', 'secrets', 'gel']);
    assert.equal(dep.if, "needs.gel.outputs.ok == 'true'");
    assert.equal(dep.environment, 'production');
    assert.deepEqual(dep.concurrency, { group: 'deploy-production', 'cancel-in-progress': false });
    assert.equal(dep['timeout-minutes'], 15);
    assert.match(dep.name ?? '', /^Déployer/);
  });

  it('variables du job : valeurs non secrètes venues de vars et du contexte github', () => {
    assert.deepEqual(dep.env, {
      CIBLE: '${{ vars.DEPLOY_CIBLE }}',
      SHA: '${{ github.sha }}',
      REPO: '${{ github.repository }}',
      DEPLOY_HOST: '${{ vars.DEPLOY_HOST }}',
      DEPLOY_USER: '${{ vars.DEPLOY_USER }}',
      DEPLOY_URL: '${{ vars.DEPLOY_URL }}',
    });
  });

  it('étapes dans l’ordre : checkout, node, npm ci, signatures, tête de main, build, check-dist, clé, rsync, activer, état, fumée, retour, nettoyage', () => {
    const ordre = [
      indexEtape(dep, (x) => x.uses?.startsWith('actions/checkout@') === true, 'checkout'),
      indexEtape(dep, (x) => x.uses?.startsWith('actions/setup-node@') === true, 'setup-node'),
      indexEtape(dep, (x) => x.run?.trim() === 'npm ci', 'npm ci'),
      indexEtape(dep, (x) => x.run?.trim() === 'npm audit signatures', 'npm audit signatures'),
      indexEtape(dep, (x) => x.run?.includes('git ls-remote') === true, 'tête de main'),
      indexEtape(dep, (x) => x.run?.trim() === 'npm run build', 'build'),
      indexEtape(dep, (x) => x.run?.trim() === 'npm run check-dist -- --mode production', 'check-dist'),
      indexEtape(dep, (x) => x.run?.includes('umask 077') === true, 'clé'),
      indexEtape(dep, (x) => x.run?.includes('rsync ') === true, 'rsync'),
      indexEtape(dep, (x) => x.id === 'activer', 'activer'),
      indexEtape(dep, (x) => x.run?.includes('"etat $CIBLE"') === true, 'état'),
      indexEtape(dep, (x) => x.run?.includes('/version.json') === true, 'fumée'),
      indexEtape(dep, (x) => x.run?.includes('"retour $CIBLE"') === true, 'retour'),
      indexEtape(dep, (x) => x.if === 'always()', 'nettoyage'),
    ];
    for (let i = 1; i < ordre.length; i++) assert.ok((ordre[i - 1] as number) < (ordre[i] as number), `ordre rompu à l’étape ${i}`);
    assert.equal(ordre.at(-1), s.length - 1, 'le nettoyage est la dernière étape');
    assert.equal(s[0]?.with?.['persist-credentials'], false);
  });

  it('cible essai ou production, et approbation périmée refusée (le commit doit être la tête de main)', () => {
    const run = s.find((x) => x.run?.includes('git ls-remote'))?.run ?? '';
    assert.match(run, /case "\$CIBLE" in/);
    assert.match(run, /essai\|production\)/);
    assert.ok(run.includes('git ls-remote "https://github.com/$REPO" refs/heads/main'));
    assert.match(run, /"\$TETE" != "\$SHA"/);
    assert.match(run, /::error::/);
    assert.match(run, /exit 1/);
    assert.match(run, /pipefail/);
  });

  it('build et check-dist : corpus réel, expression RTP_DEPLOIEMENT exacte sur les deux étapes (HEB-14)', () => {
    const build = s.find((x) => x.run?.trim() === 'npm run build');
    const check = s.find((x) => x.run?.trim() === 'npm run check-dist -- --mode production');
    for (const x of [build, check]) {
      assert.equal(x?.env?.RTP_CONTENT_ROOT, '.');
      assert.equal(x?.env?.RTP_DEPLOIEMENT, EXPR_DEPLOIEMENT);
    }
    assert.equal(ciRaw.split(EXPR_DEPLOIEMENT).length - 1, 2, 'l’expression n’apparaît que sur ces deux étapes');
    assert.ok(!ciRaw.includes('RTP_DEPLOIEMENT: "0"') && !ciRaw.includes("RTP_DEPLOIEMENT: '0'"));
  });

  it('clé et known_hosts écrits sous umask 077 dans RUNNER_TEMP, non vides, venus du secret et de la variable', () => {
    const etape = s.find((x) => x.run?.includes('umask 077'));
    assert.deepEqual(etape?.env, {
      DEPLOY_SSH_KEY: '${{ secrets.DEPLOY_SSH_KEY }}',
      DEPLOY_KNOWN_HOSTS: '${{ vars.DEPLOY_KNOWN_HOSTS }}',
    });
    const run = etape?.run ?? '';
    assert.ok(run.includes('"$RUNNER_TEMP/cle"') && run.includes('"$RUNNER_TEMP/kh"'));
    assert.ok(run.indexOf('umask 077') < run.indexOf('"$RUNNER_TEMP/cle"'));
    assert.match(run, /test -s "\$RUNNER_TEMP\/cle"/);
    assert.match(run, /test -s "\$RUNNER_TEMP\/kh"/);
    assert.match(run, /printf '%s\\n' "\$DEPLOY_SSH_KEY"/);
  });

  it('rsync -rlt vers <cible>/<sha>/ (jamais -a ni --delete)', () => {
    const run = s.find((x) => x.run?.includes('rsync '))?.run ?? '';
    assert.match(run, /rsync -rlt --chmod=D755,F644 --stats -e "ssh /);
    assert.ok(run.includes('dist/ "$DEPLOY_USER@$DEPLOY_HOST:$CIBLE/$SHA/"'));
    assert.doesNotMatch(run, /rsync\s+(-\w*a|--archive)/);
  });

  it('activer puis état : current doit valoir le commit du run', () => {
    const activer = s.find((x) => x.id === 'activer')?.run ?? '';
    assert.ok(activer.includes('"activer $CIBLE $SHA"'));
    const etat = s.find((x) => x.run?.includes('"etat $CIBLE"'))?.run ?? '';
    assert.ok(etat.includes('courant=$SHA'));
    assert.match(etat, /::error::/);
  });

  it('test de fumée HTTPS : version.json du commit, HSTS et CSP, identifiants par curl --config - et printf', () => {
    const etape = s.find((x) => x.run?.includes('/version.json'));
    assert.deepEqual(etape?.env, {
      DEPLOY_SMOKE_USER: '${{ secrets.DEPLOY_SMOKE_USER }}',
      DEPLOY_SMOKE_PASS: '${{ secrets.DEPLOY_SMOKE_PASS }}',
    });
    const run = etape?.run ?? '';
    for (const attendu of ['--retry 5', '--retry-all-errors', '--config -', 'printf ', `jq -e --arg s "$SHA" '.commit == $s'`, 'GITHUB_STEP_SUMMARY', 'DEPLOY_URL']) {
      assert.ok(run.includes(attendu), `absent : ${attendu}`);
    }
    assert.match(run, /strict-transport-security/i);
    assert.match(run, /content-security-policy/i);
    assert.doesNotMatch(run, /curl[^\n]*(\s-u\s|--user\s)/, 'jamais d’identifiant dans argv');
    assert.match(run, /https:\/\/\*\)/, 'DEPLOY_URL doit être en https');
  });

  it('retour arrière automatique si une étape échoue après une activation réussie', () => {
    const etape = s.find((x) => x.run?.includes('"retour $CIBLE"'));
    assert.equal(etape?.if, "failure() && steps.activer.outcome == 'success'");
  });

  it('nettoyage always() : clé et known_hosts supprimés', () => {
    const etape = s.at(-1);
    assert.equal(etape?.if, 'always()');
    assert.equal(etape?.run?.trim(), 'rm -f "$RUNNER_TEMP/cle" "$RUNNER_TEMP/kh"');
  });

  it('chaque appel ssh porte la clé, IdentitiesOnly, BatchMode, StrictHostKeyChecking=yes, le known_hosts épinglé', () => {
    verifierOptionsSsh(dep, 4);
  });

  it('aucun hôte, adresse IP ou URL du serveur écrit dans le job', () => {
    const texte = JSON.stringify(dep);
    assert.doesNotMatch(texte, /\b\d{1,3}(\.\d{1,3}){3}\b/);
    const urls = texte.match(/https?:\/\/[^\s"'$*)]+/g) ?? [];
    for (const u of urls) assert.equal(u, 'https://github.com/', `URL en dur : ${u}`);
  });

  it('commentaire au-dessus du job : en sommeil sans DEPLOY_CIBLE, essai sans la garde, approbation, tête de main', () => {
    const iDeploy = ciRaw.indexOf('\n  deploy:');
    const iGel = ciRaw.indexOf('\n  gel:');
    const commentaire = ciRaw
      .slice(iGel, iDeploy)
      .split('\n')
      .filter((l) => l.trim().startsWith('#'))
      .join('\n');
    for (const mot of ['DEPLOY_CIBLE', 'essai', 'RTP_DEPLOIEMENT', 'approuve', 'tête de main']) {
      assert.ok(commentaire.includes(mot), `commentaire sans « ${mot} »`);
    }
  });
});

describe('ci.yml : propriétés de sécurité (HEB-10, D-11)', () => {
  it('ni pull_request_target, ni ssh-keyscan, ni StrictHostKeyChecking=no, ni download-artifact', () => {
    for (const interdit of ['pull_request_target', 'ssh-keyscan', 'StrictHostKeyChecking=no', 'download-artifact']) {
      assert.ok(!ciRaw.includes(interdit), interdit);
    }
  });

  it('aucun --delete dans les scripts', () => {
    for (const j of Object.values(ci.jobs)) for (const r of runs(j)) assert.ok(!r.includes('--delete'));
  });

  it('RTP_MODE absent des jobs gel et deploy (aucune build preview livrée)', () => {
    for (const nom of ['gel', 'deploy']) assert.ok(!JSON.stringify(job(ci, nom)).includes('RTP_MODE'), nom);
  });

  it('secrets seulement dans les env d’étapes du job deploy', () => {
    const chemins = cheminsSecrets(ci);
    assert.ok(chemins.length >= 3);
    for (const c of chemins) {
      assert.equal(c[0], 'jobs');
      assert.equal(c[1], 'deploy', c.join('.'));
      assert.equal(c[2], 'steps', c.join('.'));
      assert.equal(c[4], 'env', c.join('.'));
    }
  });

  it('verifier, e2e et secrets n’utilisent aucun Environment', () => {
    for (const nom of ['verifier', 'e2e', 'secrets']) assert.equal(job(ci, nom).environment, undefined, nom);
  });

  it('aucune interpolation ${{ }} dans un corps de script', () => {
    for (const j of Object.values(ci.jobs)) for (const r of runs(j)) assert.ok(!r.includes('${{'), r.slice(0, 60));
  });
});
