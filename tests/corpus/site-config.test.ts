// Lecteur strict de config/site.yml (domaine du site, contact public et dépôt GitHub).
// Aucun nom d'hôte du site en dur ici : les fixtures utilisent exemple.fr / exemple.invalid et les
// assertions sur le dépôt lisent loadSiteConfig(REPO).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estHoteProvisoire, loadSiteConfig, TLD_PROVISOIRES } from '../../src/lib/site-config.ts';

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

const DEPOT = 'depot: ErwanHenry/reveleTonProg\n';
const yml = (domaine: string | null, contact: string): string =>
  `${domaine === null ? '' : `domaine: ${domaine}\n`}contact: ${contact}\n${DEPOT}`;
const REEL = yml('exemple.fr', 'bonjour@exemple.fr');

describe('loadSiteConfig', () => {
  it('lit le domaine, le contact provisoire (.invalid) et le dépôt', () => {
    const cfg = loadSiteConfig(projet(yml('exemple.invalid', 'contact@exemple.invalid')), {});
    assert.deepEqual(cfg, {
      domaine: 'exemple.invalid',
      domaineProvisoire: true,
      contact: 'contact@exemple.invalid',
      depot: 'ErwanHenry/reveleTonProg',
      contactProvisoire: true,
    });
  });

  it('un domaine et un contact réels ne sont pas provisoires', () => {
    assert.deepEqual(loadSiteConfig(projet(REEL)), {
      domaine: 'exemple.fr',
      domaineProvisoire: false,
      contact: 'bonjour@exemple.fr',
      depot: 'ErwanHenry/reveleTonProg',
      contactProvisoire: false,
    });
  });

  it('WR-03 : RTP_DEPLOIEMENT=1 refuse le contact provisoire, accepte un contact réel', () => {
    const provisoire = projet(yml('exemple.fr', 'contact@exemple.invalid'));
    assert.throws(() => loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: '1' }), /contact provisoire \(TLD réservé : \.invalid, \.test, \.example, \.localhost\) refusé quand RTP_DEPLOIEMENT=1/);
    assert.equal(loadSiteConfig(provisoire, {}).contactProvisoire, true);
    assert.equal(loadSiteConfig(projet(REEL), { RTP_DEPLOIEMENT: '1' }).contactProvisoire, false);
  });

  it('HEB-06 : RTP_DEPLOIEMENT=1 refuse le domaine provisoire même avec un contact réel', () => {
    const provisoire = projet(yml('exemple.invalid', 'bonjour@exemple.fr'));
    assert.throws(
      () => loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: '1' }),
      (e: unknown) => {
        const m = (e as Error).message;
        assert.match(m, /^config\/site\.yml : /);
        assert.match(m, /domaine provisoire \(TLD réservé : \.invalid, \.test, \.example, \.localhost\) refusé quand RTP_DEPLOIEMENT=1 : renseigner le vrai domaine avant de déployer/);
        assert.doesNotMatch(m, /contact provisoire/);
        return true;
      },
    );
    assert.equal(loadSiteConfig(provisoire, {}).domaineProvisoire, true);
  });

  it('IN-04 : .test, .example et .localhost sont provisoires comme .invalid (domaine et contact), refusés au déploiement', () => {
    for (const tld of ['test', 'example', 'localhost']) {
      const domaine = projet(yml(`exemple.${tld}`, 'bonjour@exemple.fr'));
      assert.throws(() => loadSiteConfig(domaine, { RTP_DEPLOIEMENT: '1' }), /domaine provisoire/, tld);
      assert.equal(loadSiteConfig(domaine, {}).domaineProvisoire, true, tld);
      const contact = projet(yml('exemple.fr', `contact@exemple.${tld}`));
      assert.throws(() => loadSiteConfig(contact, { RTP_DEPLOIEMENT: '1' }), /contact provisoire/, tld);
      assert.equal(loadSiteConfig(contact, {}).contactProvisoire, true, tld);
    }
  });

  it('IN-02 : la garde de déploiement mord aussi sur une lecture mémorisée (env vide d’abord, puis RTP_DEPLOIEMENT=1)', () => {
    const provisoire = projet(yml('exemple.invalid', 'contact@exemple.invalid'));
    const premiere = loadSiteConfig(provisoire, {});
    assert.equal(premiere.domaineProvisoire, true);
    assert.throws(() => loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: '1' }), /domaine provisoire .* refusé quand RTP_DEPLOIEMENT=1/);
    assert.equal(loadSiteConfig(provisoire, {}), premiere, 'la lecture reste mémorisée');
    const reel = projet(REEL);
    loadSiteConfig(reel, {});
    assert.equal(loadSiteConfig(reel, { RTP_DEPLOIEMENT: '1' }).domaine, 'exemple.fr');
  });

  it('IN-04 : estHoteProvisoire ne juge que le dernier label (TLD), casse et point final ignorés', () => {
    for (const h of ['a.invalid', 'a.test', 'a.example', 'a.localhost', 'A.TEST', 'a.test.', 'x@a.example', 'contact@exemple.invalid']) {
      assert.equal(estHoteProvisoire(h), true, h);
    }
    for (const h of ['exemple.fr', 'test.fr', 'example.org', 'a.testeur', 'invalid.com', 'x@test.fr', 'localhost.fr']) {
      assert.equal(estHoteProvisoire(h), false, h);
    }
    assert.deepEqual([...TLD_PROVISOIRES].sort(), ['example', 'invalid', 'localhost', 'test']);
  });

  it('HEB-06 : domaine et contact provisoires, une seule erreur qui nomme les deux champs', () => {
    const provisoire = projet(yml('exemple.invalid', 'contact@exemple.invalid'));
    assert.throws(
      () => loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: '1' }),
      (e: unknown) => {
        const m = (e as Error).message;
        assert.equal(m.match(/config\/site\.yml/g)?.length, 1, m);
        assert.match(m, /domaine provisoire \(TLD réservé : \.invalid, \.test, \.example, \.localhost\) refusé quand RTP_DEPLOIEMENT=1/);
        assert.match(m, /contact provisoire \(TLD réservé : \.invalid, \.test, \.example, \.localhost\) refusé quand RTP_DEPLOIEMENT=1/);
        assert.match(m, / ; /);
        return true;
      },
    );
  });

  it('HEB-06 : domaine et contact réels, aucune erreur sous RTP_DEPLOIEMENT=1', () => {
    const cfg = loadSiteConfig(projet(REEL), { RTP_DEPLOIEMENT: '1' });
    assert.equal(cfg.domaineProvisoire, false);
    assert.equal(cfg.contactProvisoire, false);
  });

  it('IN-06 : une valeur de RTP_DEPLOIEMENT autre que 1, 0 ou vide est refusée, même avec un contact réel', () => {
    const reel = projet(REEL);
    assert.throws(() => loadSiteConfig(reel, { RTP_DEPLOIEMENT: 'true' }), /RTP_DEPLOIEMENT doit valoir 1/);
    const provisoire = projet(yml('exemple.invalid', 'contact@exemple.invalid'));
    assert.throws(() => loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: 'yes' }), /RTP_DEPLOIEMENT doit valoir 1/);
    assert.equal(loadSiteConfig(provisoire, { RTP_DEPLOIEMENT: '0' }).contactProvisoire, true);
  });

  it('accepte un nom d’hôte de 253 caractères et des sous-domaines (hors www.)', () => {
    const long = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.fr`;
    assert.equal(long.length, 253);
    assert.equal(loadSiteConfig(projet(yml(long, 'a@b.fr'))).domaine, long);
    assert.equal(loadSiteConfig(projet(yml('elections.exemple-2027.fr', 'a@b.fr'))).domaine, 'elections.exemple-2027.fr');
  });

  it('le config/site.yml du dépôt est valide : domaine réel (acheté le 2026-11-09), contact réel du domaine (D-01, Phase 9)', () => {
    const cfg = loadSiteConfig(REPO, {});
    assert.equal(cfg.depot, 'ErwanHenry/reveleTonProg');
    assert.ok(!cfg.domaine.endsWith('.invalid'), cfg.domaine);
    assert.equal(cfg.domaineProvisoire, false);
    assert.equal(cfg.contact, `contact@${cfg.domaine}`);
    assert.equal(cfg.contactProvisoire, false);
    // la garde de déploiement ne refuse plus le contact
    assert.doesNotThrow(() => loadSiteConfig(REPO, { RTP_DEPLOIEMENT: '1' }));
    const texte = readFileSync(path.join(REPO, 'config', 'site.yml'), 'utf8');
    assert.equal(texte.match(/^domaine: /gm)?.length, 1);
    assert.ok(texte.includes(`domaine: ${cfg.domaine}\n`));
    assert.ok(texte.includes(`contact: ${cfg.contact}\n`));
  });

  const long254 = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(59)}.fr`;
  const invalides: [string, string | null][] = [
    ['fichier absent', null],
    ['domaine absent', yml(null, 'a@b.fr')],
    ['domaine en majuscules', yml('Exemple.fr', 'a@b.fr')],
    ['domaine avec schéma', yml('"https://exemple.fr"', 'a@b.fr')],
    ['domaine avec port', yml('"exemple.fr:8080"', 'a@b.fr')],
    ['domaine avec chemin', yml('exemple.fr/chemin', 'a@b.fr')],
    ['domaine en www.', yml('www.exemple.fr', 'a@b.fr')],
    ['domaine sans point', yml('exemple', 'a@b.fr')],
    ['domaine à TLD numérique', yml('exemple.123', 'a@b.fr')],
    ['domaine qui commence par un tiret', yml('"-exemple.fr"', 'a@b.fr')],
    ['domaine de 254 caractères', yml(long254, 'a@b.fr')],
    ['domaine non chaîne', yml('42', 'a@b.fr')],
    ['contact absent', 'domaine: exemple.fr\ndepot: a/b\n'],
    ['contact sans arobase', 'domaine: exemple.fr\ncontact: pas-une-adresse\ndepot: a/b\n'],
    ['contact avec chevrons', 'domaine: exemple.fr\ncontact: "<x@y.fr>"\ndepot: a/b\n'],
    ['depot absent', 'domaine: exemple.fr\ncontact: a@b.fr\n'],
    ['depot sans barre', 'domaine: exemple.fr\ncontact: a@b.fr\ndepot: seul\n'],
    ['depot avec espace', 'domaine: exemple.fr\ncontact: a@b.fr\ndepot: "a b/c"\n'],
    ['clé inconnue', 'domaine: exemple.fr\ncontact: a@b.fr\ndepot: a/b\nautre: 1\n'],
    ['clés en double', 'domaine: exemple.fr\ncontact: a@b.fr\ncontact: c@d.fr\ndepot: a/b\n'],
    ['alias YAML', 'domaine: exemple.fr\ncontact: &c a@b.fr\ndepot: a/b\nautre: *c\n'],
    ['racine non objet', '- a\n- b\n'],
  ];
  assert.equal(long254.length, 254);
  for (const [nom, contenu] of invalides) {
    it(`échoue en nommant config/site.yml : ${nom}`, () => {
      assert.throws(() => loadSiteConfig(projet(contenu)), /config\/site\.yml/);
    });
  }

  it('le message « racine non objet » liste les trois clés', () => {
    assert.throws(() => loadSiteConfig(projet('- a\n')), /domaine, contact et depot/);
  });
});
