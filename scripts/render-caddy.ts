// Blocs Caddy du site (HEB-05, PERF-01 ; D-03, 07-07) et de l'hôte technique (HEB-14 ; D-07 révisée, 08-01).
// Rendus par des fonctions pures depuis le domaine de config/site.yml et les empreintes de src/scripts/*.js, puis
// écrits dans deploy/caddy/site.caddy et deploy/caddy/essai.caddy (versionnés). tests/repo/caddy.test.ts compare
// chaque fichier versionné à un rendu neuf : changer le domaine ou un script sans relancer ce script fait échouer
// npm test. Aucun serveur n'est touché ici ; « caddy validate » sur le serveur est l'affaire de ops/valider-caddy.sh.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { scriptsEnLigne } from '../src/lib/csp-empreintes.ts';
import { estDeploiement } from '../src/lib/deploiement.ts';
import {
  FICHIERS_TOURNES_GARDES,
  MASQUE_IPV4,
  MASQUE_IPV6,
  RETENTION_MAX_JOURS,
  ROTATION_JOURNAL,
  TAILLE_JOURNAL,
} from '../src/lib/journal-acces.ts';
import { estDomaineValide, loadSiteConfig } from '../src/lib/site-config.ts';

/**
 * Racine servie, vue depuis le conteneur Caddy : la Phase 8 monte le dossier du site en lecture seule sur
 * /srv/reveletonprog ; chaque version vit dans releases/<sha>/ et `current` pointe la version en ligne.
 */
export const RACINE_SERVEUR = '/srv/reveletonprog/current';
/** Fichier du journal d'accès, vu depuis le conteneur : /var/log/caddy est un dossier de l'hôte monté en écriture (Phase 8). */
export const JOURNAL = '/var/log/caddy/reveletonprog.log';
/** Racine servie par l'hôte technique (D-07 révisée) : mêmes règles que la production, dans essai/{releases,current}. */
export const RACINE_ESSAI = '/srv/reveletonprog/essai/current';
/** Journal d'accès de l'hôte technique : son propre fichier, même politique que la production. */
export const JOURNAL_ESSAI = '/var/log/caddy/essai.log';
/** Nom du bloc de l'hôte technique dans le dossier sites.d monté dans le conteneur (installé par la Phase 8). */
export const FICHIER_SITES_D_ESSAI = 'reveletonprog-essai.caddy';
/**
 * Variables d'environnement du conteneur Caddy qui portent les empreintes bcrypt de l'hôte technique : `essai` pour
 * l'éditeur, `sonde` pour la sonde de supervision (identifiant à part, changé sans toucher celui de l'éditeur).
 * Les valeurs vivent dans le fichier d'environnement du compose, lisible par root seul, jamais dans le dépôt.
 */
export const VARIABLES_HASH = { essai: 'RTP_ESSAI_HASH', sonde: 'RTP_SONDE_HASH' } as const;
/**
 * Valeur par défaut des deux variables (08-RESEARCH, Pitfall 1) : Caddy remplace `{$VAR}` avant de lire le Caddyfile
 * et une empreinte vide fait échouer le Caddyfile entier, donc tous les sites du serveur. Avec cette valeur, une
 * variable absente laisse le fichier valide et personne ne peut se connecter. Chaîne au format bcrypt (coût 14) faite
 * d'un mot lisible complété par des points : elle n'est la sortie d'aucun calcul, aucun mot de passe connu ne lui
 * correspond.
 */
export const HASH_FACTICE = `$2a$14$${'factice'.padEnd(53, '.')}`;

// Politique du journal d'accès (rotation, rétention, masques) : une seule source, partagée avec les Mentions légales.
// Réexportée ici pour les imports existants (tests/repo/caddy.test.ts).
export { FICHIERS_TOURNES_GARDES, MASQUE_IPV4, MASQUE_IPV6, RETENTION_MAX_JOURS, ROTATION_JOURNAL, TAILLE_JOURNAL };

export interface OptionsCaddy {
  /** Nom d'hôte apex (même règle que config/site.yml : minuscules, sans schéma, port, chemin ni `www.`). */
  domaine: string;
  /** Empreintes CSP « sha256-<base64> » des scripts du site, sans guillemets, dans l'ordre de scriptsEnLigne(). */
  empreintesScripts: readonly string[];
  /** Chemin absolu de la racine servie (dans le conteneur). */
  racine: string;
  /** Chemin absolu du fichier de journal d'accès (dans le conteneur). */
  journal: string;
}

