// `npm run deploy:local -- retour [<sha>]` (LOC-03, D-08 ; T-09.2-25, T-09.2-27, T-09.2-28, T-09.2-30) contre le
// faux serveur de tests/helpers/faux-serveur.ts : la vraie commande forcée ops/commande-deploiement.sh tourne derrière
// des ssh, ssh-agent, ssh-add, ssh-keygen, rsync et curl factices. Aucun réseau, aucun vrai serveur, aucun agent ssh
// réel, HOME temporaire (journal et verrou compris). La confirmation est un confirmateur factice passé à
// executerRetour ; la CLI elle-même n'est lancée qu'avec une entrée standard en tube, où elle refuse avant tout
// travail : le vrai /dev/tty de l'utilisateur n'est jamais ouvert.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancer as lancerReel, type Lanceur } from '../../scripts/lib/processus.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { cheminsLocaux, lireConfig } from '../../scripts/lib/deploiement/config.ts';
import { resoudreExecutables, type Executables } from '../../scripts/lib/deploiement/executables.ts';
import type { Agent } from '../../scripts/lib/deploiement/agent.ts';
import { appelerVerbe, envoyer, lireEtat } from '../../scripts/lib/deploiement/transport.ts';
import type { Confirmateur } from '../../scripts/lib/deploiement/confirmation.ts';
import { executerRetour, type ContexteRetour, type OptionsRetour } from '../../scripts/lib/deploiement/retour.ts';
import { ajouterJournal } from '../../scripts/lib/deploiement/journal.ts';
import { executer } from '../../scripts/deploy-local.ts';
import { CLE_FACTICE, HOTE_FACTICE, MOT_DE_PASSE_FACTICE, UTILISATEUR_FACTICE, creerFauxServeur, type FauxServeur, type OptionsFauxServeur } from '../helpers/faux-serveur.ts';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RACINE, 'scripts', 'deploy-local.ts');
const sha = (n: number | string): string => crypto.createHash('sha1').update(`version-${n}`).digest('hex');
const A = sha('A');
const B = sha('B');
const JUSTIFICATION = 'page des thèmes cassée, retrait'; // 31 caractères
const JUSTIFICATION_25 = 'retrait : page cassée !!!'; // 25 caractères
const HORS_GEL = new Date('2026-11-18T12:00:00Z');
const SECRETS = [MOT_DE_PASSE_FACTICE, CLE_FACTICE, HOTE_FACTICE, UTILISATEUR_FACTICE];

const RAISON_MV = 'GNU mv requis';
const SONDE = creerFauxServeur();
const BASCULE = SONDE.basculePossible;
SONDE.detruire();

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});
/** Tout texte rendu par le code testé et tout journal écrit, contrôlés à la fin (fuite). */
const sorties: string[] = [];

interface Banc {
  faux: FauxServeur;
  home: string;
}

function banc(o: OptionsFauxServeur = {}, surcharges: Partial<Record<string, string>> = {}): Banc {
  const faux = creerFauxServeur(o);
  nettoyages.push(() => faux.detruire());
  const home = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-home-retour-')));
  nettoyages.push(() => rmSync(home, { recursive: true, force: true }));
  faux.config(home, surcharges);
  return { faux, home };
}

function dist(s: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-dist-')));
  nettoyages.push(() => rmSync(d, { recursive: true, force: true }));
  writeFileSync(path.join(d, 'index.html'), `<!doctype html><title>${s}</title>\n`);
  writeFileSync(path.join(d, 'version.json'), JSON.stringify({ commit: s, date: '2026-11-18T00:00:00Z' }));
  return d;
}

/** Envoie et active les versions données, dans l'ordre, par la vraie commande forcée (préparation du banc). */
async function activer(b: Banc, versions: { s: string }[]): Promise<void> {
  b.faux.chargerCle();
  const cfg = lireConfig(b.home);
  const exe: Executables = {
    ...resoudreExecutables(['ssh'], b.faux.env.PATH ?? ''),
    rsync: resoudreExecutables([cfg.rsync], b.faux.env.PATH ?? '')[cfg.rsync] as { chemin: string; empreinte: string },
  };
  const agent: Pick<Agent, 'socket'> = { socket: path.join(b.faux.racine, 'agent.sock') };
  for (const v of versions) {
    await envoyer(cfg, agent, exe, dist(v.s), cfg.cible, v.s, lancerReel);
    await appelerVerbe(cfg, agent, exe, 'activer', [cfg.cible, v.s], lancerReel);
  }
  // Les appels de préparation ne comptent pas dans les journaux observés ensuite.
  rmSync(path.join(b.faux.racine, 'logs', 'ssh'), { recursive: true, force: true });
  rmSync(path.join(b.faux.racine, 'logs', 'rsync'), { recursive: true, force: true });
  mkdirSync(path.join(b.faux.racine, 'logs', 'ssh'));
  mkdirSync(path.join(b.faux.racine, 'logs', 'rsync'));
}

