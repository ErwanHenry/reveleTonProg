// Empreintes CSP des scripts inclus dans les pages (PERF-01, D-07, ADR-056). Un seul calcul, partagé par
// astro.config.mjs (security.csp.scriptDirective.hashes), check-dist (identité et appartenance à la CSP) et le
// rendu de l'en-tête Caddy : la liste ne peut pas dériver du texte réellement émis dans les pages.
// Aucune dépendance : node:crypto, node:fs, node:path.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Empreinte CSP « sha256-<base64> » du texte exact d'un script ou d'une feuille de style (octets UTF-8).
 * Jamais de trim : le navigateur hache le corps du <script> tel quel, un retour ligne en plus change l'empreinte.
 * Sans guillemets : Astro les ajoute dans le meta, check-dist les ajoute pour chercher le jeton.
 */
export function empreinteCsp(texte: string | Uint8Array): string {
  return `sha256-${createHash('sha256').update(texte).digest('base64')}`;
}

export interface ScriptEnLigne {
  /** Nom du fichier dans src/scripts/ (ex. « niveau.js »). */
  nom: string;
  /** Contenu du fichier lu en UTF-8 : c'est le texte que Base.astro et LecteurNiveaux.astro incluent (`?raw`). */
  texte: string;
  /** Empreinte CSP des octets du fichier. */
  empreinte: string;
}

/** Scripts de src/scripts/*.js, triés par nom, avec leur texte et leur empreinte CSP. */
export function scriptsEnLigne(projectRoot: string): ScriptEnLigne[] {
  const dossier = path.join(projectRoot, 'src', 'scripts');
  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((nom) => {
      const octets = fs.readFileSync(path.join(dossier, nom));
      return { nom, texte: octets.toString('utf8'), empreinte: empreinteCsp(octets) };
    });
}
