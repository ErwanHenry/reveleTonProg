// Build de déploiement cloisonnée (LOC-02, D-05, WR-04 sur un seul utilisateur Unix) : worktree temporaire du
// commit exact, quatre commandes npm sous sandbox-exec, instantané d'intégrité avant et après, modes normalisés,
// version.json du commit, empreinte. npm est un faux (script sh) en tête de PATH ; HOME est un dossier temporaire
// avec des fichiers factices. Hors du describe « bac à sable », sandbox-exec est aussi un faux qui note le profil
// puis lance la commande : ces cas tournent aussi sur Linux (CI GitHub). Le describe « bac à sable » emploie le vrai
// /usr/bin/sandbox-exec et n'est joué que si sondeBacASable() réussit.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { lancer } from '../../scripts/lib/processus.ts';
import { empreinteArbre } from '../../scripts/lib/deploiement/empreinte.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { comparerInstantanes, prendreInstantane, resoudreExecutables } from '../../scripts/lib/deploiement/executables.ts';
import { cheminCacheNpm, construireDeploiement, DOSSIERS_INTERDITS, envConstruction, profilSandbox, sondeBacASable, type BuildDeploiement } from '../../scripts/lib/deploiement/construire.ts';
import { dossierAgents } from '../../scripts/lib/deploiement/agent.ts';

const CLE = 'CLE-PRIVEE-FACTICE';
const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
function temp(prefixe: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefixe)));
  dossiers.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