async function courant(b: Banc): Promise<string | null> {
  b.faux.chargerCle();
  const cfg = lireConfig(b.home);
  const exe = resoudreExecutables(['ssh'], b.faux.env.PATH ?? '');
  const agent: Pick<Agent, 'socket'> = { socket: path.join(b.faux.racine, 'agent.sock') };
  const e = lireEtat(await appelerVerbe(cfg, agent, exe, 'etat', [cfg.cible], lancerReel));
  return e?.courant ?? null;
}

/** Confirmateur factice : note la phrase demandée, l'accepte si c'est celle attendue, sinon code 3. */
function confirmateur(attendue: string | null, action?: () => void | Promise<void>): { confirmer: Confirmateur; vues: string[] } {
  const vues: string[] = [];
  return {
    vues,
    confirmer: async (p) => {
      vues.push(p);
      if (attendue === null || p !== attendue) throw new Sortie(3, "confirmation refusée : rien n'a été envoyé");
      if (action !== undefined) await action();
    },
  };
}

function horloge(instants: Date[]): () => Date {
  let i = 0;
  return () => {
    const d = instants[Math.min(i, instants.length - 1)] as Date;
    i++;
    return new Date(d.getTime());
  };
}

async function retour(
  b: Banc,
  o: Partial<OptionsRetour>,
  c: Partial<ContexteRetour> & { confirmer: Confirmateur },
): Promise<{ code: number; texte: string }> {
  const lignes: string[] = [];
  const pathAvant = process.env.PATH;
  process.env.PATH = b.faux.env.PATH;
  const lancerFaux: Lanceur = (l) => lancerReel({ ...l, env: { ...l.env, PATH: b.faux.env.PATH ?? '' } });
  try {
    const code = await executerRetour(
      { version: '', urgence: false, justification: '', dryRun: false, ...o },
      { lancer: lancerFaux, maintenant: () => new Date(HORS_GEL.getTime()), home: b.home, racine: RACINE, ecrire: (l) => lignes.push(l), ...c },
    );
    sorties.push(...lignes);
    return { code, texte: lignes.join('\n') };
  } finally {
    process.env.PATH = pathAvant;
  }
}

const verbesSsh = (b: Banc): string[] => b.faux.journal('ssh').map((a) => a.at(-1) ?? '');

