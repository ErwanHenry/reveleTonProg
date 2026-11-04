import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FetchSafeError, fetchSafe, isPublicAddress, type Adresse } from '../../scripts/lib/fetch-safe.ts';

describe('isPublicAddress', () => {
  it('refuse les plages privées, locales et réservées IPv4', () => {
    for (const a of [
      '127.0.0.1', '127.255.255.254', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '100.127.255.255',
      '0.0.0.0', '0.1.2.3', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '240.0.0.1',
    ]) {
      assert.equal(isPublicAddress(a), false, a);
    }
  });

  it('accepte des adresses IPv4 publiques et les bornes juste à côté des plages privées', () => {
    for (const a of ['93.184.216.34', '8.8.8.8', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '11.0.0.1', '192.169.0.1']) {
      assert.equal(isPublicAddress(a), true, a);
    }
  });

  it('refuse les adresses IPv6 locales, privées, de lien local et leurs formes IPv4', () => {
    for (const a of [
      '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', 'febf::1', 'ff02::1',
      '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '::ffff:192.168.0.1', '::127.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::1', '2001:db8::1', '2001::1',
    ]) {
      assert.equal(isPublicAddress(a), false, a);
    }
  });

  it('accepte une IPv6 publique et la forme mappée d’une IPv4 publique', () => {
    for (const a of ['2606:4700:4700::1111', '2a00:1450:4007:80f::200e', '::ffff:8.8.8.8', '[2606:4700:4700::1111]']) {
      assert.equal(isPublicAddress(a), true, a);
    }
  });

  it('refuse tout ce qui n’est pas une adresse', () => {
    for (const a of ['', 'example.com', '1.2.3', '1.2.3.4.5', '256.1.1.1', 'gggg::1', '1::2::3']) {
      assert.equal(isPublicAddress(a), false, a);
    }
  });
});

const PUBLIC: Adresse[] = [{ address: '93.184.216.34', family: 4 }];
const lookupPublic = async (): Promise<Adresse[]> => PUBLIC;
const reponse = (status: number, init: { body?: string | Uint8Array; headers?: Record<string, string> } = {}): Response =>
  new Response((init.body ?? null) as BodyInit | null, { status, headers: init.headers });

function sequence(...reponses: (Response | Error)[]): { fetch: typeof fetch; appels: { url: string; init?: RequestInit }[] } {
  const appels: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const f = (async (url: string, init?: RequestInit) => {
    appels.push({ url, init });
    const r = reponses[Math.min(i++, reponses.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fetch: f, appels };
}

const refus = async (p: Promise<unknown>, code: string): Promise<FetchSafeError> => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof FetchSafeError, String(e));
    assert.equal(e.code, code, e.message);
    return e;
  }
  throw new assert.AssertionError({ message: `FetchSafeError ${code} attendue` });
};

