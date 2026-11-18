// Gardes de dépôt de `npm run deploy:local` (phase 9.2, LOC-02, LOC-04 ; T-09.2-31, T-09.2-36, T-09.2-37).
// - Graphe d'imports : le processus qui tient la clé (scripts/deploy-local.ts et tout ce qu'il importe) n'importe
//   que des modules node: ; aucun paquet npm, rien de node_modules (WR-04 : aucun code de dépendance avec la clé).
// - Aucun contournement de la confirmation : ni champ de Dependances, ni option, ni variable d'environnement.
// - Parité avec le job deploy de ci.yml : chaque étape a son équivalent local (GARDES_DEPLOIEMENT) ou une exclusion
//   écrite (EXCLUSIONS_DEPLOY), dans l'ordre du job ; identifiants de revue présents dans le code.
// - Aucune valeur du serveur dans le code : ni adresse IPv4, ni domaine du site.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { EXCLUSIONS_DEPLOY, GARDES_DEPLOIEMENT } from '../../scripts/lib/deploiement/deployer.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'scripts', 'deploy-local.ts');
const DOSSIER = path.join(ROOT, 'scripts', 'lib', 'deploiement');
const lire = (f: string): string => readFileSync(f, 'utf8');
const rel = (f: string): string => path.relative(ROOT, f).split(path.sep).join('/');

function fichiersTs(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) return fichiersTs(p);
    return e.isFile() && e.name.endsWith('.ts') ? [p] : [];
  });
}
const MODULES_DEPLOIEMENT = [CLI, ...fichiersTs(DOSSIER)];

