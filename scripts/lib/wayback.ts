// Soumission à l'Internet Archive (Save Page Now anonyme). Module sans E/S propre : `fetch` et
// l'horloge sont injectés. Un échec est un avertissement, jamais une erreur bloquante.
import { normalizeExtract } from './archive.ts';
import { FetchSafeError, fetchSafe, type Adresse } from './fetch-safe.ts';
import { decodeHtml, htmlToText } from './html-text.ts';

export const WAYBACK_USER_AGENT = 'reveleTonProg-archiver/0.1 (+https://github.com/ErwanHenry/reveleTonProg)';
export const WAYBACK_TIMEOUT_MS = 150_000;
const SNAPSHOT = /^https:\/\/web\.archive\.org\/web\/([0-9]{14})\//;

export interface Instantane {
  url: string;
  /** Instant de la capture, lu dans les 14 chiffres AAAAMMJJhhmmss (UTC). */
  instant: Date;
}

/** N'accepte que `https://web.archive.org/web/<14 chiffres>/…` ; `base` résout une adresse relative. */
export function parseSnapshotLocation(location: string, base = 'https://web.archive.org/save/'): Instantane | null {
  let url: string;
  try {
    url = new URL(location, base).href;
  } catch {
    return null;
  }
  const m = url.match(SNAPSHOT);
  if (m?.[1] === undefined) return null;
  const ts = m[1];
  const [a, mo, j, h, mi, s] = [ts.slice(0, 4), ts.slice(4, 6), ts.slice(6, 8), ts.slice(8, 10), ts.slice(10, 12), ts.slice(12, 14)].map(Number) as [
    number, number, number, number, number, number,
  ];
  const instant = new Date(Date.UTC(a, mo - 1, j, h, mi, s));
  const coherent =
    instant.getUTCFullYear() === a && instant.getUTCMonth() === mo - 1 && instant.getUTCDate() === j &&
    instant.getUTCHours() === h && instant.getUTCMinutes() === mi && instant.getUTCSeconds() === s;
  return coherent ? { url, instant } : null;
}

/** Forme comparable d'une adresse : schéma http/https confondu, hôte en minuscules, sans fragment ni barre finale. */
function normaliser(texte: string): string | null {
  const brut = texte.replace(/^(https?):\/+/i, '$1://');
  if (!URL.canParse(brut)) return null;
  const u = new URL(brut);
  u.hash = '';
  const chemin = u.pathname.replace(/\/+$/, '');
  return `${u.host.toLowerCase()}${chemin}${u.search}`;
}

/** Vrai si l'instantané `snapshotUrl` (web.archive.org/web/<ts>/<cible>) porte bien sur `demandee`. */
export function instantaneDe(snapshotUrl: string, demandee: string): boolean {
  const m = snapshotUrl.match(SNAPSHOT);
  if (m === null) return false;
  const cible = normaliser(snapshotUrl.slice(m[0].length));
  const attendue = normaliser(demandee);
  return cible !== null && cible === attendue;
}

export type ResultatWayback =
  | { ok: true; waybackUrl: string; instant: Date; ageHours: number }
  | { ok: false; reason: string };

export interface OptionsWayback {
  fetch: typeof fetch;
  now: () => Date;
  timeoutMs?: number;
}

/** Une soumission ; ne lève jamais d'exception. `ageHours` = ancienneté de l'instantané par rapport à `now()`. */
export async function submitWayback(url: string, opts: OptionsWayback): Promise<ResultatWayback> {
  if (!URL.canParse(url) || new URL(url).protocol !== 'https:') return { ok: false, reason: 'URL non https : non soumise' };
  try {
    const res = await opts.fetch(`https://web.archive.org/save/${url}`, {
      redirect: 'manual',
      headers: { 'user-agent': WAYBACK_USER_AGENT },
      signal: AbortSignal.timeout(opts.timeoutMs ?? WAYBACK_TIMEOUT_MS),
    });
    const loc = res.headers.get('location');
    void res.body?.cancel().catch(() => undefined);
    if (res.status >= 300 && res.status < 400) {
      if (loc === null) return { ok: false, reason: `HTTP ${res.status} sans en-tête Location` };
      const snap = parseSnapshotLocation(loc);
      if (snap === null) return { ok: false, reason: `redirection inattendue (${res.status}) vers un autre emplacement que web.archive.org/web/<horodatage>/` };
      if (!instantaneDe(snap.url, url)) return { ok: false, reason: `l'instantané renvoyé (${snap.url.slice(0, 200)}) ne porte pas sur l'adresse soumise : non enregistré` };
      return { ok: true, waybackUrl: snap.url, instant: snap.instant, ageHours: (opts.now().getTime() - snap.instant.getTime()) / 3_600_000 };
    }
    return { ok: false, reason: `HTTP ${res.status}${res.status === 429 ? ' (plafond quotidien par URL)' : ''}` };
  } catch (e) {
    const nom = e instanceof Error ? e.name : '';
    if (nom === 'TimeoutError' || nom === 'AbortError') return { ok: false, reason: `délai dépassé (${Math.round((opts.timeoutMs ?? WAYBACK_TIMEOUT_MS) / 1000)} s)` };
    return { ok: false, reason: `erreur réseau${nom === '' ? '' : ` (${nom})`}` };
  }
}

