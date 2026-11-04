import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml';
import { estDeploiement } from './deploiement.ts';

// Configuration publique du site (config/site.yml, racine du PROJET : le contenu peut vivre ailleurs).
// Même discipline de parsing que content-core : schéma core, clés uniques, aucun alias.

export interface SiteConfig {
  /** Adresse publique des signalements. */
  contact: string;
  /** « propriétaire/dépôt » GitHub. */
  depot: string;
  /** Vrai tant que le contact est un placeholder `.invalid` (remplacé au lot 3). */
  contactProvisoire: boolean;
}

const FICHIER = 'config/site.yml';
const CLES = ['contact', 'depot'] as const;
const RE_CONTACT = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/;
const RE_DEPOT = /^[\w.-]+\/[\w.-]+$/;

const memo = new Map<string, SiteConfig>();
let avertie = false;

function erreur(detail: string): Error {
  return new Error(`${FICHIER} : ${detail}`);
}

/** Lit et valide `config/site.yml` ; lève une Error qui nomme le fichier si quoi que ce soit cloche. */
export function loadSiteConfig(projectRoot: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): SiteConfig {
  const racine = path.resolve(projectRoot);
  // Lue d'abord : une valeur invalide de RTP_DEPLOIEMENT échoue même quand la garde ne mord pas (IN-06).
  const deploiement = estDeploiement(env);
  const connue = memo.get(racine);
  if (connue !== undefined) return connue;

  const fichier = path.join(racine, 'config', 'site.yml');
  if (!existsSync(fichier)) throw erreur(`fichier introuvable (${fichier}) ; il porte le contact public et le dépôt GitHub`);

  const doc = parseDocument(readFileSync(fichier, 'utf8'), { schema: 'core', uniqueKeys: true, merge: false });
  if (doc.errors.length > 0) throw erreur(`YAML invalide (${(doc.errors[0]?.message ?? '').split('\n')[0]})`);
  let alias = false;
  visit(doc, {
    Alias: () => {
      alias = true;
    },
  });
  if (alias || isAlias(doc.contents)) throw erreur('les alias YAML ne sont pas acceptés');
  if (!isMap(doc.contents)) throw erreur('la racine doit être un objet avec les clés contact et depot');

  const brut: Record<string, unknown> = {};
  for (const paire of doc.contents.items) {
    const cle = isScalar(paire.key) ? String(paire.key.value) : String(paire.key);
    if (!(CLES as readonly string[]).includes(cle)) throw erreur(`clé inconnue « ${cle.slice(0, 40)} » (attendu : ${CLES.join(', ')})`);
    brut[cle] = isScalar(paire.value) ? paire.value.value : undefined;
  }

  const { contact, depot } = brut;
  if (typeof contact !== 'string' || !RE_CONTACT.test(contact)) throw erreur('« contact » doit être une adresse courriel (ex. contact@exemple.fr)');
  if (typeof depot !== 'string' || !RE_DEPOT.test(depot)) throw erreur('« depot » doit avoir la forme propriétaire/dépôt (ex. ErwanHenry/reveleTonProg)');

  const cfg: SiteConfig = { contact, depot, contactProvisoire: contact.toLowerCase().endsWith('.invalid') };
  // Garde de déploiement (WR-03) : le job de déploiement du lot 3 positionne RTP_DEPLOIEMENT=1 ; un
  // contact provisoire ne doit alors jamais partir en ligne (canal de correction mort).
  if (cfg.contactProvisoire && deploiement) {
    throw erreur('contact provisoire (.invalid) refusé quand RTP_DEPLOIEMENT=1 : renseigner une vraie adresse avant de déployer');
  }
  if (cfg.contactProvisoire && !avertie) {
    avertie = true;
    console.warn('contact provisoire (.invalid) : à remplacer au lot 3');
  }
  memo.set(racine, cfg);
  return cfg;
}
