// CI locale (LOC-01) : lanceur de processus (scripts/lib/processus.ts), puis exécution des étapes, reçu et verrou
// (scripts/lib/ci-local.ts, scripts/ci-local.ts). Aucun test ne touche le vrai ~/.cache/rtp : le dossier personnel
// est un dossier temporaire injecté.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { envDeBase, lancer, type Lancement, type Lanceur, type Resultat } from '../../scripts/lib/processus.ts';
import {
  ETAPES,
  baseIdsLock,
  cheminRecu,
  ecrireRecu,
  lireRecu,
  prendreVerrou,
  recuValidePourDeploiement,
  type Recu,
} from '../../scripts/lib/ci-local.ts';
import { executer, type Dependances } from '../../scripts/ci-local.ts';

const NODE = process.execPath;
const ENV_MIN = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
const DELAI = 60_000;

describe('envDeBase', () => {
  it('garde la liste blanche, ajoute TZ et la télémétrie coupée, retire le reste', () => {
    const env = envDeBase({ PATH: 'p', HOME: 'h', SSH_AUTH_SOCK: 's', RTP_HOTE: 'x', GITHUB_TOKEN: 't' });
    assert.deepEqual(env, { PATH: 'p', HOME: 'h', TZ: 'Europe/Paris', ASTRO_TELEMETRY_DISABLED: '1' });
  });

  it('garde USER, LOGNAME, SHELL, TMPDIR, LANG, LC_ALL, LC_CTYPE, TERM', () => {
    const source = { USER: 'u', LOGNAME: 'l', SHELL: 's', TMPDIR: 't', LANG: 'fr', LC_ALL: 'a', LC_CTYPE: 'c', TERM: 'x', NPM_TOKEN: 'n' };
    const env = envDeBase(source);
    for (const k of Object.keys(source).filter((k) => k !== 'NPM_TOKEN')) assert.equal(env[k], source[k as keyof typeof source]);
    assert.equal(env.NPM_TOKEN, undefined);
  });
});

describe('lancer', () => {
  it('capture stdout, stderr et le code de sortie', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'process.stdout.write("sortie");process.stderr.write("erreur");process.exit(3)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: DELAI,
      libelle: 'test',
    });
    assert.equal(r.code, 3);
    assert.equal(r.stdout, 'sortie');
    assert.equal(r.stderr, 'erreur');
    assert.equal(r.delaiDepasse, false);
    assert.ok(r.dureeMs >= 0);
  });

  it('tue le processus au-delà du délai', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'setTimeout(() => {}, 120000)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: 500,
      libelle: 'attente',
    });
    assert.equal(r.delaiDepasse, true);
    assert.notEqual(r.code, 0);
  });

  it('écrit l’entrée sur stdin', async () => {
    const r = await lancer({
      commande: NODE,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      cwd: process.cwd(),
      env: ENV_MIN,
      entree: 'bonjour',
      delaiMs: DELAI,
      libelle: 'stdin',
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'bonjour');
  });

  it('passe exactement l’environnement donné, jamais process.env', async () => {
    process.env.SSH_AUTH_SOCK_TEST_CI_LOCAL = 'fuite';
    try {
      const r = await lancer({
        commande: NODE,
        args: ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))'],
        cwd: process.cwd(),
        env: { ...ENV_MIN, VARIABLE_DONNEE: '1' },
        delaiMs: DELAI,
        libelle: 'env',
      });
      // __CF_USER_TEXT_ENCODING est posée par macOS dans l'enfant lui-même (CoreFoundation), pas transmise par lancer.
      const cles = (JSON.parse(r.stdout) as string[]).filter((k) => k !== '__CF_USER_TEXT_ENCODING');
      assert.deepEqual(cles, ['PATH', 'VARIABLE_DONNEE']);
    } finally {
      delete process.env.SSH_AUTH_SOCK_TEST_CI_LOCAL;
    }
  });

  it('commande introuvable : code null et message, sans exception', async () => {
    const r = await lancer({
      commande: 'commande-qui-n-existe-pas-ci-local',
      args: [],
      cwd: process.cwd(),
      env: ENV_MIN,
      delaiMs: DELAI,
      libelle: 'absente',
    });
    assert.equal(r.code, null);
    assert.match(r.stderr, /introuvable|ENOENT/);
  });
});