function journal(b: Banc): Record<string, unknown>[] {
  const f = cheminsLocaux(b.home).journal;
  if (!existsSync(f)) return [];
  const texte = readFileSync(f, 'utf8');
  sorties.push(texte);
  return texte
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('executerRetour contre la vraie commande forcée', () => {
  it('A puis B activées, retour vers la précédente : code 0, courant A, journal succes precedent B', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const c = confirmateur('retour essai precedente');
    const { code, texte } = await retour(b, {}, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, ['retour essai precedente']);
    assert.equal(await courant(b), A);
    // WR-03 : etat relu après la confirmation, avant le verbe retour.
    assert.deepEqual(verbesSsh(b).slice(0, 4), ['etat essai', 'etat essai', 'retour essai', 'etat essai']);
    assert.match(texte, /Cible : essai/);
    assert.match(texte, /Version à remettre en ligne : la précédente/);
    assert.ok(texte.includes(`Version en ligne : ${B}`), texte);
    assert.ok(texte.includes(`/version.json`) && texte.includes(A), texte);
    assert.match(texte, /Retour arrière : début \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z, fin \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z \(UTC\)/);
    const j = journal(b);
    assert.equal(j.length, 1);
    assert.deepEqual(
      { action: j[0]?.action, cible: j[0]?.cible, resultat: j[0]?.resultat, commit: j[0]?.commit, precedent: j[0]?.precedent, urgence: j[0]?.urgence },
      { action: 'retour', cible: 'essai', resultat: 'succes', commit: A, precedent: B, urgence: false },
    );
  });

  it('retour <A> : phrase « retour essai <A7> », courant A, verbe retour essai <A>', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const c = confirmateur(`retour essai ${A.slice(0, 7)}`);
    const { code, texte } = await retour(b, { version: A }, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, [`retour essai ${A.slice(0, 7)}`]);
    assert.ok(verbesSsh(b).includes(`retour essai ${A}`));
    assert.equal(await courant(b), A);
    assert.equal(journal(b)[0]?.resultat, 'succes');
  });

  it('CR-04 : clé retirée pendant l\'écran, rechargée après la confirmation (phrase de passe tapée de nouveau), retour fait', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({ exigerCle: true });
    await activer(b, [{ s: A }, { s: B }]);
    let pendant: boolean | null = null;
    const { code, texte } = await retour(b, {}, confirmateur('retour essai precedente', () => {
      pendant = b.faux.cleChargee();
    }));
    assert.equal(code, 0, texte);
    assert.equal(pendant, false, 'clé absente du faux agent pendant la confirmation');
    assert.deepEqual(b.faux.journal('ssh-add').map((a) => a[1]).filter((x) => x !== '-l'), ['-t', '-D', '-t']);
    assert.match(texte, /Clé dédiée avant le retour : tapez de nouveau sa phrase de passe/);
    assert.equal(await courant(b), A);
  });

  it('CR-04 : phrase de passe refusée au rechargement : sortie 3, aucun verbe retour', async () => {
    const b = banc({ exigerCle: true, chargementsAdmis: 1 });
    b.faux.chargerCle();
    b.faux.servirCommit('essai', A, dist(A));
    const { code, texte } = await retour(b, { version: A }, confirmateur(`retour essai ${A.slice(0, 7)}`));
    assert.equal(code, 3, texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')), verbesSsh(b).join(' | '));
  });

  it('commit absent du serveur : code 66 du serveur, sortie 1, journal echec', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const absent = sha('absent');
    const { code, texte } = await retour(b, { version: absent }, confirmateur(`retour essai ${absent.slice(0, 7)}`));
    assert.equal(code, 1, texte);
    assert.match(texte, /code 66/);
    assert.equal(await courant(b), B);
    const j = journal(b);
    assert.equal(j.length, 1);
    assert.equal(j[0]?.resultat, 'echec');
    assert.equal(j[0]?.precedent, B);
  });

  it('confirmation refusée (code 3) : sortie 3, seul etat essai a été appelé, journal refus', async () => {
    const b = banc();
    b.faux.servirCommit('essai', A, dist(A));
    const { code, texte } = await retour(b, {}, confirmateur(null));
    assert.equal(code, 3, texte);
    assert.match(texte, /confirmation refusée : rien n'a été envoyé/);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    const j = journal(b);
    assert.equal(j.length, 1);
    assert.equal(j[0]?.resultat, 'refus');
  });

  it('clé sans phrase de passe : sortie 3, aucun appel ssh ni agent', async () => {
    const b = banc({ cleSansPhrase: true });
    const c = confirmateur('retour essai precedente');
    const { code } = await retour(b, {}, c);
    assert.equal(code, 3);
    assert.equal(b.faux.journal('ssh').length, 0);
    assert.equal(b.faux.journal('ssh-agent').length, 0);
    assert.equal(b.faux.journal('ssh-add').length, 0);
    assert.deepEqual(c.vues, []);
  });
});

