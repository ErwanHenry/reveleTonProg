// Fichier local de déploiement et masque des identifiants du serveur (LOC-02, LOC-04, D-04, D-07, D-09).
// Chaque cas pose un HOME temporaire avec des fichiers factices (clé, .pub, known_hosts, mot de passe de la sonde) :
// le vrai ~/.config/rtp n'est jamais lu. Valeurs factices seulement (exemple.invalid).
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { CLES_CONFIG, cheminsLocaux, cheminsSecrets, lireConfig, type ConfigDeploiement } from '../../scripts/lib/deploiement/config.ts';
import { masquer } from '../../scripts/lib/deploiement/masque.ts';

const MOT_DE_PASSE = 'MOT-DE-PASSE-FACTICE-9f3e';
const CLE = 'CLE-PRIVEE-FACTICE';
const HOTE = 'serveur.exemple.invalid';
const UTILISATEUR = 'deploy-factice';
const URL_ESSAI = 'https://essai.exemple.invalid/';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

/** Tous les messages levés par la suite, pour vérifier à la fin qu'aucun ne contient un secret. */
const messages: string[] = [];

interface Banc {
  home: string;
  rtp: string;
  fichier: string;
  ecrireConfig: (texte: string) => void;
}

const VALIDE = [
  '# fichier factice de test',
  'RTP_CIBLE=essai',
  `RTP_HOTE=${HOTE}`,
  `RTP_UTILISATEUR="${UTILISATEUR}"`,
  `RTP_URL=${URL_ESSAI}`,
  '',
  'RTP_RSYNC=/opt/homebrew/bin/rsync',
  '',
].join('\n');

function banc(texte: string = VALIDE): Banc {
  const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-home-')));
  dossiers.push(home);
  const rtp = path.join(home, '.config', 'rtp');
  mkdirSync(rtp, { recursive: true, mode: 0o700 });
  const ecrire = (nom: string, contenu: string, mode: number): void => {
    const p = path.join(rtp, nom);
    writeFileSync(p, contenu);
    chmodSync(p, mode);
  };
  ecrire('rtp-deploy-mac', `${CLE}\n`, 0o600);
  ecrire('rtp-deploy-mac.pub', 'ssh-ed25519 AAAAFACTICE rtp-deploy-mac\n', 0o644);
  ecrire('known_hosts-deploy', `${HOTE} ssh-ed25519 AAAAFACTICE\n`, 0o644);
  ecrire('sonde-pass', `${MOT_DE_PASSE}\n`, 0o600);
  const fichier = path.join(rtp, 'deploiement.env');
  const ecrireConfig = (t: string): void => ecrire('deploiement.env', t, 0o600);
  ecrireConfig(texte);
  return { home, rtp, fichier, ecrireConfig };
}

/** lireConfig doit lever Sortie(2) ; renvoie le message, gardé pour le contrôle final. */
function refus(home: string): string {
  try {
    lireConfig(home);
  } catch (e) {
    assert.ok(e instanceof Sortie, `Sortie attendue, reçu ${String(e)}`);
    assert.equal(e.code, 2);
    messages.push(e.message);
    return e.message;
  }
  assert.fail('refus attendu');
}

const remplacer = (cle: string, valeur: string | null): string => {
  const lignes = VALIDE.split('\n').filter((l) => !l.startsWith(`${cle}=`));
  if (valeur !== null) lignes.push(`${cle}=${valeur}`);
  return `${lignes.join('\n')}\n`;
};

