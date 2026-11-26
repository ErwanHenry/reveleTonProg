// Phase 10.3, plan 03 : relecteur automatique. Aucun appel à un vrai claude ni au réseau.
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ErreurConfigLocale } from '../../scripts/lib/config-locale.ts';
import { SCHEMA_VERDICT, argumentsAgent, cheminConfigAgent, envAgent, lireConfigAgent } from '../../scripts/lib/veille/agent-claude.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-agent-test-'));
  dossiers.push(d);
  return d;
};
const SENTINELLE = 'SENTINELLE-AGENT-4d2';

function poserConfig(home: string, contenu: string, mode = 0o600): void {
  const f = cheminConfigAgent(home);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, contenu);
  chmodSync(f, mode);
}

describe('lireConfigAgent', () => {
  it('voie jeton : budget 0.5 par défaut, dossiers 0700 créés', () => {
    const home = tmp();
    const veille = path.join(tmp(), 'veille');
    poserConfig(home, `RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\n`);
    const cfg = lireConfigAgent(home, veille);
    assert.equal(cfg.auth.mode, 'jeton');
    assert.equal(cfg.budgetUsd, 0.5);
    assert.equal(cfg.claude, '/opt/claude');
    for (const d of [cfg.dossierConfig, cfg.dossierTravail]) {
      assert.ok(existsSync(d));
      assert.equal(statSync(d).mode & 0o077, 0);
    }
  });

  it('voie clé d\'API, budget personnalisé', () => {
    const home = tmp();
    poserConfig(home, `RTP_CLAUDE=/opt/claude\nANTHROPIC_API_KEY=${SENTINELLE}\nRTP_AGENT_BUDGET_USD=2\n`);
    const cfg = lireConfigAgent(home, path.join(tmp(), 'v'));
    assert.equal(cfg.auth.mode, 'cle_api');
    assert.equal(cfg.budgetUsd, 2);
  });

  const refuse = (contenu: string, motif: RegExp, mode = 0o600): void => {
    const home = tmp();
    poserConfig(home, contenu, mode);
    assert.throws(
      () => lireConfigAgent(home, path.join(tmp(), 'v')),
      (e: unknown) => e instanceof ErreurConfigLocale && motif.test(e.message) && !e.message.includes(SENTINELLE),
    );
  };

  it('refuse deux secrets, aucun secret, chemin relatif, budget hors bornes, mode 0644', () => {
    refuse(`RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\nANTHROPIC_API_KEY=${SENTINELLE}\n`, /une seule voie/);
    refuse('RTP_CLAUDE=/opt/claude\n', /une voie d'authentification attendue/);
    refuse(`RTP_CLAUDE=claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\n`, /RTP_CLAUDE/);
    refuse(`CLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\n`, /RTP_CLAUDE/);
    refuse(`RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\nRTP_AGENT_BUDGET_USD=9\n`, /RTP_AGENT_BUDGET_USD/);
    refuse(`RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\nRTP_AGENT_BUDGET_USD=0.01\n`, /RTP_AGENT_BUDGET_USD/);
    refuse(`RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\n`, /chmod 600/, 0o644);
  });
});

const cfgJeton = (): ReturnType<typeof lireConfigAgent> => {
  const home = tmp();
  poserConfig(home, `RTP_CLAUDE=/opt/claude\nCLAUDE_CODE_OAUTH_TOKEN=${SENTINELLE}\n`);
  return lireConfigAgent(home, path.join(tmp(), 'v'));
};
const cfgCle = (): ReturnType<typeof lireConfigAgent> => {
  const home = tmp();
  poserConfig(home, `RTP_CLAUDE=/opt/claude\nANTHROPIC_API_KEY=${SENTINELLE}\n`);
  return lireConfigAgent(home, path.join(tmp(), 'v'));
};

describe('argumentsAgent et envAgent', () => {
  const attendu = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA_VERDICT), '--model', 'sonnet', '--tools', '', '--no-session-persistence', '--permission-mode', 'dontAsk', '--disable-slash-commands', '--strict-mcp-config', '--max-budget-usd', '0.5'];

  it('voie jeton : exactement les arguments attendus, sans --bare', () => {
    assert.deepEqual(argumentsAgent(cfgJeton()), attendu);
  });

  it('voie clé d\'API : les mêmes suivis de --bare', () => {
    assert.deepEqual(argumentsAgent(cfgCle()), [...attendu, '--bare']);
  });

  it('aucun secret ni prompt dans les arguments', () => {
    assert.ok(!argumentsAgent(cfgJeton()).join(' ').includes(SENTINELLE));
  });

  it('environnement : liste blanche, config dédiée, un seul secret', () => {
    const source = { PATH: '/usr/bin', HOME: '/h', GITHUB_TOKEN: 'x', RTP_X: 'y', ANTHROPIC_API_KEY: 'ambiante', CLAUDE_CODE_OAUTH_TOKEN: 'ambiant' };
    const cfg = cfgJeton();
    const env = envAgent(cfg, source);
    const base = ['PATH', 'HOME', 'TZ', 'ASTRO_TELEMETRY_DISABLED'];
    assert.deepEqual(Object.keys(env).sort(), [...base, 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN'].sort());
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, SENTINELLE);
    assert.equal(env.CLAUDE_CONFIG_DIR, cfg.dossierConfig);
    const envCle = envAgent(cfgCle(), source);
    assert.deepEqual(Object.keys(envCle).sort(), [...base, 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_API_KEY'].sort());
    assert.equal(envCle.ANTHROPIC_API_KEY, SENTINELLE);
  });
});