// ---------- exécution, reçu, verrou, commande (tâche 2) ----------

interface Depot {
  racine: string;
  home: string;
  base: string;
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}

/** Dépôt temporaire : un commit sans ids.lock, un commit qui l'ajoute, poussés sur un origin nu local. */
function depot(): Depot {
  const base = mkdtempSync(path.join(tmpdir(), 'ci-local-'));
  const origin = path.join(base, 'origin.git');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  const racine = path.join(base, 'travail');
  mkdirSync(racine);
  git(racine, 'init', '-q', '-b', 'main');
  git(racine, 'config', 'user.email', 't@exemple.invalid');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'commit.gpgsign', 'false');
  writeFileSync(path.join(racine, '.gitignore'), 'dist/\n');
  writeFileSync(path.join(racine, 'README.md'), 'un\n');
  git(racine, 'add', '.');
  git(racine, 'commit', '-q', '-m', 'un');
  writeFileSync(path.join(racine, 'ids.lock'), 'id-a\n');
  git(racine, 'add', '.');
  git(racine, 'commit', '-q', '-m', 'deux');
  git(racine, 'remote', 'add', 'origin', origin);
  git(racine, 'push', '-q', '-u', 'origin', 'main');
  const home = path.join(base, 'home');
  mkdirSync(home);
  return { racine, home, base };
}

function commitLocal(d: Depot, fichier: string, contenu: string): string {
  writeFileSync(path.join(d.racine, fichier), contenu);
  git(d.racine, 'add', fichier);
  git(d.racine, 'commit', '-q', '-m', `modifie ${fichier}`);
  return git(d.racine, 'rev-parse', 'HEAD');
}

interface OptionsFaux {
  echec?: (ligne: string) => boolean;
  avant?: (ligne: string, l: Lancement) => Promise<void> | void;
  gitleaksAbsent?: boolean;
  git?: (l: Lancement) => Resultat | undefined;
}

/** Lanceur injecté : git passe par le vrai lanceur, toute autre commande est simulée (ok sauf indication). */
function fauxLanceur(o: OptionsFaux = {}): { lancer: Lanceur; appels: Lancement[]; lignes: () => string[] } {
  const appels: Lancement[] = [];
  const f: Lanceur = async (l) => {
    if (l.commande === 'git') {
      const r = o.git?.(l);
      return r ?? lancer(l);
    }
    const ligne = [l.commande, ...l.args].join(' ');
    appels.push(l);
    await o.avant?.(ligne, l);
    const absent = o.gitleaksAbsent === true && l.commande === 'gitleaks';
    const echec = absent || o.echec?.(ligne) === true;
    return {
      code: absent ? null : echec ? 1 : 0,
      signal: null,
      stdout: ligne === 'gitleaks version' && !absent ? '8.30.1\n' : '',
      stderr: echec ? 'échec simulé\n' : '',
      dureeMs: 5,
      delaiDepasse: false,
    };
  };
  return { lancer: f, appels, lignes: () => appels.map((a) => [a.commande, ...a.args].join(' ')) };
}

async function ciLocale(d: Depot, f: { lancer: Lanceur }, argv: string[] = [], extra: Partial<Dependances> = {}): Promise<{ code: number; texte: string }> {
  const sortie: string[] = [];
  const code = await executer(argv, {
    lancer: f.lancer,
    home: d.home,
    racine: d.racine,
    ecrire: (l) => sortie.push(l),
    maintenant: () => new Date('2026-11-18T10:00:00Z'),
    versionNode: 'v24.22.2',
    ...extra,
  });
  return { code, texte: sortie.join('\n') };
}

const recuDe = (d: Depot): Recu | null => lireRecu(d.home, git(d.racine, 'rev-parse', 'HEAD'));
const GARDEES = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TZ', 'ASTRO_TELEMETRY_DISABLED', 'RTP_CONTENT_ROOT', 'RTP_MODE']);

