// Serveur statique de test (zéro dépendance) : sert un dossier `dist` en gzip, sur 127.0.0.1 uniquement.
// Usage : node e2e/serveur.ts <dist> <port>
// `cache-control: no-store` : chaque chargement (mesure 4G) part à froid, à la différence de Caddy.
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export function creerServeur(racineArg: string): Server {
  const racine = path.resolve(racineArg);
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
    if (!abs.startsWith(racine + path.sep) || !existsSync(abs) || !statSync(abs).isFile()) {
      res.writeHead(404).end('404');
      return;
    }
    const ext = path.extname(abs);
    const brut = readFileSync(abs);
    const h = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
    if (ext in TYPES && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      let gz = memo.get(abs);
      if (!gz) memo.set(abs, (gz = gzipSync(brut, { level: 6 })));
      res
        .writeHead(200, { ...h, 'content-encoding': 'gzip', vary: 'Accept-Encoding', 'content-length': String(gz.length) })
        .end(gz);
    } else {
      res.writeHead(200, { ...h, 'content-length': String(brut.length) }).end(brut);
    }
  });
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [racine, port] = process.argv.slice(2);
  if (racine === undefined || port === undefined) {
    console.error('usage : node e2e/serveur.ts <dist> <port>');
    process.exit(2);
  }
  creerServeur(racine).listen(Number(port), '127.0.0.1');
}
