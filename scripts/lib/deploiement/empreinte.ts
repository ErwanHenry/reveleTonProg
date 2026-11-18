// Empreinte de l'arbre de la build de déploiement et refus des fichiers spéciaux (revue de code CR-01, phase 9.2,
// D-05). Reproduit en TypeScript le calcul du job deploy de .github/workflows/ci.yml :
//   (cd dist && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum) | sha256sum
// soit, pour chaque fichier régulier trié par les octets UTF-8 de son chemin « ./rel/chemin », la ligne
// « <hex>  ./rel/chemin\n », puis le sha256 de ce texte (arbre vide : sha256 de la chaîne vide).
// Le parcours se fait avec node:fs (lstat, aucun lien suivi), jamais avec le find du shell.
// trouverSpecial reprend le refus du job deploy (« find dist ! -type f ! -type d ») et celui du serveur (code 65 :
// fichier régulier à plusieurs liens physiques). normaliserModes remplace --chmod=D755,F644, refusé par openrsync.
// N'importe que des modules node: (le processus qui tiendra la clé l'importe).
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, readdirSync, readFileSync, type Stats } from 'node:fs';
import path from 'node:path';

interface Entree {
  /** Chemin relatif « a/b.html », séparateur « / ». */
  rel: string;
  abs: string;
}

/** Parcours en profondeur sans suivre de lien ; rappelle visiter pour chaque entrée (dossiers compris). */
function parcourir(racine: string, visiter: (e: Entree, st: Stats) => 'descendre' | 'arreter' | void): void {
  const pile: string[] = [''];
  while (pile.length > 0) {
    const relDossier = pile.pop() as string;
    const absDossier = relDossier === '' ? racine : path.join(racine, relDossier);
    const noms = readdirSync(absDossier).sort();
    for (const nom of noms) {
      const rel = relDossier === '' ? nom : `${relDossier}/${nom}`;
      const abs = path.join(absDossier, nom);
      const st = lstatSync(abs);
      const suite = visiter({ rel, abs }, st);
      if (suite === 'arreter') return;
      if (st.isDirectory() && suite === 'descendre') pile.push(rel);
    }
  }
}

/**
 * Première entrée de l'arbre qui n'est ni un fichier régulier ni un dossier (lien symbolique, même cassé, FIFO,
 * socket, périphérique), ou fichier régulier à plusieurs liens physiques ; chemin relatif, ou null.
 */
export function trouverSpecial(d: string): string | null {
  let trouve: string | null = null;
  parcourir(d, (e, st) => {
    if (st.isDirectory()) return 'descendre';
    if (!st.isFile() || st.nlink > 1) {
      trouve = e.rel;
      return 'arreter';
    }
    return undefined;
  });
  return trouve;
}

const NOM_AMBIGU = /[\n\\]/;

/**
 * Empreinte de l'arbre, identique au pipeline de ci.yml. Lève une erreur sur un lien ou un fichier spécial (que le
 * pipeline ignorerait en silence) et sur un nom qui contient un saut de ligne ou une barre oblique inverse (que
 * sha256sum échapperait) : appeler trouverSpecial avant pour un message propre.
 */
export function empreinteArbre(d: string): string {
  const fichiers: Entree[] = [];
  parcourir(d, (e, st) => {
    if (st.isDirectory()) return 'descendre';
    if (st.isSymbolicLink()) throw new Error(`empreinte refusée : lien symbolique ${e.rel}`);
    if (!st.isFile()) throw new Error(`empreinte refusée : fichier spécial ${e.rel}`);
    if (NOM_AMBIGU.test(e.rel)) throw new Error(`empreinte refusée : nom avec saut de ligne ou barre oblique inverse ${JSON.stringify(e.rel)}`);
    fichiers.push(e);
    return undefined;
  });
  const avecCle = fichiers.map((f) => ({ ...f, cle: Buffer.from(`./${f.rel}`, 'utf8') }));
  avecCle.sort((a, b) => Buffer.compare(a.cle, b.cle));
  const global = createHash('sha256');
  for (const f of avecCle) {
    const hex = createHash('sha256').update(readFileSync(f.abs)).digest('hex');
    global.update(`${hex}  ./${f.rel}\n`, 'utf8');
  }
  return global.digest('hex');
}

/** Dossiers en 0755 et fichiers en 0644, racine comprise ; les liens ne sont pas touchés (trouverSpecial les refuse). */
export function normaliserModes(d: string): void {
  chmodSync(d, 0o755);
  parcourir(d, (e, st) => {
    if (st.isDirectory()) {
      chmodSync(e.abs, 0o755);
      return 'descendre';
    }
    if (st.isFile()) chmodSync(e.abs, 0o644);
    return undefined;
  });
}
