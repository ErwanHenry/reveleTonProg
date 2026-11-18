// `npm run deploy:local` (LOC-02 ; D-03 à D-07, D-10, D-13 ; T-09.2-31 à T-09.2-38) contre le faux serveur de
// tests/helpers/faux-serveur.ts : la vraie commande forcée ops/commande-deploiement.sh tourne derrière des ssh,
// ssh-agent, ssh-add, ssh-keygen, rsync et curl factices. Un dépôt git temporaire (origine nue locale) tient lieu de
// clone d'Erwan ; npm et sandbox-exec sont des faux en tête de PATH (le faux npm construit un dist qui porte
// GITHUB_SHA). HOME et TMPDIR sont temporaires : reçu, journal, verrou, agent et worktree restent hors de l'utilisateur.
// La confirmation est un confirmateur factice passé à executerDeploiement ; la CLI n'est lancée qu'avec une entrée
// standard en tube (refus immédiat) ou en répétition à blanc : le vrai /dev/tty n'est jamais ouvert.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancer as lancerReel, type Lanceur } from '../../scripts/lib/processus.ts';
import { ETAPES, ecrireRecu, type Recu } from '../../scripts/lib/ci-local.ts';
import { cheminsLocaux, lireConfig } from '../../scripts/lib/deploiement/config.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { resoudreExecutables } from '../../scripts/lib/deploiement/executables.ts';
import type { Agent } from '../../scripts/lib/deploiement/agent.ts';
import { appelerVerbe, lireEtat } from '../../scripts/lib/deploiement/transport.ts';
import type { Confirmateur } from '../../scripts/lib/deploiement/confirmation.ts';
import { executerDeploiement, type ContexteDeploiement, type OptionsDeploiement } from '../../scripts/lib/deploiement/deployer.ts';
import { executer } from '../../scripts/deploy-local.ts';
import { CLE_FACTICE, ENTETES_PAR_DEFAUT, HOTE_FACTICE, MOT_DE_PASSE_FACTICE, UTILISATEUR_FACTICE, creerFauxServeur, type FauxServeur, type OptionsFauxServeur } from '../helpers/faux-serveur.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RACINE, 'scripts', 'deploy-local.ts');
const HORS_GEL = new Date('2026-11-18T12:00:00Z');
const JUSTIFICATION = 'page des thèmes cassée, retrait'; // 31 caractères
const SECRETS = [MOT_DE_PASSE_FACTICE, CLE_FACTICE, HOTE_FACTICE, UTILISATEUR_FACTICE];
const SANS_CSP = ENTETES_PAR_DEFAUT.filter((l) => !/^content-security-policy:/i.test(l));

const RAISON_MV = 'GNU mv requis';
const SONDE = creerFauxServeur();
const BASCULE = SONDE.basculePossible;
SONDE.detruire();

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});
/** Tout texte rendu par le code testé et tout journal écrit, contrôlés à la fin (fuite). */
const sorties: string[] = [];

function temp(prefixe: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefixe)));
  nettoyages.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
}
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
function ecrireExecutable(p: string, contenu: string): void {
  writeFileSync(p, contenu);
  chmodSync(p, 0o755);
}
const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

interface Banc {
  faux: FauxServeur;
  home: string;
  racine: string;
  nu: string;
  outils: string;
  tmp: string;
  npmLog: string;
  /** Commit précédent (src/a.txt = 0). */
  P: string;
  /** Tête poussée : src/a.txt = 1, ou docs/note.md seulement (docs: true). */
  S: string;
}

function commit(racine: string, fichier: string, contenu: string): string {
  mkdirSync(path.dirname(path.join(racine, fichier)), { recursive: true });
  writeFileSync(path.join(racine, fichier), contenu);
  git(racine, 'add', fichier);
  git(racine, 'commit', '--quiet', '-m', `modifie ${fichier}`);
  return git(racine, 'rev-parse', 'HEAD');
}

