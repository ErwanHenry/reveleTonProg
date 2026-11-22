// Date de révision des pages institutionnelles (WR-03 de la revue 09.1). Mentions légales et Méthode affichent leur
// constante REVISION en pied de page (« Dernière mise à jour des contenus de cette page »), et leur commentaire dit de
// la changer « à chaque modification du texte ». Ce test relie la date au texte : une empreinte du gabarit sans ses
// commentaires (et, pour la Méthode, du catalogue des règles qu'elle affiche) est notée à côté de la date. Si le texte
// change, l'empreinte change : mettre REVISION à la date du jour dans la page, puis recopier ici la date et l'empreinte.
// Un commentaire seul ne change pas l'empreinte.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../../src/lib/content-core/rules/config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Page {
  fichier: string;
  revision: string;
  empreinte: string;
  /** Texte affiché par la page qui vit hors de son fichier. */
  extra?: () => string;
}

const PAGES: Page[] = [
  // Texte modifié le 2026-11-12 (09.1, proposition 2 : noms des liens « Signaler une erreur : par courriel / sur GitHub »).
  // Puis le 2026-11-22 (vérification de la phase 9, texte validé par Erwan) : relecture juridique au passé.
  { fichier: 'src/pages/mentions-legales.astro', revision: '2026-11-22', empreinte: 'a33308af579e525a' },
  // Texte modifié le 2026-11-12 (09.1, proposition 2 : « Copie archivée ») et le 2026-11-13 (Phase 10, ligne
  // STATUT_PLUS_RECENT_NON_RELU du catalogue affiché ; puis « un thème à la fois » à la place de « thème par
  // thème », texte validé par Erwan le même jour) et le 2026-11-17 (statut attribué au jeu de données : nom du jeu
  // lu dans identite.ts, paragraphe « le site n'établit pas lui-même la date d'une déclaration » ; puis limite
  // « relecture par un second agent d'intelligence artificielle, pas une relecture humaine de chaque texte »,
  // décision d'Erwan du même jour).
  // Puis le 2026-11-22 (audit 09-13, textes validés par Erwan) : mesure 4G « sur le site public » ; personnes qui ne se
  // présentent pas affichées une fois leur statut relu ; puis, après la vérification de la phase 9 : rôle de l'éditeur
  // (règles de relecture, cas soumis), source « du candidat, de sa candidature ou de son parti », pressentis.
  { fichier: 'src/pages/methode.astro', revision: '2026-11-22', empreinte: '900098e0981c11a2', extra: () => JSON.stringify(CATALOGUE) },
];

/** Gabarit sans commentaires JSX ({/* … *\/}), sans commentaires de ligne du frontmatter et sans la ligne REVISION. */
function texteSignifiant(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l) && !/^const REVISION = /.test(l))
    .map((l) => l.trimEnd())
    .filter((l) => l !== '')
    .join('\n');
}

describe('REVISION des pages institutionnelles suit leur texte (WR-03, revue 09.1)', () => {
  for (const p of PAGES) {
    const source = fs.readFileSync(path.join(REPO, p.fichier), 'utf8');

    it(`${p.fichier} : REVISION vaut ${p.revision}`, () => {
      const m = /^const REVISION = '(\d{4}-\d{2}-\d{2})';$/m.exec(source);
      assert.ok(m, 'constante REVISION absente');
      assert.equal(m[1], p.revision);
    });

    it(`${p.fichier} : le texte n'a pas changé depuis cette date`, () => {
      const empreinte = createHash('sha256').update(texteSignifiant(source) + (p.extra?.() ?? '')).digest('hex').slice(0, 16);
      assert.equal(
        empreinte,
        p.empreinte,
        `texte modifié : mettre REVISION à la date du jour dans ${p.fichier}, puis la date et l'empreinte ${empreinte} dans ce test`,
      );
    });
  }
});
