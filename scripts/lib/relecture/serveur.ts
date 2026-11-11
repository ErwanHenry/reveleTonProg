// Page de relecture locale (D-04, PUB-01) : serveur node:http sans dépendance, lié à la boucle locale seulement,
// jamais déployé ni référencé par src/ ou Astro. Une fiche par candidat du thème ; deux formulaires POST
// (« Valider », « Note ») qui appellent le même code que la ligne de commande (marquer, ajouterNote).
//
// Défenses (T-09-23 à T-09-27) : Host exact (anti rebinding DNS, 421), Origin et Sec-Fetch-Site (403), POST en
// application/x-www-form-urlencoded seulement (415), corps plafonné à 8 Kio (413), jeton aléatoire par lancement
// comparé en temps constant (403), identifiants seulement (jamais un chemin) résolus dans le corpus chargé (400).
// Tout texte venu du YAML, des archives, des notes ou des diagnostics passe par echapper() ; aucun élément de
// script dans les pages, et la CSP interdit tout sauf le style en ligne et les formulaires vers ce serveur.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { EditionRefusee } from './editer.ts';
import { marquer, aujourdhuiParis } from './commandes/marquer.ts';
import { RELECTEUR_DEFAUT, RE_SEGMENT, analyserCible, chargerCorpus, nomCible } from './etat.ts';
import type { Alerte, Chargeur, Cible, Contexte, EtatRelu } from './etat.ts';
import { RegistreInvalide, ajouterNote, texteNoteValide } from './registre.ts';
import type { LigneNote } from './registre.ts';
import { ficheCandidat, resume } from './vue.ts';
import type { Fiche, MesureFiche, Resume, SourceFiche } from './vue.ts';

export const CSP_RELECTURE = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
export const CORPS_MAX = 8 * 1024;
const HOTE_LOCAL = '127.0.0.1';

export interface OptionsServeurRelecture {
  racine: string;
  schemasDir: string;
  theme: string;
  /** Jeton anti-CSRF ; par défaut 32 octets aléatoires en hexadécimal, nouveau à chaque lancement. */
  jeton?: string;
  maintenant?: () => Date;
  charger?: Chargeur;
}

/** Codes d'état de la liste fermée affichés après une redirection 303. */
const MESSAGES_ETAT: Record<string, string> = {
  valide: 'Validé : statut relu, relecteur et date enregistrés.',
  note: 'Note enregistrée.',
};

// --- HTML -----------------------------------------------------------------------------------------------------

/** Seule fonction d'échappement : tout texte inséré dans une page passe par elle. */
export function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STYLE = `
:root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.5; }
body { margin: 0 auto; max-width: 90rem; padding: 1rem; color: #1a1a1a; background: #fff; }
h1 { font-size: 1.6rem; } h2 { font-size: 1.3rem; margin-top: 2rem; } h3 { font-size: 1.1rem; }
a { color: #0b4f9c; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: .3rem .5rem; text-align: left; }
section.bloc { border: 2px solid #555; border-radius: .4rem; padding: .5rem 1rem 1rem; margin: 1.5rem 0; }
.grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: 1rem; }
.cadre { border: 1px solid #999; padding: .5rem .75rem; border-radius: .3rem; }
.extrait { white-space: pre-wrap; font-family: ui-monospace, Menlo, monospace; font-size: .9rem; background: #f4f4f4; padding: .5rem; overflow-wrap: anywhere; }
mark { background: #ffe14d; color: #000; }
code { overflow-wrap: anywhere; }
.etat { font-weight: bold; } .etat-relu, .etat-publie { color: #0a6b1f; } .etat-a_revoir { color: #a33a00; } .etat-a_relire { color: #6b4d00; }
.message { border: 3px solid #0a6b1f; padding: .5rem 1rem; } .refus { border: 3px solid #a30000; padding: .5rem 1rem; }
.contradiction { border-left: 6px solid #a30000; padding-left: .75rem; }
.alertes li { margin: .2rem 0; }
form { display: inline-block; margin: .5rem 1rem .5rem 0; vertical-align: top; }
input[type=text] { width: min(40rem, 90vw); font: inherit; padding: .25rem; }
button { font: inherit; padding: .3rem .8rem; }
`;

