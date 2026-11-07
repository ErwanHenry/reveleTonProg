import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml';
import { estDeploiement } from './deploiement.ts';

// Configuration publique du site (config/site.yml, racine du PROJET : le contenu peut vivre ailleurs).
// Même discipline de parsing que content-core : schéma core, clés uniques, aucun alias.

export interface SiteConfig {
  /** Nom d'hôte du site (apex, minuscules, sans schéma, port, chemin ni `www.`) : alimente `site`, les URL canoniques, sitemap.xml, robots.txt et le bloc Caddy. */
  domaine: string;
  /** Vrai tant que le domaine finit par un TLD réservé (estHoteProvisoire : .invalid, .test, .example, .localhost). */
  domaineProvisoire: boolean;
  /** Adresse publique des signalements. */
  contact: string;
  /** « propriétaire/dépôt » GitHub. */
  depot: string;
  /** Vrai tant que le domaine du contact finit par un TLD réservé (estHoteProvisoire ; remplacé au lot 3). */
  contactProvisoire: boolean;
}

const FICHIER = 'config/site.yml';
const CLES = ['domaine', 'contact', 'depot'] as const;
// Nom d'hôte strict : étiquettes [a-z0-9] avec tirets internes (63 caractères au plus), au moins deux
// étiquettes, TLD alphabétique de 2 à 63 lettres ; la longueur totale (≤ 253) et `www.` sont vérifiées à part.
const RE_DOMAINE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RE_CONTACT = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/;
const RE_DEPOT = /^[\w.-]+\/[\w.-]+$/;

/**
 * TLD réservés (RFC 2606 et RFC 6761) : un hôte qui finit par l'un d'eux ne sert jamais un vrai site. Tous comptent
 * comme provisoires pour la garde de déploiement (IN-04 de la revue de la phase 7), pas seulement `.invalid`.
 */
export const TLD_PROVISOIRES: readonly string[] = ['invalid', 'test', 'example', 'localhost'];

/** Vrai si le nom d'hôte (ou le domaine d'une adresse courriel) finit par un TLD de TLD_PROVISOIRES, casse ignorée. */
export function estHoteProvisoire(hote: string): boolean {
  const nom = (hote.split('@').pop() ?? '').trim().toLowerCase().replace(/\.$/, '');
  return TLD_PROVISOIRES.includes(nom.split('.').pop() ?? '');
}

/** Vrai si `domaine` est un nom d'hôte accepté dans config/site.yml (même règle pour le rendu Caddy). */
export function estDomaineValide(domaine: unknown): domaine is string {
  return typeof domaine === 'string' && domaine.length <= 253 && RE_DOMAINE.test(domaine) && !domaine.startsWith('www.');
}

const memo = new Map<string, SiteConfig>();
let avertie = false;

function erreur(detail: string): Error {
  return new Error(`${FICHIER} : ${detail}`);
}

/**
 * Lit et valide `config/site.yml` ; lève une Error qui nomme le fichier si quoi que ce soit cloche. La lecture est
 * mémorisée par racine, mais la garde de déploiement est évaluée à chaque appel (IN-02 de la revue de la phase 7) :
 * une première lecture avec un env vide ne laisse jamais passer une lecture suivante sous RTP_DEPLOIEMENT=1.
 */
export function loadSiteConfig(projectRoot: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): SiteConfig {
  const racine = path.resolve(projectRoot);
  // Lue d'abord : une valeur invalide de RTP_DEPLOIEMENT échoue même quand la garde ne mord pas (IN-06).
  const deploiement = estDeploiement(env);
  let cfg = memo.get(racine);
  if (cfg === undefined) {
    cfg = lireFichier(racine);
    memo.set(racine, cfg);
  }
  if (deploiement) verifierDeploiement(cfg);
  const provisoires = [cfg.domaineProvisoire && `domaine « ${cfg.domaine} »`, cfg.contactProvisoire && `contact « ${cfg.contact} »`].filter(Boolean);
  if (provisoires.length > 0 && !avertie) {
    avertie = true;
    console.warn(`${FICHIER} : valeurs provisoires (TLD réservé), à remplacer avant le déploiement : ${provisoires.join(', ')}`);
  }
  return cfg;
}

function lireFichier(racine: string): SiteConfig {
  const fichier = path.join(racine, 'config', 'site.yml');
  if (!existsSync(fichier)) throw erreur(`fichier introuvable (${fichier}) ; il porte le domaine du site, le contact public et le dépôt GitHub`);

  const doc = parseDocument(readFileSync(fichier, 'utf8'), { schema: 'core', uniqueKeys: true, merge: false });
  if (doc.errors.length > 0) throw erreur(`YAML invalide (${(doc.errors[0]?.message ?? '').split('\n')[0]})`);
  let alias = false;
  visit(doc, {
    Alias: () => {
      alias = true;
    },
  });
  if (alias || isAlias(doc.contents)) throw erreur('les alias YAML ne sont pas acceptés');
  if (!isMap(doc.contents)) throw erreur('la racine doit être un objet avec les clés domaine, contact et depot');

  const brut: Record<string, unknown> = {};
  for (const paire of doc.contents.items) {
    const cle = isScalar(paire.key) ? String(paire.key.value) : String(paire.key);
    if (!(CLES as readonly string[]).includes(cle)) throw erreur(`clé inconnue « ${cle.slice(0, 40)} » (attendu : ${CLES.join(', ')})`);
    brut[cle] = isScalar(paire.value) ? paire.value.value : undefined;
  }

  const { domaine, contact, depot } = brut;
  if (!estDomaineValide(domaine)) {
    throw erreur('« domaine » doit être un nom d\'hôte en minuscules, sans schéma, port, chemin ni « www. » (ex. exemple.fr)');
  }
  if (typeof contact !== 'string' || !RE_CONTACT.test(contact)) throw erreur('« contact » doit être une adresse courriel (ex. contact@exemple.fr)');
  if (typeof depot !== 'string' || !RE_DEPOT.test(depot)) throw erreur('« depot » doit avoir la forme propriétaire/dépôt (ex. ErwanHenry/reveleTonProg)');

  return {
    domaine,
    domaineProvisoire: estHoteProvisoire(domaine),
    contact,
    depot,
    contactProvisoire: estHoteProvisoire(contact),
  };
}

function verifierDeploiement(cfg: SiteConfig): void {
  // Garde de déploiement (WR-03, HEB-06) : le job de déploiement positionne RTP_DEPLOIEMENT=1 ; ni un
  // domaine provisoire (URL canoniques et sitemap vers un domaine mort) ni un contact provisoire (canal de
  // correction mort) ne doivent alors partir en ligne. Une seule erreur nomme tous les champs fautifs.
  const refus: string[] = [];
  if (cfg.domaineProvisoire) refus.push('domaine provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer');
  if (cfg.contactProvisoire) refus.push('contact provisoire (TLD réservé : .invalid, .test, .example, .localhost) refusé quand RTP_DEPLOIEMENT=1 : renseigner une vraie adresse avant de déployer');
  if (refus.length > 0) throw erreur(refus.join(' ; '));
}
