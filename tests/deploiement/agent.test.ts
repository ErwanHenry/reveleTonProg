// Clé dédiée chargée seulement si elle a une phrase de passe, dans un agent ssh éphémère (D-09, T-09.2-13, T-09.2-14).
// Première partie : ssh-keygen, ssh-agent et ssh-add factices (sh POSIX) dans un dossier bin temporaire, qui notent
// leurs arguments et leur environnement. Seconde partie : vrais ssh-keygen et ssh-agent sur des clés de test générées
// dans un dossier temporaire (avec et sans phrase de passe), lancés dans une nouvelle session sans terminal de
// contrôle : ssh-add ne peut alors ouvrir aucune invite, et l'agent du test est arrêté à la fin. L'agent ssh de
// l'utilisateur n'est jamais utilisé (SSH_AUTH_SOCK n'est pas transmis).
import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lancer, type Lanceur, type Resultat } from '../../scripts/lib/processus.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { resoudreExecutables } from '../../scripts/lib/deploiement/executables.ts';
import { assurerCle, cleChiffree, dossierAgents, DUREE_CLE_S, ouvrirAgent, type Agent } from '../../scripts/lib/deploiement/agent.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLE_PUBLIQUE_FACTICE = 'ssh-ed25519 AAAAC3-CLE-PUBLIQUE-FACTICE-7b1d rtp-test';
const DELAI = 60_000;

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
function temp(prefixe: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefixe)));
  dossiers.push(d);
  return d;
}
/**
 * HOME des agents du test : chemin court, le socket d'un vrai ssh-agent est limité à 104 octets.
 * /var/tmp et non /tmp : sous Linux, /tmp est le dossier temporaire lui-même, et le test de CR-01
 * exige justement un socket hors de ce dossier (rouge sur la CI GitHub, vert sur le Mac).
 */
const HOME_AGENT = realpathSync(mkdtempSync('/var/tmp/rtp-ha-'));
dossiers.push(HOME_AGENT);
function ecrireExecutable(p: string, contenu: string): void {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, contenu);
  chmodSync(p, 0o755);
}
const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const lire = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '');

type Variante = 'normal' | 'cle-sans-phrase' | 'phrase-refusee' | 'cle-invalide';

interface Banc {
  bin: string;
  logs: string;
  cle: string;
  log: (nom: 'ssh-keygen' | 'ssh-agent' | 'ssh-add') => string;
}

function banc(variante: Variante = 'normal'): Banc {
  const bin = temp('rtp-bin-');
  const logs = temp('rtp-logs-');
  const cles = temp('rtp-cles-');
  const cle = path.join(cles, 'rtp-deploy-mac');
  writeFileSync(cle, 'CLE-PRIVEE-FACTICE\n', { mode: 0o600 });
  const journal = (nom: string): string => `LOG=${quote(path.join(logs, `${nom}.log`))}
printf 'ARGV' >> "$LOG"; for a in "$@"; do printf ' [%s]' "$a" >> "$LOG"; done; printf '\\n' >> "$LOG"
env | sed 's/^/ENV /' >> "$LOG"
`;
  ecrireExecutable(
    path.join(bin, 'ssh-keygen'),
    `#!/bin/sh
${journal('ssh-keygen')}
${variante === 'cle-sans-phrase' ? `echo ${quote(CLE_PUBLIQUE_FACTICE)}; exit 0` : variante === 'cle-invalide' ? 'echo "Load key \\"$5\\": invalid format" >&2; exit 255' : 'echo "Load key: incorrect passphrase supplied to decrypt private key" >&2; exit 255'}
`,
  );
  ecrireExecutable(
    path.join(bin, 'ssh-agent'),
    `#!/bin/sh
${journal('ssh-agent')}
case "$1" in
  -a) : > "$2"; printf 'SSH_AUTH_SOCK=%s; export SSH_AUTH_SOCK;\\nSSH_AGENT_PID=4242; export SSH_AGENT_PID;\\necho Agent pid 4242;\\n' "$2" ;;
  -k) printf 'KILL PID=%s SOCK=%s\\n' "$SSH_AGENT_PID" "$SSH_AUTH_SOCK" >> "$LOG"; echo 'unset SSH_AUTH_SOCK;' ;;
  *) exit 64 ;;
esac
`,
  );
  ecrireExecutable(
    path.join(bin, 'ssh-add'),
    `#!/bin/sh
${journal('ssh-add')}
${variante === 'phrase-refusee' ? 'exit 1' : 'exit 0'}
`,
  );
  return { bin, logs, cle, log: (nom) => lire(path.join(logs, `${nom}.log`)) };
}

