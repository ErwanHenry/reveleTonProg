// Lecteur strict de fichiers CLE=valeur hors dépôt (phase 10.3, D-03 et moyen de push).
//
// Les fichiers de ~/.config/rtp/ ne sont jamais lus par un shell : ce module les lit ligne à ligne, sans expansion,
// sans `export`, et refuse toute clé inconnue. Les messages d'erreur nomment des clés, des numéros de ligne et des
// chemins, jamais une valeur. Mêmes règles que scripts/lib/deploiement/config.ts (non modifié ici).
// N'importe que des modules node:.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export class ErreurConfigLocale extends Error {
  readonly erreurs: string[];
  constructor(fichier: string, erreurs: string[]) {
    super(`fichier de configuration refusé (${fichier}) :\n${erreurs.map((e) => `- ${e}`).join('\n')}`);
    this.name = 'ErreurConfigLocale';
    this.erreurs = erreurs;
  }
}

const LIGNE = /^([A-Z_][A-Z0-9_]*)=(.*)$/;

/**
 * Lit un fichier de clés. Rend les valeurs brutes (guillemets doubles extérieurs retirés, `~/` développé avec
 * `home`). Toute anomalie : ErreurConfigLocale qui liste chaque cause, sans aucune valeur du fichier.
 */
export function lireFichierCles(fichier: string, clesConnues: readonly string[], home: string): Map<string, string> {
  let texte: string;
  try {
    texte = readFileSync(fichier, 'utf8');
  } catch {
    throw new ErreurConfigLocale(fichier, [`fichier absent ou illisible : ${fichier} ; le créer en mode 0600 (clés connues : ${clesConnues.join(', ')})`]);
  }

  const erreurs: string[] = [];
  const st = statSync(fichier);
  if (!st.isFile()) erreurs.push(`${fichier} n'est pas un fichier régulier`);
  else if ((st.mode & 0o077) !== 0) {
    erreurs.push(`${fichier} : mode ${(st.mode & 0o777).toString(8).padStart(4, '0')}, attendu sans droit pour le groupe ni les autres (chmod 600)`);
  }

  const connues = new Set<string>(clesConnues);
  const valeurs = new Map<string, string>();
  texte.split(/\r?\n/).forEach((ligne, i) => {
    const n = i + 1;
    const t = ligne.trim();
    if (t === '' || t.startsWith('#')) return;
    if (/^export\s/.test(t)) {
      erreurs.push(`ligne ${n} : pas d'export, forme attendue CLE=valeur`);
      return;
    }
    const m = LIGNE.exec(ligne);
    if (m === null) {
      erreurs.push(`ligne ${n} : forme attendue CLE=valeur (clé en majuscules, sans espace autour de =)`);
      return;
    }
    const cle = m[1] ?? '';
    if (!connues.has(cle)) {
      erreurs.push(`ligne ${n} : clé inconnue : ${cle}`);
      return;
    }
    let valeur = m[2] ?? '';
    if (valeur.length >= 2 && valeur.startsWith('"') && valeur.endsWith('"')) valeur = valeur.slice(1, -1);
    if (/[$`]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : pas d'expansion de shell ($ ou \`), valeur littérale attendue`);
      return;
    }
    if (/["'\\]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : guillemet ou barre oblique inverse inattendus`);
      return;
    }
    if (/[\u0000-\u001f\u007f]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : caractère de contrôle refusé`);
      return;
    }
    if (valeurs.has(cle)) {
      erreurs.push(`ligne ${n} : ${cle} est donnée plusieurs fois`);
      return;
    }
    valeurs.set(cle, valeur.startsWith('~/') ? path.join(home, valeur.slice(2)) : valeur);
  });

  if (erreurs.length > 0) throw new ErreurConfigLocale(fichier, erreurs);
  return valeurs;
}