describe('cible du retour revérifiée, retrait d\'urgence signalé (WR-03)', () => {
  const C = sha('C');

  it('current changé entre l\'écran et le verbe (run GitHub) : code 1, aucun verbe retour', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const { code, texte } = await retour(b, {}, confirmateur('retour essai precedente', () => activer(b, [{ s: C }])));
    assert.equal(code, 1, texte);
    assert.ok(texte.includes(`la version en ligne a changé depuis l'écran (${B} puis ${C}) : rien n'a été remis en ligne, relancer`), texte);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')), verbesSsh(b).join(' | '));
    assert.equal(await courant(b), C);
  });

  it('la version en ligne est un retrait d\'urgence au journal local : avertissement et phrase distincte', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const cfg = lireConfig(b.home);
    ajouterJournal(b.home, { date: '2026-11-18T10:00:00Z', action: 'deployer', cible: 'essai', commit: B, precedent: A, resultat: 'succes', urgence: true, justification: 'retrait de la mesure publiée sans source' }, cfg, () => {});
    const c = confirmateur('retour essai precedente malgre retrait');
    const { code, texte } = await retour(b, {}, c);
    assert.equal(code, 0, texte);
    assert.deepEqual(c.vues, ['retour essai precedente malgre retrait']);
    assert.match(texte, /Attention : la version en ligne est un retrait d'urgence \(journal local\) ; le retour remettra en ligne le contenu retiré/);
    assert.equal(await courant(b), A);
  });

  it('phrase ordinaire refusée quand la version en ligne est un retrait d\'urgence : code 3, aucun verbe retour', async () => {
    const b = banc();
    b.faux.chargerCle();
    b.faux.servirCommit('essai', B, dist(B));
    ajouterJournal(b.home, { date: '2026-11-18T10:00:00Z', action: 'retour', cible: 'essai', commit: B, precedent: A, resultat: 'succes', urgence: true, justification: 'retrait pendant le gel du premier tour' }, lireConfig(b.home), () => {});
    const c = confirmateur(`retour essai ${A.slice(0, 7)}`);
    const { code } = await retour(b, { version: A }, c);
    assert.equal(code, 3);
    assert.deepEqual(c.vues, [`retour essai ${A.slice(0, 7)} malgre retrait`]);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
  });

  it('le serveur dit avoir quitté une autre version que celle de l\'écran : code 1, vérifier avec etat', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const lancerAltere: Lanceur = async (l) => {
      const r = await lancerReel({ ...l, env: { ...l.env, PATH: b.faux.env.PATH ?? '' } });
      if (l.args.at(-1) === 'retour essai') return { ...r, stdout: r.stdout.replace(`precedent=${B}`, `precedent=${C}`) };
      return r;
    };
    const { code, texte } = await retour(b, {}, { ...confirmateur('retour essai precedente'), lancer: lancerAltere });
    assert.equal(code, 1, texte);
    assert.ok(texte.includes(`le serveur a quitté ${C} au lieu de ${B} montrée à l'écran : vérifier avec npm run deploy:local -- etat`), texte);
  });
});

describe('signal reçu avant le verbe retour (WR-05)', () => {
  it('SIGINT pendant la confirmation : code 1, aucun verbe retour, agent fermé, verrou rendu, journal refus', async () => {
    const b = banc();
    b.faux.chargerCle();
    b.faux.servirCommit('essai', A, dist(A));
    let signalVu: AbortSignal | undefined;
    const { code, texte } = await retour(b, { version: A }, {
      confirmer: async (_p, o) => {
        signalVu = o?.arret;
        process.emit('SIGINT', 'SIGINT');
      },
    });
    assert.equal(code, 1, texte);
    assert.equal(signalVu?.aborted, true);
    assert.match(texte, /interrompu par SIGINT avant le retour : rien n'a été remis en ligne/);
    assert.ok(!verbesSsh(b).some((v) => v.startsWith('retour')));
    assert.ok(b.faux.journal('ssh-agent').some((a) => a[1] === '-k'), 'agent arrêté');
    assert.equal(journal(b).at(-1)?.resultat, 'refus');
    assert.equal(existsSync(cheminsLocaux(b.home).verrou), false, 'verrou rendu');
    assert.equal(process.listenerCount('SIGINT'), 0, 'gestionnaires retirés');
  });
});

describe('garde de gel (CR-02)', () => {
  it('gel au départ : sortie 1 avant tout appel (ssh-keygen compris)', async () => {
    const b = banc();
    const c = confirmateur('retour essai precedente');
    const { code, texte } = await retour(b, {}, { ...c, maintenant: () => new Date('2027-04-18T12:00:00+02:00') });
    assert.equal(code, 1, texte);
    assert.match(texte, /gel du tour 1/);
    assert.equal(b.faux.journal('ssh').length, 0);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
    assert.deepEqual(c.vues, []);
    assert.equal(journal(b)[0]?.resultat, 'refus');
  });

  it('gel et retrait d\'urgence justifié (25 caractères) : le retour a lieu', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    const { code, texte } = await retour(
      b,
      { urgence: true, justification: JUSTIFICATION_25 },
      { ...confirmateur('retour essai precedente'), maintenant: () => new Date('2027-04-18T12:00:00+02:00') },
    );
    assert.equal(code, 0, texte);
    assert.equal(await courant(b), A);
    const j = journal(b);
    assert.equal(j[0]?.urgence, true);
    assert.equal(j[0]?.justification, JUSTIFICATION_25);
  });

  it('confirmation tapée à 23:59:30 la veille du gel, gel commencé à 00:00:30 : sortie 1, aucun verbe retour', async () => {
    const b = banc();
    b.faux.servirCommit('essai', A, dist(A));
    const c = confirmateur('retour essai precedente');
    const { code, texte } = await retour(b, {}, { ...c, maintenant: horloge([new Date('2027-04-16T23:59:30+02:00'), new Date('2027-04-17T00:00:30+02:00')]) });
    assert.equal(code, 1, texte);
    assert.deepEqual(c.vues, ['retour essai precedente']);
    assert.deepEqual(verbesSsh(b), ['etat essai']);
    assert.match(texte, /2027-04-17 tombe dans le gel du tour 1/);
    assert.equal(journal(b)[0]?.resultat, 'refus');
  });

  it('retrait d\'urgence sans justification valable : sortie 1, aucun appel', async () => {
    const b = banc();
    const { code } = await retour(b, { urgence: true, justification: 'trop court' }, confirmateur('retour essai precedente'));
    assert.equal(code, 1);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
  });
});

