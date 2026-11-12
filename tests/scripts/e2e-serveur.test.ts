import assert from 'node:assert/strict';
import { request, type IncomingHttpHeaders } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { creerServeur } from '../../e2e/serveur.ts';

interface Reponse {
  status: number | undefined;
  headers: IncomingHttpHeaders;
  corps: Buffer;
}

describe('e2e/serveur.ts', () => {
  let port: number;
  let tmp: string;
  let serveur: ReturnType<typeof creerServeur>;
  const HTML = '<!doctype html><title>x</title><p>bonjour bonjour bonjour bonjour</p>';
  const VERSION = `${JSON.stringify({ commit: 'dev', date: '2026-11-08T20:30:00.000Z' })}\n`;
  const ICONE = Buffer.from([0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0]);

  // Requête HTTP brute : fetch normaliserait « /../ » et décompresserait le gzip.
  function get(chemin: string, headers: Record<string, string> = {}): Promise<Reponse> {
    return new Promise((ok, ko) => {
      const req = request({ host: '127.0.0.1', port, path: chemin, method: 'GET', headers }, (res) => {
        const morceaux: Buffer[] = [];
        res.on('data', (c: Buffer) => morceaux.push(c));
        res.on('end', () => ok({ status: res.statusCode, headers: res.headers, corps: Buffer.concat(morceaux) }));
      });
      req.on('error', ko);
      req.end();
    });
  }

  before(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'rtp-serveur-'));
    const dist = path.join(tmp, 'dist');
    mkdirSync(path.join(dist, 'a'), { recursive: true });
    mkdirSync(path.join(dist, 'vide'), { recursive: true });
    mkdirSync(path.join(dist, '_astro'), { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), HTML);
    writeFileSync(path.join(dist, 'a', 'index.html'), HTML);
    writeFileSync(path.join(dist, '_astro', 'x.css'), 'body{color:red}');
    writeFileSync(path.join(dist, 'version.json'), VERSION);
    writeFileSync(path.join(dist, 'favicon.ico'), ICONE);
    writeFileSync(path.join(tmp, 'secret.txt'), 'SECRET');
    // WR-01 : liens symboliques vers l'extérieur du dist (fichier et dossier) et vers l'intérieur.
    symlinkSync(path.join(tmp, 'secret.txt'), path.join(dist, 'lien.txt'));
    symlinkSync(tmp, path.join(dist, 'dehors'));
    symlinkSync(path.join(dist, 'index.html'), path.join(dist, 'alias.html'));
    serveur = creerServeur(dist);
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    port = (serveur.address() as AddressInfo).port;
  });

  after(() => {
    serveur.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('sert index.html en gzip si demandé', async () => {
    const r = await get('/', { 'accept-encoding': 'gzip' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['content-encoding'], 'gzip');
    assert.equal(r.headers['vary'], 'Accept-Encoding');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(gunzipSync(r.corps).toString('utf8'), HTML);
  });

  it('sans gzip : octets bruts et content-length exact', async () => {
    const r = await get('/', { 'accept-encoding': 'identity' });
    assert.equal(r.headers['content-encoding'], undefined);
    assert.equal(r.headers['content-length'], String(Buffer.byteLength(HTML)));
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.corps.toString('utf8'), HTML);
  });

  it('sert un sous-dossier et une feuille de style', async () => {
    assert.equal((await get('/a/')).status, 200);
    const css = await get('/_astro/x.css');
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
  });

  it('HEB-07 : sert version.json en application/json, compressé comme les pages', async () => {
    const gz = await get('/version.json', { 'accept-encoding': 'gzip' });
    assert.equal(gz.status, 200);
    assert.equal(gz.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.equal(gunzipSync(gz.corps).toString('utf8'), VERSION);
    const brut = await get('/version.json', { 'accept-encoding': 'identity' });
    assert.equal(brut.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(brut.headers['content-encoding'], undefined);
    assert.equal(brut.corps.toString('utf8'), VERSION);
  });

  it('D-11 : sert /favicon.ico en image/x-icon', async () => {
    const r = await get('/favicon.ico', { 'accept-encoding': 'identity' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'image/x-icon');
    assert.equal(r.headers['cache-control'], 'no-cache', 'comme le bloc Caddy : en no-store, Chromium refuse le bfcache');
    assert.ok(r.corps.equals(ICONE));
  });

  for (const chemin of ['/%2e%2e/secret.txt', '/../secret.txt', '/..%2fsecret.txt']) {
    it(`refuse la traversée ${chemin}`, async () => {
      const r = await get(chemin);
      assert.equal(r.status, 404);
      assert.ok(!r.corps.toString('utf8').includes('SECRET'));
    });
  }

  for (const chemin of ['/lien.txt', '/dehors/secret.txt']) {
    it(`refuse le lien symbolique vers l'extérieur ${chemin} (WR-01)`, async () => {
      const r = await get(chemin);
      assert.equal(r.status, 404);
      assert.ok(!r.corps.toString('utf8').includes('SECRET'));
    });
  }

  it('sert un lien symbolique vers un fichier du dist (WR-01)', async () => {
    const r = await get('/alias.html', { 'accept-encoding': 'identity' });
    assert.equal(r.status, 200);
    assert.equal(r.corps.toString('utf8'), HTML);
  });

  it('404 pour un dossier sans index.html et un fichier absent', async () => {
    assert.equal((await get('/vide/')).status, 404);
    assert.equal((await get('/absent.html')).status, 404);
  });

  it('introuvable 404 : sans 404.html dans le dist, le corps reste « 404 »', async () => {
    for (const chemin of ['/nexistepas/', '/absent.html', '/vide/']) {
      const r = await get(chemin, { 'accept-encoding': 'identity' });
      assert.equal(r.status, 404, chemin);
      assert.equal(r.corps.toString('utf8'), '404', chemin);
    }
  });

  it('400 sur un encodage malformé', async () => {
    assert.equal((await get('/%E0%A4%A')).status, 400);
  });
});

// Page 404 du site (plan 09.1-02) : même comportement que le bloc Caddy public (`@introuvable not file {path} {path}/`,
// `rewrite * /404.html`, `file_server { status 404 }`) : toute adresse qui n'est pas un fichier servi reçoit 404.html
// avec le code 404 et les en-têtes d'une page.
describe('e2e/serveur.ts, introuvable 404 : page 404.html du dist', () => {
  let port: number;
  let tmp: string;
  let serveur: ReturnType<typeof creerServeur>;
  const HTML = '<!doctype html><title>x</title><p>bonjour</p>';
  const PAGE_404 = '<!doctype html><html lang="fr"><title>Page introuvable</title><h1>Page introuvable</h1></html>';
  const CSP = "default-src 'none'";

  function get(chemin: string, headers: Record<string, string> = {}): Promise<Reponse> {
    return new Promise((ok, ko) => {
      const req = request({ host: '127.0.0.1', port, path: chemin, method: 'GET', headers }, (res) => {
        const morceaux: Buffer[] = [];
        res.on('data', (c: Buffer) => morceaux.push(c));
        res.on('end', () => ok({ status: res.statusCode, headers: res.headers, corps: Buffer.concat(morceaux) }));
      });
      req.on('error', ko);
      req.end();
    });
  }

  before(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'rtp-serveur-404-'));
    const dist = path.join(tmp, 'dist');
    mkdirSync(path.join(dist, 'vide'), { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), HTML);
    writeFileSync(path.join(dist, '404.html'), PAGE_404);
    writeFileSync(path.join(tmp, 'secret.txt'), 'SECRET');
    symlinkSync(path.join(tmp, 'secret.txt'), path.join(dist, 'lien.txt'));
    symlinkSync(tmp, path.join(dist, 'dehors'));
    serveur = creerServeur(dist, { csp: CSP });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    port = (serveur.address() as AddressInfo).port;
  });

  after(() => {
    serveur.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  for (const chemin of ['/nexistepas/', '/absent.html', '/vide/']) {
    it(`${chemin} : code 404, octets exacts de 404.html, en-têtes d'une page`, async () => {
      const r = await get(chemin, { 'accept-encoding': 'identity' });
      assert.equal(r.status, 404);
      assert.equal(r.corps.toString('utf8'), PAGE_404);
      assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(r.headers['content-security-policy'], CSP);
      assert.equal(r.headers['cache-control'], 'no-store');
      assert.equal(r.headers['content-length'], String(Buffer.byteLength(PAGE_404)));
    });
  }

  it('gzip si demandé, avec le code 404', async () => {
    const r = await get('/nexistepas/', { 'accept-encoding': 'gzip' });
    assert.equal(r.status, 404);
    assert.equal(r.headers['content-encoding'], 'gzip');
    assert.equal(gunzipSync(r.corps).toString('utf8'), PAGE_404);
  });

  it('une page existante reste servie en 200', async () => {
    const r = await get('/', { 'accept-encoding': 'identity' });
    assert.equal(r.status, 200);
    assert.equal(r.corps.toString('utf8'), HTML);
  });

  for (const chemin of ['/%2e%2e/secret.txt', '/../secret.txt', '/..%2fsecret.txt', '/lien.txt', '/dehors/secret.txt']) {
    it(`traversée ou lien vers l'extérieur ${chemin} : 404 avec la page 404, jamais le secret`, async () => {
      const r = await get(chemin, { 'accept-encoding': 'identity' });
      assert.equal(r.status, 404);
      assert.ok(!r.corps.toString('utf8').includes('SECRET'));
      assert.equal(r.corps.toString('utf8'), PAGE_404);
    });
  }
});

describe('e2e/serveur.ts, introuvable 404 : 404.html lien symbolique vers l\'extérieur', () => {
  let port: number;
  let tmp: string;
  let serveur: ReturnType<typeof creerServeur>;

  before(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'rtp-serveur-404-lien-'));
    const dist = path.join(tmp, 'dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>x</title>');
    writeFileSync(path.join(tmp, 'secret.txt'), 'SECRET');
    symlinkSync(path.join(tmp, 'secret.txt'), path.join(dist, '404.html'));
    serveur = creerServeur(dist, { csp: null });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    port = (serveur.address() as AddressInfo).port;
  });

  after(() => {
    serveur.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('la page 404 hors du dist n\'est jamais servie : corps « 404 »', async () => {
    const r: Reponse = await new Promise((ok, ko) => {
      const req = request({ host: '127.0.0.1', port, path: '/nexistepas/', method: 'GET' }, (res) => {
        const morceaux: Buffer[] = [];
        res.on('data', (c: Buffer) => morceaux.push(c));
        res.on('end', () => ok({ status: res.statusCode, headers: res.headers, corps: Buffer.concat(morceaux) }));
      });
      req.on('error', ko);
      req.end();
    });
    assert.equal(r.status, 404);
    assert.equal(r.corps.toString('utf8'), '404');
  });
});
