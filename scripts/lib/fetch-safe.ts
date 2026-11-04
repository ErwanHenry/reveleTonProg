// Téléchargement prudent d'une page ou d'un PDF public (CONT-03, menace T-03-08 : SSRF).
// https uniquement, adresses publiques uniquement (revérifiées à chaque redirection), 5 redirections
// au plus, délai global de 30 s, corps plafonné (compté pendant la lecture), aucun cookie ni
// identifiant : le seul en-tête envoyé est le user agent fixe.
// Limite connue : `fetch` résout le nom lui-même, après notre vérification DNS. Un attaquant qui
// contrôlerait le DNS d'un site visé pourrait répondre autrement la seconde fois (rebinding) ; l'outil
// est lancé à la main sur des adresses choisies par Erwan, le risque est accepté et documenté.
import dns from 'node:dns/promises';
import net from 'node:net';

export const USER_AGENT = 'reveleTonProg-archiver/0.1 (+https://github.com/ErwanHenry/reveleTonProg)';
export const FETCH_TIMEOUT_MS = 30_000;
export const FETCH_MAX_REDIRECTIONS = 5;
export const FETCH_MAX_OCTETS = 25 * 1024 * 1024;

export type CodeFetch = 'SCHEMA' | 'ADRESSE_PRIVEE' | 'REDIRECTIONS' | 'VOLUME' | 'BLOQUE' | 'HTTP' | 'DELAI' | 'RESEAU';

export class FetchSafeError extends Error {
  readonly code: CodeFetch;
  constructor(code: CodeFetch, message: string) {
    super(message);
    this.name = 'FetchSafeError';
    this.code = code;
  }
}

