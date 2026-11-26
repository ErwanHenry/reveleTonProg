// Phase 10.3 plan 05 : codes fermés et alertes de l'automate. Faux executer, faux fetch, aucun réseau.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CODES_ARRET, CODES_ISSUE, CODES_TRANSITOIRES, estCodeAuto } from '../../scripts/lib/veille/codes-auto.ts';
import { LIBELLES, PREFIXES_ALERTE, ajouterBoite, envoyerAlerteAuto, texteAlerteAuto, viderBoite } from '../../scripts/lib/veille/alertes-auto.ts';
import type { Alerte } from '../../scripts/lib/veille/alertes-auto.ts';
import type { Executer, Fetch } from '../../scripts/lib/veille/alertes.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';

const JETON = '123456:SECRET-jeton-auto-fictif';
const CONV = '555000111';
const HOME = '/Users/test';
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const alerte = (o: Partial<Alerte> = {}): Alerte => ({ code: 'publie', mode: 'publier', comptes: '1 entrée', sha: SHA, rapport: `${HOME}/.cache/rtp/veille/rapports-auto/x.md`, fiches: ['jean-dupont'], home: HOME, ...o });

function fauxExecuter(): { executer: Executer; appels: string[][] } {
  const appels: string[][] = [];
  const executer: Executer = (cmd, args) => {
    appels.push([cmd, ...args]);
    if (cmd === '/usr/bin/security') return { status: 0, stdout: `${args.includes('rtp-veille-telegram-jeton') ? JETON : CONV}\n`, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  return { executer, appels };
}

describe('codes fermés', () => {
  it('24 arrêts, 4 issues, disjoints', () => {
    assert.equal(CODES_ARRET.length, 24);
    assert.equal(CODES_ISSUE.length, 4);
    for (const c of CODES_ISSUE) assert.ok(!(CODES_ARRET as readonly string[]).includes(c));
    assert.equal(Object.keys(LIBELLES).length, 28);
  });
  it('estCodeAuto et transitoires', () => {
    assert.ok(estCodeAuto('publie') && estCodeAuto('hors_ligne'));
    assert.ok(!estCodeAuto('autre') && !estCodeAuto(3));
    assert.equal(CODES_TRANSITOIRES.length, 10);
    assert.ok(!CODES_TRANSITOIRES.includes('doute_agent'));
  });
});

describe('texte d\'alerte', () => {
  it('lignes à préfixes fermés, SHA court, chemin en ~/', () => {
    const t = texteAlerteAuto(alerte());
    for (const l of t.split('\n')) assert.ok(PREFIXES_ALERTE.some((p) => l.startsWith(p)), l);
    assert.match(t, /commit : a1b2c3d4e5f6$/m);
    assert.match(t, /rapport : ~\/\.cache\/rtp\/veille\/rapports-auto\/x\.md$/m);
    assert.ok(!t.includes(SHA));
  });
  it('retire les fiches invalides et borne à 10', () => {
    const t = texteAlerteAuto(alerte({ fiches: ['Jean Dupont', '../x', ...Array.from({ length: 12 }, (_, i) => `perso-${String.fromCharCode(97 + i)}`)] }));
    assert.doesNotMatch(t, /Jean|\.\.\//);
    assert.match(t, /\(\+2\)/);
    assert.equal((t.match(/perso-/g) ?? []).length, 10);
  });
  it('un SHA invalide n\'est pas affiché', () => {
    assert.doesNotMatch(texteAlerteAuto(alerte({ sha: 'pas un sha' })), /commit/);
  });
  it('libellés sans tiret long ni moyen ni mot interdit', () => {
    for (const [c, l] of Object.entries(LIBELLES)) {
      assert.doesNotMatch(l, /[–—]/, c);
      assert.deepEqual(motsInterdits(l), [], c);
    }
    assert.doesNotMatch(readFileSync(new URL('../../scripts/lib/veille/alertes-auto.ts', import.meta.url), 'utf8'), /[–—]/);
  });
});

describe('envoi', () => {
  it('Telegram ok et notification macOS', async () => {
    const { executer, appels } = fauxExecuter();
    const fetch: Fetch = async () => ({ ok: true, status: 200 });
    const r = await envoyerAlerteAuto('texte', { executer, fetch, sansAlerte: false });
    assert.deepEqual(r, { telegram: true, mac: true, incident: null });
    assert.ok(appels.some((a) => a[0] === '/usr/bin/osascript'));
  });
  it('Telegram en panne : telegram faux, incident masqué', async () => {
    const { executer } = fauxExecuter();
    const fetch: Fetch = async (url) => {
      throw new Error(`échec ${url}`);
    };
    const r = await envoyerAlerteAuto('texte', { executer, fetch, sansAlerte: false, pause: async () => {} });
    assert.equal(r.telegram, false);
    assert.ok(r.incident !== null && !r.incident.includes(JETON));
  });
  it('sansAlerte : rien n\'est envoyé', async () => {
    const { executer, appels } = fauxExecuter();
    const r = await envoyerAlerteAuto('t', { executer, fetch: async () => ({ ok: true, status: 200 }), sansAlerte: true });
    assert.deepEqual(r, { telegram: false, mac: false, incident: null });
    assert.equal(appels.length, 0);
  });
});

describe('boîte d\'envoi', () => {
  it('plafond de 20, perdues comptées', () => {
    let b: string[] = [];
    let perdues = 0;
    for (let i = 0; i < 23; i++) {
      const r = ajouterBoite(b, `m${i}`);
      b = r.boite;
      perdues += r.perdues;
    }
    assert.equal(b.length, 20);
    assert.equal(perdues, 3);
    assert.equal(b[0], 'm3');
  });
  it('viderBoite dans l\'ordre, s\'arrête au premier échec', async () => {
    const vus: string[] = [];
    const r = await viderBoite(['a', 'b', 'c'], async (t) => {
      vus.push(t);
      return t !== 'b';
    });
    assert.deepEqual(vus, ['a', 'b']);
    assert.deepEqual(r, { restantes: ['b', 'c'], envoyees: 1 });
  });
});
