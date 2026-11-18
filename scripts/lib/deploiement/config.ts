// Fichier local de déploiement depuis le Mac (phase 9.2, D-04, D-07, D-09 ; LOC-02, LOC-04).
//
// ~/.config/rtp/deploiement.env vit hors du dépôt public (D-04) : la cible, l'hôte, l'utilisateur et l'adresse
// du serveur n'entrent jamais dans Git. Il n'est jamais lu par un shell : ce module le lit ligne à ligne, sans
// expansion, sans `export`, et refuse toute clé inconnue. Les messages d'erreur nomment des clés, des numéros de
// ligne et des chemins, jamais une valeur (ni hôte, ni utilisateur, ni URL, ni secret).
//
// Clés (forme attendue, valeurs factices) :
//   RTP_CIBLE=essai                                   obligatoire : essai ou production
//   RTP_HOTE=serveur.exemple.invalid                  obligatoire : nom ou adresse réels (ssh -F /dev/null ignore ~/.ssh/config)
//   RTP_UTILISATEUR=deploy-factice                    obligatoire : utilisateur de déploiement du serveur
//   RTP_URL=https://essai.exemple.invalid/            facultative : https seulement, sans identifiant ; vide = test HTTPS sauté
//   RTP_CLE=~/.config/rtp/rtp-deploy-mac              clé privée dédiée au Mac, avec phrase de passe (D-09), mode 0600, .pub à côté
//   RTP_KNOWN_HOSTS=~/.config/rtp/known_hosts-deploy  empreinte épinglée du serveur, non vide
//   RTP_FUMEE_UTILISATEUR=sonde                       utilisateur basic_auth du test de fumée (D-07) ; vide = sans identifiant
//   RTP_FUMEE_MOT_DE_PASSE=~/.config/rtp/sonde-pass   chemin du fichier du mot de passe (jamais le mot de passe), mode 0600
//   RTP_RSYNC=/opt/homebrew/bin/rsync                 rsync 3 de Homebrew attendu (openrsync refusé pour un envoi réel)
// Lignes vides et commentaires `#` admis ; guillemets doubles autour d'une valeur retirés ; `~/` développé.
// N'importe que des modules node: et des modules relatifs ; aucun processus lancé.
import { readFileSync, statSync, type Stats } from 'node:fs';
import path from 'node:path';
import { Sortie } from './gardes.ts';

export interface ConfigDeploiement {
  cible: 'essai' | 'production';
  hote: string;
  utilisateur: string;
  url: string | null;
  cle: string;
  knownHosts: string;
  fumeeUtilisateur: string | null;
  fumeeMotDePasse: string | null;
  rsync: string;
  fichier: string;
}

export const CLES_CONFIG = [
  'RTP_CIBLE',
  'RTP_HOTE',
  'RTP_UTILISATEUR',
  'RTP_URL',
  'RTP_CLE',
  'RTP_KNOWN_HOSTS',
  'RTP_FUMEE_UTILISATEUR',
  'RTP_FUMEE_MOT_DE_PASSE',
  'RTP_RSYNC',
] as const;

type Cle = (typeof CLES_CONFIG)[number];
const OBLIGATOIRES: readonly Cle[] = ['RTP_CIBLE', 'RTP_HOTE', 'RTP_UTILISATEUR'];

const HOTE = /^[A-Za-z0-9.:-]+$/;
const UTILISATEUR = /^[a-z_][a-z0-9_-]*$/;
const NOM_EXECUTABLE = /^[A-Za-z0-9._-]+$/;
const LIGNE = /^([A-Z_][A-Z0-9_]*)=(.*)$/;

/** Emplacements locaux de la phase, tous sous HOME (les tests posent un HOME temporaire). */
export function cheminsLocaux(home: string): { config: string; recus: string; journal: string; verrou: string } {
  return {
    config: path.join(home, '.config', 'rtp', 'deploiement.env'),
    recus: path.join(home, '.cache', 'rtp', 'ci'),
    journal: path.join(home, '.local', 'state', 'rtp', 'deploiements.jsonl'),
    verrou: path.join(home, '.cache', 'rtp', 'deploiement', '.verrou'),
  };
}

/**
 * Chemins à protéger pendant la build (lecture interdite) et à surveiller (instantané) : fichier de déploiement,
 * clé, clé publique, known_hosts, fichier du mot de passe de la sonde s'il est configuré.
 */
export function cheminsSecrets(cfg: ConfigDeploiement, home: string): string[] {
  const liste = [cfg.fichier, cheminsLocaux(home).config, cfg.cle, `${cfg.cle}.pub`, cfg.knownHosts];
  if (cfg.fumeeMotDePasse !== null) liste.push(cfg.fumeeMotDePasse);
  return [...new Set(liste)];
}