function banc(o: OptionsFauxServeur = {}, surcharges: Partial<Record<string, string>> = {}, c: { docs?: boolean } = {}): Banc {
  const faux = creerFauxServeur(o);
  nettoyages.push(() => faux.detruire());
  const home = temp('rtp-home-deployer-');
  faux.config(home, surcharges);

  const racine = temp('rtp-depot-deployer-');
  git(racine, 'init', '--quiet', '-b', 'main');
  git(racine, 'config', 'user.email', 't@exemple.invalid');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'commit.gpgsign', 'false');
  const P = commit(racine, 'src/a.txt', '0\n');
  const S = c.docs === true ? commit(racine, 'docs/note.md', 'note\n') : commit(racine, 'src/a.txt', '1\n');
  const nu = temp('rtp-origine-deployer-');
  git(nu, 'init', '--quiet', '--bare', '-b', 'main');
  git(racine, 'remote', 'add', 'origin', nu);
  git(racine, 'push', '--quiet', 'origin', 'main');
  git(racine, 'fetch', '--quiet', 'origin');

  const outils = temp('rtp-outils-deployer-');
  const cache = temp('rtp-cache-deployer-');
  const tmp = temp('rtp-tmp-deployer-');
  const npmLog = path.join(outils, 'npm.log');
  ecrireExecutable(
    path.join(outils, 'npm'),
    `#!/bin/sh
LOG=${quote(npmLog)}
printf 'ARGV %s\\n' "$*" >> "$LOG"
env | sed 's/^/ENV /' >> "$LOG"
case "$*" in
  "config get cache") printf '%s\\n' ${quote(cache)} ;;
  "ci --ignore-scripts"|"audit signatures"|"run check-dist -- --mode production") : ;;
  "run build")
    mkdir -p dist
    printf '<!doctype html><title>%s</title>\\n' "$GITHUB_SHA" > dist/index.html
    printf '{"commit":"%s","date":"2026-11-18T00:00:00Z"}\\n' "$GITHUB_SHA" > dist/version.json
    ;;
  *) echo "argv inattendu : $*" >&2; exit 99 ;;
esac
`,
  );
  ecrireExecutable(
    path.join(outils, 'sandbox-exec'),
    `#!/bin/sh
[ "$1" = "-p" ] || exit 64
shift 2
exec "$@"
`,
  );
  return { faux, home, racine, nu, outils, tmp, npmLog, P, S };
}

function recu(sha: string, secrets: Recu['secrets'] = 'ok'): Recu {
  return {
    version: 1,
    commit: sha,
    date: '2026-11-18T10:00:00.000Z',
    node: 'v24.22.2',
    arbre_propre: true,
    partiel: false,
    base_ids: null,
    secrets,
    gitleaks: secrets === 'ok' ? '8.30.1' : null,
    etapes: ETAPES.map((e) => ({ id: e.id, nomCi: e.nomCi, resultat: 'ok' as const, duree_ms: 1 })),
  };
}
const recuVert = (b: Banc, sha = b.S): void => {
  ecrireRecu(b.home, recu(sha));
};