describe('lireConfig : fichier valide', () => {
  it('donne la configuration attendue, ~/ développé et valeurs par défaut appliquées', () => {
    const b = banc();
    const cfg = lireConfig(b.home);
    const attendu: ConfigDeploiement = {
      cible: 'essai',
      hote: HOTE,
      utilisateur: UTILISATEUR,
      url: URL_ESSAI,
      cle: path.join(b.rtp, 'rtp-deploy-mac'),
      knownHosts: path.join(b.rtp, 'known_hosts-deploy'),
      fumeeUtilisateur: 'sonde',
      fumeeMotDePasse: path.join(b.rtp, 'sonde-pass'),
      rsync: '/opt/homebrew/bin/rsync',
      fichier: b.fichier,
    };
    assert.deepEqual(cfg, attendu);
  });

  it('cheminsSecrets liste les cinq chemins', () => {
    const b = banc();
    const cfg = lireConfig(b.home);
    assert.deepEqual(cheminsSecrets(cfg, b.home), [
      b.fichier,
      path.join(b.rtp, 'rtp-deploy-mac'),
      path.join(b.rtp, 'rtp-deploy-mac.pub'),
      path.join(b.rtp, 'known_hosts-deploy'),
      path.join(b.rtp, 'sonde-pass'),
    ]);
  });

  it('~/ développé sur un chemin donné, rsync par défaut, URL vide = null, production', () => {
    const b = banc();
    mkdirSync(path.join(b.home, 'cles'), { mode: 0o700 });
    writeFileSync(path.join(b.home, 'cles', 'autre'), `${CLE}\n`, { mode: 0o600 });
    writeFileSync(path.join(b.home, 'cles', 'autre.pub'), 'ssh-ed25519 AAAAFACTICE\n');
    b.ecrireConfig(['RTP_CIBLE=production', `RTP_HOTE=${HOTE}`, `RTP_UTILISATEUR=${UTILISATEUR}`, 'RTP_URL=', 'RTP_CLE=~/cles/autre', ''].join('\n'));
    const cfg = lireConfig(b.home);
    assert.equal(cfg.cible, 'production');
    assert.equal(cfg.url, null);
    assert.equal(cfg.cle, path.join(b.home, 'cles', 'autre'));
    assert.equal(cfg.rsync, 'rsync');
  });

  it('fumée désactivée : les deux clés vides donnent null, et cheminsSecrets n\'a plus que quatre chemins', () => {
    const b = banc(`${VALIDE}RTP_FUMEE_UTILISATEUR=\nRTP_FUMEE_MOT_DE_PASSE=\n`);
    const cfg = lireConfig(b.home);
    assert.equal(cfg.fumeeUtilisateur, null);
    assert.equal(cfg.fumeeMotDePasse, null);
    assert.equal(cheminsSecrets(cfg, b.home).length, 4);
  });

  it('cheminsLocaux sous HOME et CLES_CONFIG complet', () => {
    const home = '/tmp/rtp-home-x';
    assert.deepEqual(cheminsLocaux(home), {
      config: '/tmp/rtp-home-x/.config/rtp/deploiement.env',
      recus: '/tmp/rtp-home-x/.cache/rtp/ci',
      journal: '/tmp/rtp-home-x/.local/state/rtp/deploiements.jsonl',
      verrou: '/tmp/rtp-home-x/.cache/rtp/deploiement/.verrou',
    });
    assert.deepEqual([...CLES_CONFIG], [
      'RTP_CIBLE',
      'RTP_HOTE',
      'RTP_UTILISATEUR',
      'RTP_URL',
      'RTP_CLE',
      'RTP_KNOWN_HOSTS',
      'RTP_FUMEE_UTILISATEUR',
      'RTP_FUMEE_MOT_DE_PASSE',
      'RTP_RSYNC',
    ]);
  });
});

