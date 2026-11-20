// Veille des candidatures (phase 10.1) : Trousseau et canaux d'alerte.
//
// Secrets : lus dans le Trousseau macOS par `security find-generic-password -s <service> -w` au moment de servir,
// jamais écrits sur disque, jamais imprimés. Toute erreur qui remonte d'un canal passe par `masquer`, qui retire
// les valeurs secrètes connues avant qu'un message n'atteigne un journal, l'état ou la console.
// Messages : comptes et chemin du rapport seulement, aucun nom de personne (D-06).

export const SERVICES = {
  telegramJeton: 'rtp-veille-telegram-jeton',
  telegramConversation: 'rtp-veille-telegram-conversation',
  healthchecks: 'rtp-veille-healthchecks',
} as const;

export type Executer = (commande: string, args: string[], options?: { cwd?: string; timeoutMs?: number }) => { status: number | null; stdout: string; stderr: string };

/** Valeur d'un secret du Trousseau, ou null s'il n'existe pas. */
export function lireSecret(service: string, executer: Executer): string | null {
  const r = executer('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], { timeoutMs: 10_000 });
  if (r.status !== 0) return null;
  const v = r.stdout.replace(/\r?\n$/, '');
  return v === '' ? null : v;
}

/** Retire de `texte` toute valeur secrète connue (et ses formes encodées en URL). */
export function masquer(texte: string, secrets: (string | null | undefined)[]): string {
  let t = texte;
  for (const s of secrets) {
    if (s === null || s === undefined || s.length < 4) continue;
    for (const forme of new Set([s, encodeURIComponent(s)])) t = t.split(forme).join('[masqué]');
  }
  return t;
}

export const TITRE = 'Veille des candidatures';

export function texteAlerte(comptes: string, rapport: string): string {
  return `${TITRE} : ${comptes}. Rapport : ${rapport}`;
}

/** Notification macOS : le texte passe en argument d'AppleScript (on run argv), jamais interpolé dans le script. */
export function notifierMac(texte: string, executer: Executer, titre = TITRE): boolean {
  const r = executer('/usr/bin/osascript', ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title (item 2 of argv)', '-e', 'end run', texte, titre], { timeoutMs: 10_000 });
  return r.status === 0;
}

export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/** Message Telegram (bot dédié). Renvoie null si envoyé, sinon un motif sans secret. */
export async function envoyerTelegram(jeton: string, conversation: string, texte: string, fetchFn: Fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`https://api.telegram.org/bot${jeton}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: conversation, text: texte, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok ? null : `Telegram a répondu ${r.status}`;
  } catch (e) {
    return masquer(`Telegram injoignable (${e instanceof Error ? e.message : String(e)})`, [jeton, conversation]);
  }
}

/** Ping Healthchecks : succès (sans suffixe) ou panne de la veille (`/fail`). Jamais pour signaler un changement. */
export async function pingHealthchecks(adresse: string, panne: boolean, fetchFn: Fetch, corps = ''): Promise<string | null> {
  if (!URL.canParse(adresse) || new URL(adresse).protocol !== 'https:') return 'adresse Healthchecks invalide (https attendu)';
  try {
    const r = await fetchFn(`${adresse.replace(/\/+$/, '')}${panne ? '/fail' : ''}`, { method: 'POST', body: corps.slice(0, 1000), signal: AbortSignal.timeout(15_000) });
    return r.ok ? null : `Healthchecks a répondu ${r.status}`;
  } catch (e) {
    return masquer(`Healthchecks injoignable (${e instanceof Error ? e.message : String(e)})`, [adresse]);
  }
}
