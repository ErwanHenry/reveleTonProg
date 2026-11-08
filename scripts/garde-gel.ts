// Garde de gel des scrutins (HEB-13, D-10). Aucun déploiement ni retour arrière du 17 au 19 avril et du 1er au
// 3 mai 2027 (dates civiles de Paris, veille et lendemain de chaque tour inclus), sauf retrait d'urgence demandé
// explicitement avec une justification écrite. Les fenêtres viennent de TOURS (src/lib/dates-tours.ts) : changer la
// date d'un tour déplace le gel. La date se lit en Europe/Paris quel que soit le fuseau du runner (UTC).
//
// Utilisé par le job « gel » de .github/workflows/ci.yml et par .github/workflows/rollback.yml :
//   node scripts/garde-gel.ts --urgence <true|false|''> --justification <texte> [--date <ISO 8601>]
// Écrit ok=true|false dans le fichier GITHUB_OUTPUT (s'il est défini) et un court résumé en Markdown dans
// GITHUB_STEP_SUMMARY (s'il est défini). Codes de sortie : 0 pour les deux décisions (autorisé ou gelé),
// 1 pour une demande d'urgence sans justification valable, 2 pour une erreur d'usage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TOURS } from '../src/lib/dates-tours.ts';

export interface FenetreGel {
  /** Premier jour gelé (YYYY-MM-DD, Paris), veille du tour. */
  debut: string;
  /** Dernier jour gelé (YYYY-MM-DD, Paris), lendemain du tour. */
  fin: string;
  tour: number;
}

export interface DecisionGel {
  /** Le déploiement ou le retour arrière peut avoir lieu. */
  ok: boolean;
  /** La date de Paris tombe dans une fenêtre de gel. */
  gele: boolean;
  /** Un retrait d'urgence a été demandé. */
  urgence: boolean;
  /** Tour dont la fenêtre contient la date, sinon null. */
  tour: number | null;
  /** Date civile de Paris évaluée (YYYY-MM-DD). */
  date: string;
  /** Explication en français, une ligne. */
  motif: string;
}

/** Longueur minimale de la justification d'un retrait d'urgence, comptée après nettoyage. */
export const JUSTIFICATION_MIN = 20;
/** Longueur maximale de la justification affichée (annotation et résumé). */
export const JUSTIFICATION_MAX = 300;

function decalerJour(date: string, jours: number): string {
  const [a, m, j] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10);
}

/** Fenêtres de gel : veille au lendemain de chaque tour, bornes incluses. */
export const FENETRES_GEL: readonly FenetreGel[] = TOURS.map((t) => ({
  debut: decalerJour(t.date, -1),
  fin: decalerJour(t.date, 1),
  tour: t.numero,
}));

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Date civile de Paris (YYYY-MM-DD) de l'instant, quel que soit le fuseau du processus. */
export function dateParis(instant: Date): string {
  const parts = FORMAT_PARIS.formatToParts(instant);
  const val = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${val('year')}-${val('month')}-${val('day')}`;
}

/**
 * Justification ramenée à une seule ligne : caractères de contrôle et sauts de ligne remplacés par une espace,
 * blancs regroupés, coupée à 300 caractères. Une justification ne peut donc pas commencer une ligne de sortie et
 * y glisser une commande de workflow (« :: » en début de ligne).
 */
export function nettoyerJustification(texte: string): string {
  const uneLigne = texte
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...uneLigne].slice(0, JUSTIFICATION_MAX).join('').trim();
}

/** Décision de la garde pour un instant donné (fonction pure, horloge injectée). */
export function evaluerGel(instant: Date, urgence: boolean, justification: string): DecisionGel {
  const date = dateParis(instant);
  const fenetre = FENETRES_GEL.find((f) => f.debut <= date && date <= f.fin) ?? null;
  const gele = fenetre !== null;
  const tour = fenetre?.tour ?? null;
  const texteGel = fenetre
    ? `gel du tour ${fenetre.tour} (du ${fenetre.debut} au ${fenetre.fin}, heure de Paris)`
    : '';
  if (urgence) {
    const propre = nettoyerJustification(justification);
    if ([...propre].length < JUSTIFICATION_MIN) {
      return {
        ok: false,
        gele,
        urgence,
        tour,
        date,
        motif: `retrait d'urgence demandé sans justification valable (${JUSTIFICATION_MIN} caractères au moins) : refusé`,
      };
    }
    return {
      ok: true,
      gele,
      urgence,
      tour,
      date,
      motif: gele
        ? `retrait d'urgence justifié pendant le ${texteGel} : autorisé`
        : `retrait d'urgence justifié, ${date} hors des fenêtres de gel : autorisé`,
    };
  }
  if (gele) {
    return { ok: false, gele, urgence, tour, date, motif: `${date} tombe dans le ${texteGel} : déploiement refusé` };
  }
  return { ok: true, gele, urgence, tour, date, motif: `${date} hors des fenêtres de gel : autorisé` };
}

