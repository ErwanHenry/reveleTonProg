// HEB-01, OPS-03 (08-03, D-04, D-06, D-07, D-14, D-15) : fichiers du serveur versionnés dans deploy/.
// - deploy/compose/docker-compose.override.yml : surcharge fusionnée par docker compose dans /opt/vaultwarden. Elle
//   n'ajoute au service caddy que trois montages, deux variables d'empreinte refusées si absentes (${VAR:?}) et le
//   plafond des journaux du conteneur ; elle ne peut pas modifier le reste de la définition d'origine (image, ports,
//   réseaux, redémarrage, mémoire) et ne contient aucun secret.
// - deploy/cron/rtp-* : entrées /etc/cron.d (battement toutes les 5 minutes, sauvegarde quotidienne, test de
//   restauration le 1er du mois), sorties vers logger, sans URL ni secret.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const OVERRIDE = 'deploy/compose/docker-compose.override.yml';

interface Override {
  services?: Record<string, Record<string, unknown>>;
  [cle: string]: unknown;
}

function override(): { brut: string; doc: Override; caddy: Record<string, unknown> } {
  const brut = lire(OVERRIDE);
  const doc = parse(brut) as Override;
  const caddy = doc.services?.['caddy'];
  assert.ok(caddy, 'service caddy absent de la surcharge');
  return { brut, doc, caddy };
}

describe('deploy/compose/docker-compose.override.yml', () => {
  it("ne déclare que le service caddy et seulement volumes, environment, logging", () => {
    const { doc, caddy } = override();
    assert.deepEqual(Object.keys(doc), ['services']);
    assert.deepEqual(Object.keys(doc.services ?? {}), ['caddy']);
    assert.deepEqual(Object.keys(caddy).sort(), ['environment', 'logging', 'volumes']);
  });

  it('monte exactement les trois dossiers, la racine du site et sites.d en lecture seule', () => {
    const { caddy } = override();
    assert.deepEqual(caddy['volumes'], [
      '/srv/reveletonprog:/srv/reveletonprog:ro',
      '/var/log/caddy:/var/log/caddy',
      '/opt/vaultwarden/sites.d:/etc/caddy/sites.d:ro',
    ]);
    const volumes = caddy['volumes'] as string[];
    assert.ok(!(volumes[1] ?? '').endsWith(':ro'), 'le dossier des journaux doit rester inscriptible');
  });

  it('exige les deux empreintes (${VAR:?}) sans contenir de valeur', () => {
    const { brut, caddy } = override();
    const env = caddy['environment'] as Record<string, unknown>;
    assert.deepEqual(Object.keys(env).sort(), ['RTP_ESSAI_HASH', 'RTP_SONDE_HASH']);
    for (const [nom, valeur] of Object.entries(env)) {
      assert.equal(typeof valeur, 'string', nom);
      assert.match(valeur as string, /^\$\{RTP_(ESSAI|SONDE)_HASH:\?.+\}$/, nom);
      assert.ok((valeur as string).startsWith(`\${${nom}:?`), `${nom} doit lire sa propre variable`);
      assert.ok(!(valeur as string).includes('$2'), `${nom} ne doit contenir aucune empreinte`);
    }
    assert.equal(brut.match(/\$2/g)?.length ?? 0, 0, 'aucune empreinte bcrypt dans le fichier');
    assert.equal(brut.match(/:\?/g)?.length ?? 0, 2);
  });

  it("ne touche ni l'image, ni les ports, ni les réseaux, ni le redémarrage, ni la mémoire", () => {
    const { brut } = override();
    const code = brut
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    for (const cle of ['image', 'ports', 'networks', 'container_name', 'restart', 'mem_limit', 'depends_on', 'command', 'entrypoint', 'env_file']) {
      assert.doesNotMatch(code, new RegExp(`^\\s*${cle}\\s*:`, 'm'), `clé ${cle} interdite`);
    }
  });

  it('plafonne les journaux du conteneur (json-file, 10m, 3 fichiers)', () => {
    const { caddy } = override();
    assert.deepEqual(caddy['logging'], { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } });
  });

  it("explique en tête où le fichier est copié et le piège de « -f docker-compose.yml »", () => {
    const { brut } = override();
    const entete = brut
      .split('\n')
      .filter((l) => l.startsWith('#'))
      .join('\n');
    assert.match(entete, /\/opt\/vaultwarden/);
    assert.match(entete, /installation/i);
    assert.match(entete, /docker compose/);
    assert.match(entete, /-f docker-compose\.yml/);
    assert.match(entete, /montages/);
    assert.match(entete, /\.env/);
    assert.match(entete, /root/);
    assert.doesNotMatch(brut, /[\u2013\u2014]/, 'pas de tiret long ni moyen');
  });
});

