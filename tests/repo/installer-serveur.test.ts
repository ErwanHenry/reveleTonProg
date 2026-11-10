// HEB-01, HEB-10, OPS-03 (08-03, D-01, D-04, D-05, D-15) : script d'installation idempotent du serveur
// (ops/installer-serveur.sh). Chaque cas lance le script avec bash sur une racine temporaire (--racine) et une
// source factice (--source) qui contient une version minimale de chaque fichier installé. Remplaçants en tête de
// PATH :
// - id : « id -u » répond 0 (ou STUB_ID_U) ; root et deploy ont l'uid et le gid du test, pour que la vérification
//   des propriétaires voie les fichiers du test comme conformes ; deploy n'existe qu'après useradd (fichier marque) ;
//   STUB_UID_ROOT donne à root un autre uid : les fichiers du test passent alors pour ceux de deploy ;
// - useradd, chown : consignent leurs arguments, ne changent rien ;
// - usermod, docker, caddy, systemctl, service, crontab, ufw, reboot : consignent un appel interdit (le test échoue) ;
// - ls (un seul cas) : simule un changement d'inode du Caddyfile.
// Aucune sortie ne doit contenir une empreinte, une adresse de ping ou une ligne du Caddyfile factice.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'ops/installer-serveur.sh');

function surPath(commande: string): boolean {
  return spawnSync('sh', ['-c', 'command -v "$1"', 'sh', commande], { encoding: 'utf8' }).status === 0;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-installer-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const ALPHABET_BCRYPT = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Empreinte factice au format bcrypt, construite à l'exécution (aucune valeur dans le dépôt). */
function empreinteFactice(variante: string): string {
  const octets = crypto.randomBytes(53);
  let corps = '';
  for (const o of octets) corps += ALPHABET_BCRYPT[o % ALPHABET_BCRYPT.length] ?? '.';
  return ['$', '2', variante, '$', '12', '$', corps].join('');
}
const ESSAI = empreinteFactice('y');
const SONDE = empreinteFactice('b');
const PING = ['https:/', '/hc-ping.com/', crypto.randomUUID()].join('');
const PING_RESTAURATION = ['https:/', '/hc-ping.com/', crypto.randomUUID()].join('');
const CLE = `ssh-ed25519 ${crypto.randomBytes(51).toString('base64')} rtp-deploy-test`;
const PREFIXE = 'restrict,command="/usr/local/sbin/rtp-deploy-command"';
const HORODATAGE = '202611082000';
const LIGNE_IMPORT = 'import /etc/caddy/sites.d/*.caddy';
const ETAPES = 'sauvegarde-caddy,montages,env-caddy,import-caddy,utilisateur,commande,battement,sauvegarde,restauration-mensuelle,site-essai,depot';

const CADDYFILE = ['site-factice-un.exemple.test {', '\trespond "contenu-prive-un"', '}', '', 'site-factice-deux.exemple.test {', '\treverse_proxy factice:8080', '}', ''].join('\n');
const LIGNES_CADDYFILE = CADDYFILE.split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 1);
const COMPOSE = ['services:', '  caddy:', '    image: caddy:2-alpine', '    restart: unless-stopped', ''].join('\n');
const ENV_AUTRE = "AUTRE_SERVICE='valeur sans rapport'  \n# commentaire du service voisin\n";
const ENTREE = [
  `RTP_ESSAI_HASH=${ESSAI}`,
  `RTP_SONDE_HASH=${SONDE}`,
  `HC_BATTEMENT=${PING}`,
  'RTP_HOTE=essai.exemple.fr',
  `HC_RESTAURATION=${PING_RESTAURATION}`,
  '',
].join('\n');

const SECRETS = [ESSAI, SONDE, PING, PING_RESTAURATION];

interface Banc {
  racine: string;
  source: string;
  stubs: string;
  journal: string;
  cle: string;
  uid: string;
  gid: string;
}

function ecrire(fichier: string, contenu: string, mode = 0o644): void {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, contenu, { mode });
  fs.chmodSync(fichier, mode);
}

function stub(dossier: string, nom: string, lignes: string[]): void {
  ecrire(path.join(dossier, nom), `${lignes.join('\n')}\n`, 0o755);
}

/** Bloc public factice : deux blocs de premier niveau (nom nu puis www), adresses d'exemple, accolades imbriquées. */
function blocPublic(adresses: [string, string] = ['site.exemple.fr', 'www.site.exemple.fr']): string {
  const [nu, www] = adresses;
  return [
    '# bloc de production factice { accolade de commentaire',
    `${nu} {`,
    '\troot * /srv/reveletonprog/current',
    '\theader {',
    '\t\t-Server',
    '\t}',
    '}',
    '',
    `${www} {`,
    '\tredir https://site.exemple.fr{uri} permanent',
    '}',
    '',
  ].join('\n');
}

