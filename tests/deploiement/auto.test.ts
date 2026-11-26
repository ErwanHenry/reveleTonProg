// deploy:auto (10.3, plan 06 ; SC-2, SC-3, SC-4) : briques partagées, déploiement automatique contre la vraie
// commande forcée en mode --auto (tests/helpers/faux-serveur.ts, option modeAuto), CLI. Aucun contact avec un vrai
// serveur ; HOME et TMPDIR temporaires ; npm et sandbox-exec factices.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FENETRES_GEL } from '../../scripts/garde-gel.ts';
import { GEL_IMPORT } from '../../scripts/lib/veille/preparer.ts';
import { cheminsLocaux, lireConfig, lireConfigAuto } from '../../scripts/lib/deploiement/config.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { GEL_AUTO, evaluerGelAuto } from '../../scripts/lib/deploiement/gel-auto.ts';
import { ajouterJournal, dernierCommitEnLigne, type EntreeJournal } from '../../scripts/lib/deploiement/journal.ts';
import { optionsSsh } from '../../scripts/lib/deploiement/transport.ts';
import { FinApresActivation, retourAutomatique } from '../../scripts/lib/deploiement/deployer.ts';
import { lancer as lancerReel, type Lanceur } from '../../scripts/lib/processus.ts';
import { ETAPES, ecrireRecu, type Recu } from '../../scripts/lib/ci-local.ts';
import { resoudreExecutables } from '../../scripts/lib/deploiement/executables.ts';
import { appelerVerbe, envoyer, lireEtat } from '../../scripts/lib/deploiement/transport.ts';
import { executerDeploiementAuto, RESULTATS_DEPLOIEMENT_AUTO, type ContexteAuto } from '../../scripts/lib/deploiement/auto.ts';
import { HOTE_FACTICE, MOT_DE_PASSE_FACTICE, UTILISATEUR_FACTICE, creerFauxServeur, type FauxServeur, type OptionsFauxServeur } from '../helpers/faux-serveur.ts';

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});
function temp(prefixe: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefixe)));
  nettoyages.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

function readLignes(p: string): string[] {
  return readFileSync(p, 'utf8').split('\n').filter((l) => l !== '');
}

describe('gel de l\'automate', () => {
  it('fenêtre du 10 au 15 décembre 2026 et bornes', () => {
    assert.equal(evaluerGelAuto(new Date('2026-12-09T23:59:59+01:00')).gele, false);
    assert.equal(evaluerGelAuto(new Date('2026-12-10T00:00:00+01:00')).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-12-15T23:59:59+01:00')).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-12-16T00:00:00+01:00')).gele, false);
  });
  it('les gels des scrutins de garde-gel.ts restent gelés', () => {
    const f = FENETRES_GEL[0];
    assert.ok(f !== undefined);
    assert.equal(evaluerGelAuto(new Date(`${f.debut}T12:00:00+02:00`)).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-11-18T12:00:00Z')).gele, false);
  });
  it('GEL_AUTO contient GEL_IMPORT', () => {
    assert.ok(GEL_AUTO.debut.getTime() <= GEL_IMPORT.debut.getTime());
    assert.ok(GEL_AUTO.fin.getTime() >= GEL_IMPORT.fin.getTime());
  });
});

describe('configuration automatique', () => {
  it('lit deploiement-auto.env ; lireConfig(home) lit toujours deploiement.env', () => {
    const faux = creerFauxServeur();
    nettoyages.push(() => faux.detruire());
    const home = temp('rtp-home-auto-cfg-');
    faux.config(home, { RTP_CIBLE: 'production' });
    const manuel = cheminsLocaux(home).config;
    const auto = cheminsLocaux(home).configAuto;
    assert.equal(path.basename(auto), 'deploiement-auto.env');
    writeFileSync(auto, 'RTP_CIBLE=production\n' + readLignes(manuel).filter((l) => !l.startsWith('RTP_CIBLE=')).join('\n') + '\n');
    chmodSync(auto, 0o600);
    assert.equal(lireConfigAuto(home).fichier, auto);
    assert.equal(lireConfig(home).fichier, manuel);
  });
  it('cible autre que production : Sortie 2', () => {
    const faux = creerFauxServeur();
    nettoyages.push(() => faux.detruire());
    const home = temp('rtp-home-auto-cfg2-');
    faux.config(home, { RTP_CIBLE: 'essai' });
    writeFileSync(cheminsLocaux(home).configAuto, readLignes(cheminsLocaux(home).config).join('\n') + '\n');
    chmodSync(cheminsLocaux(home).configAuto, 0o600);
    assert.throws(() => lireConfigAuto(home), (e) => e instanceof Sortie && e.code === 2 && /production attendu/.test(e.message));
  });
  it('fichier absent : Sortie 2 qui nomme le chemin', () => {
    const home = temp('rtp-home-auto-cfg3-');
    assert.throws(() => lireConfigAuto(home), (e) => e instanceof Sortie && e.code === 2 && e.message.includes('deploiement-auto.env'));
  });
});


