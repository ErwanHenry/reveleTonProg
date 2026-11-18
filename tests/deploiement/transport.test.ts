// Lien avec le serveur (LOC-02, LOC-03 ; D-04, D-07 ; T-09.2-18 à T-09.2-24) contre le faux serveur de
// tests/helpers/faux-serveur.ts : la vraie commande forcée ops/commande-deploiement.sh tourne derrière des ssh,
// rsync et curl factices, dans un dossier temporaire. Aucun accès réseau, aucun vrai serveur, aucun agent ssh réel.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lancer as lancerReel, type Lanceur } from '../../scripts/lib/processus.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { lireConfig, type ConfigDeploiement } from '../../scripts/lib/deploiement/config.ts';
import { resoudreExecutables, type Executables } from '../../scripts/lib/deploiement/executables.ts';
import type { Agent } from '../../scripts/lib/deploiement/agent.ts';
import {
  appelerVerbe,
  envoyer,
  exigerRsync3,
  lireActive,
  lireEtat,
  lireRetour,
  optionsSsh,
  varianteRsync,
  versionServie,
} from '../../scripts/lib/deploiement/transport.ts';
import {
  CLE_FACTICE,
  HOTE_FACTICE,
  MOT_DE_PASSE_FACTICE,
  UTILISATEUR_FACTICE,
  creerFauxServeur,
  type FauxServeur,
  type OptionsFauxServeur,
} from '../helpers/faux-serveur.ts';

const sha = (n: number | string): string => crypto.createHash('sha1').update(`version-${n}`).digest('hex');

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});

/** Tout texte rendu ou levé par le code testé, contrôlé à la fin (fuite de secrets ou d'identifiants). */
const sorties: string[] = [];
const SECRETS = [MOT_DE_PASSE_FACTICE, CLE_FACTICE, HOTE_FACTICE, UTILISATEUR_FACTICE];

interface Banc {
  faux: FauxServeur;
  home: string;
  cfg: ConfigDeploiement;
  exe: Executables;
  agent: Agent;
}

function banc(o: OptionsFauxServeur = {}, surcharges: Partial<Record<string, string>> = {}): Banc {
  const faux = creerFauxServeur(o);
  nettoyages.push(() => faux.detruire());
  const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-home-')));
  nettoyages.push(() => rmSync(home, { recursive: true, force: true }));
  faux.config(home, surcharges);
  const cfg = lireConfig(home);
  const exe = {
    ...resoudreExecutables(['ssh', 'curl', 'jq'], faux.env.PATH ?? ''),
    rsync: resoudreExecutables([cfg.rsync], faux.env.PATH ?? '')[cfg.rsync] as { chemin: string; empreinte: string },
  };
  const agent: Agent = { socket: path.join(faux.racine, 'agent', 'agent.sock'), fermer: async () => {} };
  return { faux, home, cfg, exe, agent };
}

function dist(s: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-dist-')));
  nettoyages.push(() => rmSync(d, { recursive: true, force: true }));
  writeFileSync(path.join(d, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  writeFileSync(path.join(d, 'version.json'), JSON.stringify({ commit: s, date: '2026-11-18T00:00:00Z' }));
  mkdirSync(path.join(d, 'theme'));
  writeFileSync(path.join(d, 'theme', 'index.html'), '<!doctype html><title>thème</title>\n');
  return d;
}

const lancer: Lanceur = lancerReel;

async function sortie(p: Promise<unknown>): Promise<Sortie> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof Sortie, `Sortie attendue, reçu ${String(e)}`);
    sorties.push(e.message);
    return e;
  }
  assert.fail('Sortie attendue');
}

const garder = <T>(v: T): T => {
  sorties.push(typeof v === 'string' ? v : JSON.stringify(v));
  return v;
};

const RAISON_MV = 'GNU mv requis';
const SONDE = creerFauxServeur();
const BASCULE = SONDE.basculePossible;
SONDE.detruire();

describe('optionsSsh', () => {
  it('options épinglées dans l\'ordre, socket de l\'agent éphémère, aucun ~/.ssh/config', () => {
    const b = banc();
    assert.deepEqual(optionsSsh(b.cfg, b.agent), [
      '-F', '/dev/null',
      '-i', b.cfg.cle,
      '-o', 'IdentitiesOnly=yes',
      '-o', `IdentityAgent=${b.agent.socket}`,
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes',
      '-o', `UserKnownHostsFile=${b.cfg.knownHosts}`,
      '-o', 'ConnectTimeout=15',
    ]);
  });
});