function ecrireExecutable(p: string, contenu: string): void {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, contenu);
  chmodSync(p, 0o755);
}
const commandeV = (nom: string): string => {
  const r = spawnSync('sh', ['-c', `command -v ${nom}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${nom} introuvable`);
  return r.stdout.trim();
};
const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

type Scenario = 'normal' | 'autre-commit' | 'dev' | 'lien' | 'audit-echec';

interface Banc {
  racine: string;
  home: string;
  tmp: string;
  bin: string;
  log: string;
  profilLog: string;
  sha: string;
  cleExterne: string;
  source: NodeJS.ProcessEnv;
}

function banc(o: { scenario?: Scenario; fauxSandbox?: boolean; attaques?: boolean } = {}): Banc {
  const scenario = o.scenario ?? 'normal';
  const fauxSandbox = o.fauxSandbox ?? true;
  const racine = temp('rtp-depot-');
  git(racine, 'init', '--quiet', '-b', 'main');
  git(racine, 'config', 'user.email', 't@exemple.invalid');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'commit.gpgsign', 'false');
  writeFileSync(path.join(racine, 'package.json'), '{"name":"factice"}\n');
  git(racine, 'add', 'package.json');
  git(racine, 'commit', '--quiet', '-m', 'c0');
  const sha = git(racine, 'rev-parse', 'HEAD');
  const nu = temp('rtp-origine-');
  git(nu, 'init', '--quiet', '--bare', '-b', 'main');
  git(racine, 'remote', 'add', 'origin', nu);
  git(racine, 'push', '--quiet', 'origin', 'main');

  const home = temp('rtp-home-');
  mkdirSync(path.join(home, '.config', 'rtp'), { recursive: true });
  mkdirSync(path.join(home, '.ssh'));
  mkdirSync(path.join(home, '.config', 'gh'));
  writeFileSync(path.join(home, '.config', 'rtp', 'rtp-deploy-mac'), `${CLE}\n`);
  writeFileSync(path.join(home, '.config', 'rtp', 'deploiement.env'), 'RTP_CIBLE=essai\n');
  writeFileSync(path.join(home, '.ssh', 'id_factice'), `${CLE}\n`);
  writeFileSync(path.join(home, '.config', 'gh', 'hosts.yml'), `${CLE}\n`);
  const ailleurs = temp('rtp-ailleurs-');
  const cleExterne = path.join(ailleurs, 'cle-externe');
  writeFileSync(cleExterne, `${CLE}\n`);

  const tmp = temp('rtp-tmp-');
  const bin = temp('rtp-bin-');
  // Journal du faux npm dans le cache npm dédié (CR-03) : seul dossier persistant où le vrai bac à sable laisse
  // écrire la build ; construireDeploiement le crée avant la première étape.
  const log = path.join(cheminCacheNpm(home), 'npm.log');
  // Sondes node lancées par la build (lecture permise) : connexion à un socket Unix, résolution DNS locale.
  const sondes = temp('rtp-sondes-');
  writeFileSync(path.join(sondes, 'connexion.js'), "require('net').connect(process.argv[2]).on('connect', () => process.exit(0)).on('error', () => process.exit(1));\n");
  writeFileSync(path.join(sondes, 'dns.js'), "require('dns').lookup('localhost', (e) => process.exit(e ? 1 : 0));\n");
  const profilLog = path.join(temp('rtp-profil-'), 'profil.sb');

  const attaques = o.attaques === true
    ? `
essai() { if eval "$2" 2>/dev/null; then echo "$1 REUSSI" >> "$LOG"; else echo "$1 REFUSE" >> "$LOG"; fi; }
essai lecture-cle 'cat "$HOME/.config/rtp/rtp-deploy-mac" >> "$LOG"'
essai lecture-cle-externe 'cat ${quote(cleExterne)} >> "$LOG"'
essai lecture-ssh 'cat "$HOME/.ssh/id_factice" >> "$LOG"'
essai lecture-gh 'cat "$HOME/.config/gh/hosts.yml" >> "$LOG"'
essai ecriture-env 'echo intrus >> "$HOME/.config/rtp/deploiement.env"'
essai ecriture-git-config 'echo "[intrus]" >> ${quote(path.join(racine, '.git', 'config'))}'
essai creation-home 'echo intrus > "$HOME/intrus.txt"'
essai ecriture-worktree 'echo ok > ./ecrit-worktree.txt'
essai ecriture-tmpdir 'echo ok > "$TMPDIR/ecrit-tmp.txt"'
essai ecriture-tmpdir-utilisateur 'echo intrus > "${path.join(tmp, 'intrus-tmp.txt')}"'
essai ecriture-npx 'mkdir -p "$HOME/.npm/_npx/x" && echo intrus > "$HOME/.npm/_npx/x/index.js"'
essai ecriture-copies 'echo intrus > "$HOME/.cache/rtp/deploiement/intrus"'
essai lecture-agents 'ls "$HOME/.cache/rtp/agents" >> "$LOG"'
essai connexion-agent '"${process.execPath}" "${path.join(sondes, 'connexion.js')}" "$HOME/.cache/rtp/agents/a/s.sock"'
essai dns-local '"${process.execPath}" "${path.join(sondes, 'dns.js')}"'
`
    : '';
  const versionCommit = scenario === 'autre-commit' ? 'b'.repeat(40) : scenario === 'dev' ? 'dev' : '$GITHUB_SHA';
  ecrireExecutable(
    path.join(bin, 'npm'),
    `#!/bin/sh
LOG=${quote(log)}
printf 'ARGV %s\\n' "$*" >> "$LOG"
env | sed 's/^/ENV /' >> "$LOG"
case "$*" in
  "ci --ignore-scripts") mkdir -p node_modules ;;
  "audit signatures") ${scenario === 'audit-echec' ? 'echo "signature invalide" >&2; exit 1' : ':'} ;;
  "run build")
${attaques}
    mkdir -p dist/sous
    echo '<p>x</p>' > dist/index.html
    printf '{"commit":"%s","date":"2026-11-18T00:00:00Z"}\\n' "${versionCommit}" > dist/version.json
    echo '<p>y</p>' > dist/sous/page.html
    chmod 600 dist/sous/page.html
    chmod 700 dist/sous
    ${scenario === 'lien' ? 'ln -s index.html dist/lien.html' : ':'}
    ;;
  "run check-dist -- --mode production") : ;;
  *) echo "argv inattendu : $*" >&2; exit 99 ;;
esac
`,
  );
  if (fauxSandbox) {
    ecrireExecutable(
      path.join(bin, 'sandbox-exec'),
      `#!/bin/sh
[ "$1" = "-p" ] || exit 64
printf '%s\\n' "$2" > ${quote(profilLog)}
shift 2
exec "$@"
`,
    );
  }
  const source: NodeJS.ProcessEnv = {
    PATH: `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
    HOME: home,
    TMPDIR: tmp,
    LANG: 'fr_FR.UTF-8',
    SSH_AUTH_SOCK: '/tmp/agent-factice.sock',
    RTP_HOTE: 'hote.exemple.invalid',
  };
  return { racine, home, tmp, bin, log, profilLog, sha, cleExterne, source };
}

// Le processus de test porte aussi ces variables : elles ne doivent jamais atteindre la build.
process.env.SSH_AUTH_SOCK = '/tmp/agent-factice.sock';
process.env.RTP_HOTE = 'hote.exemple.invalid';

function construire(b: Banc, o: Partial<Parameters<typeof construireDeploiement>[0]> = {}): Promise<BuildDeploiement> {
  return construireDeploiement({
    racine: b.racine,
    sha: b.sha,
    cible: 'essai',
    home: b.home,
    lecturesInterdites: [b.cleExterne],
    fichiersSurveilles: [path.join(b.home, '.config', 'rtp', 'deploiement.env')],
    nomsExecutables: ['git', 'jq'],
    lancer,
    ecrire: () => {},
    source: b.source,
    tmpdir: b.tmp,
    ...o,
  });
}

/** Blocs du journal du faux npm : argv et environnement de chaque appel. */
function appels(log: string): { argv: string; env: Record<string, string> }[] {
  const blocs: { argv: string; env: Record<string, string> }[] = [];
  for (const ligne of readFileSync(log, 'utf8').split('\n')) {
    if (ligne.startsWith('ARGV ')) blocs.push({ argv: ligne.slice(5), env: {} });
    else if (ligne.startsWith('ENV ') && blocs.length > 0) {
      const kv = ligne.slice(4);
      const i = kv.indexOf('=');
      (blocs[blocs.length - 1] as { env: Record<string, string> }).env[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  return blocs;
}

const ETAPES_NPM = ['ci --ignore-scripts', 'audit signatures', 'run build', 'run check-dist -- --mode production'];

function sansWorktree(b: Banc): void {
  assert.equal(git(b.racine, 'worktree', 'list').split('\n').length, 1, git(b.racine, 'worktree', 'list'));
  assert.deepEqual(readdirSync(b.tmp).filter((n) => n.startsWith('rtp-deploiement-')), []);
}

/** Socket Unix qui écoute dans le dossier des agents du HOME du banc (CR-01 : la build ne doit pas le joindre). */
async function socketAgent(b: Banc): Promise<() => Promise<void>> {
  const d = path.join(dossierAgents(b.home), 'a');
  mkdirSync(d, { recursive: true, mode: 0o700 });
  const serveur = net.createServer((c) => c.end());
  await new Promise<void>((r) => serveur.listen(path.join(d, 's.sock'), r));
  return () => new Promise<void>((r) => serveur.close(() => r()));
}

async function refuse(p: Promise<unknown>, code: number, motif: RegExp): Promise<void> {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof Sortie, String(e));
    assert.equal(e.code, code, e.message);
    assert.match(e.message, motif);
    return true;
  });
}

describe('profilSandbox', () => {
  const base = { home: '/Users/exemple', worktree: '/private/tmp/w', gitWorktreeDir: '/private/tmp/r/.git/worktrees/w', tmpdir: '/private/tmp', cacheNpm: '/Users/exemple/.npm' };
  it('interdit toute écriture sauf la liste blanche, et la lecture de chaque secret', () => {
    const p = profilSandbox({ ...base, lecturesInterdites: ['/Users/exemple/cles/a', '/Users/exemple/cles/b'] });
    assert.ok(p.startsWith('(version 1)(allow default)(deny file-write*)(allow file-write* '), p);
    for (const s of ['(subpath "/private/tmp/w")', '(subpath "/private/tmp/r/.git/worktrees/w")', '(subpath "/private/tmp")', '(subpath "/Users/exemple/.npm")', '(literal "/dev/null")', '(literal "/dev/tty")']) {
      assert.ok(p.includes(s), s);
    }
    assert.ok(p.includes('(deny file-read* (literal "/Users/exemple/cles/a") (literal "/Users/exemple/cles/b") (subpath "/Users/exemple/.config/rtp") (subpath "/Users/exemple/.ssh") (subpath "/Users/exemple/.config/gh") (subpath "/Users/exemple/.cache/rtp/agents"))'), p);
    assert.equal(p.match(/\(literal "\/Users\/exemple\/cles\//g)?.length, 2);
  });
  it('CR-01 : aucune connexion à un socket Unix sauf le résolveur DNS ; dossier des agents interdit', () => {
    const p = profilSandbox({ ...base, lecturesInterdites: [] });
    assert.ok(p.endsWith('(deny network-outbound (remote unix-socket))(allow network-outbound (remote unix-socket (path-literal "/private/var/run/mDNSResponder")))'), p);
    assert.equal(path.join('/Users/exemple', DOSSIERS_INTERDITS.at(-1) as string), dossierAgents('/Users/exemple'));
  });
  it('refuse un chemin avec un guillemet ou une barre oblique inverse', () => {
    assert.throws(() => profilSandbox({ ...base, lecturesInterdites: ['/Users/exemple/a"b'] }), (e: unknown) => e instanceof Sortie && e.code === 2);
    assert.throws(() => profilSandbox({ ...base, worktree: '/tmp/a\\b', lecturesInterdites: [] }), (e: unknown) => e instanceof Sortie && e.code === 2);
  });
});

describe('envConstruction', () => {
  it('liste blanche plus les variables de la build, jamais l’agent SSH ni une variable RTP_ du terminal', () => {
    const env = envConstruction('production', 'a'.repeat(40), '/c', { PATH: '/p', HOME: '/h', SSH_AUTH_SOCK: 's', RTP_HOTE: 'x' });
    assert.deepEqual(env, {
      PATH: '/p',
      HOME: '/h',
      TZ: 'Europe/Paris',
      ASTRO_TELEMETRY_DISABLED: '1',
      RTP_CONTENT_ROOT: '.',
      RTP_DEPLOIEMENT: '1',
      GITHUB_SHA: 'a'.repeat(40),
      npm_config_update_notifier: 'false',
      npm_config_fund: 'false',
      npm_config_cache: '/c',
    });
    assert.equal(envConstruction('essai', 'a'.repeat(40), '/c', {}).RTP_DEPLOIEMENT, '0');
  });
});

describe('resoudreExecutables, prendreInstantane, comparerInstantanes', () => {
  function outils(): { a: string; b: string; path: string } {
    const a = temp('rtp-path-a-');
    const b = temp('rtp-path-b-');
    ecrireExecutable(path.join(b, 'outil'), '#!/bin/sh\necho b\n');
    writeFileSync(path.join(a, 'outil-non-executable'), 'x');
    return { a, b, path: `${a}:${b}` };
  }
  it('résout le premier exécutable du PATH, en chemin réel, avec son empreinte', () => {
    const o = outils();
    const lien = path.join(o.a, 'alias');
    symlinkSync(path.join(o.b, 'outil'), lien);
    const r = resoudreExecutables(['outil', 'alias'], o.path);
    assert.equal(r.outil?.chemin, path.join(o.b, 'outil'));
    assert.equal(r.alias?.chemin, path.join(o.b, 'outil'));
    assert.match(r.outil?.empreinte ?? '', /^[0-9a-f]{64}$/);
  });
  it('nom absent ou non exécutable : Sortie code 2 qui le nomme', () => {
    const o = outils();
    assert.throws(() => resoudreExecutables(['absent'], o.path), (e: unknown) => e instanceof Sortie && e.code === 2 && /absent/.test(e.message));
    assert.throws(() => resoudreExecutables(['outil-non-executable'], o.path), (e: unknown) => e instanceof Sortie && e.code === 2);
  });
  it('un chemin absolu est pris tel quel', () => {
    const o = outils();
    const r = resoudreExecutables([path.join(o.b, 'outil')], '');
    assert.equal(r[path.join(o.b, 'outil')]?.chemin, path.join(o.b, 'outil'));
  });

  function depotInstantane(): { racine: string; surveille: string; o: ReturnType<typeof outils>; prendre: () => ReturnType<typeof prendreInstantane> } {
    const racine = temp('rtp-inst-');
    git(racine, 'init', '--quiet', '-b', 'main');
    const surveille = path.join(temp('rtp-conf-'), 'deploiement.env');
    writeFileSync(surveille, 'SECRET_FACTICE=1\n');
    const o = outils();
    const absent = path.join(racine, 'absent.txt');
    return { racine, surveille, o, prendre: () => prendreInstantane({ racine, fichiers: [surveille, absent], executables: { noms: ['outil'], path: o.path } }) };
  }
  it('rien ne change : aucune différence ; un fichier absent est noté absent', () => {
    const d = depotInstantane();
    const a = d.prendre();
    assert.equal(Object.values(a.fichiers).filter((v) => v === null).length, 1);
    assert.deepEqual(comparerInstantanes(a, d.prendre()), []);
  });
  it('.git/config modifié : nommé', () => {
    const d = depotInstantane();
    const a = d.prendre();
    writeFileSync(path.join(d.racine, '.git', 'config'), `${readFileSync(path.join(d.racine, '.git', 'config'), 'utf8')}[intrus]\n`);
    assert.deepEqual(comparerInstantanes(a, d.prendre()), ['.git/config']);
  });
  it('nouveau fichier dans .git/hooks : nommé', () => {
    const d = depotInstantane();
    const a = d.prendre();
    ecrireExecutable(path.join(d.racine, '.git', 'hooks', 'pre-push'), '#!/bin/sh\n');
    assert.deepEqual(comparerInstantanes(a, d.prendre()), ['.git/hooks']);
  });
  it('fichier surveillé modifié : nommé, sans son contenu', () => {
    const d = depotInstantane();
    const a = d.prendre();
    writeFileSync(d.surveille, 'SECRET_FACTICE=2\n');
    const diff = comparerInstantanes(a, d.prendre());
    assert.deepEqual(diff, [d.surveille]);
    assert.ok(!diff.join('').includes('SECRET_FACTICE'));
  });
  it('exécutable masqué par un autre plus tôt dans le PATH : nommé', () => {
    const d = depotInstantane();
    const a = d.prendre();
    ecrireExecutable(path.join(d.o.a, 'outil'), '#!/bin/sh\necho intrus\n');
    const diff = comparerInstantanes(a, d.prendre());
    assert.equal(diff.length, 1);
    assert.match(diff[0] as string, /outil/);
  });
  it('lien symbolique dans .git/hooks : refusé', () => {
    const d = depotInstantane();
    symlinkSync('/bin/sh', path.join(d.racine, '.git', 'hooks', 'post-checkout'));
    assert.throws(() => d.prendre(), (e: unknown) => e instanceof Sortie && /hooks/.test(e.message));
  });
});

describe('construireDeploiement (faux sandbox-exec)', () => {
  it('essai puis production : build du commit exact dans le worktree, modes normalisés, empreinte, environnement propre', async () => {
    const b = banc();
    for (const [cible, attendu] of [['essai', '0'], ['production', '1']] as const) {
      rmSync(b.log, { force: true });
      let tete = '';
      let tmpPendant = false;
      const r = await construire(b, {
        cible,
        apresEtape: (etape: string) => {
          if (etape !== 'run build') return;
          const w = readdirSync(b.tmp).find((n) => n.startsWith('rtp-deploiement-') && !n.endsWith('-tmp')) as string;
          tete = git(path.join(b.tmp, w), 'rev-parse', 'HEAD');
          tmpPendant = existsSync(path.join(b.tmp, `${w}-tmp`));
        },
      });
      try {
        assert.equal(r.cible, cible);
        assert.equal(r.sha, b.sha);
        assert.equal(tete, b.sha, 'worktree du commit exact');
        assert.ok(tmpPendant, 'dossier temporaire propre à la build');
        assert.equal(r.dist, path.join(r.dossierTravail, 'dist'));
        assert.ok(r.worktree.startsWith(`${b.tmp}/rtp-deploiement-${b.sha.slice(0, 12)}-`), r.worktree);
        // CR-02 : copie privée hors de tout dossier inscriptible par la build, worktree déjà retiré.
        assert.ok(r.dossierTravail.startsWith(`${path.join(b.home, '.cache', 'rtp', 'deploiement')}/build-`), r.dossierTravail);
        assert.equal(statSync(r.dossierTravail).mode & 0o777, 0o700);
        assert.equal(existsSync(r.worktree), false, 'worktree retiré dès la copie');
        assert.equal(existsSync(`${r.worktree}-tmp`), false);
        sansWorktree(b);
        assert.equal(r.empreinte, empreinteArbre(r.dist));
        assert.equal(statSync(path.join(r.dist, 'sous')).mode & 0o777, 0o755);
        assert.equal(statSync(path.join(r.dist, 'sous', 'page.html')).mode & 0o777, 0o644);
        assert.equal(JSON.parse(readFileSync(path.join(r.dist, 'version.json'), 'utf8')).commit, b.sha);
        const etapes = appels(b.log);
        // CR-03 : npm config get cache n'est plus lu ; seules les quatre étapes du job construire.
        assert.deepEqual(etapes.map((a) => a.argv), ETAPES_NPM);
        for (const a of etapes) {
          assert.equal(a.env.RTP_CONTENT_ROOT, '.');
          assert.equal(a.env.GITHUB_SHA, b.sha);
          assert.equal(a.env.RTP_DEPLOIEMENT, attendu);
          assert.equal(a.env.npm_config_cache, cheminCacheNpm(b.home));
          assert.equal(a.env.HOME, b.home);
          // CR-01 : TMPDIR propre à la build, jamais celui de l'utilisateur.
          assert.equal(a.env.TMPDIR, `${r.worktree}-tmp`);
          assert.equal(a.env.PWD, r.worktree);
          assert.equal(a.env.SSH_AUTH_SOCK, undefined);
          assert.equal(a.env.RTP_HOTE, undefined);
        }
        const profil = readFileSync(b.profilLog, 'utf8');
        assert.ok(profil.includes('(deny file-write*)'));
        assert.ok(profil.includes(`(subpath "${r.worktree}")`));
        assert.ok(profil.includes(`(subpath "${r.worktree}-tmp")`));
        assert.ok(!profil.includes(`(subpath "${b.tmp}")`), 'TMPDIR de l\'utilisateur ouvert en écriture');
        // CR-02 : aucun dossier inscriptible par la build ne contient la copie envoyée.
        const ecrivables = [...(/\(allow file-write\* ([^]*?)\)\(deny file-read\*/.exec(profil)?.[1] ?? '').matchAll(/\(subpath "([^"]+)"\)/g)].map((m) => m[1] as string);
        assert.equal(ecrivables.length, 4, profil);
        for (const w of ecrivables) assert.ok(!`${r.dist}/`.startsWith(`${w}/`), `${r.dist} sous ${w}`);
        assert.ok(profil.includes(`(literal "${b.cleExterne}")`));
        // CR-03 : cache npm dédié en 0700 ; celui de l'utilisateur n'est jamais ouvert en écriture.
        assert.ok(profil.includes(`(subpath "${cheminCacheNpm(b.home)}")`), profil);
        assert.ok(!profil.includes(path.join(b.home, '.npm')), profil);
        assert.equal(statSync(cheminCacheNpm(b.home)).mode & 0o777, 0o700);
        assert.deepEqual(Object.keys(r.executables).sort(), ['git', 'jq']);
        assert.equal(r.instantane.fichiers[path.join(b.home, '.config', 'rtp', 'deploiement.env')]?.length, 64);
      } finally {
        await r.nettoyer();
      }
      assert.equal(existsSync(r.dossierTravail), false, 'copie supprimée par nettoyer');
      sansWorktree(b);
    }
  });

  it('dossier .git surveillé modifié pendant la build : code 1, worktree retiré', async () => {
    const b = banc();
    const p = construire(b, {
      apresEtape: (etape: string) => {
        if (etape === 'audit signatures') ecrireExecutable(path.join(b.racine, '.git', 'hooks', 'post-merge'), '#!/bin/sh\n');
      },
    });
    await refuse(p, 1, /intégrité locale modifiée pendant la build : \.git\/hooks ; déploiement arrêté/);
    sansWorktree(b);
  });

  it('chemin secret sous un dossier où la build peut écrire : code 2 avant tout appel de npm', async () => {
    const b = banc();
    const futur = path.join(b.tmp, `rtp-deploiement-${b.sha.slice(0, 12)}-futur`, 'cle');
    await refuse(construire(b, { lecturesInterdites: [futur] }), 2, /cle/);
    assert.equal(existsSync(b.log), false);
    sansWorktree(b);
  });

  it('~/.config/rtp sous le dossier temporaire de la build : code 2', async () => {
    const b = banc();
    await refuse(construire(b, { tmpdir: path.dirname(b.home), lecturesInterdites: [] }), 2, /\.config\/rtp/);
    assert.equal(existsSync(b.log), false);
  });

  for (const [scenario, motif] of [
    ['autre-commit', /version\.json ne porte pas le commit/],
    ['dev', /version\.json ne porte pas le commit/],
    ['lien', /lien symbolique ou un fichier spécial : lien\.html/],
    ['audit-echec', /audit signatures.*échec|échec.*audit signatures/],
  ] as const) {
    it(`${scenario} : refusé, worktree retiré`, async () => {
      const b = banc({ scenario });
      await refuse(construire(b), 1, motif);
      sansWorktree(b);
    });
  }

  it('sandbox-exec absent du PATH : code 2, déploiement refusé', async () => {
    const b = banc({ fauxSandbox: false });
    const seul = temp('rtp-path-seul-');
    for (const nom of ['git', 'bash', 'sh', 'jq']) symlinkSync(commandeV(nom), path.join(seul, nom));
    symlinkSync(path.join(b.bin, 'npm'), path.join(seul, 'npm'));
    await refuse(
      construire(b, { source: { ...b.source, PATH: seul } }),
      2,
      /sandbox-exec introuvable : la build de déploiement ne peut pas être cloisonnée, déploiement refusé/,
    );
    assert.equal(existsSync(b.log), false);
  });

  it('commit ou cible invalides : code 2', async () => {
    const b = banc();
    await refuse(construire(b, { sha: 'abc' }), 2, /commit/);
    await refuse(construire(b, { cible: 'autre' as 'essai' }), 2, /cible/);
  });
});

const sonde = sondeBacASable();

describe('sondeBacASable', () => {
  it('répond ok ou donne une raison', () => {
    assert.equal(typeof sonde.ok, 'boolean');
    if (!sonde.ok) assert.ok(sonde.raison.length > 0);
    if (process.platform !== 'darwin') assert.equal(sonde.raison, 'macOS seulement');
  });
});

describe('bac à sable (vrai sandbox-exec)', { skip: sonde.ok ? false : sonde.raison }, () => {
  it('la build ne lit aucun secret, n’écrit que dans le worktree, son TMPDIR et le cache npm, ne joint aucun agent', async () => {
    const b = banc({ fauxSandbox: false, attaques: true });
    const gitConfig = readFileSync(path.join(b.racine, '.git', 'config'));
    const envFichier = path.join(b.home, '.config', 'rtp', 'deploiement.env');
    const envAvant = readFileSync(envFichier);
    // CR-02 : le dossier des copies privées existe déjà (déploiements précédents) ; la build ne doit pas y écrire.
    mkdirSync(path.join(b.home, '.cache', 'rtp', 'deploiement'), { recursive: true, mode: 0o700 });
    const fermerSocket = await socketAgent(b);
    let r: BuildDeploiement;
    try {
      r = await construire(b);
    } finally {
      await fermerSocket();
    }
    try {
      const log = readFileSync(b.log, 'utf8');
      assert.ok(!log.includes(CLE), 'un secret factice a été lu par la build');
      assert.ok(!log.includes('s.sock'), 'le dossier des agents a été listé par la build');
      assert.ok(log.includes('dns-local REUSSI'), 'résolution DNS refusée');
      assert.equal(existsSync(path.join(b.tmp, 'intrus-tmp.txt')), false);
      for (const t of ['lecture-cle', 'lecture-cle-externe', 'lecture-ssh', 'lecture-gh', 'ecriture-env', 'ecriture-git-config', 'creation-home', 'ecriture-tmpdir-utilisateur', 'ecriture-npx', 'ecriture-copies', 'lecture-agents', 'connexion-agent']) {
        assert.ok(log.includes(`${t} REFUSE`), `${t} n’a pas été refusé :\n${log.split('\n').filter((l) => !l.startsWith('ENV ')).join('\n')}`);
      }
      for (const t of ['ecriture-worktree', 'ecriture-tmpdir']) assert.ok(log.includes(`${t} REUSSI`), t);
      assert.deepEqual(readFileSync(path.join(b.racine, '.git', 'config')), gitConfig);
      assert.deepEqual(readFileSync(envFichier), envAvant);
      assert.equal(existsSync(path.join(b.home, 'intrus.txt')), false);
      assert.equal(r.empreinte, empreinteArbre(r.dist));
    } finally {
      await r.nettoyer();
    }
    sansWorktree(b);
  });

  it('production sous le vrai bac à sable : mêmes étapes, RTP_DEPLOIEMENT=1', async () => {
    const b = banc({ fauxSandbox: false });
    const r = await construire(b, { cible: 'production' });
    try {
      const etapes = appels(b.log);
      assert.deepEqual(etapes.map((a) => a.argv), ETAPES_NPM);
      for (const a of etapes) assert.equal(a.env.RTP_DEPLOIEMENT, '1');
    } finally {
      await r.nettoyer();
    }
    sansWorktree(b);
  });
});