describe('clé directe, journal, retour automatique exporté', () => {
  it('optionsSsh : IdentityAgent=none sans socket, socket inchangé sinon', () => {
    const cfg = { cle: '/c', knownHosts: '/k' };
    assert.ok(optionsSsh(cfg, { socket: null }).includes('IdentityAgent=none'));
    assert.ok(optionsSsh(cfg, { socket: '/s.sock' }).includes('IdentityAgent=/s.sock'));
  });
  it('retourAutomatique et FinApresActivation sont exportés', () => {
    assert.equal(typeof retourAutomatique, 'function');
    assert.equal(typeof FinApresActivation, 'function');
  });
  const SHA_A = 'a'.repeat(40);
  const SHA_B = 'b'.repeat(40);
  const cfgMasque = { hote: 'h.invalid', utilisateur: 'u-x', url: null };
  const entree = (action: EntreeJournal['action'], commit: string, resultat: EntreeJournal['resultat'] = 'succes', cible: 'essai' | 'production' = 'production'): EntreeJournal =>
    ({ date: '2026-11-18T10:00:00Z', action, cible, commit, precedent: null, resultat, urgence: false });
  it('deployer-auto accepté, action inconnue refusée', () => {
    const home = temp('rtp-home-auto-j-');
    assert.equal(ajouterJournal(home, entree('deployer-auto', SHA_A), cfgMasque, () => {}), true);
    assert.throws(() => ajouterJournal(home, { ...entree('deployer', SHA_A), action: 'autre' as never }, cfgMasque, () => {}), /action inconnue/);
  });
  it('dernierCommitEnLigne : dernière ligne réussie de la cible, null sinon', () => {
    const home = temp('rtp-home-auto-j2-');
    assert.equal(dernierCommitEnLigne(home, 'production'), null);
    ajouterJournal(home, entree('deployer', SHA_A), cfgMasque, () => {});
    ajouterJournal(home, entree('deployer-auto', SHA_B, 'echec'), cfgMasque, () => {});
    ajouterJournal(home, entree('deployer', SHA_B, 'succes', 'essai'), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_A);
    ajouterJournal(home, entree('deployer-auto', SHA_B), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_B);
    ajouterJournal(home, entree('retour-auto', SHA_A, 'succes'), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_A);
  });
  it('journal illisible ou vide : null', () => {
    const home = temp('rtp-home-auto-j3-');
    const f = cheminsLocaux(home).journal;
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, 'pas du json\n\n');
    assert.equal(dernierCommitEnLigne(home, 'production'), null);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Déploiement automatique contre la vraie commande forcée en mode --auto
// ---------------------------------------------------------------------------------------------------------------
const HORS_GEL = new Date('2026-11-18T12:00:00Z');
const EN_GEL = new Date('2026-12-11T12:00:00+01:00');
const SECRETS = [MOT_DE_PASSE_FACTICE, HOTE_FACTICE, UTILISATEUR_FACTICE, 'essai.exemple.invalid'];
const RAISON_MV = 'GNU mv requis';
const SONDE_MV = creerFauxServeur();
const BASCULE = SONDE_MV.basculePossible;
SONDE_MV.detruire();
/** Tout texte rendu par le code testé, tout journal écrit et tout chemin de clé : contrôlés en fin de fichier. */
const sorties: string[] = [];
const cheminsCle: string[] = [];

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
function commit(racine: string, fichier: string, contenu: string): string {
  mkdirSync(path.dirname(path.join(racine, fichier)), { recursive: true });
  writeFileSync(path.join(racine, fichier), contenu);
  git(racine, 'add', fichier);
  git(racine, 'commit', '--quiet', '-m', `modifie ${fichier}`);
  return git(racine, 'rev-parse', 'HEAD');
}

interface Banc {
  faux: FauxServeur;
  home: string;
  racine: string;
  nu: string;
  outils: string;
  tmp: string;
  P: string;
  S: string;
}

function banc(o: OptionsFauxServeur = { modeAuto: true, cleSansPhrase: true }, surcharges: Partial<Record<string, string>> = {}, auto = true): Banc {
  const faux = creerFauxServeur(o);
  nettoyages.push(() => faux.detruire());
  const home = temp('rtp-home-auto-');
  faux.config(home, { RTP_CIBLE: 'production', ...surcharges });
  if (auto) {
    writeFileSync(cheminsLocaux(home).configAuto, readFileSync(cheminsLocaux(home).config, 'utf8'));
    chmodSync(cheminsLocaux(home).configAuto, 0o600);
  }
  cheminsCle.push(lireConfig(home).cle);

  const racine = temp('rtp-depot-auto-');
  git(racine, 'init', '--quiet', '-b', 'main');
  git(racine, 'config', 'user.email', 't@exemple.invalid');
  git(racine, 'config', 'user.name', 'Test');
  git(racine, 'config', 'commit.gpgsign', 'false');
  const P = commit(racine, 'src/a.txt', '0\n');
  const S = commit(racine, 'src/a.txt', '1\n');
  const nu = temp('rtp-origine-auto-');
  git(nu, 'init', '--quiet', '--bare', '-b', 'main');
  git(racine, 'remote', 'add', 'origin', nu);
  git(racine, 'push', '--quiet', 'origin', 'main');
  git(racine, 'fetch', '--quiet', 'origin');

  const outils = temp('rtp-outils-auto-');
  const tmp = temp('rtp-tmp-auto-');
  ecrireExecutable(
    path.join(outils, 'npm'),
    `#!/bin/sh
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
  ecrireExecutable(path.join(outils, 'sandbox-exec'), `#!/bin/sh\n[ "$1" = "-p" ] || exit 64\nshift 2\nexec "$@"\n`);
  return { faux, home, racine, nu, outils, tmp, P, S };
}

function recu(sha: string, etat: 'ok' | 'rouge' | 'partiel' = 'ok'): Recu {
  const r: Recu = {
    version: 1,
    commit: sha,
    date: '2026-11-18T10:00:00.000Z',
    node: 'v24.22.2',
    arbre_propre: true,
    partiel: etat === 'partiel',
    base_ids: null,
    secrets: 'ok',
    gitleaks: '8.30.1',
    etapes: ETAPES.map((e, i) => ({ id: e.id, nomCi: e.nomCi, resultat: etat === 'rouge' && i === 0 ? ('echec' as never) : ('ok' as const), duree_ms: 1 })),
  };
  return r;
}
const recuVert = (b: Banc, sha = b.S): void => ecrireRecu(b.home, recu(sha));

function distDe(s: string): string {
  const d = temp('rtp-dist-auto-');
  writeFileSync(path.join(d, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  writeFileSync(path.join(d, 'version.json'), JSON.stringify({ commit: s, date: '2026-11-18T00:00:00Z' }));
  return d;
}

/** Met la version donnée en ligne par la vraie commande forcée (clé directe) ; journaux ssh et rsync vidés ensuite. */
async function mettreEnLigne(b: Banc, s: string): Promise<void> {
  const cfg = lireConfig(b.home);
  const exe = { ...resoudreExecutables(['ssh'], b.faux.env.PATH ?? ''), rsync: resoudreExecutables([cfg.rsync], b.faux.env.PATH ?? '')[cfg.rsync] as { chemin: string; empreinte: string } };
  const agent = { socket: null };
  await envoyer(cfg, agent, exe, distDe(s), cfg.cible, s, lancerReel);
  await appelerVerbe(cfg, agent, exe, 'activer', [cfg.cible, s], lancerReel);
  for (const n of ['ssh', 'rsync', 'ssh-keygen', 'ssh-agent', 'ssh-add']) {
    rmSync(path.join(b.faux.racine, 'logs', n), { recursive: true, force: true });
    mkdirSync(path.join(b.faux.racine, 'logs', n));
  }
}

async function courant(b: Banc): Promise<string | null> {
  const cfg = lireConfig(b.home);
  const exe = resoudreExecutables(['ssh'], b.faux.env.PATH ?? '');
  return lireEtat(await appelerVerbe(cfg, { socket: null }, exe, 'etat', [cfg.cible], lancerReel))?.courant ?? null;
}

async function avecEnv<T>(b: Banc, f: (lancer: Lanceur) => Promise<T>): Promise<T> {
  const avant = { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR };
  const PATH = `${b.outils}:${b.faux.env.PATH ?? ''}`;
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

function horloge(instants: Date[]): () => Date {
  let i = 0;
  return () => {
    const d = instants[Math.min(i, instants.length - 1)] as Date;
    i++;
    return new Date(d.getTime());
  };
}

async function deployerAuto(
  b: Banc,
  c: Partial<ContexteAuto> & { envelopper?: (l: Lanceur) => Lanceur } = {},
  sha: string = b.S,
): Promise<{ code: number; texte: string; lignes: string[] }> {
  const lignes: string[] = [];
  const { envelopper, ...reste } = c;
  const code = await avecEnv(b, (lancer) =>
    executerDeploiementAuto(sha, {
      lancer: envelopper === undefined ? lancer : envelopper(lancer),
      maintenant: () => new Date(HORS_GEL.getTime()),
      home: b.home,
      racine: b.racine,
      ecrire: (l) => lignes.push(l),
      ...reste,
    }),
  );
  sorties.push(...lignes);
  return { code, texte: lignes.join('\n'), lignes };
}

const verbesSsh = (b: Banc): string[] => b.faux.journal('ssh').map((a) => a.at(-1) ?? '');
function journal(b: Banc): Record<string, unknown>[] {
  const f = cheminsLocaux(b.home).journal;
  if (!existsSync(f)) return [];
  const texte = readFileSync(f, 'utf8');
  sorties.push(texte);
  return texte.split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Record<string, unknown>);
}
const derniereLigne = (lignes: string[]): string => lignes.at(-1) ?? '';

function avancerOrigine(b: Banc, fichier: string): string {
  const clone = temp('rtp-clone-auto-');
  git(clone, 'clone', '--quiet', b.nu, '.');
  git(clone, 'config', 'user.email', 't@exemple.invalid');
  git(clone, 'config', 'user.name', 'Test');
  git(clone, 'config', 'commit.gpgsign', 'false');
  const s = commit(clone, fichier, 'suite\n');
  git(clone, 'push', '--quiet', 'origin', 'main');
  return s;
}

describe('deploy:auto contre la vraie commande forcée en mode --auto', () => {
  it('succès : code 0, verbes dans l\'ordre, aucun agent, journal deployer-auto, resultat=publie', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte, lignes } = await deployerAuto(b);
    assert.equal(code, 0, texte);
    assert.deepEqual(verbesSsh(b), ['etat essai', 'etat production', `production/${b.S}/`, 'etat production', `activer production ${b.S}`, 'etat production']);
    assert.equal(b.faux.journal('ssh-agent').length, 0);
    assert.equal(b.faux.journal('ssh-add').length, 0);
    assert.equal(await courant(b), b.S);
    assert.equal(derniereLigne(lignes), `resultat=publie sha=${b.S.slice(0, 12)}`);
    const j = journal(b);
    assert.equal(j.length, 1);
    assert.deepEqual(
      { action: j[0]?.action, cible: j[0]?.cible, resultat: j[0]?.resultat, commit: j[0]?.commit, precedent: j[0]?.precedent, urgence: j[0]?.urgence },
      { action: 'deployer-auto', cible: 'production', resultat: 'succes', commit: b.S, precedent: b.P, urgence: false },
    );
    assert.equal(existsSync(cheminsLocaux(b.home).verrou), false, 'verrou rendu');
  });

  it('serveur non restreint (etat essai répond) : code 6, aucun envoi', async () => {
    const b = banc({ cleSansPhrase: true });
    recuVert(b);
    const { code, texte, lignes } = await deployerAuto(b);
    assert.equal(code, 6, texte);
    assert.equal(derniereLigne(lignes), `resultat=serveur_non_restreint sha=${b.S.slice(0, 12)}`);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.equal(b.faux.journal('rsync').length, 0, 'aucun envoi rsync');
  });

  it('gel au départ : code 7, aucun contact avec le serveur', async () => {
    const b = banc();
    recuVert(b);
    const { code, texte, lignes } = await deployerAuto(b, { maintenant: () => new Date(EN_GEL.getTime()) });
    assert.equal(code, 7, texte);
    assert.equal(derniereLigne(lignes), `resultat=gel sha=${b.S.slice(0, 12)}`);
    assert.equal(b.faux.journal('ssh').length, 0);
  });

  it('gel survenu pendant la préparation : code 7 avant l\'envoi', async () => {
    const b = banc();
    recuVert(b);
    const { code, texte } = await deployerAuto(b, { maintenant: horloge([HORS_GEL, EN_GEL]) });
    assert.equal(code, 7, texte);
    assert.deepEqual(verbesSsh(b), ['etat essai', 'etat production']);
  });

  it('gel survenu pendant l\'envoi : code 7 juste avant activer, rien d\'activé', async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const { code, texte } = await deployerAuto(b, { maintenant: horloge([HORS_GEL, HORS_GEL, EN_GEL]) });
    assert.equal(code, 7, texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('activer')), verbesSsh(b).join(' | '));
    assert.equal(await courant(b), b.P);
  });

  it('verrou de déploiement tenu par un processus vivant : code 8', async () => {
    const b = banc();
    recuVert(b);
    const v = cheminsLocaux(b.home).verrou;
    mkdirSync(v, { recursive: true });
    writeFileSync(path.join(v, 'pid'), `${process.pid}\n`);
    const { code, texte, lignes } = await deployerAuto(b);
    assert.equal(code, 8, texte);
    assert.equal(derniereLigne(lignes).startsWith('resultat=verrou_pris'), true);
    assert.equal(b.faux.journal('ssh').length, 0);
  });

  it('pas de reçu, reçu partiel, reçu rouge : code 1, aucun contact avec le serveur', async () => {
    for (const etat of [null, 'partiel', 'rouge'] as const) {
      const b = banc();
      if (etat !== null) ecrireRecu(b.home, recu(b.S, etat));
      const { code, texte, lignes } = await deployerAuto(b);
      assert.equal(code, 1, `${etat}: ${texte}`);
      assert.equal(derniereLigne(lignes).startsWith('resultat=deploiement_refuse'), true);
      assert.equal(b.faux.journal('ssh').length, 0);
    }
  });

  it('main a avancé avec un changement du site : code 1', async () => {
    const b = banc();
    recuVert(b);
    avancerOrigine(b, 'src/b.txt');
    const { code, texte } = await deployerAuto(b);
    assert.equal(code, 1, texte);
    assert.match(texte, /main a avancé/);
    assert.equal(b.faux.journal('ssh').length, 0);
  });

  it('clé avec phrase de passe : code 2 config_absente ; fichier automatique absent : code 2', async () => {
    const b = banc({ modeAuto: true });
    recuVert(b);
    const r = await deployerAuto(b);
    assert.equal(r.code, 2, r.texte);
    assert.equal(derniereLigne(r.lignes), `resultat=config_absente sha=${b.S.slice(0, 12)}`);
    assert.equal(b.faux.journal('ssh').length, 0);
    const c = banc({ modeAuto: true, cleSansPhrase: true }, {}, false);
    recuVert(c);
    const r2 = await deployerAuto(c);
    assert.equal(r2.code, 2, r2.texte);
    assert.match(r2.texte, /deploiement-auto\.env|deploiement-auto/);
    assert.equal(c.faux.journal('ssh').length, 0);
  });

  it('RTP_URL vide : code 2 (test de fumée obligatoire en automatique)', async () => {
    const b = banc({ modeAuto: true, cleSansPhrase: true }, { RTP_URL: '' });
    recuVert(b);
    const { code, texte } = await deployerAuto(b);
    assert.equal(code, 2, texte);
    assert.match(texte, /RTP_URL/);
  });

  it('version déjà en ligne ou descendante : code 0 deja_en_ligne, rien d\'envoyé', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.S);
    recuVert(b);
    const r = await deployerAuto(b);
    assert.equal(r.code, 0, r.texte);
    assert.equal(derniereLigne(r.lignes), `resultat=deja_en_ligne sha=${b.S.slice(0, 12)}`);
    assert.deepEqual(verbesSsh(b).filter((v) => v.startsWith('activer') || v.endsWith('/')), []);
    // La version en ligne descend du commit demandé (suite sans changement du site) : rien à faire non plus.
    const S2 = commit(b.racine, 'docs/note.md', 'note\n');
    git(b.racine, 'push', '--quiet', 'origin', 'main');
    await mettreEnLigne(b, S2);
    const r2 = await deployerAuto(b);
    assert.equal(r2.code, 0, r2.texte);
    assert.equal(derniereLigne(r2.lignes), `resultat=deja_en_ligne sha=${b.S.slice(0, 12)}`);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.deepEqual(journal(b), []);
  });

  it('serveur injoignable à la sonde : code 9 hors_ligne', async () => {
    const b = banc();
    recuVert(b);
    const envelopper = (l: Lanceur): Lanceur => (x) =>
      x.args.at(-1) === 'etat essai' && x.commande.endsWith('/ssh')
        ? Promise.resolve({ code: 255, signal: null, stdout: '', stderr: `ssh: Could not resolve hostname ${HOTE_FACTICE}: Name or service not known`, dureeMs: 1, delaiDepasse: false })
        : l(x);
    const { code, texte, lignes } = await deployerAuto(b, { envelopper });
    assert.equal(code, 9, texte);
    assert.equal(derniereLigne(lignes), `resultat=hors_ligne sha=${b.S.slice(0, 12)}`);
  });

  it('fumée en échec : retour automatique vers la version d\'avant, code 4', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const apresActivation = (): void => writeFileSync(path.join(b.faux.base, 'current', 'version.json'), JSON.stringify({ commit: 'f'.repeat(40), date: '2026-11-18T00:00:00Z' }));
    const { code, texte, lignes } = await deployerAuto(b, { apresActivation });
    assert.equal(code, 4, texte);
    assert.equal(derniereLigne(lignes), `resultat=smoke_echec_retour_ok sha=${b.S.slice(0, 12)}`);
    assert.ok(verbesSsh(b).includes(`retour production ${b.P}`), verbesSsh(b).join(' | '));
    assert.equal(await courant(b), b.P);
    const j = journal(b);
    assert.deepEqual(j.map((e) => `${String(e.action)}:${String(e.resultat)}`), ['retour-auto:succes', 'deployer-auto:retour-auto']);
  });

  it('fumée en échec et retour en échec : code 5', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ modeAuto: true, cleSansPhrase: true, echecRetour: true });
    await mettreEnLigne(b, b.P);
    recuVert(b);
    const apresActivation = (): void => writeFileSync(path.join(b.faux.base, 'current', 'version.json'), JSON.stringify({ commit: 'f'.repeat(40), date: '2026-11-18T00:00:00Z' }));
    const { code, texte, lignes } = await deployerAuto(b, { apresActivation });
    assert.equal(code, 5, texte);
    assert.equal(derniereLigne(lignes), `resultat=smoke_echec_retour_ko sha=${b.S.slice(0, 12)}`);
  });
});

describe('sorties : aucun hôte, utilisateur, URL, mot de passe ni chemin de clé', () => {
  it('sentinelles absentes de toutes les sorties et de tous les journaux', () => {
    assert.ok(sorties.length > 0);
    const tout = sorties.join('\n');
    for (const s of SECRETS) assert.equal(tout.includes(s), false, `fuite : ${s}`);
    for (const c of cheminsCle) assert.equal(tout.includes(c), false, `fuite du chemin de clé : ${c}`);
    assert.equal(tout.includes('rtp-deploy-mac'), false, 'nom du fichier de clé');
    assert.ok(RESULTATS_DEPLOIEMENT_AUTO.includes('publie'));
  });
});
