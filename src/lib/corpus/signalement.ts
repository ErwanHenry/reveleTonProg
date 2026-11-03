// Liens de signalement d'erreur et lien vers l'extrait archivé. Fonctions pures.
// Tout texte venu du contenu passe par encodeURIComponent (RFC 6068 : espace en %20, retour chariot en %0D%0A).

const sujet = (id: string): string => `Signaler une erreur : ${id}`;
const corpsMail = (id: string, chemin: string): string => `Identifiant : ${id}\r\nPage : ${chemin}\r\n\r\nErreur constatée :\r\n`;

/** Lien courriel pré-rempli avec l'identifiant de la mesure et le chemin de la page (jamais d'URL absolue). */
export function lienMailto(contact: string, id: string, chemin: string): string {
  return `mailto:${contact}?subject=${encodeURIComponent(sujet(id))}&body=${encodeURIComponent(corpsMail(id, chemin))}`;
}

/** Lien « nouvelle issue » GitHub, titre et corps pré-remplis. */
export function lienIssue(depot: string, id: string): string {
  const titre = `Erreur signalée : ${id}`;
  const corps = `Identifiant : ${id}\n\nErreur constatée :\n`;
  return `https://github.com/${depot}/issues/new?title=${encodeURIComponent(titre)}&body=${encodeURIComponent(corps)}`;
}

const posix = (p: string): string => p.split('\\').join('/').replace(/\/+$/, '');

/**
 * Lien vers l'extrait archivé dans le dépôt (branche main). `extrait` est relatif à la racine de contenu ;
 * si celle-ci est dans le projet, le chemin du dépôt est son chemin relatif au projet suivi de l'extrait,
 * sinon (racine temporaire de test) l'extrait seul. Jamais de « .. ».
 */
export function lienExtrait(depot: string, extrait: string, contentRoot: string, projectRoot: string): string {
  const racine = posix(contentRoot);
  const projet = posix(projectRoot);
  const prefixe = racine.startsWith(`${projet}/`) ? `${racine.slice(projet.length + 1)}/` : '';
  const chemin = `${prefixe}${extrait.replace(/^\/+/, '')}`;
  return `https://github.com/${depot}/blob/main/${chemin.split('/').map(encodeURIComponent).join('/')}`;
}
