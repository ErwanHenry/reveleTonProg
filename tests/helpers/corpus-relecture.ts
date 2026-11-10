import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { materialiserCorpusM1, nettoyerCorpusM1 } from './corpus-m1.ts';
import { REPO_ROOT } from './validate-yaml.ts';

// Corpus de relecture : le corpus fictif M1 copié dans une racine temporaire, sur laquelle l'outil
// `scripts/relecture.ts` est lancé comme processus enfant avec `--root`. Rien n'est jamais écrit dans le dépôt.

export const SCRIPT_RELECTURE = path.join(REPO_ROOT, 'scripts', 'relecture.ts');

export interface Resultat {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CorpusRelecture {
  racine: string;
  /** Lance `node scripts/relecture.ts --root <racine> ...args` depuis la racine du dépôt. */
  lancer(...args: string[]): Resultat;
  /** Chemin absolu d'un fichier du corpus temporaire (chemin POSIX relatif à la racine). */
  chemin(relatif: string): string;
  lire(relatif: string): string;
  ecrire(relatif: string, texte: string): void;
  /** Octets de tous les fichiers sous src/content, par chemin relatif. */
  arbre(): Map<string, string>;
}

export function corpusRelecture(): CorpusRelecture {
  const racine = materialiserCorpusM1();
  const chemin = (relatif: string): string => path.join(racine, ...relatif.split('/'));
  const arbre = (): Map<string, string> => {
    const out = new Map<string, string>();
    const parcourir = (dossier: string): void => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const plein = path.join(dossier, e.name);
        if (e.isDirectory()) parcourir(plein);
        else out.set(path.relative(racine, plein).split(path.sep).join('/'), readFileSync(plein, 'latin1'));
      }
    };
    parcourir(path.join(racine, 'src', 'content'));
    return out;
  };
  return {
    racine,
    lancer: (...args) => {
      const r = spawnSync(process.execPath, [SCRIPT_RELECTURE, '--root', racine, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Paris' } });
      return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
    },
    chemin,
    lire: (relatif) => readFileSync(chemin(relatif), 'utf8'),
    ecrire: (relatif, texte) => writeFileSync(chemin(relatif), texte),
    arbre,
  };
}

export { nettoyerCorpusM1 as nettoyerCorpusRelecture };

/** Lance l'outil sans `--root` depuis un dossier donné (contrôle du refus sous tests/fixtures). */
export function lancerDepuis(cwd: string, ...args: string[]): Resultat {
  const r = spawnSync(process.execPath, [SCRIPT_RELECTURE, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