const exeDe = (b: Banc) => resoudreExecutables(['ssh-keygen', 'ssh-agent', 'ssh-add'], b.bin);

/** Variables d'interface posées dans l'environnement du parent : elles ne doivent jamais atteindre ssh-add. */
const PARENT = { DISPLAY: ':0', SSH_ASKPASS: '/usr/bin/false', SSH_AUTH_SOCK: '/tmp/agent-de-l-utilisateur.sock' };
const sauvegarde: Record<string, string | undefined> = {};
before(() => {
  for (const [k, v] of Object.entries(PARENT)) {
    sauvegarde[k] = process.env[k];
    process.env[k] = v;
  }
});
after(() => {
  for (const [k, v] of Object.entries(sauvegarde)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function sortie(p: Promise<unknown>): Promise<Sortie> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof Sortie, `Sortie attendue, reçu ${String(e)}`);
    return e;
  }
  assert.fail('Sortie attendue');
}

const SIGNAUX = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
const comptes = (): number[] => SIGNAUX.map((s) => process.listenerCount(s));

describe('cleChiffree (ssh-keygen factice)', () => {
  it('clé chiffrée : true ; ssh-keygen appelé avec -y -P "" -f <clé>', async () => {
    const b = banc();
    assert.equal(await cleChiffree(b.cle, exeDe(b), lancer), true);
    assert.match(b.log('ssh-keygen'), new RegExp(`^ARGV \\[-y\\] \\[-P\\] \\[\\] \\[-f\\] \\[${b.cle.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\]$`, 'm'));
  });

  it('clé sans phrase : false, et la clé publique imprimée n\'est pas renvoyée', async () => {
    const b = banc('cle-sans-phrase');
    const r = await cleChiffree(b.cle, exeDe(b), lancer);
    assert.equal(r, false);
    assert.ok(!JSON.stringify(r).includes('CLE-PUBLIQUE-FACTICE'));
  });

  it('IN-08 : clé illisible ou de format inconnu : code 3 qui le dit, au lieu de la croire chiffrée', async () => {
    const b = banc('cle-invalide');
    const e = await sortie(cleChiffree(b.cle, exeDe(b), lancer));
    assert.equal(e.code, 3);
    assert.match(e.message, /illisible ou de format inconnu/);
    const e2 = await sortie(ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {} }));
    assert.match(e2.message, /illisible ou de format inconnu/);
    assert.equal(b.log('ssh-agent'), '', 'aucun agent démarré');
  });

  it('ssh-keygen qui ne se termine pas normalement : refus fermé (code 3)', async () => {
    const b = banc();
    const lanceurMort: Lanceur = async () => ({ code: null, signal: 'SIGKILL', stdout: '', stderr: '', dureeMs: 1, delaiDepasse: true });
    const e = await sortie(cleChiffree(b.cle, exeDe(b), lanceurMort));
    assert.equal(e.code, 3);
  });
});

