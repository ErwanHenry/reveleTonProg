import path from 'node:path';

// Jusqu'à la Phase 3, build et validate tournent sur le corpus fictif de test.
// La valeur passera à '.' quand le vrai contenu arrivera.
export const DEFAULT_CONTENT_ROOT = 'tests/fixtures/corpus-valide';

// Une variable vide équivaut à une variable absente.
export function resolveContentRoot(projectRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(projectRoot, env.RTP_CONTENT_ROOT || DEFAULT_CONTENT_ROOT);
}

// Les schémas sont résolus depuis la racine du projet fournie par l'appelant, jamais
// depuis import.meta.url : Vite regroupe content.config.ts dans un module temporaire.
export function schemasDirOf(projectRoot: string): string {
  return path.join(projectRoot, 'schemas');
}
