import { describe, it, after, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { creerServeurRelecture, CSP_RELECTURE } from '../../scripts/lib/relecture/serveur.ts';
import servir, { demarrer } from '../../scripts/lib/relecture/commandes/servir.ts';
import type { Contexte } from '../../scripts/lib/relecture/etat.ts';
import { lireJournal, lireNotes } from '../../scripts/lib/relecture/registre.ts';
import { corpusRelecture, nettoyerCorpusRelecture } from '../helpers/corpus-relecture.ts';
import type { CorpusRelecture } from '../helpers/corpus-relecture.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';

// Serveur local de relecture (09-05, PUB-01, D-04) sur une copie temporaire du corpus fictif M1, thème logement.
// Requêtes brutes node:http : l'en-tête Host est forgé à volonté (fetch le fixe lui-même). Chaque refus laisse
// l'arbre src/content octet pour octet et n'ouvre aucun registre.

after(() => nettoyerCorpusRelecture());

const MESURE = 'src/content/mesures/elise-erard/guichet-unique.yaml';
const PAUL = 'src/content/candidats/paul-de-villefranche.yaml';
const COUV = 'src/content/couverture/logement.yaml';
const FORM = 'application/x-www-form-urlencoded';

interface Reponse {
  status: number;
  headers: IncomingHttpHeaders;
  corps: string;
}

function differences(avant: Map<string, string>, apres: Map<string, string>): string[] {
  const cles = new Set([...avant.keys(), ...apres.keys()]);
  return [...cles].filter((k) => avant.get(k) !== apres.get(k)).sort();
}

describe('serveur de relecture (corpus M1 temporaire, thème logement)', () => {
  let c: CorpusRelecture;
  let serveur: Server;
  let port: number;
  let hote: string;

  function envoyer(methode: string, chemin: string, options: { headers?: Record<string, string>; corps?: string | Buffer } = {}): Promise<Reponse> {
    return new Promise((ok, ko) => {
      const headers: Record<string, string> = { host: hote, ...options.headers };
      if (options.corps !== undefined) headers['content-length'] = String(Buffer.byteLength(options.corps));
      const req = request({ host: '127.0.0.1', port, path: chemin, method: methode, headers }, (res) => {
        const morceaux: Buffer[] = [];
        res.on('data', (b: Buffer) => morceaux.push(b));
        res.on('end', () => ok({ status: res.statusCode ?? 0, headers: res.headers, corps: Buffer.concat(morceaux).toString('utf8') }));
      });
      req.on('error', ko);
      if (options.corps !== undefined) req.write(options.corps);
      req.end();
    });
  }
  const get = (chemin: string, headers: Record<string, string> = {}): Promise<Reponse> => envoyer('GET', chemin, { headers });
  const post = (chemin: string, champs: Record<string, string>, headers: Record<string, string> = {}): Promise<Reponse> =>
    envoyer('POST', chemin, { headers: { 'content-type': FORM, origin: `http://${hote}`, 'sec-fetch-site': 'same-origin', ...headers }, corps: new URLSearchParams(champs).toString() });
  async function jeton(): Promise<string> {
    const r = await get('/candidat/elise-erard');
    const m = /name="jeton" value="([0-9a-f]{64})"/.exec(r.corps);
    assert.ok(m, 'jeton dans un champ caché');
    return m[1]!;
  }

  beforeEach(async () => {
    c = corpusRelecture();
    serveur = creerServeurRelecture({ racine: c.racine, schemasDir: SCHEMAS_DIR, theme: 'logement', maintenant: () => new Date('2026-11-20T10:00:00Z') });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    port = (serveur.address() as AddressInfo).port;
    hote = `127.0.0.1:${port}`;
  });
  afterEach(async () => {
    serveur.closeAllConnections();
    await new Promise<void>((ok) => serveur.close(() => ok()));
  });

  it('GET / : résumé du thème, en-têtes de sécurité, aucun script', async () => {
    const r = await get('/');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-security-policy'], "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    assert.equal(r.headers['content-security-policy'], CSP_RELECTURE);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    // « same-origin », jamais « no-referrer » : sous no-referrer, un navigateur envoie « Origin: null » sur le POST
    // d'un formulaire de la page elle-même, et le contrôle d'origine refuse alors toute validation (403). Constaté
    // dans un vrai navigateur le 2026-11-11 : les tests à en-têtes fabriqués ne le voyaient pas. Sous same-origin,
    // l'origine complète part vers ce serveur et rien ne part vers les sites des sources.
    assert.equal(r.headers['referrer-policy'], 'same-origin');
    assert.match(String(r.headers['content-type']), /^text\/html; charset=utf-8$/);
    assert.match(r.corps, /reste 7 sur 11/);
    assert.match(r.corps, /href="\/candidat\/elise-erard"/);
    assert.match(r.corps, /href="\/candidat\/paul-de-villefranche"/);
    assert.ok(!r.corps.toLowerCase().includes('<script'));
  });

  it('GET /candidat/<id> : statut, case, mesure avec citation surlignée, source, formulaires avec jeton caché', async () => {
    const r = await get('/candidat/elise-erard');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-security-policy'], CSP_RELECTURE);
    for (const attendu of [
      'Guichet unique départemental du logement social (fictif)',
      '<mark>Nous créerons un guichet unique départemental pour toutes les demandes de logement social</mark>',
      'c3107ed7287b072c38461027ac295a334cfcdd7076821cbaf9a78a0bb465e2b5',
      'Annonce de candidature (fictive)',
      'non_precise',
      'page 2 (fictive)',
    ]) {
      assert.ok(r.corps.includes(attendu), attendu);
    }
    assert.match(r.corps, /<form method="post" action="\/valider">/);
    assert.match(r.corps, /<form method="post" action="\/note">/);
    assert.match(r.corps, /name="type" value="mesure"/);
    assert.match(r.corps, /name="type" value="statut"/);
    assert.match(r.corps, /name="type" value="case"/);
    const t = await jeton();
    assert.ok(!r.corps.includes(`jeton=${t}`), 'jamais dans une URL');
    assert.ok(!r.corps.toLowerCase().includes('<script'));
    assert.equal((await get('/candidat/nina-pressentie')).status, 404);
    assert.equal((await get('/candidat/..%2F..%2Fetc')).status, 400);
  });

  it('Host étranger (rebinding DNS) : 421, y compris sur POST, rien d’écrit', async () => {
    const t = await jeton();
    const avant = c.arbre();
    for (const h of ['exemple.test', `exemple.test:${port}`, `127.0.0.1:${port + 1}`, '127.0.0.1', `localhost`, `127.0.0.1.exemple.test:${port}`, `[::1]:${port}`]) {
      assert.equal((await get('/', { host: h })).status, 421, h);
      const p = await post('/valider', { type: 'mesure', cible: 'elise-erard/guichet-unique', jeton: t }, { host: h, origin: `http://${h}` });
      assert.equal(p.status, 421, h);
      assert.equal(p.headers['content-security-policy'], CSP_RELECTURE);
    }
    assert.equal((await get('/', { host: `localhost:${port}` })).status, 200);
    assert.deepEqual(differences(avant, c.arbre()), []);
    assert.equal(existsSync(c.chemin('relecture/journal.jsonl')), false);
  });

  it('Origin étranger, Sec-Fetch-Site croisé, mauvais type de contenu, corps trop gros, jeton absent ou faux : refus, rien d’écrit', async () => {
    const t = await jeton();
    const avant = c.arbre();
    const champs = { type: 'mesure', cible: 'elise-erard/guichet-unique', jeton: t };
    const cas: [string, () => Promise<Reponse>, number][] = [
      ['origin étranger', () => post('/valider', champs, { origin: 'http://exemple.test' }), 403],
      ['origin null', () => post('/valider', champs, { origin: 'null' }), 403],
      ['origin autre port', () => post('/valider', champs, { origin: `http://127.0.0.1:${port + 1}` }), 403],
      ['origin étranger en GET', () => get('/', { origin: 'http://exemple.test' }), 403],
      ['sec-fetch-site cross-site', () => post('/valider', champs, { 'sec-fetch-site': 'cross-site' }), 403],
      ['sec-fetch-site same-site', () => post('/valider', champs, { 'sec-fetch-site': 'same-site' }), 403],
      ['text/plain', () => post('/valider', champs, { 'content-type': 'text/plain' }), 415],
      ['json', () => envoyer('POST', '/valider', { headers: { 'content-type': 'application/json' }, corps: JSON.stringify(champs) }), 415],
      ['multipart', () => post('/valider', champs, { 'content-type': 'multipart/form-data; boundary=x' }), 415],
      ['sans type', () => envoyer('POST', '/valider', { corps: new URLSearchParams(champs).toString() }), 415],
      ['corps > 8 Kio', () => post('/valider', { ...champs, bourrage: 'x'.repeat(9000) }), 413],
      ['jeton absent', () => post('/valider', { type: 'mesure', cible: 'elise-erard/guichet-unique' }), 403],
      ['jeton faux même longueur', () => post('/valider', { ...champs, jeton: t.replace(/^./, t[0] === 'a' ? 'b' : 'a') }), 403],
      ['jeton faux autre longueur', () => post('/valider', { ...champs, jeton: 'abc' }), 403],
      ['jeton en double', () => envoyer('POST', '/valider', { headers: { 'content-type': FORM }, corps: `type=mesure&cible=elise-erard%2Fguichet-unique&jeton=${t}&jeton=${t}` }), 403],
      ['note sans jeton', () => post('/note', { cible: 'mesure:elise-erard/guichet-unique', texte: 'x' }), 403],
      ['cible chemin', () => post('/valider', { ...champs, cible: '../../etc/passwd' }), 400],
      ['cible fichier', () => post('/valider', { ...champs, cible: 'src/content/mesures/elise-erard/guichet-unique.yaml' }), 400],
      ['cible inconnue', () => post('/valider', { ...champs, cible: 'elise-erard/inexistante' }), 400],
      ['type inconnu', () => post('/valider', { ...champs, type: 'theme' }), 400],
      ['statut hors périmètre', () => post('/valider', { ...champs, type: 'statut', cible: 'nina-pressentie' }), 400],
      ['case d’un autre thème', () => post('/note', { cible: 'case:climat/elise-erard', texte: 'x', jeton: t }), 400],
      ['note cible chemin', () => post('/note', { cible: '../x', texte: 'x', jeton: t }), 400],
      ['note avec caractère de contrôle', () => post('/note', { cible: 'mesure:elise-erard/guichet-unique', texte: 'a\u0007b', jeton: t }), 400],
      ['note trop longue', () => post('/note', { cible: 'mesure:elise-erard/guichet-unique', texte: 'x'.repeat(501), jeton: t }), 400],
      ['GET /valider', () => get('/valider'), 405],
      ['POST /', () => post('/', champs), 405],
      ['chemin inconnu', () => get('/src/content/mesures/elise-erard/guichet-unique.yaml'), 404],
    ];
    for (const [nom, faire, attendu] of cas) {
      const r = await faire();
      assert.equal(r.status, attendu, `${nom} : ${r.corps.slice(0, 200)}`);
      assert.equal(r.headers['content-security-policy'], CSP_RELECTURE, nom);
      assert.equal(r.headers['cache-control'], 'no-store', nom);
    }
    assert.deepEqual(differences(avant, c.arbre()), []);
    assert.equal(existsSync(c.chemin('relecture/journal.jsonl')), false);
    assert.equal(existsSync(c.chemin('relecture/notes.jsonl')), false);
  });

  it('parcours complet : valider une mesure écrit les trois champs de relecture, et rien d’autre ; registre', async () => {
    const t = await jeton();
    const avant = c.arbre();
    const original = c.lire(MESURE);
    const r = await post('/valider', { type: 'mesure', cible: 'elise-erard/guichet-unique', jeton: t });
    assert.equal(r.status, 303, r.corps);
    assert.equal(r.headers.location, '/candidat/elise-erard?etat=valide#mesure-guichet-unique');
    assert.equal(r.headers['content-security-policy'], CSP_RELECTURE);
    const suite = await get(r.headers.location!);
    assert.equal(suite.status, 200);
    assert.match(suite.corps, /Validé/);
    assert.deepEqual(differences(avant, c.arbre()), [MESURE]);
    assert.equal(c.lire(MESURE), original.replace('statut_relecture: brouillon\n', 'statut_relecture: relu\nrelecteur: Erwan Henry\ndate_relecture: 2026-11-20\n'));
    const journal = lireJournal(c.racine);
    assert.deepEqual(
      journal.map((l) => [l.cible, l.relecteur, l.date, l.action]),
      [['mesure:elise-erard/guichet-unique', 'Erwan Henry', '2026-11-20', 'marquer']],
    );
    // Un code d'état hors de la liste fermée n'affiche rien.
    const autre = await get('/candidat/elise-erard?etat=%3Cb%3Ehack');
    assert.ok(!autre.corps.includes('<b>hack') && !autre.corps.includes('&lt;b&gt;hack'));
  });

  it('valider un statut et une case passe par le même cœur que la ligne de commande', async () => {
    const t = await jeton();
    const avant = c.arbre();
    const s = await post('/valider', { type: 'statut', cible: 'paul-de-villefranche', jeton: t });
    assert.equal(s.status, 303, s.corps);
    assert.equal(s.headers.location, '/candidat/paul-de-villefranche?etat=valide#statut');
    const k = await post('/valider', { type: 'case', cible: 'paul-de-villefranche', jeton: t });
    assert.equal(k.status, 303, k.corps);
    assert.equal(k.headers.location, '/candidat/paul-de-villefranche?etat=valide#case');
    assert.deepEqual(differences(avant, c.arbre()), [PAUL, COUV].sort());
    assert.ok(c.lire(PAUL).endsWith('    statut_relecture: relu\n    relecteur: Erwan Henry\n    date_relecture: 2026-11-20\n'));
    assert.ok(c.lire(COUV).endsWith('  - candidat: paul-de-villefranche\n    etat: programme_non_publie\n    verifie_le: 2026-11-20\n    verifie_par: Erwan Henry\n'));
  });

  it('échappement : balises et guillemets venus d’une rédaction et d’une note ; une note ouverte bloque la validation', async () => {
    c.ecrire(MESURE, c.lire(MESURE).replace(/^ {2}resume: .*$/m, '  resume: Élise Érard <script>alert("r")</script> propose un guichet "unique" & départemental.'));
    const t = await jeton();
    const n = await post('/note', { cible: 'mesure:elise-erard/guichet-unique', texte: '<script>alert("n")</script> vérifier "page 2"', jeton: t });
    assert.equal(n.status, 303, n.corps);
    assert.equal(n.headers.location, '/candidat/elise-erard?etat=note#mesure-guichet-unique');
    assert.deepEqual(lireNotes(c.racine).map((l) => [l.cible, l.etat]), [['mesure:elise-erard/guichet-unique', 'ouverte']]);
    const page = await get('/candidat/elise-erard?etat=note');
    assert.ok(!page.corps.toLowerCase().includes('<script'));
    assert.ok(page.corps.includes('&lt;script&gt;alert(&quot;r&quot;)&lt;/script&gt; propose un guichet &quot;unique&quot; &amp; départemental.'));
    assert.ok(page.corps.includes('&lt;script&gt;alert(&quot;n&quot;)&lt;/script&gt; vérifier &quot;page 2&quot;'));
    assert.match(page.corps, /Note enregistrée/);
    // marquer refusé (note ouverte) : message affiché, rien d'écrit.
    const avant = c.arbre();
    const v = await post('/valider', { type: 'mesure', cible: 'elise-erard/guichet-unique', jeton: t });
    assert.equal(v.status, 409);
    assert.match(v.corps, /note\(s\) ouverte\(s\)/);
    assert.ok(!v.corps.toLowerCase().includes('<script'));
    assert.deepEqual(differences(avant, c.arbre()), []);
    assert.equal(existsSync(c.chemin('relecture/journal.jsonl')), false);
  });
});

describe('commande servir', () => {
  let c: CorpusRelecture;
  before(() => {
    c = corpusRelecture();
  });
  const contexte = (lignes: string[]): Contexte => ({
    racine: c.racine,
    schemasDir: SCHEMAS_DIR,
    sortie: (l) => lignes.push(l),
    erreur: (l) => lignes.push(`E:${l}`),
    maintenant: () => new Date('2026-11-20T10:00:00Z'),
  });

  it('démarre sur 127.0.0.1, affiche l’adresse sans le jeton', async () => {
    const lignes: string[] = [];
    const r = await demarrer({ theme: 'logement', port: 0 }, contexte(lignes));
    assert.ok(typeof r !== 'number');
    const a = r.serveur.address() as AddressInfo;
    assert.equal(a.address, '127.0.0.1');
    assert.ok(lignes.includes(`http://127.0.0.1:${a.port}/`), lignes.join('\n'));
    assert.ok(lignes.some((l) => /Ctrl\+C pour arrêter/.test(l)));
    assert.ok(!lignes.some((l) => /[0-9a-f]{64}/.test(l)), 'jeton jamais affiché');
    r.serveur.closeAllConnections();
    await new Promise<void>((ok) => r.serveur.close(() => ok()));
  });

  it('port occupé : code 1 ; thème inconnu : code 1 ; arguments invalides : code 2', async () => {
    const occupant = createServer();
    await new Promise<void>((ok) => occupant.listen(0, '127.0.0.1', ok));
    const pris = (occupant.address() as AddressInfo).port;
    const lignes: string[] = [];
    assert.equal(await demarrer({ theme: 'logement', port: pris }, contexte(lignes)), 1);
    assert.ok(lignes.some((l) => l.startsWith('E:') && l.includes(String(pris))), lignes.join('\n'));
    await new Promise<void>((ok) => occupant.close(() => ok()));
    assert.equal(await servir(['--theme', 'inexistant', '--port', '0'], contexte([])), 1);
    assert.equal(await servir(['--theme', '../x'], contexte([])), 2);
    assert.equal(await servir(['--port', '99999'], contexte([])), 2);
    assert.equal(await servir(['--port', 'abc'], contexte([])), 2);
    assert.equal(await servir(['--inconnue'], contexte([])), 2);
  });
});
