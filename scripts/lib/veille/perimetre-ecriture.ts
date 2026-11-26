// Garde de périmètre d'écriture : filet appliqué au diff INDEXÉ avant tout commit de l'automate (T-10.3-34, T-10.3-37).
// Même en cas de bug de l'orchestrateur, rien ne part hors de la liste blanche, et jamais un texte_source, une archive,
// une mesure, une source, une décision existante de correspondances.yaml, ni une ligne ajoutée par gabarit qui contient
// un tiret long ou moyen ou un mot interdit. Les raisons citent des chemins, jamais le contenu des lignes.

import { motsInterdits } from '../../../src/lib/content-core/rules/text/forbidden.ts';
import type { Executer } from './alertes.ts';

export const CHEMINS_AUTORISES = [
  'data/import/',
  'data/dataset-datagouv.yaml',
  'data/couverture-themes.yaml',
  'src/content/candidats/',
  'src/content/couverture/',
  'relecture/',
  'ids.lock',
  'LICENSE',
] as const;

/** Fichiers dont les lignes ajoutées viennent des gabarits du code (le texte amont de data/import/ reste tel quel). */
export const FICHIERS_GABARITS = ['data/couverture-themes.yaml', 'src/content/couverture/', 'data/import/correspondances.yaml'] as const;

export type RaisonPerimetre = 'hors_liste' | 'archives' | 'mesures' | 'sources' | 'texte_source' | 'correspondances_existantes' | 'tiret' | 'mot_interdit' | 'suppression';

const CORRESPONDANCES = 'data/import/correspondances.yaml';
const correspond = (fichier: string, motifs: readonly string[]): boolean => motifs.some((m) => (m.endsWith('/') ? fichier.startsWith(m) : fichier === m));

export function verifierPerimetre(racine: string, executer: Executer): { ok: true } | { ok: false; raisons: { raison: RaisonPerimetre; fichier: string }[] } {
  const raisons: { raison: RaisonPerimetre; fichier: string }[] = [];
  const noter = (raison: RaisonPerimetre, fichier: string): void => {
    if (!raisons.some((r) => r.raison === raison && r.fichier === fichier)) raisons.push({ raison, fichier });
  };
  const git = (args: string[]): { ok: boolean; stdout: string } => {
    const r = executer('git', args, { cwd: racine, timeoutMs: 60_000 });
    return { ok: r.status === 0, stdout: r.stdout };
  };

  const liste = git(['diff', '--cached', '--no-renames', '--name-status', '-z']);
  if (!liste.ok) return { ok: false, raisons: [{ raison: 'hors_liste', fichier: '(diff indexé illisible)' }] };
  const parts = liste.stdout.split('\0').filter((p) => p !== '');
  const fichiers: string[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const statut = parts[i] as string;
    const fichier = parts[i + 1] as string;
    fichiers.push(fichier);
    if (statut.startsWith('D') || statut.startsWith('R')) noter('suppression', fichier);
  }

  for (const fichier of fichiers) {
    if (fichier.startsWith('archives/')) noter('archives', fichier);
    else if (fichier.startsWith('src/content/mesures/')) noter('mesures', fichier);
    else if (fichier.startsWith('src/content/sources/')) noter('sources', fichier);
    else if (!correspond(fichier, CHEMINS_AUTORISES)) noter('hors_liste', fichier);

    const d = git(['diff', '--cached', '-U0', '--no-color', '--', fichier]);
    if (!d.ok) {
      noter('hors_liste', fichier);
      continue;
    }
    const gabarit = correspond(fichier, FICHIERS_GABARITS);
    for (const ligne of d.stdout.split('\n')) {
      if (ligne.startsWith('+++') || ligne.startsWith('---')) continue;
      const signe = ligne[0];
      if (signe !== '+' && signe !== '-') continue;
      const corps = ligne.slice(1);
      if (fichier === CORRESPONDANCES && signe === '-') noter('correspondances_existantes', fichier);
      if (/\btexte_source:/.test(corps)) noter('texte_source', fichier);
      if (gabarit && signe === '+') {
        if (/[–—]/.test(corps)) noter('tiret', fichier);
        if (motsInterdits(corps, { exempterCitations: false }).length > 0) noter('mot_interdit', fichier);
      }
    }
  }
  return raisons.length === 0 ? { ok: true } : { ok: false, raisons };
}