describe('ouvrirAgent (exécutables factices)', () => {
  it('clé chiffrée : socket dans un dossier 0700, ssh-add -t 900 <clé> avec un environnement propre ; fermer tue l\'agent', async () => {
    const b = banc();
    const avant = comptes();
    const lignes: string[] = [];
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: (l) => lignes.push(l) });
    const dossier = path.dirname(agent.socket);
    assert.equal(path.basename(agent.socket), 'agent.sock');
    // CR-01 : hors du dossier temporaire, sous ~/.cache/rtp/agents (interdit à la build), dossiers en 0700.
    assert.equal(path.dirname(dossier), dossierAgents(HOME_AGENT));
    assert.equal(dossierAgents(HOME_AGENT), path.join(HOME_AGENT, '.cache', 'rtp', 'agents'));
    assert.ok(!dossier.startsWith(realpathSync(tmpdir())), dossier);
    assert.equal(statSync(dossierAgents(HOME_AGENT)).mode & 0o777, 0o700);
    assert.equal(statSync(dossier).mode & 0o777, 0o700);
    assert.ok(existsSync(agent.socket));
    assert.deepEqual(comptes(), avant.map((n) => n + 1), 'un gestionnaire par signal');

    const agentLog = b.log('ssh-agent');
    assert.match(agentLog, new RegExp(`^ARGV \\[-a\\] \\[${agent.socket.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\] \\[-s\\]$`, 'm'));
    const addLog = b.log('ssh-add');
    assert.ok(addLog.includes(`ARGV [-t] [900] [${b.cle}]\n`), addLog);
    assert.ok(addLog.includes(`ENV SSH_AUTH_SOCK=${agent.socket}\n`), addLog);
    assert.ok(addLog.includes('ENV SSH_ASKPASS_REQUIRE=never\n'), addLog);
    assert.ok(!/^ENV SSH_ASKPASS=/m.test(addLog), addLog);
    assert.ok(!/^ENV DISPLAY=/m.test(addLog), addLog);
    assert.ok(!addLog.includes(PARENT.SSH_AUTH_SOCK), 'agent de l\'utilisateur transmis');
    assert.ok(!/^ENV SSH_AUTH_SOCK=/m.test(b.log('ssh-agent').split('ARGV [-k]')[0] ?? ''), 'aucun SSH_AUTH_SOCK au démarrage de l\'agent');

    await agent.fermer();
    assert.match(b.log('ssh-agent'), /^ARGV \[-k\]$/m);
    assert.ok(b.log('ssh-agent').includes(`KILL PID=4242 SOCK=${agent.socket}\n`));
    assert.ok(!existsSync(dossier), 'dossier de l\'agent supprimé');
    assert.deepEqual(comptes(), avant, 'gestionnaires de signaux retirés');

    await agent.fermer();
    assert.equal(b.log('ssh-agent').match(/^ARGV \[-k\]$/gm)?.length, 1, 'second fermer sans effet');
    assert.ok(lignes.some((l) => l.includes('phrase de passe')), lignes.join('\n'));
  });

  it('gereSignaux (WR-05) : aucun gestionnaire de signal posé, l\'appelant s\'en charge ; fermer tue l\'agent', async () => {
    const b = banc();
    const avant = comptes();
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {}, gereSignaux: true });
    assert.deepEqual(comptes(), avant);
    await agent.fermer();
    assert.ok(b.log('ssh-agent').includes('KILL PID=4242'));
  });

  it('arrêt demandé (WR-05) pendant la phrase de passe : ssh-add tué ou non lancé, code 3, agent tué', async () => {
    const b = banc();
    const arret = new AbortController();
    arret.abort();
    const e = await sortie(ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {}, arret: arret.signal, gereSignaux: true }));
    assert.equal(e.code, 3);
    assert.ok(!b.log('ssh-add').includes('ARGV [-t]'), 'ssh-add non lancé');
    assert.match(b.log('ssh-agent'), /KILL PID=4242/);
  });

  it('clé sans phrase de passe : code 3, chemin et ssh-keygen -p nommés, aucun agent démarré', async () => {
    const b = banc('cle-sans-phrase');
    const avant = comptes();
    const lignes: string[] = [];
    const e = await sortie(ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: (l) => lignes.push(l) }));
    assert.equal(e.code, 3);
    assert.ok(e.message.includes(b.cle), e.message);
    assert.match(e.message, /ssh-keygen -p -f/);
    assert.equal(b.log('ssh-agent'), '', 'ssh-agent jamais lancé');
    assert.equal(b.log('ssh-add'), '', 'ssh-add jamais lancé');
    assert.deepEqual(comptes(), avant);
    for (const t of [e.message, ...lignes]) assert.ok(!t.includes('CLE-PUBLIQUE-FACTICE'), t);
  });

  it('ssh-add en échec : code 3 « clé non chargée », agent tué, dossier supprimé', async () => {
    const b = banc('phrase-refusee');
    const avant = comptes();
    const e = await sortie(ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {} }));
    assert.equal(e.code, 3);
    assert.match(e.message, /clé non chargée : la phrase de passe doit être tapée par Erwan dans un terminal/);
    const agentLog = b.log('ssh-agent');
    assert.match(agentLog, /^ARGV \[-k\]$/m);
    assert.match(agentLog, /KILL PID=4242 /);
    const socket = /^ARGV \[-a\] \[([^\]]+)\]/m.exec(agentLog)?.[1] as string;
    assert.ok(!existsSync(path.dirname(socket)), 'dossier supprimé');
    assert.deepEqual(comptes(), avant);
  });

  it('aucune sortie, valeur de retour ni message ne contient la clé publique imprimée par ssh-keygen', async () => {
    const textes: string[] = [];
    for (const v of ['normal', 'cle-sans-phrase', 'phrase-refusee'] as const) {
      const b = banc(v);
      try {
        const a: Agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: (l) => textes.push(l) });
        textes.push(JSON.stringify(a), a.socket);
        await a.fermer();
      } catch (e) {
        textes.push(String(e), (e as Error).message);
      }
    }
    assert.ok(textes.length > 0);
    for (const t of textes) assert.ok(!t.includes('CLE-PUBLIQUE-FACTICE'), t);
  });
});