describe('lireConfig : refus (code 2, un message par cause)', () => {
  it('fichier absent : chemin et clés obligatoires nommés, aucune valeur', () => {
    const b = banc();
    rmSync(b.fichier);
    const m = refus(b.home);
    assert.match(m, /absent/);
    assert.ok(m.includes(b.fichier));
    for (const k of ['RTP_CIBLE', 'RTP_HOTE', 'RTP_UTILISATEUR']) assert.ok(m.includes(k), k);
  });

  const cas: { nom: string; texte: string; motif: RegExp }[] = [
    { nom: 'clé inconnue', texte: `${VALIDE}RTP_INCONNUE=x\n`, motif: /clé inconnue : RTP_INCONNUE/ },
    { nom: 'clé obligatoire manquante', texte: remplacer('RTP_HOTE', null), motif: /clé obligatoire absente : RTP_HOTE/ },
    { nom: 'cible inconnue', texte: remplacer('RTP_CIBLE', 'staging'), motif: /RTP_CIBLE.*essai.*production/ },
    { nom: 'hôte avec espace', texte: remplacer('RTP_HOTE', '"serveur exemple.invalid"'), motif: /RTP_HOTE/ },
    { nom: 'hôte avec barre oblique', texte: remplacer('RTP_HOTE', 'serveur.exemple.invalid/x'), motif: /RTP_HOTE/ },
    { nom: 'utilisateur en majuscules', texte: remplacer('RTP_UTILISATEUR', 'Deploy'), motif: /RTP_UTILISATEUR/ },
    { nom: 'URL http://', texte: remplacer('RTP_URL', 'http://essai.exemple.invalid/'), motif: /RTP_URL.*https/ },
    { nom: 'URL avec @', texte: remplacer('RTP_URL', 'https://moi:x@essai.exemple.invalid/'), motif: /RTP_URL/ },
    { nom: 'chemin avec espace', texte: remplacer('RTP_CLE', '"~/.config/rtp/ma cle"'), motif: /RTP_CLE.*espace/ },
    { nom: 'export', texte: `export RTP_CIBLE=essai\n${remplacer('RTP_CIBLE', null)}`, motif: /ligne 1.*export/ },
    { nom: 'expansion de shell', texte: remplacer('RTP_HOTE', '$(cat x)'), motif: /RTP_HOTE.*expansion/ },
    { nom: 'clé en double', texte: `${VALIDE}RTP_CIBLE=essai\n`, motif: /RTP_CIBLE.*plusieurs fois/ },
  ];
  for (const c of cas) {
    it(c.nom, () => {
      const b = banc(c.texte);
      const m = refus(b.home);
      assert.match(m, c.motif);
      // L'hôte et l'utilisateur ne sont jamais recopiés dans un message.
      assert.ok(!m.includes(HOTE), m);
      assert.ok(!m.includes(UTILISATEUR), m);
    });
  }

  it('fichier de déploiement en 0644', () => {
    const b = banc();
    chmodSync(b.fichier, 0o644);
    assert.match(refus(b.home), /deploiement\.env.*0644/);
  });

  it('clé en 0640', () => {
    const b = banc();
    chmodSync(path.join(b.rtp, 'rtp-deploy-mac'), 0o640);
    assert.match(refus(b.home), /rtp-deploy-mac.*0640/);
  });

  it('mot de passe de la sonde en 0604', () => {
    const b = banc();
    chmodSync(path.join(b.rtp, 'sonde-pass'), 0o604);
    assert.match(refus(b.home), /sonde-pass.*0604/);
  });

  it('.pub manquant', () => {
    const b = banc();
    rmSync(path.join(b.rtp, 'rtp-deploy-mac.pub'));
    assert.match(refus(b.home), /rtp-deploy-mac\.pub/);
  });

  it('known_hosts vide', () => {
    const b = banc();
    writeFileSync(path.join(b.rtp, 'known_hosts-deploy'), '');
    assert.match(refus(b.home), /known_hosts-deploy.*vide/);
  });

  it('une seule des deux clés de la fumée vide', () => {
    const b = banc(`${VALIDE}RTP_FUMEE_MOT_DE_PASSE=\n`);
    assert.match(refus(b.home), /RTP_FUMEE_UTILISATEUR.*RTP_FUMEE_MOT_DE_PASSE/);
  });

  it('secret mis par erreur dans le fichier : refusé sans être recopié', () => {
    for (const texte of [
      `${VALIDE}RTP_FUMEE_MOT_DE_PASSE=${MOT_DE_PASSE}\n`,
      `${VALIDE}RTP_MOT_DE_PASSE=${MOT_DE_PASSE}\n`,
      `${VALIDE}${MOT_DE_PASSE}\n`,
      `${VALIDE}${CLE}\n`,
    ]) {
      const b = banc(texte);
      refus(b.home);
    }
  });

  it('aucun message levé par la suite ne contient un secret factice', () => {
    assert.ok(messages.length >= 20, `messages collectés : ${messages.length}`);
    for (const m of messages) {
      assert.ok(!m.includes(MOT_DE_PASSE), m);
      assert.ok(!m.includes(CLE), m);
    }
  });
});

describe('masquer', () => {
  const cfg = { hote: HOTE, utilisateur: UTILISATEUR, url: URL_ESSAI };

  it('remplace hôte, utilisateur et URL par leurs étiquettes', () => {
    assert.equal(masquer(`ssh: connect to host ${HOTE} port 22`, cfg), 'ssh: connect to host <hôte> port 22');
    assert.equal(masquer(`${UTILISATEUR}@${HOTE}: Permission denied`, cfg), '<utilisateur>@<hôte>: Permission denied');
    assert.equal(masquer('curl: (22) https://essai.exemple.invalid/version.json 401', cfg), 'curl: (22) <url>version.json 401');
    assert.equal(masquer('vers https://essai.exemple.invalid, puis essai.exemple.invalid:443', cfg), 'vers <url>, puis <hôte>:443');
    assert.equal(masquer(`compte ${UTILISATEUR} refusé`, cfg), 'compte <utilisateur> refusé');
  });

  it('laisse intact un texte sans identifiant', () => {
    const t = 'rsync: connection unexpectedly closed (0 bytes received so far) [sender]';
    assert.equal(masquer(t, cfg), t);
  });

  it('utilisateur pris comme mot entier seulement', () => {
    assert.equal(masquer('xdeploy-facticex reste', cfg), 'xdeploy-facticex reste');
  });

  it('valeurs vides ou nulles ignorées', () => {
    assert.equal(masquer('rien à masquer', { hote: '', utilisateur: '', url: null }), 'rien à masquer');
  });

  it('les métacaractères d\'expression régulière d\'une valeur ne cassent rien', () => {
    const c = { hote: 'a.b', utilisateur: 'u_(x)', url: 'https://x.invalid/?q=[1]+*' };
    assert.equal(masquer('aXb a.b https://x.invalid/?q=[1]+* fin', c), 'aXb <hôte> <url> fin');
    assert.equal(masquer('par u_(x) ici', c), 'par <utilisateur> ici');
  });

  it('une étiquette déjà posée n\'est pas remasquée', () => {
    const c = { hote: 'h.invalid', utilisateur: 'url', url: null };
    assert.equal(masquer('url@h.invalid', c), '<utilisateur>@<hôte>');
  });
});
