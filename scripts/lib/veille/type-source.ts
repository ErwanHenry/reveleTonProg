// Type de source du statut (D-02, phase 10.3) : règle fixe sur l'hôte de source.url de la ligne amont.
// Ordre : même site que liens.campagne (candidat), que liens.parti (parti), suffixe institutionnel, sinon presse.
//
// WR-10 (revue 10.3) : « même site » se juge sur le nom d'hôte complet (`www.` ignoré) : l'hôte de la source est égal
// à celui du lien ou en est un sous-domaine. Jamais sur les deux derniers labels, qui sont partagés par les
// hébergeurs de pages, les réseaux sociaux et les suffixes à deux niveaux. Un hôte de la liste versionnée des hôtes
// partagés (data/import/domaines-institutions.yaml, clé `hotes_partages`) ne vaut jamais `candidat` ni `parti`, ni
// comme source ni comme lien. Dans le doute : `presse`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';

const SUFFIXE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const FICHIER = 'data/import/domaines-institutions.yaml';

export interface ReglesTypeSource {
  /** Suffixes institutionnels : hôte égal ou sous-domaine, classé `institution`. */
  institutions: readonly string[];
  /** Hôtes partagés (réseaux sociaux, hébergeurs de pages, raccourcisseurs) : jamais `candidat` ni `parti`. */
  partages: readonly string[];
}

/** Nom d'hôte complet en minuscules, `www.` retiré ; null si l'URL est illisible ou n'est pas http(s). */
export function hoteSansWww(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  return h === '' ? null : h;
}

/** Vrai si `hote` est égal à `base` ou en est un sous-domaine (comparaison sur des labels entiers). */
const egalOuSousDomaine = (hote: string, base: string): boolean => hote === base || hote.endsWith(`.${base}`);

const partage = (hote: string, partages: readonly string[]): boolean => partages.some((p) => egalOuSousDomaine(hote, p));

/** Même site : hôte de la source égal à l'hôte du lien ou sous-domaine de celui-ci, aucun des deux n'étant partagé. */
export function memeSite(source: string, lien: string | undefined, partages: readonly string[]): boolean {
  if (lien === undefined) return false;
  const h = hoteSansWww(source);
  const l = hoteSansWww(lien);
  if (h === null || l === null) return false;
  if (partage(h, partages) || partage(l, partages)) return false;
  return egalOuSousDomaine(h, l);
}

function liste(o: Record<string, unknown>, cle: string): string[] {
  const v = o[cle];
  if (!Array.isArray(v)) throw new Error(`domaines-institutions.yaml : « ${cle}: » attendu`);
  return v.map((s) => {
    if (typeof s !== 'string' || !SUFFIXE.test(s)) throw new Error(`domaines-institutions.yaml : valeur invalide dans « ${cle} »`);
    return s;
  });
}

function lireFichier(racine: string): Record<string, unknown> {
  const o = lireYamlPlafonne(readFileSync(path.join(racine, FICHIER), 'utf8'), 'domaines-institutions.yaml');
  if (o.version !== 1) throw new Error('domaines-institutions.yaml : « version: 1 » attendu');
  return o;
}

export function lireDomainesInstitutions(racine: string): string[] {
  return liste(lireFichier(racine), 'suffixes');
}

/** Règles complètes du type de source : suffixes institutionnels et hôtes partagés, lus dans la liste versionnée. */
export function lireReglesTypeSource(racine: string): ReglesTypeSource {
  const o = lireFichier(racine);
  return { institutions: liste(o, 'suffixes'), partages: liste(o, 'hotes_partages') };
}

export function typeSourceStatut(ligne: { source: { url: string }; liens?: Record<string, string> }, regles: ReglesTypeSource): 'candidat' | 'parti' | 'institution' | 'presse' {
  const h = hoteSansWww(ligne.source.url);
  if (h === null) return 'presse';
  if (memeSite(ligne.source.url, ligne.liens?.campagne, regles.partages)) return 'candidat';
  if (memeSite(ligne.source.url, ligne.liens?.parti, regles.partages)) return 'parti';
  if (regles.institutions.some((s) => egalOuSousDomaine(h, s))) return 'institution';
  return 'presse';
}
