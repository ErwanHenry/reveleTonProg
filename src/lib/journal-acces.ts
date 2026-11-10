// Politique du journal d'accès de Caddy (HEB-09, 08-01) : seule source des valeurs que rendent les blocs Caddy
// (scripts/render-caddy.ts, production et hôte technique) et que décrit la page Mentions légales. Module pur.

/**
 * Rétention du journal d'accès (CR-01, revue de la phase 7). Caddy 2.11 (timberjack) tourne le fichier courant à
 * l'heure ROTATION_JOURNAL (UTC, minuteur actif même sans trafic) ou dès TAILLE_JOURNAL, et ne garde que les
 * FICHIERS_TOURNES_GARDES fichiers tournés les plus récents (roll_keep compte les horodatages de rotation distincts ;
 * roll_keep_for, à résolution d'un jour, double la règle). Avec une rotation par jour, le plus vieux fichier gardé
 * couvre le jour J-N-1 : une entrée vit moins de N+1 jours. Une rotation de minuit manquée (Caddy arrêté à minuit :
 * au redémarrage, timberjack repart de l'heure de la première écriture) fait couvrir deux jours à un fichier, d'où
 * N+2 jours au plus. Une rotation à la taille ne fait que raccourcir la durée couverte.
 */
export const ROTATION_JOURNAL = '00:00';
export const TAILLE_JOURNAL = '10MiB';
export const FICHIERS_TOURNES_GARDES = 12;
/** Durée maximale promise (Mentions légales) : N+2 jours, une rotation de minuit manquée comprise. */
export const RETENTION_MAX_JOURS = FICHIERS_TOURNES_GARDES + 2;

/** Bits gardés de l'adresse IP dans le journal (filtre ip_mask de Caddy) : /24 en IPv4, /48 en IPv6. */
export const MASQUE_IPV4 = 24;
export const MASQUE_IPV6 = 48;

/**
 * Plafond de la sortie d'erreur du conteneur Caddy (IN-06 de la revue de la phase 8) : le pilote json-file de
 * deploy/compose/docker-compose.override.yml garde FICHIERS_SORTIE_ERREUR fichiers de TAILLE_SORTIE_ERREUR_MIO Mio
 * (max-file, max-size ; tests/ui/journal-acces.test.ts compare ces valeurs au fichier). Ce flux (requêtes en échec,
 * TLS, ACME) garde l'adresse IP complète et n'est borné qu'en taille, jamais en durée.
 */
export const TAILLE_SORTIE_ERREUR_MIO = 10;
export const FICHIERS_SORTIE_ERREUR = 3;

/**
 * Phrase des Mentions légales sur le journal d'accès, affichée quand l'hébergeur est actif. Elle ne parle que du
 * journal d'accès ; la sortie d'erreur du conteneur a sa propre phrase (phraseSortieErreur).
 */
export function phraseJournalAcces(): string {
  return (
    `Le journal d'accès du serveur est gardé ${RETENTION_MAX_JOURS} jours au plus : l'adresse IP y est tronquée ` +
    `(/${MASQUE_IPV4} en IPv4, /${MASQUE_IPV6} en IPv6), les en-têtes de la requête n'y sont pas enregistrés ` +
    `(ni l'identification de votre navigateur, ni la page d'où vous venez), et il ne sert qu'au fonctionnement du serveur.`
  );
}

/**
 * Phrase des Mentions légales sur la sortie d'erreur du conteneur (D-11, IN-06), affichée quand l'hébergeur est actif,
 * juste après celle du journal d'accès. La taille vient des constantes ci-dessus.
 */
export function phraseSortieErreur(): string {
  return (
    `La sortie d'erreur du serveur, qui enregistre les requêtes en échec et le fonctionnement propre du serveur ` +
    `(certificats), garde l'adresse IP complète de ces requêtes : elle est plafonnée en taille ` +
    `(${TAILLE_SORTIE_ERREUR_MIO * FICHIERS_SORTIE_ERREUR} Mio au plus) et non en durée, et ne sert qu'à diagnostiquer les pannes.`
  );
}
