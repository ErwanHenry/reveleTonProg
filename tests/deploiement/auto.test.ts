// deploy:auto (10.3, plan 06 ; SC-2, SC-3, SC-4) : briques partagées, déploiement automatique contre la vraie
// commande forcée en mode --auto (tests/helpers/faux-serveur.ts, option modeAuto), CLI. Aucun contact avec un vrai
// serveur ; HOME et TMPDIR temporaires ; npm et sandbox-exec factices.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FENETRES_GEL } from '../../scripts/garde-gel.ts';
import { GEL_IMPORT } from '../../scripts/lib/veille/preparer.ts';
import { cheminsLocaux, lireConfig, lireConfigAuto } from '../../scripts/lib/deploiement/config.ts';
import { Sortie } from '../../scripts/lib/deploiement/gardes.ts';
import { GEL_AUTO, evaluerGelAuto } from '../../scripts/lib/deploiement/gel-auto.ts';
import { ajouterJournal, dernierCommitEnLigne, type EntreeJournal } from '../../scripts/lib/deploiement/journal.ts';
import { optionsSsh } from '../../scripts/lib/deploiement/transport.ts';
import { FinApresActivation, retourAutomatique } from '../../scripts/lib/deploiement/deployer.ts';
import { creerFauxServeur } from '../helpers/faux-serveur.ts';

const nettoyages: (() => void)[] = [];
after(() => {
  for (const n of nettoyages) n();
});
function temp(prefixe: string): string {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), prefixe)));
  nettoyages.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

function readLignes(p: string): string[] {
  return readFileSync(p, 'utf8').split('\n').filter((l) => l !== '');
}

describe('gel de l\'automate', () => {
  it('fenêtre du 10 au 15 décembre 2026 et bornes', () => {
    assert.equal(evaluerGelAuto(new Date('2026-12-09T23:59:59+01:00')).gele, false);
    assert.equal(evaluerGelAuto(new Date('2026-12-10T00:00:00+01:00')).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-12-15T23:59:59+01:00')).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-12-16T00:00:00+01:00')).gele, false);
  });
  it('les gels des scrutins de garde-gel.ts restent gelés', () => {
    const f = FENETRES_GEL[0];
    assert.ok(f !== undefined);
    assert.equal(evaluerGelAuto(new Date(`${f.debut}T12:00:00+02:00`)).gele, true);
    assert.equal(evaluerGelAuto(new Date('2026-11-18T12:00:00Z')).gele, false);
  });
  it('GEL_AUTO contient GEL_IMPORT', () => {
    assert.ok(GEL_AUTO.debut.getTime() <= GEL_IMPORT.debut.getTime());
    assert.ok(GEL_AUTO.fin.getTime() >= GEL_IMPORT.fin.getTime());
  });
});

describe('configuration automatique', () => {
  it('lit deploiement-auto.env ; lireConfig(home) lit toujours deploiement.env', () => {
    const faux = creerFauxServeur();
    nettoyages.push(() => faux.detruire());
    const home = temp('rtp-home-auto-cfg-');
    faux.config(home, { RTP_CIBLE: 'production' });
    const manuel = cheminsLocaux(home).config;
    const auto = cheminsLocaux(home).configAuto;
    assert.equal(path.basename(auto), 'deploiement-auto.env');
    writeFileSync(auto, 'RTP_CIBLE=production\n' + readLignes(manuel).filter((l) => !l.startsWith('RTP_CIBLE=')).join('\n') + '\n');
    chmodSync(auto, 0o600);
    assert.equal(lireConfigAuto(home).fichier, auto);
    assert.equal(lireConfig(home).fichier, manuel);
  });
  it('cible autre que production : Sortie 2', () => {
    const faux = creerFauxServeur();
    nettoyages.push(() => faux.detruire());
    const home = temp('rtp-home-auto-cfg2-');
    faux.config(home, { RTP_CIBLE: 'essai' });
    writeFileSync(cheminsLocaux(home).configAuto, readLignes(cheminsLocaux(home).config).join('\n') + '\n');
    chmodSync(cheminsLocaux(home).configAuto, 0o600);
    assert.throws(() => lireConfigAuto(home), (e) => e instanceof Sortie && e.code === 2 && /production attendu/.test(e.message));
  });
  it('fichier absent : Sortie 2 qui nomme le chemin', () => {
    const home = temp('rtp-home-auto-cfg3-');
    assert.throws(() => lireConfigAuto(home), (e) => e instanceof Sortie && e.code === 2 && e.message.includes('deploiement-auto.env'));
  });
});


describe('clé directe, journal, retour automatique exporté', () => {
  it('optionsSsh : IdentityAgent=none sans socket, socket inchangé sinon', () => {
    const cfg = { cle: '/c', knownHosts: '/k' };
    assert.ok(optionsSsh(cfg, { socket: null }).includes('IdentityAgent=none'));
    assert.ok(optionsSsh(cfg, { socket: '/s.sock' }).includes('IdentityAgent=/s.sock'));
  });
  it('retourAutomatique et FinApresActivation sont exportés', () => {
    assert.equal(typeof retourAutomatique, 'function');
    assert.equal(typeof FinApresActivation, 'function');
  });
  const SHA_A = 'a'.repeat(40);
  const SHA_B = 'b'.repeat(40);
  const cfgMasque = { hote: 'h.invalid', utilisateur: 'u-x', url: null };
  const entree = (action: EntreeJournal['action'], commit: string, resultat: EntreeJournal['resultat'] = 'succes', cible: 'essai' | 'production' = 'production'): EntreeJournal =>
    ({ date: '2026-11-18T10:00:00Z', action, cible, commit, precedent: null, resultat, urgence: false });
  it('deployer-auto accepté, action inconnue refusée', () => {
    const home = temp('rtp-home-auto-j-');
    assert.equal(ajouterJournal(home, entree('deployer-auto', SHA_A), cfgMasque, () => {}), true);
    assert.throws(() => ajouterJournal(home, { ...entree('deployer', SHA_A), action: 'autre' as never }, cfgMasque, () => {}), /action inconnue/);
  });
  it('dernierCommitEnLigne : dernière ligne réussie de la cible, null sinon', () => {
    const home = temp('rtp-home-auto-j2-');
    assert.equal(dernierCommitEnLigne(home, 'production'), null);
    ajouterJournal(home, entree('deployer', SHA_A), cfgMasque, () => {});
    ajouterJournal(home, entree('deployer-auto', SHA_B, 'echec'), cfgMasque, () => {});
    ajouterJournal(home, entree('deployer', SHA_B, 'succes', 'essai'), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_A);
    ajouterJournal(home, entree('deployer-auto', SHA_B), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_B);
    ajouterJournal(home, entree('retour-auto', SHA_A, 'succes'), cfgMasque, () => {});
    assert.equal(dernierCommitEnLigne(home, 'production'), SHA_A);
  });
  it('journal illisible ou vide : null', () => {
    const home = temp('rtp-home-auto-j3-');
    const f = cheminsLocaux(home).journal;
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, 'pas du json\n\n');
    assert.equal(dernierCommitEnLigne(home, 'production'), null);
  });
});

