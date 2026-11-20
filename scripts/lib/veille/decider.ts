// Veille des candidatures (phase 10.1) : `npm run veille -- decider <id-amont>`.
//
// Les décisions sur une personne (ligne de data/import/correspondances.yaml : identifiant de fiche, prénom, nom,
// nom_tri, type de source, motif d'un désistement) sont tapées par Erwan, sur le terminal de contrôle (/dev/tty).
// Sans terminal (agent, tâche planifiée, processus détaché), la commande refuse avant toute autre action : aucun
// agent ne peut répondre à sa place. Aucune valeur n'est devinée ni préremplie à partir du nom amont.
//
// L'entrée est écrite dans le worktree d'import (branche import/…) seulement, jamais dans le dossier de travail
// principal : la décision entre dans le dépôt par la pull request d'import, relue.
import { closeSync, openSync, readFileSync, readSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { lireYamlPlafonne } from '../../../src/lib/content-core/yaml-plafonne.ts';
import { lireCorrespondances } from '../datagouv.ts';
import { MOTIFS_RENONCEMENT } from '../rapport-import.ts';

export const TYPES_SOURCE = ['candidat', 'parti', 'institution', 'presse'] as const;
const ID_CANDIDAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const SAISIE_MAX = 200;

export class RefusDecider extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export interface Terminal {
  ecrire: (texte: string) => void;
  lireLigne: () => string;
  fermer: () => void;
}

/** Terminal de contrôle du processus. Absent : refus (code 3), sans rien lire ni écrire d'autre. */
export function ouvrirTerminal(): Terminal {
  let fd: number;
  try {
    fd = openSync('/dev/tty', 'r+');
  } catch {
    throw new RefusDecider(3, 'aucun terminal : une décision sur une personne est tapée par Erwan dans un terminal, jamais par un agent ni une tâche planifiée');
  }
  return {
    ecrire: (t) => {
      writeSync(fd, t);
    },
    lireLigne: () => {
      const octets: number[] = [];
      const tampon = Buffer.alloc(1);
      for (;;) {
        let n: number;
        try {
          n = readSync(fd, tampon, 0, 1, null);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'EAGAIN') continue;
          throw new RefusDecider(3, 'lecture du terminal impossible : rien n’a été écrit');
        }
        if (n === 0) throw new RefusDecider(3, 'saisie interrompue : rien n’a été écrit');
        const o = tampon[0] as number;
        if (o === 0x0a) break;
        octets.push(o);
        if (octets.length > SAISIE_MAX) throw new RefusDecider(2, 'saisie trop longue : rien n’a été écrit');
      }
      return Buffer.from(octets).toString('utf8').replace(/\r$/, '').trim();
    },
    fermer: () => closeSync(fd),
  };
}

export interface LigneAmont {
  id: string;
  nom: string;
  statut: string;
  source: { url: string; date: string };
  statut_detail?: string;
}

/** Ligne amont du jeu gardé par la veille (octets dont l'empreinte a été vérifiée par l'appelant). */
export function ligneAmont(octets: Buffer, idAmont: string): LigneAmont {
  const j = JSON.parse(octets.toString('utf8')) as { candidats?: LigneAmont[] };
  const l = (j.candidats ?? []).find((c) => c.id === idAmont);
  if (l === undefined) throw new RefusDecider(2, `identifiant amont « ${idAmont.slice(0, 60)} » absent du dernier jeu lu par la veille`);
  return l;
}

