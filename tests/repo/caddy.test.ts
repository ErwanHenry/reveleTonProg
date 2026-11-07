// HEB-05, PERF-01 (D-03, 07-07) : le bloc Caddy du site est rendu depuis config/site.yml et src/scripts/*.js par
// une fonction pure (scripts/render-caddy.ts). Ce test fige sa politique : en-tête CSP limité aux deux empreintes
// de scripts plus frame-ancestors (jamais de default-src : l'intersection avec le meta de chaque page bloquerait
// les <style> hachés), journal d'accès tourné chaque jour et gardé 14 jours au plus (CR-01), IP masquée et en-têtes
// de requête supprimés.
// Domaine synthétique : exemple.test ; le domaine du dépôt n'est jamais écrit ici (garde 07-06), il est lu.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cspEnTete,
  FICHIERS_TOURNES_GARDES,
  JOURNAL,
  RACINE_SERVEUR,
  RETENTION_MAX_JOURS,
  ROTATION_JOURNAL,
  TAILLE_JOURNAL,
  renderCaddy,
} from '../../scripts/render-caddy.ts';
import { scriptsEnLigne } from '../../src/lib/csp-empreintes.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(REPO, 'scripts', 'render-caddy.ts');
const BLOC = path.join(REPO, 'deploy', 'caddy', 'site.caddy');

const SYNTHETIQUE = {
  domaine: 'exemple.test',
  empreintesScripts: ['sha256-AAA=', 'sha256-BBB='],
  racine: '/srv/x/current',
  journal: '/var/log/caddy/x.log',
} as const;

/** Valeur de l'en-tête CSP (entre guillemets) ; échoue s'il n'y en a pas exactement un. */
function valeurCsp(bloc: string): string {
  const trouves = [...bloc.matchAll(/^\t\tContent-Security-Policy "([^"]*)"$/gm)];
  assert.equal(trouves.length, 1, `un seul en-tête CSP attendu, ${trouves.length} trouvé(s)`);
  return trouves[0]![1]!;
}

/** Contenu du bloc `log { … }` (de la ligne `\tlog {` à la ligne `\t}` qui la ferme). */
function blocJournal(bloc: string): string {
  const m = /^\tlog \{\n([\s\S]*?)^\t\}$/m.exec(bloc);
  assert.ok(m, 'bloc log absent');
  return m[1]!;
}

const sansCommentaires = (bloc: string): string =>
  bloc
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