function ipv4Public(a: number, b: number, c: number, d: number): boolean {
  if ([a, b, c, d].some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  if (a === 0 || a === 10 || a === 127) return false; // « ce réseau », privé, boucle locale
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 (CGNAT)
  if (a === 169 && b === 254) return false; // lien local
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return false; // bancs d'essai
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast, réservé, diffusion
  return true;
}

/** Huit groupes de 16 bits d'une adresse IPv6 (zone `%eth0` ignorée, suffixe IPv4 pointé accepté), ou null. */
function groupesIPv6(adresse: string): number[] | null {
  let a = adresse;
  const zone = a.indexOf('%');
  if (zone !== -1) a = a.slice(0, zone);
  const m = a.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m !== null) {
    const o = [m[2], m[3], m[4], m[5]].map(Number) as [number, number, number, number];
    if (o.some((x) => x > 255)) return null;
    a = `${m[1] ?? ''}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const doubles = a.split('::');
  if (doubles.length > 2) return null;
  const parse = (s: string): number[] | null => {
    if (s === '') return [];
    const out: number[] = [];
    for (const g of s.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(Number.parseInt(g, 16));
    }
    return out;
  };
  const tete = parse(doubles[0] ?? '');
  if (tete === null) return null;
  if (doubles.length === 1) return tete.length === 8 ? tete : null;
  const queue = parse(doubles[1] ?? '');
  if (queue === null || tete.length + queue.length > 7) return null;
  return [...tete, ...Array<number>(8 - tete.length - queue.length).fill(0), ...queue];
}

const v4DeGroupes = (g: readonly number[], i: number): boolean =>
  ipv4Public((g[i] ?? 0) >> 8, (g[i] ?? 0) & 255, (g[i + 1] ?? 0) >> 8, (g[i + 1] ?? 0) & 255);

/** Vrai seulement pour une adresse IP publique routable ; toute adresse illisible est refusée. */
export function isPublicAddress(adresse: string): boolean {
  const nue = adresse.startsWith('[') && adresse.endsWith(']') ? adresse.slice(1, -1) : adresse;
  const famille = net.isIP(nue.includes('%') ? nue.slice(0, nue.indexOf('%')) : nue);
  if (famille === 4) {
    const [a, b, c, d] = nue.split('.').map(Number) as [number, number, number, number];
    return ipv4Public(a, b, c, d);
  }
  if (famille !== 6) return false;
  const g = groupesIPv6(nue);
  if (g === null) return false;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0] = g;
  const zeros5 = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (zeros5 && g5 === 0xffff) return v4DeGroupes(g, 6); // ::ffff:a.b.c.d (IPv4 mappée)
  if (zeros5 && g5 === 0) return v4DeGroupes(g, 6); // ::, ::1 (0.0.x.x refusé) et ::a.b.c.d (IPv4 « compatible »)
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return v4DeGroupes(g, 6); // NAT64
  if (g0 === 0x2002) return v4DeGroupes(g, 1); // 6to4
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) return false; // Teredo, documentation
  if ((g0 & 0xfe00) === 0xfc00) return false; // fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false; // fe80::/10
  if ((g0 & 0xff00) === 0xff00) return false; // multicast
  return true;
}

export interface Reponse {
  finalUrl: string;
  status: number;
  contentType: string | undefined;
  bytes: Uint8Array;
  lastModified: string | undefined;
  etag: string | undefined;
}

export interface Adresse {
  address: string;
  family: number;
}

export interface OptionsFetch {
  fetch?: typeof fetch;
  lookup?: (hote: string) => Promise<Adresse[]>;
  timeoutMs?: number;
  maxOctets?: number;
  maxRedirections?: number;
}

const lookupDefaut = async (hote: string): Promise<Adresse[]> => dns.lookup(hote, { all: true, verbatim: true });

async function verifierUrl(texte: string, lookup: (hote: string) => Promise<Adresse[]>): Promise<URL> {
  let url: URL;
  try {
    url = new URL(texte);
  } catch {
    throw new FetchSafeError('SCHEMA', `URL illisible : « ${texte.slice(0, 200)} »`);
  }
  if (url.protocol !== 'https:') throw new FetchSafeError('SCHEMA', `seul https est accepté (reçu « ${url.protocol} » pour ${url.host})`);
  if (url.username !== '' || url.password !== '') throw new FetchSafeError('SCHEMA', 'URL avec identifiants refusée');
  const hote = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
  if (net.isIP(hote) !== 0) {
    if (!isPublicAddress(hote)) throw new FetchSafeError('ADRESSE_PRIVEE', `adresse non publique refusée : ${hote}`);
    return url;
  }
  let adresses: Adresse[];
  try {
    adresses = await lookup(hote);
  } catch (e) {
    throw new FetchSafeError('RESEAU', `résolution DNS impossible pour ${hote} (${e instanceof Error ? e.message : String(e)})`);
  }
  if (adresses.length === 0) throw new FetchSafeError('RESEAU', `aucune adresse pour ${hote}`);
  const privee = adresses.find((a) => !isPublicAddress(a.address));
  if (privee !== undefined) throw new FetchSafeError('ADRESSE_PRIVEE', `${hote} se résout vers une adresse non publique (${privee.address}) : refusé`);
  return url;
}

async function lireCorps(res: Response, max: number, signal: AbortSignal): Promise<Uint8Array> {
  const annonce = Number(res.headers.get('content-length'));
  if (Number.isFinite(annonce) && annonce > max) throw new FetchSafeError('VOLUME', `corps annoncé de ${annonce} octets, au-delà du maximum de ${max}`);
  if (res.body === null) return new Uint8Array(0);
  const lecteur = res.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal.aborted) {
      void lecteur.cancel().catch(() => undefined);
      throw new FetchSafeError('DELAI', 'délai dépassé pendant la lecture');
    }
    let lu: ReadableStreamReadResult<Uint8Array>;
    try {
      lu = await lecteur.read();
    } catch (e) {
      const nom = e instanceof Error ? e.name : '';
      if (nom === 'TimeoutError' || nom === 'AbortError') throw new FetchSafeError('DELAI', 'délai dépassé pendant la lecture');
      throw new FetchSafeError('RESEAU', `lecture interrompue (${e instanceof Error ? e.message : String(e)})`);
    }
    const { done, value } = lu;
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void lecteur.cancel().catch(() => undefined);
      throw new FetchSafeError('VOLUME', `corps de plus de ${max} octets : lecture abandonnée`);
    }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) {
    out.set(m, pos);
    pos += m.byteLength;
  }
  return out;
}

/** Télécharge `url` en https vers des adresses publiques ; lève FetchSafeError dans tous les autres cas. */
export async function fetchSafe(url: string, opts: OptionsFetch = {}): Promise<Reponse> {
  const f = opts.fetch ?? fetch;
  const lookup = opts.lookup ?? lookupDefaut;
  const max = opts.maxOctets ?? FETCH_MAX_OCTETS;
  const maxRedirections = opts.maxRedirections ?? FETCH_MAX_REDIRECTIONS;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  let courante = await verifierUrl(url, lookup);
  for (let sauts = 0; ; sauts++) {
    let res: Response;
    try {
      res = await f(courante.href, { redirect: 'manual', headers: { 'user-agent': USER_AGENT }, signal });
    } catch (e) {
      if (e instanceof FetchSafeError) throw e;
      const nom = e instanceof Error ? e.name : '';
      if (nom === 'TimeoutError' || nom === 'AbortError') throw new FetchSafeError('DELAI', `délai dépassé (${Math.round((opts.timeoutMs ?? FETCH_TIMEOUT_MS) / 1000)} s) pour ${courante.host}`);
      throw new FetchSafeError('RESEAU', `échec réseau pour ${courante.host} (${e instanceof Error ? e.message : String(e)})`);
    }
    if (res.status >= 300 && res.status < 400) {
      void res.body?.cancel().catch(() => undefined);
      const loc = res.headers.get('location');
      if (loc === null) throw new FetchSafeError('HTTP', `HTTP ${res.status} sans en-tête Location pour ${courante.host}`);
      if (sauts >= maxRedirections) throw new FetchSafeError('REDIRECTIONS', `plus de ${maxRedirections} redirections`);
      let suivante: string;
      try {
        suivante = new URL(loc, courante).href;
      } catch {
        throw new FetchSafeError('HTTP', `redirection vers une adresse illisible : « ${loc.slice(0, 200)} »`);
      }
      courante = await verifierUrl(suivante, lookup);
      continue;
    }
    if (res.status === 403) {
      void res.body?.cancel().catch(() => undefined);
      throw new FetchSafeError('BLOQUE', `HTTP 403 pour ${courante.host} : le site refuse les outils automatiques ; capture manuelle (--file) : enregistrez la page depuis votre navigateur puis relancez avec --file`);
    }
    if (res.status < 200 || res.status > 299) {
      void res.body?.cancel().catch(() => undefined);
      throw new FetchSafeError('HTTP', `HTTP ${res.status} pour ${courante.href}`);
    }
    const bytes = await lireCorps(res, max, signal);
    return {
      finalUrl: courante.href,
      status: res.status,
      contentType: res.headers.get('content-type') ?? undefined,
      bytes,
      lastModified: res.headers.get('last-modified') ?? undefined,
      etag: res.headers.get('etag') ?? undefined,
    };
  }
}