function page(titre: string, corps: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(titre)}</title>
<style>${STYLE}</style>
</head>
<body>
${corps}
</body>
</html>
`;
}

const LIBELLE_ETAT: Record<EtatRelu, string> = {
  a_relire: 'à relire',
  relu: 'relu',
  a_revoir: 'à revoir (modifié depuis la relecture)',
  publie: 'publié',
};

const etat = (e: EtatRelu): string => `<span class="etat etat-${e}">${echapper(LIBELLE_ETAT[e])}</span>`;

/** Lien externe seulement pour une URL https (le schéma l'impose déjà) ; sinon le texte brut. */
function lien(url: string, texte = url): string {
  if (!/^https:\/\//.test(url)) return echapper(texte);
  return `<a href="${echapper(url)}" rel="noopener noreferrer">${echapper(texte)}</a>`;
}

function listeAlertes(alertes: readonly Alerte[], titre = 'Alertes de la CI'): string {
  if (alertes.length === 0) return `<p>${echapper(titre)} : aucune.</p>`;
  return `<p>${echapper(titre)} :</p><ul class="alertes">${alertes
    .map((a) => `<li><strong>${echapper(a.code)}</strong> (${a.severity === 'error' ? 'erreur' : 'avertissement'}) : ${echapper(a.message)}</li>`)
    .join('')}</ul>`;
}

function listeNotes(notes: readonly LigneNote[]): string {
  if (notes.length === 0) return '';
  return `<p>Notes ouvertes :</p><ul>${notes.map((n) => `<li>${echapper(n.horodatage)} : ${echapper(n.texte)}</li>`).join('')}</ul>`;
}

function formulaires(jeton: string, type: 'mesure' | 'statut' | 'case', cible: string, cibleNote: string, libelle: string): string {
  const j = `<input type="hidden" name="jeton" value="${echapper(jeton)}">`;
  return `<div>
<form method="post" action="/valider">${j}<input type="hidden" name="type" value="${echapper(type)}"><input type="hidden" name="cible" value="${echapper(cible)}"><button type="submit">${echapper(libelle)}</button></form>
<form method="post" action="/note">${j}<input type="hidden" name="cible" value="${echapper(cibleNote)}"><label>Note de correction (500 caractères au plus, sans donnée personnelle) <input type="text" name="texte" maxlength="500" required></label> <button type="submit">Ajouter la note</button></form>
</div>`;
}

function blocSource(s: SourceFiche | null): string {
  if (s === null) return '<p>Source introuvable dans le corpus.</p>';
  const wayback = s.wayback_url !== undefined ? lien(s.wayback_url) : s.wayback_exception !== undefined ? `exception motivée : ${echapper(s.wayback_exception)}` : 'aucune';
  return `<div class="cadre"><h4>Source : ${echapper(s.titre)}</h4>
<ul>
<li>Identifiant : <code>${echapper(s.id)}</code></li>
<li>Adresse : ${lien(s.url)}</li>
<li>Publiée : ${echapper(s.date_publication || 'non indiquée')} ; consultée le ${echapper(s.date_consultation)} ; capturée le ${echapper(s.capture_le)}</li>
<li>Extrait archivé : <code>${echapper(s.extrait_chemin)}</code></li>
<li>Empreinte sha256 : <code>${echapper(s.sha256)}</code></li>
<li>Copie Wayback : ${wayback}</li>
</ul>
${listeAlertes(s.alertes, 'Alertes de la source')}</div>`;
}

function blocMesure(m: MesureFiche, jeton: string): string {
  const slug = m.id.split('/')[1] ?? '';
  const extrait =
    m.extrait === null
      ? '<p><strong>Extrait archivé indisponible</strong> (voir les alertes de la source).</p>'
      : m.extrait.trouve
        ? `<p>Extrait archivé autour de la citation :</p><div class="extrait">${echapper(m.extrait.avant)}<mark>${echapper(m.extrait.cite)}</mark>${echapper(m.extrait.apres)}</div>`
        : `<p><strong>Citation introuvable dans l’extrait</strong> : début du fichier.</p><div class="extrait">${echapper(m.extrait.avant)}</div>`;
  const chiffrage =
    m.chiffrage === undefined
      ? ''
      : `<h4>Chiffrage du candidat</h4><blockquote>${echapper(m.chiffrage.texte)}</blockquote>${m.chiffrage.source_localisation !== undefined ? `<p>Localisation : ${echapper(m.chiffrage.source_localisation)}</p>` : ''}`;
  const red = (titre: string, t: string): string => `<div class="cadre"><h4>${titre}</h4><p>${echapper(t || '(absent)')}</p></div>`;
  return `<section class="bloc" id="mesure-${echapper(slug)}">
