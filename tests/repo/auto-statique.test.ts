// Plan 10.3-10 (T-10.3-56, T-10.3-57) : gardes statiques de conception de l'automate.
// Lecture des sources de scripts/ et de la liste des fichiers suivis ; chaque message cite le fichier fautif.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { envAgent } from '../../scripts/lib/veille/agent-claude.ts';
import type { ConfigAgent } from '../../scripts/lib/veille/agent-claude.ts';
import { REPO_ROOT } from '../helpers/validate-yaml.ts';

const lire = (relatif: string): string => readFileSync(path.join(REPO_ROOT, relatif), 'utf8');
function sources(dossier: string): string[] {
  const sortie: string[] = [];
  for (const e of readdirSync(path.join(REPO_ROOT, dossier), { withFileTypes: true })) {
    const rel = path.posix.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...sources(rel));
    else if (e.name.endsWith('.ts')) sortie.push(rel);
  }
  return sortie;
}
const TOUS = sources('scripts');
const VEILLE = [...sources('scripts/lib/veille'), 'scripts/veille.ts', 'scripts/deploy-auto.ts'];
/** Sans les lignes de commentaire (les règles y sont énoncées, pas appliquées). */
const code = (relatif: string): string => lire(relatif).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const fautifs = (fichiers: string[], re: RegExp): string[] => fichiers.filter((f) => re.test(code(f)));

describe('gardes statiques de l\'automate (phase 10.3)', () => {
  it('un seul point d\'appel de claude : agent-claude.ts', () => {
    const ailleurs = TOUS.filter((f) => f !== 'scripts/lib/veille/agent-claude.ts');
    assert.deepEqual(fautifs(ailleurs, /\bcfg\.claude\b|RTP_CLAUDE|commande:\s*['"`]claude['"`]|\bspawn(Sync)?\(\s*['"`]claude['"`]/), [], 'appel de claude hors agent-claude.ts');
    assert.match(code('scripts/lib/veille/agent-claude.ts'), /commande:\s*cfg\.claude/);
  });

  it('l\'agent n\'a aucun outil : --tools "" et --no-session-persistence', () => {
    const t = code('scripts/lib/veille/agent-claude.ts');
    assert.match(t, /'--tools',\s*''/, 'agent-claude.ts : --tools "" manquant');
    assert.match(t, /'--no-session-persistence'/, 'agent-claude.ts : --no-session-persistence manquant');
    assert.match(t, /'--permission-mode',\s*'dontAsk'/, 'agent-claude.ts : le mode de permissions doit rester dontAsk');
  });

  it('aucune option d\'outils ni de permissions dangereuses dans scripts/', () => {
    for (const mot of ['dangerously-skip-permissions', '--allowedTools', '--allowed-tools', '--add-dir', 'bypassPermissions', 'acceptEdits']) {
      const f = TOUS.filter((x) => lire(x).includes(mot));
      assert.deepEqual(f, [], `« ${mot} » trouvé`);
    }
  });

  it('push git seulement dans pousser.ts, sans forçage', () => {
    const ailleurs = VEILLE.filter((f) => f !== 'scripts/lib/veille/pousser.ts');
    assert.deepEqual(fautifs(ailleurs, /['"`]push['"`]/), [], 'push hors pousser.ts');
    const p = code('scripts/lib/veille/pousser.ts');
    assert.match(p, /'push'/);
    assert.doesNotMatch(p, /--force|--force-with-lease|['"`]-f['"`]|['"`]\+/, 'pousser.ts : forçage');
  });

  it('aucun appel gh exécuté par les modules de la veille (une commande imprimée pour Erwan reste permise)', () => {
    assert.deepEqual(fautifs(VEILLE, /(executer|spawnSync|spawn|lancer|execFileSync)\(\s*['"`]gh['"`]|commande:\s*['"`]gh['"`]/), [], 'appel de gh');
  });

  it('l\'automate n\'écrit ni texte_source ni archives/ (le périmètre ne les cite que comme refus)', () => {
    for (const f of ['scripts/lib/veille/auto.ts', 'scripts/lib/veille/ecriture-auto.ts', 'scripts/lib/veille/identite.ts']) {
      assert.doesNotMatch(code(f), /texte_source|archives\//, `${f} cite texte_source ou archives/`);
    }
    const p = code('scripts/lib/veille/perimetre-ecriture.ts');
    assert.match(p, /startsWith\('archives\/'\)\) noter\('archives'/, 'refus des archives');
    assert.match(p, /texte_source:\/\.test\(corps\)\) noter\('texte_source'/, 'refus de texte_source');
  });

  it('envAgent écarte les variables du terminal (jeton de dépôt, hôte, agent SSH, clé d\'API)', () => {
    const cfg: ConfigAgent = { claude: '/x/claude', auth: { mode: 'jeton', jeton: 'J' }, budgetUsd: 1, dossierConfig: '/x/c', dossierTravail: '/x/t', delaiMs: 1000 };
    const source = { PATH: '/usr/bin', HOME: '/h', GITHUB_TOKEN: 'g', RTP_HOTE: 'h', SSH_AUTH_SOCK: '/s', ANTHROPIC_API_KEY: 'k', RTP_PUSH_JETON: 'p' } as NodeJS.ProcessEnv;
    const env = envAgent(cfg, source);
    for (const k of ['GITHUB_TOKEN', 'RTP_HOTE', 'SSH_AUTH_SOCK', 'ANTHROPIC_API_KEY', 'RTP_PUSH_JETON']) assert.ok(!(k in env), `${k} présent`);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'J');
  });

  it('envAgent, voie clé d\'API : seule ANTHROPIC_API_KEY de la configuration, pas celle du terminal', () => {
    const cfg: ConfigAgent = { claude: '/x/claude', auth: { mode: 'cle_api', cle: 'K-CONFIG' }, budgetUsd: 1, dossierConfig: '/x/c', dossierTravail: '/x/t', delaiMs: 1000 };
    const env = envAgent(cfg, { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'K-TERMINAL', CLAUDE_CODE_OAUTH_TOKEN: 'T' } as NodeJS.ProcessEnv);
    assert.equal(env.ANTHROPIC_API_KEY, 'K-CONFIG');
    assert.ok(!('CLAUDE_CODE_OAUTH_TOKEN' in env));
  });

  it('aucun fichier suivi nommé *.env hors .env.example, aucune valeur de CLAUDE_CODE_OAUTH_TOKEN suivie', () => {
    const suivis = spawnSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter((f) => f !== '');
    assert.deepEqual(suivis.filter((f) => /(^|\/)[^/]*\.env$/.test(f) && path.basename(f) !== '.env.example'), [], 'fichier .env suivi');
    const avecValeur = suivis.filter((f) => /\.(ts|md|ya?ml|json|sh|plist|txt)$/.test(f) && f !== 'tests/repo/auto-statique.test.ts').filter((f) => {
      try {
        return /CLAUDE_CODE_OAUTH_TOKEN=\S+/.test(readFileSync(path.join(REPO_ROOT, f), 'utf8'));
      } catch {
        return false;
      }
    });
    // Les tests écrivent des fichiers de configuration factices avec des sentinelles ; aucune valeur ne doit être au format d'un vrai jeton.
    for (const f of avecValeur) assert.doesNotMatch(readFileSync(path.join(REPO_ROOT, f), 'utf8'), /CLAUDE_CODE_OAUTH_TOKEN=sk-ant-/, `${f} : jeton réel`);
  });
});