describe('ci:local : exécution complète', () => {
  it('tout vert sur un arbre propre : code 0, une ligne par étape, reçu 0700/0600 valide', async () => {
    const d = depot();
    const f = fauxLanceur();
    const avantAgent = process.env.SSH_AUTH_SOCK;
    process.env.SSH_AUTH_SOCK = '/tmp/agent-factice';
    const { code, texte } = await ciLocale(d, f).finally(() => {
      if (avantAgent === undefined) delete process.env.SSH_AUTH_SOCK;
      else process.env.SSH_AUTH_SOCK = avantAgent;
    });
    assert.equal(code, 0, texte);
    for (const e of ETAPES) assert.match(texte, new RegExp(`\\[ok\\] ${e.nomCi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(`));
    const sha = git(d.racine, 'rev-parse', 'HEAD');
    const chemin = cheminRecu(d.home, sha);
    assert.equal(statSync(chemin).mode & 0o777, 0o600);
    assert.equal(statSync(path.dirname(chemin)).mode & 0o777, 0o700);
    const recu = recuDe(d);
    assert.ok(recu);
    assert.match(recu.commit, /^[0-9a-f]{40}$/);
    assert.equal(recu.commit, sha);
    assert.equal(recu.arbre_propre, true);
    assert.equal(recu.partiel, false);
    assert.equal(recu.date, '2026-11-18T10:00:00.000Z');
    assert.equal(recu.node, 'v24.22.2');
    assert.equal(recu.secrets, 'ok');
    assert.equal(recu.gitleaks, '8.30.1');
    assert.equal(recu.etapes.length, ETAPES.length);
    assert.equal(recuValidePourDeploiement(recu, sha).ok, true);
    assert.match(texte, /reçu écrit : /);
    // HEAD = origin/main (commit déjà poussé) : base = premier parent, qui n'a pas de ids.lock.
    assert.equal(recu.base_ids, git(d.racine, 'rev-parse', 'HEAD^1'));
    assert.match(texte, /ids\.lock n'existe pas dans le commit de base/);
    assert.ok(!f.lignes().some((l) => l.startsWith('npm run ids')));
    // Environnement : envDeBase() plus les variables de l'étape, jamais process.env tel quel.
    for (const a of f.appels) {
      for (const k of Object.keys(a.env)) assert.ok(GARDEES.has(k), `variable ${k} transmise à ${a.commande}`);
      assert.equal(a.env.TZ, 'Europe/Paris');
      assert.equal(a.cwd, d.racine);
    }
    assert.equal(f.appels.find((a) => a.args.includes('dist-preview') && a.args.includes('build'))?.env.RTP_MODE, 'preview');
  });

  it('une étape échoue : code 1, les suivantes tournent, le reçu la note en échec et il est refusé', async () => {
    const d = depot();
    const f = fauxLanceur({ echec: (l) => l === 'npm run check' });
    const { code, texte } = await ciLocale(d, f);
    assert.equal(code, 1);
    assert.match(texte, /\[échec\] Vérifier les types \(astro check\)/);
    assert.ok(f.lignes().includes('npm test'));
    assert.ok(f.lignes().includes('npm run e2e'));
    const recu = recuDe(d);
    assert.equal(recu?.etapes.find((e) => e.id === 'check')?.resultat, 'echec');
    const v = recuValidePourDeploiement(recu, git(d.racine, 'rev-parse', 'HEAD'));
    assert.equal(v.ok, false);
    assert.match(v.motif, /Vérifier les types \(astro check\)/);
  });

  it('échec e2e : rappel du rapport Playwright', async () => {
    const d = depot();
    const { code, texte } = await ciLocale(d, fauxLanceur({ echec: (l) => l === 'npm run e2e' }));
    assert.equal(code, 1);
    assert.match(texte, /playwright-report/);
  });

  it('gitleaks absent : « non exécutée » en toutes lettres, code 0, reçu refusé en nommant gitleaks', async () => {
    const d = depot();
    const f = fauxLanceur({ gitleaksAbsent: true });
    const { code, texte } = await ciLocale(d, f);
    assert.equal(code, 0, texte);
    assert.match(texte, /\[non exécutée\] Chercher des secrets : gitleaks absent \(brew install gitleaks\)/);
    assert.match(texte, /recherche de secrets non exécutée : ce reçu ne permet pas de déployer/);
    assert.ok(!f.lignes().some((l) => l.startsWith('gitleaks git')));
    assert.ok(f.lignes().includes('npm run e2e'), 'le reste est quand même vérifié');
    const recu = recuDe(d);
    assert.equal(recu?.secrets, 'non_executee');
    assert.equal(recu?.gitleaks, null);
    const v = recuValidePourDeploiement(recu, git(d.racine, 'rev-parse', 'HEAD'));
    assert.equal(v.ok, false);
    assert.match(v.motif, /gitleaks/);
  });
});

describe('ci:local : arbre propre et HEAD immobile', () => {
  it('fichier non suivi et non ignoré au départ : étapes lancées, aucun reçu', async () => {
    const d = depot();
    writeFileSync(path.join(d.racine, 'nouveau.txt'), 'x\n');
    const f = fauxLanceur();
    const { texte } = await ciLocale(d, f);
    assert.ok(f.lignes().length > 0);
    assert.match(texte, /arbre de travail non propre : aucun reçu/);
    assert.equal(recuDe(d), null);
  });

  it('fichier ignoré par .gitignore : reçu écrit', async () => {
    const d = depot();
    mkdirSync(path.join(d.racine, 'dist'));
    writeFileSync(path.join(d.racine, 'dist', 'x'), 'x\n');
    const { code } = await ciLocale(d, fauxLanceur());
    assert.equal(code, 0);
    assert.equal(recuDe(d)?.arbre_propre, true);
  });

  it('fichier créé par une étape pendant l’exécution : aucun reçu', async () => {
    const d = depot();
    const f = fauxLanceur({
      avant: (l) => {
        if (l === 'npm test') writeFileSync(path.join(d.racine, 'trace.txt'), 'x\n');
      },
    });
    const { texte } = await ciLocale(d, f);
    assert.match(texte, /arbre de travail non propre : aucun reçu/);
    assert.equal(recuDe(d), null);
    rmSync(path.join(d.racine, 'trace.txt'));
    assert.equal(recuDe(d), null);
  });

  it('HEAD déplacé pendant l’exécution : aucun reçu, ni pour l’ancien ni pour le nouveau commit', async () => {
    const d = depot();
    const avant = git(d.racine, 'rev-parse', 'HEAD');
    const f = fauxLanceur({
      avant: (l) => {
        if (l === 'npm test') commitLocal(d, 'autre.txt', 'y\n');
      },
    });
    const { texte } = await ciLocale(d, f);
    assert.match(texte, /HEAD a changé pendant l'exécution : aucun reçu/);
    assert.equal(lireRecu(d.home, avant), null);
    assert.equal(recuDe(d), null);
  });
});

describe('ci:local : exécution partielle et options', () => {
  it('--etapes migrate-fictif,check : seules ces deux étapes, reçu partiel refusé', async () => {
    const d = depot();
    const f = fauxLanceur();
    const { code } = await ciLocale(d, f, ['--etapes', 'migrate-fictif,check']);
    assert.equal(code, 0);
    assert.deepEqual(f.lignes(), ['npm run migrate -- --check', 'npm run check']);
    const recu = recuDe(d);
    assert.equal(recu?.partiel, true);
    const v = recuValidePourDeploiement(recu, git(d.racine, 'rev-parse', 'HEAD'));
    assert.equal(v.ok, false);
    assert.match(v.motif, /partiel/);
  });

  it('--etapes avec un identifiant inconnu : code 2 et liste des identifiants', async () => {
    const d = depot();
    const f = fauxLanceur();
    const { code, texte } = await ciLocale(d, f, ['--etapes', 'check,inconnue']);
    assert.equal(code, 2);
    assert.match(texte, /inconnue/);
    for (const e of ETAPES) assert.ok(texte.includes(e.id), e.id);
    assert.deepEqual(f.lignes(), []);
  });

  it('option inconnue (--oui) : code 2 ; --liste : chaque identifiant et son nom ci.yml', async () => {
    const d = depot();
    assert.equal((await ciLocale(d, fauxLanceur(), ['--oui'])).code, 2);
    const { code, texte } = await ciLocale(d, fauxLanceur(), ['--liste']);
    assert.equal(code, 0);
    for (const e of ETAPES) assert.ok(texte.includes(e.id) && texte.includes(e.nomCi), e.id);
  });

  it('Node autre que 24 : code 2', async () => {
    const d = depot();
    const f = fauxLanceur();
    const { code, texte } = await ciLocale(d, f, [], { versionNode: 'v22.23.3' });
    assert.equal(code, 2);
    assert.match(texte, /Node 24/);
    assert.deepEqual(f.lignes(), []);
  });

  it('pas un dépôt git : code 2', async () => {
    const d = depot();
    const vide = mkdtempSync(path.join(tmpdir(), 'ci-local-vide-'));
    const { code } = await ciLocale({ ...d, racine: vide }, fauxLanceur());
    assert.equal(code, 2);
  });
});

describe('ci:local : base de ids.lock', () => {
  it('HEAD en avance sur origin/main : base = merge-base, ids.lock de la base passé à npm run ids', async () => {
    const d = depot();
    const pousse = git(d.racine, 'rev-parse', 'HEAD');
    commitLocal(d, 'ids.lock', 'id-a\nid-b\n');
    let contenuBase = '';
    const f = fauxLanceur({
      avant: (l, lt) => {
        if (l.startsWith('npm run ids')) contenuBase = readFileSync(lt.args[lt.args.length - 1] ?? '', 'utf8');
      },
    });
    const r = await baseIdsLock(f.lancer, d.racine);
    assert.equal(r.base, pousse);
    const { code } = await ciLocale(d, f, ['--etapes', 'ids-lock']);
    assert.equal(code, 0);
    assert.equal(contenuBase, 'id-a\n');
    assert.equal(recuDe(d)?.base_ids, pousse);
    const ids = f.lignes().find((l) => l.startsWith('npm run ids'));
    assert.match(ids ?? '', /^npm run ids -- --check --base \S+$/);
  });

  it('HEAD égal à origin/main : base = HEAD^1', async () => {
    const d = depot();
    const r = await baseIdsLock(fauxLanceur().lancer, d.racine);
    assert.equal(r.base, git(d.racine, 'rev-parse', 'HEAD^1'));
  });

  it('commit de base introuvable : étape en échec (échec fermé)', async () => {
    const d = depot();
    const f = fauxLanceur({
      git: (l) =>
        l.args[0] === 'merge-base'
          ? { code: 0, signal: null, stdout: `${'d'.repeat(40)}\n`, stderr: '', dureeMs: 1, delaiDepasse: false }
          : undefined,
    });
    const { code, texte } = await ciLocale(d, f, ['--etapes', 'ids-lock']);
    assert.equal(code, 1);
    assert.match(texte, /introuvable/);
    assert.equal(recuDe(d)?.etapes[0]?.resultat, 'echec');
  });

  it('origin/main absent : base introuvable, étape en échec', async () => {
    const d = depot();
    git(d.racine, 'remote', 'remove', 'origin');
    const { code } = await ciLocale(d, fauxLanceur(), ['--etapes', 'ids-lock']);
    assert.equal(code, 1);
  });
});

describe('recuValidePourDeploiement', () => {
  const sha = 'a'.repeat(40);
  const vert = (): Recu => ({
    version: 1,
    commit: sha,
    date: '2026-11-18T10:00:00.000Z',
    node: 'v24.22.2',
    arbre_propre: true,
    partiel: false,
    base_ids: 'b'.repeat(40),
    secrets: 'ok',
    gitleaks: '8.30.1',
    etapes: ETAPES.map((e) => ({ id: e.id, nomCi: e.nomCi, resultat: 'ok' as const, duree_ms: 1 })),
  });

  it('reçu complet et vert pour ce commit : accepté', () => {
    assert.equal(recuValidePourDeploiement(vert(), sha).ok, true);
  });

  it('chaque défaut est refusé avec son propre motif', () => {
    const motifs = new Set<string>();
    const cas: [string, Recu | null][] = [
      ['aucun', null],
      ['autre commit', { ...vert(), commit: 'c'.repeat(40) }],
      ['version', { ...vert(), version: 2 as unknown as 1 }],
      ['partiel', { ...vert(), partiel: true }],
      ['arbre', { ...vert(), arbre_propre: false }],
      ['secrets', { ...vert(), secrets: 'non_executee' }],
      ['étape', { ...vert(), etapes: vert().etapes.map((e) => (e.id === 'test' ? { ...e, resultat: 'echec' as const } : e)) }],
      ['étape manquante', { ...vert(), etapes: vert().etapes.filter((e) => e.id !== 'e2e') }],
    ];
    for (const [nom, recu] of cas) {
      const v = recuValidePourDeploiement(recu, sha);
      assert.equal(v.ok, false, nom);
      assert.ok(v.motif.length > 0, nom);
      motifs.add(v.motif);
    }
    assert.equal(motifs.size, cas.length);
  });

  it('lireRecu : JSON invalide ou forme inattendue donnent null', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'ci-local-recu-'));
    const chemin = cheminRecu(home, sha);
    mkdirSync(path.dirname(chemin), { recursive: true });
    writeFileSync(chemin, '{pas du json');
    assert.equal(lireRecu(home, sha), null);
    writeFileSync(chemin, JSON.stringify({ version: 1, commit: sha }));
    assert.equal(lireRecu(home, sha), null);
    ecrireRecu(home, vert());
    assert.deepEqual(lireRecu(home, sha), vert());
  });

  it('cheminRecu refuse un commit qui n’a pas 40 hexadécimaux', () => {
    assert.throws(() => cheminRecu('/tmp', '../../etc'));
  });
});

