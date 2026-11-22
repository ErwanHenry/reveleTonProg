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
import { appelerVerbe, EchecVerbe, envoyer, lireEtat } from '../../scripts/lib/deploiement/transport.ts';
import type { Confirmateur } from '../../scripts/lib/deploiement/confirmation.ts';
import { activationExclue, executerDeploiement, type ContexteDeploiement, type OptionsDeploiement } from '../../scripts/lib/deploiement/deployer.ts';
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
  const tmp = temp('rtp-tmp-deployer-');
  const npmLog = path.join(outils, 'npm.log');
  ecrireExecutable(
    path.join(outils, 'npm'),
    `#!/bin/sh
LOG=${quote(npmLog)}
printf 'ARGV %s\\n' "$*" >> "$LOG"
env | sed 's/^/ENV /' >> "$LOG"
case "$*" in
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

/**
 * Met en ligne la version donnée par la vraie commande forcée (envoi puis activer, .historique écrit) : une version
 * posée par servirCommit seule serait écartée par le ménage de activer. Journaux ssh et rsync vidés ensuite.
 */
async function mettreEnLigne(b: Banc, s: string): Promise<void> {
  b.faux.chargerCle();
  const cfg = lireConfig(b.home);
  const exe = { ...resoudreExecutables(['ssh'], b.faux.env.PATH ?? ''), rsync: resoudreExecutables([cfg.rsync], b.faux.env.PATH ?? '')[cfg.rsync] as { chemin: string; empreinte: string } };
  const agent: Pick<Agent, 'socket'> = { socket: path.join(b.faux.racine, 'agent.sock') };
  await envoyer(cfg, agent, exe, distDe(s), cfg.cible, s, lancerReel);
  await appelerVerbe(cfg, agent, exe, 'activer', [cfg.cible, s], lancerReel);
  for (const n of ['ssh', 'rsync']) {
    rmSync(path.join(b.faux.racine, 'logs', n), { recursive: true, force: true });
    mkdirSync(path.join(b.faux.racine, 'logs', n));
  }
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
  b.faux.chargerCle();
  const cfg = lireConfig(b.home);
  const exe = resoudreExecutables(['ssh'], b.faux.env.PATH ?? '');
  const agent: Pick<Agent, 'socket'> = { socket: path.join(b.faux.racine, 'agent.sock') };
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
  cc: Partial<ContexteDeploiement> & { confirmer: Confirmateur; envelopper?: (l: Lanceur) => Lanceur },
): Promise<{ code: number; texte: string }> {
  const lignes: string[] = [];
  const { envelopper, ...c } = cc;
  const code = await avecEnv(b, (lancer) =>
    executerDeploiement(
      { forcer: false, urgence: false, justification: '', dryRun: false, ...o },
      {
        lancer: envelopper === undefined ? lancer : envelopper(lancer),
        maintenant: () => new Date(HORS_GEL.getTime()),
        home: b.home,
        racine: b.racine,
        ecrire: (l) => lignes.push(l),
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
  // CR-02 : la copie privée de la build est supprimée elle aussi.
  const copies = path.dirname(cheminsLocaux(b.home).verrou);
  assert.deepEqual(existsSync(copies) ? readdirSync(copies).filter((n) => n.startsWith('build-')) : [], []);
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
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const c = confirmateur(phrase(b));
    const { code, texte } = await deployer(b, {}, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, [phrase(b)]);
    assert.deepEqual(verbesSsh(b), ['etat essai', `essai/${b.S}/`, 'etat essai', `activer essai ${b.S}`, 'etat essai']);
    assert.equal(await courant(b), b.S);
    assert.deepEqual(appelsNpm(b), ['ci --ignore-scripts', 'audit signatures', 'run build', 'run check-dist -- --mode production']);
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
    await mettreEnLigne(b, b.P);
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

  it('confirmation refusée : code 3, seul etat a été appelé, aucun envoi, journal refus', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
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

  /** Lanceur qui note tout lancement de ci:local (CR-01 : deploy:local ne le lance jamais). */
  const espionCi = (vus: string[]) => (l: Lanceur): Lanceur => async (x) => {
    if (x.args.some((a) => a.includes('ci-local'))) vus.push([x.commande, ...x.args].join(' '));
    return l(x);
  };

  it('aucun reçu (CR-01) : code 1, ci:local n\'est pas lancé, consigne de le lancer puis de relancer dans un nouveau terminal', async () => {
    const b = banc();
    const vus: string[] = [];
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), envelopper: espionCi(vus) });
    assert.equal(code, 1, texte);
    assert.deepEqual(vus, []);
    assert.match(texte, /aucun reçu de ci:local/);
    assert.match(texte, /lancer fnm exec --using=24 npm run ci:local, puis relancer deploy:local dans un nouveau terminal/);
    assert.deepEqual(appelsNpm(b), []);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
  });

  it('reçu sans recherche de secrets : code 1 qui nomme gitleaks, ci:local n\'est pas lancé', async () => {
    const b = banc();
    ecrireRecu(b.home, recu(b.S, 'non_executee'));
    const vus: string[] = [];
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), envelopper: espionCi(vus) });
    assert.equal(code, 1, texte);
    assert.deepEqual(vus, []);
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
  it('gel atteint entre l\'écran et la confirmation : code 1 après elle, aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
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
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void avancerOrigine(b, 'docs/suite.md')));
    assert.equal(code, 0, texte);
    assert.match(texte, /tête plus récente sans changement du site/);
    assert.equal(await courant(b), b.S);
  });

  it('origin a avancé avec src/ : code 1, aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void avancerOrigine(b, 'src/suite.txt')));
    assert.equal(code, 1, texte);
    assert.match(texte, /main a avancé/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('git fetch impossible après la confirmation : code 1, aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    nettoyages.push(() => rmSync(`${b.nu}-absent`, { recursive: true, force: true }));
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => renameSync(b.nu, `${b.nu}-absent`)));
    assert.equal(code, 1, texte);
    assert.match(texte, /git fetch impossible/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('cible passée de essai à production dans deploiement.env : code 1 « cible de la build différente », aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => b.faux.config(b.home, { RTP_CIBLE: 'production' })));
    assert.equal(code, 1, texte);
    assert.match(texte, /cible de la build différente de la cible du déploiement/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('.git/config modifié pendant la confirmation : code 1 « intégrité locale », aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => void git(b.racine, 'config', 'rtp.intrus', 'oui')));
    assert.equal(code, 1, texte);
    assert.match(texte, /intégrité locale modifiée/);
    assert.match(texte, /\.git\/config/);
    assert.equal(b.faux.journal('rsync').length, 0);
  });

  it('dist modifié après la build : code 1 « empreinte », aucun envoi', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
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
    await mettreEnLigne(b, b.P);
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
    await mettreEnLigne(b, b.P);
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
    await mettreEnLigne(b, b.P);
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 4, texte);
    assert.match(texte, /Content-Security-Policy/);
    assert.equal(await courant(b), b.P);
  });

  it('retrait d\'urgence et test de fumée en échec : aucun retour, code 5', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
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

  it('retour manuel vers la version d\'avant après activer : aucun retour automatique, code 1 « rien de ce déploiement n\'est en ligne » (WR-01)', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, {
      ...confirmateur(phrase(b)),
      apresActivation: async () => {
        b.faux.poserEntetes(SANS_CSP);
        await verbe(b, 'retour', ['essai', b.P]);
      },
    });
    assert.equal(code, 1, texte);
    assert.match(texte, /current pointe la version d'avant [0-9a-f]{40} : rien de ce déploiement n'est en ligne \(jamais activé, ou déjà remis par un retour manuel\)/);
    assert.equal(verbesSsh(b).filter((v) => v.startsWith('retour')).length, 1, 'seul le retour manuel');
    assert.equal(await courant(b), b.P);
  });

  it('commit déjà en ligne redéployé avec --forcer, fumée en échec : aucun retour, code 1', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.S);
    b.faux.poserEntetes(SANS_CSP);
    recuVert(b);
    const { code, texte } = await deployer(b, { forcer: true }, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.equal(await courant(b), b.S);
  });

  it('retour automatique en échec : code 5, message masqué', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ echecRetour: true });
    await mettreEnLigne(b, b.P);
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
      await mettreEnLigne(b, b.P);
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
      // WR-05 : un seul gestionnaire par signal, celui du déploiement (l'agent ne gère pas les signaux).
      assert.equal(ecoutes, 1, `gestionnaire du déploiement seul (${ecoutes})`);
      assert.ok(texte.includes(signal), texte);
      assert.equal(await courant(b), b.P);
      assert.equal(process.listenerCount(signal), 0, 'gestionnaires retirés');
    });
  }

  it('RTP_URL vide : déployé, test de fumée dit sauté, aucun appel de curl', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({}, { RTP_URL: '' });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 0, texte);
    assert.match(texte, /test de fumée HTTPS sauté : RTP_URL vide \(etat fait foi\)/);
    assert.equal(b.faux.journal('curl').length, 0);
  });
});

describe('échec du verbe activer : activé ou non ? (WR-01)', () => {
  const echec = (codeBrut: number | null, detail: string, delaiDepasse = false): EchecVerbe =>
    new EchecVerbe(codeBrut ?? 1, `activer essai : échec (code ${String(codeBrut)}) : ${detail}`, { codeBrut, delaiDepasse, detail });

  it('activationExclue : refus du serveur, verrou occupé, refus de ssh avant la commande ; jamais un délai, un signal ou un autre échec', () => {
    for (const c of [64, 65, 66, 75]) assert.equal(activationExclue(echec(c, 'refus')), true, String(c));
    assert.equal(activationExclue(echec(1, 'échec : verrou occupé depuis 20 s')), true);
    assert.equal(activationExclue(echec(1, 'échec : bascule de current impossible')), false);
    for (const d of ['<utilisateur>@<hôte>: Permission denied (publickey).', 'ssh: connect to host <hôte> port 22: Connection refused', 'Host key verification failed.', 'ssh: Could not resolve hostname <hôte>: nodename nor servname provided']) {
      assert.equal(activationExclue(echec(255, d)), true, d);
    }
    assert.equal(activationExclue(echec(255, 'Connection to <hôte> closed by remote host.')), false);
    assert.equal(activationExclue(echec(65, 'refus', true)), false, 'délai dépassé');
    assert.equal(activationExclue(echec(null, 'aucun message')), false, 'signal');
    assert.equal(activationExclue(new Sortie(65, 'refus')), false, 'pas un échec de verbe');
    assert.equal(activationExclue(null), false);
  });

  it('verrou du serveur occupé : code 1 « rien n\'a été activé », aucun retour automatique, journal echec', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    b.faux.echouerActiver('verrou');
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.match(texte, /activation refusée, rien n'a été activé \(version en ligne : [0-9a-f]{40}\) : activer essai : .*verrou occupé/);
    assert.doesNotMatch(texte, /retour manuel entre-temps|version en ligne est peut-être/);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')), verbesSsh(b).join(' | '));
    assert.equal(await courant(b), b.P);
    const j = journal(b);
    assert.equal(j.length, 1, JSON.stringify(j));
    assert.equal(j[0]?.resultat, 'echec');
    sansWorktree(b);
  });

  it('envoi refusé par la commande forcée à l\'activation (65) : code 1, aucun retour automatique', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    // Après l'envoi, version.json de incoming/ ne porte plus le commit : activer répond 65 sans rien changer.
    const envelopper = (l: Lanceur): Lanceur => async (x) => {
      const r = await l(x);
      if (x.args.includes('--stats')) {
        const f = path.join(b.faux.base, 'incoming', 'essai', b.S, 'version.json');
        writeFileSync(f, JSON.stringify({ commit: b.P }));
      }
      return r;
    };
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), envelopper });
    assert.equal(code, 1, texte);
    assert.match(texte, /activation refusée, rien n'a été activé/);
    assert.match(texte, /code 65/);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.equal(await courant(b), b.P);
  });

  it('échec ambigu de activer (code 1) sans bascule : retour automatique qui constate « rien de ce déploiement n\'est en ligne », code 1', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    b.faux.echouerActiver('bascule');
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 1, texte);
    assert.match(texte, /current pointe la version d'avant [0-9a-f]{40} : rien de ce déploiement n'est en ligne/);
    assert.doesNotMatch(texte, /retour manuel entre-temps/);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.equal(await courant(b), b.P);
    assert.equal(journal(b).at(-1)?.resultat, 'echec');
  });
});

describe('version en ligne relue avant l\'activation (WR-02)', () => {
  it('current changé pendant la confirmation (retour ou déploiement venu d\'ailleurs) : code 1, aucun activer', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const Q = 'c'.repeat(40);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => mettreEnLigne(b, Q)));
    assert.equal(code, 1, texte);
    assert.ok(texte.includes(`la version en ligne a changé depuis l'écran (${b.P} puis ${Q}) : rien n'est activé, relancer deploy:local`), texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('activer')), verbesSsh(b).join(' | '));
    assert.equal(await courant(b), Q);
    assert.equal(journal(b).at(-1)?.resultat, 'echec');
  });
});

describe('clé chargée seulement quand il le faut (CR-04, IN-07)', () => {
  const chargements = (b: Banc): number => b.faux.journal('ssh-add').filter((a) => a[1] === '-t').length;
  const retraits = (b: Banc): number => b.faux.journal('ssh-add').filter((a) => a[1] === '-D').length;

  it('clé expirée pendant l\'écran (confirmation tapée bien après la phrase de passe) : rechargée avant l\'envoi, déployé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    // Le faux agent n'a plus la clé quand la confirmation arrive : sans rechargement, l'envoi répondrait
    // « Permission denied (publickey) », comme sur le terrain avant cette correction.
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => b.faux.expirerCle()));
    assert.equal(code, 0, texte);
    assert.equal(retraits(b), 1, 'clé retirée avant l\'écran');
    assert.equal(chargements(b), 2, 'phrase de passe avant etat, puis avant l\'envoi');
    assert.match(texte, /sa phrase de passe sera redemandée juste avant l'envoi/);
    assert.match(texte, /Clé dédiée avant l'envoi : tapez de nouveau sa phrase de passe/);
    assert.equal(await courant(b), b.S);
  });

  it('la clé n\'est pas chargée pendant l\'attente de la confirmation', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    let pendant: boolean | null = null;
    let appels = '';
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b), () => {
      pendant = b.faux.cleChargee();
      appels = b.faux.journal('ssh-add').map((a) => a[1]).join(' ');
    }));
    assert.equal(code, 0, texte);
    assert.equal(pendant, false, 'clé absente du faux agent pendant la confirmation');
    assert.equal(appels, '-t -D', 'chargée pour etat, puis retirée avant l\'écran');
  });

  it('clé expirée entre l\'envoi et l\'activation : rechargée avant activer, déployé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    // La clé disparaît juste après le etat qui suit l'envoi (version d'avant notée), avant activer.
    let apresEnvoi = false;
    const envelopper = (l: Lanceur): Lanceur => async (x) => {
      const r = await l(x);
      if (x.args.includes('--stats')) apresEnvoi = true;
      else if (apresEnvoi && x.args.at(-1) === 'etat essai') {
        apresEnvoi = false;
        b.faux.expirerCle();
      }
      return r;
    };
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), envelopper });
    assert.equal(code, 0, texte);
    assert.equal(chargements(b), 3, texte);
    assert.match(texte, /Clé dédiée avant l'activation : tapez de nouveau sa phrase de passe/);
    assert.ok(verbesSsh(b).includes(`activer essai ${b.S}`));
    assert.equal(await courant(b), b.S);
  });

  it('moins de 12 min de clé restantes avant l\'activation : rechargée, de quoi vérifier et revenir en arrière', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    let t = HORS_GEL.getTime();
    // L'envoi « dure » 4 min : il reste 11 min de clé, moins que la vérification et le retour automatique.
    const envelopper = (l: Lanceur): Lanceur => async (x) => {
      const r = await l(x);
      if (x.args.includes('--stats')) t += 4 * 60_000;
      return r;
    };
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), envelopper, maintenant: () => new Date(t) });
    assert.equal(code, 0, texte);
    assert.equal(chargements(b), 3, texte);
    assert.match(texte, /Clé dédiée avant l'activation : tapez de nouveau sa phrase de passe à l'invite de ssh-add \(12 min/);
  });

  it('phrase de passe refusée au rechargement : code 3, aucun envoi, rien d\'activé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true, chargementsAdmis: 1 });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployer(b, {}, confirmateur(phrase(b)));
    assert.equal(code, 3, texte);
    assert.match(texte, /clé non chargée/);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.equal(await courant(b), b.P);
    sansWorktree(b);
  });

  it('message de ssh masqué quand la clé manque (Permission denied)', async () => {
    const b = banc({ exigerCle: true });
    const cfg = lireConfig(b.home);
    const exe = resoudreExecutables(['ssh'], b.faux.env.PATH ?? '');
    await assert.rejects(
      appelerVerbe(cfg, { socket: path.join(b.faux.racine, 'agent.sock') }, exe, 'etat', ['essai'], lancerReel),
      (e: unknown) => {
        assert.ok(e instanceof Sortie);
        assert.equal(e.code, 255);
        assert.match(e.message, /<utilisateur>@<hôte>: Permission denied \(publickey\)/);
        sorties.push(e.message);
        return true;
      },
    );
  });
});

describe('signal reçu avant l\'activation : arrêt propre (WR-05)', () => {
  it('SIGINT pendant la build : code 1, ni agent ni envoi, worktree et copie retirés, verrou rendu, journal refus', async () => {
    const b = banc();
    recuVert(b);
    const { code, texte } = await deployer(b, {}, { ...confirmateur(phrase(b)), apresConstruction: () => void process.emit('SIGINT', 'SIGINT') });
    assert.equal(code, 1, texte);
    assert.match(texte, /interrompu par SIGINT avant l'activation : rien n'a été activé/);
    assert.equal(b.faux.journal('ssh-agent').length, 0);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.equal(journal(b).at(-1)?.resultat, 'refus');
    assert.equal(process.listenerCount('SIGINT'), 0, 'gestionnaires retirés');
    sansWorktree(b);
  });

  it('SIGTERM pendant la confirmation : signal d\'arrêt transmis au confirmateur, code 1, aucun envoi, agent fermé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    let signalVu: AbortSignal | undefined;
    const { code, texte } = await deployer(b, {}, {
      confirmer: async (_p, o) => {
        signalVu = o?.arret;
        process.emit('SIGTERM', 'SIGTERM');
      },
    });
    assert.equal(code, 1, texte);
    assert.equal(signalVu?.aborted, true, 'le confirmateur reçoit le signal d\'arrêt');
    assert.match(texte, /interrompu par SIGTERM avant l'activation/);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.ok(b.faux.journal('ssh-agent').some((a) => a[1] === '-k'), 'agent arrêté');
    assert.equal(await courant(b), b.P);
    assert.equal(journal(b).at(-1)?.resultat, 'refus');
    sansWorktree(b);
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
    assert.equal(appelsNpm(b).length, 4, 'la build scellée a tourné');
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