<h3>${echapper(m.titre)}</h3>
<p><code>${echapper(m.id)}</code> ; sous-thème ${echapper(m.sous_theme)} ; statut_relecture ${echapper(m.statut_relecture)} ; ${etat(m.etat)}</p>
<div class="grille">
<div>
${red('Résumé', m.redactions.resume)}
${red('Détaillé', m.redactions.detaille)}
${red('Enfant', m.redactions.enfant)}
${red('Aîné', m.redactions.aine)}
</div>
<div>
<div class="cadre"><h4>Texte source cité</h4><blockquote>${echapper(m.texte_source)}</blockquote><p>Localisation : ${echapper(m.source_localisation)}</p>${chiffrage}</div>
${extrait}
${blocSource(m.source)}
</div>
</div>
${listeAlertes(m.alertes)}
${listeNotes(m.notes)}
${formulaires(jeton, 'mesure', m.id, m.cible, 'Valider cette mesure (relu)')}
</section>`;
}

function pageFiche(f: Fiche, jeton: string, bandeau: string): string {
  const s = f.statut;
  const statut =
    s === null
      ? '<section class="bloc" id="statut"><h2>Statut déclaré</h2><p>Aucun statut.</p></section>'
      : `<section class="bloc" id="statut"><h2>Statut déclaré à relire</h2>
<ul>
<li>Code : <strong>${echapper(s.code)}</strong> depuis le ${echapper(s.date)}</li>
<li>Source : ${s.source === null ? 'aucune' : `${echapper(s.source.titre)} (${echapper(s.source.type)}), ${lien(s.source.url)}, consultée le ${echapper(s.source.date_consultation)}`}</li>
<li>statut_relecture ${echapper(s.statut_relecture)}${s.relecteur ? `, par ${echapper(s.relecteur)} le ${echapper(s.date_relecture)}` : ''} ; ${etat(s.etat)}</li>
</ul>
${listeAlertes(s.alertes)}
${listeNotes(s.notes)}
${formulaires(jeton, 'statut', f.id, s.cible, 'Valider ce statut (relu)')}
</section>`;
  const k = f.case;
  const laCase =
    k === null
      ? '<section class="bloc" id="case"><h2>Case de couverture</h2><p>Aucune case pour ce candidat dans ce thème.</p></section>'
      : `<section class="bloc" id="case"><h2>Case de couverture du thème ${echapper(f.theme)}</h2>
<ul>
<li>État : <strong>${echapper(k.etat_case)}</strong></li>
<li>Vérifiée le ${echapper(k.verifie_le)} par ${echapper(k.verifie_par)} ; ${etat(k.etat)}</li>
<li>Sources consultées : ${
          k.sources_consultees.length === 0
            ? 'aucune'
            : `<ul>${k.sources_consultees.map((x) => `<li>${echapper(x.titre || x.id)} (<code>${echapper(x.id)}</code>), ${lien(x.url)}, consultée le ${echapper(x.date_consultation)}</li>`).join('')}</ul>`
        }</li>
</ul>
${k.contradictions.map((m) => `<p class="contradiction"><strong>Contradiction de dates (COUVERTURE_VERIFIEE_AVANT_SOURCE)</strong> : ${echapper(m)}</p>`).join('')}
${listeAlertes(k.alertes)}
${listeNotes(k.notes)}
${formulaires(jeton, 'case', f.id, k.cible, 'Valider la case (verifie_le, verifie_par)')}
</section>`;
  return page(
    `Relecture : ${f.nom} (${f.theme})`,
    `<p><a href="/">Retour à la liste du thème ${echapper(f.theme)}</a></p>
<h1>${echapper(f.nom)}${f.parti ? ` (${echapper(f.parti)})` : ''}</h1>
${bandeau}
${statut}
${laCase}
<h2>Mesures (${f.mesures.length})</h2>
${f.mesures.length === 0 ? '<p>Aucune mesure dans ce thème.</p>' : f.mesures.map((m) => blocMesure(m, jeton)).join('\n')}`,
  );
}

function pageResume(r: Resume): string {
  const lignes = r.candidats
    .map(
      (c) =>
        `<tr><td><a href="/candidat/${echapper(c.id)}">${echapper(c.nom)}</a></td><td>${c.a_relire}</td><td>${c.a_revoir}</td><td>${c.relu}</td><td>${c.notes_ouvertes}</td></tr>`,
    )
    .join('\n');
  return page(
    `Relecture du thème ${r.theme}`,
    `<h1>Relecture du thème ${echapper(r.theme)}</h1>