describe('clé chargée, retirée, rechargée (CR-04, exécutables factices)', () => {
  it('resteMs suit l\'horloge depuis le chargement ; retirer lance ssh-add -D avec le socket et remet resteMs à 0', async () => {
    const b = banc();
    let t = 1_000_000;
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {}, maintenant: () => t });
    try {
      assert.equal(agent.resteMs(), DUREE_CLE_S * 1000);
      t += 14 * 60_000;
      assert.equal(agent.resteMs(), 60_000);
      t += 2 * 60_000;
      assert.equal(agent.resteMs(), 0, 'jamais négatif');
      await agent.retirer();
      assert.ok(b.log('ssh-add').includes('ARGV [-D]\n'), b.log('ssh-add'));
      assert.ok(b.log('ssh-add').split('ARGV [-D]')[1]?.includes(`ENV SSH_AUTH_SOCK=${agent.socket}\n`));
      assert.equal(agent.resteMs(), 0);
      await agent.charger();
      assert.equal(agent.resteMs(), DUREE_CLE_S * 1000);
      assert.equal(await agent.presente(), true);
      assert.ok(b.log('ssh-add').includes('ARGV [-l]\n'));
    } finally {
      await agent.fermer();
    }
  });

  it('assurerCle : temps restant suffisant, pas de rechargement ; insuffisant, rechargement puis contrôle', async () => {
    const b = banc();
    let t = 0;
    const lignes: string[] = [];
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {}, maintenant: () => t });
    const chargements = (): number => b.log('ssh-add').match(/^ARGV \[-t\]/gm)?.length ?? 0;
    try {
      await assurerCle(agent, 12 * 60_000, "avant l'activation", (l) => lignes.push(l));
      assert.equal(chargements(), 1);
      assert.equal(lignes.length, 0);
      t += 4 * 60_000;
      await assurerCle(agent, 12 * 60_000, "avant l'activation", (l) => lignes.push(l));
      assert.equal(chargements(), 2);
      assert.match(lignes[0] ?? '', /Clé dédiée avant l'activation : tapez de nouveau sa phrase de passe/);
      assert.equal(agent.resteMs(), DUREE_CLE_S * 1000);
    } finally {
      await agent.fermer();
    }
  });

  it('assurerCle : ssh-add -l répond « no identities » même après rechargement : code 3', async () => {
    const b = banc();
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {} });
    const sansCle: Agent = { ...agent, presente: async () => false, charger: async () => {} };
    try {
      const e = await sortie(assurerCle(sansCle, 60_000, "avant l'envoi", () => {}));
      assert.equal(e.code, 3);
      assert.match(e.message, /clé absente de l'agent avant l'envoi : rien n'a été fait/);
    } finally {
      await agent.fermer();
    }
  });

  it('phrase refusée au rechargement : Sortie 3, resteMs à 0', async () => {
    const b = banc();
    const agent = await ouvrirAgent({ cle: b.cle }, { exe: exeDe(b), lancer, home: HOME_AGENT, ecrire: () => {} });
    try {
      writeFileSync(path.join(b.bin, 'ssh-add'), '#!/bin/sh\nexit 1\n');
      const e = await sortie(agent.charger());
      assert.equal(e.code, 3);
      assert.equal(agent.resteMs(), 0);
    } finally {
      await agent.fermer();
    }
  });
});

