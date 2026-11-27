// Phase 10.3 plan 05 : état séparé de l'automate et mode. Dossiers et HOME temporaires.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ETAT_AUTO_VIDE, cheminEtatAuto, ecrireEtatAuto, lignesEtatAuto, lireEtatAuto } from '../../scripts/lib/veille/etat-auto.ts';
import { cheminsAuto, modeAuto } from '../../scripts/lib/veille/mode-auto.ts';

const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'rtp-etat-auto-'));
  dossiers.push(d);
  return d;
};

describe('état de l\'automate', () => {
  it('absent, illisible ou autre version : état vide', () => {
    const d = tmp();
    assert.deepEqual(lireEtatAuto(d), ETAT_AUTO_VIDE);
    writeFileSync(cheminEtatAuto(d), '{pas du json');
    assert.deepEqual(lireEtatAuto(d), ETAT_AUTO_VIDE);
    writeFileSync(cheminEtatAuto(d), JSON.stringify({ version: 2, phase: 'retenu' }));
    assert.deepEqual(lireEtatAuto(d), ETAT_AUTO_VIDE);
    writeFileSync(cheminEtatAuto(d), '[]');
    assert.deepEqual(lireEtatAuto(d), ETAT_AUTO_VIDE);
  });
  it('fichier partiel complété, code inconnu devient null', () => {
    const d = tmp();
    writeFileSync(cheminEtatAuto(d), JSON.stringify({ version: 1, phase: 'retenu', dernierCode: 'bizarre' }));
    const e = lireEtatAuto(d);
    assert.equal(e.phase, 'retenu');
    assert.equal(e.dernierCode, null);
    assert.deepEqual(e.boite, []);
  });
  it('contrôles de forme', () => {
    const d = tmp();
    writeFileSync(cheminEtatAuto(d), JSON.stringify({ version: 1, sha: 'xyz', empreinteTraitee: 'a'.repeat(64), fiches: ['jean-dupont', 'Jean Dupont'], boite: ['ok', 3, 'x'.repeat(2001)], derniereAlerte: { code: 'gel', empreinte: 'zz' } }));
    const e = lireEtatAuto(d);
    assert.equal(e.sha, null);
    assert.equal(e.empreinteTraitee, 'a'.repeat(64));
    assert.deepEqual(e.fiches, ['jean-dupont']);
    assert.deepEqual(e.boite, ['ok']);
    assert.deepEqual(e.derniereAlerte, { code: 'gel', empreinte: null });
  });
  it('écriture en 0600, aller-retour, etat.json non touché', () => {
    const d = tmp();
    const e = { ...ETAT_AUTO_VIDE, phase: 'pousse_non_deploye' as const, sha: 'b'.repeat(40), dernierCode: 'publie' as const };
    ecrireEtatAuto(d, e);
    assert.equal(statSync(cheminEtatAuto(d)).mode & 0o777, 0o600);
    assert.deepEqual(lireEtatAuto(d), e);
    assert.ok(!existsSync(path.join(d, 'etat.json')));
  });
  it('lignes sans secret ni chemin de configuration', () => {
    const t = lignesEtatAuto({ ...ETAT_AUTO_VIDE, sha: 'c'.repeat(40), boite: ['a', 'b'] }).join('\n');
    assert.match(t, /cccccccccccc/);
    assert.match(t, /boîte d'envoi : 2/);
    assert.doesNotMatch(t, /\.config|\/Users/);
  });
});

describe('mode de l\'automate', () => {
  const pas = { gele: false, motif: '' };
  const prep = (): { home: string; dossier: string } => {
    const home = tmp();
    const dossier = path.join(home, 'veille');
    mkdirSync(dossier, { recursive: true });
    mkdirSync(path.join(home, '.config', 'rtp'), { recursive: true });
    return { home, dossier };
  };
  it('chemins', () => {
    const c = cheminsAuto('/h', '/d');
    assert.equal(c.actif, '/h/.config/rtp/auto-actif');
    assert.equal(c.desactive, '/d/auto-desactive');
    assert.equal(c.verrouCi, '/h/.cache/rtp/ci/.verrou');
  });
  it('marqueur absent : à blanc (livré désactivé de fait)', () => {
    const { home, dossier } = prep();
    assert.deepEqual(modeAuto({ home, dossier, gel: pas }), { mode: 'a_blanc', raison: "marqueur d'activation absent" });
  });
  it('marqueur présent : publication', () => {
    const { home, dossier } = prep();
    writeFileSync(cheminsAuto(home, dossier).actif, '');
    assert.equal(modeAuto({ home, dossier, gel: pas }).mode, 'publier');
  });
  it('interrupteur prioritaire, sous toute forme', () => {
    const { home, dossier } = prep();
    const c = cheminsAuto(home, dossier);
    writeFileSync(c.actif, '');
    mkdirSync(c.desactive);
    assert.equal(modeAuto({ home, dossier, gel: pas }).mode, 'desactive');
  });
  it('gel : à blanc avec le motif', () => {
    const { home, dossier } = prep();
    writeFileSync(cheminsAuto(home, dossier).actif, '');
    assert.deepEqual(modeAuto({ home, dossier, gel: { gele: true, motif: 'gel de test' } }), { mode: 'a_blanc', raison: 'gel de test' });
  });
  it('marqueur lien symbolique ou dossier : à blanc, invalide', () => {
    const { home, dossier } = prep();
    const c = cheminsAuto(home, dossier);
    symlinkSync(path.join(home, 'cible'), c.actif);
    assert.deepEqual(modeAuto({ home, dossier, gel: pas }), { mode: 'a_blanc', raison: "marqueur d'activation invalide" });
    rmSync(c.actif);
    mkdirSync(c.actif);
    assert.equal(modeAuto({ home, dossier, gel: pas }).raison, "marqueur d'activation invalide");
  });
});
