// Soumission à l'Internet Archive (Save Page Now anonyme). Module sans E/S propre : `fetch` et
// l'horloge sont injectés. Un échec est un avertissement, jamais une erreur bloquante.

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
      return { ok: true, waybackUrl: snap.url, instant: snap.instant, ageHours: (opts.now().getTime() - snap.instant.getTime()) / 3_600_000 };
    }
    return { ok: false, reason: `HTTP ${res.status}${res.status === 429 ? ' (plafond quotidien par URL)' : ''}` };
  } catch (e) {
    const nom = e instanceof Error ? e.name : '';
    if (nom === 'TimeoutError' || nom === 'AbortError') return { ok: false, reason: `délai dépassé (${Math.round((opts.timeoutMs ?? WAYBACK_TIMEOUT_MS) / 1000)} s)` };
    return { ok: false, reason: `erreur réseau${nom === '' ? '' : ` (${nom})`}` };
  }
}
