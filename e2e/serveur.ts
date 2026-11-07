// Serveur statique de test (zéro dépendance) : sert un dossier `dist` en gzip, sur 127.0.0.1 uniquement.
// Usage : node e2e/serveur.ts <dist> <port> [--sans-entete-csp]
// En-tête Content-Security-Policy : le même que le bloc Caddy (cspEnTete de scripts/render-caddy.ts, empreintes de
// src/scripts/*.js de ce dépôt), pour que les specs CSP fassent appliquer au navigateur l'en-tête et le meta ensemble
// (WR-02). Un dist construit depuis un autre commit (artefact site-preview ancien) peut avoir d'autres scripts :
// l'en-tête les bloque alors, `--sans-entete-csp` le retire.
// `cache-control: no-store` : chaque chargement (mesure 4G) part à froid, à la différence de Caddy.
// Liens symboliques : le chemin réel (realpath) de la cible doit rester sous le chemin réel du dist,
// sinon 404 ; un lien qui pointe vers un autre fichier du dist est servi.
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
    if (rel.endsWith('/')) rel += 'index.html';
    const abs = path.resolve(racine, `.${rel}`);
    const reel = cheminReel(racine, abs);
    if (reel === null) {
      res.writeHead(404).end('404');
      return;
    }
    const ext = path.extname(abs);
    const brut = readFileSync(reel);
    const h: Record<string, string> = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
    if (csp !== null) h['content-security-policy'] = csp;
    if (ext in TYPES && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let gz = memo.get(reel);
      if (!gz) memo.set(reel, (gz = gzipSync(brut, { level: 6 })));
      res
        .writeHead(200, { ...h, 'content-encoding': 'gzip', vary: 'Accept-Encoding', 'content-length': String(gz.length) })
        .end(gz);
    } else {
      res.writeHead(200, { ...h, 'content-length': String(brut.length) }).end(brut);
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