describe('analyse des réponses du serveur', () => {
  it('lireEtat : courant sha ou aucun (null), tout le reste null', () => {
    const s = sha(1);
    assert.deepEqual(lireEtat(`etat cible=essai courant=${s} versions=3 libre_mio=2048`), { cible: 'essai', courant: s, versions: 3, libreMio: 2048 });
    assert.deepEqual(lireEtat('etat cible=production courant=aucun versions=0 libre_mio=10'), { cible: 'production', courant: null, versions: 0, libreMio: 10 });
    for (const l of ['', 'etat cible=essai courant=xyz versions=1 libre_mio=1', `etat cible=prod courant=${s} versions=1 libre_mio=1`, `etat cible=essai courant=${s} versions=1 libre_mio=1 en_trop`, `x etat cible=essai courant=${s} versions=1 libre_mio=1`]) {
      assert.equal(lireEtat(l), null, l);
    }
  });

  it('lireActive et lireRetour', () => {
    const a = sha(1);
    const b = sha(2);
    assert.deepEqual(lireActive(`active cible=essai courant=${a} versions=2`), { cible: 'essai', courant: a, versions: 2 });
    assert.equal(lireActive(`active cible=essai courant=${a.toUpperCase()} versions=2`), null);
    assert.deepEqual(lireRetour(`retour cible=essai courant=${a} precedent=${b}`), { cible: 'essai', courant: a, precedent: b });
    assert.deepEqual(lireRetour(`retour cible=essai courant=${a} precedent=aucun`), { cible: 'essai', courant: a, precedent: null });
    assert.equal(lireRetour(`retour cible=essai courant=${a}`), null);
  });
});

describe('appelerVerbe contre la vraie commande forcée', () => {
  it('arbre vide : etat donne courant null ; argv ssh épinglé, chemin absolu en tête', async () => {
    const b = banc();
    const ligne = garder(await appelerVerbe(b.cfg, b.agent, b.exe, 'etat', ['essai'], lancer));
    const e = lireEtat(ligne);
    assert.ok(e !== null, ligne);
    assert.equal(e.courant, null);
    assert.equal(e.versions, 0);
    const appels = b.faux.journal('ssh');
    assert.equal(appels.length, 1);
    const argv = appels[0] as string[];
    assert.equal(argv[0], b.exe.ssh?.chemin);
    assert.ok(path.isAbsolute(argv[0] as string));
    assert.deepEqual(argv.slice(1), [...optionsSsh(b.cfg, b.agent), `${UTILISATEUR_FACTICE}@${HOTE_FACTICE}`, 'etat essai']);
  });

  it('refus avant tout lancement : cible prod, sha de 39 caractères, sha en majuscules, verbe rm, nombre d\'arguments', async () => {
    const b = banc();
    let lances = 0;
    const compteur: Lanceur = async (l) => {
      lances++;
      return lancer(l);
    };
    const s = sha(1);
    for (const [verbe, args] of [
      ['etat', ['prod']],
      ['activer', ['essai', s.slice(1)]],
      ['activer', ['essai', s.toUpperCase()]],
      ['rm', ['essai']],
      ['etat', ['essai', s]],
      ['activer', ['essai']],
      ['retour', ['essai', s, s]],
      ['activer', ['essai', `${s};id`]],
    ] as const) {
      const e = await sortie(appelerVerbe(b.cfg, b.agent, b.exe, verbe as never, [...args], compteur));
      assert.equal(e.code, 2, `${verbe} ${args.join(' ')}`);
    }
    assert.equal(lances, 0);
    assert.equal(b.faux.journal('ssh').length, 0);
  });

  it('code 66 du serveur : Sortie 66 « version introuvable »', async () => {
    const b = banc();
    const e = await sortie(appelerVerbe(b.cfg, b.agent, b.exe, 'retour', ['essai', sha(9)], lancer));
    assert.equal(e.code, 66);
    assert.match(e.message, /version introuvable/);
  });

  it('echecRetour : le stderr apparaît masqué (<hôte>), jamais avec la valeur', async () => {
    const b = banc({ echecRetour: true });
    const e = await sortie(appelerVerbe(b.cfg, b.agent, b.exe, 'retour', ['essai'], lancer));
    assert.equal(e.code, 1);
    assert.match(e.message, /connexion perdue vers <hôte>/);
    assert.ok(!e.message.includes('exemple.invalid'));
  });
});

