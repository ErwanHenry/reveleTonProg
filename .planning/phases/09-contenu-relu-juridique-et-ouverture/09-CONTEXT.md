# Phase 9: Contenu relu, juridique et ouverture - Context

**Gathered:** 2026-11-10
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Le site ouvre au public sur `reveletonprog.fr` (et `www`, redirigé) avec le thème santé entièrement relu par Erwan, des Mentions légales finales, un risque juridique accepté par écrit, et un journal d'audit refait sur la build réellement en ligne. Exigences : PUB-01, PUB-02, PUB-03, PUB-04, LEG-01, LEG-02, LEG-03, DETTE-04. Cible : ouverture vers le 2026-12-05.

</domain>

<decisions>
## Implementation Decisions (Erwan, 2026-11-10)

### Contact (LEG-01)
- **D-01:** Adresse publique `contact@reveletonprog.fr`, boîte ou redirection créée par Erwan chez IONOS (les enregistrements MX, SPF, DKIM, DMARC IONOS du domaine sont conservés). `config/site.yml` passe de l'adresse provisoire à celle-ci ; test de bout en bout (envoi depuis l'extérieur, réception, réponse) consigné avant l'ouverture.

### Régime d'éditeur (LEG-01)
- **D-02:** Nom publié : les Mentions légales nomment « Erwan Henry » éditeur et directeur de la publication (déjà le cas), sans adresse postale. Ne pas basculer vers le régime « éditeur non professionnel ». L'identité d'Erwan n'a pas besoin d'être transmise à Hetzner pour ce régime ; vérifier ce que dit le texte en vigueur (LCEN art. 1-1 et 6) et l'écrire exactement.

### Juridique (LEG-02)
- **D-03:** Pas de juriste avant l'ouverture : l'orchestrateur rédige une note de risques (`docs/RISQUES-JURIDIQUES.md` ou équivalent) couvrant au moins : régime et identification de l'éditeur, base légale exacte du droit de réponse en ligne après la loi SREN (article à vérifier sur Légifrance : 6 IV ou 1-1 LCEN), délais (trois mois, trois jours), journaux serveur et IP (RGPD, durée, masquage, journal d'erreurs du conteneur IN-06), `localStorage` (exemption CNIL), périodes électorales (sondages loi 77-808 art. 11, propagande L49 et gel), neutralité et droit de réponse des candidats. Erwan la signe (date et mention « risque accepté ») ; un juriste pourra relire après l'ouverture.

### Relecture (PUB-01, PUB-03)
- **D-04:** Page de relecture locale (jamais déployée, jamais dans le dist public) : servie sur le Mac d'Erwan, elle montre pour chaque mesure du thème santé les quatre rédactions à côté du `texte_source` et de l'extrait archivé ; Erwan valide ou écrit une note de correction. Une commande écrit le statut `relu` avec relecteur et date dans le YAML de la mesure (et la couverture si besoin), sans autre modification ; les corrections de texte restent des modifications YAML manuelles ou proposées, jamais automatiques. Liste « ce qui reste à relire » disponible en terminal.
- **D-05:** Chaque mesure publiée affiche son relecteur et sa date de relecture (PUB-03).
- **D-06:** Un seul thème (santé) pour l'ouverture ; travail et Europe et monde suivent après.

### Publication (PUB-02, PUB-04)
- **D-07:** La production n'affiche que le thème entièrement relu pour tous les candidats de son périmètre (statuts de candidature relus inclus : en production, seuls les statuts `relu`/`publie` comptent, ADR-041). Garde d'équité existante + liste blanche de publication explicite (quels thèmes sont ouverts).
- **D-08:** PUB-04 : relancer Wayback pour les sources Batho (W9) ; exception motivée pour Rohou (données personnelles), acceptée par la règle `ARCHIVE_WAYBACK_ABSENTE`.

### Ouverture (LEG-03, DETTE-04)
- **D-09:** `config/hebergeur.yml` passe à `actif` ; `RTP_DEPLOIEMENT=1` pour la cible production ; bloc Caddy du site public (nom nu et `www`) installé (validate puis reload, avec l'accord d'Erwan pour chaque écriture serveur, comme en Phase 8) ; HSTS allongé après stabilisation ; `RTP_HOTE` du battement passé au domaine public ; hôte technique `essai` retiré à l'ouverture (ou gardé protégé : à trancher dans le plan).
- **D-10:** RUNBOOK : retrait d'urgence d'une mesure en moins d'une heure ; calendrier de gel 2027 (déjà dans le workflow) ; le journal d'audit et ses empreintes sont refaits sur la build déployée.
- **D-11:** Points reportés de la Phase 8 à traiter ici : phrase des Mentions légales sur le journal d'erreurs du conteneur (IN-06) ; dates de couverture contradictoires (8 cas WR-05 de la Phase 7) dans la relecture ; sonde externe (D1) si Erwan choisit un déclencheur externe ; `favicon.ico`.

### Claude's Discretion
- Technologie de la page de relecture (petit serveur Node sans dépendance, comme `e2e/serveur.ts`), découpage en plans, ordre (relecture d'Erwan en parallèle du juridique et de l'infra).

</decisions>

<constraints>
- Le contenu (`src/content/**`) n'est modifié que par l'outil de relecture (statut, relecteur, date) ou par des corrections qu'Erwan valide ; aucun agent ne corrige un texte de mesure de lui-même.
- Aucun secret dans le dépôt public ; écritures serveur par la session principale avec l'accord d'Erwan.
- Node 24 via `fnm exec --using=24` ; pas de nouvelle dépendance npm sans justification.
- Un push qui touche le site demande une approbation de déploiement (cible `essai` jusqu'à l'ouverture).
</constraints>
