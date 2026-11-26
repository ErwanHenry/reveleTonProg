// Règles fixes D-02 (phase 10.3) : pour une nouvelle personne du jeu public, la ligne de data/import/correspondances.yaml
// (identifiant de fiche, prénom, nom, nom de tri) est dérivée sans texte libre ni agent. Au moindre doute : refus
// `identite_ambigue`, jamais une ligne devinée. Module pur (seul idsPris lit le disque).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';
import { lireCorrespondances } from '../datagouv.ts';

export const ID_CANDIDAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
/** Particules en minuscules : gardées dans `nom`, retirées de `nom_tri`. « Le » (majuscule) est un mot du nom. */
export const PARTICULES = ['de', 'du', 'des', "d'", 'von', 'van', 'der', 'den', 'ben', 'el', 'al'] as const;
const ID_MAX = 80;
// Tirets long et moyen écrits par échappements : la règle projet les interdit dans le dépôt.
const TIRET_LONG_OU_MOYEN = /[–—]/;
const ALPHABET = /^[\p{L}\p{M}' ’-]+$/u;

export interface Identite {
  id: string;
  prenom: string;
  nom: string;
  nom_tri: string;
}
export type RefusIdentite = { refus: 'identite_ambigue'; raison: string };

const refus = (raison: string): RefusIdentite => ({ refus: 'identite_ambigue', raison });

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’\s]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Retire les particules minuscules de tête (mot entier, ou préfixe « d' » collé au mot). */
function sansParticules(mots: readonly string[]): string[] {
  const out = [...mots];
  for (;;) {
    const m = out[0];
    if (m === undefined || out.length < 2 && !/^d['’]./.test(m)) break;
    if ((PARTICULES as readonly string[]).includes(m) && out.length > 1) {
      out.shift();
      continue;
    }
    const d = /^d['’](.+)$/.exec(m);
    if (d !== null) {
      out[0] = d[1] as string;
      continue;
    }
    break;
  }
  return out;
}

function estParticule(m: string): boolean {
  return (PARTICULES as readonly string[]).includes(m);
}

export function deriverIdentite(ligne: { id: string; nom: string }, pris: ReadonlySet<string>): Identite | RefusIdentite {
  const brut = ligne.nom;
  if (TIRET_LONG_OU_MOYEN.test(brut)) return refus('tiret long ou moyen dans le nom');
  if (!ALPHABET.test(brut)) return refus('caractère hors lettres, espace, trait d’union et apostrophe');
  const mots = brut.split(' ');
  if (mots.some((m) => m === '')) return refus('espaces en double, en tête ou en queue');
  if (mots.length < 2) return refus('un seul mot : prénom et nom indistinguables');
  if (mots.length > 5) return refus('plus de 5 mots');
  for (const m of mots) {
    const lettres = m.replace(/['’-]/g, '');
    if (lettres.length >= 2 && lettres === lettres.toUpperCase() && lettres !== lettres.toLowerCase()) return refus('mot entièrement en majuscules');
  }
  const ks: number[] = [];
  for (let k = 1; k < mots.length; k++) {
    const reste = mots.slice(k);
    if (slug(reste.join(' ')) === ligne.id || slug(sansParticules(reste).join(' ')) === ligne.id) ks.push(k);
  }
  let k: number;
  if (ks.length === 0) return refus('aucun découpage prénom et nom ne correspond à l’identifiant amont');
  if (ks.length === 1) k = ks[0] as number;
  else {
    // Plusieurs découpages : admis seulement s'ils ne diffèrent que par des particules minuscules de tête.
    const plus = Math.max(...ks);
    const moins = Math.min(...ks);
    const entre = mots.slice(moins, plus);
    if (!entre.every(estParticule) || ks.length !== plus - moins + 1) return refus('plusieurs découpages possibles');
    k = moins;
  }
  const prenom = mots.slice(0, k).join(' ');
  const nomMots = mots.slice(k);
  const nom = nomMots.join(' ');
  const nom_tri = sansParticules(nomMots).join(' ');
  const id = slug(`${prenom} ${nom}`);
  if (!ID_CANDIDAT.test(id) || id.length > ID_MAX) return refus('identifiant de fiche dérivé invalide');
  if (pris.has(id)) return refus('identifiant de fiche déjà pris (homonyme)');
  return { id, prenom, nom, nom_tri };
}

/** Identifiants déjà pris : table de correspondances, ids.lock, fiches existantes. */
export function idsPris(racine: string): Set<string> {
  const pris = new Set<string>();
  const table = path.join(racine, 'data/import/correspondances.yaml');
  if (existsSync(table)) {
    for (const c of Object.values(lireCorrespondances(lireYamlPlafonne(readFileSync(table, 'utf8'), 'correspondances.yaml')))) pris.add(c.id);
  }
  const lock = path.join(racine, 'ids.lock');
  if (existsSync(lock)) {
    for (const l of readFileSync(lock, 'utf8').split('\n')) {
      const t = l.trim();
      if (t !== '' && !t.startsWith('#')) pris.add(t);
    }
  }
  const dossier = path.join(racine, 'src/content/candidats');
  if (existsSync(dossier)) {
    for (const f of readdirSync(dossier)) if (f.endsWith('.yaml')) pris.add(f.slice(0, -'.yaml'.length));
  }
  return pris;
}
