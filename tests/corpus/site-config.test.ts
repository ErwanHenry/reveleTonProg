// Lecteur strict de config/site.yml (contact public et dépôt GitHub).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dossiers: string[] = [];
after(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

function projet(contenu: string | null): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rtp-site-'));
  dossiers.push(dir);
  if (contenu !== null) {
    mkdirSync(path.join(dir, 'config'));
    writeFileSync(path.join(dir, 'config', 'site.yml'), contenu);
  }
  return dir;
}

describe('loadSiteConfig', () => {
  it('lit le contact provisoire (.invalid) et le dépôt', () => {
    const cfg = loadSiteConfig(projet('contact: contact@domaine-a-definir.invalid\ndepot: ErwanHenry/reveleTonProg\n'));
    assert.deepEqual(cfg, { contact: 'contact@domaine-a-definir.invalid', depot: 'ErwanHenry/reveleTonProg', contactProvisoire: true });
  });

  it('un domaine réel n’est pas provisoire', () => {
    const cfg = loadSiteConfig(projet('contact: bonjour@exemple.fr\ndepot: ErwanHenry/reveleTonProg\n'));
    assert.equal(cfg.contactProvisoire, false);
  });

  it('le config/site.yml du dépôt est valide et provisoire', () => {
    const cfg = loadSiteConfig(REPO);
    assert.equal(cfg.contact, 'contact@domaine-a-definir.invalid');
    assert.equal(cfg.depot, 'ErwanHenry/reveleTonProg');
    assert.equal(cfg.contactProvisoire, true);
    assert.match(readFileSync(path.join(REPO, 'config', 'site.yml'), 'utf8'), /contact: contact@domaine-a-definir\.invalid/);
  });

  const invalides: [string, string | null][] = [
    ['fichier absent', null],
    ['contact absent', 'depot: a/b\n'],
    ['contact sans arobase', 'contact: pas-une-adresse\ndepot: a/b\n'],
    ['contact avec chevrons', 'contact: "<x@y.fr>"\ndepot: a/b\n'],
    ['depot absent', 'contact: a@b.fr\n'],
    ['depot sans barre', 'contact: a@b.fr\ndepot: seul\n'],
    ['depot avec espace', 'contact: a@b.fr\ndepot: "a b/c"\n'],
    ['clé inconnue', 'contact: a@b.fr\ndepot: a/b\nautre: 1\n'],
    ['clés en double', 'contact: a@b.fr\ncontact: c@d.fr\ndepot: a/b\n'],
    ['alias YAML', 'contact: &c a@b.fr\ndepot: a/b\nautre: *c\n'],
    ['racine non objet', '- a\n- b\n'],
  ];
  for (const [nom, contenu] of invalides) {
    it(`échoue en nommant config/site.yml : ${nom}`, () => {
      assert.throws(() => loadSiteConfig(projet(contenu)), /config\/site\.yml/);
    });
  }
});
