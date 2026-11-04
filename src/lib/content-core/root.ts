import path from 'node:path';
import { MODES, MODE_DEFAUT } from './rules/config.ts';

// Racine par défaut : le vrai corpus. La fixture fictive (tests/fixtures/corpus-valide) est
// toujours désignée explicitement (RTP_CONTENT_ROOT ou --root).
export const DEFAULT_CONTENT_ROOT = '.';

// Une variable vide équivaut à une variable absente.
export function resolveContentRoot(projectRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(projectRoot, env.RTP_CONTENT_ROOT || DEFAULT_CONTENT_ROOT);
}

// Les schémas sont résolus depuis la racine du projet fournie par l'appelant, jamais
// depuis import.meta.url : Vite regroupe content.config.ts dans un module temporaire.
export function schemasDirOf(projectRoot: string): string {
  return path.join(projectRoot, 'schemas');
}

/** Mode de validation inconnu (--mode ou RTP_MODE) : erreur de configuration, jamais de contenu. */
export class ModeInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModeInvalideError';
  }
}

/**
 * Mode de validation, fail-closed : le drapeau `--mode` prime sur `RTP_MODE`, qui prime sur
 * `production`. Une valeur vide équivaut à une valeur absente ; toute autre valeur que
 * `preview` ou `production` lève ModeInvalideError (jamais de repli silencieux vers un mode plus
 * souple). Partagé par la CLI de validation et le loader Astro.
 */
export function resolveMode(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): (typeof MODES)[number] {
  const brut = flag || env.RTP_MODE || MODE_DEFAUT;
  const mode = MODES.find((m) => m === brut);
  if (mode === undefined) {
    const vu = brut.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').slice(0, 40);
    throw new ModeInvalideError(`mode de validation inconnu : « ${vu} » (--mode ou RTP_MODE ; valeurs admises : ${MODES.join(', ')})`);
  }
  return mode;
}