<p><strong>reste ${r.reste} sur ${r.total}</strong> (à relire ${r.a_relire}, à revoir ${r.a_revoir}, relu ${r.relu}, notes ouvertes ${r.notes_ouvertes})</p>
<table>
<thead><tr><th scope="col">Candidat</th><th scope="col">À relire</th><th scope="col">À revoir</th><th scope="col">Relu</th><th scope="col">Notes ouvertes</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>`,
  );
}

function pageErreur(titre: string, messages: readonly string[]): string {
  return page(titre, `<h1>${echapper(titre)}</h1>${messages.map((m) => `<p>${echapper(m)}</p>`).join('')}<p><a href="/">Retour à la liste</a></p>`);
}

// --- HTTP -----------------------------------------------------------------------------------------------------

function envoyer(res: ServerResponse, statut: number, corps: string, entetes: Record<string, string> = {}): void {
  res.writeHead(statut, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': CSP_RELECTURE,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    // same-origin et non no-referrer : sous no-referrer le navigateur envoie « Origin: null » sur le POST des
    // formulaires de cette page, que controlerEntetes refuse (403). Rien ne part vers les sites des sources.
    'referrer-policy': 'same-origin',
    'content-length': String(Buffer.byteLength(corps)),
    ...entetes,
  });
  res.end(corps);
}

const refuser = (res: ServerResponse, statut: number, message: string, entetes: Record<string, string> = {}): void =>
  envoyer(res, statut, pageErreur(`Refusé (${statut})`, [message]), entetes);

/** Contrôles communs à toute requête : Host exact, Origin, Sec-Fetch-Site. Renvoie vrai si la requête est refusée. */
function controlerEntetes(req: IncomingMessage, res: ServerResponse): boolean {
  const port = req.socket.localPort;
  const hote = req.headers.host;
  if (port === undefined || (hote !== `${HOTE_LOCAL}:${port}` && hote !== `localhost:${port}`)) {
    refuser(res, 421, 'en-tête Host inattendu : ce serveur ne répond qu’à 127.0.0.1 ou localhost sur son port', { connection: 'close' });
    return true;
  }
  const origine = req.headers.origin;
  if (origine !== undefined && origine !== `http://${hote}`) {
    refuser(res, 403, 'origine étrangère refusée');
    return true;
  }
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    refuser(res, 403, 'requête venue d’un autre site refusée');
    return true;
  }
  return false;
}

/** Corps du POST, plafonné à CORPS_MAX octets ; null si dépassé (la réponse 413 est déjà partie). */
function lireCorps(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((ok) => {
    const annonce = Number(req.headers['content-length'] ?? '0');
    const trop = (): void => {
      refuser(res, 413, `corps de requête au-delà de ${CORPS_MAX} octets`, { connection: 'close' });
      req.resume();
      ok(null);
    };
    if (Number.isFinite(annonce) && annonce > CORPS_MAX) {
      trop();
      return;
    }
    const morceaux: Buffer[] = [];
    let taille = 0;
    let fini = false;
    req.on('data', (b: Buffer) => {
      if (fini) return;
      taille += b.length;
      if (taille > CORPS_MAX) {
        fini = true;
        trop();
        return;
      }
      morceaux.push(b);
    });
    req.on('end', () => {
      if (fini) return;
      fini = true;
      ok(Buffer.concat(morceaux).toString('utf8'));
    });
    req.on('error', () => {
      if (fini) return;
      fini = true;
      ok(null);
    });
  });
}

function jetonValide(attendu: Buffer, recu: string | null): boolean {
  if (recu === null) return false;
  const b = Buffer.from(recu, 'utf8');
  return b.length === attendu.length && timingSafeEqual(b, attendu);
}

/** Un seul exemplaire de chaque champ (un champ en double est refusé comme absent). */
function champ(p: URLSearchParams, nom: string): string | null {
  const v = p.getAll(nom);
  return v.length === 1 ? v[0]! : null;
}

export interface GestionnaireRelecture {
  (req: IncomingMessage, res: ServerResponse): void;
}