function distDe(s: string): string {
  const d = temp('rtp-dist-deployer-');
  writeFileSync(path.join(d, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  writeFileSync(path.join(d, 'version.json'), JSON.stringify({ commit: s, date: '2026-11-18T00:00:00Z' }));
  return d;
}

const pathDe = (b: Banc): string => `${b.outils}:${b.faux.env.PATH ?? ''}`;

async function avecEnv<T>(b: Banc, f: (lancer: Lanceur) => Promise<T>): Promise<T> {
  const avant = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR };
  const PATH = pathDe(b);
  process.env.PATH = PATH;
  process.env.TMPDIR = b.tmp;
  const lancerFaux: Lanceur = (l) => lancerReel({ ...l, env: { ...l.env, PATH } });
  try {
    return await f(lancerFaux);
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function verbe(b: Banc, v: 'etat' | 'retour', args: string[]): Promise<string> {
  const cfg = lireConfig(b.home);
  const exe = resoudreExecutables(['ssh'], b.faux.env.PATH ?? '');
  const agent: Agent = { socket: path.join(b.faux.racine, 'agent.sock'), fermer: async () => {} };
  return appelerVerbe(cfg, agent, exe, v, args, lancerReel);
}
async function courant(b: Banc): Promise<string | null> {
  const cfg = lireConfig(b.home);
  return lireEtat(await verbe(b, 'etat', [cfg.cible]))?.courant ?? null;
}

/** Confirmateur factice : note la phrase, lance l'action donnée, accepte si c'est la phrase attendue, sinon code 3. */
function confirmateur(attendue: string | null, action?: () => void | Promise<void>): { confirmer: Confirmateur; vues: string[] } {
  const vues: string[] = [];
  return {
    vues,
    confirmer: async (p) => {
      vues.push(p);
      if (attendue === null || p !== attendue) throw new Sortie(3, "confirmation refusée : rien n'a été envoyé");
      if (action !== undefined) await action();
    },
  };
}
const phrase = (b: Banc, cible: 'essai' | 'production' = 'essai', s = b.S): string =>
  cible === 'production' ? `deployer en production ${s.slice(0, 7)}` : `deployer essai ${s.slice(0, 7)}`;

function horloge(instants: Date[]): () => Date {
  let i = 0;
  return () => {
    const d = instants[Math.min(i, instants.length - 1)] as Date;
    i++;
    return new Date(d.getTime());
  };
}

async function deployer(
  b: Banc,
  o: Partial<OptionsDeploiement>,
  c: Partial<ContexteDeploiement> & { confirmer: Confirmateur },
): Promise<{ code: number; texte: string }> {
  const lignes: string[] = [];
  const code = await avecEnv(b, (lancer) =>
    executerDeploiement(
      { forcer: false, urgence: false, justification: '', dryRun: false, ...o },
      {
        lancer,
        maintenant: () => new Date(HORS_GEL.getTime()),
        home: b.home,
        racine: b.racine,
        ecrire: (l) => lignes.push(l),
        lancerCiLocal: async () => {
          throw new Error('ci:local lancé alors que le reçu est vert');
        },
        ...c,
      },
    ),
  );
  sorties.push(...lignes);
  return { code, texte: lignes.join('\n') };
}

const verbesSsh = (b: Banc): string[] => b.faux.journal('ssh').map((a) => a.at(-1) ?? '');
const appelsNpm = (b: Banc): string[] =>
  existsSync(b.npmLog) ? readFileSync(b.npmLog, 'utf8').split('\n').filter((l) => l.startsWith('ARGV ')).map((l) => l.slice(5)) : [];

function journal(b: Banc): Record<string, unknown>[] {
  const f = cheminsLocaux(b.home).journal;
  if (!existsSync(f)) return [];
  const texte = readFileSync(f, 'utf8');
  sorties.push(texte);
  return texte
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function sansWorktree(b: Banc): void {
  assert.equal(git(b.racine, 'worktree', 'list').split('\n').length, 1, git(b.racine, 'worktree', 'list'));
  assert.deepEqual(readdirSync(b.tmp).filter((n) => n.startsWith('rtp-deploiement-')), []);
  assert.equal(existsSync(cheminsLocaux(b.home).verrou), false, 'verrou rendu');
}

function avancerOrigine(b: Banc, fichier: string): string {
  const clone = temp('rtp-clone-deployer-');
  git(clone, 'clone', '--quiet', b.nu, '.');
  git(clone, 'config', 'user.email', 't@exemple.invalid');
  git(clone, 'config', 'user.name', 'Test');
  git(clone, 'config', 'commit.gpgsign', 'false');
  const s = commit(clone, fichier, 'suite\n');
  git(clone, 'push', '--quiet', 'origin', 'main');
  return s;
}

describe('déploiement complet contre la vraie commande forcée', () => {
  it('essai : code 0, etat, envoi, etat, activer, etat ; current = sha ; journal succes precedent ; worktree retiré', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const c = confirmateur(phrase(b));
    const { code, texte } = await deployer(b, {}, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, [phrase(b)]);
    assert.deepEqual(verbesSsh(b), ['etat essai', `essai/${b.S}/`, 'etat essai', `activer essai ${b.S}`, 'etat essai']);
    assert.equal(await courant(b), b.S);
    assert.deepEqual(appelsNpm(b), ['config get cache', 'ci --ignore-scripts', 'audit signatures', 'run build', 'run check-dist -- --mode production']);
    assert.match(texte, /Cible : essai/);
    assert.ok(texte.includes(`Commit à déployer : ${b.S}`), texte);
    assert.ok(texte.includes(`Version en ligne : ${b.P}`), texte);
    assert.match(texte, /M\tsrc\/a\.txt/);
    assert.match(texte, /Empreinte de la build : [0-9a-f]{64}/);
    assert.ok(texte.includes(`Version servie : ${b.S} (/version.json)`), texte);
    assert.equal(b.faux.motDePasseRecu(), `user = "sonde:${MOT_DE_PASSE_FACTICE}"`);
    const j = journal(b);
    assert.equal(j.length, 1);
    assert.deepEqual(
      { action: j[0]?.action, cible: j[0]?.cible, resultat: j[0]?.resultat, commit: j[0]?.commit, precedent: j[0]?.precedent, urgence: j[0]?.urgence },
      { action: 'deployer', cible: 'essai', resultat: 'succes', commit: b.S, precedent: b.P, urgence: false },
    );
    sansWorktree(b);
  });

  it('production : phrase « deployer en production <sha7> », le faux npm a vu RTP_DEPLOIEMENT=1', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({}, { RTP_CIBLE: 'production' });
    b.faux.servirCommit('production', b.P, distDe(b.P));
    recuVert(b);
    const c = confirmateur(phrase(b, 'production'));
    const { code, texte } = await deployer(b, {}, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, [`deployer en production ${b.S.slice(0, 7)}`]);
    assert.match(texte, /Cible : PRODUCTION/);
    const log = readFileSync(b.npmLog, 'utf8');
    const build = log.slice(log.indexOf('ARGV run build'), log.indexOf('ARGV run check-dist'));
    assert.match(build, /^ENV RTP_DEPLOIEMENT=1$/m);
    assert.ok(build.includes(`ENV GITHUB_SHA=${b.S}`));
    assert.equal(await courant(b), b.S);
  });

  it('confirmation refusée : code 3, seul etat a été appelé, aucun envoi, journal refus', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(null));
    assert.equal(code, 3, texte);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.equal(journal(b)[0]?.resultat, 'refus');
    sansWorktree(b);
  });

  it('clé sans phrase de passe : code 3, aucun appel ssh ni agent', async () => {
    const b = banc({ cleSansPhrase: true });
    recuVert(b);
    const c = confirmateur(phrase(b));
    const { code, texte } = await deployer(b, {}, c);
    assert.equal(code, 3, texte);
    assert.equal(b.faux.journal('ssh').length, 0);
    assert.equal(b.faux.journal('ssh-agent').length, 0);
    assert.equal(b.faux.journal('ssh-add').length, 0);
    assert.deepEqual(c.vues, []);
    sansWorktree(b);
  });

  it('openrsync : code 2 avec brew install rsync, avant la build', async () => {
    const b = banc({ rsync: 'openrsync' });
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 2, texte);
    assert.match(texte, /brew install rsync/);
    assert.deepEqual(appelsNpm(b), []);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
  });
});

