// Fuites de bout en bout (T-09.2-36, D-07, D-10) : un déploiement réussi, un déploiement en échec avec retour
// automatique, un retour automatique en échec, un retour arrière et un etat, joués contre le faux serveur. Tout ce
// qui sort est collecté : argv de chaque exécutable factice (ssh, rsync, curl, ssh-agent, ssh-add, ssh-keygen, npm,
// et git par un enrobage journalisé en tête de PATH), environnement vu par le faux npm, chaque ligne écrite, le
// journal local et le reçu. Le mot de passe et la clé factices n'apparaissent nulle part ; l'hôte, l'utilisateur et
// l'URL factices n'apparaissent que dans les argv de ssh, rsync et curl (leur destination légitime). Contrôle
// positif : le faux curl a bien reçu le mot de passe sur son entrée standard, et chercherFuites attrape un argv qui
// le contiendrait.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lancer as lancerReel, type Lanceur } from '../../scripts/lib/processus.ts';
import { ETAPES, cheminRecu, ecrireRecu, type Recu } from '../../scripts/lib/ci-local.ts';
import { cheminsLocaux, lireConfig } from '../../scripts/lib/deploiement/config.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { resoudreExecutables } from '../../scripts/lib/deploiement/executables.ts';
import type { Agent } from '../../scripts/lib/deploiement/agent.ts';
import { appelerVerbe, envoyer } from '../../scripts/lib/deploiement/transport.ts';
import type { Confirmateur } from '../../scripts/lib/deploiement/confirmation.ts';
import { executerDeploiement } from '../../scripts/lib/deploiement/deployer.ts';
import { executerRetour } from '../../scripts/lib/deploiement/retour.ts';
import { executer } from '../../scripts/deploy-local.ts';
import { CLE_FACTICE, ENTETES_PAR_DEFAUT, HOTE_FACTICE, MOT_DE_PASSE_FACTICE, URL_FACTICE, UTILISATEUR_FACTICE, creerFauxServeur, type FauxServeur, type OptionsFauxServeur, type NomFaux } from '../helpers/faux-serveur.ts';

const HORS_GEL = new Date('2026-11-18T12:00:00Z');
const SANS_CSP = ENTETES_PAR_DEFAUT.filter((l) => !/^content-security-policy:/i.test(l));
const SECRETS = [MOT_DE_PASSE_FACTICE, CLE_FACTICE];
const IDENTIFIANTS = [HOTE_FACTICE, UTILISATEUR_FACTICE, URL_FACTICE];
const NOMS_FAUX: readonly NomFaux[] = ['ssh', 'rsync', 'curl', 'ssh-agent', 'ssh-add', 'ssh-keygen'];
const DESTINATION_LEGITIME: readonly NomFaux[] = ['ssh', 'rsync', 'curl'];
const SONDE = creerFauxServeur();
const BASCULE = SONDE.basculePossible;
SONDE.detruire();

/** Chaque secret trouvé dans un texte : « <secret> dans <étiquette> ». */
function chercherFuites(textes: { etiquette: string; texte: string }[], secrets: string[]): string[] {
  const trouvees: string[] = [];
  for (const { etiquette, texte } of textes) for (const s of secrets) if (texte.includes(s)) trouvees.push(`${s} dans ${etiquette}`);
  return trouvees;
}

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});
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
const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
function ecrireExecutable(p: string, contenu: string): void {
  writeFileSync(p, contenu);
  chmodSync(p, 0o755);
}
const GIT_REEL = (() => {
  const r = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'git introuvable');
  return realpathSync(r.stdout.trim());
})();

interface Banc {
  faux: FauxServeur;
  home: string;
  racine: string;
  outils: string;
  tmp: string;
  npmLog: string;
  gitLog: string;
  P: string;
  S: string;
}

/** Textes collectés pour le contrôle final. */
const sorties: { etiquette: string; texte: string }[] = [];
const bancs: Banc[] = [];

function commit(racine: string, fichier: string, contenu: string): string {
  mkdirSync(path.dirname(path.join(racine, fichier)), { recursive: true });
  writeFileSync(path.join(racine, fichier), contenu);
  git(racine, 'add', fichier);
  git(racine, 'commit', '--quiet', '-m', `modifie ${fichier}`);
  return git(racine, 'rev-parse', 'HEAD');
}

