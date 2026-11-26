// Type de source du statut (D-02, phase 10.3) : règle fixe sur le domaine de source.url de la ligne amont.
// Ordre : même domaine que liens.campagne (candidat), que liens.parti (parti), suffixe institutionnel, sinon presse.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';

const SUFFIXE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function hote(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase().replace(/^www\./, '');
  return h === '' ? null : h;
}

/** Domaine enregistrable : deux derniers labels de l'hôte, `www.` retiré. Null si l'URL est illisible. */
export function domaineEnregistrable(url: string): string | null {
  const h = hote(url);
  if (h === null) return null;
  return h.split('.').slice(-2).join('.');
}

export function lireDomainesInstitutions(racine: string): string[] {
  const fichier = path.join(racine, 'data/import/domaines-institutions.yaml');
  const o = lireYamlPlafonne(readFileSync(fichier, 'utf8'), 'domaines-institutions.yaml');
  if (o.version !== 1 || !Array.isArray(o.suffixes)) throw new Error('domaines-institutions.yaml : « version: 1 » et « suffixes: » attendus');
  return o.suffixes.map((s) => {
    if (typeof s !== 'string' || !SUFFIXE.test(s)) throw new Error('domaines-institutions.yaml : suffixe invalide');
    return s;
  });
}

export function typeSourceStatut(
  ligne: { source: { url: string }; liens?: Record<string, string> },
  institutions: readonly string[],
): 'candidat' | 'parti' | 'institution' | 'presse' {
  const d = domaineEnregistrable(ligne.source.url);
  if (d === null) return 'presse';
  const campagne = ligne.liens?.campagne;
  if (campagne !== undefined && domaineEnregistrable(campagne) === d) return 'candidat';
  const parti = ligne.liens?.parti;
  if (parti !== undefined && domaineEnregistrable(parti) === d) return 'parti';
  const h = hote(ligne.source.url) as string;
  if (institutions.some((s) => h === s || h.endsWith(`.${s}`))) return 'institution';
  return 'presse';
}
