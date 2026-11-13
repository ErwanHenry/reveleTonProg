// HEB-05, PERF-01 (D-03, 07-07) : le bloc Caddy du site est rendu depuis config/site.yml et src/scripts/*.js par
// une fonction pure (scripts/render-caddy.ts). Ce test fige sa politique : en-tête CSP limité aux deux empreintes
// de scripts plus frame-ancestors (jamais de default-src : l'intersection avec le meta de chaque page bloquerait
// les <style> hachés), journal d'accès tourné chaque jour et gardé 14 jours au plus (CR-01), IP masquée et en-têtes
// de requête supprimés. Le bloc de l'hôte technique (08-01, D-07 révisée, HEB-14) sort du même rendu : basic_auth
// avec une empreinte factice par défaut, noindex, robots.txt fermé, mêmes en-têtes et même journal masqué.
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
  FICHIER_SITES_D_ESSAI,
  FICHIERS_TOURNES_GARDES,
  HASH_FACTICE,
  JOURNAL,
  JOURNAL_ESSAI,
  RACINE_ESSAI,
  RACINE_SERVEUR,
  RETENTION_MAX_JOURS,
  ROTATION_JOURNAL,
  TAILLE_JOURNAL,
  VARIABLES_HASH,
  renderCaddy,
  renderCaddyEssai,
} from '../../scripts/render-caddy.ts';
import { scriptsEnLigne } from '../../src/lib/csp-empreintes.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(REPO, 'scripts', 'render-caddy.ts');
const BLOC = path.join(REPO, 'deploy', 'caddy', 'site.caddy');
const BLOC_ESSAI = path.join(REPO, 'deploy', 'caddy', 'essai.caddy');

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

  it('commentaires des faits confirmés en Phase 8 : lien relatif « current » vers releases/<sha>/, plus rien « à confirmer »', () => {
    assert.match(bloc, /^\t# Version en ligne : releases\/<sha>\/ pointée par le lien relatif « current » \(disposition retenue en Phase 8\)\.$/m);
    assert.doesNotMatch(bloc, /à confirmer/);
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
    assert.match(bloc, /Syntaxe \(roll_at, filtres\) acceptée par Caddy 2\.11\.2/);
    assert.doesNotMatch(bloc, /à confirmer/);
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

// ---------------------------------------------------------------------------
// Hôte technique (D-07 révisée, HEB-14) : essai.<domaine>, protégé par basic_auth, jamais indexé.
// ---------------------------------------------------------------------------

const SYNTHETIQUE_ESSAI = {
  domaine: 'exemple.test',
  empreintesScripts: ['sha256-AAA=', 'sha256-BBB='],
  racine: '/srv/x/essai/current',
  journal: '/var/log/caddy/x-essai.log',
} as const;

/** Contenu d'un sous-bloc `\t<ouverture> {` … `\t}` (première occurrence). */
function sousBloc(bloc: string, ouverture: RegExp): string {
  const m = new RegExp(`^\\t${ouverture.source} \\{\\n([\\s\\S]*?)^\\t\\}$`, 'm').exec(bloc);
  assert.ok(m, `sous-bloc ${ouverture.source} absent`);
  return m[1]!;
}

/** Lignes utiles d'un sous-bloc : sans les lignes de commentaire ni les commentaires de fin de ligne. */
const lignesUtiles = (contenu: string): string[] =>
  contenu
    .split('\n')
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l))
    .map((l) => l.replace(/\s+#.*$/, ''));

/** Bloc sans le corps du robots.txt (« User-agent: * » y est obligatoire, il ne vient pas d'une requête). */
const sansCorpsRobots = (bloc: string): string => bloc.replace(/<<TXT\n[\s\S]*?\n\t\tTXT/, '<<TXT TXT');

describe('renderCaddyEssai : adresse, racine et protection', () => {
  const bloc = renderCaddyEssai(SYNTHETIQUE_ESSAI);

  it('première ligne : fichier généré par scripts/render-caddy.ts depuis config/site.yml, à ne pas modifier à la main', () => {
    const premiere = bloc.split('\n')[0]!;
    assert.match(premiere, /^# /);
    assert.match(premiere, /scripts\/render-caddy\.ts/);
    assert.match(premiere, /config\/site\.yml/);
    assert.match(premiere, /ne pas modifier à la main/);
  });

  it('une seule adresse : essai.<domaine> ; ni www. ni bloc apex ; racine, compression et file_server', () => {
    const adresses = bloc.split('\n').filter((l) => /^\S.*\{$/.test(l));
    assert.deepEqual(adresses, ['essai.exemple.test {']);
    assert.doesNotMatch(bloc, /^www\./m);
    assert.doesNotMatch(bloc, /^exemple\.test \{$/m);
    assert.match(bloc, /^\troot \* \/srv\/x\/essai\/current$/m);
    assert.match(bloc, /^\tencode zstd gzip$/m);
    assert.match(bloc, /^\tfile_server$/m);
    assert.ok(bloc.endsWith('}\n'));
  });

  it('basic_auth sur tout chemin sauf /robots.txt, deux identifiants : essai et sonde', () => {
    assert.match(bloc, /^\t@protege not path \/robots\.txt$/m);
    assert.equal([...bloc.matchAll(/^\tbasic_auth @protege \{$/gm)].length, 1);
    assert.equal([...sansCommentaires(bloc).matchAll(/basic_auth/g)].length, 1, 'un seul basic_auth');
    assert.ok(bloc.indexOf('\t@protege not path') < bloc.indexOf('\tbasic_auth @protege'));
    assert.deepEqual(lignesUtiles(sousBloc(bloc, /basic_auth @protege/)), [
      `\t\tessai {$RTP_ESSAI_HASH:${HASH_FACTICE}}`,
      `\t\tsonde {$RTP_SONDE_HASH:${HASH_FACTICE}}`,
    ]);
    assert.deepEqual(VARIABLES_HASH, { essai: 'RTP_ESSAI_HASH', sonde: 'RTP_SONDE_HASH' });
  });

  it('T-08-01 : toute variable {$…} du bloc porte une valeur par défaut (une variable vide ferait tomber tout le Caddyfile)', () => {
    const variables = [...bloc.matchAll(/\{\$([A-Za-z0-9_]+)(:[^}]*)?\}/g)];
    assert.equal(variables.length, 2);
    for (const v of variables) assert.ok(v[2] !== undefined && v[2].length > 1, `variable ${v[1]} sans valeur par défaut`);
    assert.doesNotMatch(bloc, /\{\$RTP_ESSAI_HASH\}|\{\$RTP_SONDE_HASH\}/);
  });

  it('T-08-03 : empreinte factice au format bcrypt, peu d’entropie, visiblement fausse, et dite telle dans le bloc', () => {
    assert.match(HASH_FACTICE, /^\$2a\$14\$[./A-Za-z0-9]{53}$/);
    assert.match(HASH_FACTICE, /factice/i);
    assert.ok(new Set(HASH_FACTICE.slice(7)).size <= 10, 'empreinte factice trop variée pour être visiblement fausse');
    assert.match(bloc, /aucun mot de passe ne lui correspond/);
  });

  it('T-08-02 : /robots.txt répond 200 « User-agent: * » puis « Disallow: / » (heredoc), sans mot de passe', () => {
    const m = /^\trespond \/robots\.txt <<TXT\n([\s\S]*?)\n\t\tTXT 200$/m.exec(bloc);
    assert.ok(m, 'respond /robots.txt en heredoc absent');
    assert.deepEqual(m[1]!.split('\n'), ['\t\tUser-agent: *', '\t\tDisallow: /']);
    assert.equal([...bloc.matchAll(/^\trespond /gm)].length, 1);
  });

  it('en-têtes : ceux du bloc de production, plus X-Robots-Tag "noindex, nofollow" posé à part, sans différé (réponse 401 comprise)', () => {
    const production = renderCaddy({ ...SYNTHETIQUE, empreintesScripts: SYNTHETIQUE_ESSAI.empreintesScripts });
    // Le sous-bloc header est différé par « -Server » : Caddy l'applique à l'écriture de la réponse, donc pas sur le
    // 401 de basic_auth (constaté en 08-12). Une directive header sans suppression s'applique tout de suite, avant
    // basic_auth (headers.go, Caddy 2.11.2), et reste sur la réponse d'erreur.
    assert.deepEqual(lignesUtiles(sousBloc(bloc, /header/)), lignesUtiles(sousBloc(production, /header/)));
    assert.equal([...sansCommentaires(bloc).matchAll(/X-Robots-Tag/g)].length, 1);
    assert.equal([...bloc.matchAll(/^\theader X-Robots-Tag "noindex, nofollow"$/gm)].length, 1);
    assert.doesNotMatch(bloc, /^\t+defer$/m);
    // Pas de handle_errors : sur le serveur partagé, il ferait passer en niveau debug le journal des erreurs 5xx de
    // tous les sites (server.go, Caddy 2.11.2).
    assert.doesNotMatch(sansCommentaires(bloc), /handle_errors/);
    assert.equal(valeurCsp(bloc), cspEnTete(SYNTHETIQUE_ESSAI.empreintesScripts));
    assert.match(bloc, /^\t\tCache-Control "no-cache"$/m);
  });

  it('journal : le même bloc log que la production, seul le fichier change ; pas de User-Agent ni de Referer', () => {
    const production = renderCaddy({ ...SYNTHETIQUE, journal: SYNTHETIQUE_ESSAI.journal });
    assert.equal(blocJournal(bloc), blocJournal(production));
    assert.match(blocJournal(bloc), /^\t\toutput file \/var\/log\/caddy\/x-essai\.log \{$/m);
    assert.doesNotMatch(sansCorpsRobots(bloc), /user-agent/i);
    assert.doesNotMatch(bloc, /referer/i);
  });

  it('commentaires : hôte retiré à l’ouverture, empreintes hors dépôt, recréation du conteneur, robots.txt lisible', () => {
    assert.match(bloc, /Phase 9/);
    assert.match(bloc, /jamais dans le dépôt/);
    assert.match(bloc, /recréer le conteneur/);
    assert.match(bloc, /robots\.txt reste lisible sans mot de passe/);
    assert.ok(bloc.includes(FICHIER_SITES_D_ESSAI));
    assert.doesNotMatch(bloc, /[–—]/);
  });

  it('déterministe, tabulations, pas de blanc en fin de ligne ; un autre domaine ne change que ses occurrences', () => {
    assert.equal(renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, empreintesScripts: [...SYNTHETIQUE_ESSAI.empreintesScripts] }), bloc);
    for (const [i, ligne] of bloc.split('\n').entries()) {
      assert.doesNotMatch(ligne, /^ /, `ligne ${i + 1} indentée par des espaces`);
      assert.doesNotMatch(ligne, /[ \t]$/, `ligne ${i + 1} : blanc en fin de ligne`);
    }
    assert.ok(!bloc.includes('\r'));
    const autre = renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, domaine: 'autre-exemple.test' });
    assert.match(autre, /^essai\.autre-exemple\.test \{$/m);
    assert.equal(autre.replaceAll('autre-exemple.test', 'exemple.test'), bloc);
    const { domaine } = loadSiteConfig(REPO, {});
    assert.ok(!bloc.includes(domaine), 'le domaine du dépôt fuit dans un rendu synthétique');
  });

  it('entrées refusées comme renderCaddy : domaine, empreintes, chemins', () => {
    for (const domaine of ['Exemple.test', 'https://exemple.test', 'www.exemple.test', '', 'exemple']) {
      assert.throws(() => renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, domaine }), /domaine/, domaine);
    }
    for (const empreintesScripts of [[], ['sha256-'], ["'sha256-AAA='"], ['sha256-AAA=', 'sha256-AAA=']]) {
      assert.throws(() => renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, empreintesScripts }), /empreinte/, JSON.stringify(empreintesScripts));
    }
    for (const chemin of ['srv/x', '/srv/x y', '/srv/{x}', '']) {
      assert.throws(() => renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, racine: chemin }), /racine/, chemin);
      assert.throws(() => renderCaddyEssai({ ...SYNTHETIQUE_ESSAI, journal: chemin }), /journal/, chemin);
    }
  });
});