describe('gardes avant la build', () => {
  it('arbre de travail sale : code 1 avant toute build', async () => {
    const b = banc();
    recuVert(b);
    writeFileSync(path.join(b.racine, 'intrus.txt'), 'x\n');
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.match(texte, /arbre de travail/);
    assert.deepEqual(appelsNpm(b), []);
  });

  it('HEAD en avance sur origin/main : code 1 avant toute build', async () => {
    const b = banc();
    const local = commit(b.racine, 'src/b.txt', 'b\n');
    recuVert(b, local);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b, 'essai', local)));
    assert.equal(code, 1, texte);
    assert.match(texte, /origin\/main/);
    assert.deepEqual(appelsNpm(b), []);
  });

  it('git fetch impossible : code 1 avant toute build', async () => {
    const b = banc();
    recuVert(b);
    renameSync(b.nu, `${b.nu}-absent`);
    nettoyages.push(() => rmSync(`${b.nu}-absent`, { recursive: true, force: true }));
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.match(texte, /git fetch impossible : rien de non vérifié ne part en ligne/);
    assert.deepEqual(appelsNpm(b), []);
  });

  it('aucun reçu : ci:local lancé une fois, puis déploiement', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    let appels = 0;
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      lancerCiLocal: async () => {
        appels++;
        recuVert(b);
        return 0;
      },
    });
    assert.equal(code, 0, texte);
    assert.equal(appels, 1);
    assert.match(texte, /aucun reçu/);
  });

  it('reçu sans recherche de secrets : ci:local relancé, toujours non exécutée : code 1 qui nomme gitleaks', async () => {
    const b = banc();
    ecrireRecu(b.home, recu(b.S, 'non_executee'));
    let appels = 0;
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      lancerCiLocal: async () => {
        appels++;
        return 1;
      },
    });
    assert.equal(code, 1, texte);
    assert.equal(appels, 1);
    assert.match(texte, /gitleaks/);
    assert.deepEqual(appelsNpm(b), []);
  });

  it('gel au départ : code 1 avant toute build', async () => {
    const b = banc();
    recuVert(b);
    const c = confirmateur(phrase(b));
    const { code, texte } = await deployer(b, {}, { ...c, maintenant: () => new Date('2027-04-18T12:00:00+02:00') });
    assert.equal(code, 1, texte);
    assert.match(texte, /gel du tour 1/);
    assert.deepEqual(appelsNpm(b), []);
    assert.deepEqual(c.vues, []);
    assert.equal(journal(b)[0]?.resultat, 'refus');
  });
});

