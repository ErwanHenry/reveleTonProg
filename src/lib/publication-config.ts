import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAlias, isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';

// Liste blanche de publication (config/publication.yml, lue depuis la RACINE DE CONTENU : c'est une décision
// éditoriale attachée à un corpus, et les fixtures ont la leur). Même discipline de parsing que site-config :
// schéma core, clés uniques, aucun alias, clé inconnue refusée.

export interface PublicationConfig {
  /** Identifiants des thèmes ouverts au public, dans l'ordre du fichier, sans doublon. */
  themesOuverts: string[];
  /** Chemin absolu du fichier (présent ou non). */
  fichier: string;
  /** Faux si le fichier n'existe pas : la liste est alors vide. */
  present: boolean;
}

const FICHIER = 'config/publication.yml';
const CLE = 'themes_ouverts';
const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function erreur(detail: string): Error {
  return new Error(`${FICHIER} : ${detail}`);
}

/**
 * Lit et valide la liste blanche ; un fichier absent équivaut à une liste vide. Lève une Error qui nomme
 * le fichier si quoi que ce soit cloche. Pas de mémo : le fichier est minuscule et un test peut le créer.
 */
export function loadPublicationConfig(contentRoot: string): PublicationConfig {
  const fichier = path.join(path.resolve(contentRoot), 'config', 'publication.yml');
  if (!existsSync(fichier)) return { themesOuverts: [], fichier, present: false };

  const doc = parseDocument(readFileSync(fichier, 'utf8'), { schema: 'core', uniqueKeys: true, merge: false });
  if (doc.errors.length > 0) throw erreur(`YAML invalide (${(doc.errors[0]?.message ?? '').split('\n')[0]})`);
  let alias = false;
  visit(doc, {
    Alias: () => {
      alias = true;
    },
  });
  if (alias || isAlias(doc.contents)) throw erreur('les alias YAML ne sont pas acceptés');
  if (!isMap(doc.contents)) throw erreur(`la racine doit être un objet avec la seule clé ${CLE}`);

  let liste: unknown;
  let vue = false;
  for (const paire of doc.contents.items) {
    const cle = isScalar(paire.key) ? String(paire.key.value) : String(paire.key);
    if (cle !== CLE) throw erreur(`clé inconnue « ${cle.slice(0, 40)} » (attendu : ${CLE})`);
    vue = true;
    liste = paire.value;
  }
  if (!vue) throw erreur(`la clé ${CLE} est absente (mettre une liste vide : ${CLE}: [])`);
  if (!isSeq(liste)) throw erreur(`« ${CLE} » doit être une liste (éventuellement vide) d'identifiants de thème`);

  const themesOuverts: string[] = [];
  for (const item of liste.items) {
    const valeur = isScalar(item) ? item.value : undefined;
    if (typeof valeur !== 'string' || !RE_SLUG.test(valeur) || valeur.length > 80) {
      throw erreur(`« ${CLE} » ne contient que des identifiants de thème (minuscules, chiffres et tirets), reçu : ${String(isScalar(item) ? item.value : '(non scalaire)').slice(0, 40)}`);
    }
    if (themesOuverts.includes(valeur)) throw erreur(`« ${valeur} » figure deux fois dans « ${CLE} »`);
    themesOuverts.push(valeur);
  }
  return { themesOuverts, fichier, present: true };
}

export { estOuvert } from './publication-ouverture.ts';