/** Gestionnaire de requêtes (exporté pour les tests) ; le jeton ne sort jamais d'ici que dans les champs cachés. */
export function creerGestionnaire(options: OptionsServeurRelecture): GestionnaireRelecture {
  const jeton = options.jeton ?? randomBytes(32).toString('hex');
  const attendu = Buffer.from(jeton, 'utf8');
  const maintenant = options.maintenant ?? (() => new Date());
  const { racine, schemasDir, theme } = options;
  const charger = options.charger;

  const corpus = () => chargerCorpus(racine, schemasDir, charger);
  const fiche = (id: string) => ficheCandidat(racine, schemasDir, theme, id, { corpus: corpus() });

  function servirFiche(res: ServerResponse, id: string, statut: number, bandeau: string): void {
    const f = fiche(id);
    if (f === undefined) {
      refuser(res, 404, 'candidat inconnu ou hors du périmètre de ce thème');
      return;
    }
    envoyer(res, statut, pageFiche(f, jeton, bandeau));
  }

  /** Cible du formulaire « Valider » : identifiants seulement, résolus dans la fiche du thème. */
  function cibleValider(type: string | null, brute: string | null): { cible: Cible; candidat: string; ancre: string } | undefined {
    if (brute === null) return undefined;
    if (type === 'mesure') {
      const [cand, slug, ...reste] = brute.split('/');
      if (cand === undefined || slug === undefined || reste.length > 0 || !RE_SEGMENT.test(cand) || !RE_SEGMENT.test(slug)) return undefined;
      const f = fiche(cand);
      if (f === undefined || !f.mesures.some((m) => m.id === brute)) return undefined;
      return { cible: { type: 'mesure', id: brute }, candidat: cand, ancre: `mesure-${slug}` };
    }
    if (type === 'statut' || type === 'case') {
      if (!RE_SEGMENT.test(brute)) return undefined;
      const f = fiche(brute);
      if (f === undefined) return undefined;
      if (type === 'statut') return f.statut === null ? undefined : { cible: { type: 'statut', candidat: brute }, candidat: brute, ancre: 'statut' };
      return f.case === null ? undefined : { cible: { type: 'case', theme, candidat: brute }, candidat: brute, ancre: 'case' };
    }
    return undefined;
  }

  /** Cible d'une note : `mesure:<candidat>/<slug>`, `statut:<candidat>` ou `case:<theme>/<candidat>` du thème servi. */
  function cibleNote(brute: string | null): { nom: string; candidat: string; ancre: string } | undefined {
    if (brute === null) return undefined;
    const c = analyserCible(brute);
    if (c === undefined) return undefined;
    if (c.type === 'mesure') {
      const [cand, slug] = c.id.split('/') as [string, string];
      const f = fiche(cand);
      if (f === undefined || !f.mesures.some((m) => m.id === c.id)) return undefined;
      return { nom: nomCible(c), candidat: cand, ancre: `mesure-${slug}` };
    }
    if (c.type === 'case' && c.theme !== theme) return undefined;
    const f = fiche(c.candidat);
    if (f === undefined) return undefined;
    if (c.type === 'statut') return f.statut === null ? undefined : { nom: nomCible(c), candidat: c.candidat, ancre: 'statut' };
    return f.case === null ? undefined : { nom: nomCible(c), candidat: c.candidat, ancre: 'case' };
  }

  async function poster(req: IncomingMessage, res: ServerResponse, route: '/valider' | '/note'): Promise<void> {
    const type = String(req.headers['content-type'] ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (type !== 'application/x-www-form-urlencoded') {
      refuser(res, 415, 'seul application/x-www-form-urlencoded est accepté');
      return;
    }
    const corps = await lireCorps(req, res);
    if (corps === null) {
      if (!res.headersSent) refuser(res, 400, 'corps de requête illisible');
      return;
    }
    const p = new URLSearchParams(corps);
    if (!jetonValide(attendu, champ(p, 'jeton'))) {
      refuser(res, 403, 'jeton absent ou invalide : recharger la page');
      return;
    }
    if (route === '/valider') {
      const c = cibleValider(champ(p, 'type'), champ(p, 'cible'));
      if (c === undefined) {
        refuser(res, 400, 'cible invalide ou inconnue dans ce thème');
        return;
      }
      const messages: string[] = [];
      const ctx: Contexte = { racine, schemasDir, sortie: () => undefined, erreur: (l) => messages.push(l), maintenant };
      let code: number;
      try {
        const deps = charger === undefined ? { ctx } : { ctx, charger };
        code = marquer(c.cible, { relecteur: RELECTEUR_DEFAUT, date: aujourdhuiParis(maintenant()), malgreNote: false, horsPerimetre: false }, deps);
      } catch (e) {
        if (e instanceof EditionRefusee || e instanceof RegistreInvalide) {
          code = 1;
          messages.push(`refusé : ${e.message}`);
        } else {
          throw e;
        }
      }
      if (code !== 0) {
        servirFiche(res, c.candidat, 409, `<div class="refus" role="alert"><p><strong>Validation refusée, rien n’a été écrit.</strong></p>${messages.map((m) => `<p>${echapper(m)}</p>`).join('')}</div>`);
        return;
      }
      envoyer(res, 303, pageErreur('Validé', [MESSAGES_ETAT.valide!]), { location: `/candidat/${c.candidat}?etat=valide#${c.ancre}` });
      return;
    }
    const c = cibleNote(champ(p, 'cible'));
    if (c === undefined) {
      refuser(res, 400, 'cible invalide ou inconnue dans ce thème');
      return;
    }
    const texte = champ(p, 'texte');
    const probleme = texte === null ? 'note absente' : texteNoteValide(texte);
    if (probleme !== undefined || texte === null) {
      refuser(res, 400, `note refusée : ${probleme ?? 'note absente'}`);
      return;
    }
    try {
      ajouterNote(racine, { horodatage: maintenant().toISOString(), cible: c.nom, texte, etat: 'ouverte' });
    } catch (e) {
      if (e instanceof RegistreInvalide) {
        refuser(res, 409, `note refusée : ${e.message}`);
        return;
      }
      throw e;
    }
    envoyer(res, 303, pageErreur('Note enregistrée', [MESSAGES_ETAT.note!]), { location: `/candidat/${c.candidat}?etat=note#${c.ancre}` });
  }

  function traiter(req: IncomingMessage, res: ServerResponse): void {
    if (controlerEntetes(req, res)) return;
    let url: URL;
    try {
      url = new URL(req.url ?? '/', `http://${HOTE_LOCAL}`);
    } catch {
      refuser(res, 400, 'adresse illisible');
      return;
    }
    const chemin = url.pathname;
    const methode = req.method ?? '';
    if (chemin === '/valider' || chemin === '/note') {
      if (methode !== 'POST') {
        refuser(res, 405, 'méthode non autorisée', { allow: 'POST' });
        return;
      }
      poster(req, res, chemin).catch((e: unknown) => {
        process.stderr.write(`relecture : erreur interne : ${e instanceof Error ? e.message : String(e)}\n`);
        if (!res.headersSent) refuser(res, 500, 'erreur interne (voir le terminal)');
      });
      return;
    }
    const m = /^\/candidat\/([^/]*)$/.exec(chemin);
    if (chemin !== '/' && m === null) {
      refuser(res, 404, 'page inconnue');
      return;
    }
    if (methode !== 'GET') {
      refuser(res, 405, 'méthode non autorisée', { allow: 'GET' });
      return;
    }
    if (m === null) {
      envoyer(res, 200, pageResume(resume(racine, schemasDir, theme, { corpus: corpus() })));
      return;
    }
    let id: string;
    try {
      id = decodeURIComponent(m[1]!);
    } catch {
      id = '';
    }
    if (!RE_SEGMENT.test(id)) {
      refuser(res, 400, 'identifiant de candidat invalide');
      return;
    }
    const code = url.searchParams.get('etat');
    const message = code !== null && Object.hasOwn(MESSAGES_ETAT, code) ? `<p class="message" role="status">${echapper(MESSAGES_ETAT[code]!)}</p>` : '';
    servirFiche(res, id, 200, message);
  }

  return (req, res) => {
    try {
      traiter(req, res);
    } catch (e) {
      process.stderr.write(`relecture : erreur interne : ${e instanceof Error ? e.message : String(e)}\n`);
      if (!res.headersSent) refuser(res, 500, 'erreur interne (voir le terminal)');
    }
  };
}

/** Serveur de relecture ; l'appelant le lie avec listen(port, '127.0.0.1') et vérifie l'adresse obtenue. */
export function creerServeurRelecture(options: OptionsServeurRelecture): Server {
  return createServer(creerGestionnaire(options));
}