describe('gardes rejouées après la confirmation (CR-02, T-09.2-33)', () => {
  it('gel atteint entre l\'écran et la confirmation : code 1 après elle, aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const c = confirmateur(phrase(b));
    const { code, texte } = await deployer(b, {}, { ...c, maintenant: horloge([new Date('2027-04-16T23:59:30+02:00'), new Date('2027-04-17T00:00:30+02:00')]) });
    assert.equal(code, 1, texte);
    assert.deepEqual(c.vues, [phrase(b)]);
    assert.match(texte, /2027-04-17 tombe dans le gel du tour 1/);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.equal(journal(b)[0]?.resultat, 'refus');
    sansWorktree(b);
  });

  it('origin a avancé avec docs/ seulement : déployé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void avancerOrigine(b, 'docs/suite.md')));
    assert.equal(code, 0, texte);
    assert.match(texte, /tête plus récente sans changement du site/);
    assert.equal(await courant(b), b.S);
  });

  it('origin a avancé avec src/ : code 1, aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void avancerOrigine(b, 'src/suite.txt')));
    assert.equal(code, 1, texte);
    assert.match(texte, /main a avancé/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('git fetch impossible après la confirmation : code 1, aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    nettoyages.push(() => rmSync(`${b.nu}-absent`, { recursive: true, force: true }));
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => renameSync(b.nu, `${b.nu}-absent`)));
    assert.equal(code, 1, texte);
    assert.match(texte, /git fetch impossible/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('cible passée de essai à production dans deploiement.env : code 1 « cible de la build différente », aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => b.faux.config(b.home, { RTP_CIBLE: 'production' })));
    assert.equal(code, 1, texte);
    assert.match(texte, /cible de la build différente de la cible du déploiement/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('.git/config modifié pendant la confirmation : code 1 « intégrité locale », aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void git(b.racine, 'config', 'rtp.intrus', 'oui')));
    assert.equal(code, 1, texte);
    assert.match(texte, /intégrité locale modifiée/);
    assert.match(texte, /\.git\/config/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('dist modifié après la build : code 1 « empreinte », aucun envoi', async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      apresConstruction: (build) => writeFileSync(path.join(build.dist, 'intrus.html'), '<p>intrus</p>\n'),
    });
    assert.equal(code, 1, texte);
    assert.match(texte, /empreinte/);
    assert.equal(b.faux.journal('rsync').length, 0);
    sansWorktree(b);
  });
});

describe('site touché depuis la version en ligne', () => {
  it('docs/ seulement depuis la version en ligne : code 0 « rien à déployer », aucun envoi ; --forcer : déployé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({}, {}, { docs: true });
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const c = confirmateur(phrase(b));
    const r1 = await deployer(b, {}, c);
    assert.equal(r1.code, 0, r1.texte);
    assert.match(r1.texte, /rien à déployer \(--forcer pour déployer quand même\)/);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.deepEqual(c.vues, []);
    const r2 = await deployer(b, { forcer: true }, c);
    assert.equal(r2.code, 0, r2.texte);
    assert.equal(await courant(b), b.S);
  });
});