describe('renderCaddy : adresse inconnue, page 404.html avec le code 404 (plan 09.1-02, D-05)', () => {
  const bloc = renderCaddy(SYNTHETIQUE);
  const lignes = bloc.split('\n');
  const REGLE = [
    '\t@introuvable not file {path} {path}/',
    '\thandle @introuvable {',
    '\t\trewrite * /404.html',
    '\t\trequest_header -If-*',
    '\t\trequest_header -Range',
    '\t\tfile_server {',
    '\t\t\tstatus 404',
    '\t\t}',
    '\t}',
  ];

  /** Lignes de commentaire entre « \tfile_server » (suivi d'une ligne vide) et la règle. */
  const COMMENTAIRES = 5;

  it('après la ligne « \\tfile_server » : une ligne vide, cinq lignes de commentaire, puis exactement les neuf lignes de la règle', () => {
    const i = lignes.indexOf('\tfile_server');
    assert.ok(i > 0, 'ligne \\tfile_server absente');
    assert.equal(lignes.indexOf('\tfile_server', i + 1), -1, 'une seule ligne \\tfile_server de premier niveau');
    assert.equal(lignes[i + 1], '');
    const commentaires = lignes.slice(i + 2, i + 2 + COMMENTAIRES);
    for (const c of commentaires) assert.match(c, /^\t# /, c);
    assert.deepEqual(lignes.slice(i + 2 + COMMENTAIRES, i + 2 + COMMENTAIRES + REGLE.length), REGLE);
    assert.equal(lignes[i + 2 + COMMENTAIRES + REGLE.length], '', 'ligne vide après la règle');
  });

  it('chaque ligne de la règle n’apparaît qu’une fois, dans le bloc du domaine (pas dans la redirection www)', () => {
    for (const l of REGLE.slice(0, 3)) assert.equal(lignes.filter((x) => x === l).length, 1, l);
    const www = bloc.slice(bloc.indexOf('www.exemple.test {'));
    assert.doesNotMatch(www, /introuvable|404/);
  });

  it('commentaire : ni fichier ni dossier, 404 sans corps si la release n’a pas 404.html, pourquoi pas handle_errors, journal d’accès', () => {
    const i = lignes.indexOf('\tfile_server');
    const texte = lignes.slice(i + 2, i + 2 + COMMENTAIRES).join(' ');
    assert.match(texte, /ni un fichier ni un dossier/);
    assert.match(texte, /404\.html/);
    assert.match(texte, /sans corps/);
    assert.match(texte, /handle_errors/);
    assert.match(texte, /debug/);
    assert.match(texte, /2\.11\.2/);
    assert.match(texte, /journal d.accès/);
    assert.doesNotMatch(texte, /[–—]/);
  });

  it('CR-01 (revue 09.1) : préconditions et Range retirés dans la route de la 404 seulement, avant son file_server', () => {
    const code = sansCommentaires(bloc).split('\n');
    const retraits = code.filter((l) => /request_header/.test(l));
    assert.deepEqual(retraits, ['\t\trequest_header -If-*', '\t\trequest_header -Range'], 'aucun autre request_header dans le bloc');
    const debut = code.indexOf('\thandle @introuvable {');
    const fin = code.indexOf('\t}', debut);
    const route = code.slice(debut, fin + 1);
    for (const r of retraits) assert.ok(route.includes(r), `${r} hors de handle @introuvable`);
    assert.ok(route.indexOf('\t\trequest_header -Range') < route.indexOf('\t\tfile_server {'));
    // Le file_server de premier niveau (vrais fichiers) garde ETag, 304 et plages : rien ne retire ces en-têtes ailleurs.
    assert.doesNotMatch(renderCaddyEssai({ ...SYNTHETIQUE, racine: '/srv/x/essai/current', journal: '/var/log/caddy/x-essai.log' }), /request_header/);
    const i = lignes.indexOf('\tfile_server');
    const texte = lignes.slice(i + 2, i + 2 + COMMENTAIRES).join(' ');
    for (const mot of [/If-None-Match/, /If-Modified-Since/, /Range/, /Safari/, /sans corps/, /tronqu/]) assert.match(texte, mot);
  });

  it('T-09.1-04 : aucun handle_errors hors commentaires, aucune directive error ni intercept', () => {
    const code = sansCommentaires(bloc);
    assert.doesNotMatch(code, /handle_errors/);
    assert.doesNotMatch(code, /^\t+(error|intercept)\b/m);
  });

  it('T-09.1-05 : cible de réécriture fixe /404.html, jamais un chemin venu de la requête', () => {
    const reecritures = [...sansCommentaires(bloc).matchAll(/^\t+rewrite (.*)$/gm)].map((m) => m[1]);
    assert.deepEqual(reecritures, ['* /404.html']);
  });

  it('en-têtes, compression, journal et redirection www inchangés par la règle', () => {
    const sans = bloc.split('\n');
    const i = sans.indexOf('\tfile_server');
    sans.splice(i + 1, 1 + COMMENTAIRES + REGLE.length);
    const reduit = sans.join('\n');
    assert.doesNotMatch(reduit, /introuvable|404/);
    assert.match(reduit, /^\tencode zstd gzip\n\tfile_server\n\n\theader \{$/m);
    assert.match(reduit, /^\t\tCache-Control "no-cache"$/m);
  });

  it('le bloc de l’hôte technique ne reçoit pas la règle (aucun @introuvable)', () => {
    const essai = renderCaddyEssai({ ...SYNTHETIQUE, racine: '/srv/x/essai/current', journal: '/var/log/caddy/x-essai.log' });
    assert.doesNotMatch(essai, /@introuvable/);
    assert.doesNotMatch(essai, /status 404/);
    assert.doesNotMatch(fs.readFileSync(BLOC_ESSAI, 'utf8'), /@introuvable/);
  });

  it('bloc versionné : la règle est présente, sans handle_errors hors commentaires', () => {
    const versionne = fs.readFileSync(BLOC, 'utf8');
    assert.ok(versionne.includes(`\n${REGLE.join('\n')}\n`), 'règle absente de deploy/caddy/site.caddy');
    assert.doesNotMatch(sansCommentaires(versionne), /handle_errors/);
  });
});

/** Rendu attendu de l'hôte technique pour le dépôt. */
function renduEssaiDuDepot(): string {
  return renderCaddyEssai({
    domaine: loadSiteConfig(REPO, {}).domaine,
    empreintesScripts: scriptsEnLigne(REPO).map((s) => s.empreinte),
    racine: RACINE_ESSAI,
    journal: JOURNAL_ESSAI,
  });
}

describe('deploy/caddy/essai.caddy : dérive', () => {
  it('le fichier versionné est égal à un rendu neuf', () => {
    assert.ok(fs.existsSync(BLOC_ESSAI), 'deploy/caddy/essai.caddy absent : lancer node scripts/render-caddy.ts');
    const versionne = fs.readFileSync(BLOC_ESSAI, 'utf8');
    assert.ok(versionne === renduEssaiDuDepot(), 'deploy/caddy/essai.caddy a dérivé de config/site.yml ou de src/scripts/*.js : lancer node scripts/render-caddy.ts');
  });

  it('constantes : racine et journal propres à l’hôte technique, nom du fichier dans sites.d', () => {
    assert.equal(RACINE_ESSAI, '/srv/reveletonprog/essai/current');
    assert.equal(JOURNAL_ESSAI, '/var/log/caddy/essai.log');
    assert.equal(FICHIER_SITES_D_ESSAI, 'reveletonprog-essai.caddy');
    assert.notEqual(RACINE_ESSAI, RACINE_SERVEUR);
    assert.notEqual(JOURNAL_ESSAI, JOURNAL);
  });

  it('le bloc versionné sert essai.<domaine de config/site.yml>', () => {
    const { domaine } = loadSiteConfig(REPO, {});
    assert.ok(fs.readFileSync(BLOC_ESSAI, 'utf8').includes(`\nessai.${domaine} {\n`));
  });

  it('le bloc de production n’a ni mot de passe ni noindex', () => {
    const production = sansCommentaires(fs.readFileSync(BLOC, 'utf8'));
    assert.doesNotMatch(production, /basic_auth/);
    assert.doesNotMatch(production, /X-Robots-Tag/);
  });

  it('.gitattributes impose LF sur deploy/caddy/*.caddy et sur les fichiers serveur de la Phase 8', () => {
    const lignes = fs.readFileSync(path.join(REPO, '.gitattributes'), 'utf8').split('\n').map((l) => l.trim());
    for (const l of ['deploy/caddy/*.caddy text eol=lf', 'ops/*.sh text eol=lf', 'deploy/compose/*.yml text eol=lf', 'deploy/cron/* text eol=lf']) {
      assert.ok(lignes.includes(l), `ligne « ${l} » absente de .gitattributes`);
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

  /** Projet minimal (config/site.yml et src/scripts/ du dépôt) pour lancer le CLI avec un autre config/site.yml. */
  const projetAvec = (domaine: string, contact: string): string => {
    const racine = fs.mkdtempSync(path.join(tmp, 'projet-'));
    fs.mkdirSync(path.join(racine, 'config'));
    fs.writeFileSync(path.join(racine, 'config', 'site.yml'), `domaine: ${domaine}\ncontact: ${contact}\ndepot: a/b\n`);
    fs.cpSync(path.join(REPO, 'src', 'scripts'), path.join(racine, 'src', 'scripts'), { recursive: true });
    return racine;
  };
  const lancerDans = (cwd: string, args: string[], env: Record<string, string>) => {
    const propre: NodeJS.ProcessEnv = { ...process.env };
    delete propre.RTP_DEPLOIEMENT;
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd, env: { ...propre, ...env }, encoding: 'utf8' });
    return { status: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  };

  it('sans option : écrit les deux blocs (site puis essai) dans deploy/caddy/', () => {
    const racine = projetAvec('example.org', 'bonjour@example.org');
    const r = lancerDans(racine, [], {});
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(r.out.indexOf('deploy/caddy/site.caddy') < r.out.indexOf('deploy/caddy/essai.caddy'), r.out);
    const empreintesScripts = scriptsEnLigne(racine).map((s) => s.empreinte);
    assert.equal(fs.readFileSync(path.join(racine, 'deploy', 'caddy', 'site.caddy'), 'utf8'), renderCaddy({ domaine: 'example.org', empreintesScripts, racine: RACINE_SERVEUR, journal: JOURNAL }));
    assert.equal(fs.readFileSync(path.join(racine, 'deploy', 'caddy', 'essai.caddy'), 'utf8'), renderCaddyEssai({ domaine: 'example.org', empreintesScripts, racine: RACINE_ESSAI, journal: JOURNAL_ESSAI }));
    assert.equal(lancerDans(racine, ['--check'], {}).status, 0);
  });

  it('--check vérifie les deux blocs : code 1 qui nomme le seul fichier périmé', () => {
    const racine = projetAvec('example.org', 'bonjour@example.org');
    assert.equal(lancerDans(racine, [], {}).status, 0);
    fs.appendFileSync(path.join(racine, 'deploy', 'caddy', 'essai.caddy'), '\n');
    const r = lancerDans(racine, ['--check'], {});
    assert.equal(r.status, 1, r.out + r.err);
    assert.match(r.err, /deploy\/caddy\/essai\.caddy pas à jour/);
    assert.doesNotMatch(r.err, /site\.caddy/);
    assert.match(r.err, /lancer node scripts\/render-caddy\.ts/);
  });

  it('--cible essai sans --sortie : n’écrit que deploy/caddy/essai.caddy', () => {
    const racine = projetAvec('example.org', 'bonjour@example.org');
    const r = lancerDans(racine, ['--cible', 'essai'], {});
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(fs.existsSync(path.join(racine, 'deploy', 'caddy', 'essai.caddy')));
    assert.ok(!fs.existsSync(path.join(racine, 'deploy', 'caddy', 'site.caddy')));
  });

  it('--cible essai --sortie <fichier> écrit le rendu de l’hôte technique ; --cible site le bloc de production', () => {
    const essai = path.join(tmp, 'cible', 'essai.caddy');
    let r = lancer(['--cible', 'essai', '--sortie', essai]);
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(fs.readFileSync(essai, 'utf8'), renduEssaiDuDepot());
    const site = path.join(tmp, 'cible', 'site.caddy');
    r = lancer(['--cible', 'site', '--sortie', site]);
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(fs.readFileSync(site, 'utf8'), renduDuDepot());
    r = lancer(['--check', '--cible', 'essai', '--sortie', site]);
    assert.equal(r.status, 1, r.out + r.err);
  });

  it('--cible inconnue ou sans valeur : code 2 et usage', () => {
    for (const args of [['--cible', 'autre'], ['--cible'], ['--cible', '']]) {
      const r = lancer(args);
      assert.equal(r.status, 2, `${args.join(' ')} : ${r.out}${r.err}`);
      assert.match(r.err, /Usage : node scripts\/render-caddy\.ts/);
    }
  });

  it('IN-05 : RTP_DEPLOIEMENT=1 avec un vrai domaine et un contact provisoire : rendu accepté (le contact n’est pas dans le bloc)', () => {
    const racine = projetAvec('example.org', 'contact@exemple.invalid');
    const r = lancerDans(racine, ['--sortie', 'site.caddy'], { RTP_DEPLOIEMENT: '1' });
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(fs.readFileSync(path.join(racine, 'site.caddy'), 'utf8'), /^example\.org \{$/m);
  });

  it('IN-05 : RTP_DEPLOIEMENT=1 refuse un domaine provisoire même avec un vrai contact (.test compris), et une valeur invalide de la variable', () => {
    for (const domaine of ['exemple.invalid', 'exemple.test']) {
      const racine = projetAvec(domaine, 'bonjour@example.org');
      const r = lancerDans(racine, ['--sortie', 'site.caddy'], { RTP_DEPLOIEMENT: '1' });
      assert.equal(r.status, 2, r.out + r.err);
      assert.match(r.err, /render-caddy : domaine provisoire/);
      assert.ok(!fs.existsSync(path.join(racine, 'site.caddy')));
    }
    const r = lancerDans(projetAvec('example.org', 'bonjour@example.org'), ['--check'], { RTP_DEPLOIEMENT: 'oui' });
    assert.equal(r.status, 2, r.out + r.err);
    assert.match(r.err, /RTP_DEPLOIEMENT doit valoir 1/);
  });

  it('RTP_DEPLOIEMENT=1 avec un domaine provisoire : refus (code 2), rien n’est écrit', { skip: !loadSiteConfig(REPO, {}).domaineProvisoire && 'domaine réel' }, () => {
    const sortie = path.join(tmp, 'deploiement.caddy');
    const r = lancer(['--sortie', sortie], { RTP_DEPLOIEMENT: '1' });
    assert.equal(r.status, 2, r.out + r.err);
    assert.match(r.err, /domaine provisoire/);
    assert.ok(!fs.existsSync(sortie));
  });
});
