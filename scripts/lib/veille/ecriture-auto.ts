// Écriture par gabarits de ce que la liste de contrôle d'import (RUNBOOK, points 6 et 7) faisait faire à la main :
// ligne de correspondances.yaml, ligne de couverture, cases des thèmes pilotes, relecture des cases puis des statuts.
// Seul le code écrit. Aucune fonction ne reçoit de texte venu d'un agent : notes et relecteur sont des constantes,
// les seules valeurs variables sont des identifiants de fiche, des dates et des URL https (T-10.3-35, T-10.3-36).
// Tout se fait au texte (insertion ou retrait de lignes), jamais en re-sérialisant un fichier existant.

import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { dansPerimetre } from '../../../src/lib/content-core/rules/equite.ts';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';
import { THEMES_SPEC, lireCouverture } from '../couverture.ts';
import { lireCorrespondances } from '../datagouv.ts';
import { MODE_PILOTE } from '../pilote.ts';
import { marquer } from '../relecture/commandes/marquer.ts';
import { codeDansPerimetre } from '../relecture/etat.ts';
import type { Cible, Contexte } from '../relecture/etat.ts';
import { ajouterCorrespondance } from './decider.ts';
import type { LigneCorrespondanceAuto } from './identite.ts';

export const RELECTEUR_AGENT = "l'agent d'IA Claude";
export const NOTE_GABARIT = (date: string): string => `aucune source de programme lue au ${date} : voir urls_consultees`;

const FICHIER_CORRESPONDANCES = 'data/import/correspondances.yaml';
const FICHIER_COUVERTURE = 'data/couverture-themes.yaml';
const DOSSIER_CANDIDATS = 'src/content/candidats';
const DOSSIER_CASES = 'src/content/couverture';
const URLS_MAX = 5;

export class EcritureRefusee extends Error {}

function ecrire(fichier: string, texte: string): void {
  const tmp = path.join(path.dirname(fichier), `.${path.basename(fichier)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    writeFileSync(tmp, texte, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmp, fichier);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** Ajoute des lignes en fin de data/import/correspondances.yaml : ajout pur, refus d'un idAmont ou d'un id déjà présent. */
export function ecrireCorrespondances(racine: string, lignes: LigneCorrespondanceAuto[]): void {
  const fichier = path.join(racine, FICHIER_CORRESPONDANCES);
  const original = readFileSync(fichier, 'utf8');
  const existante = lireCorrespondances(lireYamlPlafonne(original, FICHIER_CORRESPONDANCES));
  const ids = new Set(Object.values(existante).map((e) => e.id));
  let texte = original;
  for (const l of lignes) {
    if (Object.hasOwn(existante, l.idAmont)) throw new EcritureRefusee(`correspondances : « ${l.idAmont} » existe déjà`);
    if (ids.has(l.entree.id)) throw new EcritureRefusee(`correspondances : l'identifiant « ${l.entree.id} » existe déjà`);
    ids.add(l.entree.id);
    texte = ajouterCorrespondance(texte, l.idAmont, l.entree);
  }
  lireCorrespondances(lireYamlPlafonne(texte, FICHIER_CORRESPONDANCES));
  if (!texte.startsWith(original)) throw new EcritureRefusee('correspondances : ajout non pur');
  ecrire(fichier, texte);
}

interface Fiche {
  id: string;
  nom_tri: string;
  statuts: unknown;
}

function lireFiches(racine: string): Fiche[] {
  const dir = path.join(racine, DOSSIER_CANDIDATS);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => parse(readFileSync(path.join(dir, f), 'utf8'), { schema: 'core' }) as Fiche);
}

/** Périmètre d'équité dans l'ordre nom_tri (collation française), comme l'exige le test du tableau de couverture. */
function perimetre(racine: string): { ids: string[]; nomTri: Map<string, string> } {
  const fiches = lireFiches(racine);
  const col = new Intl.Collator('fr');
  const nomTri = new Map(fiches.map((f) => [f.id, f.nom_tri]));
  const ids = fiches
    .filter((f) => dansPerimetre(f.statuts, MODE_PILOTE))
    .sort((a, b) => col.compare(a.nom_tri, b.nom_tri))
    .map((f) => f.id);
  return { ids, nomTri };
}