describe('répétition à blanc, vérifications, usage', () => {
  it('--dry-run : sortie 0, aucun appel de ssh, ssh-agent, ssh-add ni ssh-keygen, aucun journal', async () => {
    const b = banc();
    const c = confirmateur(null);
    const { code, texte } = await retour(b, { dryRun: true, version: A }, c);
    assert.equal(code, 0, texte);
    assert.match(texte, /répétition à blanc : aucun contact avec le serveur/);
    assert.match(texte, /Cible : essai/);
    assert.ok(texte.includes(A));
    assert.match(texte, /hors des fenêtres de gel : autorisé/);
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen', 'curl', 'rsync'] as const) assert.equal(b.faux.journal(n).length, 0, n);
    assert.deepEqual(c.vues, []);
    assert.equal(existsSync(cheminsLocaux(b.home).journal), false);
    const t2 = await retour(b, { dryRun: true }, c);
    assert.equal(t2.code, 0);
    assert.match(t2.texte, /précédente/);
  });

  it('/version.json ne sert pas le commit remis en ligne : sortie 1, journal echec', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc();
    await activer(b, [{ s: A }, { s: B }]);
    // La commande forcée refuse d'activer un version.json faux : il est altéré après coup, dans la version rangée.
    const fichier = path.join(b.faux.base, 'essai', 'releases', A, 'version.json');
    chmodSync(path.dirname(fichier), 0o755);
    rmSync(fichier, { force: true });
    writeFileSync(fichier, JSON.stringify({ commit: sha('autre'), date: '2026-11-18T00:00:00Z' }));
    const { code, texte } = await retour(b, {}, confirmateur('retour essai precedente'));
    assert.equal(code, 1, texte);
    assert.ok(texte.includes(`/version.json ne sert pas le commit ${A}`), texte);
    assert.equal(journal(b)[0]?.resultat, 'echec');
  });

  it('RTP_URL vide : la vérification HTTPS est dite sautée, aucun appel de curl', { skip: !BASCULE && RAISON_MV }, async () => {
    const b = banc({}, { RTP_URL: '' });
    await activer(b, [{ s: A }, { s: B }]);
    const { code, texte } = await retour(b, {}, confirmateur('retour essai precedente'));
    assert.equal(code, 0, texte);
    assert.match(texte, /vérification HTTPS sautée : RTP_URL vide/);
    assert.equal(b.faux.journal('curl').length, 0);
  });

  it('version ABC : sortie 2, aucun appel', async () => {
    const b = banc();
    const { code, texte } = await retour(b, { version: 'ABC' }, confirmateur(null));
    assert.equal(code, 2, texte);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
    const t2 = await retour(b, { version: A.toUpperCase(), dryRun: true }, confirmateur(null));
    assert.equal(t2.code, 2);
  });

  it('verrou tenu par un processus vivant : sortie 2 qui nomme son pid, aucun appel', async () => {
    const b = banc();
    const verrou = cheminsLocaux(b.home).verrou;
    mkdirSync(verrou, { recursive: true });
    writeFileSync(path.join(verrou, 'pid'), String(process.pid));
    const { code, texte } = await retour(b, {}, confirmateur(null));
    assert.equal(code, 2, texte);
    assert.ok(texte.includes(`pid ${process.pid}`), texte);
    assert.equal(b.faux.journal('ssh-keygen').length, 0);
    assert.ok(existsSync(verrou), 'le verrou d\'un autre n\'est pas retiré');
  });

  it('le verrou est rendu après un retour, même en échec', async () => {
    const b = banc();
    await retour(b, {}, confirmateur(null));
    assert.equal(existsSync(cheminsLocaux(b.home).verrou), false);
  });

  for (const argv of [
    ['retour', '--justification', JUSTIFICATION],
    ['retour', '--oui'],
    ['retour', '--yes'],
    ['retour', A, 'en-trop'],
    ['etat', '--dry-run'],
    ['etat', '--urgence'],
  ]) {
    it(`CLI ${JSON.stringify(argv)} : sortie 2 avec l'usage, aucun appel`, async () => {
      const b = banc();
      const lignes: string[] = [];
      const code = await executer(argv, { home: b.home, racine: RACINE, ecrire: (l) => lignes.push(l) });
      assert.equal(code, 2, lignes.join('\n'));
      assert.match(lignes.join('\n'), /Usage : npm run deploy:local -- etat/);
      assert.match(lignes.join('\n'), /retour \[<sha>\]/);
      assert.equal(b.faux.journal('ssh-keygen').length, 0);
    });
  }
});

