// Bloc Caddy du site (HEB-05, PERF-01 ; D-03, 07-07). Rendu par une fonction pure depuis le domaine de
// config/site.yml et les empreintes de src/scripts/*.js, puis écrit dans deploy/caddy/site.caddy (versionné).
// tests/repo/caddy.test.ts compare le fichier versionné à un rendu neuf : changer le domaine ou un script sans
// relancer ce script fait échouer npm test. Aucun serveur n'est touché ici ; « caddy validate » a lieu en Phase 8.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { scriptsEnLigne } from '../src/lib/csp-empreintes.ts';
import { estDomaineValide, loadSiteConfig } from '../src/lib/site-config.ts';

/**
 * Racine servie, vue depuis le conteneur Caddy : la Phase 8 monte le dossier du site en lecture seule sur
 * /srv/reveletonprog ; chaque version vit dans releases/<sha>/ et `current` pointe la version en ligne.
 */
export const RACINE_SERVEUR = '/srv/reveletonprog/current';
/** Fichier du journal d'accès, vu depuis le conteneur : /var/log/caddy est un dossier de l'hôte monté en écriture (Phase 8). */
export const JOURNAL = '/var/log/caddy/reveletonprog.log';

/**
 * Rétention du journal d'accès (CR-01, revue de la phase 7). Caddy 2.11 (timberjack) tourne le fichier courant à
 * l'heure ROTATION_JOURNAL (UTC, minuteur actif même sans trafic) ou dès TAILLE_JOURNAL, et ne garde que les
 * FICHIERS_TOURNES_GARDES fichiers tournés les plus récents (roll_keep compte les horodatages de rotation distincts ;
 * roll_keep_for, à résolution d'un jour, double la règle). Avec une rotation par jour, le plus vieux fichier gardé
 * couvre le jour J-N-1 : une entrée vit moins de N+1 jours. Une rotation de minuit manquée (Caddy arrêté à minuit :
 * au redémarrage, timberjack repart de l'heure de la première écriture) fait couvrir deux jours à un fichier, d'où
 * N+2 jours au plus. Une rotation à la taille ne fait que raccourcir la durée couverte.
 */
export const ROTATION_JOURNAL = '00:00';
export const TAILLE_JOURNAL = '10MiB';
export const FICHIERS_TOURNES_GARDES = 12;
/** Durée maximale promise (Mentions légales) : N+2 jours, une rotation de minuit manquée comprise. */
export const RETENTION_MAX_JOURS = FICHIERS_TOURNES_GARDES + 2;

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

function verifier(o: OptionsCaddy): void {
  if (!estDomaineValide(o.domaine)) {
    throw new Error(`render-caddy : domaine invalide « ${String(o.domaine).slice(0, 80)} » (nom d'hôte en minuscules, sans schéma, port, chemin ni « www. »)`);
  }
  if (o.empreintesScripts.length === 0) throw new Error('render-caddy : aucune empreinte de script (src/scripts/*.js vide ?)');
  for (const e of o.empreintesScripts) {
    if (!RE_EMPREINTE.test(e)) throw new Error(`render-caddy : empreinte mal formée « ${e.slice(0, 80)} » (attendu sha256-<base64>, sans guillemets)`);
  }
  if (new Set(o.empreintesScripts).size !== o.empreintesScripts.length) throw new Error('render-caddy : empreinte en double');
  if (!RE_CHEMIN.test(o.racine)) throw new Error(`render-caddy : racine invalide « ${o.racine.slice(0, 80)} » (chemin absolu sans blanc ni caractère spécial)`);
  if (!RE_CHEMIN.test(o.journal)) throw new Error(`render-caddy : journal invalide « ${o.journal.slice(0, 80)} » (chemin absolu sans blanc ni caractère spécial)`);
}

/**
 * Texte du bloc Caddy (fonction pure : aucune lecture du système, même entrée, même chaîne).
 * Indentation par tabulations, retour ligne final. Lève une Error si une entrée casserait le bloc.
 */
