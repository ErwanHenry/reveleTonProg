// Verrou des identifiants de candidats (REGLE-07). Module PUR : aucun accès disque, pour que le
// script `npm run ids`, la règle de corpus ID_* et l'importeur de la Phase 3 partagent la même logique.

export const IDS_LOCK = 'ids.lock';

export const EN_TETE_IDS_LOCK =
  '# ids.lock — identifiants de candidats figés (append-only). Ne jamais renommer ni supprimer une ligne.\n' +
  '# Mise à jour : npm run ids -- --write   |   Vérification : npm run validate (ou npm run ids -- --check)\n';

export type CodeIds = 'IDS_LOCK_ABSENT' | 'IDS_LOCK_INVALIDE' | 'ID_VERROUILLE_DISPARU' | 'ID_NON_VERROUILLE';

export interface ProblemeIds {
  code: CodeIds;
  /** 1-based dans ids.lock (1 quand sans objet). */
  ligne: number;
  id?: string;
  message: string;
}

export interface IdsLock {
  /** Identifiants valides, dans l'ordre du fichier. */
  ids: string[];
  /** Identifiant -> ligne (1-based). */
  lignes: Map<string, number>;
  problemes: ProblemeIds[];
}

const ID_CANDIDAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/** Ordre par unité de code (a < b), identique à Array.prototype.sort() sur des chaînes. */
function trier(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

export function lireIdsLock(texte: string): IdsLock {
  const ids: string[] = [];
  const lignes = new Map<string, number>();
  const problemes: ProblemeIds[] = [];
  let precedent: string | undefined;
  texte.split('\n').forEach((brut, i) => {
    const ligne = i + 1;
    const contenu = brut.endsWith('\r') ? brut.slice(0, -1) : brut;
    if (contenu.trim() === '' || contenu.startsWith('#')) return;
    if (!ID_CANDIDAT.test(contenu)) {
      problemes.push({ code: 'IDS_LOCK_INVALIDE', ligne, message: `la ligne n'est pas un identifiant de candidat valide (minuscules, chiffres et tirets, ex. marie-fictive)` });
      return;
    }
    if (lignes.has(contenu)) {
      problemes.push({ code: 'IDS_LOCK_INVALIDE', ligne, id: contenu, message: `identifiant « ${contenu} » en double (déjà ligne ${lignes.get(contenu)})` });
      return;
    }
    if (precedent !== undefined && contenu < precedent) {
      problemes.push({ code: 'IDS_LOCK_INVALIDE', ligne, id: contenu, message: `identifiant « ${contenu} » non trié (il doit suivre l'ordre alphabétique, après « ${precedent} »)` });
    } else {
      precedent = contenu;
    }
    ids.push(contenu);
    lignes.set(contenu, ligne);
  });
  return { ids, lignes, problemes };
}

export function comparerIdsLock(lock: IdsLock | undefined, candidats: readonly string[]): ProblemeIds[] {
  if (lock === undefined) {
    if (candidats.length === 0) return [];
    return [{ code: 'IDS_LOCK_ABSENT', ligne: 1, message: `aucun fichier ${IDS_LOCK} alors que des candidats existent : lancer npm run ids -- --write` }];
  }
  const problemes: ProblemeIds[] = [...lock.problemes];
  const presents = new Set(candidats);
  for (const id of lock.ids) {
    if (!presents.has(id)) {
      problemes.push({
        code: 'ID_VERROUILLE_DISPARU',
        ligne: lock.lignes.get(id) ?? 1,
        id,
        message: `l'identifiant verrouillé « ${id} » n'a plus de fichier candidat : renommer ou supprimer un identifiant de candidat est interdit`,
      });
    }
  }
  for (const id of trier(candidats)) {
    if (!lock.lignes.has(id)) {
      problemes.push({ code: 'ID_NON_VERROUILLE', ligne: 1, id, message: `l'identifiant « ${id} » n'est pas verrouillé : lancer npm run ids -- --write` });
    }
  }
  return problemes.sort((a, b) => a.ligne - b.ligne || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) || (a.id ?? '').localeCompare(b.id ?? '', 'en'));
}

export function ecrireIdsLock(ids: readonly string[]): string {
  return EN_TETE_IDS_LOCK + trier(ids).map((id) => `${id}\n`).join('');
}

export function ajouterIds(
  lock: IdsLock | undefined,
  candidats: readonly string[],
): { texte: string; ajoutes: string[] } | { refus: ProblemeIds[] } {
  const bloquants = comparerIdsLock(lock, candidats).filter((p) => p.code === 'ID_VERROUILLE_DISPARU' || p.code === 'IDS_LOCK_INVALIDE');
  for (const id of trier(candidats)) {
    if (!ID_CANDIDAT.test(id)) {
      bloquants.push({ code: 'IDS_LOCK_INVALIDE', ligne: 1, id, message: `l'identifiant de candidat « ${id} » n'est pas valide : impossible de le verrouiller` });
    }
  }
  if (bloquants.length > 0) return { refus: bloquants };
  const existants = new Set(lock?.ids ?? []);
  const ajoutes = trier(candidats).filter((id) => !existants.has(id));
  return { texte: ecrireIdsLock([...existants, ...ajoutes]), ajoutes };
}