export function ecartsCouverture(racine: string): { aAjouter: string[]; aRetirer: string[] } {
  const { ids } = perimetre(racine);
  const { data } = lireCouverture(readFileSync(path.join(racine, FICHIER_COUVERTURE), 'utf8'));
  const presents = new Set(data.candidats.map((c) => c.id));
  const voulus = new Set(ids);
  return { aAjouter: ids.filter((i) => !presents.has(i)), aRetirer: data.candidats.map((c) => c.id).filter((i) => !voulus.has(i)) };
}

function urlsPropres(urls: string[] | undefined): string[] {
  const sorties: string[] = [];
  for (const u of urls ?? []) {
    if (!/^https:\/\/[^\s"'<>\\]+$/.test(u) || !URL.canParse(u) || sorties.includes(u)) continue;
    sorties.push(u);
    if (sorties.length === URLS_MAX) break;
  }
  return sorties;
}

function blocCouverture(id: string, urls: string[], date: string): string[] {
  const lignes = [`  - id: ${id}`, '    acces: aucun_site', '    urls_bloquees: []', '    sources: []', '    urls_consultees:'];
  for (const u of urls) lignes.push(`      - ${u}`);
  lignes.push('    cellules:');
  for (const t of THEMES_SPEC) lignes.push(`      ${t.id}:`, '        niveau: aucun', `        note: "${NOTE_GABARIT(date)}"`);
  return lignes;
}

/** Bornes (indices de lignes) de la section `candidats:` et des blocs `  - id:` qu'elle contient. */
function blocsCouverture(lignes: string[]): { fin: number; blocs: { id: string; debut: number; fin: number }[] } {
  const debut = lignes.indexOf('candidats:');
  if (debut < 0) throw new EcritureRefusee('couverture : section « candidats: » introuvable');
  let fin = lignes.length;
  for (let i = debut + 1; i < lignes.length; i++) {
    if (/^\S/.test(lignes[i] as string)) {
      fin = i;
      break;
    }
  }
  const starts: { id: string; debut: number }[] = [];
  for (let i = debut + 1; i < fin; i++) {
    const m = /^ {2}- id: (.+)$/.exec(lignes[i] as string);
    if (m) starts.push({ id: (m[1] as string).trim(), debut: i });
  }
  return { fin, blocs: starts.map((s, k) => ({ ...s, fin: k + 1 < starts.length ? (starts[k + 1] as { debut: number }).debut : fin })) };
}

/** Réaligne les lignes de data/couverture-themes.yaml sur le périmètre : retrait des sortants, gabarit pour les entrants. */
export function synchroniserCouverture(racine: string, urls: Record<string, string[]>, date: string): { ajoutes: string[]; retires: string[] } {
  const fichier = path.join(racine, FICHIER_COUVERTURE);
  const original = readFileSync(fichier, 'utf8');
  const { ids, nomTri } = perimetre(racine);
  const ecarts = ecartsCouverture(racine);
  const col = new Intl.Collator('fr');
  const propres = new Map<string, string[]>();
  for (const id of ecarts.aAjouter) {
    const u = urlsPropres(urls[id]);
    if (u.length === 0) throw new EcritureRefusee(`couverture : aucune URL https consultée pour ${id} (urls_consultees ne peut pas être vide)`);
    propres.set(id, u);
  }
  let lignes = original.split('\n');
  for (const id of ecarts.aRetirer) {
    const b = blocsCouverture(lignes).blocs.find((x) => x.id === id);
    if (b) lignes = [...lignes.slice(0, b.debut), ...lignes.slice(b.fin)];
  }
  for (const id of ecarts.aAjouter) {
    const { fin, blocs } = blocsCouverture(lignes);
    const mien = nomTri.get(id) as string;
    const suivant = blocs.find((b) => col.compare(nomTri.get(b.id) ?? '', mien) > 0);
    const position = suivant ? suivant.debut : fin;
    lignes = [...lignes.slice(0, position), ...blocCouverture(id, propres.get(id) as string[], date), ...lignes.slice(position)];
  }
  const texte = lignes.join('\n');
  const { data, problemes } = lireCouverture(texte);
  if (problemes.length > 0) throw new EcritureRefusee(`couverture : le résultat serait invalide (${problemes[0]})`);
  if (data.candidats.map((c) => c.id).join(',') !== ids.join(',')) throw new EcritureRefusee("couverture : l'ordre ou la liste des lignes ne suit pas le périmètre");
  if (texte !== original) ecrire(fichier, texte);
  return { ajoutes: ecarts.aAjouter, retires: ecarts.aRetirer };
}

/** Pour chaque thème, une case `programme_non_publie` pour toute personne du périmètre qui n'en a pas ; cases existantes intactes. */
export function ecrireCasesManquantes(racine: string, date: string): { theme: string; candidat: string }[] {
  const { ids, nomTri } = perimetre(racine);
  const col = new Intl.Collator('fr');
  const ecrites: { theme: string; candidat: string }[] = [];
  const sorties: [string, string][] = [];
  const dir = path.join(racine, DOSSIER_CASES);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()) {
    const fichier = path.join(dir, f);
    const original = readFileSync(fichier, 'utf8');
    const doc = parse(original, { schema: 'core' }) as { theme: string; cases?: { candidat: string }[] };
    const presents = new Set((doc.cases ?? []).map((c) => c.candidat));
    const manquants = ids.filter((i) => !presents.has(i));
    if (manquants.length === 0) continue;
    let lignes = original.split('\n');
    for (const id of manquants) {
      const debut = lignes.indexOf('cases:');
      if (debut < 0) throw new EcritureRefusee(`${f} : section « cases: » introuvable`);
      let fin = lignes.length;
      for (let i = debut + 1; i < lignes.length; i++) {
        if (/^\S/.test(lignes[i] as string)) {
          fin = i;
          break;
        }
      }
      const starts: { id: string; debut: number }[] = [];
      for (let i = debut + 1; i < fin; i++) {
        const m = /^ {2}- candidat: (.+)$/.exec(lignes[i] as string);
        if (m) starts.push({ id: (m[1] as string).trim(), debut: i });
      }
      const suivant = starts.find((s) => col.compare(nomTri.get(s.id) ?? '', nomTri.get(id) as string) > 0);
      let position: number;
      if (suivant) position = suivant.debut;
      else {
        position = fin;
        while (position > debut + 1 && (lignes[position - 1] as string).trim() === '') position -= 1;
      }
      lignes = [...lignes.slice(0, position), `  - candidat: ${id}`, '    etat: programme_non_publie', `    verifie_le: ${date}`, `    verifie_par: ${RELECTEUR_AGENT}`, ...lignes.slice(position)];
    }
    const texte = lignes.join('\n');
    const relu = parse(texte, { schema: 'core' }) as { cases: { candidat: string }[] };
    if (relu.cases.length !== (doc.cases ?? []).length + manquants.length) throw new EcritureRefusee(`${f} : le résultat serait invalide`);
    sorties.push([fichier, texte]);
    for (const id of manquants) ecrites.push({ theme: doc.theme, candidat: id });
  }
  for (const [fichier, texte] of sorties) ecrire(fichier, texte);
  return ecrites;
}

export type ResultatRelecture = { ok: true; relus: number } | { ok: false; refus: string; messages: string[] };

/** Relit les cases d'abord, les statuts ensuite, par la fonction marquer ; premier refus : arrêt. */
export function relireParAgent(
  racine: string,
  cibles: { cases: { theme: string; candidat: string }[]; statuts: { candidat: string; code: string }[] },
  date: string,
  maintenant: () => Date,
  marquerFn: typeof marquer = marquer,
): ResultatRelecture {
  const messages: string[] = [];
  const ctx: Contexte = { racine, schemasDir: path.join(racine, 'schemas'), sortie: (l) => messages.push(l), erreur: (l) => messages.push(l), maintenant };
  const liste: { cible: Cible; horsPerimetre: boolean; nom: string }[] = [
    ...cibles.cases.map((c) => ({ cible: { type: 'case', theme: c.theme, candidat: c.candidat } as Cible, horsPerimetre: false, nom: `case ${c.theme} ${c.candidat}` })),
    ...cibles.statuts.map((s) => ({ cible: { type: 'statut', candidat: s.candidat } as Cible, horsPerimetre: !codeDansPerimetre(s.code), nom: `statut ${s.candidat}` })),
  ];
  let relus = 0;
  for (const { cible, horsPerimetre, nom } of liste) {
    const code = marquerFn(cible, { relecteur: RELECTEUR_AGENT, date, malgreNote: false, horsPerimetre }, { ctx });
    if (code !== 0) return { ok: false, refus: nom, messages };
    relus += 1;
  }
  return { ok: true, relus };
}