export function renderCaddy(o: OptionsCaddy): string {
  verifier(o);
  const { domaine, racine, journal } = o;
  const scriptSrc = o.empreintesScripts.map((e) => `'${e}'`).join(' ');
  const csp = [`script-src ${scriptSrc}`, "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join('; ');
  const lignes = [
    '# Généré par scripts/render-caddy.ts depuis config/site.yml et src/scripts/*.js : ne pas modifier à la main.',
    '# Régénérer avec « node scripts/render-caddy.ts » ; tests/repo/caddy.test.ts échoue si ce fichier dérive.',
    '#',
    '# Caddy tourne dans un conteneur Docker (caddy:2-alpine, Phase 6) : les chemins ci-dessous sont ceux du',
    '# conteneur. La Phase 8 monte la racine du site en lecture seule et le dossier du journal en écriture, place',
    '# ce bloc dans le Caddyfile monté (collé ou importé) et le vérifie par « caddy validate » avant tout rechargement.',
    `${domaine} {`,
    '\t# Version en ligne : releases/<sha>/ pointée par le lien « current » (disposition à confirmer en Phase 8).',
    `\troot * ${racine}`,
    '\tencode zstd gzip',
    '\tfile_server',
    '',
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
    '\t}',
    '',
    `\t# Journal d'accès : rotation chaque jour à ${ROTATION_JOURNAL} UTC (roll_at, Caddy 2.11 ou plus) ou dès ${TAILLE_JOURNAL},`,
    `\t# ${FICHIERS_TOURNES_GARDES} fichiers tournés gardés au plus (roll_keep, et roll_keep_for ${FICHIERS_TOURNES_GARDES * 24}h) plus le fichier du jour.`,
    `\t# Une entrée y reste donc moins de ${FICHIERS_TOURNES_GARDES + 1} jours, ${RETENTION_MAX_JOURS} jours au plus si une rotation de minuit est manquée`,
    '\t# (Caddy arrêté à minuit). Adresse IP tronquée (/24 en IPv4, /48 en IPv6), en-têtes de requête supprimés,',
    '\t# détails TLS supprimés. Ces règles ne couvrent que le journal d\'accès : journaux d\'erreurs et par défaut,',
    '\t# voir RUNBOOK « Bloc Caddy (Phase 8) ». Syntaxe (roll_at, filtres) à confirmer par « caddy validate » (Phase 8).',
    '\tlog {',
    `\t\toutput file ${journal} {`,
    `\t\t\troll_size ${TAILLE_JOURNAL}`,
    `\t\t\troll_at ${ROTATION_JOURNAL}`,
    `\t\t\troll_keep ${FICHIERS_TOURNES_GARDES}`,
    `\t\t\troll_keep_for ${FICHIERS_TOURNES_GARDES * 24}h`,
    '\t\t}',
    '\t\tformat filter {',
    '\t\t\trequest>remote_ip ip_mask 24 48',
    '\t\t\trequest>client_ip ip_mask 24 48',
    '\t\t\trequest>headers delete',
    '\t\t\trequest>tls delete',
    '\t\t\twrap json',
    '\t\t}',
    '\t}',
    '}',
    '',
    `www.${domaine} {`,
    `\tredir https://${domaine}{uri} permanent`,
    '}',
  ];
  return `${lignes.join('\n')}\n`;
}

const USAGE = `Usage : node scripts/render-caddy.ts [--check] [--sortie <fichier>]

  (sans option)       écrit le bloc Caddy rendu depuis config/site.yml et src/scripts/*.js
  --check             n'écrit rien : vérifie que le fichier est à jour (code 1 sinon)
  --sortie <fichier>  fichier écrit ou vérifié (défaut : deploy/caddy/site.caddy, dossier créé au besoin)
  RTP_DEPLOIEMENT=1 : un domaine ou un contact provisoire (.invalid) dans config/site.yml est refusé (code 2).
  Code de sortie : 0 si écrit ou à jour, 1 si --check trouve un fichier absent ou différent, 2 si les arguments
  ou config/site.yml sont invalides.
`;

function usageError(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function main(): void {
  let values: { check?: boolean; sortie?: string };
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(2),
      options: { check: { type: 'boolean' }, sortie: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    usageError(e instanceof Error ? e.message : String(e));
  }

  const projectRoot = process.cwd();
  const sortie = path.resolve(projectRoot, values.sortie ?? path.join('deploy', 'caddy', 'site.caddy'));
  const rel = path.relative(projectRoot, sortie).split(path.sep).join('/');

  let rendu: string;
  try {
    // Env du processus : sous RTP_DEPLOIEMENT=1, un domaine provisoire refuse le rendu (fail-closed).
    const { domaine } = loadSiteConfig(projectRoot, process.env);
    rendu = renderCaddy({
      domaine,
      empreintesScripts: scriptsEnLigne(projectRoot).map((s) => s.empreinte),
      racine: RACINE_SERVEUR,
      journal: JOURNAL,
    });
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  if (values.check === true) {
    const actuel = fs.existsSync(sortie) ? fs.readFileSync(sortie, 'utf8') : undefined;
    if (actuel !== rendu) {
      const etat = actuel === undefined ? 'absent' : 'pas à jour';
      process.stderr.write(`render-caddy : ${rel} ${etat} (config/site.yml ou src/scripts/*.js a changé) : lancer node scripts/render-caddy.ts\n`);
      process.exit(1);
    }
    console.log(`render-caddy : ${rel} à jour`);
    return;
  }
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, rendu);
  console.log(`render-caddy : ${rel} écrit`);
}

// Ligne de commande seulement : l'import par les tests n'exécute rien.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
