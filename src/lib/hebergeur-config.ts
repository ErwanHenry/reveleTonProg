import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml';
import { estDeploiement } from './deploiement.ts';

// Identité de l'hébergeur (config/hebergeur.yml, racine du PROJET). Même discipline de parsing que
// site-config : schéma core, clés uniques, aucun alias, clés inconnues refusées.

export interface HebergeurConfig {
  statut: 'prevu' | 'actif';
  nom: string;
  adresse: string;
  pays: string;
  telephone: string;
  registre: string;
  source: { url: string; consulte_le: string };
}

const FICHIER = 'config/hebergeur.yml';
const CHAMPS = ['nom', 'adresse', 'pays', 'telephone', 'registre'] as const;
const CLES = ['statut', ...CHAMPS, 'source'] as const;
const CLES_SOURCE = ['url', 'consulte_le'] as const;

const memo = new Map<string, HebergeurConfig>();

function erreur(detail: string): Error {
  return new Error(`${FICHIER} : ${detail}`);
}

function carte(noeud: unknown, attendues: readonly string[], ou: string): Record<string, unknown> {
  if (!isMap(noeud)) throw erreur(`${ou} doit être un objet`);
  const brut: Record<string, unknown> = {};
  for (const paire of noeud.items) {
    const cle = isScalar(paire.key) ? String(paire.key.value) : String(paire.key);
    if (!attendues.includes(cle)) throw erreur(`clé inconnue « ${cle.slice(0, 40)} » dans ${ou} (attendu : ${attendues.join(', ')})`);
    brut[cle] = isScalar(paire.value) ? paire.value.value : paire.value;
  }
  return brut;
}

function dateReelle(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

/** Lit et valide `config/hebergeur.yml` ; lève une Error qui nomme le fichier si quoi que ce soit cloche. */
export function loadHebergeurConfig(projectRoot: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): HebergeurConfig {
  const racine = path.resolve(projectRoot);
  // Lue d'abord : une valeur invalide de RTP_DEPLOIEMENT échoue même quand la garde ne mord pas (IN-06).
  const deploiement = estDeploiement(env);
  const fichier = path.join(racine, 'config', 'hebergeur.yml');
  if (!existsSync(fichier)) throw erreur(`fichier introuvable (${fichier}) ; il porte l'identité de l'hébergeur`);

  const connue = memo.get(racine);
  let cfg = connue;
  if (cfg === undefined) {
    const doc = parseDocument(readFileSync(fichier, 'utf8'), { schema: 'core', uniqueKeys: true, merge: false });
    if (doc.errors.length > 0) throw erreur(`YAML invalide (${(doc.errors[0]?.message ?? '').split('\n')[0]})`);
    let alias = false;
    visit(doc, {
      Alias: () => {
        alias = true;
      },
    });
    if (alias || isAlias(doc.contents)) throw erreur('les alias YAML ne sont pas acceptés');

    const brut = carte(doc.contents, CLES, 'la racine');
    const { statut } = brut;
    if (statut !== 'prevu' && statut !== 'actif') throw erreur('« statut » doit valoir prevu ou actif');
    const textes: Record<string, string> = {};
    for (const c of CHAMPS) {
      const v = brut[c];
      if (typeof v !== 'string' || v.trim() === '') throw erreur(`« ${c} » est obligatoire (texte non vide)`);
      textes[c] = v.trim();
    }
    const src = carte(brut.source, CLES_SOURCE, '« source »');
    const url = src.url;
    if (typeof url !== 'string' || !URL.canParse(url) || new URL(url).protocol !== 'https:') {
      throw erreur('« source.url » doit être une URL https:');
    }
    const consulte = src.consulte_le;
    if (typeof consulte !== 'string' || !dateReelle(consulte)) throw erreur('« source.consulte_le » doit être une date réelle AAAA-MM-JJ');

    cfg = {
      statut,
      nom: textes.nom as string,
      adresse: textes.adresse as string,
      pays: textes.pays as string,
      telephone: textes.telephone as string,
      registre: textes.registre as string,
      source: { url, consulte_le: consulte },
    };
  }
  // Garde de déploiement : le job du lot 3 positionne RTP_DEPLOIEMENT=1 ; un hébergeur « prévu »
  // ne doit alors jamais partir en ligne. Évaluée à chaque appel (mémo seulement du contenu).
  if (cfg.statut === 'prevu' && deploiement) {
    throw erreur("hébergeur prévu refusé quand RTP_DEPLOIEMENT=1 : passer statut à actif après la formalité d'identification auprès de l'hébergeur");
  }
  memo.set(racine, cfg);
  return cfg;
}
