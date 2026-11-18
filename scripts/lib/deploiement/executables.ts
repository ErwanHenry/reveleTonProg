// Exécutables d'envoi figés et instantané d'intégrité locale (phase 9.2, D-05, risque §4.1 de la recherche).
// La build de déploiement tourne sous le même utilisateur Unix que la clé : ce que le profil sandbox-exec ne peut
// pas garantir à lui seul (une build qui modifierait les hooks git, la configuration git, un fichier de
// configuration, ou glisserait un binaire du même nom plus tôt dans le PATH) est constaté ici, par une empreinte
// prise avant la build et comparée après (puis après la confirmation, par le plan 06).
// Les différences ne nomment que des chemins ou des noms d'exécutables, jamais un contenu.
// N'importe que des modules node: et des modules relatifs.
import { createHash } from 'node:crypto';
import { accessSync, constants, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { empreinteArbre } from './empreinte.ts';
import { Sortie } from './gardes.ts';

export type Executables = Record<string, { chemin: string; empreinte: string }>;

export interface Instantane {
  /** sha256 de <racine>/.git/config, ou « absent ». */
  gitConfig: string;
  /** Empreinte de l'arbre <racine>/.git/hooks, ou « absent ». */
  gitHooks: string;
  /** sha256 de chaque fichier surveillé (clé : chemin donné), null s'il est absent. */
  fichiers: Record<string, string | null>;
  executables: Executables;
}

export interface OptionsInstantane {
  racine: string;
  fichiers: string[];
  executables: { noms: string[]; path: string };
}

const sha256 = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');

function estExecutable(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Premier fichier régulier exécutable du nom dans les dossiers du PATH (aucun shell, aucun which), ou null. */
function chercher(nom: string, chemin: string): string | null {
  if (path.isAbsolute(nom)) return estExecutable(nom) ? nom : null;
  if (nom.includes('/') || nom === '') return null;
  for (const dossier of chemin.split(':')) {
    if (dossier === '' || !path.isAbsolute(dossier)) continue;
    const p = path.join(dossier, nom);
    if (estExecutable(p)) return p;
  }
  return null;
}

/**
 * Chaque nom résolu en chemin réel (liens suivis) avec le sha256 du fichier. Un nom donné en chemin absolu
 * (RTP_RSYNC) est pris tel quel. Nom introuvable : Sortie code 2 qui le nomme.
 */
export function resoudreExecutables(noms: string[], chemin: string): Executables {
  const r: Executables = {};
  for (const nom of noms) {
    const trouve = chercher(nom, chemin);
    if (trouve === null) throw new Sortie(2, `exécutable introuvable dans le PATH : ${nom}`);
    const reel = realpathSync(trouve);
    r[nom] = { chemin: reel, empreinte: sha256(reel) };
  }
  return r;
}

function empreinteHooks(racine: string): string {
  const hooks = path.join(racine, '.git', 'hooks');
  let st;
  try {
    st = lstatSync(hooks);
  } catch {
    return 'absent';
  }
  if (!st.isDirectory()) throw new Sortie(2, `${hooks} n'est pas un dossier : instantané d'intégrité impossible`);
  // empreinteArbre refuse liens et fichiers spéciaux (un hook à plusieurs liens physiques reste admis ici).
  try {
    return empreinteArbre(hooks);
  } catch (e) {
    throw new Sortie(2, `.git/hooks illisible pour l'instantané d'intégrité (${e instanceof Error ? e.message : String(e)})`);
  }
}

function empreinteOuAbsent(p: string): string | null {
  try {
    if (!lstatSync(p).isFile()) return `non-fichier`;
  } catch {
    return null;
  }
  return sha256(p);
}

/** Instantané de .git/config, de .git/hooks, des fichiers surveillés et des exécutables résolus de nouveau. */
export function prendreInstantane(o: OptionsInstantane): Instantane {
  const executables: Executables = {};
  for (const nom of o.executables.noms) {
    const trouve = chercher(nom, o.executables.path);
    executables[nom] = trouve === null ? { chemin: 'absent', empreinte: '' } : { chemin: realpathSync(trouve), empreinte: sha256(realpathSync(trouve)) };
  }
  const fichiers: Record<string, string | null> = {};
  for (const f of o.fichiers) fichiers[f] = empreinteOuAbsent(f);
  return {
    gitConfig: empreinteOuAbsent(path.join(o.racine, '.git', 'config')) ?? 'absent',
    gitHooks: empreinteHooks(o.racine),
    fichiers,
    executables,
  };
}

/** Différences entre deux instantanés : chemins (« .git/config », « .git/hooks », fichier) ou « exécutable <nom> ». */
export function comparerInstantanes(a: Instantane, b: Instantane): string[] {
  const diff: string[] = [];
  if (a.gitConfig !== b.gitConfig) diff.push('.git/config');
  if (a.gitHooks !== b.gitHooks) diff.push('.git/hooks');
  for (const f of new Set([...Object.keys(a.fichiers), ...Object.keys(b.fichiers)])) {
    if (a.fichiers[f] !== b.fichiers[f]) diff.push(f);
  }
  for (const nom of new Set([...Object.keys(a.executables), ...Object.keys(b.executables)])) {
    const x = a.executables[nom];
    const y = b.executables[nom];
    if (x?.chemin !== y?.chemin || x?.empreinte !== y?.empreinte) diff.push(`exécutable ${nom}`);
  }
  return diff;
}

/** Arrêt si l'intégrité locale a changé : Sortie code 1 qui nomme les chemins, jamais les contenus. */
export function verifierIntegrite(avant: Instantane, apres: Instantane, moment = 'pendant la build'): void {
  const diff = comparerInstantanes(avant, apres);
  if (diff.length > 0) throw new Sortie(1, `intégrité locale modifiée ${moment} : ${diff.join(', ')} ; déploiement arrêté`);
}
