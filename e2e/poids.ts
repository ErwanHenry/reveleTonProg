// Page la plus lourde du dist : HTML + CSS/JS de /_astro/ qu'elle référence, en octets gzip (niveau 6, comme
// le serveur de test). Même comptage que scripts/lib/check-dist.ts.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { PAGES } from './pages.ts';

const REF = /(?:href|src)="(\/_astro\/[^"#?]+\.(?:css|js))"/g;

export function pageLaPlusLourde(dist: string): { url: string; octetsGzip: number } {
  const racine = path.resolve(dist);
  let meilleure: { url: string; octetsGzip: number } | undefined;
  for (const p of PAGES) {
    const html = readFileSync(p.fichier);
    let total = gzipSync(html, { level: 6 }).length;
    const vus = new Set<string>();
    for (const m of html.toString('utf8').matchAll(REF)) {
      const ref = m[1] as string;
      if (vus.has(ref)) continue;
      vus.add(ref);
      const f = path.join(racine, ref);
      if (existsSync(f)) total += gzipSync(readFileSync(f), { level: 6 }).length;
    }
    if (!meilleure || total > meilleure.octetsGzip || (total === meilleure.octetsGzip && p.url < meilleure.url)) {
      meilleure = { url: p.url, octetsGzip: total };
    }
  }
  if (!meilleure) throw new Error(`Aucune page dans ${dist}`);
  return meilleure;
}