describe('ci:local : verrou', () => {
  it('deux exécutions ne se chevauchent pas : la seconde sort en 2 en nommant le pid', async () => {
    const d = depot();
    let liberer: () => void = () => {};
    let demarre: () => void = () => {};
    const enCours = new Promise<void>((r) => {
      demarre = r;
    });
    const attente = new Promise<void>((r) => {
      liberer = r;
    });
    const premier = ciLocale(d, fauxLanceur({ avant: async (l) => { if (l === 'npm run check') { demarre(); await attente; } } }), ['--etapes', 'check']);
    await enCours;
    const second = await ciLocale(d, fauxLanceur(), ['--etapes', 'check']);
    liberer();
    assert.equal(second.code, 2);
    assert.match(second.texte, new RegExp(String(process.pid)));
    assert.equal((await premier).code, 0);
    // Verrou rendu : une troisième exécution passe.
    assert.equal((await ciLocale(d, fauxLanceur(), ['--etapes', 'check'])).code, 0);
  });

  it('verrou laissé par un processus mort : repris avec un avertissement', async () => {
    const d = depot();
    const mort = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
    const dossier = path.join(d.home, '.cache', 'rtp', 'ci', '.verrou');
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, 'pid'), mort.stdout);
    const { code, texte } = await ciLocale(d, fauxLanceur(), ['--etapes', 'check']);
    assert.equal(code, 0, texte);
    assert.match(texte, /repris/);
  });

  it('prendreVerrou : pris, refusé tant qu’il est tenu, rendu', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'ci-local-verrou-'));
    const dossier = path.join(home, 'v');
    const rendre = prendreVerrou(dossier);
    assert.throws(() => prendreVerrou(dossier), new RegExp(String(process.pid)));
    rendre();
    prendreVerrou(dossier)();
  });

  it('IN-05 : verrou abandonné repris par renommage, sans reste ; un verrou repris entre-temps par un autre est rendu', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'ci-local-verrou-'));
    const dossier = path.join(home, 'v');
    const mort = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, 'pid'), mort.stdout);
    const avertissements: string[] = [];
    const rendre = prendreVerrou(dossier, (m) => avertissements.push(m));
    assert.match(avertissements.join('\n'), /repris/);
    assert.equal(readFileSync(path.join(dossier, 'pid'), 'utf8'), String(process.pid));
    assert.deepEqual(readdirSync(home).filter((n) => n.includes('.abandon-')), [], 'aucun verrou renommé laissé');
    rendre();

    // Course : le verrou mort est remplacé par celui d'un processus vivant juste avant le renommage. Le pid relu
    // après le renommage n'est plus le pid mort : le verrou est rendu à son détenteur, VerrouPris.
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, 'pid'), mort.stdout);
    const vivant = String(process.ppid);
    let premiere = true;
    // Le second processus a repris : son pid est déjà écrit quand le premier renomme.
    const avertir = (): void => {
      if (premiere) writeFileSync(path.join(dossier, 'pid'), vivant);
      premiere = false;
    };
    assert.throws(() => prendreVerrou(dossier, avertir), /une autre exécution tourne déjà/);
    assert.equal(readFileSync(path.join(dossier, 'pid'), 'utf8'), vivant, 'verrou du second processus rendu intact');
    assert.deepEqual(readdirSync(home).filter((n) => n.includes('.abandon-')), []);
  });
});
