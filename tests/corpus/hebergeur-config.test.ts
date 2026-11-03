// Lecteur strict de config/hebergeur.yml (identité de l'hébergeur, garde de déploiement).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHebergeurConfig } from '../../src/lib/hebergeur-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

const BASE: Record<string, string> = {
  statut: 'prevu',
  nom: 'Hébergeur Test GmbH',
  adresse: '1 rue de Test, 75001 Paris',
  pays: 'France',
  telephone: '+33 1 00 00 00 00',
  registre: 'RCS Paris 000',
};
const SOURCE = '\nsource:\n  url: https://exemple.fr/legal/\n  consulte_le: 2026-11-03\n';

function yml(surcharge: Record<string, string | null> = {}, source: string = SOURCE): string {
  const champs = { ...BASE, ...surcharge };
  return (
    Object.entries(champs)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') + source
  );
}

function projet(contenu: string | null): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-heb-'));
  dossiers.push(dir);
  if (contenu !== null) {
    mkdirSync(path.join(dir, 'config'));
    writeFileSync(path.join(dir, 'config', 'hebergeur.yml'), contenu);
  }
  return dir;
}

describe('loadHebergeurConfig', () => {
  it('le fichier du dépôt est valide : Hetzner Online GmbH, statut prevu', () => {
    const cfg = loadHebergeurConfig(REPO, {});
    assert.equal(cfg.statut, 'prevu');
    assert.equal(cfg.nom, 'Hetzner Online GmbH');
    assert.match(cfg.source.url, /^https:\/\/www\.hetzner\.com\/legal\/legal-notice\/$/);
  });

  it('garde de déploiement : prevu + RTP_DEPLOIEMENT=1 lève une erreur qui nomme le fichier', () => {
    assert.throws(
      () => loadHebergeurConfig(REPO, { RTP_DEPLOIEMENT: '1' }),
      (e: Error) => e.message.startsWith('config/hebergeur.yml') && /RTP_DEPLOIEMENT/.test(e.message),
    );
  });

  it('statut actif accepté avec RTP_DEPLOIEMENT=1', () => {
    const cfg = loadHebergeurConfig(projet(yml({ statut: 'actif' })), { RTP_DEPLOIEMENT: '1' });
    assert.equal(cfg.statut, 'actif');
  });

  const refus: Array<[string, string | null]> = [
    ['clé inconnue', yml({}, `${SOURCE}extra: 1\n`)],
    ['alias YAML', yml({ adresse: '*a' }, `${SOURCE}`).replace('statut: prevu', 'statut: &a prevu')],
    ['telephone manquant', yml({ telephone: null })],
    ['statut hors liste', yml({ statut: 'bientot' })],
    ['source.url non https', yml({}, '\nsource:\n  url: http://exemple.fr/\n  consulte_le: 2026-11-03\n')],
    ['source.consulte_le impossible', yml({}, '\nsource:\n  url: https://exemple.fr/\n  consulte_le: 2026-02-30\n')],
    ['fichier absent', null],
  ];
  for (const [nom, contenu] of refus) {
    it(`refuse : ${nom}`, () => {
      assert.throws(
        () => loadHebergeurConfig(projet(contenu), {}),
        (e: Error) => e.message.startsWith('config/hebergeur.yml'),
      );
    });
  }
});