const RE_EMPREINTE = /^sha256-[A-Za-z0-9+/]+=*$/;
// Chemin absolu sans blanc, guillemet, accolade ni autre caractère qui changerait la lecture du Caddyfile.
const RE_CHEMIN = /^\/[A-Za-z0-9._/-]+$/;

function verifierEmpreintes(empreintesScripts: readonly string[]): void {
  if (empreintesScripts.length === 0) throw new Error('render-caddy : aucune empreinte de script (src/scripts/*.js vide ?)');
  for (const e of empreintesScripts) {
    if (!RE_EMPREINTE.test(e)) throw new Error(`render-caddy : empreinte mal formée « ${e.slice(0, 80)} » (attendu sha256-<base64>, sans guillemets)`);
  }
  if (new Set(empreintesScripts).size !== empreintesScripts.length) throw new Error('render-caddy : empreinte en double');
}

/**
 * Valeur de l'en-tête Content-Security-Policy du bloc Caddy (fonction pure). Partagée avec e2e/serveur.ts (WR-02) :
 * les specs CSP font appliquer par le navigateur la même politique d'en-tête qu'en production, en plus du meta.
 */
export function cspEnTete(empreintesScripts: readonly string[]): string {
  verifierEmpreintes(empreintesScripts);
  const scriptSrc = empreintesScripts.map((e) => `'${e}'`).join(' ');
  return [`script-src ${scriptSrc}`, "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join('; ');
}

function verifier(o: OptionsCaddy): void {
  if (!estDomaineValide(o.domaine)) {
    throw new Error(`render-caddy : domaine invalide « ${String(o.domaine).slice(0, 80)} » (nom d'hôte en minuscules, sans schéma, port, chemin ni « www. »)`);
  }
  verifierEmpreintes(o.empreintesScripts);
  if (!RE_CHEMIN.test(o.racine)) throw new Error(`render-caddy : racine invalide « ${o.racine.slice(0, 80)} » (chemin absolu sans blanc ni caractère spécial)`);
  if (!RE_CHEMIN.test(o.journal)) throw new Error(`render-caddy : journal invalide « ${o.journal.slice(0, 80)} » (chemin absolu sans blanc ni caractère spécial)`);
}

/**
 * Lignes du sous-bloc `header` (communes aux deux hôtes), suivies de `extra` (lignes déjà indentées) avant la
 * fermeture. Le CSP vient de cspEnTete, la fonction que sert aussi e2e/serveur.ts.
 */
function lignesEnTetes(csp: string, extra: readonly string[] = []): string[] {
  return [
    '\theader {',
    '\t\t-Server',
    '\t\t# HSTS court la première semaine, à relever (max-age=31536000) une fois le domaine stable (Phase 8).',
    '\t\tStrict-Transport-Security "max-age=300"',
    '\t\tX-Content-Type-Options "nosniff"',
    '\t\tReferrer-Policy "no-referrer"',
    '\t\tPermissions-Policy "camera=(), microphone=(), geolocation=()"',
    '\t\tCross-Origin-Opener-Policy "same-origin"',
    "\t\t# En-tête CSP : script-src n'admet que les empreintes des scripts du site. Il couvre dès le premier octet",
    '\t\t# le script d\'ordre, placé avant le meta CSP de la page, que ce meta ne gouverne donc pas.',
    "\t\t# frame-ancestors n'a d'effet que dans un en-tête (un meta ne peut pas le porter).",
    "\t\t# Pas de default-src ici : les deux politiques s'appliquent ensemble, style-src retomberait sur",
    '\t\t# default-src et les <style> hachés par le meta de chaque page seraient bloqués.',
    `\t\tContent-Security-Policy "${csp}"`,
    "\t\t# Pages revalidées à chaque visite ; plus de fichier haché séparé depuis l'inlining, donc pas de cache long.",
    '\t\tCache-Control "no-cache"',
    ...extra,
    '\t}',
  ];
}

/** Commentaire et sous-bloc `log` du journal d'accès (communs aux deux hôtes, seul le fichier change). */
function lignesJournal(journal: string): string[] {
  return [
    `\t# Journal d'accès : rotation chaque jour à ${ROTATION_JOURNAL} UTC (roll_at, Caddy 2.11 ou plus) ou dès ${TAILLE_JOURNAL},`,
    `\t# ${FICHIERS_TOURNES_GARDES} fichiers tournés gardés au plus (roll_keep, et roll_keep_for ${FICHIERS_TOURNES_GARDES * 24}h) plus le fichier du jour.`,
    `\t# Une entrée y reste donc moins de ${FICHIERS_TOURNES_GARDES + 1} jours, ${RETENTION_MAX_JOURS} jours au plus si une rotation de minuit est manquée`,
    `\t# (Caddy arrêté à minuit). Adresse IP tronquée (/${MASQUE_IPV4} en IPv4, /${MASQUE_IPV6} en IPv6), en-têtes de requête supprimés,`,
    '\t# détails TLS supprimés. Ces règles ne couvrent que le journal d\'accès : journaux d\'erreurs et par défaut,',
    '\t# voir RUNBOOK « Bloc Caddy (Phase 8) ». Syntaxe (roll_at, filtres) acceptée par Caddy 2.11.2 (Phase 8).',
    '\tlog {',
    `\t\toutput file ${journal} {`,
    `\t\t\troll_size ${TAILLE_JOURNAL}`,
    `\t\t\troll_at ${ROTATION_JOURNAL}`,
    `\t\t\troll_keep ${FICHIERS_TOURNES_GARDES}`,
    `\t\t\troll_keep_for ${FICHIERS_TOURNES_GARDES * 24}h`,
    '\t\t}',
    '\t\tformat filter {',
    `\t\t\trequest>remote_ip ip_mask ${MASQUE_IPV4} ${MASQUE_IPV6}`,
    `\t\t\trequest>client_ip ip_mask ${MASQUE_IPV4} ${MASQUE_IPV6}`,
    '\t\t\trequest>headers delete',
    '\t\t\trequest>tls delete',
    '\t\t\twrap json',
    '\t\t}',
    '\t}',
  ];
}

const ENTETE_GENERE = [
  '# Généré par scripts/render-caddy.ts depuis config/site.yml et src/scripts/*.js : ne pas modifier à la main.',
  '# Régénérer avec « node scripts/render-caddy.ts » ; tests/repo/caddy.test.ts échoue si ce fichier dérive.',
  '#',
];

/**
 * Adresse inconnue (plan 09.1-02, D-05), bloc de production seulement : une requête dont le chemin n'est ni un fichier
 * ni un dossier de la release reçoit /404.html avec le code 404. Aucune route d'erreur (pas de handle_errors) : la
 * réponse est ordinaire, notée dans le journal d'accès du site, et le niveau du journal des autres sites ne change pas.
 * `handle` passe avant le file_server de premier niveau (ordre des directives) : fichiers existants et redirection
 * des dossiers (/methode vers /methode/) inchangés. Cible fixe : rien de la requête n'entre dans la réécriture.
 * Revue 09.1 (CR-01) : `file_server { status 404 }` évalue encore les préconditions et les plages de la requête sur
 * 404.html ; une revalidation (If-None-Match, If-Modified-Since, que WebKit envoie pour une 404 gardée en cache) ou un
 * Range donnait le code 404 avec le corps vide ou tronqué d'une 304, 412 ou 206. Dans un `handle`, `request_header`
 * passe avant `file_server` : ces en-têtes sont retirés ici et nulle part ailleurs, les vrais fichiers gardent ETag,
 * 304 et plages (prouvé sur caddy:2.11.2-alpine).
 */
const LIGNES_INTROUVABLE = [
  "\t# Adresse inconnue (ni un fichier ni un dossier de la release) : 404.html du site avec le code 404 ; une release",
  '\t# sans ce fichier répond 404 sans corps. Pas de handle_errors : sur le serveur partagé, il ferait passer le journal',
  "\t# des erreurs de tous les sites au niveau debug (Caddy 2.11.2). Le journal d'accès note ces requêtes comme les autres.",
  '\t# Préconditions (If-None-Match, If-Modified-Since, If-Match...) et Range retirés dans cette route seulement : sinon',
  '\t# Caddy 2.11.2 répond 404 sans corps, ou tronqué pour Range, et Safari revalide une 404 (page blanche).',
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

/**
 * Texte du bloc Caddy (fonction pure : aucune lecture du système, même entrée, même chaîne).
 * Indentation par tabulations, retour ligne final. Lève une Error si une entrée casserait le bloc.
 */
export function renderCaddy(o: OptionsCaddy): string {
  verifier(o);
  const { domaine, racine, journal } = o;
  const csp = cspEnTete(o.empreintesScripts);
  const lignes = [
    ...ENTETE_GENERE,
    '# Caddy tourne dans un conteneur Docker (caddy:2-alpine, Phase 6) : les chemins ci-dessous sont ceux du',
    '# conteneur. La Phase 8 monte la racine du site en lecture seule et le dossier du journal en écriture, place',
    '# ce bloc dans le Caddyfile monté (collé ou importé) et le vérifie par « caddy validate » avant tout rechargement.',
    `${domaine} {`,
    '\t# Version en ligne : releases/<sha>/ pointée par le lien relatif « current » (disposition retenue en Phase 8).',
    `\troot * ${racine}`,
    '\tencode zstd gzip',
    '\tfile_server',
    '',
    ...LIGNES_INTROUVABLE,
    '',
    ...lignesEnTetes(csp),
    '',
    ...lignesJournal(journal),
    '}',
    '',
    `www.${domaine} {`,
    `\tredir https://${domaine}{uri} permanent`,
    '}',
  ];
  return `${lignes.join('\n')}\n`;
}

/**
 * Texte du bloc de l'hôte technique essai.<domaine> (fonction pure, mêmes refus que renderCaddy). Mêmes en-têtes,
 * compression, absence de cache et journal masqué que la production, plus : basic_auth sur tout chemin sauf
 * /robots.txt (empreintes lues dans l'environnement du conteneur, valeur par défaut factice), X-Robots-Tag noindex et
 * un robots.txt qui interdit tout. Aucune adresse www ni apex : le bloc de production n'est servi qu'à l'ouverture.
 */
export function renderCaddyEssai(o: OptionsCaddy): string {
  verifier(o);
  const { domaine, racine, journal } = o;
  const csp = cspEnTete(o.empreintesScripts);
  const lignes = [
    ...ENTETE_GENERE,
    "# Hôte technique des déploiements d'essai, protégé par mot de passe et jamais indexé ; retiré à l'ouverture",
    `# (Phase 9). Copié sous ${FICHIER_SITES_D_ESSAI} dans le dossier sites.d monté dans le conteneur, importé par le`,
    '# Caddyfile après « caddy validate ». Chemins vus depuis le conteneur, comme pour le bloc de production.',
    '#',
    `# Empreintes bcrypt : variables ${VARIABLES_HASH.essai} et ${VARIABLES_HASH.sonde} du conteneur, posées par le fichier`,
    "# d'environnement du compose (lisible par root seul), jamais dans le dépôt. Caddy les lit au démarrage : changer",
    '# une empreinte demande de recréer le conteneur, un simple rechargement ne suffit pas. Deux identifiants pour que',
    "# celui de la sonde change sans toucher celui de l'éditeur.",
    '# Valeur par défaut factice, aucun mot de passe ne lui correspond : une variable absente laisse le Caddyfile',
    '# valide (personne ne peut se connecter) au lieu de faire échouer tous les sites du serveur.',
    `essai.${domaine} {`,
    "\t# Version d'essai : essai/releases/<sha>/ pointée par le lien relatif « current » de essai/.",
    `\troot * ${racine}`,
    '\tencode zstd gzip',
    '\tfile_server',
    '',
    ...lignesEnTetes(csp),
    '\t# Hôte technique : aucune page ne doit être indexée, réponse 401 comprise. Directive à part, sans suppression,',
    "\t# donc appliquée tout de suite : le sous-bloc ci-dessus est différé par « -Server » et Caddy ne l'applique pas",
    "\t# au 401 de basic_auth. Pas de handle_errors : sur le serveur partagé, il ferait passer le journal des erreurs",
    '\t# 5xx de tous les sites au niveau debug (Caddy 2.11.2).',
    '\theader X-Robots-Tag "noindex, nofollow"',
    '',
    '\t# Mot de passe partout sauf sur /robots.txt : robots.txt reste lisible sans mot de passe, pour que les robots',
    '\t# lisent « Disallow: / ».',
    '\t@protege not path /robots.txt',
    '\tbasic_auth @protege {',
    `\t\tessai {$${VARIABLES_HASH.essai}:${HASH_FACTICE}} # gitleaks:allow`,
    `\t\tsonde {$${VARIABLES_HASH.sonde}:${HASH_FACTICE}} # gitleaks:allow`,
    '\t}',
    '\trespond /robots.txt <<TXT',
    '\t\tUser-agent: *',
    '\t\tDisallow: /',
    '\t\tTXT 200',
    '',
    ...lignesJournal(journal),
    '}',
  ];
  return `${lignes.join('\n')}\n`;
}

const USAGE = `Usage : node scripts/render-caddy.ts [--check] [--cible <site|essai>] [--sortie <fichier>]

  (sans option)       écrit les deux blocs rendus depuis config/site.yml et src/scripts/*.js :
                      deploy/caddy/site.caddy (production) puis deploy/caddy/essai.caddy (hôte technique)
  --check             n'écrit rien : vérifie que chaque fichier est à jour (code 1 sinon, fichier nommé)
  --cible <site|essai>  un seul bloc : site (production) ou essai (hôte technique)
  --sortie <fichier>  fichier écrit ou vérifié (dossier créé au besoin) ; sans --cible, c'est le bloc de production
  RTP_DEPLOIEMENT=1 : un domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) dans config/site.yml
  est refusé (code 2). Le contact n'entre pas dans le bloc : un contact provisoire ne bloque pas le rendu (le build et
  check-dist le refusent au déploiement).
  Code de sortie : 0 si écrit ou à jour, 1 si --check trouve un fichier absent ou différent, 2 si les arguments
  ou config/site.yml sont invalides.
`;

type Cible = 'site' | 'essai';

const SORTIES_PAR_DEFAUT: Record<Cible, string> = {
  site: path.join('deploy', 'caddy', 'site.caddy'),
  essai: path.join('deploy', 'caddy', 'essai.caddy'),
};

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function main(): void {
  let values: { check?: boolean; cible?: string; sortie?: string };
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(2),
      options: { check: { type: 'boolean' }, cible: { type: 'string' }, sortie: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    usageError(e instanceof Error ? e.message : String(e));
  }
  if (values.cible !== undefined && values.cible !== 'site' && values.cible !== 'essai') {
    usageError(`render-caddy : --cible « ${values.cible.slice(0, 40)} » inconnue (site ou essai)`);
  }

  // Ordre fixe : site puis essai. --sortie sans --cible garde le sens d'avant (bloc de production).
  const cibles: Cible[] = values.cible !== undefined ? [values.cible] : values.sortie !== undefined ? ['site'] : ['site', 'essai'];
  const projectRoot = process.cwd();

  const rendus: { cible: Cible; sortie: string; rel: string; rendu: string }[] = [];
  try {
    // Sous RTP_DEPLOIEMENT=1, seul le domaine compte (IN-05) : le contact n'est pas dans le bloc. Lecture avec un env
    // vide, puis garde explicite, comme check-dist ; une valeur invalide de RTP_DEPLOIEMENT reste refusée (code 2).
    const deploiement = estDeploiement(process.env);
    const { domaine, domaineProvisoire } = loadSiteConfig(projectRoot, {});
    if (deploiement && domaineProvisoire) {
      throw new Error(`render-caddy : domaine provisoire « ${domaine} » refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine dans config/site.yml`);
    }
    const empreintesScripts = scriptsEnLigne(projectRoot).map((s) => s.empreinte);
    for (const cible of cibles) {
      const sortie = path.resolve(projectRoot, values.sortie ?? SORTIES_PAR_DEFAUT[cible]);
      const rendu =
        cible === 'site'
          ? renderCaddy({ domaine, empreintesScripts, racine: RACINE_SERVEUR, journal: JOURNAL })
          : renderCaddyEssai({ domaine, empreintesScripts, racine: RACINE_ESSAI, journal: JOURNAL_ESSAI });
      rendus.push({ cible, sortie, rel: path.relative(projectRoot, sortie).split(path.sep).join('/'), rendu });
    }
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  if (values.check === true) {
    let perimes = 0;
    for (const { sortie, rel, rendu } of rendus) {
      const actuel = fs.existsSync(sortie) ? fs.readFileSync(sortie, 'utf8') : undefined;
      if (actuel !== rendu) {
        const etat = actuel === undefined ? 'absent' : 'pas à jour';
        process.stderr.write(`render-caddy : ${rel} ${etat} (config/site.yml ou src/scripts/*.js a changé) : lancer node scripts/render-caddy.ts\n`);
        perimes += 1;
      } else {
        console.log(`render-caddy : ${rel} à jour`);
      }
    }
    if (perimes > 0) process.exit(1);
    return;
  }
  for (const { sortie, rel, rendu } of rendus) {
    fs.mkdirSync(path.dirname(sortie), { recursive: true });
    fs.writeFileSync(sortie, rendu);
    console.log(`render-caddy : ${rel} écrit`);
  }
}

// Ligne de commande seulement : l'import par les tests n'exécute rien.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