const RE_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

/** Instant d'une date ISO 8601 stricte, ou null (format inconnu, date civile qui n'existe pas). */
export function lireDate(texte: string): Date | null {
  const m = RE_DATE_ISO.exec(texte);
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const civile = new Date(Date.UTC(a, mo - 1, j));
  if (civile.getUTCFullYear() !== a || civile.getUTCMonth() !== mo - 1 || civile.getUTCDate() !== j) return null;
  const instant = new Date(texte);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Échappement des données d'une commande de workflow (même règle que @actions/core). */
function echapperAnnotation(texte: string): string {
  return texte.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function usageError(message: string): never {
  process.stderr.write(
    `${message}\nusage : node scripts/garde-gel.ts --urgence <true|false|''> --justification <texte> [--date <ISO 8601>]\n`,
  );
  process.exit(2);
}

function main(): void {
  let values: { urgence?: string; justification?: string; date?: string };
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        urgence: { type: 'string', default: '' },
        justification: { type: 'string', default: '' },
        date: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (e) {
    usageError(`garde-gel : ${e instanceof Error ? e.message : String(e)}`);
  }
  const brut = values.urgence ?? '';
  if (brut !== 'true' && brut !== 'false' && brut !== '') {
    usageError(`garde-gel : --urgence « ${brut.slice(0, 20)} » invalide (true, false ou vide)`);
  }
  let instant = new Date();
  if (values.date !== undefined) {
    const lu = lireDate(values.date);
    if (lu === null) usageError(`garde-gel : --date « ${values.date.slice(0, 40)} » invalide (ISO 8601, par exemple 2027-04-18T12:00:00+02:00)`);
    instant = lu;
  }
  const urgence = brut === 'true';
  const justification = nettoyerJustification(values.justification ?? '');
  const d = evaluerGel(instant, urgence, justification);

  const sortie = process.env.GITHUB_OUTPUT;
  if (sortie) fs.appendFileSync(sortie, `ok=${d.ok}\n`);

  const resume = process.env.GITHUB_STEP_SUMMARY;
  if (resume) {
    const lignes = [
      '### Garde de gel des scrutins',
      '',
      `- Date à Paris : ${d.date}`,
      `- Fenêtres de gel : ${FENETRES_GEL.map((f) => `tour ${f.tour} du ${f.debut} au ${f.fin}`).join(', ')}`,
      `- Décision : ${d.ok ? 'autorisé' : 'refusé'} (${d.motif})`,
    ];
    if (urgence) lignes.push(`- Justification du retrait d'urgence : ${justification || '(vide)'}`);
    fs.appendFileSync(resume, `${lignes.join('\n')}\n\n`);
  }

  if (urgence && !d.ok) {
    process.stdout.write(`::error::Garde de gel : ${echapperAnnotation(d.motif)}\n`);
    process.exit(1);
  }
  if (urgence) {
    process.stdout.write(`::notice::Garde de gel : ${echapperAnnotation(d.motif)}. Justification : ${echapperAnnotation(justification)}\n`);
  } else if (!d.ok) {
    process.stdout.write(`::warning::Garde de gel : ${echapperAnnotation(d.motif)}. Retrait d'urgence possible par workflow_dispatch avec une justification écrite.\n`);
  } else {
    process.stdout.write(`Garde de gel : ${d.motif}\n`);
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