describe('fetchSafe', () => {
  it('renvoie l’URL finale, le statut, le type et les octets ; seul le user agent est envoyé', async () => {
    const s = sequence(reponse(200, { body: 'bonjour', headers: { 'content-type': 'text/html; charset=utf-8', 'last-modified': 'Tue, 03 Nov 2026 10:00:00 GMT' } }));
    const r = await fetchSafe('https://exemple.test/page', { fetch: s.fetch, lookup: lookupPublic });
    assert.equal(r.finalUrl, 'https://exemple.test/page');
    assert.equal(r.status, 200);
    assert.equal(r.contentType, 'text/html; charset=utf-8');
    assert.equal(r.lastModified, 'Tue, 03 Nov 2026 10:00:00 GMT');
    assert.equal(Buffer.from(r.bytes).toString(), 'bonjour');
    const init = s.appels[0]?.init;
    assert.equal(init?.redirect, 'manual');
    assert.deepEqual(Object.keys(init?.headers as Record<string, string>), ['user-agent']);
    assert.equal((init?.headers as Record<string, string>)['user-agent'], 'reveleTonProg-archiver/0.1 (+https://github.com/ErwanHenry/reveleTonProg)');
    assert.equal(init?.credentials, undefined);
  });

  it('refuse http, les identifiants dans l’URL et les URL illisibles', async () => {
    const s = sequence(reponse(200));
    await refus(fetchSafe('http://exemple.test/', { fetch: s.fetch, lookup: lookupPublic }), 'SCHEMA');
    await refus(fetchSafe('https://user:mdp@exemple.test/', { fetch: s.fetch, lookup: lookupPublic }), 'SCHEMA');
    await refus(fetchSafe('pas une url', { fetch: s.fetch, lookup: lookupPublic }), 'SCHEMA');
    await refus(fetchSafe('file:///etc/passwd', { fetch: s.fetch, lookup: lookupPublic }), 'SCHEMA');
    assert.equal(s.appels.length, 0);
  });

  it('refuse un hôte qui se résout vers une adresse non publique (même si une autre est publique)', async () => {
    const s = sequence(reponse(200));
    const mixte = async (): Promise<Adresse[]> => [...PUBLIC, { address: '10.0.0.5', family: 4 }];
    await refus(fetchSafe('https://interne.test/', { fetch: s.fetch, lookup: mixte }), 'ADRESSE_PRIVEE');
    await refus(fetchSafe('https://localhost.test/', { fetch: s.fetch, lookup: async () => [{ address: '::1', family: 6 }] }), 'ADRESSE_PRIVEE');
    assert.equal(s.appels.length, 0);
  });

  it('refuse une adresse IP littérale non publique sans résolution DNS', async () => {
    const s = sequence(reponse(200));
    let dns = 0;
    const lookup = async (): Promise<Adresse[]> => {
      dns++;
      return PUBLIC;
    };
    await refus(fetchSafe('https://127.0.0.1/', { fetch: s.fetch, lookup }), 'ADRESSE_PRIVEE');
    await refus(fetchSafe('https://[::1]/', { fetch: s.fetch, lookup }), 'ADRESSE_PRIVEE');
    await refus(fetchSafe('https://2130706433/', { fetch: s.fetch, lookup }), 'ADRESSE_PRIVEE');
    await refus(fetchSafe('https://0x7f.1/', { fetch: s.fetch, lookup }), 'ADRESSE_PRIVEE');
    assert.equal(dns, 0);
    assert.equal(s.appels.length, 0);
  });

  it('suit les redirections et revérifie chaque saut', async () => {
    const s = sequence(
      reponse(301, { headers: { location: '/ailleurs' } }),
      reponse(302, { headers: { location: 'https://autre.test/final' } }),
      reponse(200, { body: 'ok' }),
    );
    const r = await fetchSafe('https://exemple.test/depart', { fetch: s.fetch, lookup: lookupPublic });
    assert.equal(r.finalUrl, 'https://autre.test/final');
    assert.deepEqual(s.appels.map((a) => a.url), ['https://exemple.test/depart', 'https://exemple.test/ailleurs', 'https://autre.test/final']);
  });

  it('refuse une redirection vers une adresse privée, vers http, ou plus de 5 sauts', async () => {
    const vers = (loc: string) => sequence(reponse(302, { headers: { location: loc } }), reponse(200, { body: 'secret' }));
    const lookup = async (h: string): Promise<Adresse[]> => (h === 'interne.test' ? [{ address: '192.168.0.9', family: 4 }] : PUBLIC);
    const a = vers('https://interne.test/admin');
    await refus(fetchSafe('https://exemple.test/', { fetch: a.fetch, lookup }), 'ADRESSE_PRIVEE');
    assert.equal(a.appels.length, 1);
    const b = vers('http://exemple.test/clair');
    await refus(fetchSafe('https://exemple.test/', { fetch: b.fetch, lookup }), 'SCHEMA');
    const c = vers('https://169.254.169.254/latest/meta-data');
    await refus(fetchSafe('https://exemple.test/', { fetch: c.fetch, lookup }), 'ADRESSE_PRIVEE');
    const boucle = sequence(reponse(302, { headers: { location: 'https://exemple.test/encore' } }));
    await refus(fetchSafe('https://exemple.test/', { fetch: boucle.fetch, lookup: lookupPublic }), 'REDIRECTIONS');
    assert.equal(boucle.appels.length, 6, '1 requête + 5 redirections suivies');
  });

  it('403 : message qui conseille la capture manuelle (--file)', async () => {
    const s = sequence(reponse(403));
    const e = await refus(fetchSafe('https://exemple.test/', { fetch: s.fetch, lookup: lookupPublic }), 'BLOQUE');
    assert.match(e.message, /capture manuelle \(--file\)/);
  });

  it('autres statuts d’erreur et redirection sans Location', async () => {
    await refus(fetchSafe('https://exemple.test/', { fetch: sequence(reponse(404)).fetch, lookup: lookupPublic }), 'HTTP');
    await refus(fetchSafe('https://exemple.test/', { fetch: sequence(reponse(500)).fetch, lookup: lookupPublic }), 'HTTP');
    await refus(fetchSafe('https://exemple.test/', { fetch: sequence(reponse(302)).fetch, lookup: lookupPublic }), 'HTTP');
  });

  it('plafonne le corps pendant la lecture (sans content-length)', async () => {
    const gros = new Uint8Array(2048).fill(97);
    const flux = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(gros);
      },
    });
    const s = sequence(new Response(flux, { status: 200 }));
    await refus(fetchSafe('https://exemple.test/', { fetch: s.fetch, lookup: lookupPublic, maxOctets: 10_000 }), 'VOLUME');
  });

  it('refuse d’emblée un corps annoncé trop gros', async () => {
    const s = sequence(reponse(200, { body: 'x', headers: { 'content-length': '999999999' } }));
    await refus(fetchSafe('https://exemple.test/', { fetch: s.fetch, lookup: lookupPublic, maxOctets: 1000 }), 'VOLUME');
  });

  it('abandonne après le délai global', async () => {
    const lent = (async (_u: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    await refus(fetchSafe('https://exemple.test/', { fetch: lent, lookup: lookupPublic, timeoutMs: 50 }), 'DELAI');
  });

  it('erreur réseau ou DNS : FetchSafeError RESEAU', async () => {
    await refus(fetchSafe('https://exemple.test/', { fetch: sequence(new TypeError('fetch failed')).fetch, lookup: lookupPublic }), 'RESEAU');
    await refus(
      fetchSafe('https://exemple.test/', {
        fetch: sequence(reponse(200)).fetch,
        lookup: async () => {
          throw new Error('ENOTFOUND');
        },
      }),
      'RESEAU',
    );
  });
});

describe('WR-04 : erreurs de lecture du corps', () => {
  const corpsEnErreur = (erreur: Error): Response =>
    new Response(new ReadableStream({ pull() { throw erreur; } }), { status: 200 });

  it('une coupure de connexion pendant le corps devient RESEAU', async () => {
    const { fetch: f } = sequence(corpsEnErreur(new TypeError('terminated')));
    const e = await refus(fetchSafe('https://exemple.test/x', { fetch: f, lookup: lookupPublic }), 'RESEAU');
    assert.match(e.message, /terminated/);
  });

  it('un délai pendant le corps devient DELAI', async () => {
    const err = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { fetch: f } = sequence(corpsEnErreur(err));
    await refus(fetchSafe('https://exemple.test/x', { fetch: f, lookup: lookupPublic }), 'DELAI');
  });
});
