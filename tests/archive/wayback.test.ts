import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSnapshotLocation, submitWayback } from '../../scripts/lib/wayback.ts';

const NOW = new Date('2026-11-03T13:32:00Z');
const reponse = (status: number, location?: string): typeof fetch =>
  (async () => new Response(null, { status, headers: location === undefined ? {} : { location } })) as unknown as typeof fetch;

describe('parseSnapshotLocation', () => {
  it('accepte web.archive.org/web/<14 chiffres>/ et lit l’instant (UTC)', () => {
    const s = parseSnapshotLocation('https://web.archive.org/web/20261103014534/https://x.example/');
    assert.ok(s);
    assert.equal(s.url, 'https://web.archive.org/web/20261103014534/https://x.example/');
    assert.equal(s.instant.toISOString(), '2026-11-03T01:45:34.000Z');
  });

  it('résout une adresse relative sur web.archive.org', () => {
    assert.equal(parseSnapshotLocation('/web/20261103014534/https://x.example/')?.url, 'https://web.archive.org/web/20261103014534/https://x.example/');
  });

  it('refuse un autre hôte, http, un horodatage faux ou trop court', () => {
    for (const mauvais of [
      'https://evil.example/web/20261103014534/https://x.example/',
      'http://web.archive.org/web/20261103014534/https://x.example/',
      'https://web.archive.org.evil.example/web/20261103014534/x',
      'https://web.archive.org/web/2026110301453/https://x.example/',
      'https://web.archive.org/web/20261303014534/https://x.example/',
      'https://web.archive.org/save/https://x.example/',
      '//evil.example/web/20261103014534/x',
      '',
    ]) {
      assert.equal(parseSnapshotLocation(mauvais), null, mauvais);
    }
  });
});

describe('submitWayback', () => {
  it('302 vers un instantané : ok avec URL et ancienneté', async () => {
    const r = await submitWayback('https://x.example/', { fetch: reponse(302, 'https://web.archive.org/web/20261103014534/https://x.example/'), now: () => NOW });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.waybackUrl, 'https://web.archive.org/web/20261103014534/https://x.example/');
      assert.ok(Math.abs(r.ageHours - 11.8) < 0.1, String(r.ageHours));
    }
  });

  it('appelle web.archive.org/save/<url> sans suivre la redirection, avec le user agent fixe', async () => {
    let vu: { url: string; init?: RequestInit } | undefined;
    const f = (async (url: string, init?: RequestInit) => {
      vu = { url, init };
      return new Response(null, { status: 302, headers: { location: 'https://web.archive.org/web/20261103133200/https://x.example/p' } });
    }) as unknown as typeof fetch;
    await submitWayback('https://x.example/p', { fetch: f, now: () => NOW });
    assert.equal(vu?.url, 'https://web.archive.org/save/https://x.example/p');
    assert.equal(vu?.init?.redirect, 'manual');
    assert.match(String((vu?.init?.headers as Record<string, string>)['user-agent']), /^reveleTonProg-archiver\/0\.1/);
  });

  it('429 : échec avec explication du plafond', async () => {
    const r = await submitWayback('https://x.example/', { fetch: reponse(429), now: () => NOW });
    assert.deepEqual(r, { ok: false, reason: 'HTTP 429 (plafond quotidien par URL)' });
  });

  it('délai dépassé ou erreur réseau : échec, jamais d’exception', async () => {
    const delai = (async () => {
      throw new DOMException('timeout', 'TimeoutError');
    }) as unknown as typeof fetch;
    const r1 = await submitWayback('https://x.example/', { fetch: delai, now: () => NOW });
    assert.equal(r1.ok, false);
    const panne = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const r2 = await submitWayback('https://x.example/', { fetch: panne, now: () => NOW });
    assert.equal(r2.ok, false);
  });

  it('302 vers un autre hôte, ou sans Location : échec', async () => {
    const autre = await submitWayback('https://x.example/', { fetch: reponse(302, 'https://evil.example/web/20261103014534/x'), now: () => NOW });
    assert.equal(autre.ok, false);
    const sans = await submitWayback('https://x.example/', { fetch: reponse(302), now: () => NOW });
    assert.equal(sans.ok, false);
  });

  it('refuse de soumettre une URL non https', async () => {
    let appels = 0;
    const f = (async () => {
      appels++;
      return new Response(null, { status: 302 });
    }) as unknown as typeof fetch;
    const r = await submitWayback('http://x.example/', { fetch: f, now: () => NOW });
    assert.equal(r.ok, false);
    assert.equal(appels, 0);
  });
});