const modeOctal = (st: Stats): string => (st.mode & 0o777).toString(8).padStart(4, '0');

function statOuNull(p: string): Stats | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/**
 * Lit et valide ~/.config/rtp/deploiement.env. Toute anomalie : Sortie code 2 qui liste chaque cause, sans aucune
 * valeur du fichier.
 */
export function lireConfig(home: string): ConfigDeploiement {
  const fichier = cheminsLocaux(home).config;
  let texte: string;
  try {
    texte = readFileSync(fichier, 'utf8');
  } catch {
    throw new Sortie(
      2,
      `fichier de déploiement absent ou illisible : ${fichier} ; le créer en mode 0600 avec au moins les clés obligatoires ${OBLIGATOIRES.join(', ')} (clés connues : ${CLES_CONFIG.join(', ')})`,
    );
  }

  const erreurs: string[] = [];
  const st = statSync(fichier);
  if (!st.isFile()) erreurs.push(`${fichier} n'est pas un fichier régulier`);
  else if ((st.mode & 0o077) !== 0) erreurs.push(`${fichier} : mode ${modeOctal(st)}, attendu sans droit pour le groupe ni les autres (chmod 600)`);

  // Lecture ligne à ligne, sans aucune interprétation de shell.
  const brut = new Map<Cle, string>();
  const connues = new Set<string>(CLES_CONFIG);
  texte.split(/\r?\n/).forEach((ligne, i) => {
    const n = i + 1;
    const t = ligne.trim();
    if (t === '' || t.startsWith('#')) return;
    if (/^export\s/.test(t)) {
      erreurs.push(`ligne ${n} : pas d'export, forme attendue CLE=valeur`);
      return;
    }
    const m = LIGNE.exec(ligne);
    if (m === null) {
      erreurs.push(`ligne ${n} : forme attendue CLE=valeur (clé en majuscules, sans espace autour de =)`);
      return;
    }
    const cle = m[1];
    if (!connues.has(cle)) {
      erreurs.push(`ligne ${n} : clé inconnue : ${cle}`);
      return;
    }
    let valeur = m[2];
    if (valeur.length >= 2 && valeur.startsWith('"') && valeur.endsWith('"')) valeur = valeur.slice(1, -1);
    if (/[$`]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : pas d'expansion de shell ($ ou \`), valeur littérale attendue`);
      return;
    }
    if (/["'\\]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : guillemet ou barre oblique inverse inattendus`);
      return;
    }
    if (/[\u0000-\u001f\u007f]/.test(valeur)) {
      erreurs.push(`ligne ${n} (${cle}) : caractère de contrôle refusé`);
      return;
    }
    if (brut.has(cle as Cle)) {
      erreurs.push(`ligne ${n} : ${cle} est donnée plusieurs fois`);
      return;
    }
    brut.set(cle as Cle, valeur);
  });

  for (const k of OBLIGATOIRES) {
    if (!brut.has(k) || brut.get(k) === '') erreurs.push(`clé obligatoire absente : ${k}`);
  }

  const cibleBrute = brut.get('RTP_CIBLE');
  if (cibleBrute !== undefined && cibleBrute !== '' && cibleBrute !== 'essai' && cibleBrute !== 'production') {
    erreurs.push('RTP_CIBLE : valeur attendue essai ou production');
  }
  const hote = brut.get('RTP_HOTE') ?? '';
  if (hote !== '' && !HOTE.test(hote)) erreurs.push('RTP_HOTE : nom d\'hôte ou adresse attendus (lettres, chiffres, point, tiret, deux-points ; ni espace ni barre oblique)');
  const utilisateur = brut.get('RTP_UTILISATEUR') ?? '';
  if (utilisateur !== '' && !UTILISATEUR.test(utilisateur)) erreurs.push('RTP_UTILISATEUR : nom attendu en minuscules (lettres, chiffres, tiret, souligné)');

  const urlBrute = brut.get('RTP_URL') ?? '';
  let url: string | null = null;
  if (urlBrute !== '') {
    let u: URL | null = null;
    try {
      u = /\s/.test(urlBrute) ? null : new URL(urlBrute);
    } catch {
      u = null;
    }
    if (u === null || u.protocol !== 'https:' || u.username !== '' || u.password !== '' || urlBrute.includes('@') || u.hostname === '') {
      erreurs.push('RTP_URL : adresse https:// attendue, sans identifiant (@) ni espace, ou valeur vide');
    } else {
      url = urlBrute;
    }
  }

  const rtp = path.join(home, '.config', 'rtp');
  const chemin = (k: Cle, defaut: string): string | null => {
    const v = brut.has(k) ? (brut.get(k) as string) : defaut;
    if (v === '') return null;
    const developpe = v.startsWith('~/') ? path.join(home, v.slice(2)) : v;
    if (/\s/.test(developpe)) {
      erreurs.push(`${k} : chemin avec espace refusé`);
      return null;
    }
    if (!path.isAbsolute(developpe)) {
      erreurs.push(`${k} : chemin absolu ou commençant par ~/ attendu`);
      return null;
    }
    return path.normalize(developpe);
  };

  const cleVide = brut.get('RTP_CLE') === '';
  const khVide = brut.get('RTP_KNOWN_HOSTS') === '';
  if (cleVide) erreurs.push('RTP_CLE : chemin vide');
  if (khVide) erreurs.push('RTP_KNOWN_HOSTS : chemin vide');
  const cle = cleVide ? null : chemin('RTP_CLE', path.join(rtp, 'rtp-deploy-mac'));
  const knownHosts = khVide ? null : chemin('RTP_KNOWN_HOSTS', path.join(rtp, 'known_hosts-deploy'));

  const fumeeUtilBrut = brut.has('RTP_FUMEE_UTILISATEUR') ? (brut.get('RTP_FUMEE_UTILISATEUR') as string) : 'sonde';
  const fumeeMdpVide = brut.get('RTP_FUMEE_MOT_DE_PASSE') === '';
  if ((fumeeUtilBrut === '') !== fumeeMdpVide) {
    erreurs.push('RTP_FUMEE_UTILISATEUR et RTP_FUMEE_MOT_DE_PASSE : toutes les deux renseignées ou toutes les deux vides');
  }
  let fumeeUtilisateur: string | null = null;
  if (fumeeUtilBrut !== '') {
    if (UTILISATEUR.test(fumeeUtilBrut)) fumeeUtilisateur = fumeeUtilBrut;
    else erreurs.push('RTP_FUMEE_UTILISATEUR : nom attendu en minuscules (lettres, chiffres, tiret, souligné)');
  }
  const fumeeMotDePasse = chemin('RTP_FUMEE_MOT_DE_PASSE', path.join(rtp, 'sonde-pass'));

  const rsync = brut.get('RTP_RSYNC') ?? 'rsync';
  if (rsync === '') erreurs.push('RTP_RSYNC : valeur vide');
  else if (/\s/.test(rsync)) erreurs.push('RTP_RSYNC : chemin avec espace refusé');
  else if (rsync.includes('/') ? !path.isAbsolute(rsync) : !NOM_EXECUTABLE.test(rsync)) {
    erreurs.push('RTP_RSYNC : nom d\'exécutable ou chemin absolu attendu');
  }

  // Fichiers désignés : existence et modes (aucun contenu lu, sauf la taille de known_hosts).
  const prive = (k: Cle, p: string | null): void => {
    if (p === null) return;
    const s = statOuNull(p);
    if (s === null || !s.isFile()) erreurs.push(`${k} : fichier absent : ${p}`);
    else if ((s.mode & 0o077) !== 0) erreurs.push(`${k} : ${p} : mode ${modeOctal(s)}, attendu sans droit pour le groupe ni les autres (chmod 600)`);
  };
  prive('RTP_CLE', cle);
  if (cle !== null) {
    const pub = statOuNull(`${cle}.pub`);
    if (pub === null || !pub.isFile()) erreurs.push(`RTP_CLE : clé publique absente : ${cle}.pub`);
  }
  prive('RTP_FUMEE_MOT_DE_PASSE', fumeeMotDePasse);
  if (knownHosts !== null) {
    const s = statOuNull(knownHosts);
    if (s === null || !s.isFile()) erreurs.push(`RTP_KNOWN_HOSTS : fichier absent : ${knownHosts}`);
    else if (s.size === 0 || readFileSync(knownHosts, 'utf8').trim() === '') erreurs.push(`RTP_KNOWN_HOSTS : ${knownHosts} est vide (empreinte du serveur épinglée attendue)`);
  }

  if (erreurs.length > 0) {
    throw new Sortie(2, `configuration de déploiement refusée (${fichier}) :\n${erreurs.map((e) => `- ${e}`).join('\n')}`);
  }

  return {
    cible: cibleBrute as 'essai' | 'production',
    hote,
    utilisateur,
    url,
    cle: cle as string,
    knownHosts: knownHosts as string,
    fumeeUtilisateur,
    fumeeMotDePasse,
    rsync,
    fichier,
  };
}
