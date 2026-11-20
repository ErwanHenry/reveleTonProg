// Phase 10.1 : un passage de la veille (scripts/lib/veille/lancer.ts) avec faux git, faux réseau, faux Trousseau,
// fausse horloge et fausse répétition à blanc. Aucun processus réel n'est lancé, aucun réseau n'est touché.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EntreeRapport } from '../../scripts/lib/rapport-import.ts';
import { SERVICES, masquer, texteAlerte } from '../../scripts/lib/veille/alertes.ts';
import type { Executer, Fetch } from '../../scripts/lib/veille/alertes.ts';
import { lireEtat, lignesEtat } from '../../scripts/lib/veille/etat.ts';
import { lancerVeille } from '../../scripts/lib/veille/lancer.ts';
import type { DependancesLancer } from '../../scripts/lib/veille/lancer.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-veille-test-'));
  dossiers.push(d);
  return d;
};

const JETON = '123456:SECRET-jeton-telegram-fictif';
const CONVERSATION = '987654321';
const HC = 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function entree(over: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    instantane: { nom: 'x.json', sha256: 'c'.repeat(64), miseAJour: '2026-11-20', lignes: 1, precedent: null },
    plans: [],
    inconnus: [],
    conflits: [],
    precedent: null,
    idsAmont: [],
    fichesAbsentes: [],
    candidats: [],
    themes: [],
    mesures: [],
    couvertures: [],
    themesOuverts: [],
    ...over,
  };
}
const INCONNU = { id: 'inconnu-fictif', nom: 'Essai Fictif', parti: '', statut: 'declare', source: { titre: 't', url: 'https://exemple.test/i', date: '2026-11-20' }, liens: {}, verifie_le: '2026-11-20' };

interface Monde {
  deps: DependancesLancer;
  appels: { commande: string; args: string[]; cwd?: string }[];
  requetes: { url: string; body?: string }[];
  journal: string[];
  amont: { octets: Buffer };
  sortieImport: { stdout: string; status: number };
  secrets: Record<string, string | null>;
  telegramOk: boolean;
}