describe('après l\'activation : vérifications et retour automatique (WR-01, IN-07)', () => {
  it('commit servi différent : retour à la version d\'avant, code 4, journal retour-auto', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      apresActivation: () => {
        const f = path.join(b.faux.base, 'essai', 'releases', b.S, 'version.json');
        chmodSync(path.dirname(f), 0o755);
        rmSync(f, { force: true });
        writeFileSync(f, JSON.stringify({ commit: b.P, date: '2026-11-18T00:00:00Z' }));
      },
    });
    assert.equal(code, 4, texte);
    assert.equal(await courant(b), b.P);
    assert.ok(verbesSsh(b).includes(`retour essai ${b.P}`));
    const j = journal(b);
    assert.ok(j.some((l) => l.action === 'retour-auto' && l.resultat === 'succes' && l.commit === b.P), JSON.stringify(j));
    assert.ok(j.some((l) => l.action === 'deployer' && l.resultat === 'retour-auto'), JSON.stringify(j));
    sansWorktree(b);
  });

  it('CSP absente : retour automatique, code 4', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 4, texte);
    assert.match(texte, /Content-Security-Policy/);
    assert.equal(await courant(b), b.P);
  });

  it('retrait d\'urgence et test de fumée en échec : aucun retour, code 5', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, { urgence: true, justification: JUSTIFICATION }, confirmateur(phrase(b)));
    assert.equal(code, 5, texte);
    assert.match(texte, /vérifier à la main/);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.equal(await courant(b), b.S);
    assert.equal(journal(b).at(-1)?.resultat, 'sans-retour');
  });

  it('aucune version en ligne avant : aucun retour, code 5', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 5, texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
  });

  it('current a bougé après activer (retour manuel entre-temps) : aucun retour automatique, code 5', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      apresActivation: async () => {
        b.faux.poserEntetes(SANS_CSP);
        await verbe(b, 'retour', ['essai', b.P]);
      },
    });
    assert.equal(code, 5, texte);
    assert.match(texte, /current a changé depuis l'activation/);
    assert.equal(verbesSsh(b).filter((v) => v.startsWith('retour')).length, 1, 'seul le retour manuel');
    assert.equal(await courant(b), b.P);
  });

  it('commit déjà en ligne redéployé avec --forcer, fumée en échec : aucun retour, code 1', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    b.faux.servirCommit('essai', b.S, distDe(b.S));
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, { forcer: true }, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.equal(await courant(b), b.S);
  });

  it('retour automatique en échec : code 5, message masqué', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ echecRetour: true });
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 5, texte);
    assert.ok(texte.includes(`retour automatique en échec : la version en ligne est peut-être ${b.S.slice(0, 12)} ; vérifier avec npm run deploy:local -- etat`), texte);
    assert.ok(!texte.includes(HOTE_FACTICE), texte);
    assert.ok(journal(b).some((l) => l.action === 'retour-auto' && l.resultat === 'echec'));
  });

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    it(`${signal} reçu après activer : retour effectué, code 4`, { skip: !BASCULE && RAISON_MV }, async () => {
      const b = banc();
      b.faux.servirCommit('essai', b.P, distDe(b.P));
      recuVert(b);
      let ecoutes = 0;
      const { code, texte } = await deployer(b, {}, {
        ...confirmateur(phrase(b)),
        apresActivation: () => {
          ecoutes = process.listenerCount(signal);
          process.emit(signal, signal);
        },
      });
      assert.equal(code, 4, texte);
      assert.ok(ecoutes >= 2, `gestionnaire du retour et de l'agent posés (${ecoutes})`);
      assert.ok(texte.includes(signal), texte);
      assert.equal(await courant(b), b.P);
      assert.equal(process.listenerCount(signal), 0, 'gestionnaires retirés');
    });
  }

  it('RTP_URL vide : déployé, test de fumée dit sauté, aucun appel de curl', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({}, { RTP_URL: '' });
    b.faux.servirCommit('essai', b.P, distDe(b.P));
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 0, texte);
    assert.match(texte, /test de fumée HTTPS sauté : RTP_URL vide \(etat fait foi\)/);
    assert.equal(b.faux.journal('curl').length, 0);
  });
});

