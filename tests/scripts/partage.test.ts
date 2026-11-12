// Proposition 6 (09.1-08, D-04) : public/partage.png, image de partage 1200 x 630 produite par scripts/partage.ts
// (capture Chromium de scripts/partage.html). Le PNG n'est pas identique octet pour octet d'une machine à l'autre
// (polices du système) : le contrôle compare la signature, les dimensions, le poids et l'empreinte de la page source
// inscrite dans le PNG, jamais ses pixels. Aucune police n'est requise ici : la CI ne lance pas Chromium.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITES } from '../../scripts/lib/check-dist.ts';
import { analyserHtml, texte, trouver } from '../../scripts/lib/html.ts';
import { ajouterTexte, empreinteSource, htmlRempli, lireDimensions, lireTexte, problemesImage } from '../../scripts/partage.ts';
import { motsInterdits } from '../../src/lib/content-core/rules/text/forbidden.ts';
import { ALT_PARTAGE, HAUTEUR_PARTAGE, LARGEUR_PARTAGE, PROMESSE_PARTAGE, REPERE_PARTAGE } from '../../src/lib/partage.ts';
import { loadSiteConfig } from '../../src/lib/site-config.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FICHIER = path.join(ROOT, 'public/partage.png');
const SOURCE = path.join(ROOT, 'scripts/partage.html');
const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('public/partage.png', () => {
  it('existe, a la signature PNG et les dimensions 1200 x 630', () => {
    assert.ok(fs.existsSync(FICHIER), 'public/partage.png absent : lancer node scripts/partage.ts');
    const png = fs.readFileSync(FICHIER);
    assert.ok(png.subarray(0, 8).equals(SIGNATURE_PNG));
    assert.deepEqual(lireDimensions(png), { largeur: 1200, hauteur: 630 });
    assert.equal(LARGEUR_PARTAGE, 1200);
    assert.equal(HAUTEUR_PARTAGE, 630);
  });

  it('pèse au plus LIMITES.partage (100 000 octets)', () => {
    assert.equal(LIMITES.partage, 100_000);
    assert.ok(fs.statSync(FICHIER).size <= LIMITES.partage, `${fs.statSync(FICHIER).size} octets`);
  });

  it('correspond à sa page source : --check sans écart (empreinte du HTML rempli)', () => {
    assert.deepEqual(problemesImage(fs.readFileSync(FICHIER)), []);
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/partage.ts'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });
});

describe('scripts/partage.ts --check', () => {
  it('refuse un PNG absent, de mauvaise taille, sans empreinte ou dont l\'empreinte ne correspond plus au texte', () => {
    const png = fs.readFileSync(FICHIER);
    assert.notDeepEqual(problemesImage(Buffer.from('pas un png')), []);
    const perime = ajouterTexte(enleverTexte(png), 'Source', 'sha256:' + '0'.repeat(64));
    assert.ok(problemesImage(perime).some((p) => /empreinte/.test(p)), 'une empreinte périmée doit être signalée');
    const sans = enleverTexte(png);
    assert.ok(problemesImage(sans).some((p) => /empreinte/.test(p)), 'une empreinte absente doit être signalée');
  });

  it('l\'empreinte inscrite dans le PNG versionné est celle du HTML rempli', () => {
    const png = fs.readFileSync(FICHIER);
    assert.equal(lireTexte(png, 'Source'), `sha256:${empreinteSource()}`);
  });

  it('refuse des arguments inconnus (code 2)', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/partage.ts'), '--inconnu'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 2);
  });
});

/** PNG sans morceau tEXt « Source » (pour simuler une image produite à la main). */
function enleverTexte(png: Buffer): Buffer {
  const out: Buffer[] = [png.subarray(0, 8)];
  let i = 8;
  while (i < png.length) {
    const n = png.readUInt32BE(i);
    const type = png.subarray(i + 4, i + 8).toString('latin1');
    const morceau = png.subarray(i, i + 12 + n);
    if (!(type === 'tEXt' && png.subarray(i + 8, i + 8 + n).toString('latin1').startsWith('Source\0'))) out.push(morceau);
    i += 12 + n;
  }
  return Buffer.concat(out);
}

describe('scripts/partage.html', () => {
  const html = fs.readFileSync(SOURCE, 'utf8');

  it('est autonome : ni script, ni lien, ni image, ni @import, ni url(, ni adresse', () => {
    assert.ok(!/<script/i.test(html), 'script');
    assert.ok(!/<link/i.test(html), 'link');
    assert.ok(!/<img/i.test(html), 'img');
    assert.ok(!/@import/i.test(html), '@import');
    assert.ok(!/url\(/i.test(html), 'url(');
    assert.ok(!/https?:/i.test(html), 'adresse');
  });

  it('ne contient aucun nom d\'hôte (le domaine est injecté à la génération)', () => {
    const domaine = loadSiteConfig(ROOT, {}).domaine;
    assert.ok(!html.includes(domaine));
    assert.ok(html.includes('{{DOMAINE}}'));
  });

  it('le HTML rempli : plus aucun repère {{ }}, la phrase et le domaine y sont', () => {
    const rempli = htmlRempli();
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(rempli), 'repère non rempli');
    const t = texte(trouver(analyserHtml(rempli), (n) => n.tag === 'body')[0]!).replace(/\s+/g, ' ');
    assert.ok(t.includes(PROMESSE_PARTAGE));
    assert.ok(t.includes(REPERE_PARTAGE));
    assert.ok(t.includes(loadSiteConfig(ROOT, {}).domaine));
  });

  it('le texte visible n\'a ni tiret long ni tiret moyen ni mot interdit', () => {
    for (const s of [PROMESSE_PARTAGE, REPERE_PARTAGE, ALT_PARTAGE]) {
      assert.ok(!/[–—]/.test(s), s);
      assert.deepEqual(motsInterdits(s, { exempterCitations: false }), [], s);
    }
    assert.equal(ALT_PARTAGE, PROMESSE_PARTAGE);
  });

  it('n\'emploie que des couleurs du site (valeurs lues dans base.css, aucune couleur écrite en dur)', () => {
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(html));
    assert.ok(!/rgb|hsl/i.test(html));
  });
});