interface Cron {
  nom: string;
  horaire: string;
  commande: string;
  /** Verrou flock -n placé devant la commande (WR-05) : un passage en cours fait sauter le suivant. */
  verrou?: string;
}

const CRONS: Cron[] = [
  { nom: 'rtp-battement', horaire: '*/5 * * * *', commande: '/usr/local/sbin/rtp-battement', verrou: '/run/rtp-battement.lock' },
  { nom: 'rtp-sauvegarde', horaire: 'QUOTIDIEN', commande: '/usr/local/sbin/rtp-sauvegarder' },
  { nom: 'rtp-restauration', horaire: '0 11 1 * *', commande: '/usr/local/sbin/rtp-tester-restauration' },
];

describe('deploy/cron/rtp-*', () => {
  for (const c of CRONS) {
    describe(c.nom, () => {
      const brut = lire(`deploy/cron/${c.nom}`);
      const lignes = brut.split('\n');
      const utiles = lignes.filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
      const variables = utiles.filter((l) => /^[A-Z_]+=/.test(l));
      const taches = utiles.filter((l) => !/^[A-Z_]+=/.test(l));

      it('se termine par un retour à la ligne, sans CR', () => {
        assert.ok(brut.endsWith('\n'));
        assert.ok(!brut.includes('\r'));
        assert.ok(/^[a-z-]+$/.test(c.nom), 'cron ignore les noms avec un point');
      });

      it('déclare SHELL=/bin/bash et un PATH', () => {
        assert.ok(variables.includes('SHELL=/bin/bash'));
        const p = variables.find((l) => l.startsWith('PATH='));
        assert.ok(p, 'ligne PATH absente');
        assert.match(p, /\/usr\/local\/sbin/);
        assert.match(p, /\/usr\/bin/);
      });

      it("a une seule tâche, lancée par root, vers logger", () => {
        assert.equal(taches.length, 1);
        const champs = (taches[0] ?? '').trim().split(/\s+/);
        const horaire = champs.slice(0, 5).join(' ');
        if (c.horaire === 'QUOTIDIEN') {
          assert.match(horaire, /^([0-5]?\d) ([01]?\d|2[0-3]) \* \* \*$/, 'quotidien à heure et minute fixes');
        } else {
          assert.equal(horaire, c.horaire);
        }
        assert.equal(champs[5], 'root');
        if (c.verrou) {
          assert.deepEqual(champs.slice(6, 9), ['flock', '-n', c.verrou], 'verrou non bloquant devant la commande');
          assert.equal(champs[9], c.commande);
        } else {
          assert.equal(champs[6], c.commande);
        }
        const tache = taches[0] ?? '';
        assert.match(tache, /\|\s*logger -t rtp-[a-z-]+\s*$/);
        assert.match(tache, /2>&1/);
        assert.doesNotMatch(tache, /\/tmp\/|>\s*\//, 'aucune sortie vers un fichier');
      });

      it("dit que l'heure est en UTC, sans URL ni secret", () => {
        assert.match(brut, /^#.*UTC/m);
        assert.doesNotMatch(brut, /https?:\/\//);
        assert.doesNotMatch(brut, /hc-ping/i);
        assert.doesNotMatch(brut, /\$2[aby]\$|PASS|TOKEN|HC_/);
        assert.doesNotMatch(brut, /[\u2013\u2014]/);
      });
    });
  }
});