describe('renderCaddy : adresse du site et redirection www', () => {
  const bloc = renderCaddy(SYNTHETIQUE);

  it('première ligne : fichier généré par scripts/render-caddy.ts depuis config/site.yml, à ne pas modifier à la main', () => {
    const premiere = bloc.split('\n')[0]!;
    assert.match(premiere, /^# /);
    assert.match(premiere, /scripts\/render-caddy\.ts/);
    assert.match(premiere, /config\/site\.yml/);
    assert.match(premiere, /ne pas modifier à la main/);
  });

  it('bloc du domaine, racine et journal donnés, redirection permanente de www vers l’apex', () => {
    assert.match(bloc, /^exemple\.test \{$/m);
    assert.match(bloc, /^www\.exemple\.test \{$/m);
    assert.match(bloc, /^\tredir https:\/\/exemple\.test\{uri\} permanent$/m);
    assert.match(bloc, /^\troot \* \/srv\/x\/current$/m);
    assert.match(bloc, /^\t\toutput file \/var\/log\/caddy\/x\.log \{$/m);
    assert.match(bloc, /^\tencode zstd gzip$/m);
    assert.match(bloc, /^\tfile_server$/m);
  });

  it('un autre domaine change l’adresse et la redirection, et rien d’autre que ces occurrences', () => {
    const autre = renderCaddy({ ...SYNTHETIQUE, domaine: 'autre-exemple.test' });
    assert.notEqual(autre, bloc);
    assert.match(autre, /^autre-exemple\.test \{$/m);
    assert.match(autre, /^www\.autre-exemple\.test \{$/m);
    assert.match(autre, /^\tredir https:\/\/autre-exemple\.test\{uri\} permanent$/m);
    assert.equal(autre.replaceAll('autre-exemple.test', 'exemple.test'), bloc);
  });

  it('pureté : le rendu pour exemple.test ne contient ni le domaine du dépôt ni un domaine .invalid', () => {
    const { domaine } = loadSiteConfig(REPO, {});
    assert.ok(!bloc.includes(domaine), `le domaine du dépôt fuit dans un rendu synthétique`);
    assert.ok(!bloc.includes('.invalid'));
  });

  it('déterministe : même entrée, même chaîne ; tabulations, pas d’espace en fin de ligne, retour ligne final', () => {
    assert.equal(renderCaddy({ ...SYNTHETIQUE, empreintesScripts: [...SYNTHETIQUE.empreintesScripts] }), bloc);
    assert.ok(bloc.endsWith('}\n') && !bloc.endsWith('\n\n'));
    for (const [i, ligne] of bloc.split('\n').entries()) {
      assert.doesNotMatch(ligne, /^ /, `ligne ${i + 1} indentée par des espaces`);
      assert.doesNotMatch(ligne, /[ \t]$/, `ligne ${i + 1} : blanc en fin de ligne`);
    }
    assert.ok(!bloc.includes('\r'));
  });

  it('constantes du serveur : racine de la version courante et journal sous /var/log/caddy', () => {
    assert.equal(RACINE_SERVEUR, '/srv/reveletonprog/current');
    assert.equal(JOURNAL, '/var/log/caddy/reveletonprog.log');
  });
});

describe('renderCaddy : en-têtes de sécurité', () => {
  const bloc = renderCaddy(SYNTHETIQUE);
  const csp = valeurCsp(bloc);

  it('script-src porte exactement les deux empreintes, dans l’ordre donné', () => {
    assert.match(csp, /(^|; )script-src 'sha256-AAA=' 'sha256-BBB='(;|$)/);
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!;
    assert.deepEqual(scriptSrc.split(' ').slice(1), ["'sha256-AAA='", "'sha256-BBB='"]);
  });

  it('frame-ancestors \'none\' ; ni default-src ni unsafe- ; pas de style-src (gouverné par le meta de chaque page)', () => {
    assert.match(csp, /(^|; )frame-ancestors 'none'(;|$)/);
    assert.doesNotMatch(csp, /default-src/);
    assert.doesNotMatch(csp, /unsafe-/);
    assert.doesNotMatch(csp, /style-src/);
    assert.doesNotMatch(sansCommentaires(bloc), /default-src|unsafe-/);
  });

  it('autres en-têtes : Server retiré, HSTS court au départ, nosniff, pas de référent, no-cache', () => {
    assert.match(bloc, /^\t\t-Server$/m);
    assert.match(bloc, /^\t\tStrict-Transport-Security "max-age=300"$/m);
    assert.match(bloc, /^\t\tX-Content-Type-Options "nosniff"$/m);
    assert.match(bloc, /^\t\tReferrer-Policy "no-referrer"$/m);
    assert.match(bloc, /^\t\tPermissions-Policy "camera=\(\), microphone=\(\), geolocation=\(\)"$/m);
    assert.match(bloc, /^\t\tCross-Origin-Opener-Policy "same-origin"$/m);
    assert.match(bloc, /^\t\tCache-Control "no-cache"$/m);
  });

  it('en-tête calculé par cspEnTete, la fonction que sert aussi e2e/serveur.ts (WR-02), avec les mêmes refus', () => {
    assert.equal(csp, cspEnTete(SYNTHETIQUE.empreintesScripts));
    const serveur = fs.readFileSync(path.join(REPO, 'e2e', 'serveur.ts'), 'utf8');
    assert.match(serveur, /import \{ cspEnTete \} from '\.\.\/scripts\/render-caddy\.ts';/);
    for (const e of [[], ["'sha256-AAA='"], ['sha256-AAA=', 'sha256-AAA=']]) assert.throws(() => cspEnTete(e), /empreinte/);
  });

  it('aucun matcher /_astro/ (plus aucun fichier séparé après l’inlining)', () => {
    assert.ok(!bloc.includes('_astro'));
  });
});

describe('renderCaddy : journal d’accès', () => {
  const bloc = renderCaddy(SYNTHETIQUE);
  const journal = blocJournal(bloc);

  it('rotation chaque jour à 00:00 UTC (roll_at) ou à 10 Mio, 12 fichiers tournés et 12 jours gardés au plus', () => {
    assert.match(journal, /^\t\t\troll_at 00:00$/m);
    assert.match(journal, /^\t\t\troll_size 10MiB$/m);
    assert.match(journal, /^\t\t\troll_keep 12$/m);
    assert.match(journal, /^\t\t\troll_keep_for 288h$/m);
    assert.doesNotMatch(journal, /roll_disabled|roll_local_time/);
  });

  it('borne de rétention : moins de 13 jours, 14 jours au plus avec une rotation de minuit manquée', () => {
    // Rotation quotidienne : le plus vieux des N fichiers tournés gardés couvre le jour J-N-1, le fichier courant le
    // jour J ; une rotation de minuit manquée fait couvrir deux jours à un fichier (N+2). roll_keep_for ne doit pas
    // garder plus longtemps que roll_keep (résolution d'un jour, arrondi au jour supérieur par Caddy).
    const n = Number(/^\t\t\troll_keep (\d+)$/m.exec(journal)![1]);
    const heures = Number(/^\t\t\troll_keep_for (\d+)h$/m.exec(journal)![1]);
    assert.equal(n, FICHIERS_TOURNES_GARDES);
    assert.ok(Math.ceil(heures / 24) <= n, `roll_keep_for ${heures}h dépasse ${n} jours`);
    assert.equal(RETENTION_MAX_JOURS, n + 2);
    assert.ok(RETENTION_MAX_JOURS <= 14, `rétention possible de ${RETENTION_MAX_JOURS} jours, promesse : 14 jours au plus`);
    assert.equal(ROTATION_JOURNAL, '00:00');
    assert.equal(TAILLE_JOURNAL, '10MiB');
  });

  it('le commentaire du bloc dit la borne exacte et ne promet plus « 14 jours au plus » sans condition', () => {
    assert.match(bloc, /rotation chaque jour à 00:00 UTC/);
    assert.match(bloc, /moins de 13 jours, 14 jours au plus si une rotation de minuit est manquée/);
    assert.match(bloc, /Syntaxe \(roll_at, filtres\) à confirmer par « caddy validate »/);
    assert.doesNotMatch(bloc, /Journal d'accès : 14 jours au plus/);
  });

  it('le commentaire limite la politique au journal d’accès et renvoie au RUNBOOK pour les autres journaux (WR-01)', () => {
    assert.match(bloc, /Ces règles ne couvrent que le journal d'accès/);
    const runbook = fs.readFileSync(path.join(REPO, 'docs', 'RUNBOOK.md'), 'utf8');
    for (const needle of ['http.log.error', 'max-size', 'max-file', 'json-file']) assert.ok(runbook.includes(needle), `RUNBOOK doit contenir « ${needle} »`);
  });

  it('IP masquées en /24 et /48 (remote_ip et client_ip), en-têtes de requête et TLS supprimés, sortie JSON', () => {
    assert.match(journal, /^\t\t\trequest>remote_ip ip_mask 24 48$/m);
    assert.match(journal, /^\t\t\trequest>client_ip ip_mask 24 48$/m);
    assert.match(journal, /^\t\t\trequest>headers delete$/m);
    assert.match(journal, /^\t\t\trequest>tls delete$/m);
    assert.match(journal, /^\t\t\twrap json$/m);
  });

  it('les mots User-Agent et Referer n’apparaissent nulle part dans le bloc (casse ignorée)', () => {
    assert.doesNotMatch(bloc, /user-agent/i);
    assert.doesNotMatch(bloc, /referer/i);
  });
});

describe('renderCaddy : entrées refusées', () => {
  it('domaine invalide : majuscules, schéma, chemin, port, www., vide', () => {
    for (const domaine of ['Exemple.test', 'https://exemple.test', 'exemple.test/x', 'exemple.test:8443', 'www.exemple.test', '', 'exemple']) {
      assert.throws(() => renderCaddy({ ...SYNTHETIQUE, domaine }), /domaine/, domaine);
    }
  });

  it('liste d’empreintes vide, empreinte mal formée ou en double', () => {
    for (const empreintesScripts of [[], ['sha256-'], ['sha384-AAA='], ["'sha256-AAA='"], ['sha256-AA A='], ['sha256-AAA=', 'sha256-AAA=']]) {
      assert.throws(() => renderCaddy({ ...SYNTHETIQUE, empreintesScripts }), /empreinte/, JSON.stringify(empreintesScripts));
    }
  });

  it('racine ou journal non absolu ou avec un caractère qui casserait le Caddyfile', () => {
    for (const chemin of ['srv/x', '/srv/x y', '/srv/{x}', '/srv/"x"', '']) {
      assert.throws(() => renderCaddy({ ...SYNTHETIQUE, racine: chemin }), /racine/, chemin);
      assert.throws(() => renderCaddy({ ...SYNTHETIQUE, journal: chemin }), /journal/, chemin);
    }
  });
});

/** Rendu attendu pour le dépôt : domaine de config/site.yml (lu avec un env vide), empreintes de src/scripts/*.js. */
function renduDuDepot(): string {
  return renderCaddy({
    domaine: loadSiteConfig(REPO, {}).domaine,
    empreintesScripts: scriptsEnLigne(REPO).map((s) => s.empreinte),
    racine: RACINE_SERVEUR,
    journal: JOURNAL,
  });
}

describe('deploy/caddy/site.caddy : dérive', () => {
  it('le fichier versionné est égal à un rendu neuf', () => {
    assert.ok(fs.existsSync(BLOC), 'deploy/caddy/site.caddy absent : lancer node scripts/render-caddy.ts');
    const versionne = fs.readFileSync(BLOC, 'utf8');
    assert.ok(versionne === renduDuDepot(), 'deploy/caddy/site.caddy a dérivé de config/site.yml ou de src/scripts/*.js : lancer node scripts/render-caddy.ts');
  });

  it('les empreintes de l’en-tête sont exactement celles de src/scripts/*.js, dans l’ordre des noms', () => {
    const csp = valeurCsp(fs.readFileSync(BLOC, 'utf8'));
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!;
    const attendues = scriptsEnLigne(REPO).map((s) => `'${s.empreinte}'`);
    assert.equal(attendues.length, 2);
    assert.deepEqual(scriptSrc.split(' ').slice(1), attendues);
  });

  it('le bloc versionné sert le domaine de config/site.yml et sa variante www', () => {
    const { domaine } = loadSiteConfig(REPO, {});
    const versionne = fs.readFileSync(BLOC, 'utf8');
    assert.ok(versionne.includes(`\n${domaine} {\n`));
    assert.ok(versionne.includes(`\nwww.${domaine} {\n`));
    assert.ok(versionne.includes(`\tredir https://${domaine}{uri} permanent\n`));
  });
});

describe('CLI scripts/render-caddy.ts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-caddy-'));
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const lancer = (args: string[], env: Record<string, string> = {}) => {
    const propre: NodeJS.ProcessEnv = { ...process.env };
    delete propre.RTP_DEPLOIEMENT;
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: REPO, env: { ...propre, ...env }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  };

  it('--check : code 0 sur le fichier versionné', () => {
    const r = lancer(['--check']);
    assert.equal(r.status, 0, r.out + r.err);
  });

  it('--sortie <fichier> : écrit le rendu (dossier créé au besoin), code 0', () => {
    const sortie = path.join(tmp, 'sous', 'dossier', 'site.caddy');
    const r = lancer(['--sortie', sortie]);
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(fs.readFileSync(sortie, 'utf8'), renduDuDepot());
  });

  it('--check --sortie sur un fichier modifié d’un octet : code 1 et consigne de régénération', () => {
    const sortie = path.join(tmp, 'modifie.caddy');
    const rendu = renduDuDepot();
    fs.writeFileSync(sortie, `${rendu.slice(0, -1)} \n`);
    const r = lancer(['--check', '--sortie', sortie]);
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.err, /lancer node scripts\/render-caddy\.ts/);
    assert.equal(fs.readFileSync(sortie, 'utf8'), `${rendu.slice(0, -1)} \n`, '--check ne doit rien écrire');
  });

  it('--check sur un fichier absent : code 1', () => {
    const r = lancer(['--check', '--sortie', path.join(tmp, 'absent.caddy')]);
    assert.equal(r.status, 1, r.out + r.err);
    assert.ok(!fs.existsSync(path.join(tmp, 'absent.caddy')));
  });

  it('option inconnue ou argument positionnel : code 2 et usage', () => {
    for (const args of [['--inconnue'], ['site.caddy'], ['--sortie']]) {
      const r = lancer(args);
      assert.equal(r.status, 2, `${args.join(' ')} : ${r.out}${r.err}`);
      assert.match(r.err, /Usage : node scripts\/render-caddy\.ts/);
    }
  });

  it('RTP_DEPLOIEMENT=1 avec un domaine provisoire : refus (code 2), rien n’est écrit', { skip: !loadSiteConfig(REPO, {}).domaineProvisoire && 'domaine réel' }, () => {
    const sortie = path.join(tmp, 'deploiement.caddy');
    const r = lancer(['--sortie', sortie], { RTP_DEPLOIEMENT: '1' });
    assert.equal(r.status, 2, r.out + r.err);
    assert.match(r.err, /domaine provisoire/);
    assert.ok(!fs.existsSync(sortie));
  });
});