function banc(o: OptionsFauxServeur = {}): Banc {
  const faux = creerFauxServeur(o);
  nettoyages.push(() => faux.detruire());
  const home = temp('rtp-home-secrets-');
  faux.config(home);
  const racine = temp('rtp-depot-secrets-');
  git(racine, 'init', '--quiet', '-b', 'main');
  git(racine, 'config', 'user.email', 't@exemple.invalid');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'commit.gpgsign', 'false');
  const P = commit(racine, 'src/a.txt', '0\n');
  const S = commit(racine, 'src/a.txt', '1\n');
  const nu = temp('rtp-origine-secrets-');
  git(nu, 'init', '--quiet', '--bare', '-b', 'main');
  git(racine, 'remote', 'add', 'origin', nu);
  git(racine, 'push', '--quiet', 'origin', 'main');

  const outils = temp('rtp-outils-secrets-');
  const cache = temp('rtp-cache-secrets-');
  const tmp = temp('rtp-tmp-secrets-');
  const npmLog = path.join(outils, 'npm.log');
  const gitLog = path.join(outils, 'git.log');
  ecrireExecutable(
    path.join(outils, 'npm'),
    `#!/bin/sh
printf 'ARGV %s\\n' "$*" >> ${quote(npmLog)}
env | sed 's/^/ENV /' >> ${quote(npmLog)}
case "$*" in
  "config get cache") printf '%s\\n' ${quote(cache)} ;;
  "run build")
    mkdir -p dist
    printf '<!doctype html><title>%s</title>\\n' "$GITHUB_SHA" > dist/index.html
    printf '{"commit":"%s","date":"2026-11-18T00:00:00Z"}\\n' "$GITHUB_SHA" > dist/version.json
    ;;
  *) : ;;
esac
`,
  );
  ecrireExecutable(path.join(outils, 'sandbox-exec'), `#!/bin/sh\n[ "$1" = "-p" ] || exit 64\nshift 2\nexec "$@"\n`);
  ecrireExecutable(path.join(outils, 'git'), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${quote(gitLog)}\nexec ${quote(GIT_REEL)} "$@"\n`);
  const recu: Recu = {
    version: 1,
    commit: S,
    date: '2026-11-18T10:00:00.000Z',
    node: 'v24.22.2',
    arbre_propre: true,
    partiel: false,
    base_ids: null,
    secrets: 'ok',
    gitleaks: '8.30.1',
    etapes: ETAPES.map((e) => ({ id: e.id, nomCi: e.nomCi, resultat: 'ok' as const, duree_ms: 1 })),
  };
  ecrireRecu(home, recu);
  const b = { faux, home, racine, outils, tmp, npmLog, gitLog, P, S };
  bancs.push(b);
  return b;
}

async function avecEnv<T>(b: Banc, f: (lancer: Lanceur) => Promise<T>): Promise<T> {
  const avant = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR };
  const PATH = `${b.outils}:${b.faux.env.PATH ?? ''}`;
  process.env.PATH = PATH;
  process.env.TMPDIR = b.tmp;
  try {
    return await f((l) => lancerReel({ ...l, env: { ...l.env, PATH } }));
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Met en ligne la version par la vraie commande forcée (préparation, hors des journaux observés). */
async function mettreEnLigne(b: Banc, s: string): Promise<void> {
  const d = temp('rtp-dist-secrets-');
  writeFileSync(path.join(d, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  writeFileSync(path.join(d, 'version.json'), JSON.stringify({ commit: s, date: '2026-11-18T00:00:00Z' }));
  const cfg = lireConfig(b.home);
  const exe = { ...resoudreExecutables(['ssh'], b.faux.env.PATH ?? ''), rsync: resoudreExecutables([cfg.rsync], b.faux.env.PATH ?? '')[cfg.rsync] as { chemin: string; empreinte: string } };
  const agent: Pick<Agent, 'socket'> = { socket: path.join(b.faux.racine, 'agent.sock') };
  await envoyer(cfg, agent, exe, d, cfg.cible, s, lancerReel);
  await appelerVerbe(cfg, agent, exe, 'activer', [cfg.cible, s], lancerReel);
}

const confirmer = (attendue: string): Confirmateur => async (p) => {
  if (p !== attendue) throw new Sortie(3, 'confirmation refusée');
};

async function deployer(b: Banc, etiquette: string): Promise<number> {
  const lignes: string[] = [];
  const code = await avecEnv(b, (lancer) =>
    executerDeploiement(
      { forcer: false, urgence: false, justification: '', dryRun: false },
      { confirmer: confirmer(`deployer essai ${b.S.slice(0, 7)}`), lancer, maintenant: () => new Date(HORS_GEL.getTime()), home: b.home, racine: b.racine, ecrire: (l) => lignes.push(l) },
    ),
  );
  sorties.push({ etiquette, texte: lignes.join('\n') });
  return code;
}

describe('aucune fuite de secret ni d\'identifiant du serveur (T-09.2-36)', { skip: !BASCULE && 'GNU mv requis' }, () => {
  it('déploiement réussi, retour arrière, etat', async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    assert.equal(await deployer(b, 'déploiement réussi'), 0, sorties.at(-1)?.texte);
    assert.equal(b.faux.motDePasseRecu(), `user = "sonde:${MOT_DE_PASSE_FACTICE}"`, 'contrôle positif : mot de passe reçu par curl sur son entrée standard');

    const lignes: string[] = [];
    const code = await avecEnv(b, (lancer) =>
      executerRetour(
        { version: b.P, urgence: false, justification: '', dryRun: false },
        { confirmer: confirmer(`retour essai ${b.P.slice(0, 7)}`), lancer, maintenant: () => new Date(HORS_GEL.getTime()), home: b.home, racine: b.racine, ecrire: (l) => lignes.push(l) },
      ),
    );
    sorties.push({ etiquette: 'retour arrière', texte: lignes.join('\n') });
    assert.equal(code, 0, lignes.join('\n'));

    const lignesEtat: string[] = [];
    const codeEtat = await avecEnv(b, (lancer) => executer(['etat'], { home: b.home, racine: b.racine, lancer, ecrire: (l) => lignesEtat.push(l) }));
    sorties.push({ etiquette: 'etat', texte: lignesEtat.join('\n') });
    assert.equal(codeEtat, 0, lignesEtat.join('\n'));
  });

  it('déploiement en échec avec retour automatique (code 4)', async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    b.faux.poserEntetes(SANS_CSP);
    assert.equal(await deployer(b, 'retour automatique'), 4, sorties.at(-1)?.texte);
  });

  it('retour automatique en échec (code 5)', async () => {
    const b = banc({ echecRetour: true });
    await mettreEnLigne(b, b.P);
    b.faux.poserEntetes(SANS_CSP);
    assert.equal(await deployer(b, 'retour automatique en échec'), 5, sorties.at(-1)?.texte);
    assert.match(sorties.at(-1)?.texte ?? '', /retour automatique en échec/);
  });

  it('contrôle final : argv, environnements, sorties, journal et reçus', () => {
    assert.equal(bancs.length, 3);
    const legitimes: { etiquette: string; texte: string }[] = [];
    const autres: { etiquette: string; texte: string }[] = [...sorties];
    for (const [i, b] of bancs.entries()) {
      for (const n of NOMS_FAUX) {
        const argv = b.faux.journal(n).map((a) => a.join('\u0000'));
        assert.ok(argv.length > 0, `aucun appel de ${n} (banc ${i})`);
        for (const a of argv) (DESTINATION_LEGITIME.includes(n) ? legitimes : autres).push({ etiquette: `argv ${n} (banc ${i})`, texte: a });
      }
      autres.push({ etiquette: `npm, argv et environnement (banc ${i})`, texte: readFileSync(b.npmLog, 'utf8') });
      autres.push({ etiquette: `git, argv (banc ${i})`, texte: readFileSync(b.gitLog, 'utf8') });
      const j = cheminsLocaux(b.home).journal;
      assert.ok(existsSync(j), 'journal écrit');
      autres.push({ etiquette: `journal (banc ${i})`, texte: readFileSync(j, 'utf8') });
      autres.push({ etiquette: `reçu (banc ${i})`, texte: readFileSync(cheminRecu(b.home, b.S), 'utf8') });
      for (const f of readdirSync(path.dirname(cheminRecu(b.home, b.S)))) assert.ok(f.endsWith('.json'), f);
    }
    assert.ok(readFileSync(bancs[0]?.gitLog ?? '', 'utf8').includes('worktree add'), 'git journalisé par l\'enrobage');
    assert.ok(readFileSync(bancs[0]?.npmLog ?? '', 'utf8').includes('ENV GITHUB_SHA='), 'environnement du faux npm journalisé');
    assert.ok(legitimes.some((t) => t.texte.includes(HOTE_FACTICE)), 'contrôle positif : l\'hôte figure dans l\'argv de ssh');
    assert.ok(legitimes.some((t) => t.texte.includes(URL_FACTICE)), 'contrôle positif : l\'URL figure dans l\'argv de curl');

    assert.deepEqual(chercherFuites([...legitimes, ...autres], SECRETS), []);
    assert.deepEqual(chercherFuites(autres, IDENTIFIANTS), []);
  });

  it('contrôle positif : un appel qui met le mot de passe dans argv est attrapé par chercherFuites', async () => {
    const faux = creerFauxServeur();
    nettoyages.push(() => faux.detruire());
    const fautif = (motDePasse: string): Promise<unknown> =>
      lancerReel({ commande: path.join(faux.bin, 'curl'), args: ['-fsS', '-u', `sonde:${motDePasse}`, `${URL_FACTICE}/`], cwd: '/', env: faux.env, delaiMs: 60_000, libelle: 'appel fautif' });
    await fautif(MOT_DE_PASSE_FACTICE);
    const textes = faux.journal('curl').map((a, i) => ({ etiquette: `argv curl ${i}`, texte: a.join('\u0000') }));
    assert.deepEqual(chercherFuites(textes, SECRETS), [`${MOT_DE_PASSE_FACTICE} dans argv curl 0`]);
  });
});