describe('ouvrirAgent : signaux et sortie du processus (processus enfant, exécutables factices)', () => {
  const script = (): string => {
    const d = temp('rtp-script-');
    const p = path.join(d, 'ouvrir.ts');
    const url = (f: string): string => pathToFileURL(path.join(RACINE, f)).href;
    writeFileSync(
      p,
      `import { existsSync } from 'node:fs';
import { ouvrirAgent } from ${JSON.stringify(url('scripts/lib/deploiement/agent.ts'))};
import { resoudreExecutables } from ${JSON.stringify(url('scripts/lib/deploiement/executables.ts'))};
import { lancer } from ${JSON.stringify(url('scripts/lib/processus.ts'))};
const [bin, cle, mode, home] = process.argv.slice(2);
const exe = resoudreExecutables(['ssh-keygen', 'ssh-agent', 'ssh-add'], bin);
const agent = await ouvrirAgent({ cle }, { exe, lancer, ecrire: () => {}, home });
if (mode === 'autre') {
  process.on('SIGTERM', () => {
    process.stdout.write('autre ' + existsSync(agent.socket) + '\\n');
    void agent.fermer().then(() => process.exit(0));
  });
}
process.stdout.write('pret ' + agent.socket + '\\n');
if (mode === 'sortie') process.exit(0);
setInterval(() => {}, 1000);
`,
    );
    return p;
  };

  function enfant(b: Banc, mode: string): Promise<{ code: number | null; signal: NodeJS.Signals | null; sortie: string; socket: string }> {
    return new Promise((resolve, reject) => {
      const e = spawn(process.execPath, [script(), b.bin, b.cle, mode, HOME_AGENT], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
      let sortie = '';
      let erreurs = '';
      let socket = '';
      const minuteur = setTimeout(() => {
        e.kill('SIGKILL');
        reject(new Error(`enfant bloqué : ${sortie} ${erreurs}`));
      }, DELAI);
      e.stdout.setEncoding('utf8');
      e.stderr.setEncoding('utf8');
      e.stderr.on('data', (d: string) => {
        erreurs += d;
      });
      e.stdout.on('data', (d: string) => {
        sortie += d;
        const m = /^pret (.+)$/m.exec(sortie);
        if (m && socket === '') {
          socket = m[1] ?? '';
          if (mode !== 'sortie') e.kill('SIGTERM');
        }
      });
      e.on('close', (code, signal) => {
        clearTimeout(minuteur);
        resolve({ code, signal, sortie, socket });
      });
    });
  }

  it('SIGTERM sans autre gestionnaire : agent tué par ssh-agent -k, dossier supprimé, processus terminé par le signal', async () => {
    const b = banc();
    const r = await enfant(b, 'seul');
    assert.ok(r.socket !== '', r.sortie);
    assert.equal(r.signal, 'SIGTERM');
    assert.ok(b.log('ssh-agent').includes(`KILL PID=4242 SOCK=${r.socket}\n`));
    assert.ok(!existsSync(path.dirname(r.socket)));
  });

  it('SIGTERM avec un autre gestionnaire (retour automatique du plan 06) : l\'agent reste ouvert pour lui', async () => {
    const b = banc();
    const r = await enfant(b, 'autre');
    assert.equal(r.code, 0);
    assert.match(r.sortie, /^autre true$/m);
    assert.equal(b.log('ssh-agent').match(/^ARGV \[-k\]$/gm)?.length, 1);
    assert.ok(!existsSync(path.dirname(r.socket)));
  });

  it('sortie du processus sans fermer : l\'agent est tué quand même', async () => {
    const b = banc();
    const r = await enfant(b, 'sortie');
    assert.equal(r.code, 0);
    assert.ok(b.log('ssh-agent').includes(`KILL PID=4242 SOCK=${r.socket}\n`));
    assert.ok(!existsSync(path.dirname(r.socket)));
  });
});

// Vrais outils OpenSSH, clés de test jetables, agent propre au test.
const OUTILS = ['ssh-keygen', 'ssh-agent', 'ssh-add'].every((o) => spawnSync('sh', ['-c', `command -v ${o}`]).status === 0);

/** Lanceur des cas réels : nouvelle session (detached), donc aucun terminal de contrôle où ssh-add pourrait inviter. */
const lanceurSansTerminal: Lanceur = (l) =>
  new Promise<Resultat>((resolve) => {
    const debut = Date.now();
    const e = spawn(l.commande, l.args, { cwd: l.cwd, env: l.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let delaiDepasse = false;
    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      e.kill('SIGKILL');
    }, Math.max(l.delaiMs, DELAI));
    e.stdout.setEncoding('utf8');
    e.stderr.setEncoding('utf8');
    e.stdout.on('data', (d: string) => {
      stdout += d;
    });
    e.stderr.on('data', (d: string) => {
      stderr += d;
    });
    e.on('error', () => {
      clearTimeout(minuteur);
      resolve({ code: null, signal: null, stdout, stderr, dureeMs: Date.now() - debut, delaiDepasse });
    });
    e.on('close', (code, signal) => {
      clearTimeout(minuteur);
      resolve({ code, signal, stdout, stderr, dureeMs: Date.now() - debut, delaiDepasse });
    });
  });

/** Agents ssh dont la ligne de commande contient ce chemin (seulement ceux du test). */
const agentsDe = (motif: string): string[] => {
  const r = spawnSync('pgrep', ['-f', motif], { encoding: 'utf8' });
  return r.stdout.split('\n').filter((l) => l.trim() !== '');
};

describe('vrais outils OpenSSH, clés de test jetables', { skip: OUTILS ? false : 'ssh-keygen, ssh-agent ou ssh-add absents' }, () => {
  let dossier = '';
  let avec = '';
  let sans = '';
  const sockets: string[] = [];
  before(() => {
    dossier = temp('rtp-cles-reelles-');
    avec = path.join(dossier, 'avec-phrase');
    sans = path.join(dossier, 'sans-phrase');
    for (const [p, phrase] of [
      [avec, 'phrase-de-test-jetable-1c9a'],
      [sans, ''],
    ] as const) {
      const r = spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', phrase, '-C', 'rtp-test', '-f', p], { encoding: 'utf8', timeout: DELAI, stdio: ['ignore', 'pipe', 'pipe'] });
      assert.equal(r.status, 0, r.stderr);
    }
  });
  after(() => {
    // Filet : tout agent du test encore vivant est arrêté.
    for (const s of sockets) for (const pid of agentsDe(s)) spawnSync('kill', [pid]);
    rmSync(dossier, { recursive: true, force: true });
  });

  it('cleChiffree : true pour la clé avec phrase, false pour la clé sans phrase', async () => {
    const exe = resoudreExecutables(['ssh-keygen', 'ssh-agent', 'ssh-add'], process.env.PATH ?? '');
    assert.equal(await cleChiffree(avec, exe, lanceurSansTerminal), true);
    assert.equal(await cleChiffree(sans, exe, lanceurSansTerminal), false);
  });

  it('clé sans phrase : code 3, aucun agent démarré', async () => {
    const exe = resoudreExecutables(['ssh-keygen', 'ssh-agent', 'ssh-add'], process.env.PATH ?? '');
    const e = await sortie(ouvrirAgent({ cle: sans }, { exe, lancer: lanceurSansTerminal, home: HOME_AGENT, ecrire: () => {} }));
    assert.equal(e.code, 3);
    assert.equal(agentsDe(dossier).length, 0);
  });

  it('clé avec phrase, aucun terminal : ssh-add ne peut pas inviter, code 3 « clé non chargée », agent arrêté', async () => {
    const exe = resoudreExecutables(['ssh-keygen', 'ssh-agent', 'ssh-add'], process.env.PATH ?? '');
    const lignes: string[] = [];
    const lanceurNote: Lanceur = async (l) => {
      if (l.args[0] === '-a' && l.args[1] !== undefined) sockets.push(l.args[1]);
      return lanceurSansTerminal(l);
    };
    const e = await sortie(ouvrirAgent({ cle: avec }, { exe, lancer: lanceurNote, home: HOME_AGENT, ecrire: (l) => lignes.push(l) }));
    assert.equal(e.code, 3);
    assert.match(e.message, /clé non chargée/);
    const socket = sockets.at(-1) as string;
    assert.ok(socket !== undefined);
    assert.equal(agentsDe(socket).length, 0, 'agent du test arrêté');
    assert.ok(!existsSync(path.dirname(socket)));
  });

  it('vrai agent, ssh-add factice : agent vivant après ouverture, arrêté par fermer', async () => {
    const b = banc();
    const reel = resoudreExecutables(['ssh-keygen', 'ssh-agent'], process.env.PATH ?? '');
    const exe = { ...reel, ...resoudreExecutables(['ssh-add'], b.bin) };
    const agent = await ouvrirAgent({ cle: avec }, { exe, lancer: lanceurSansTerminal, home: HOME_AGENT, ecrire: () => {} });
    sockets.push(agent.socket);
    try {
      assert.ok(existsSync(agent.socket));
      assert.equal(agentsDe(agent.socket).length, 1, 'un agent du test vivant');
    } finally {
      await agent.fermer();
    }
    // ssh-agent -k envoie SIGTERM : laisser au processus le temps de finir.
    const fin = Date.now() + DELAI;
    while (agentsDe(agent.socket).length > 0 && Date.now() < fin) await new Promise((r) => setTimeout(r, 200));
    assert.equal(agentsDe(agent.socket).length, 0, 'agent du test arrêté');
    assert.ok(!existsSync(path.dirname(agent.socket)));
  });
});