/** Scalaire YAML : forme simple pour un texte ordinaire, sinon chaîne entre guillemets (JSON est du YAML valide). */
function scalaire(v: string): string {
  return /^[\p{L}][\p{L}\p{M}' .-]*$/u.test(v) && !/^(true|false|yes|no|on|off|null|~)$/i.test(v) && !v.endsWith(' ') ? v : JSON.stringify(v);
}

/** Texte de la table avec une nouvelle ligne de correspondance ajoutée en fin. */
export function ajouterCorrespondance(texte: string, idAmont: string, e: { id: string; prenom: string; nom: string; nom_tri: string; motif?: string; type_source_statut: string }): string {
  const lignes = [`  ${idAmont}:`, `    id: ${e.id}`, `    prenom: ${scalaire(e.prenom)}`, `    nom: ${scalaire(e.nom)}`, `    nom_tri: ${scalaire(e.nom_tri)}`];
  if (e.motif !== undefined) lignes.push(`    motif: ${e.motif}`);
  lignes.push(`    type_source_statut: ${e.type_source_statut}`);
  return `${texte.endsWith('\n') ? texte : `${texte}\n`}${lignes.join('\n')}\n`;
}

/** Texte de la table où la ligne `idAmont` (sans motif) reçoit un motif, placé avant type_source_statut. */
export function ajouterMotif(texte: string, idAmont: string, motif: string): string {
  const lignes = texte.split('\n');
  const debut = lignes.findIndex((l) => l === `  ${idAmont}:`);
  if (debut < 0) throw new RefusDecider(2, `ligne « ${idAmont} » introuvable dans correspondances.yaml`);
  let i = debut + 1;
  while (i < lignes.length && /^ {4}\S/.test(lignes[i] as string)) {
    if (/^ {4}motif:/.test(lignes[i] as string)) throw new RefusDecider(2, `la ligne « ${idAmont} » a déjà un motif : le changer est une correction à faire à la main, relue`);
    if (/^ {4}type_source_statut:/.test(lignes[i] as string)) break;
    i += 1;
  }
  lignes.splice(i, 0, `    motif: ${motif}`);
  return lignes.join('\n');
}

function demander(t: Terminal, question: string, valide: (v: string) => string | null): string {
  for (let essai = 0; essai < 3; essai++) {
    t.ecrire(`${question}\n> `);
    const v = t.lireLigne();
    const erreur = valide(v);
    if (erreur === null) return v;
    t.ecrire(`refusé : ${erreur}\n`);
  }
  throw new RefusDecider(2, 'trois saisies refusées : rien n’a été écrit');
}
const nonVide = (v: string): string | null => (v === '' ? 'valeur vide' : /[–—]/.test(v) ? 'tiret long ou demi-long interdit' : null);
const dansListe = (liste: readonly string[]) => (v: string): string | null => (liste.includes(v) ? null : `une valeur parmi ${liste.join(', ')}`);

export interface ResultatDecider {
  fichier: string;
  ajout: 'correspondance' | 'motif';
}

/**
 * Pose les questions sur le terminal et écrit la décision dans `racineImport`/data/import/correspondances.yaml.
 * L'appelant a déjà vérifié que `racineImport` est un worktree d'import (branche import/…).
 */
export function decider(t: Terminal, racineImport: string, amont: LigneAmont): ResultatDecider {
  const fichier = path.join(racineImport, 'data', 'import', 'correspondances.yaml');
  const texte = readFileSync(fichier, 'utf8');
  const table = lireCorrespondances(lireYamlPlafonne(texte, 'data/import/correspondances.yaml'));
  const connue = table[amont.id];
  t.ecrire(
    [
      '',
      'Décision sur une personne : vous seul la prenez, d’après la source primaire que vous avez lue.',
      `Faits amont (jeu data.gouv, non relus) : identifiant ${amont.id}, nom public « ${amont.nom} », statut ${amont.statut} du ${amont.source.date}, source ${amont.source.url}`,
      ...(amont.statut_detail !== undefined && amont.statut_detail !== '' ? [`Texte amont non relu : ${amont.statut_detail.slice(0, 400)}`] : []),
      '',
    ].join('\n'),
  );

  let nouveau: string;
  let ajout: ResultatDecider['ajout'];
  if (connue !== undefined) {
    if (amont.statut !== 'renonce') throw new RefusDecider(2, `« ${amont.id} » a déjà sa ligne et son statut amont (${amont.statut}) ne demande pas de motif : rien à décider`);
    if (connue.motif !== undefined) throw new RefusDecider(2, `« ${amont.id} » a déjà le motif ${connue.motif} : le changer est une correction à faire à la main, relue`);
    t.ecrire(`Ligne existante : fiche ${connue.id}. Seul le motif du désistement manque.\n`);
    const motif = demander(t, `Motif du désistement (${MOTIFS_RENONCEMENT.join(', ')}) ; « ralliement » pour un désistement au profit d’une autre candidature :`, dansListe(MOTIFS_RENONCEMENT));
    nouveau = ajouterMotif(texte, amont.id, motif);
    ajout = 'motif';
  } else {
    const ids = new Set(Object.values(table).map((c) => c.id));
    const id = demander(t, 'Identifiant de fiche (minuscules et tirets, par exemple prenom-nom) :', (v) => (!ID_CANDIDAT.test(v) || v.length > 80 ? 'forme prenom-nom attendue' : ids.has(v) ? 'identifiant déjà utilisé' : null));
    const prenom = demander(t, 'Prénom :', nonVide);
    const nom = demander(t, 'Nom :', nonVide);
    const nomTri = demander(t, 'Nom de tri (nom_tri) :', nonVide);
    const type = demander(t, `Type de la source du statut (${TYPES_SOURCE.join(', ')}) :`, dansListe(TYPES_SOURCE));
    const motif = amont.statut === 'renonce' ? demander(t, `Motif du désistement (${MOTIFS_RENONCEMENT.join(', ')}) :`, dansListe(MOTIFS_RENONCEMENT)) : undefined;
    nouveau = ajouterCorrespondance(texte, amont.id, { id, prenom, nom, nom_tri: nomTri, type_source_statut: type, ...(motif !== undefined ? { motif } : {}) });
    ajout = 'correspondance';
  }

  // La table modifiée doit se relire avec le même lecteur que l'import, avant toute écriture.
  lireCorrespondances(lireYamlPlafonne(nouveau, 'data/import/correspondances.yaml'));
  const lignes = nouveau.split('\n');
  const debut = lignes.indexOf(`  ${amont.id}:`);
  let fin = debut + 1;
  while (fin < lignes.length && /^ {4}\S/.test(lignes[fin] as string)) fin += 1;
  const ajoute = lignes.slice(debut, fin);
  t.ecrire(`\nÀ écrire dans ${fichier} :\n${ajoute.join('\n')}\n`);
  const ok = demander(t, 'Écrire cette décision ? Tapez « oui » pour écrire, autre chose pour abandonner :', () => null);
  if (ok !== 'oui') throw new RefusDecider(1, 'abandon : rien n’a été écrit');
  writeFileSync(fichier, nouveau);
  return { fichier, ajout };
}