describe('répétition à blanc et CLI', () => {
  it('--dry-run : code 0, aucun appel ssh, ssh-agent, ssh-add, ssh-keygen ni curl, aucun journal', async () => {
    const b = banc();
    recuVert(b);
    const c = confirmateur(null);
    const { code, texte } = await deployer(b, { dryRun: true }, c);
    assert.equal(code, 0, texte);
    assert.match(texte, /version en ligne : non lue, la répétition à blanc ne contacte pas le serveur/);
    assert.match(texte, /répétition à blanc : rien n'a été envoyé/);
    assert.ok(texte.includes(`Phrase qui sera demandée : ${phrase(b)}`), texte);
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'rsync'] as const) assert.equal(b.faux.journal(n).length, 0, n);
    assert.equal(appelsNpm(b).length, 5, 'la build scellée a tourné');
    assert.deepEqual(c.vues, []);
    assert.equal(existsSync(cheminsLocaux(b.home).journal), false);
    sansWorktree(b);
  });

  it('CLI --dry-run sans terminal (entrée standard du test) : code 0, aucun contact', async () => {
    const b = banc();
    recuVert(b);
    const lignes: string[] = [];
    const code = await avecEnv(b, (lancer) =>
      executer(['--dry-run', '--urgence', '--justification', JUSTIFICATION], { home: b.home, racine: b.racine, lancer, ecrire: (l) => lignes.push(l) }),
    );
    sorties.push(...lignes);
    assert.equal(code, 0, lignes.join('\n'));
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl'] as const) assert.equal(b.faux.journal(n).length, 0, n);
    assert.equal(existsSync(cheminsLocaux(b.home).journal), false);
  });

  it('CLI lancée avec l\'entrée standard en tube : code 3, ni npm ni ssh', async () => {
    const b = banc();
    recuVert(b);
    const { code, sortie } = await new Promise<{ code: number | null; sortie: string }>((resolve) => {
      const enfant = spawn(process.execPath, [SCRIPT], {
        cwd: RACINE,
        env: { HOME: b.home, PATH: pathDe(b), TMPDIR: b.tmp, TZ: 'Europe/Paris' },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });
      let s = '';
      enfant.stdout.setEncoding('utf8');
      enfant.stderr.setEncoding('utf8');
      enfant.stdout.on('data', (d: string) => (s += d));
      enfant.stderr.on('data', (d: string) => (s += d));
      enfant.stdin.end(`${phrase(b)}\n`);
      const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 300_000);
      enfant.on('close', (c) => {
        clearTimeout(minuteur);
        sorties.push(s);
        resolve({ code: c, sortie: s });
      });
    });
    assert.equal(code, 3, sortie);
    assert.match(sortie, /terminal/);
    assert.deepEqual(appelsNpm(b), []);
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen'] as const) assert.equal(b.faux.journal(n).length, 0, n);
    assert.equal(existsSync(path.dirname(cheminsLocaux(b.home).verrou)), false, 'aucun verrou pris');
  });
});

describe('fuite', () => {
  it('ni mot de passe, ni clé, ni hôte, ni utilisateur dans une sortie ou un journal', () => {
    assert.ok(sorties.length > 20);
    for (const t of sorties) for (const s of SECRETS) assert.ok(!t.includes(s), `${s} dans : ${t}`);
  });
});
