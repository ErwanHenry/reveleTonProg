// Module PUR (aucun accès disque ni réseau) : cohérence entre l'instantané data.gouv versionné, la
// table de correspondances et les fichiers candidats (IMP-02, D-04). La lecture des fichiers est dans
// instantane-depot.ts ; ici on ne compare que des objets.
//
// Ce qui est une ERREUR (npm test devient rouge, une ligne par écart) :
//   E1 `table`         une ligne amont dont l'identifiant n'est pas dans la table de correspondances
//   E2 `fiche`         une ligne amont dont la table désigne un identifiant sans fichier candidat
//   E3 `ids_externes`  un fichier dont ids_externes.2027etmoi n'est pas une clé de la table, ou dont
//                      la table désigne un autre identifiant
//   E4 `statut`        le couple (code, motif) du statut le plus récent du fichier diffère de l'amont
//   E5 `date`          même couple, mais la date du fichier est strictement postérieure à l'amont
//   E6 `instantane`    data/dataset-datagouv.yaml ne pointe pas l'instantané le plus récent
//                      (par mise_a_jour puis fetched_at : mise_a_jour seule n'est pas un marqueur de fraîcheur)
//
// Ce qui n'est qu'une INFORMATION (jamais un échec) :
//   I1 `source`          même couple (code, motif), source (URL) ou date différente : l'import garde
//                        volontairement l'ancienne source d'un statut inchangé (mergeFiche, « inchangé »).
//                        En faire une erreur rendrait la CI rouge à chaque import et on finirait par l'ignorer.
//   I2 `absent en amont` un fichier dont la clé amont est dans la table mais plus dans l'instantané : il
//                        ne cache aucune incohérence, la fiche et son identifiant verrouillé restent.
//   I3 `hors import`     un fichier sans ids_externes.2027etmoi : une personne ajoutée à la main.
//
// Le mapping et la règle du statut le plus récent sont ceux de l'import (datagouv.ts) : aucune seconde
// définition.
import { dateAvant, mapRow, statutLePlusRecent } from './datagouv.ts';
import type { Correspondance, UpstreamRow } from './datagouv.ts';

type Obj = Record<string, unknown>;

export interface InstantaneConnu {
  /** Chemin relatif du JSON, par exemple data/import/2027etmoi-candidats-2026-10-28-9f2fbc7930c0.json. */
  chemin: string;
  miseAJour: string;
  fetchedAt: string;
}

export interface EtatInstantane {
  rows: UpstreamRow[];
  table: Record<string, Correspondance>;
  fiches: Map<string, Obj>;
  /** Chemin pointé par data/dataset-datagouv.yaml. */
  pointeur: string;
  instantanes: InstantaneConnu[];
}

export interface Ecart {
  id: string;
  champ: string;
  fichier: string;
  amont: string;
}

export function formaterEcart(e: Ecart): string {
  return `${e.id} : ${e.champ} : fichier=${e.fichier} amont=${e.amont}`;
}

function couple(st: Obj): string {
  const code = String(st.code);
  return typeof st.motif === 'string' ? `${code}/${st.motif}` : code;
}

function parIdPuisChamp(a: Ecart, b: Ecart): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : a.champ < b.champ ? -1 : a.champ > b.champ ? 1 : 0;
}

/** Le plus récent par (mise_a_jour, fetched_at) ; à égalité totale, le dernier dans l'ordre des chemins. */
export function instantaneLePlusRecent(liste: readonly InstantaneConnu[]): InstantaneConnu | undefined {
  let meilleur: InstantaneConnu | undefined;
  for (const s of [...liste].sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))) {
    if (meilleur === undefined) {
      meilleur = s;
      continue;
    }
    const m = s.miseAJour.localeCompare(meilleur.miseAJour);
    if (m > 0 || (m === 0 && Date.parse(s.fetchedAt) >= Date.parse(meilleur.fetchedAt))) meilleur = s;
  }
  return meilleur;
}

export function comparerInstantane(etat: EtatInstantane): { erreurs: Ecart[]; infos: Ecart[] } {
  const erreurs: Ecart[] = [];
  const infos: Ecart[] = [];
  const clesAmont = new Set(etat.rows.map((r) => r.id));

  for (const row of etat.rows) {
    if (!Object.hasOwn(etat.table, row.id)) {
      erreurs.push({ id: row.id, champ: 'table', fichier: 'absent de data/import/correspondances.yaml', amont: 'présent dans l’instantané' });
      continue;
    }
    const id = etat.table[row.id]!.id;
    const fiche = etat.fiches.get(id);
    if (fiche === undefined) {
      erreurs.push({ id, champ: 'fiche', fichier: 'aucun fichier src/content/candidats', amont: `ligne ${row.id}` });
      continue;
    }
    const statuts = fiche.statuts;
    if (!Array.isArray(statuts) || statuts.length === 0) {
      erreurs.push({ id, champ: 'statut', fichier: 'aucun statut lisible', amont: couple((mapRow(row, etat.table).statuts as Obj[])[0]!) });
      continue;
    }
    const amont = (mapRow(row, etat.table).statuts as Obj[])[0]!;
    const dernier = statutLePlusRecent(statuts);
    if (couple(dernier) !== couple(amont)) {
      erreurs.push({ id, champ: 'statut', fichier: couple(dernier), amont: couple(amont) });
      continue;
    }
    const dateFichier = String(dernier.date);
    const dateAmont = String(amont.date);
    if (dateAvant(dateAmont, dateFichier)) {
      erreurs.push({ id, champ: 'date', fichier: dateFichier, amont: dateAmont });
      continue;
    }
    const urlFichier = String(((dernier.source ?? {}) as Obj).url);
    const urlAmont = String(((amont.source ?? {}) as Obj).url);
    if (dateAvant(dateFichier, dateAmont) || urlFichier !== urlAmont) {
      infos.push({
        id,
        champ: 'source',
        fichier: `${urlFichier} (${dateFichier})`,
        amont: `${urlAmont} (${dateAmont}) : même statut, source non appliquée`,
      });
    }
  }

  for (const [id, fiche] of etat.fiches) {
    const externes = fiche.ids_externes;
    const cle = typeof externes === 'object' && externes !== null ? (externes as Obj)['2027etmoi'] : undefined;
    if (typeof cle !== 'string') {
      infos.push({ id, champ: 'hors import', fichier: 'pas d’ids_externes.2027etmoi', amont: 'sans objet' });
      continue;
    }
    if (!Object.hasOwn(etat.table, cle)) {
      erreurs.push({ id, champ: 'ids_externes', fichier: cle, amont: 'clé absente de la table de correspondances' });
      continue;
    }
    const attendu = etat.table[cle]!.id;
    if (attendu !== id) {
      erreurs.push({ id, champ: 'ids_externes', fichier: cle, amont: `la table désigne ${attendu}` });
      continue;
    }
    if (!clesAmont.has(cle)) {
      infos.push({ id, champ: 'absent en amont', fichier: cle, amont: 'absent de l’instantané' });
    }
  }

  const recent = instantaneLePlusRecent(etat.instantanes);
  if (recent !== undefined && recent.chemin !== etat.pointeur) {
    erreurs.push({ id: 'data/dataset-datagouv.yaml', champ: 'instantane', fichier: etat.pointeur, amont: recent.chemin });
  }

  erreurs.sort(parIdPuisChamp);
  infos.sort(parIdPuisChamp);
  return { erreurs, infos };
}