describe('envoyer et activer (faux serveur)', () => {
  it('argv de rsync : -rt, --stats, ni -l, ni -a, ni --chmod ; -e porte ssh absolu et les options épinglées', async () => {
    const b = banc();
    const s = sha(1);
    const stats = garder(await envoyer(b.cfg, b.agent, b.exe, dist(s), 'essai', s, lancer));
    assert.match(stats, /Number of files: 3/);
    const appels = b.faux.journal('rsync');
    assert.equal(appels.length, 1);
    const argv = appels[0] as string[];
    assert.equal(argv[0], b.exe.rsync?.chemin);
    assert.ok(argv.includes('-rt'));
    assert.ok(argv.includes('--stats'));
    for (const a of argv) assert.ok(a !== '-l' && a !== '-a' && !a.startsWith('--chmod'), a);
    const iE = argv.indexOf('-e');
    assert.equal(argv[iE + 1], [b.exe.ssh?.chemin, ...optionsSsh(b.cfg, b.agent)].join(' '));
    assert.equal(argv.at(-1), `${UTILISATEUR_FACTICE}@${HOTE_FACTICE}:essai/${s}/`);
    assert.match(argv.at(-2) as string, /\/$/);
    // Le faux ssh a vu la commande serveur de rsync, avec les options épinglées.
    const ssh = b.faux.journal('ssh')[0] as string[];
    assert.equal(ssh[0], b.exe.ssh?.chemin);
    for (const opt of ['IdentitiesOnly=yes', 'BatchMode=yes', 'StrictHostKeyChecking=yes', 'ConnectTimeout=15', `IdentityAgent=${b.agent.socket}`, `UserKnownHostsFile=${b.cfg.knownHosts}`]) {
      assert.ok(ssh.includes(opt), opt);
    }
    assert.deepEqual(ssh.slice(ssh.indexOf('/dev/null') - 1, ssh.indexOf('/dev/null') + 1), ['-F', '/dev/null']);
  });

  it('envoyer puis activer : courant = sha ; retour après deux activations donne la précédente', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    const s1 = sha(1);
    const s2 = sha(2);
    await envoyer(b.cfg, b.agent, b.exe, dist(s1), 'essai', s1, lancer);
    const a1 = lireActive(garder(await appelerVerbe(b.cfg, b.agent, b.exe, 'activer', ['essai', s1], lancer)));
    assert.deepEqual(a1, { cible: 'essai', courant: s1, versions: 1 });
    const e1 = lireEtat(await appelerVerbe(b.cfg, b.agent, b.exe, 'etat', ['essai'], lancer));
    assert.equal(e1?.courant, s1);
    await envoyer(b.cfg, b.agent, b.exe, dist(s2), 'essai', s2, lancer);
    await appelerVerbe(b.cfg, b.agent, b.exe, 'activer', ['essai', s2], lancer);
    const r = lireRetour(garder(await appelerVerbe(b.cfg, b.agent, b.exe, 'retour', ['essai'], lancer)));
    assert.deepEqual(r, { cible: 'essai', courant: s1, precedent: s2 });
    const e2 = lireEtat(await appelerVerbe(b.cfg, b.agent, b.exe, 'etat', ['essai'], lancer));
    assert.equal(e2?.courant, s1);
    assert.equal(e2?.versions, 2);
  });

  it('openrsync : code 2, brew install rsync et RTP_RSYNC, aucun envoi', async () => {
    const b = banc({ rsync: 'openrsync' });
    assert.equal(await varianteRsync(b.exe.rsync?.chemin as string, lancer), 'openrsync');
    const s = sha(1);
    const e = await sortie(envoyer(b.cfg, b.agent, b.exe, dist(s), 'essai', s, lancer));
    assert.equal(e.code, 2);
    assert.match(e.message, /brew install rsync/);
    assert.match(e.message, /RTP_RSYNC/);
    assert.equal(b.faux.journal('rsync').length, 0);
    assert.equal(b.faux.journal('ssh').length, 0);
  });

  it('rsync à la sortie --version inconnue : même refus ; rsync 3 reconnu', async () => {
    const b = banc();
    assert.equal(await varianteRsync(b.exe.rsync?.chemin as string, lancer), 'rsync3');
    const inconnu = path.join(b.faux.racine, 'rsync-inconnu');
    writeFileSync(inconnu, '#!/bin/sh\necho "rsync  version 2.6.9  protocol version 29"\n', { mode: 0o755 });
    assert.equal(await varianteRsync(inconnu, lancer), 'inconnue');
    const exe = { ...b.exe, rsync: { chemin: inconnu, empreinte: '' } };
    const s = sha(1);
    const e = await sortie(envoyer(b.cfg, b.agent, exe, dist(s), 'essai', s, lancer));
    assert.equal(e.code, 2);
    assert.match(e.message, /brew install rsync/);
    assert.throws(() => exigerRsync3('inconnue'), (x: unknown) => x instanceof Sortie && x.code === 2);
    assert.doesNotThrow(() => exigerRsync3('rsync3'));
  });
});

