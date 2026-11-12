// Seule lecture disque de la cohérence D-04 : instantané versionné, table de correspondances, fichiers
// candidats et pointeur de data/dataset-datagouv.yaml. Tout YAML passe par l'analyseur plafonné (IMP-01).
// Toute lecture refusée lève une Error qui nomme le fichier : jamais d'état partiel.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadDatasetDatagouv } from '../../src/lib/dataset-datagouv.ts';
import { readContained } from '../../src/lib/content-core/contained.ts';
import { lireYamlPlafonne } from '../../src/lib/content-core/yaml-plafonne.ts';
import { checkUpstream, lireCorrespondances } from './datagouv.ts';
import type { EtatInstantane, InstantaneConnu } from './instantane.ts';

function lireJson(fichier: string, relatif: string): Record<string, unknown> {
  try {
    const v = JSON.parse(readFileSync(fichier, 'utf8')) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('objet attendu');
    return v as Record<string, unknown>;
  } catch (e) {
    throw new Error(`${relatif} illisible : ${(e as Error).message}`);
  }
}

export function chargerEtatDepot(racine: string): EtatInstantane {
  const dossierImport = path.join(racine, 'data', 'import');

  const pointeur = loadDatasetDatagouv(racine).instantane.chemin;

  const instantanes: InstantaneConnu[] = [];
  for (const nom of readdirSync(dossierImport).filter((n) => /^2027etmoi-candidats-.*\.meta\.json$/.test(n)).sort()) {
    const relatif = `data/import/${nom}`;
    const meta = lireJson(path.join(dossierImport, nom), relatif);
    if (typeof meta.mise_a_jour !== 'string' || typeof meta.fetched_at !== 'string' || Number.isNaN(Date.parse(meta.fetched_at))) {
      throw new Error(`${relatif} : mise_a_jour ou fetched_at absent ou invalide`);
    }
    instantanes.push({ chemin: `data/import/${nom.replace(/\.meta\.json$/, '.json')}`, miseAJour: meta.mise_a_jour, fetchedAt: meta.fetched_at });
  }

  let rows;
  try {
    rows = checkUpstream(JSON.parse(readFileSync(path.join(racine, pointeur), 'utf8'))).rows;
  } catch (e) {
    throw new Error(`${pointeur} illisible : ${(e as Error).message}`);
  }

  const fichierTable = 'data/import/correspondances.yaml';
  let table;
  try {
    const parsed = lireYamlPlafonne(readFileSync(path.join(racine, fichierTable), 'utf8'), fichierTable);
    table = lireCorrespondances(parsed);
  } catch (e) {
    throw new Error(`${fichierTable} refusé : ${(e as Error).message}`);
  }

  const dossierCandidats = path.join(racine, 'src', 'content', 'candidats');
  const fiches = new Map<string, Record<string, unknown>>();
  for (const nom of readdirSync(dossierCandidats).filter((n) => n.endsWith('.yaml')).sort()) {
    const relatif = `src/content/candidats/${nom}`;
    const lu = readContained(path.join(racine, 'src', 'content'), path.join(dossierCandidats, nom));
    if ('diagnostic' in lu) throw new Error(`${relatif} refusé : ${lu.diagnostic.message}`);
    let fiche: Record<string, unknown>;
    try {
      fiche = lireYamlPlafonne(lu.text, relatif);
    } catch (e) {
      throw new Error(`${relatif} refusé : ${(e as Error).message}`);
    }
    fiches.set(typeof fiche.id === 'string' ? fiche.id : nom.replace(/\.yaml$/, ''), fiche);
  }

  return { rows, table, fiches, pointeur, instantanes };
}
