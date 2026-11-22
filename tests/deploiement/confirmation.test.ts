// Confirmation humaine (D-06, T-09.2-25) et journal local (D-10, T-09.2-28, T-09.2-29) du déploiement depuis le Mac.
// Le vrai /dev/tty de l'utilisateur n'est jamais ouvert ici : confirmerSurTerminal n'est joué que dans un processus
// enfant détaché (setsid, sans terminal de contrôle), où l'ouverture de /dev/tty échoue tout de suite. HOME temporaire
// pour le journal : aucun fichier réel de l'utilisateur n'est touché.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { lignesEcran, lireConfirmation, phraseAttendue, verifierPhrase } from '../../scripts/lib/deploiement/confirmation.ts';
import { PassThrough } from 'node:stream';
import { ajouterJournal, type EntreeJournal } from '../../scripts/lib/deploiement/journal.ts';
import { cheminsLocaux } from '../../scripts/lib/deploiement/config.ts';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE_CONFIRMATION = pathToFileURL(path.resolve(ICI, '..', '..', 'scripts', 'lib', 'deploiement', 'confirmation.ts')).href;
const sha = (n: number | string): string => crypto.createHash('sha1').update(`version-${n}`).digest('hex');
const A = sha('a');
const B = sha('b');
const CFG = { hote: 'serveur.exemple.invalid', utilisateur: 'deploy-factice', url: 'https://essai.exemple.invalid/' };

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});

function homeTemporaire(): string {
  const h = realpathSync(mkdtempSync(path.join(tmpdir(), 'rtp-home-journal-')));
  nettoyages.push(() => rmSync(h, { recursive: true, force: true }));
  return h;
}

function attendreSortie(f: () => void, code: number, motif: RegExp): void {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof Sortie, `Sortie attendue, reçu ${String(e)}`);
    assert.equal(e.code, code, e.message);
    assert.match(e.message, motif);
    return;
  }
  assert.fail('Sortie attendue');
}

describe('phraseAttendue', () => {
  it('quatre formes, avec un commit (7 caractères) et avec null (precedente)', () => {
    assert.equal(phraseAttendue('deployer', 'essai', A), `deployer essai ${A.slice(0, 7)}`);
    assert.equal(phraseAttendue('deployer', 'production', A), `deployer en production ${A.slice(0, 7)}`);
    assert.equal(phraseAttendue('retour', 'essai', A), `retour essai ${A.slice(0, 7)}`);
    assert.equal(phraseAttendue('retour', 'production', A), `retour en production ${A.slice(0, 7)}`);
    assert.equal(phraseAttendue('retour', 'essai', null), 'retour essai precedente');
    assert.equal(phraseAttendue('retour', 'production', null), 'retour en production precedente');
  });

  it('refuse un déploiement sans commit, un commit mal formé, une action ou une cible inconnues', () => {
    assert.throws(() => phraseAttendue('deployer', 'essai', null));
    assert.throws(() => phraseAttendue('deployer', 'essai', 'ABC'));
    assert.throws(() => phraseAttendue('effacer' as 'retour', 'essai', A));
    assert.throws(() => phraseAttendue('retour', 'prod' as 'essai', A));
  });
});

