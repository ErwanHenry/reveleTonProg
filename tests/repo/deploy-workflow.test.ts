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

/** Liste des chemins qui ne changent pas le site : définie une seule fois, dans l'env du workflow. */
const CHEMINS_HORS_SITE = '.planning/ docs/ tests/ e2e/ audit/ ops/ deploy/ .github/ README.md LICENSE *.md .gitattributes .editorconfig';
/** Condition commune à gel et deploy : push sur main qui touche le site, ou lancement à la main avec deployer (ou retrait_urgence). */
const EXPR_DECLENCHEMENT =
  "((github.event_name == 'push' && needs.changements.outputs.site == 'true') || (github.event_name == 'workflow_dispatch' && (inputs.deployer == true || inputs.retrait_urgence == true)))";
const CLASSEMENT = 'bash ops/site-touche.sh';

describe('ci.yml : déclencheurs du déploiement', () => {
  it('workflow_dispatch avec deployer (booléen, faux), retrait_urgence (booléen, faux) et justification (texte, vide)', () => {
    const wd = ci.on.workflow_dispatch as { inputs: Record<string, { type: string; default: unknown }> };
    assert.ok(wd?.inputs, 'workflow_dispatch sans inputs');
    assert.deepEqual(Object.keys(wd.inputs).sort(), ['deployer', 'justification', 'retrait_urgence']);
    assert.equal(wd.inputs.deployer?.type, 'boolean');
    assert.equal(wd.inputs.deployer?.default, false);
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

describe('ci.yml : liste des chemins hors site (définie une fois)', () => {
  it('dans l’env du workflow, valeur exacte, jamais redéfinie dans un job ou une étape', () => {
    const wf = ci as Workflow & { env: Record<string, string> };
    assert.equal(wf.env.CHEMINS_HORS_SITE, CHEMINS_HORS_SITE);
    assert.equal(ciRaw.split('CHEMINS_HORS_SITE:').length - 1, 1, 'une seule définition');
    for (const [nom, j] of Object.entries(ci.jobs)) {
      assert.ok(!(j.env && 'CHEMINS_HORS_SITE' in j.env), `redéfinie dans le job ${nom}`);
      for (const s of j.steps) assert.ok(!(s.env && 'CHEMINS_HORS_SITE' in s.env), `redéfinie dans une étape de ${nom}`);
    }
  });

  it('les deux usages (changements, deploy) passent par le même classement ops/site-touche.sh, renommages des deux côtés', () => {
    const appels = Object.entries(ci.jobs).flatMap(([nom, j]) => runs(j).filter((r) => r.includes(CLASSEMENT)).map(() => nom));
    assert.deepEqual(appels.sort(), ['changements', 'deploy']);
    for (const nom of ['changements', 'deploy']) {
      const run = runs(job(ci, nom)).find((r) => r.includes(CLASSEMENT)) ?? '';
      assert.match(run, /git diff --no-renames --name-only -z "\$\w+" "\$\w+" \| bash ops\/site-touche\.sh/, nom);
    }
    assert.ok(fs.existsSync(path.join(ROOT, 'ops', 'site-touche.sh')));
  });
});

describe('ci.yml : job changements (un push de documentation seule ne demande aucun déploiement)', () => {
  const ch = job(ci, 'changements');

  it('sur main (push ou dispatch), sans needs, sans Environment ni secret, 5 min, sortie site', () => {
    assert.equal(ch.if, "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'");
    assert.equal(ch.needs, undefined);
    assert.equal(ch.environment, undefined);
    assert.equal(ch['timeout-minutes'], 5);
    assert.ok(!JSON.stringify(ch).includes('secrets.'));
    assert.deepEqual(ch.outputs, { site: '${{ steps.classer.outputs.site }}' });
    assert.deepEqual(ch.steps.map((x) => x.uses?.split('@')[0] ?? 'run'), ['actions/checkout', 'run']);
    assert.equal(ch.steps[0]?.with?.['fetch-depth'], 0);
    assert.equal(ch.steps[0]?.with?.['persist-credentials'], false);
  });

  it('valeurs d’événement par env, site=true par prudence (40 zéros, base introuvable, pas un ancêtre, dispatch)', () => {
    const etape = ch.steps.find((x) => x.id === 'classer');
    assert.deepEqual(etape?.env, { EVENT_NAME: '${{ github.event_name }}', AVANT: '${{ github.event.before }}', APRES: '${{ github.sha }}' });
    const run = etape?.run ?? '';
    assert.match(run, /pipefail/);
    assert.match(run, /^\s*SITE=true$/m, 'true par défaut');
    assert.ok(run.includes('"0000000000000000000000000000000000000000"'));
    assert.ok(run.includes('git cat-file -e "${AVANT}^{commit}"'));
    assert.ok(run.includes('git merge-base --is-ancestor "$AVANT" "$APRES"'));
    assert.ok(run.includes('echo "site=$SITE" >> "$GITHUB_OUTPUT"'));
    assert.match(run, /true\|false\) ;;/, 'verdict contrôlé avant d’être écrit');
  });
});

describe('ci.yml : job gel (HEB-13)', () => {
  const gel = job(ci, 'gel');

  it('après les trois jobs et changements, sur main, DEPLOY_CIBLE posée, push qui touche le site ou dispatch avec deployer', () => {
    assert.deepEqual(gel.needs, ['verifier', 'e2e', 'secrets', 'changements']);
    assert.equal(gel.if, `github.ref == 'refs/heads/main' && vars.DEPLOY_CIBLE != '' && ${EXPR_DECLENCHEMENT}`);
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
    assert.deepEqual(dep.needs, ['verifier', 'e2e', 'secrets', 'changements', 'gel']);
    assert.equal(dep.if, `needs.gel.outputs.ok == 'true' && ${EXPR_DECLENCHEMENT}`);
    assert.ok(EXPR_DECLENCHEMENT.includes("github.event_name == 'push' && needs.changements.outputs.site == 'true'"));
    assert.ok(EXPR_DECLENCHEMENT.includes("github.event_name == 'workflow_dispatch' && (inputs.deployer == true"));
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
    assert.equal(s[0]?.with?.['fetch-depth'], 0);
  });

  it('cible essai ou production ; tête plus récente admise seulement si elle descend du commit et ne change pas le site', () => {
    const run = s.find((x) => x.run?.includes('git ls-remote'))?.run ?? '';
    assert.match(run, /case "\$CIBLE" in/);
    assert.match(run, /essai\|production\)/);
    assert.match(run, /pipefail/);
    const pos = (motif: string): number => {
      const i = run.indexOf(motif);
      assert.ok(i >= 0, `absent : ${motif}`);
      return i;
    };
    const ordre = [
      pos('git ls-remote "https://github.com/$REPO" refs/heads/main'),
      pos('git fetch --quiet --no-tags "https://github.com/$REPO" refs/heads/main'),
      pos('if [ "$TETE" = "$SHA" ]; then'),
      pos('if ! git merge-base --is-ancestor "$SHA" "$TETE"; then'),
      pos('SITE=$(git diff --no-renames --name-only -z "$SHA" "$TETE" | bash ops/site-touche.sh)'),
      pos('if [ "$SITE" != "false" ]; then'),
      pos('tête plus récente sans changement du site : déploiement autorisé'),
    ];
    for (let i = 1; i < ordre.length; i++) assert.ok((ordre[i - 1] as number) < (ordre[i] as number), `ordre rompu à ${i}`);
    // Les deux refus (pas un ancêtre, changements du site) sont des erreurs qui arrêtent le job.
    assert.match(run, /--is-ancestor "\$SHA" "\$TETE"; then\n\s*echo "::error::[^\n]*"\n\s*exit 1/);
    assert.match(run, /"\$SITE" != "false" \]; then\n\s*echo "::error::[^\n]*changements du site[^\n]*"\n\s*exit 1/);
    assert.ok(!run.includes('|| true'), 'aucun échec avalé');
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

  it('rsync -rt vers <cible>/<sha>/ (jamais -a, -l ni --delete : aucun lien symbolique envoyé, CR-01)', () => {
    const run = s.find((x) => x.run?.includes('rsync '))?.run ?? '';
    assert.match(run, /rsync -rt --chmod=D755,F644 --stats -e "ssh /);
    assert.doesNotMatch(run, /rsync\s+-\w*l|--links|--copy-links|-L\b/);
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
    const urls = texte.match(/https?:\/\/[A-Za-z0-9][^\s"'$*)\\]*/g) ?? [];
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

  it('RTP_MODE absent des jobs changements, gel et deploy (aucune build preview livrée)', () => {
    for (const nom of ['changements', 'gel', 'deploy']) assert.ok(!JSON.stringify(job(ci, nom)).includes('RTP_MODE'), nom);
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

  it('verifier, e2e, secrets et changements n’utilisent aucun Environment', () => {
    for (const nom of ['verifier', 'e2e', 'secrets', 'changements']) assert.equal(job(ci, nom).environment, undefined, nom);
  });

  it('aucune interpolation ${{ }} dans un corps de script', () => {
    for (const j of Object.values(ci.jobs)) for (const r of runs(j)) assert.ok(!r.includes('${{'), r.slice(0, 60));
  });
});

const lireWorkflow = (f: string): { raw: string; wf: Workflow } => {
  const raw = fs.existsSync(path.join(ROOT, f)) ? read(f) : '';
  return { raw, wf: (parse(raw) ?? { on: {}, jobs: {} }) as Workflow };
};
const rollback = lireWorkflow('.github/workflows/rollback.yml');
const sonde = lireWorkflow('.github/workflows/sonde.yml');

/** Règles communes aux deux workflows : épinglage, persist-credentials, droits, timeouts, pas de ${{ }} dans run. */
function reglesCommunes(nom: string, raw: string, wf: Workflow): void {
  it(`${nom} : existe, contents: read, aucun pull_request_target ni push ni pull_request`, () => {
    assert.ok(raw.length > 0, `${nom} absent`);
    assert.deepEqual(wf.permissions, { contents: 'read' });
    for (const interdit of ['pull_request_target', 'pull_request', 'push']) assert.ok(!(interdit in wf.on), interdit);
    assert.ok(!raw.includes('pull_request_target'));
  });

  it(`${nom} : actions épinglées par SHA avec # vX, checkout sans identifiants persistés`, () => {
    for (const j of Object.values(wf.jobs)) {
      assert.equal(typeof j['timeout-minutes'], 'number');
      assert.ok(!('permissions' in j));
      for (const s of j.steps) {
        if (s.uses === undefined) continue;
        assert.match(s.uses, /^actions\/(checkout|setup-node)@[0-9a-f]{40}$/);
        if (s.uses.startsWith('actions/checkout@')) assert.equal(s.with?.['persist-credentials'], false);
        if (s.uses.startsWith('actions/setup-node@')) {
          assert.equal(s.with?.['node-version-file'], '.nvmrc');
          assert.equal(s.with?.cache, 'npm');
        }
      }
    }
    for (const l of raw.split('\n').filter((x) => /\buses:/.test(x))) assert.match(l, /@[0-9a-f]{40} # v\d/);
    const pins = [...raw.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    for (const p of pins) assert.ok(ciRaw.includes(`uses: ${p}`), `épinglage différent de ci.yml : ${p}`);
  });

  it(`${nom} : aucune interpolation \${{ }} dans un script, ni ssh-keyscan, ni StrictHostKeyChecking=no`, () => {
    for (const j of Object.values(wf.jobs)) for (const r of runs(j)) assert.ok(!r.includes('${{'), r.slice(0, 60));
    assert.ok(!raw.includes('ssh-keyscan'));
    assert.ok(!raw.includes('StrictHostKeyChecking=no'));
    assert.ok(!raw.includes('RTP_MODE'));
  });

  it(`${nom} : commentaire en tête du fichier`, () => {
    assert.ok(raw.startsWith('#'), 'le fichier commence par un commentaire');
  });
}

describe('rollback.yml : retour arrière (HEB-11, HEB-12, HEB-13)', () => {
  const { raw, wf } = rollback;
  reglesCommunes('rollback.yml', raw, wf);
  const retour = (): Job => job(wf, 'retour');

  it('nom « Retour arrière », workflow_dispatch seul avec cible, version, retrait_urgence et justification', () => {
    assert.equal(wf.name, 'Retour arrière');
    assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
    const inputs = (wf.on.workflow_dispatch as { inputs: Record<string, Record<string, unknown>> }).inputs;
    assert.deepEqual(Object.keys(inputs).sort(), ['cible', 'justification', 'retrait_urgence', 'version']);
    assert.equal(inputs.cible?.type, 'choice');
    assert.deepEqual(inputs.cible?.options, ['essai', 'production']);
    assert.equal(inputs.cible?.required, true);
    assert.equal(inputs.version?.type, 'string');
    assert.equal(inputs.version?.default, '');
    assert.equal(inputs.retrait_urgence?.type, 'boolean');
    assert.equal(inputs.retrait_urgence?.default, false);
    assert.equal(inputs.justification?.type, 'string');
  });

  it('un seul job retour : en sommeil sans DEPLOY_CIBLE, Environment production, même groupe que deploy, 5 min', () => {
    assert.deepEqual(Object.keys(wf.jobs), ['retour']);
    const j = retour();
    assert.equal(j.if, "vars.DEPLOY_CIBLE != ''");
    assert.equal(j.environment, 'production');
    assert.deepEqual(j.concurrency, { group: 'deploy-production', 'cancel-in-progress': false });
    assert.deepEqual(job(ci, 'deploy').concurrency, j.concurrency);
    assert.equal(j['timeout-minutes'], 5);
  });

  it('garde de gel appliquée aux retours, refus = job en échec', () => {
    const j = retour();
    const iGel = indexEtape(j, (s) => s.id === 'gel', 'garde de gel');
    const gel = j.steps[iGel] as Step;
    assert.equal(gel.run?.trim(), 'node scripts/garde-gel.ts --urgence "$URGENCE" --justification "$JUSTIFICATION"');
    assert.deepEqual(gel.env, { URGENCE: '${{ inputs.retrait_urgence }}', JUSTIFICATION: '${{ inputs.justification }}' });
    const refus = j.steps[iGel + 1] as Step;
    assert.equal(refus.if, "steps.gel.outputs.ok != 'true'");
    assert.match(refus.run ?? '', /::error::/);
    assert.match(refus.run ?? '', /exit 1/);
    const iSsh = indexEtape(j, (s) => (s.run ?? '').includes('"retour $CIBLE"'), 'retour ssh');
    assert.ok(iGel < iSsh, 'la garde passe avant toute bascule');
  });

  it('entrées contrôlées : cible essai ou production, version vide ou 40 hex', () => {
    const run = retour().steps.find((s) => (s.run ?? '').includes('[0-9a-f]{40}'))?.run ?? '';
    assert.match(run, /case "\$CIBLE" in/);
    assert.match(run, /essai\|production\)/);
    assert.ok(run.includes('[[ "$VERSION" =~ ^[0-9a-f]{40}$ ]]'));
    assert.match(run, /exit 1/);
  });

  it('retour vers la précédente (version vide) ou vers la version demandée, puis état', () => {
    const j = retour();
    const run = j.steps.find((s) => (s.run ?? '').includes('"retour $CIBLE"'))?.run ?? '';
    assert.ok(run.includes('"retour $CIBLE $VERSION"'));
    assert.match(run, /if \[ -z "\$VERSION" \]/);
    const iRetour = indexEtape(j, (s) => (s.run ?? '').includes('"retour $CIBLE"'), 'retour');
    const iEtat = indexEtape(j, (s) => (s.run ?? '').includes('"etat $CIBLE"'), 'état');
    assert.ok(iRetour < iEtat);
    assert.match(j.steps[iEtat]?.run ?? '', /courant=/);
  });

  it('vérification HTTPS du commit servi quand la cible est celle de DEPLOY_URL', () => {
    const j = retour();
    const etape = j.steps.find((s) => (s.run ?? '').includes('/version.json'));
    assert.ok(etape);
    const run = etape.run ?? '';
    assert.match(run, /"\$CIBLE" != "\$CIBLE_DEPLOYEE"/);
    assert.match(run, /-z "\$DEPLOY_URL"/);
    assert.ok(run.includes(`jq -e --arg s "$COURANT" '.commit == $s'`));
    assert.ok(run.includes('--config -'));
    assert.doesNotMatch(run, /curl[^\n]*(\s-u\s|--user\s)/);
    assert.deepEqual(etape.env, {
      DEPLOY_SMOKE_USER: '${{ secrets.DEPLOY_SMOKE_USER }}',
      DEPLOY_SMOKE_PASS: '${{ secrets.DEPLOY_SMOKE_PASS }}',
    });
    assert.equal(j.env?.CIBLE_DEPLOYEE, '${{ vars.DEPLOY_CIBLE }}');
    assert.equal(j.env?.CIBLE, '${{ inputs.cible }}');
    assert.equal(j.env?.VERSION, '${{ inputs.version }}');
  });

  it('résumé avec l’heure UTC de début et de fin, nettoyage always() en dernier', () => {
    const j = retour();
    const debut = j.steps[0];
    assert.match(debut?.run ?? '', /date -u/);
    assert.match(debut?.run ?? '', /GITHUB_ENV/);
    const resume = j.steps.find((s) => (s.run ?? '').includes('$DEBUT'));
    assert.match(resume?.run ?? '', /date -u/);
    assert.match(resume?.run ?? '', /GITHUB_STEP_SUMMARY/);
    assert.equal(resume?.if, 'always()');
    const fin = j.steps.at(-1);
    assert.equal(fin?.if, 'always()');
    assert.equal(fin?.run?.trim(), 'rm -f "$RUNNER_TEMP/cle" "$RUNNER_TEMP/kh"');
  });

  it('clé et known_hosts comme le job deploy, options ssh copiées à l’identique', () => {
    const j = retour();
    const cle = j.steps.find((s) => (s.run ?? '').includes('umask 077'));
    const cleDeploy = job(ci, 'deploy').steps.find((s) => (s.run ?? '').includes('umask 077'));
    assert.deepEqual(cle?.env, cleDeploy?.env);
    assert.equal(cle?.run, cleDeploy?.run);
    verifierOptionsSsh(j, 3);
    const ligneDeploy = appelsSsh(job(ci, 'deploy')).find((l) => l.startsWith('ssh '))?.split(' "$DEPLOY_USER')[0];
    for (const l of appelsSsh(j)) assert.ok(l.includes(ligneDeploy ?? 'absent'), l);
  });

  it('secrets seulement dans les env d’étapes du job retour', () => {
    const chemins = cheminsSecrets(wf);
    assert.ok(chemins.length >= 3);
    for (const c of chemins) {
      assert.deepEqual(c.slice(0, 3), ['jobs', 'retour', 'steps'], c.join('.'));
      assert.equal(c[4], 'env', c.join('.'));
    }
  });

  it('commentaire de tête : workflow_dispatch, gel appliqué aux retours, urgence', () => {
    const tete = raw.split('\n').filter((l) => l.startsWith('#')).join('\n');
    for (const mot of ['workflow_dispatch', 'gel', 'urgence', 'deploy-production']) assert.ok(tete.includes(mot), mot);
  });
});

describe('sonde.yml : sonde externe de contenu (OPS-01, D-14)', () => {
  const { raw, wf } = sonde;
  reglesCommunes('sonde.yml', raw, wf);
  const j = (): Job => job(wf, 'sonde');
  const run = (): string => j().steps.find((s) => s.run !== undefined)?.run ?? '';
  const code = (): string => lignesCode(run()).join('\n');

  it('nom « Sonde externe », toutes les 10 minutes et à la main, concurrence sonde avec annulation', () => {
    assert.equal(wf.name, 'Sonde externe');
    assert.deepEqual(Object.keys(wf.on).sort(), ['schedule', 'workflow_dispatch']);
    assert.deepEqual(wf.on.schedule, [{ cron: '*/10 * * * *' }]);
    assert.deepEqual(wf.concurrency, { group: 'sonde', 'cancel-in-progress': true });
  });

  it('job sonde : en sommeil sans SONDE_URL, Environment sonde (jamais production), sans checkout, une seule étape', () => {
    assert.deepEqual(Object.keys(wf.jobs), ['sonde']);
    assert.equal(j().if, "vars.SONDE_URL != ''");
    assert.equal(j().environment, 'sonde');
    assert.equal(j()['timeout-minutes'], 5);
    assert.ok(j().steps.every((s) => s.uses === undefined), 'aucune action');
    assert.equal(j().steps.length, 1);
    assert.ok(!/environment: production|name: production/.test(raw));
  });

  it('URL depuis vars, identifiants et ping depuis les secrets, par env', () => {
    assert.deepEqual(j().steps[0]?.env, {
      SONDE_URL: '${{ vars.SONDE_URL }}',
      SONDE_USER: '${{ secrets.SONDE_USER }}',
      SONDE_PASS: '${{ secrets.SONDE_PASS }}',
      SONDE_PING_URL: '${{ secrets.SONDE_PING_URL }}',
    });
    const chemins = cheminsSecrets(wf);
    assert.equal(chemins.length, 3);
    for (const c of chemins) assert.deepEqual(c.slice(0, 5), ['jobs', 'sonde', 'steps', '0', 'env']);
  });

  it('vérifie / (200 et le marqueur reveleTonProg) puis /version.json (200, commit de 7 à 40 hex)', () => {
    const c = code();
    assert.ok(c.includes('"$BASE/"'));
    assert.ok(c.includes('"$BASE/version.json"'));
    assert.match(c, /grep -q 'reveleTonProg'/);
    assert.ok(c.includes('^[0-9a-f]{7,40}$'));
    assert.equal((c.match(/= 200 \]/g) ?? []).length, 2, 'deux contrôles HTTP 200');
    assert.ok(c.includes('--config -'));
    assert.match(c, /-n "\$SONDE_USER"/);
    assert.doesNotMatch(c, /curl[^\n]*(\s-u\s|--user\s)/);
  });

  it('ping Healthchecks seulement après les deux contrôles ; en échec, raison vers /log, ::error::, code 1', () => {
    const c = code();
    const iPing = c.indexOf('curl -fsS -m 10 --retry 3 -o /dev/null "$SONDE_PING_URL"');
    assert.ok(iPing >= 0, 'ping de succès absent');
    assert.ok(iPing > c.indexOf("grep -q 'reveleTonProg'"));
    assert.ok(iPing > c.indexOf('^[0-9a-f]{7,40}$'));
    assert.ok(c.includes('"$SONDE_PING_URL/log"'));
    assert.match(run(), /::error::/);
    assert.match(c, /exit 1/);
    assert.ok(!raw.includes('/fail'), 'jamais d’appel d’échec immédiat');
  });

  it('le marqueur de la sonde existe toujours dans la page (src/layouts/Base.astro)', () => {
    assert.ok(read('src/layouts/Base.astro').includes('>reveleTonProg</a>'));
  });

  it('commentaire de tête : succès seul pingué, 3 échecs (période et délai de grâce), planification retardée ou désactivée', () => {
    const tete = raw.split('\n').filter((l) => l.startsWith('#')).join('\n');
    for (const mot of ['succès', '3 échecs', '60 jours', 'sonde']) assert.ok(tete.includes(mot), mot);
  });
});
