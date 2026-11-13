// Serveur statique de test (zéro dépendance) : sert un dossier `dist` en gzip, sur 127.0.0.1 uniquement.
// Usage : node e2e/serveur.ts <dist> <port> [--sans-entete-csp]
// En-tête Content-Security-Policy : le même que le bloc Caddy (cspEnTete de scripts/render-caddy.ts, empreintes de
// src/scripts/*.js de ce dépôt), pour que les specs CSP fassent appliquer au navigateur l'en-tête et le meta ensemble
// (WR-02). Un dist construit depuis un autre commit (artefact site-preview ancien) peut avoir d'autres scripts :
// l'en-tête les bloque alors, `--sans-entete-csp` le retire.
// `cache-control: no-store` : chaque chargement (mesure 4G) part à froid, à la différence de Caddy.
// Liens symboliques : le chemin réel (realpath) de la cible doit rester sous le chemin réel du dist,
// sinon 404 ; un lien qui pointe vers un autre fichier du dist est servi.
// Adresse inconnue (plan 09.1-02) : comme le bloc Caddy public (`@introuvable not file {path} {path}/`, puis
// `rewrite * /404.html` et `file_server { status 404 }`), le serveur répond 404 avec <dist>/404.html et les en-têtes
// d'une page (même contrôle de chemin réel) ; sans 404.html dans le dist, le corps reste « 404 ». Comme Caddy, la 404
// porte Cache-Control no-cache, ETag et Last-Modified, et comme le bloc (CR-01 de la revue 09.1 : `request_header -If-*`
// et `-Range` dans la route), préconditions et Range n'y changent rien : WebKit revalide une 404 gardée en cache et
// doit recevoir la page entière, jamais un corps vide.
// Parité avec Caddy (IN-04 de la revue 09.1) : un dossier qui a son index.html, demandé sans barre finale (/methode),
// reçoit 308 vers /methode/ comme sous Caddy. Écarts voulus ou connus : les vrais fichiers partent en no-store, sans
// ETag ni Last-Modified, sans 304 ni plages (chaque chargement de la mesure 4G part à froid) ; seuls gzip et identité
// (Caddy propose aussi zstd) ; un dossier sans index.html reçoit ici la page 404, alors que Caddy, dont le filtre
// `{path}/` le reconnaît comme dossier, laisse son file_server de premier niveau répondre 404 (non vérifié en conteneur,
// le dist n'a pas de tel dossier). La preuve de la revalidation de la 404 réelle reste le contrôle du RUNBOOK (CR-01).
import { createServer, type Server } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspEnTete } from '../scripts/render-caddy.ts';
import { scriptsEnLigne } from '../src/lib/csp-empreintes.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** En-tête CSP servi en production pour ce dépôt (même calcul que deploy/caddy/site.caddy). */
export function cspEnTeteDuDepot(): string {
  return cspEnTete(scriptsEnLigne(REPO).map((s) => s.empreinte));
}

export interface OptionsServeur {
  /** Valeur de l'en-tête Content-Security-Policy ; null : aucun en-tête. Défaut : cspEnTeteDuDepot(). */
  csp?: string | null;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8', // version.json (HEB-07)
  '.ico': 'image/x-icon', // favicon.ico (D-11)
  '.png': 'image/png', // partage.png (09.1, proposition 6) : jamais chargé par une page, servi comme le bloc Caddy
};

/**
 * Chemin réel d'un fichier régulier sous `racine`, ou null : hors du dist (contrôle lexical, puis
 * contrôle des chemins réels, ce qui refuse un lien symbolique vers l'extérieur), absent ou dossier.
 */
function cheminReel(racine: string, abs: string): string | null {
  if (!abs.startsWith(racine + path.sep)) return null;
  try {
    const racineReelle = realpathSync(racine);
    const reel = realpathSync(abs);
    if (!reel.startsWith(racineReelle + path.sep) || !statSync(reel).isFile()) return null;
    return reel;
  } catch {
    return null;
  }
}

export function creerServeur(racineArg: string, options: OptionsServeur = {}): Server {
  const racine = path.resolve(racineArg);
  const csp = options.csp === undefined ? cspEnTeteDuDepot() : options.csp;
  const memo = new Map<string, Buffer>();
  return createServer((req, res) => {
    let rel: string;
    try {
      rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      res.writeHead(400).end('400');
      return;
    }
    // Dossier de la release demandé sans sa barre finale : 308 vers le chemin avec barre, requête gardée, comme le
    // file_server de Caddy (IN-04 de la revue 09.1) ; seulement si le dossier a son index.html sous le dist.
    if (!rel.endsWith('/') && cheminReel(racine, path.resolve(racine, `.${rel}`, 'index.html')) !== null) {
      const url = new URL(req.url ?? '/', 'http://x');
      res.writeHead(308, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    if (rel.endsWith('/')) rel += 'index.html';
    let abs = path.resolve(racine, `.${rel}`);
    let reel = cheminReel(racine, abs);
    let status = 200;
    if (reel === null) {
      abs = path.join(racine, '404.html');
      reel = cheminReel(racine, abs);
      status = 404;
      if (reel === null) {
        res.writeHead(404).end('404');
        return;
      }
    }
    const ext = path.extname(abs);
    const brut = readFileSync(reel);
    // L'icône reçoit la valeur du bloc Caddy (Cache-Control "no-cache", deploy/caddy/site.caddy) : servie en
    // no-store, Chromium ne garde plus la page dans le bfcache (vérifié par e2e/parcours.spec.ts, D-11).
    // La 404 aussi, avec ETag et Last-Modified comme file_server : un navigateur la garde et la revalide (CR-01).
    const cache = status === 404 || ext === '.ico' || ext === '.png' ? 'no-cache' : 'no-store';
    const h: Record<string, string> = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': cache };
    if (status === 404) {
      // Préconditions (If-None-Match, If-Modified-Since...) et Range ignorés ici, comme le bloc Caddy les retire
      // (`request_header -If-*`, `request_header -Range`) : la 404 part toujours entière.
      const st = statSync(reel);
      h['etag'] = `"${Math.floor(st.mtimeMs).toString(36)}${st.size.toString(36)}"`;
      h['last-modified'] = st.mtime.toUTCString();
    }
    if (csp !== null) h['content-security-policy'] = csp;
    if (ext in TYPES && ext !== '.png' && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let gz = memo.get(reel);
      if (!gz) memo.set(reel, (gz = gzipSync(brut, { level: 6 })));
      res
        .writeHead(status, { ...h, 'content-encoding': 'gzip', vary: 'Accept-Encoding', 'content-length': String(gz.length) })
        .end(gz);
    } else {
      res.writeHead(status, { ...h, 'content-length': String(brut.length) }).end(brut);
    }
  });
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const sansCsp = args.includes('--sans-entete-csp');
  const [racine, port, ...reste] = args.filter((a) => a !== '--sans-entete-csp');
  if (racine === undefined || port === undefined || reste.length > 0) {
    console.error('usage : node e2e/serveur.ts <dist> <port> [--sans-entete-csp]');
    process.exit(2);
  }
  creerServeur(racine, sansCsp ? { csp: null } : {}).listen(Number(port), '127.0.0.1');
}
