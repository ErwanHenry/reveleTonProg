// Relecteur automatique de la veille (phase 10.3, D-03) : un agent `claude -p` sans aucun outil, dont la sortie est
// un verdict contraint, revérifié par du code, appelé deux fois (vérification puis contre-vérification adverse).
//
// Conception contre l'injection de prompt (jeu public, pages sources) :
//   - aucun outil (`--tools ""`) : l'agent ne peut rien faire, seulement répondre ;
//   - le texte source est récupéré par le code et donné dans un bloc déclaré non fiable ;
//   - « confirme » n'est accepté que si les deux agents le disent et que chaque citation se retrouve mot pour mot
//     dans le texte récupéré par le code ;
//   - tout le reste (insuffisant, infirmé, désaccord, sortie illisible, délai, échec) bloque : rien n'est accepté.
// Ce module n'écrit jamais le prompt ni la sortie de l'agent dans un journal. N'importe que des modules node: et
// des modules relatifs.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { lireFichierCles, ErreurConfigLocale } from '../config-locale.ts';
import { envDeBase, type Lanceur } from '../processus.ts';

/** Verdict attendu de l'agent : indication seulement, la sortie est revalidée par du code (lireSortieAgent). */
export const SCHEMA_VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirme', 'infirme', 'insuffisant'] },
    citation: { type: 'string', maxLength: 300 },
    date_page: { anyOf: [{ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, { type: 'null' }] },
  },
  required: ['verdict', 'citation', 'date_page'],
  additionalProperties: false,
} as const;

export interface ConfigAgent {
  claude: string;
  auth: { mode: 'jeton'; jeton: string } | { mode: 'cle_api'; cle: string };
  budgetUsd: number;
  dossierConfig: string;
  dossierTravail: string;
  delaiMs: number;
}

export const CLES_AGENT = ['RTP_CLAUDE', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'RTP_AGENT_BUDGET_USD'] as const;

export const cheminConfigAgent = (home: string): string => path.join(home, '.config', 'rtp', 'agent-claude.env');

const BUDGET_DEFAUT = 0.5;
const DELAI_AGENT_MS = 5 * 60_000;

/**
 * Lit ~/.config/rtp/agent-claude.env. Deux voies d'authentification, une seule à la fois : jeton `claude
 * setup-token` (défaut) ou clé d'API (avec --bare). Les messages d'erreur ne contiennent jamais une valeur.
 */
export function lireConfigAgent(home: string, dossierVeille: string): ConfigAgent {
  const fichier = cheminConfigAgent(home);
  const v = lireFichierCles(fichier, CLES_AGENT, home);
  const erreurs: string[] = [];

  const claude = v.get('RTP_CLAUDE') ?? '';
  if (claude === '') erreurs.push('RTP_CLAUDE : chemin absolu du binaire claude attendu');
  else if (/\s/.test(claude) || !path.isAbsolute(claude)) erreurs.push('RTP_CLAUDE : chemin absolu sans espace attendu');

  const jeton = v.get('CLAUDE_CODE_OAUTH_TOKEN') ?? '';
  const cle = v.get('ANTHROPIC_API_KEY') ?? '';
  let auth: ConfigAgent['auth'] | null = null;
  if (jeton !== '' && cle !== '') erreurs.push('CLAUDE_CODE_OAUTH_TOKEN et ANTHROPIC_API_KEY : une seule voie d\'authentification attendue');
  else if (jeton === '' && cle === '') erreurs.push('CLAUDE_CODE_OAUTH_TOKEN ou ANTHROPIC_API_KEY : une voie d\'authentification attendue');
  else auth = jeton !== '' ? { mode: 'jeton', jeton } : { mode: 'cle_api', cle };

  let budgetUsd = BUDGET_DEFAUT;
  const budgetBrut = v.get('RTP_AGENT_BUDGET_USD');
  if (budgetBrut !== undefined) {
    const n = /^\d+(\.\d+)?$/.test(budgetBrut) ? Number(budgetBrut) : Number.NaN;
    if (!Number.isFinite(n) || n < 0.05 || n > 5) erreurs.push('RTP_AGENT_BUDGET_USD : nombre attendu entre 0.05 et 5');
    else budgetUsd = n;
  }

  if (erreurs.length > 0 || auth === null) throw new ErreurConfigLocale(fichier, erreurs);

  const dossierConfig = path.join(dossierVeille, 'agent', 'config');
  const dossierTravail = path.join(dossierVeille, 'agent', 'travail');
  for (const d of [dossierConfig, dossierTravail]) mkdirSync(d, { recursive: true, mode: 0o700 });
  return { claude, auth, budgetUsd, dossierConfig, dossierTravail, delaiMs: DELAI_AGENT_MS };
}

/** Arguments de claude : aucun outil, aucune session gardée, aucun serveur MCP, prompt sur l'entrée standard. */
export function argumentsAgent(cfg: ConfigAgent): string[] {
  const args = [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(SCHEMA_VERDICT),
    '--model',
    'sonnet',
    '--tools', '',
    '--no-session-persistence',
    '--permission-mode',
    'dontAsk',
    '--disable-slash-commands',
    '--strict-mcp-config',
    '--max-budget-usd',
    String(cfg.budgetUsd),
  ];
  if (cfg.auth.mode === 'cle_api') args.push('--bare');
  return args;
}

/** Environnement du seul processus claude : liste blanche de base, dossier de config vide, un seul secret. */
export function envAgent(cfg: ConfigAgent, source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env = envDeBase(source);
  env.CLAUDE_CONFIG_DIR = cfg.dossierConfig;
  if (cfg.auth.mode === 'jeton') env.CLAUDE_CODE_OAUTH_TOKEN = cfg.auth.jeton;
  else env.ANTHROPIC_API_KEY = cfg.auth.cle;
  return env;
}
