import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it, type TestContext } from 'node:test';
import { parse } from 'yaml';
import { Sortie, executer } from '../../scripts/archive-source.ts';
import { validateYamlText } from '../../src/lib/content-core/load.ts';
import { BASE_CORPUS } from '../helpers/overlay.ts';
import { SCHEMAS_DIR } from '../helpers/validate-yaml.ts';
import { extraitDansInstantane, lireInstantane, parseSnapshotLocation, submitWayback, urlInstantane, urlInstantaneOriginal } from '../../scripts/lib/wayback.ts';

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

describe('WR-05 : l’instantané doit porter sur l’adresse soumise', () => {
  it('refuse un instantané d’une autre adresse (redirection de la cible)', async () => {
    const r = await submitWayback('https://x.example/p', { fetch: reponse(302, 'https://web.archive.org/web/20261103014534/https://x.example/erreur'), now: () => NOW });
    assert.equal(r.ok, false);
    assert.match(r.ok ? '' : r.reason, /ne porte pas sur l'adresse soumise/);
  });

  it('accepte les variantes équivalentes : barre finale, fragment, http/https, hôte en majuscules', async () => {
    for (const cible of ['https://x.example/p/', 'http://x.example/p', 'https://X.example/p#haut', 'https:/x.example/p']) {
      const r = await submitWayback('https://x.example/p', { fetch: reponse(302, `https://web.archive.org/web/20261103014534/${cible}`), now: () => NOW });
      assert.equal(r.ok, true, cible);
    }
  });
});

describe('urlInstantane / urlInstantaneOriginal', () => {
  it('forme publique et forme « octets d’origine » (id_)', () => {
    assert.equal(urlInstantane('20261109220051', 'https://x.example/p/'), 'https://web.archive.org/web/20261109220051/https://x.example/p/');
    assert.equal(urlInstantaneOriginal('20261109220051', 'https://x.example/p/'), 'https://web.archive.org/web/20261109220051id_/https://x.example/p/');
  });

  it('refuse un horodatage qui n’a pas 14 chiffres, une date impossible ou une URL non https', () => {
    for (const h of ['2026110922005', '202611092200511', '2026110922005a', '20261309220051', '']) {
      assert.equal(urlInstantane(h, 'https://x.example/'), null, h);
      assert.equal(urlInstantaneOriginal(h, 'https://x.example/'), null, h);
    }
    assert.equal(urlInstantane('20261109220051', 'http://x.example/'), null);
    assert.equal(urlInstantane('20261109220051', 'pas une url'), null);
  });
});

describe('extraitDansInstantane', () => {
  const extrait = 'La pleine santé\n\nJe veux une France où il fait bon vivre.\n\nPourquoi ?\n';

  it('tous les paragraphes présents : trouvés = total, aucun manquant', () => {
    const r = extraitDansInstantane(extrait, 'Menu\nLa pleine santé\n\nJe veux une France où il fait bon vivre.\n\nPourquoi ?\n\nPied de page\n');
    assert.deepEqual(r, { trouves: 3, total: 3, premierManquant: null });
  });

  it('casse, accents et blancs pliés des deux côtés', () => {
    const r = extraitDansInstantane(extrait, 'LA PLEINE SANTE\n\nje veux une  France\nou il fait bon vivre.\n\npourquoi ?');
    assert.equal(r.trouves, 3);
  });

  it('un paragraphe absent : compte et 60 premiers caractères du premier manquant', () => {
    const long = `${'Un paragraphe très long qui n’apparaît pas dans l’instantané, '.repeat(3)}fin.`;
    const r = extraitDansInstantane(`${extrait}\n${long}\n`, 'La pleine santé Je veux une France où il fait bon vivre. Pourquoi ?');
    assert.equal(r.total, 4);
    assert.equal(r.trouves, 3);
    assert.equal(r.premierManquant, [...long].slice(0, 60).join(''));
  });

  it('extrait vide : refusé (total 0)', () => {
    assert.deepEqual(extraitDansInstantane('\n\n', 'x'), { trouves: 0, total: 0, premierManquant: null });
  });
});

describe('lireInstantane', () => {
  const HTML = '<html><body><h1>La pleine santé</h1><p>Je veux une France où il fait bon vivre.</p></body></html>';
  const lookup = async () => [{ address: '207.241.237.3', family: 4 }];
  const servir = (vues: string[], corps = HTML, location?: string): typeof fetch =>
    (async (url: string) => {
      vues.push(url);
      if (location !== undefined && vues.length === 1) return new Response(null, { status: 302, headers: { location } });
      return new Response(corps, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }) as unknown as typeof fetch;

  it('lit les octets d’origine (id_) en GET, jamais /save/, et rend le texte', async () => {
    const vues: string[] = [];
    const r = await lireInstantane('20261109220051', 'https://x.example/p/', { fetch: servir(vues), lookup });
    assert.deepEqual(vues, ['https://web.archive.org/web/20261109220051id_/https://x.example/p/']);
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.texte, /La pleine santé/);
  });

  it('refuse une réponse dont l’URL finale n’est pas l’instantané demandé (redirection vers un autre horodatage)', async () => {
    const vues: string[] = [];
    const r = await lireInstantane('20261109220051', 'https://x.example/p/', {
      fetch: servir(vues, HTML, 'https://web.archive.org/web/20250101000000id_/https://x.example/p/'),
      lookup,
    });
    assert.equal(r.ok, false);
    assert.match(r.ok ? '' : r.raison, /URL finale/);
  });

  it('refuse un horodatage invalide sans aucune requête', async () => {
    const vues: string[] = [];
    const r = await lireInstantane('2026', 'https://x.example/p/', { fetch: servir(vues), lookup });
    assert.equal(r.ok, false);
    assert.deepEqual(vues, []);
  });
});

// ---------- mode --wayback-adopter et exceptions, en processus avec un fetch injecté (plan 09-03) ----------

describe('archive-source --wayback-adopter (hors réseau)', () => {
  const SOURCE_REL = 'src/content/sources/marie-fictive-programme.yaml';
  const EXTRAIT_REL = 'archives/marie-fictive/23c5f1cc8eff.txt';
  const ANCIENNE = 'https://marie-fictive.exemple.invalid/programme';
  const NOUVELLE = 'https://marie-fictive.exemple.invalid/le-programme/';
  const H = '20261109220051';
  const WAYBACK_LIGNE = `  wayback_url: https://web.archive.org/web/20261020100000/${ANCIENNE}\n`;
  const EXCEPTION = `  wayback_exception:
    motif: "La page d'origine affiche des données personnelles : elle n'est pas envoyée à la Wayback Machine."
    decide_par: Erwan Henry
    decide_le: 2026-11-10
`;
  const lookup = async () => [{ address: '207.241.237.3', family: 4 }];
  const dossiers: string[] = [];
  after(() => {
    for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  /** Copie du corpus de référence ; la source perd son wayback_url (ou le remplace par `remplacement`). */
  function racine(remplacement = ''): string {
    const r = mkdtempSync(path.join(os.tmpdir(), 'rtp-adopter-'));
    dossiers.push(r);
    cpSync(BASE_CORPUS, r, { recursive: true });
    const f = path.join(r, SOURCE_REL);
    writeFileSync(f, readFileSync(f, 'utf8').replace(WAYBACK_LIGNE, remplacement));
    return r;
  }

  /** HTML d'instantané : chaque paragraphe de l'extrait dans un <p>, entourés d'un menu et d'un pied de page. */
  function htmlInstantane(r: string, retirer?: number): string {
    const paragraphes = readFileSync(path.join(r, EXTRAIT_REL), 'utf8').split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x !== '');
    const gardes = paragraphes.filter((_, i) => i !== retirer);
    return `<html><body><nav>Accueil</nav>${gardes.map((x) => `<p>${x.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</p>`).join('')}<footer>Mentions</footer></body></html>`;
  }

  function serveur(html: string, vues: string[]): typeof fetch {
    return (async (url: string) => {
      vues.push(url);
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }) as unknown as typeof fetch;
  }

  function sortie(t: TestContext): { texte: () => string } {
    const log = t.mock.method(console, 'log', () => undefined);
    const warn = t.mock.method(console, 'warn', () => undefined);
    return { texte: () => [...log.mock.calls, ...warn.mock.calls].map((c) => c.arguments.join(' ')).join('\n') };
  }

  const empreintes = (r: string): string => execFileSync('shasum', ['-a', '256', ...readdirSync(path.join(r, 'archives', 'marie-fictive')).map((n) => path.join(r, 'archives', 'marie-fictive', n))], { encoding: 'utf8' });

  async function refus(promesse: Promise<void>, code: 1 | 2, motif: RegExp): Promise<void> {
    await assert.rejects(promesse, (e: unknown) => {
      assert.ok(e instanceof Sortie, String(e));
      assert.equal(e.code, code);
      assert.match(e.message, motif);
      return true;
    });
  }

  it('--dry-run : lit l’instantané id_ en GET, affiche les paragraphes trouvés et le diff, n’écrit rien', async (t) => {
    const r = racine();
    const avant = readFileSync(path.join(r, SOURCE_REL), 'utf8');
    const vues: string[] = [];
    const out = sortie(t);
    await executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--nouvelle-url', NOUVELLE, '--dry-run', '--root', r], { fetch: serveur(htmlInstantane(r), vues), lookup });
    assert.deepEqual(vues, [`https://web.archive.org/web/${H}id_/${NOUVELLE}`]);
    assert.equal(readFileSync(path.join(r, SOURCE_REL), 'utf8'), avant);
    const texte = out.texte();
    assert.match(texte, /Paragraphes trouvés : (\d+)\/\1/);
    assert.match(texte, new RegExp(`-url: ${ANCIENNE}\n\\+url: ${NOUVELLE}`));
    assert.match(texte, new RegExp(`\\+  wayback_url: https://web.archive.org/web/${H}/${NOUVELLE}`));
    assert.match(texte, /écart entre la capture du dépôt .* : 21 jour\(s\)/);
  });

  it('écriture : url et wayback_url seuls changent, extrait, sha256 et dates intacts, rien sous archives/', async (t) => {
    const r = racine();
    const avant = parse(readFileSync(path.join(r, SOURCE_REL), 'utf8'), { schema: 'core' }) as Record<string, unknown> & { archive: Record<string, unknown> };
    const avantArchives = empreintes(r);
    sortie(t);
    await executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--nouvelle-url', NOUVELLE, '--root', r], { fetch: serveur(htmlInstantane(r), []), lookup });
    const texte = readFileSync(path.join(r, SOURCE_REL), 'utf8');
    const apres = parse(texte, { schema: 'core' }) as Record<string, unknown> & { archive: Record<string, unknown> };
    assert.equal(apres.url, NOUVELLE);
    assert.equal(apres.archive.wayback_url, `https://web.archive.org/web/${H}/${NOUVELLE}`);
    assert.deepEqual({ ...apres, url: avant.url, archive: { ...apres.archive, wayback_url: undefined } }, { ...avant, archive: { ...avant.archive, wayback_url: undefined } });
    assert.equal(empreintes(r), avantArchives);
    assert.deepEqual(validateYamlText('source', texte, path.join(r, SOURCE_REL), { schemasDir: SCHEMAS_DIR }).diagnostics, []);
  });

  it('sans --nouvelle-url : l’instantané porte sur l’url de la source, url inchangée', async (t) => {
    const r = racine();
    const vues: string[] = [];
    sortie(t);
    await executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--root', r], { fetch: serveur(htmlInstantane(r), vues), lookup });
    assert.deepEqual(vues, [`https://web.archive.org/web/${H}id_/${ANCIENNE}`]);
    const apres = parse(readFileSync(path.join(r, SOURCE_REL), 'utf8'), { schema: 'core' }) as { url: string; archive: { wayback_url: string } };
    assert.equal(apres.url, ANCIENNE);
    assert.equal(apres.archive.wayback_url, `https://web.archive.org/web/${H}/${ANCIENNE}`);
  });

  it('un paragraphe absent : refus (code 1), compte et premier absent, rien n’est écrit', async (t) => {
    const r = racine();
    const avant = readFileSync(path.join(r, SOURCE_REL), 'utf8');
    sortie(t);
    await refus(
      executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--nouvelle-url', NOUVELLE, '--root', r], { fetch: serveur(htmlInstantane(r, 0), []), lookup }),
      1,
      /adoption refusée : (\d+)\/(\d+) paragraphes .* premier absent : « .+ »/,
    );
    assert.equal(readFileSync(path.join(r, SOURCE_REL), 'utf8'), avant);
  });

  it('réponse redirigée vers un autre horodatage : refus (code 1)', async (t) => {
    const r = racine();
    sortie(t);
    let n = 0;
    const f = (async () => {
      n++;
      return n === 1
        ? new Response(null, { status: 302, headers: { location: `https://web.archive.org/web/20250101000000id_/${NOUVELLE}` } })
        : new Response(htmlInstantane(r), { status: 200, headers: { 'content-type': 'text/html' } });
    }) as unknown as typeof fetch;
    await refus(executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--nouvelle-url', NOUVELLE, '--root', r], { fetch: f, lookup }), 1, /URL finale/);
  });

  it('--instantane qui n’a pas 14 chiffres, --nouvelle-url en http : code 2, aucune requête', async (t) => {
    const r = racine();
    const vues: string[] = [];
    sortie(t);
    await refus(executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', '2026110922005', '--root', r], { fetch: serveur('', vues), lookup }), 2, /14 chiffres/);
    await refus(executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--nouvelle-url', 'http://x.example/', '--root', r], { fetch: serveur('', vues), lookup }), 2, /https/);
    assert.deepEqual(vues, []);
  });

  it('source avec exception motivée : adoption refusée (code 1), aucune requête', async (t) => {
    const r = racine(EXCEPTION);
    const vues: string[] = [];
    sortie(t);
    await refus(executer(['--wayback-adopter', 'marie-fictive-programme', '--instantane', H, '--root', r], { fetch: serveur(htmlInstantane(r), vues), lookup }), 1, /exception Wayback motivée/);
    assert.deepEqual(vues, []);
  });

  it('--wayback-only sur une source avec exception : refus (code 1) qui nomme l’exception, rien n’est soumis', async (t) => {
    const r = racine(EXCEPTION);
    sortie(t);
    const appels = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 500 }));
    await refus(executer(['--wayback-only', 'marie-fictive-programme', '--root', r]), 1, /exception Wayback motivée .*soumission à la Wayback Machine refusée/);
    assert.equal(appels.mock.callCount(), 0);
  });

  it('--wayback-missing : la source avec exception est listée à part, jamais soumise', async (t) => {
    const r = racine(EXCEPTION);
    const out = sortie(t);
    const appels = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 500 }));
    await executer(['--wayback-missing', '--root', r]);
    assert.equal(appels.mock.callCount(), 0);
    assert.match(out.texte(), /Exceptions motivées \(archive\.wayback_exception, jamais soumises\) : marie-fictive-programme/);
    assert.match(out.texte(), /Aucune source à soumettre/);
  });

  it('IMP-01 : --wayback-missing avec une source au YAML refusé (alias) : code 1, fichier et ligne, rien n’est soumis', async (t) => {
    const r = racine();
    writeFileSync(path.join(r, 'src', 'content', 'sources', 'alias-piege.yaml'), 'id: alias-piege\nurl: &u https://x.example/\ncopie: *u\n');
    const out = sortie(t);
    const appels = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 500 }));
    await refus(
      executer(['--wayback-missing', '--root', r]),
      1,
      /src\/content\/sources\/alias-piege\.yaml:3:8 YAML_ALIAS_INTERDIT .*rien n'a été soumis/s,
    );
    assert.equal(appels.mock.callCount(), 0);
    assert.doesNotMatch(out.texte(), /illisible : ignorée/);
  });

  it('--refresh garde l’exception (texte modifié : nouvel extrait, exception conservée)', async (t) => {
    const r = racine(EXCEPTION);
    const prive = mkdtempSync(path.join(os.tmpdir(), 'rtp-prive-'));
    dossiers.push(prive);
    execFileSync('git', ['init', '--quiet', prive]);
    const page = path.join(prive, '..', `${path.basename(prive)}-page.html`);
    writeFileSync(page, `<html><body><p>${'Un texte nouveau et assez long pour passer le minimum exigé. '.repeat(12)}</p></body></html>`);
    dossiers.push(page);
    const ancien = process.env.RTP_ARCHIVES_DIR;
    process.env.RTP_ARCHIVES_DIR = prive;
    sortie(t);
    try {
      await executer(['--refresh', 'marie-fictive-programme', '--file', page, '--capture-le', '2026-11-10T10:00:00+01:00', '--root', r]);
    } finally {
      if (ancien === undefined) delete process.env.RTP_ARCHIVES_DIR;
      else process.env.RTP_ARCHIVES_DIR = ancien;
    }
    const apres = parse(readFileSync(path.join(r, SOURCE_REL), 'utf8'), { schema: 'core' }) as { archive: Record<string, unknown> };
    assert.notEqual(apres.archive.extrait, EXTRAIT_REL);
    assert.deepEqual(apres.archive.wayback_exception, {
      motif: "La page d'origine affiche des données personnelles : elle n'est pas envoyée à la Wayback Machine.",
      decide_par: 'Erwan Henry',
      decide_le: '2026-11-10',
    });
    assert.ok(statSync(path.join(r, String(apres.archive.extrait))).isFile());
  });
});