/** Spécificateurs importés (statiques, dynamiques, réexports, imports de type compris). */
function specificateurs(texte: string): string[] {
  return [...texte.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
}

describe('graphe d\'imports du processus qui tient la clé (WR-04, T-09.2-31)', () => {
  const vus = new Set<string>();
  const nus = new Map<string, string>();
  const aVoir = [CLI];
  while (aVoir.length > 0) {
    const f = aVoir.pop() as string;
    if (vus.has(f)) continue;
    vus.add(f);
    for (const s of specificateurs(lire(f))) {
      if (s.startsWith('.')) {
        const cible = path.resolve(path.dirname(f), s);
        assert.ok(existsSync(cible), `${rel(f)} importe ${s}, introuvable`);
        aVoir.push(cible);
      } else {
        nus.set(`${rel(f)} -> ${s}`, s);
      }
    }
  }

  it('suit les imports relatifs jusqu\'à garde-gel.ts et src/lib/dates-tours.ts', () => {
    const liste = [...vus].map(rel);
    for (const attendu of [
      'scripts/deploy-local.ts',
      'scripts/lib/deploiement/deployer.ts',
      'scripts/lib/deploiement/construire.ts',
      'scripts/lib/deploiement/transport.ts',
      'scripts/lib/deploiement/agent.ts',
      'scripts/lib/processus.ts',
      'scripts/lib/ci-local.ts',
      'scripts/garde-gel.ts',
      'src/lib/dates-tours.ts',
    ]) {
      assert.ok(liste.includes(attendu), `${attendu} absent du graphe : ${liste.join(', ')}`);
    }
  });

  it('chaque spécificateur non relatif est un module node:', () => {
    assert.ok(nus.size > 10, 'imports node: relevés');
    const fautifs = [...nus].filter(([, s]) => !s.startsWith('node:')).map(([k]) => k);
    assert.deepEqual(fautifs, []);
  });

  it('rien sous node_modules', () => {
    assert.deepEqual([...vus].filter((f) => f.includes(`${path.sep}node_modules${path.sep}`)), []);
  });
});

describe('aucun contournement de la confirmation (D-06, T-09.2-37)', () => {
  const cli = lire(CLI);

  it('Dependances de la CLI : ni terminal, ni lireLigne, ni confirmation', () => {
    const m = /export interface Dependances \{([\s\S]*?)\n\}/.exec(cli);
    assert.ok(m, 'interface Dependances introuvable');
    const champs = [...(m[1] as string).matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map((x) => x[1] as string);
    assert.ok(champs.length >= 3, champs.join(', '));
    const interdits = champs.filter((c) => ['terminal', 'lireLigne', 'confirmer'].includes(c) || /confirm/i.test(c));
    assert.deepEqual(interdits, []);
  });

  it('dans scripts/, confirmer: ne reçoit que confirmerSurTerminal (ou le type Confirmateur dans une interface)', () => {
    const occurrences: string[] = [];
    for (const f of fichiersTs(path.join(ROOT, 'scripts'))) {
      for (const m of lire(f).matchAll(/\bconfirmer\??\s*:\s*([A-Za-z_$][\w$]*)/g)) occurrences.push(`${rel(f)} : ${m[1] as string}`);
    }
    assert.ok(occurrences.some((o) => o.endsWith(': confirmerSurTerminal')), occurrences.join('\n'));
    assert.deepEqual(occurrences.filter((o) => !/: (confirmerSurTerminal|Confirmateur)$/.test(o)), []);
  });

  it('aucune option de parseArgs du type --oui, --yes, --batch, --confirmer', () => {
    assert.equal(cli.split('parseArgs(').length, 2, 'un seul appel de parseArgs');
    const debut = cli.indexOf('{', cli.indexOf('options:', cli.indexOf('parseArgs(')));
    assert.ok(debut > 0, 'options de parseArgs introuvables');
    let profondeur = 0;
    let fin = debut;
    for (; fin < cli.length; fin++) {
      if (cli[fin] === '{') profondeur++;
      else if (cli[fin] === '}' && --profondeur === 0) break;
    }
    const corps = cli.slice(debut + 1, fin);
    // Clés de premier niveau : celles suivies de « : { » (chaque option est un objet { type: … }).
    const options = [...corps.matchAll(/['"]?([a-z][\w-]*)['"]?\s*:\s*\{/g)].map((x) => x[1] as string);
    assert.deepEqual(options.sort(), ['dry-run', 'forcer', 'justification', 'urgence']);
    for (const interdit of ['oui', 'yes', 'y', 'force-confirm', 'non-interactif', 'batch', 'confirmer', 'assume-yes']) {
      assert.ok(!options.includes(interdit), interdit);
    }
  });

  it('aucune lecture de process.env.X dans la CLI ni sous scripts/lib/deploiement/ ; process.env seul, une fois, comme source par défaut de la build', () => {
    const lectures: string[] = [];
    const brutes: string[] = [];
    for (const f of MODULES_DEPLOIEMENT) {
      const t = lire(f);
      if (/process\.env\s*(?:\.|\[|\?\.)/.test(t)) lectures.push(rel(f));
      for (const ligne of t.split('\n')) if (/\bprocess\.env\b/.test(ligne)) brutes.push(`${rel(f)} : ${ligne.trim()}`);
    }
    assert.deepEqual(lectures, []);
    assert.deepEqual(brutes, ['scripts/lib/deploiement/construire.ts : const source = o.source ?? process.env;']);
  });

  for (const option of ['--oui', '--yes']) {
    it(`CLI lancée avec ${option} : code 2, avant toute autre vérification`, async () => {
      const home = mkdtempSync(path.join(tmpdir(), 'rtp-home-option-'));
      try {
        const { code, sortie } = await new Promise<{ code: number | null; sortie: string }>((resolve) => {
          const enfant = spawn(process.execPath, [CLI, option], { cwd: ROOT, env: { HOME: home, PATH: process.env.PATH ?? '', TZ: 'Europe/Paris' }, stdio: ['pipe', 'pipe', 'pipe'] });
          let s = '';
          enfant.stdout.setEncoding('utf8');
          enfant.stderr.setEncoding('utf8');
          enfant.stdout.on('data', (d: string) => (s += d));
          enfant.stderr.on('data', (d: string) => (s += d));
          enfant.stdin.end('oui\n');
          const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 120_000);
          enfant.on('close', (c) => {
            clearTimeout(minuteur);
            resolve({ code: c, sortie: s });
          });
        });
        assert.equal(code, 2, sortie);
        assert.match(sortie, /Usage : npm run deploy:local/);
        assert.equal(existsSync(path.join(home, '.cache')), false, 'aucun verrou ni reçu');
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });
  }
});

type Step = { name?: string };
type Workflow = { jobs: Record<string, { steps: Step[] }> };

describe('parité avec le job deploy de ci.yml', () => {
  const ci = parse(lire(path.join(ROOT, '.github', 'workflows', 'ci.yml'))) as Workflow;
  const etapes = (ci.jobs.deploy?.steps ?? []).map((s) => s.name ?? '(sans nom)');

  it('les étapes de jobs.deploy, dans l\'ordre, sont la fusion des gardes et des exclusions à leur rang', () => {
    assert.ok(etapes.length >= 14, etapes.join('\n'));
    const fusion = GARDES_DEPLOIEMENT.map((g) => g.etapeCi);
    for (const x of [...EXCLUSIONS_DEPLOY].sort((a, b) => a.rang - b.rang)) fusion.splice(x.rang, 0, x.etapeCi);
    assert.deepEqual(fusion, etapes);
  });

  it('chaque exclusion a une raison, chaque garde un équivalent local', () => {
    for (const x of EXCLUSIONS_DEPLOY) assert.ok(x.raison.trim().length > 20, x.etapeCi);
    for (const g of GARDES_DEPLOIEMENT) assert.ok(g.locale.trim().length > 20, g.etapeCi);
  });

  it('les identifiants de revue de ci.yml figurent dans la table des gardes', () => {
    const revues = GARDES_DEPLOIEMENT.flatMap((g) => (g.revue ?? '').split(/,\s*/)).filter((r) => r !== '');
    for (const id of ['CR-01', 'CR-02', 'WR-01', 'IN-07']) assert.ok(revues.includes(id), id);
  });
});

describe('identifiants de revue et valeurs du serveur dans le code', () => {
  it('CR-01, CR-02, WR-01, WR-02, WR-04, IN-07 figurent sous scripts/lib/deploiement/, et tous dans deployer.ts', () => {
    const tout = fichiersTs(DOSSIER).map(lire).join('\n');
    const deployer = lire(path.join(DOSSIER, 'deployer.ts'));
    for (const id of ['CR-01', 'CR-02', 'WR-01', 'WR-02', 'WR-04', 'IN-07']) {
      assert.ok(tout.includes(id), `${id} absent de scripts/lib/deploiement/`);
      assert.ok(deployer.includes(id), `${id} absent de deployer.ts`);
    }
  });

  it('aucune adresse IPv4 ni le domaine du site dans la CLI et scripts/lib/deploiement/', () => {
    const domaine = loadSiteConfig(ROOT).domaine;
    assert.ok(domaine.includes('.'), domaine);
    for (const f of MODULES_DEPLOIEMENT) {
      const t = lire(f);
      assert.doesNotMatch(t, /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/, `adresse IPv4 dans ${rel(f)}`);
      assert.ok(!t.toLowerCase().includes(domaine.toLowerCase()), `domaine du site dans ${rel(f)}`);
    }
  });
});