describe('CLI lancée sans terminal (T-09.2-25)', () => {
  function lancerCli(b: Banc, argv: string[]): Promise<{ code: number | null; sortie: string }> {
    return new Promise((resolve) => {
      const enfant = spawn(process.execPath, [SCRIPT, ...argv], {
        cwd: RACINE,
        env: { HOME: b.home, PATH: b.faux.env.PATH ?? '', TZ: 'Europe/Paris' },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });
      let sortie = '';
      enfant.stdout.setEncoding('utf8');
      enfant.stderr.setEncoding('utf8');
      enfant.stdout.on('data', (d: string) => (sortie += d));
      enfant.stderr.on('data', (d: string) => (sortie += d));
      enfant.stdin.end(`retour essai precedente\n`);
      const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 300_000);
      enfant.on('close', (code) => {
        clearTimeout(minuteur);
        sorties.push(sortie);
        resolve({ code, sortie });
      });
    });
  }

  it('entrée standard en tube : sortie 3 avant tout travail ; ssh, ssh-agent, ssh-add, ssh-keygen jamais lancés', async () => {
    const b = banc();
    const { code, sortie } = await lancerCli(b, ['retour']);
    assert.equal(code, 3, sortie);
    assert.match(sortie, /terminal/);
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen'] as const) assert.equal(b.faux.journal(n).length, 0, n);
    assert.equal(existsSync(cheminsLocaux(b.home).journal), false);
    assert.equal(existsSync(path.dirname(cheminsLocaux(b.home).verrou)), false, 'aucun verrou pris');
  });

  it('même commande avec --dry-run : sortie 0, aucun appel', async () => {
    const b = banc();
    // Retrait d'urgence justifié : le cas passe quel que soit le jour où la suite tourne (gel d'avril et mai 2027).
    const { code, sortie } = await lancerCli(b, ['retour', '--dry-run', '--urgence', '--justification', JUSTIFICATION]);
    assert.equal(code, 0, sortie);
    assert.match(sortie, /répétition à blanc : aucun contact avec le serveur/);
    for (const n of ['ssh', 'ssh-agent', 'ssh-add', 'ssh-keygen'] as const) assert.equal(b.faux.journal(n).length, 0, n);
  });
});

describe('fuite', () => {
  it('ni mot de passe, ni clé, ni hôte, ni utilisateur dans une sortie ou un journal', () => {
    assert.ok(sorties.length > 10);
    for (const t of sorties) for (const s of SECRETS) assert.ok(!t.includes(s), `${s} dans : ${t}`);
  });
});