function banc(options: { adresseEssai?: string; blocPublic?: string; sansEssaiSource?: boolean } = {}): Banc {
  const base = fs.mkdtempSync(path.join(tmp, 'cas-'));
  const racine = path.join(base, 'racine');
  const source = path.join(base, 'source');
  const stubs = path.join(base, 'stubs');
  const journal = path.join(base, 'journal');
  fs.mkdirSync(racine);
  fs.mkdirSync(stubs);
  fs.mkdirSync(journal);
  const st = fs.statSync(racine);

  // Serveur existant : dossier de composition avec le Caddyfile monté et le fichier de composition (600).
  ecrire(path.join(racine, 'opt/vaultwarden/Caddyfile'), CADDYFILE);
  ecrire(path.join(racine, 'opt/vaultwarden/docker-compose.yml'), COMPOSE, 0o600);

  // Source factice : une version minimale de chaque fichier installé.
  ecrire(path.join(source, 'ops/commande-deploiement.sh'), '#!/usr/bin/env bash\necho commande factice\n', 0o755);
  ecrire(path.join(source, 'ops/battement.sh'), '#!/usr/bin/env bash\necho battement factice\n', 0o755);
  ecrire(path.join(source, 'ops/sauvegarder-config.sh'), '#!/usr/bin/env bash\necho sauvegarde factice\n', 0o755);
  ecrire(path.join(source, 'ops/tester-restauration.sh'), '#!/usr/bin/env bash\necho restauration factice\n', 0o755);
  ecrire(path.join(source, 'ops/installer-serveur.sh'), '#!/usr/bin/env bash\necho installateur factice\n', 0o755);
  ecrire(path.join(source, 'deploy/compose/docker-compose.override.yml'), fs.readFileSync(path.join(ROOT, 'deploy/compose/docker-compose.override.yml'), 'utf8'));
  for (const c of ['rtp-battement', 'rtp-sauvegarde', 'rtp-restauration']) {
    ecrire(path.join(source, 'deploy/cron', c), fs.readFileSync(path.join(ROOT, 'deploy/cron', c), 'utf8'));
  }
  if (!options.sansEssaiSource) {
    ecrire(path.join(source, 'deploy/caddy/essai.caddy'), `# Bloc factice\n\n${options.adresseEssai ?? 'essai.exemple.fr'} {\n\trespond "essai"\n}\n`);
  }
  ecrire(path.join(source, 'deploy/caddy/site.caddy'), options.blocPublic ?? blocPublic());

  const cle = path.join(base, 'cle.pub');
  ecrire(cle, `${CLE}\n`);

  const interdit = (nom: string): void => stub(stubs, nom, ['#!/bin/sh', `printf '%s %s\\n' '${nom}' "$*" >> "$STUB_JOURNAL/interdits"`, 'exit 1']);
  for (const nom of ['usermod', 'gpasswd', 'docker', 'caddy', 'systemctl', 'service', 'crontab', 'ufw', 'reboot']) interdit(nom);
  stub(stubs, 'id', [
    '#!/bin/sh',
    'case "$*" in',
    '  "-u") echo "${STUB_ID_U:-0}" ;;',
    '  "-u root") echo "${STUB_UID_ROOT:-$STUB_UID}" ;;',
    '  "-g root") echo "$STUB_GID" ;;',
    '  "-u deploy"|"deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo "$STUB_UID" ;;',
    '  "-g deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo "$STUB_GID" ;;',
    '  "-nG deploy") [ -f "$STUB_JOURNAL/deploy-existe" ] || exit 1; echo "${STUB_GROUPES:-deploy}" ;;',
    '  *) exit 1 ;;',
    'esac',
  ]);
  stub(stubs, 'useradd', ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/useradd"', ': > "$STUB_JOURNAL/deploy-existe"']);
  stub(stubs, 'chown', ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_JOURNAL/chown"']);

  return { racine, source, stubs, journal, cle, uid: String(st.uid), gid: String(st.gid) };
}

interface Sortie {
  status: number | null;
  stdout: string;
  stderr: string;
}

function lancer(b: Banc, args: string[], options: { entree?: string; env?: Record<string, string> } = {}): Sortie {
  const r = spawnSync('bash', [SCRIPT, ...args, '--racine', b.racine, '--source', b.source], {
    encoding: 'utf8',
    input: options.entree ?? '',
    env: {
      ...process.env,
      PATH: `${b.stubs}:${process.env['PATH'] ?? ''}`,
      STUB_JOURNAL: b.journal,
      STUB_UID: b.uid,
      STUB_GID: b.gid,
      ...options.env,
    },
  });
  const tout = `${r.stdout}${r.stderr}`;
  for (const s of SECRETS) assert.ok(!tout.includes(s), 'une valeur secrète apparaît dans la sortie');
  for (const l of LIGNES_CADDYFILE) assert.ok(!tout.includes(l), `une ligne du Caddyfile apparaît dans la sortie : ${l}`);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const afaire = (s: Sortie): string[] => s.stdout.split('\n').filter((l) => l.startsWith('[a faire]'));
const faits = (s: Sortie): string[] => s.stdout.split('\n').filter((l) => l.startsWith('[fait]'));
const mode = (f: string): number => fs.statSync(f).mode & 0o777;
const lireJournal = (b: Banc, nom: string): string => {
  const f = path.join(b.journal, nom);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};

/** Liste récursive (chemin, type, mode, taille, contenu haché) pour prouver qu'un cas n'a rien écrit. */
function instantane(dossier: string): string[] {
  const lignes: string[] = [];
  const parcourir = (d: string): void => {
    for (const nom of fs.readdirSync(d).sort()) {
      const f = path.join(d, nom);
      const st = fs.lstatSync(f);
      const rel = path.relative(dossier, f);
      if (st.isDirectory()) {
        lignes.push(`${rel}/ ${(st.mode & 0o777).toString(8)}`);
        parcourir(f);
      } else if (st.isSymbolicLink()) {
        lignes.push(`${rel} -> ${fs.readlinkSync(f)}`);
      } else {
        const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
        lignes.push(`${rel} ${(st.mode & 0o777).toString(8)} ${h}`);
      }
    }
  };
  parcourir(dossier);
  return lignes;
}

function appliquerTout(b: Banc): Sortie {
  return lancer(b, ['--appliquer', '--etape', ETAPES, '--cle-publique', b.cle, '--horodatage', HORODATAGE], { entree: ENTREE });
}

describe('ops/installer-serveur.sh : arguments', () => {
  it('refuse une option, une étape ou un horodatage inconnus (code 2)', () => {
    const b = banc();
    assert.equal(lancer(b, []).status, 2, 'sans --etape');
    assert.equal(lancer(b, ['--etape', 'montages,inconnue']).status, 2);
    assert.equal(lancer(b, ['--etape', 'montages', '--bavard']).status, 2);
    assert.equal(lancer(b, ['--etape', 'montages', '--horodatage', '2026-11-08']).status, 2);
    assert.equal(lancer(b, ['--etape', '']).status, 2);
  });

  it('refuse une racine relative ou absente (code 2)', () => {
    const b = banc();
    const r = spawnSync('bash', [SCRIPT, '--etape', 'montages', '--racine', 'relative', '--source', b.source], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    const r2 = spawnSync('bash', [SCRIPT, '--etape', 'montages', '--racine', path.join(b.racine, 'absente'), '--source', b.source], { encoding: 'utf8' });
    assert.equal(r2.status, 2);
  });

  it('refuse --appliquer sur la vraie racine sans être root (code 3), avant toute action', () => {
    const b = banc();
    const r = spawnSync('bash', [SCRIPT, '--appliquer', '--etape', 'sauvegarde-caddy', '--racine', '/', '--source', b.source], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${b.stubs}:${process.env['PATH'] ?? ''}`, STUB_JOURNAL: b.journal, STUB_ID_U: '1000' },
    });
    assert.equal(r.status, 3, r.stderr);
  });

  it('affiche son usage avec --aide (code 0)', () => {
    const b = banc();
    const r = lancer(b, ['--aide']);
    assert.equal(r.status, 0);
    assert.match(r.stdout + r.stderr, /--verifier/);
  });
});

describe('ops/installer-serveur.sh : vérification sur un serveur vierge', () => {
  const b = banc();
  const avant = instantane(path.dirname(b.racine));
  const r = lancer(b, ['--etape', ETAPES, '--cle-publique', b.cle, '--horodatage', HORODATAGE]);

  it('sort en 0 et liste des actions à faire pour chaque étape', () => {
    assert.equal(r.status, 0, r.stderr);
    const lignes = afaire(r).join('\n');
    for (const attendu of [
      /\/opt\/vaultwarden\/Caddyfile/,
      /docker-compose\.yml/,
      /\/opt\/vaultwarden\/sites\.d/,
      /\/srv\/reveletonprog\/incoming\/essai/,
      /\/srv\/reveletonprog\/essai\/releases/,
      /\/var\/log\/caddy/,
      /docker-compose\.override\.yml/,
      /RTP_ESSAI_HASH absent/,
      /RTP_SONDE_HASH absent/,
      /ligne import/,
      /utilisateur deploy/,
      /\/home\/deploy\/\.ssh\/authorized_keys/,
      /\/usr\/local\/sbin\/rtp-deploy-command/,
      /\/usr\/local\/sbin\/rtp-battement/,
      /\/etc\/rtp\/battement\.env/,
      /\/etc\/cron\.d\/rtp-battement/,
      /\/usr\/local\/sbin\/rtp-sauvegarder/,
      /\/usr\/local\/sbin\/rtp-tester-restauration/,
      /\/etc\/cron\.d\/rtp-sauvegarde/,
      /\/etc\/rtp\/restauration\.env/,
      /\/etc\/cron\.d\/rtp-restauration/,
      /reveletonprog-essai\.caddy/,
      /\/opt\/rtp\/depot/,
    ]) {
      assert.match(lignes, attendu);
    }
    assert.equal(faits(r).length, 0);
  });

  it("n'écrit rien et n'appelle aucune commande système", () => {
    assert.deepEqual(instantane(path.dirname(b.racine)), avant);
    assert.equal(lireJournal(b, 'useradd'), '');
    assert.equal(lireJournal(b, 'chown'), '');
    assert.equal(lireJournal(b, 'interdits'), '');
  });
});

describe('ops/installer-serveur.sh : application de toutes les étapes', () => {
  const b = banc();
  const env = path.join(b.racine, 'opt/vaultwarden/.env');
  ecrire(env, ENV_AUTRE, 0o600);
  const caddyfile = path.join(b.racine, 'opt/vaultwarden/Caddyfile');
  const inodeAvant = fs.statSync(caddyfile).ino;
  const r = appliquerTout(b);
  const R = (rel: string): string => path.join(b.racine, rel);

  it('sort en 0 et annonce chaque action faite', () => {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(faits(r).length > 10);
    assert.equal(afaire(r).length, 0, afaire(r).join('\n'));
  });

  it('copie le Caddyfile et le fichier de composition avant toute modification (cp -p)', () => {
    assert.equal(fs.readFileSync(R(`opt/vaultwarden/Caddyfile.bak-${HORODATAGE}`), 'utf8'), CADDYFILE);
    assert.equal(fs.readFileSync(R(`opt/vaultwarden/docker-compose.yml.bak-${HORODATAGE}`), 'utf8'), COMPOSE);
    assert.equal(mode(R(`opt/vaultwarden/docker-compose.yml.bak-${HORODATAGE}`)), 0o600);
    assert.equal(fs.readFileSync(R('opt/vaultwarden/docker-compose.yml'), 'utf8'), COMPOSE, 'composition d’origine intacte');
  });

  it('crée les dossiers en 0755 et installe la surcharge en 0644', () => {
    for (const d of ['opt/vaultwarden/sites.d', 'srv/reveletonprog', 'srv/reveletonprog/incoming', 'srv/reveletonprog/incoming/essai', 'srv/reveletonprog/incoming/production', 'srv/reveletonprog/releases', 'srv/reveletonprog/essai', 'srv/reveletonprog/essai/releases', 'var/log/caddy']) {
      assert.ok(fs.statSync(R(d)).isDirectory(), d);
      assert.equal(mode(R(d)), 0o755, d);
    }
    const surcharge = R('opt/vaultwarden/docker-compose.override.yml');
    assert.equal(fs.readFileSync(surcharge, 'utf8'), fs.readFileSync(path.join(b.source, 'deploy/compose/docker-compose.override.yml'), 'utf8'));
    assert.equal(mode(surcharge), 0o644);
  });

  it('garde les autres lignes de .env octet pour octet et ajoute les deux clés entre apostrophes (0600)', () => {
    const contenu = fs.readFileSync(env, 'utf8');
    assert.ok(contenu.startsWith(ENV_AUTRE), 'lignes existantes modifiées');
    assert.equal(contenu, `${ENV_AUTRE}RTP_ESSAI_HASH='${ESSAI}'\nRTP_SONDE_HASH='${SONDE}'\n`);
    assert.equal(mode(env), 0o600);
  });

  it("ajoute la ligne import une fois, sur place (même inode)", () => {
    const contenu = fs.readFileSync(caddyfile, 'utf8');
    assert.ok(contenu.startsWith(CADDYFILE));
    assert.equal(contenu, `${CADDYFILE}\n${LIGNE_IMPORT}\n`);
    assert.equal(fs.statSync(caddyfile).ino, inodeAvant);
  });

  it('crée deploy sans groupe privilégié, clé restreinte possédée par root', () => {
    assert.equal(lireJournal(b, 'useradd'), '--system --create-home --shell /bin/bash --user-group -p * deploy\n');
    const ssh = R('home/deploy/.ssh');
    assert.equal(mode(ssh), 0o755);
    const ak = path.join(ssh, 'authorized_keys');
    assert.equal(fs.readFileSync(ak, 'utf8'), `${PREFIXE} ${CLE}\n`);
    assert.equal(mode(ak), 0o644);
    const chown = lireJournal(b, 'chown').split('\n');
    assert.ok(chown.includes(`root:root ${ak}`), 'authorized_keys doit appartenir à root');
    assert.ok(chown.includes(`root:root ${ssh}`), '.ssh doit appartenir à root');
    for (const d of ['srv/reveletonprog', 'srv/reveletonprog/incoming', 'srv/reveletonprog/essai/releases']) {
      assert.ok(chown.includes(`deploy:deploy ${R(d)}`), `${d} doit appartenir à deploy`);
    }
    assert.ok(!chown.some((l) => l.startsWith('deploy') && l.includes('.ssh')), 'deploy ne possède rien dans .ssh');
    assert.equal(lireJournal(b, 'interdits'), '');
  });

  it('dossier personnel /home/deploy à root en 0755 (WR-03 : deploy ne peut pas renommer .ssh)', () => {
    const home = R('home/deploy');
    assert.equal(mode(home), 0o755);
    const chown = lireJournal(b, 'chown').split('\n');
    assert.ok(chown.includes(`root:root ${home}`), '/home/deploy doit appartenir à root');
    assert.ok(!chown.some((l) => l.startsWith('deploy') && l.includes('home/deploy')), 'deploy ne possède rien chez lui');
  });

  it('installe les scripts en 0755 et les crons en 0644, copies exactes de la source', () => {
    const paires: [string, string, number][] = [
      ['ops/commande-deploiement.sh', 'usr/local/sbin/rtp-deploy-command', 0o755],
      ['ops/battement.sh', 'usr/local/sbin/rtp-battement', 0o755],
      ['ops/sauvegarder-config.sh', 'usr/local/sbin/rtp-sauvegarder', 0o755],
      ['ops/tester-restauration.sh', 'usr/local/sbin/rtp-tester-restauration', 0o755],
      ['deploy/cron/rtp-battement', 'etc/cron.d/rtp-battement', 0o644],
      ['deploy/cron/rtp-sauvegarde', 'etc/cron.d/rtp-sauvegarde', 0o644],
      ['deploy/cron/rtp-restauration', 'etc/cron.d/rtp-restauration', 0o644],
      ['deploy/caddy/essai.caddy', 'opt/vaultwarden/sites.d/reveletonprog-essai.caddy', 0o644],
    ];
    for (const [src, dst, m] of paires) {
      assert.equal(fs.readFileSync(R(dst), 'utf8'), fs.readFileSync(path.join(b.source, src), 'utf8'), dst);
      assert.equal(mode(R(dst)), m, dst);
    }
    const chown = lireJournal(b, 'chown').split('\n');
    assert.ok(chown.includes(`root:root ${R('usr/local/sbin/rtp-deploy-command')}`));
  });

  it("écrit les fichiers d'environnement de /etc/rtp en 0600 depuis l'entrée standard", () => {
    assert.equal(mode(R('etc/rtp')), 0o700);
    assert.equal(fs.readFileSync(R('etc/rtp/battement.env'), 'utf8'), `HC_BATTEMENT=${PING}\nRTP_HOTE=essai.exemple.fr\n`);
    assert.equal(mode(R('etc/rtp/battement.env')), 0o600);
    assert.equal(fs.readFileSync(R('etc/rtp/restauration.env'), 'utf8'), `HC_RESTAURATION=${PING_RESTAURATION}\n`);
    assert.equal(mode(R('etc/rtp/restauration.env')), 0o600);
  });

  it('copie ops/ et deploy/ seulement dans /opt/rtp/depot', () => {
    assert.deepEqual(fs.readdirSync(R('opt/rtp/depot')).sort(), ['deploy', 'ops']);
    assert.equal(fs.readFileSync(R('opt/rtp/depot/ops/commande-deploiement.sh'), 'utf8'), fs.readFileSync(path.join(b.source, 'ops/commande-deploiement.sh'), 'utf8'));
    assert.ok(fs.existsSync(R('opt/rtp/depot/deploy/caddy/essai.caddy')));
  });

  it('ne laisse aucun fichier temporaire', () => {
    const restes = instantane(b.racine).filter((l) => /\.rtp-installation\.|\.depot\./.test(l));
    assert.deepEqual(restes, []);
  });

  it('est idempotent : la vérification suivante ne trouve rien à faire', () => {
    const chownAvant = lireJournal(b, 'chown');
    const v = lancer(b, ['--etape', ETAPES, '--horodatage', HORODATAGE]);
    assert.equal(v.status, 0, v.stderr);
    assert.deepEqual(afaire(v), []);
    const a = lancer(b, ['--appliquer', '--etape', ETAPES, '--cle-publique', b.cle, '--horodatage', HORODATAGE]);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.deepEqual(faits(a), []);
    assert.deepEqual(afaire(a), []);
    assert.equal(fs.readFileSync(caddyfile, 'utf8').split('\n').filter((l) => l === LIGNE_IMPORT).length, 1);
    assert.equal(lireJournal(b, 'chown'), chownAvant);
    assert.equal(lireJournal(b, 'useradd').split('\n').filter(Boolean).length, 1);
    assert.match(v.stdout, /RTP_ESSAI_HASH présent/);
  });

  it('remplace une empreinte sans toucher aux autres lignes', () => {
    const nouvelle = empreinteFactice('a');
    SECRETS.push(nouvelle);
    const s = lancer(b, ['--appliquer', '--etape', 'env-caddy'], { entree: `RTP_ESSAI_HASH=${nouvelle}\n` });
    assert.equal(s.status, 0, s.stdout + s.stderr);
    assert.equal(fs.readFileSync(env, 'utf8'), `${ENV_AUTRE}RTP_ESSAI_HASH='${nouvelle}'\nRTP_SONDE_HASH='${SONDE}'\n`);
  });
});

describe('ops/installer-serveur.sh : refus', () => {
  it("refuse une empreinte mal formée (code 4) sans toucher à .env ni au reste", () => {
    const b = banc();
    const env = path.join(b.racine, 'opt/vaultwarden/.env');
    ecrire(env, ENV_AUTRE, 0o600);
    const avant = instantane(path.dirname(b.racine));
    for (const mauvaise of ['$2a$12$trop-court', `${ESSAI}x`, ESSAI.replace('$2y$', '$1$'), `'${ESSAI}'`]) {
      const r = lancer(b, ['--appliquer', '--etape', 'montages,env-caddy'], { entree: `RTP_ESSAI_HASH=${mauvaise}\nRTP_SONDE_HASH=${SONDE}\n` });
      assert.equal(r.status, 4, r.stdout + r.stderr);
      assert.ok(!(r.stdout + r.stderr).includes(mauvaise));
    }
    assert.deepEqual(instantane(path.dirname(b.racine)), avant);
  });

  it("refuse une ligne d'entrée inconnue, en double, ou pour une étape non demandée (code 4)", () => {
    const b = banc();
    const avant = instantane(path.dirname(b.racine));
    const cas: [string, string][] = [
      ['env-caddy', 'AUTRE=1\n'],
      ['env-caddy', `RTP_ESSAI_HASH=${ESSAI}\nRTP_ESSAI_HASH=${ESSAI}\n`],
      ['env-caddy', `HC_BATTEMENT=${PING}\n`],
      ['battement', `HC_BATTEMENT=http://hc-ping.invalid/x\n`],
      ['restauration-mensuelle', 'HC_RESTAURATION=javascript:alert(1)\n'],
    ];
    for (const [etape, entree] of cas) {
      const r = lancer(b, ['--appliquer', '--etape', etape], { entree });
      assert.equal(r.status, 4, `${etape} : ${r.stdout}${r.stderr}`);
    }
    assert.deepEqual(instantane(path.dirname(b.racine)), avant);
  });

  it('accepte une adresse de ping avec port, comme le battement et le test de restauration (IN-03)', () => {
    const b = banc();
    const r = lancer(b, ['--appliquer', '--etape', 'restauration-mensuelle'], { entree: 'HC_RESTAURATION=https://hc.exemple.fr:8443/ping/abc\n' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(path.join(b.racine, 'etc/rtp/restauration.env'), 'utf8'), 'HC_RESTAURATION=https://hc.exemple.fr:8443/ping/abc\n');
  });

  it('un seul motif d’adresse de ping dans les trois scripts (IN-03)', () => {
    const motif = (f: string): string => {
      const m = /^RE_URL_PING='([^']*)'$/m.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      assert.ok(m, `RE_URL_PING absent de ${f}`);
      return m[1] as string;
    };
    const ref = motif('ops/installer-serveur.sh');
    assert.equal(motif('ops/battement.sh'), ref);
    assert.equal(motif('ops/tester-restauration.sh'), ref);
  });

  it('refuse une clé publique qui n’est pas une seule ligne ssh-ed25519 (code 4)', () => {
    const b = banc();
    const avant = instantane(b.racine);
    for (const mauvaise of ['ssh-rsa AAAAB3Nza truc\n', `${CLE}\n${CLE}\n`, `command="x" ${CLE}\n`, `${CLE} commentaire avec espaces\n`]) {
      fs.writeFileSync(b.cle, mauvaise);
      const r = lancer(b, ['--appliquer', '--etape', 'utilisateur', '--cle-publique', b.cle]);
      assert.equal(r.status, 4, mauvaise);
    }
    assert.deepEqual(instantane(b.racine), avant);
    assert.equal(lireJournal(b, 'useradd'), '');
  });

  it('refuse un bloc d’essai dont le domaine est réservé (code 6) et accepte un vrai domaine', () => {
    for (const adresse of ['essai.exemple.invalid', 'essai.exemple.test', 'https://essai.exemple.example', 'essai.localhost:443', 'essai.exemple.fr, essai.exemple.invalid']) {
      const b = banc({ adresseEssai: adresse });
      lancer(b, ['--appliquer', '--etape', 'montages']);
      const avant = instantane(b.racine);
      const r = lancer(b, ['--appliquer', '--etape', 'site-essai']);
      assert.equal(r.status, 6, adresse);
      assert.deepEqual(instantane(b.racine), avant, adresse);
      assert.equal(lancer(b, ['--etape', 'site-essai']).status, 6, `vérification : ${adresse}`);
    }
    const b = banc({ adresseEssai: 'essai.exemple.fr' });
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const r = lancer(b, ['--appliquer', '--etape', 'site-essai']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(b.racine, 'opt/vaultwarden/sites.d/reveletonprog-essai.caddy')));
  });

  it("s'arrête (code 5) si l'inode du Caddyfile change pendant l'ajout", () => {
    const b = banc();
    stub(b.stubs, 'ls', [
      '#!/bin/sh',
      'if [ "$1" = "-di" ]; then',
      '  n=$(cat "$STUB_JOURNAL/ls" 2>/dev/null || echo 100); n=$((n+1)); echo "$n" > "$STUB_JOURNAL/ls"',
      '  echo "$n $2"; exit 0',
      'fi',
      'exec /bin/ls "$@"',
    ]);
    const r = lancer(b, ['--appliquer', '--etape', 'import-caddy']);
    assert.equal(r.status, 5, r.stdout + r.stderr);
  });

  it('ne crée jamais de Caddyfile absent (code 1)', () => {
    const b = banc();
    fs.rmSync(path.join(b.racine, 'opt/vaultwarden/Caddyfile'));
    for (const etape of ['import-caddy', 'sauvegarde-caddy']) {
      const r = lancer(b, ['--appliquer', '--etape', etape, '--horodatage', HORODATAGE]);
      assert.equal(r.status, 1, etape);
      assert.ok(!fs.existsSync(path.join(b.racine, 'opt/vaultwarden/Caddyfile')));
    }
  });

  it("n'écrase jamais une copie de sauvegarde existante", () => {
    const b = banc();
    const bak = path.join(b.racine, `opt/vaultwarden/Caddyfile.bak-${HORODATAGE}`);
    ecrire(bak, 'ancienne copie\n');
    const r = lancer(b, ['--appliquer', '--etape', 'sauvegarde-caddy', '--horodatage', HORODATAGE]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(bak, 'utf8'), 'ancienne copie\n');
  });

  it('vérification : signale un /home/deploy qui appartient à deploy, en 0750, et ses fichiers du squelette (WR-03)', () => {
    const b = banc();
    fs.writeFileSync(path.join(b.journal, 'deploy-existe'), '');
    const home = path.join(b.racine, 'home/deploy');
    fs.mkdirSync(path.join(home, '.ssh'), { recursive: true });
    fs.chmodSync(home, 0o750);
    ecrire(path.join(home, '.bashrc'), '# squelette\n');
    const avant = instantane(path.dirname(b.racine));
    // root a un autre uid que les fichiers du test : ils passent pour ceux de deploy.
    const r = lancer(b, ['--verifier', '--etape', 'utilisateur', '--cle-publique', b.cle], { env: { STUB_UID_ROOT: '424242' } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const lignes = afaire(r);
    assert.ok(lignes.includes('[a faire] /home/deploy : mode 755'), lignes.join('\n'));
    assert.ok(lignes.includes('[a faire] /home/deploy : propriétaire root:root'), lignes.join('\n'));
    assert.ok(lignes.some((l) => l.startsWith('[a faire] /home/deploy/.bashrc : propriétaire root:root')), lignes.join('\n'));
    assert.deepEqual(instantane(path.dirname(b.racine)), avant, 'la vérification n’écrit rien');
    assert.equal(lireJournal(b, 'chown'), '');
  });

  it('application : /home/deploy repasse à root en 0755, fichiers du squelette par chown -hR sans suivre de lien (WR-03)', () => {
    const b = banc();
    fs.writeFileSync(path.join(b.journal, 'deploy-existe'), '');
    const home = path.join(b.racine, 'home/deploy');
    fs.mkdirSync(path.join(home, '.ssh'), { recursive: true });
    fs.chmodSync(home, 0o750);
    ecrire(path.join(home, '.bashrc'), '# squelette\n');
    fs.symlinkSync('/etc/hostname', path.join(home, '.profile'));
    const r = lancer(b, ['--appliquer', '--etape', 'utilisateur', '--cle-publique', b.cle], { env: { STUB_UID_ROOT: '424242' } });
    assert.match(r.stdout, /\[fait\] \/home\/deploy : mode 755/);
    assert.equal(mode(home), 0o755);
    const chown = lireJournal(b, 'chown').split('\n');
    assert.ok(chown.includes(`root:root ${home}`), chown.join('\n'));
    assert.ok(chown.includes(`-hR root:root -- ${path.join(home, '.bashrc')}`), chown.join('\n'));
    assert.ok(chown.includes(`-hR root:root -- ${path.join(home, '.profile')}`), chown.join('\n'));
    assert.ok(!chown.some((l) => l.includes('.ssh/') && !l.startsWith('root:root')), 'rien dans .ssh pour deploy');
    assert.equal(lireJournal(b, 'interdits'), '');
  });

  it('refuse de continuer si deploy appartient à un groupe privilégié (code 1)', () => {
    const b = banc();
    fs.writeFileSync(path.join(b.journal, 'deploy-existe'), '');
    for (const groupes of ['deploy sudo', 'deploy docker', 'deploy wheel']) {
      const r = lancer(b, ['--appliquer', '--etape', 'utilisateur', '--cle-publique', b.cle], { env: { STUB_GROUPES: groupes } });
      assert.equal(r.status, 1, groupes);
    }
    assert.equal(lireJournal(b, 'interdits'), '');
  });

  it('signale une application incomplète (code 1) sans inventer de valeur', () => {
    const b = banc();
    const r = lancer(b, ['--appliquer', '--etape', 'montages,env-caddy']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /\[a faire\].*RTP_ESSAI_HASH absent/);
    assert.ok(!fs.existsSync(path.join(b.racine, 'opt/vaultwarden/.env')));
  });
});

describe('ops/installer-serveur.sh : bloc public (site-public)', () => {
  const ETAPES_TOUT = `${ETAPES},site-public`;
  const BLOC_PUBLIC = 'opt/vaultwarden/sites.d/reveletonprog.caddy';
  /** Racine de production : srv/reveletonprog/current, lien relatif comme le pose le verbe activer. */
  function avecCurrent(b: Banc): void {
    fs.mkdirSync(path.join(b.racine, 'srv/reveletonprog'), { recursive: true });
    fs.chmodSync(path.join(b.racine, 'srv/reveletonprog'), 0o755);
    fs.symlinkSync(`releases/${'b'.repeat(40)}`, path.join(b.racine, 'srv/reveletonprog/current'));
  }

  it('installe deploy/caddy/site.caddy en sites.d/reveletonprog.caddy (0644, root, par renommage)', () => {
    const b = banc();
    avecCurrent(b);
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const v = lancer(b, ['--etape', 'site-public']);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.ok(afaire(v).some((l) => l.includes('/opt/vaultwarden/sites.d/reveletonprog.caddy')), v.stdout);
    assert.ok(!fs.existsSync(path.join(b.racine, BLOC_PUBLIC)), 'la vérification n’écrit rien');
    const r = lancer(b, ['--appliquer', '--etape', 'site-public']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(faits(r).some((l) => l.includes('reveletonprog.caddy')), r.stdout);
    assert.equal(fs.readFileSync(path.join(b.racine, BLOC_PUBLIC), 'utf8'), fs.readFileSync(path.join(b.source, 'deploy/caddy/site.caddy'), 'utf8'));
    assert.equal(mode(path.join(b.racine, BLOC_PUBLIC)), 0o644);
    assert.ok(lireJournal(b, 'chown').split('\n').some((l) => l.startsWith('root:root ') && l.includes('sites.d/.rtp-installation.')), 'fichier temporaire à root avant renommage');
    assert.deepEqual(fs.readdirSync(path.join(b.racine, 'opt/vaultwarden/sites.d')), ['reveletonprog.caddy']);
    const a = lancer(b, ['--appliquer', '--etape', 'site-public']);
    assert.equal(a.status, 0);
    assert.deepEqual(faits(a), []);
    assert.match(a.stdout, /\[ok\] \/opt\/vaultwarden\/sites\.d\/reveletonprog\.caddy : à jour \(644\)/);
    assert.equal(lireJournal(b, 'interdits'), '');
  });

  it('accepte un dossier current (pas seulement un lien)', () => {
    const b = banc();
    fs.mkdirSync(path.join(b.racine, 'srv/reveletonprog/current'), { recursive: true });
    lancer(b, ['--appliquer', '--etape', 'montages']);
    assert.equal(lancer(b, ['--appliquer', '--etape', 'site-public']).status, 0);
  });

  it('refuse (code 7), dans les deux modes et sans rien écrire, tant que /srv/reveletonprog/current est absent', () => {
    const b = banc();
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const avant = instantane(b.racine);
    for (const m of ['--verifier', '--appliquer']) {
      const r = lancer(b, [m, '--etape', 'montages,site-public']);
      assert.equal(r.status, 7, `${m} : ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /déployer d'abord la cible production : le bloc public servirait une racine absente/);
    }
    assert.deepEqual(instantane(b.racine), avant);
  });

  it('refuse (code 6) une adresse réservée dans l’un ou l’autre bloc, ou un bloc sans adresse', () => {
    const cas: [string, string][] = [
      ['site.exemple.invalid', 'www.site.exemple.fr'],
      ['site.exemple.fr', 'www.site.exemple.invalid'],
      ['site.exemple.fr', 'www.site.exemple.test'],
      ['site.exemple.fr, autre.localhost', 'www.site.exemple.fr'],
      ['https://site.exemple.example', 'www.site.exemple.fr'],
    ];
    for (const adresses of cas) {
      const b = banc({ blocPublic: blocPublic(adresses) });
      avecCurrent(b);
      lancer(b, ['--appliquer', '--etape', 'montages']);
      const avant = instantane(b.racine);
      for (const m of ['--verifier', '--appliquer']) {
        const r = lancer(b, [m, '--etape', 'site-public']);
        assert.equal(r.status, 6, `${adresses.join(' / ')} ${m} : ${r.stdout}${r.stderr}`);
        assert.match(r.stderr, /bloc public : domaine réservé/);
      }
      assert.deepEqual(instantane(b.racine), avant);
    }
    for (const contenu of ['# commentaire seulement\n', 'respond "sans adresse"\n', 'site.exemple.fr {\n\troot * /x\n']) {
      const b = banc({ blocPublic: contenu });
      avecCurrent(b);
      const r = lancer(b, ['--etape', 'site-public']);
      assert.equal(r.status, 6, JSON.stringify(contenu));
      assert.match(r.stderr, /bloc public : adresse introuvable/);
    }
  });

  it('lit toutes les adresses de premier niveau du vrai bloc du dépôt (aucun domaine réservé)', () => {
    const b = banc({ blocPublic: fs.readFileSync(path.join(ROOT, 'deploy/caddy/site.caddy'), 'utf8') });
    avecCurrent(b);
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const r = lancer(b, ['--etape', 'site-public']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it('est idempotent avec toutes les étapes : deux applications, puis aucune action à faire', () => {
    const b = banc();
    avecCurrent(b);
    const r1 = lancer(b, ['--appliquer', '--etape', ETAPES_TOUT, '--cle-publique', b.cle, '--horodatage', HORODATAGE], { entree: ENTREE });
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    const r2 = lancer(b, ['--appliquer', '--etape', ETAPES_TOUT, '--cle-publique', b.cle, '--horodatage', HORODATAGE]);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.deepEqual(faits(r2), []);
    const v = lancer(b, ['--verifier', '--etape', ETAPES_TOUT, '--horodatage', HORODATAGE]);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.deepEqual(afaire(v), []);
    assert.ok(fs.existsSync(path.join(b.racine, BLOC_PUBLIC)));
    assert.ok(fs.existsSync(path.join(b.racine, 'opt/vaultwarden/sites.d/reveletonprog-essai.caddy')));
    assert.ok(fs.lstatSync(path.join(b.racine, 'srv/reveletonprog/current')).isSymbolicLink(), 'current jamais touché');
    assert.equal(lireJournal(b, 'interdits'), '');
  });
});

describe('ops/installer-serveur.sh : hôte technique retiré (marqueur /opt/rtp/essai-retire)', () => {
  const BLOC_ESSAI = 'opt/vaultwarden/sites.d/reveletonprog-essai.caddy';
  const MARQUEUR = 'opt/rtp/essai-retire';
  function bancRetire(options: { sansEssaiSource?: boolean; adresseEssai?: string } = {}): Banc {
    const b = banc(options);
    ecrire(path.join(b.racine, MARQUEUR), '');
    return b;
  }
  const lignesRetire = (s: Sortie): string[] => s.stdout.split('\n').filter((l) => l.startsWith('[ok: retiré]'));

  it('toutes les étapes en application : le bloc d’essai n’est pas réinstallé, une ligne [ok: retiré], code 0', () => {
    const b = bancRetire();
    const r = appliquerTout(b);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!fs.existsSync(path.join(b.racine, BLOC_ESSAI)), 'bloc d’essai réinstallé');
    const l = lignesRetire(r);
    assert.equal(l.length, 1, r.stdout);
    assert.match(l[0] ?? '', /^\[ok: retiré\] reveletonprog-essai\.caddy : hôte technique retiré le .+ \(marqueur présent\), rien à installer$/);
    assert.ok(fs.existsSync(path.join(b.racine, MARQUEUR)), 'le marqueur n’est jamais supprimé');
  });

  it('toutes les étapes en vérification : aucune action à faire pour site-essai', () => {
    const b = bancRetire();
    const r = lancer(b, ['--verifier', '--etape', ETAPES, '--cle-publique', b.cle, '--horodatage', HORODATAGE]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!afaire(r).some((l) => l.includes('essai.caddy')), afaire(r).join('\n'));
    assert.equal(lignesRetire(r).length, 1);
  });

  it('--etape site-essai seule, dans les deux modes : rien n’est écrit', () => {
    const b = bancRetire();
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const avant = instantane(path.dirname(b.racine));
    for (const m of ['--verifier', '--appliquer']) {
      const r = lancer(b, [m, '--etape', 'site-essai']);
      assert.equal(r.status, 0, `${m} : ${r.stdout}${r.stderr}`);
      assert.equal(lignesRetire(r).length, 1);
      assert.deepEqual(afaire(r), []);
      assert.deepEqual(faits(r), []);
    }
    assert.deepEqual(instantane(path.dirname(b.racine)), avant);
  });

  it('sans source deploy/caddy/essai.caddy ni adresse valide : code 0 (ni source manquante ni domaine réservé)', () => {
    const b = bancRetire({ sansEssaiSource: true });
    lancer(b, ['--appliquer', '--etape', 'montages']);
    const r = lancer(b, ['--appliquer', '--etape', 'site-essai']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const b2 = bancRetire({ adresseEssai: 'essai.exemple.invalid' });
    const r2 = lancer(b2, ['--verifier', '--etape', 'site-essai']);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  });

  it('sans le marqueur, le bloc d’essai est toujours installé, et sa source manquante reste une erreur (code 1)', () => {
    const b = banc();
    lancer(b, ['--appliquer', '--etape', 'montages']);
    assert.equal(lancer(b, ['--appliquer', '--etape', 'site-essai']).status, 0);
    assert.ok(fs.existsSync(path.join(b.racine, BLOC_ESSAI)));
    const b2 = banc({ sansEssaiSource: true });
    assert.equal(lancer(b2, ['--verifier', '--etape', 'site-essai']).status, 1);
  });
});

describe('ops/installer-serveur.sh : code', () => {
  const script = fs.readFileSync(SCRIPT, 'utf8');
  const code = script
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.replace(/\s#\s.*$/, ''))
    .join('\n');

  it('passe bash -n', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });

  it('passe shellcheck -S warning (si présent)', (t) => {
    if (!surPath('shellcheck')) return t.skip('shellcheck absent');
    const r = spawnSync('shellcheck', ['-S', 'warning', SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it('ne lance ni docker, ni caddy, ni systemctl, ni service, ni crontab, ni sed -i, ni reboot, ni ufw, ni eval', () => {
    assert.doesNotMatch(code, /\bdocker\b|caddy reload|systemctl|sed -i|\beval\b/);
    assert.doesNotMatch(code, /(^|[;&|(]|\bthen|\bdo|\belse)\s*(caddy|service|crontab|reboot|shutdown|ufw|usermod|gpasswd|sudo)\b/m);
    assert.doesNotMatch(code, /\bset -x\b|\bbash -c\b/);
  });

  it('ne supprime que ses propres fichiers temporaires', () => {
    const rm = code.split('\n').filter((l) => /\brm\b/.test(l));
    assert.equal(rm.length, 1, rm.join('\n'));
    assert.match(rm[0] ?? '', /rm -rf -- "\$t"/);
  });

  it("n'ajoute au Caddyfile que par >>, jamais par renommage", () => {
    const ajouts = code.match(/>>\s*"[^"]+"/g) ?? [];
    assert.deepEqual(ajouts, ['>> "$f"']);
    assert.match(code, /printf '\\n%s\\n' "\$LIGNE_IMPORT" >> "\$f"/);
  });

  it('écrit une seule fois la ligne restrict,command et la ligne import exacte', () => {
    assert.equal(script.split(PREFIXE).length - 1, 1);
    assert.ok(script.includes(`LIGNE_IMPORT='${LIGNE_IMPORT}'`));
  });

  it('a un en-tête avec usage et codes de sortie, en français sans tiret long', () => {
    assert.match(script, /^#!\/usr\/bin\/env bash\n/);
    assert.match(script, /set -euo pipefail/);
    assert.match(script, /Usage/);
    assert.match(script, /Codes de sortie/);
    assert.doesNotMatch(script, /[–—]/);
  });

  it('en-tête et usage nomment site-public, le marqueur et le code 7 ; le script ne crée ni ne supprime le marqueur', () => {
    const entete = script.split('\nset -euo pipefail')[0] ?? '';
    assert.match(entete, /site-public/);
    assert.match(entete, /essai-retire/);
    assert.match(entete, /7 bloc public refusé/);
    assert.match(script, /Étapes : [^\n]*\n[^\n]*site-essai, site-public, depot/);
    assert.match(code, /ORDRE_ETAPES='[^']*site-essai site-public depot'/);
    assert.doesNotMatch(code, /(touch|rm|:\s*>)[^\n]*MARQUEUR_ESSAI_RETIRE/);
  });
});