// ---------- adoption d'un instantané existant (plan 09-03, PUB-04) ----------
// Lecture seule de web.archive.org : aucune soumission. Un instantané n'est adopté comme copie d'une
// source que si chaque paragraphe de l'extrait archivé du dépôt figure dans son texte (menace T-09-12).

const HORODATAGE = /^[0-9]{14}$/;

function horodatageValide(h: string): boolean {
  return HORODATAGE.test(h) && parseSnapshotLocation(`https://web.archive.org/web/${h}/https://x.invalid/`) !== null;
}

function urlHttps(url: string): boolean {
  return URL.canParse(url) && new URL(url).protocol === 'https:';
}

/** Adresse publique d'un instantané (`web.archive.org/web/<14 chiffres>/<url>`), ou null si l'un des deux est invalide. */
export function urlInstantane(horodatage: string, url: string): string | null {
  return horodatageValide(horodatage) && urlHttps(url) ? `https://web.archive.org/web/${horodatage}/${url}` : null;
}

/** Adresse des octets d'origine de l'instantané (suffixe `id_` : sans la barre d'outils de la Wayback Machine). */
export function urlInstantaneOriginal(horodatage: string, url: string): string | null {
  return horodatageValide(horodatage) && urlHttps(url) ? `https://web.archive.org/web/${horodatage}id_/${url}` : null;
}

/** Pliage de comparaison : normalisation de l'extrait, puis accents, casse et blancs. */
function plier(texte: string): string {
  return normalizeExtract(texte)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface ComparaisonExtrait {
  trouves: number;
  total: number;
  /** 60 premiers caractères du premier paragraphe absent, ou null. */
  premierManquant: string | null;
}

/** Combien de paragraphes non vides de l'extrait (séparés par une ligne vide) figurent dans le texte de l'instantané. */
export function extraitDansInstantane(extrait: string, texteInstantane: string): ComparaisonExtrait {
  const paragraphes = normalizeExtract(extrait)
    .split(/\n[ \t\f]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const cible = plier(texteInstantane);
  let trouves = 0;
  let premierManquant: string | null = null;
  for (const p of paragraphes) {
    if (cible.includes(plier(p))) trouves++;
    else premierManquant ??= [...p].slice(0, 60).join('');
  }
  return { trouves, total: paragraphes.length, premierManquant };
}

export type LectureInstantane = { ok: true; texte: string; urlLue: string } | { ok: false; raison: string };

export interface OptionsLecture {
  fetch?: typeof fetch;
  lookup?: (hote: string) => Promise<Adresse[]>;
}

/**
 * Lit (GET, sans soumission) les octets d'origine d'un instantané et les rend en texte avec la fonction
 * HTML vers texte de la capture. Refuse une réponse dont l'URL finale n'est pas l'instantané demandé
 * (la Wayback Machine redirige vers l'horodatage le plus proche quand le demandé n'existe pas).
 */
export async function lireInstantane(horodatage: string, url: string, opts: OptionsLecture = {}): Promise<LectureInstantane> {
  const demandee = urlInstantaneOriginal(horodatage, url);
  if (demandee === null) return { ok: false, raison: `horodatage (14 chiffres attendus) ou URL https invalide : « ${horodatage} », « ${url.slice(0, 200)} »` };
  let r;
  try {
    r = await fetchSafe(demandee, { ...(opts.fetch === undefined ? {} : { fetch: opts.fetch }), ...(opts.lookup === undefined ? {} : { lookup: opts.lookup }) });
  } catch (e) {
    return { ok: false, raison: e instanceof FetchSafeError ? e.message : `erreur de lecture (${e instanceof Error ? e.name : String(e)})` };
  }
  if (r.finalUrl !== demandee) return { ok: false, raison: `URL finale ${r.finalUrl.slice(0, 200)} différente de l'instantané demandé ${demandee}` };
  if (Buffer.from(r.bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return { ok: false, raison: 'instantané PDF : non pris en charge par l’adoption' };
  const { text } = htmlToText(decodeHtml(r.bytes, r.contentType));
  return { ok: true, texte: normalizeExtract(text), urlLue: demandee };
}