function monde(): Monde {
  const dossier = tmp();
  const depot = tmp();
  const m: Monde = {
    appels: [],
    requetes: [],
    journal: [],
    amont: { octets: Buffer.from('{"mise_a_jour":"2026-11-20","candidats":[{"id":"inconnu-fictif","statut_detail":"Texte amont fictif"}]}') },
    sortieImport: { stdout: JSON.stringify({ version: 1, entree: entree({ inconnus: [INCONNU] }), motifsADecider: [], markdown: '# Rapport de répétition à blanc\n' }), status: 0 },
    secrets: { [SERVICES.telegramJeton]: JETON, [SERVICES.telegramConversation]: CONVERSATION, [SERVICES.healthchecks]: HC },
    telegramOk: true,
    deps: undefined as unknown as DependancesLancer,
  };
  const executer: Executer = (commande, args, options = {}) => {
    m.appels.push({ commande, args, cwd: options.cwd });
    if (commande === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: 'f'.repeat(40) + '\n', stderr: '' };
    if (commande === 'git' && args[0] === 'worktree') {
      const arbre = args[4] as string;
      mkdirSync(path.join(arbre, '.git'), { recursive: true });
      writeFileSync(path.join(arbre, 'package-lock.json'), '{}');
      return { status: 0, stdout: '', stderr: '' };
    }
    if (commande === 'git') return { status: 0, stdout: '', stderr: '' };
    if (commande === 'npm') {
      mkdirSync(path.join(options.cwd as string, 'node_modules'), { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    }
    if (commande === 'node') return { status: m.sortieImport.status, stdout: m.sortieImport.stdout, stderr: '' };
    if (commande === '/usr/bin/osascript') return { status: 0, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: `commande inattendue ${commande}` };
  };
  const fetchFn: Fetch = async (url, init) => {
    m.requetes.push({ url, body: init?.body });
    if (url.startsWith('https://api.telegram.org/') && !m.telegramOk) throw new Error(`connexion refusée vers ${url}`);
    return { ok: true, status: 200 };
  };
  m.deps = {
    dossier,
    depot,
    executer,
    telecharger: async () => m.amont.octets,
    fetch: fetchFn,
    maintenant: () => new Date('2026-11-20T07:00:00Z'),
    node: 'node',
    journal: (l) => m.journal.push(l),
    lireSecret: (s) => m.secrets[s] ?? null,
  };
  return m;
}

/** Tout ce que la veille a écrit ou dit : aucun secret ne doit s'y trouver. */
function toutLeTexte(m: Monde): string {
  const fichiers = (readdirSync(m.deps.dossier, { recursive: true }) as string[])
    .map((f) => path.join(m.deps.dossier, f))
    .filter((f) => statSync(f).isFile())
    .map((f) => readFileSync(f, 'utf8'));
  return [...fichiers, ...m.journal, ...m.appels.flatMap((a) => a.args)].join('\n');
}

describe('lancerVeille', () => {
  it('premier passage : worktree de la veille, octets gardés, rapport daté, alerte macOS et Telegram, ping de succès', async () => {
    const m = monde();
    const r = await lancerVeille(m.deps);
    assert.equal(r.code, 0);
    assert.equal(r.passage, 'nouveau');
    assert.equal(r.notable, true);
    assert.ok(r.rapport !== null && r.rapport.startsWith(path.join(m.deps.dossier, 'rapports', '2026-11-20-0800-')));
    const texte = readFileSync(r.rapport, 'utf8');
    assert.match(texte, /# Veille des candidatures/);
    assert.match(texte, /npm run veille -- decider inconnu-fictif/);
    assert.match(texte, /Texte amont fictif/);
    assert.equal((statSync(r.rapport).mode & 0o777).toString(8), '600');
    // La répétition tourne dans le worktree de la veille, jamais ailleurs.
    const imp = m.appels.find((a) => a.commande === 'node');
    assert.equal(imp?.cwd, path.join(m.deps.dossier, 'arbre'));
    assert.deepEqual(imp?.args.slice(0, 4), ['scripts/import-datagouv.ts', '--dry-run', '--format', 'json']);
    // Aucun git qui écrit ailleurs que le worktree de la veille, aucune branche, aucun push.
    for (const a of m.appels.filter((x) => x.commande === 'git')) {
      assert.ok(['fetch', 'rev-parse', 'worktree', 'status', 'checkout'].includes(a.args[0] as string), a.args.join(' '));
      assert.ok(!a.args.includes('push') && !a.args.includes('-b') && !a.args.includes('branch'));
    }
    const osa = m.appels.find((a) => a.commande === '/usr/bin/osascript');
    assert.ok(osa !== undefined);
    assert.ok(!osa.args.join(' ').includes('Essai Fictif'), 'aucun nom dans la notification');
    const tg = m.requetes.find((q) => q.url.startsWith('https://api.telegram.org/'));
    assert.ok(tg !== undefined);
    assert.equal((JSON.parse(tg.body as string) as { chat_id: string }).chat_id, CONVERSATION);
    assert.match((JSON.parse(tg.body as string) as { text: string }).text, /^Veille des candidatures : 0 sortie\(s\), 1 entrée\(s\)/);
    assert.ok(!(tg.body as string).includes('Essai Fictif'));
    assert.ok(m.requetes.some((q) => q.url === HC));
    const etat = lireEtat(m.deps.dossier);
    assert.equal(etat.dernierCode, 'nouveau');
    assert.equal(etat.derniereEmpreinte?.length, 64);
    assert.deepEqual(etat.canaux, { telegram: true, healthchecks: true });
    assert.ok(existsSync(etat.dernierAmont as string));
    assert.ok(!toutLeTexte(m).includes(JETON) && !toutLeTexte(m).includes(HC.slice(8)), 'aucun secret écrit ni journalisé');
  });

  it('octets déjà vus : ni rapport nouveau ni alerte, ping de succès, état « déjà vu »', async () => {
    const m = monde();
    await lancerVeille(m.deps);
    const avant = readdirSync(path.join(m.deps.dossier, 'rapports'));
    m.appels.length = 0;
    m.requetes.length = 0;
    const r = await lancerVeille(m.deps);
    assert.equal(r.passage, 'deja_vu');
    assert.deepEqual(readdirSync(path.join(m.deps.dossier, 'rapports')), avant);
    assert.ok(!m.appels.some((a) => a.commande === 'node' || a.commande === '/usr/bin/osascript'));
    assert.deepEqual(m.requetes.map((q) => q.url), [HC]);
    assert.equal(lireEtat(m.deps.dossier).dernierCode, 'deja_vu');
  });

  it('nouvelle empreinte sans rien à décider (dérive seule) : rapport, aucune alerte', async () => {
    const m = monde();
    m.sortieImport.stdout = JSON.stringify({ version: 1, entree: entree(), motifsADecider: [], markdown: '# R\n' });
    const r = await lancerVeille(m.deps);
    assert.equal(r.passage, 'nouveau');
    assert.equal(r.notable, false);
    assert.ok(!m.appels.some((a) => a.commande === '/usr/bin/osascript'));
    assert.ok(!m.requetes.some((q) => q.url.startsWith('https://api.telegram.org/')));
  });

  it('sans jeton Telegram : notification macOS seule, l’état le dit', async () => {
    const m = monde();
    m.secrets[SERVICES.telegramJeton] = null;
    await lancerVeille(m.deps);
    assert.ok(m.appels.some((a) => a.commande === '/usr/bin/osascript'));
    assert.ok(!m.requetes.some((q) => q.url.startsWith('https://api.telegram.org/')));
    const etat = lireEtat(m.deps.dossier);
    assert.equal(etat.canaux.telegram, false);
    assert.match(lignesEtat(m.deps.dossier, etat).join('\n'), /Telegram configuré : non/);
  });

  it('panne Telegram : la veille réussit, l’incident est noté sans le jeton', async () => {
    const m = monde();
    m.telegramOk = false;
    const r = await lancerVeille(m.deps);
    assert.equal(r.code, 0);
    const etat = lireEtat(m.deps.dossier);
    assert.match(etat.incidentAlerte ?? '', /Telegram injoignable/);
    assert.ok(!(etat.incidentAlerte ?? '').includes(JETON));
    assert.ok(!toutLeTexte(m).includes(JETON));
  });

  it('panne réseau : code 1, ping /fail, état « panne », aucun rapport', async () => {
    const m = monde();
    m.deps.telecharger = async () => {
      throw new Error('réseau coupé');
    };
    const r = await lancerVeille(m.deps);
    assert.equal(r.code, 1);
    assert.equal(r.passage, 'panne');
    assert.ok(m.requetes.some((q) => q.url === `${HC}/fail`));
    assert.equal(lireEtat(m.deps.dossier).dernierCode, 'panne');
    assert.ok(!existsSync(path.join(m.deps.dossier, 'rapports')));
  });

  it('répétition à blanc illisible : panne nommée, empreinte non retenue (le passage suivant réessaie)', async () => {
    const m = monde();
    m.sortieImport = { stdout: 'pas du json', status: 1 };
    const r = await lancerVeille(m.deps);
    assert.equal(r.code, 1);
    const etat = lireEtat(m.deps.dossier);
    assert.match(etat.derniereErreur ?? '', /répétition à blanc illisible/);
    assert.equal(etat.derniereEmpreinte, null);
  });

  it('worktree de la veille modifié à la main : panne, rien n’est écrasé', async () => {
    const m = monde();
    await lancerVeille(m.deps);
    const avant = m.deps.executer;
    m.deps.executer = (c, a, o) => (c === 'git' && a[0] === 'status' ? { status: 0, stdout: ' M scripts/x.ts\n', stderr: '' } : avant(c, a, o));
    m.amont.octets = Buffer.from('{"autre":1}');
    const r = await lancerVeille(m.deps);
    assert.equal(r.code, 1);
    assert.match(lireEtat(m.deps.dossier).derniereErreur ?? '', /contient des modifications/);
  });

  it('--sans-alerte : ni notification ni Telegram, le ping reste', async () => {
    const m = monde();
    await lancerVeille(m.deps, { sansAlerte: true });
    assert.ok(!m.appels.some((a) => a.commande === '/usr/bin/osascript'));
    assert.ok(!m.requetes.some((q) => q.url.startsWith('https://api.telegram.org/')));
    assert.ok(m.requetes.some((q) => q.url === HC));
  });
});

describe('alertes', () => {
  it('masquer retire les secrets et leur forme encodée', () => {
    assert.equal(masquer(`a ${JETON} b ${encodeURIComponent(JETON)}`, [JETON, null]), 'a [masqué] b [masqué]');
  });
  it('texte d’alerte : comptes et chemin seulement', () => {
    assert.equal(texteAlerte('1 sortie(s)', '/x/r.md'), 'Veille des candidatures : 1 sortie(s). Rapport : /x/r.md');
  });
});