describe('verifierPhrase', () => {
  const phrase = phraseAttendue('deployer', 'essai', A);

  it('phrase exacte, avec ou sans fin de ligne : acceptée', () => {
    verifierPhrase(phrase, phrase);
    verifierPhrase(`${phrase}\n`, phrase);
    verifierPhrase(`${phrase}\r\n`, phrase);
  });

  for (const [nom, saisie] of [
    ['autre commit', `deployer essai ${B.slice(0, 7)}`],
    ['autre cible', `deployer en production ${A.slice(0, 7)}`],
    ['espace final', `${phrase} \n`],
    ['espace initial', ` ${phrase}`],
    ['majuscules', phrase.toUpperCase()],
    ['vide', ''],
    ['oui', 'oui'],
    ['deux lignes', `${phrase}\n${phrase}\n`],
  ] as const) {
    it(`${nom} : code 3, rien n'est envoyé`, () => {
      attendreSortie(() => verifierPhrase(saisie, phrase), 3, /confirmation refusée : rien n'a été envoyé/);
    });
  }
});

describe('confirmerSurTerminal', () => {
  it('processus sans terminal de contrôle (détaché, entrées en tube) : code 3 « aucun terminal », sans attendre', async () => {
    const script = `
      const m = await import(${JSON.stringify(MODULE_CONFIRMATION)});
      try {
        await m.confirmerSurTerminal('retour essai precedente');
        process.stdout.write('CONFIRME');
        process.exit(0);
      } catch (e) {
        process.stdout.write('CODE=' + e.code + ' ' + e.message);
        process.exit(9);
      }`;
    const enfant = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe', detached: true, env: { PATH: process.env.PATH ?? '' } });
    let sortie = '';
    enfant.stdout.setEncoding('utf8');
    enfant.stdout.on('data', (d: string) => {
      sortie += d;
    });
    enfant.stdin.end('retour essai precedente\n');
    const minuteur = setTimeout(() => enfant.kill('SIGKILL'), 60_000);
    const code = await new Promise<number | null>((r) => enfant.on('close', (c) => r(c)));
    clearTimeout(minuteur);
    assert.equal(code, 9, sortie);
    assert.match(sortie, /^CODE=3 /);
    assert.match(sortie, /aucun terminal : la confirmation doit être tapée par Erwan/);
    assert.ok(!sortie.includes('CONFIRME'));
  });
});

describe('lireConfirmation (flux factice ; WR-05 : lecture asynchrone, arrêt possible)', () => {
  const PHRASE = 'retour essai precedente';
  const plusTard = (ms: number, f: () => void): void => {
    setTimeout(f, ms);
  };

  it('ligne tapée après l\'invite : rendue avec sa fin de ligne, consigne écrite', async () => {
    const flux = new PassThrough();
    const ecrit: string[] = [];
    const p = lireConfirmation(flux, (t) => ecrit.push(t), PHRASE, { vidageMs: 10 });
    plusTard(80, () => flux.write(`${PHRASE}\nreste ignoré\n`));
    assert.equal(await p, `${PHRASE}\n`);
    assert.ok(ecrit.join('').includes(`Pour confirmer, tapez exactement : ${PHRASE}\n> `), ecrit.join(''));
  });

  it('arrêt demandé pendant l\'attente (Ctrl-C) : Sortie 3 tout de suite, sans attendre la touche Entrée', async () => {
    const flux = new PassThrough();
    const arret = new AbortController();
    const debut = Date.now();
    const p = lireConfirmation(flux, () => {}, PHRASE, { arret: arret.signal, vidageMs: 10 });
    plusTard(50, () => arret.abort());
    await assert.rejects(p, (e: unknown) => e instanceof Sortie && e.code === 3 && /confirmation interrompue par un signal/.test(e.message));
    assert.ok(Date.now() - debut < 10_000);
    assert.equal(flux.listenerCount('data'), 0, 'lecture arrêtée');
  });

  it('arrêt déjà demandé : Sortie 3, rien n\'est écrit', async () => {
    const arret = new AbortController();
    arret.abort();
    const ecrit: string[] = [];
    await assert.rejects(lireConfirmation(new PassThrough(), (t) => ecrit.push(t), PHRASE, { arret: arret.signal }), (e: unknown) => e instanceof Sortie && e.code === 3);
    assert.equal(ecrit.length, 0);
  });

  it('fin du flux (Ctrl-D) avant la fin de ligne : saisie incomplète rendue, puis refusée', async () => {
    const flux = new PassThrough();
    const p = lireConfirmation(flux, () => {}, PHRASE, { vidageMs: 10 });
    plusTard(80, () => flux.end('retour ess'));
    const saisie = await p;
    assert.equal(saisie, 'retour ess');
    attendreSortie(() => verifierPhrase(saisie, PHRASE), 3, /confirmation refusée/);
  });

  it('plus de 1024 octets sans fin de ligne : lecture arrêtée, saisie refusée', async () => {
    const flux = new PassThrough();
    const p = lireConfirmation(flux, () => {}, PHRASE, { vidageMs: 10 });
    plusTard(80, () => flux.write('x'.repeat(2000)));
    const saisie = await p;
    assert.ok(saisie.length > 1024);
    attendreSortie(() => verifierPhrase(saisie, PHRASE), 3, /confirmation refusée/);
  });
});

describe('lignesEcran', () => {
  it('production en capitales ; champs renseignés affichés ; absents jamais imprimés', () => {
    const lignes = lignesEcran({ action: 'deployer', cible: 'production', commit: A, sujet: 'feat: exemple', enLigne: B, empreinte: 'f'.repeat(64) });
    const texte = lignes.join('\n');
    assert.match(texte, /PRODUCTION/);
    assert.ok(texte.includes(A) && texte.includes('feat: exemple') && texte.includes(B) && texte.includes('f'.repeat(64)));
    assert.ok(!/undefined|null/.test(texte), texte);
    assert.ok(!/reçu|Fichiers|rsync|gel/i.test(texte), texte);
  });

  it('essai en minuscules ; retour vers la précédente ; aucune version en ligne dite en clair ; tous les champs', () => {
    const t1 = lignesEcran({ action: 'retour', cible: 'essai', commit: null, enLigne: null }).join('\n');
    assert.match(t1, /Cible : essai/);
    assert.ok(!/ESSAI|PRODUCTION/.test(t1));
    assert.match(t1, /précédente/);
    assert.match(t1, /aucune version en ligne/);
    const t2 = lignesEcran({
      action: 'deployer',
      cible: 'essai',
      commit: A,
      sujet: 's',
      enLigne: B,
      dateRecu: '2026-11-18T10:00:00Z',
      fichiers: '12 changés',
      empreinte: 'e'.repeat(64),
      rsync: 'rsync3',
      gel: '2026-11-18 hors des fenêtres de gel : autorisé',
    }).join('\n');
    for (const attendu of ['2026-11-18T10:00:00Z', '12 changés', 'e'.repeat(64), 'rsync3', 'hors des fenêtres de gel']) assert.ok(t2.includes(attendu), attendu);
    assert.ok(!/undefined|null/.test(t2), t2);
  });
});

describe('ajouterJournal', () => {
  const base = (o: Partial<EntreeJournal> = {}): EntreeJournal => ({
    date: '2026-11-18T10:00:00.000Z',
    action: 'retour',
    cible: 'essai',
    commit: A,
    precedent: B,
    resultat: 'succes',
    urgence: false,
    ...o,
  });

  it('une ligne JSON par appel, dossier 0700, fichier 0600, clés exactes', () => {
    const home = homeTemporaire();
    const fichier = cheminsLocaux(home).journal;
    assert.equal(ajouterJournal(home, base(), CFG), true);
    assert.equal(ajouterJournal(home, base({ action: 'deployer', resultat: 'echec', commit: null, precedent: null, message: 'échec' }), CFG), true);
    const lignes = readFileSync(fichier, 'utf8').split('\n');
    assert.equal(lignes.pop(), '');
    assert.equal(lignes.length, 2);
    const e1 = JSON.parse(lignes[0] ?? '') as Record<string, unknown>;
    assert.deepEqual(Object.keys(e1).sort(), ['action', 'cible', 'commit', 'date', 'precedent', 'resultat', 'urgence']);
    assert.deepEqual(e1, base() as unknown as Record<string, unknown>);
    const e2 = JSON.parse(lignes[1] ?? '') as Record<string, unknown>;
    assert.deepEqual(Object.keys(e2).sort(), ['action', 'cible', 'commit', 'date', 'message', 'precedent', 'resultat', 'urgence']);
    assert.equal(statSync(path.dirname(fichier)).mode & 0o777, 0o700);
    assert.equal(statSync(fichier).mode & 0o777, 0o600);
  });

  for (const [nom, entree] of [
    ['clé inconnue', { ...base(), hote: 'x' }],
    ['commit de 39 caractères', base({ commit: A.slice(0, 39) })],
    ['commit en majuscules', base({ commit: A.toUpperCase() })],
    ['precedent invalide', base({ precedent: 'aucun' })],
    ['action inconnue', base({ action: 'effacer' as 'retour' })],
    ['cible inconnue', base({ cible: 'prod' as 'essai' })],
    ['résultat inconnu', base({ resultat: 'peut-etre' as 'succes' })],
    ['date non ISO', base({ date: '18/11/2026' })],
    ['urgence non booléenne', base({ urgence: 'true' as unknown as boolean })],
    ['clé manquante', (() => {
      const e: Partial<EntreeJournal> = base();
      delete e.precedent;
      return e;
    })()],
  ] as const) {
    it(`${nom} : refusé, rien n'est écrit`, () => {
      const home = homeTemporaire();
      assert.throws(() => ajouterJournal(home, entree as EntreeJournal, CFG));
      assert.throws(() => statSync(cheminsLocaux(home).journal));
    });
  }

  it('justification nettoyée (une ligne) ; message masqué (<hôte>, <utilisateur>, <url>) et coupé à 300 caractères', () => {
    const home = homeTemporaire();
    ajouterJournal(
      home,
      base({
        urgence: true,
        justification: 'panne grave\nsur la page\u0007 des thèmes, retrait',
        message: `échec : connexion perdue vers serveur.exemple.invalid (deploy-factice@serveur.exemple.invalid, https://essai.exemple.invalid/) ${'x'.repeat(400)}`,
      }),
      CFG,
    );
    const texte = readFileSync(cheminsLocaux(home).journal, 'utf8');
    assert.equal(texte.split('\n').length, 2);
    const e = JSON.parse(texte) as { justification: string; message: string };
    assert.equal(e.justification, 'panne grave sur la page des thèmes, retrait');
    assert.ok(e.message.includes('<hôte>'), e.message);
    assert.ok(!texte.includes('serveur.exemple.invalid') && !texte.includes('deploy-factice') && !texte.includes('essai.exemple.invalid'), texte);
    assert.ok([...e.message].length <= 300);
  });

  it('écriture impossible : simple avertissement, false', () => {
    const home = homeTemporaire();
    const avertissements: string[] = [];
    // Le dossier du journal est occupé par un fichier : mkdir échoue.
    const fichier = cheminsLocaux(home).journal;
    const parent = path.dirname(path.dirname(fichier));
    mkdirSync(path.dirname(parent), { recursive: true });
    writeFileSync(parent, 'occupé\n');
    assert.equal(ajouterJournal(home, base(), CFG, (m) => avertissements.push(m)), false);
    assert.equal(avertissements.length, 1);
    assert.match(avertissements[0] ?? '', /journal/);
  });
});
