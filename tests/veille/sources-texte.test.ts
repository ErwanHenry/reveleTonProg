// Phase 10.3, plan 03 : récupération du texte des sources. Fetch et lookup injectés, aucun accès réseau réel.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TEXTE_MAX, recupererTexte } from '../../scripts/lib/veille/sources-texte.ts';

const PUBLIC = async (): Promise<{ address: string; family: number }[]> => [{ address: '93.184.215.14', family: 4 }];
const PRIVE = async (): Promise<{ address: string; family: number }[]> => [{ address: '10.0.0.1', family: 4 }];

function faux(reponse: () => Response | Error): { fetch: typeof fetch; appels: string[] } {
  const appels: string[] = [];
  const f = (async (url: string) => {
    appels.push(String(url));
    const r = reponse();
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fetch: f, appels };
}
const html = (corps: string, type = 'text/html; charset=utf-8'): Response => new Response(corps, { status: 200, headers: { 'content-type': type } });

describe('recupererTexte', () => {
  it('page HTML ordinaire : texte nettoyé, URL finale', async () => {
    const f = faux(() => html('<html><body><h1>Titre</h1><p>Marie Exemple a déclaré sa candidature.</p><script>var x=1</script></body></html>'));
    const r = await recupererTexte('https://exemple.test/page', { fetch: f.fetch, lookup: PUBLIC });
    assert.ok(r.ok);
    assert.match(r.ok ? r.texte : '', /Marie Exemple a déclaré sa candidature/);
    assert.doesNotMatch(r.ok ? r.texte : '', /var x/);
    assert.equal(r.ok && r.tronque, false);
    assert.match(r.ok ? r.url : '', /^https:\/\/exemple\.test\/page/);
  });

  it('texte de plus de 30 000 caractères : tronqué', async () => {
    const f = faux(() => html(`<html><body><p>${'mot '.repeat(12_000)}</p></body></html>`));
    const r = await recupererTexte('https://exemple.test/long', { fetch: f.fetch, lookup: PUBLIC });
    assert.ok(r.ok && r.tronque);
    assert.equal(r.ok && r.texte.length, TEXTE_MAX);
  });

  it('http:// et adresse privée : inaccessible, aucune requête', async () => {
    const f = faux(() => html('<p>x</p>'));
    assert.deepEqual(await recupererTexte('http://exemple.test/', { fetch: f.fetch, lookup: PUBLIC }), { ok: false, echec: 'inaccessible' });
    assert.deepEqual(await recupererTexte('https://exemple.test/', { fetch: f.fetch, lookup: PRIVE }), { ok: false, echec: 'inaccessible' });
    assert.deepEqual(await recupererTexte('https://10.0.0.1/', { fetch: f.fetch, lookup: PUBLIC }), { ok: false, echec: 'inaccessible' });
    assert.equal(f.appels.length, 0);
  });

  it('PDF : non_html', async () => {
    const f = faux(() => new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }));
    assert.deepEqual(await recupererTexte('https://exemple.test/a.pdf', { fetch: f.fetch, lookup: PUBLIC }), { ok: false, echec: 'non_html' });
  });

  it('coquille JS : grande page presque sans texte', async () => {
    const f = faux(() => html(`<html><body><div id="root"></div><script>${'a'.repeat(40_000)}</script></body></html>`));
    assert.deepEqual(await recupererTexte('https://exemple.test/spa', { fetch: f.fetch, lookup: PUBLIC }), { ok: false, echec: 'coquille_js' });
  });

  it('page vide : vide', async () => {
    const f = faux(() => html('<html><body><script>1</script></body></html>'));
    assert.deepEqual(await recupererTexte('https://exemple.test/vide', { fetch: f.fetch, lookup: PUBLIC }), { ok: false, echec: 'vide' });
  });

  it('erreur réseau et statut HTTP en erreur : inaccessible, sans message', async () => {
    const e = faux(() => new Error('connexion refusée par 93.184.215.14'));
    assert.deepEqual(await recupererTexte('https://exemple.test/', { fetch: e.fetch, lookup: PUBLIC }), { ok: false, echec: 'inaccessible' });
    const h = faux(() => new Response('non', { status: 404 }));
    assert.deepEqual(await recupererTexte('https://exemple.test/', { fetch: h.fetch, lookup: PUBLIC }), { ok: false, echec: 'inaccessible' });
  });
});