describe('versionServie (faux curl)', () => {
  it('mot de passe sur l\'entrée standard de curl seulement ; commit et en-têtes lus', async () => {
    const b = banc();
    const s = sha(3);
    b.faux.servirCommit('essai', s, dist(s));
    const v = garder(await versionServie(b.cfg, b.exe, lancer));
    assert.deepEqual(v, { commit: s, hsts: true, csp: true });
    assert.equal(b.faux.motDePasseRecu(), `user = "sonde:${MOT_DE_PASSE_FACTICE}"`);
    const appels = b.faux.journal('curl');
    assert.equal(appels.length, 2);
    for (const argv of appels) {
      assert.ok(!argv.join(' ').includes(MOT_DE_PASSE_FACTICE));
      assert.ok(argv.includes('--config'));
      assert.equal(argv[argv.indexOf('--config') + 1], '-');
      for (const o of ['-fsS', '--retry-all-errors']) assert.ok(argv.includes(o), o);
    }
    assert.match((appels[0] as string[]).at(-1) as string, /\/version\.json$/);
    assert.ok((appels[1] as string[]).includes('-D'));
    assert.match((appels[1] as string[]).at(-1) as string, /\/$/);
  });

  it('CSP absente : csp false', async () => {
    const b = banc();
    const s = sha(4);
    b.faux.servirCommit('essai', s, dist(s));
    b.faux.poserEntetes(['HTTP/2 200', 'Strict-Transport-Security: max-age=63072000']);
    assert.deepEqual(await versionServie(b.cfg, b.exe, lancer), { commit: s, hsts: true, csp: false });
  });

  it('mot de passe avec " et \\ : échappés comme config_curl de ci.yml', async () => {
    const b = banc();
    const s = sha(5);
    b.faux.servirCommit('essai', s, dist(s));
    writeFileSync(b.cfg.fumeeMotDePasse as string, 'a"b\\c\n', { mode: 0o600 });
    await versionServie(b.cfg, b.exe, lancer);
    assert.equal(b.faux.motDePasseRecu(), 'user = "sonde:a\\"b\\\\c"');
  });

  it('échec de curl (22) : message masqué (<url>), jamais l\'adresse', async () => {
    const b = banc();
    const e = await sortie(versionServie(b.cfg, b.exe, lancer));
    assert.equal(e.code, 1);
    assert.match(e.message, /<url>/);
    assert.ok(!e.message.includes('exemple.invalid'));
  });

  it('URL absente : refus sans appel de curl', async () => {
    const b = banc({}, { RTP_URL: '' });
    const e = await sortie(versionServie(b.cfg, b.exe, lancer));
    assert.equal(e.code, 2);
    assert.equal(b.faux.journal('curl').length, 0);
  });
});

describe('fuite', () => {
  it('ni mot de passe, ni clé, ni hôte, ni utilisateur dans un texte rendu ou levé', () => {
    assert.ok(sorties.length > 10);
    for (const t of sorties) for (const s of SECRETS) assert.ok(!t.includes(s), `${s} dans : ${t}`);
  });
});
