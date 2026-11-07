// CSS réellement servi par les pages construites (ADR-056 : une <style> par page, plus aucun dist/_astro/*.css).
// Partagé par les cas de règles CSS (ordre, niveaux, enfant) pour ne pas recopier le lecteur trois fois.
// Ce fichier n'est pas un test (pas de suffixe .test.ts) et ne lance rien.
import fs from 'node:fs';
import path from 'node:path';
import { analyserHtml, texte, trouver } from '../../scripts/lib/html.ts';

function pagesHtml(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return pagesHtml(p);
      return e.isFile() && e.name.endsWith('.html') ? [p] : [];
    })
    .sort();
}

/**
 * Texte brut de chaque <style> des pages construites, sans doublon (texte identique) et dans un ordre stable
 * (pages triées, puis ordre du document), joint par un retour ligne.
 * `pages` : chemins relatifs à `outDir` (séparateurs « / »), sinon toutes les pages .html du dist.
 * Lève si aucun <style> n'est trouvé : une chaîne vide rendrait les tests de règles CSS vides de sens.
 */
export function cssDesPages(outDir: string, pages?: readonly string[]): string {
  const fichiers = pages === undefined ? pagesHtml(outDir) : pages.map((p) => path.join(outDir, ...p.split('/')));
  if (fichiers.length === 0) throw new Error(`cssDesPages : aucune page .html dans ${outDir}`);
  const vus = new Set<string>();
  const blocs: string[] = [];
  for (const f of fichiers) {
    for (const s of trouver(analyserHtml(fs.readFileSync(f, 'utf8')), (n) => n.tag === 'style')) {
      const css = texte(s);
      if (css === '' || vus.has(css)) continue;
      vus.add(css);
      blocs.push(css);
    }
  }
  if (blocs.length === 0) throw new Error(`cssDesPages : aucun <style> dans ${fichiers.length} page(s) de ${outDir}`);
  return blocs.join('\n');
}
