// HEB-05, PERF-01 (D-03, 07-07) : le bloc Caddy du site est rendu depuis config/site.yml et src/scripts/*.js par
// une fonction pure (scripts/render-caddy.ts). Ce test fige sa politique : en-tête CSP limité aux deux empreintes
// de scripts plus frame-ancestors (jamais de default-src : l'intersection avec le meta de chaque page bloquerait
// les <style> hachés), journal d'accès de 14 jours avec IP masquée et en-têtes de requête supprimés.
// Domaine synthétique : exemple.test ; le domaine du dépôt n'est jamais écrit ici (garde 07-06), il est lu.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOURNAL, RACINE_SERVEUR, renderCaddy } from '../../scripts/render-caddy.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

  it('aucun matcher /_astro/ (plus aucun fichier séparé après l’inlining)', () => {
    assert.ok(!bloc.includes('_astro'));
  });
});

describe('renderCaddy : journal d’accès', () => {
  const bloc = renderCaddy(SYNTHETIQUE);
  const journal = blocJournal(bloc);

  it('14 jours de rétention : roll_keep_for 336h, roll_keep 14', () => {
    assert.match(journal, /^\t\t\troll_keep_for 336h$/m);
    assert.match(journal, /^\t\t\troll_keep 14$/m);
    assert.match(journal, /^\t\t\troll_size 10MiB$/m);
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
