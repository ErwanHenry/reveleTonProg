// Registre statique des migrations de schéma (vide en v1.0 : aucun schéma n'a encore changé de version).
//
// Ajouter une migration : créer `scripts/migrations/<schema>/<NNN>-<desc>.ts` exportant un objet `Migration`
// (schema, from, to, migrate(doc)), puis l'importer ici statiquement et l'ajouter au tableau.
// Jamais d'import dynamique ni de chargement par chemin : aucun code ne s'exécute depuis un dossier de contenu.
import type { Migration } from '../../src/lib/content-core/migrate.ts';

export const MIGRATIONS: readonly Migration[] = [];
