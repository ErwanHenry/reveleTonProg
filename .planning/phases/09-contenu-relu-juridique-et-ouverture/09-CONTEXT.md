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
- **D-02 (révisée le 2026-11-10 après recherche, décision d'Erwan « 1b pour l'instant ») :** régime de l'éditeur non professionnel (LCEN art. 1-1 II) pour l'ouverture : la page nomme l'hébergeur ; l'identité d'Erwan est transmise à Hetzner avant l'ouverture, preuve datée conservée hors dépôt (action d'Erwan, bloquante pour l'ouverture). Le nom « Erwan Henry » peut rester affiché volontairement (Qui sommes-nous), sans adresse ni téléphone. La recherche a établi que le régime I (nom publié) impose domicile et téléphone : il n'est pas retenu pour l'instant. **Bascule prévue vers une domiciliation (régime I avec adresse de domiciliation et numéro dédié) si** : audience notable ou reprise presse, tout revenu (don, partenariat, publicité), ou lien avec l'activité de freelance d'Erwan. Ces déclencheurs et la limite (la bascule ne vaut que pour l'avenir) vont dans la note de risques. Premier point à faire relire par un juriste.

### Juridique (LEG-02)
- **D-03:** Pas de juriste avant l'ouverture : l'orchestrateur rédige une note de risques (`docs/RISQUES-JURIDIQUES.md` ou équivalent) couvrant au moins : régime et identification de l'éditeur, base légale exacte du droit de réponse en ligne après la loi SREN (article à vérifier sur Légifrance : 6 IV ou 1-1 LCEN), délais (trois mois, trois jours), journaux serveur et IP (RGPD, durée, masquage, journal d'erreurs du conteneur IN-06), `localStorage` (exemption CNIL), périodes électorales (sondages loi 77-808 art. 11, propagande L49 et gel), neutralité et droit de réponse des candidats. Erwan la signe (date et mention « risque accepté ») ; un juriste pourra relire après l'ouverture.

### Relecture (PUB-01, PUB-03)
- **D-04:** Page de relecture locale (jamais déployée, jamais dans le dist public) : servie sur le Mac d'Erwan, elle montre pour chaque mesure du thème santé les quatre rédactions à côté du `texte_source` et de l'extrait archivé ; Erwan valide ou écrit une note de correction. Une commande écrit le statut `relu` avec relecteur et date dans le YAML de la mesure (et la couverture si besoin), sans autre modification ; les corrections de texte restent des modifications YAML manuelles ou proposées, jamais automatiques. Liste « ce qui reste à relire » disponible en terminal.
- **D-05:** Chaque mesure publiée affiche son relecteur et sa date de relecture (PUB-03).
- **D-06:** Un seul thème (santé) pour l'ouverture ; travail et Europe et monde suivent après. Les 22 statuts « ne se présente pas » et « pressenti » ne sont pas relus pour l'ouverture (décision d'Erwan « 2a ») : ces personnes restent absentes de la production ; seuls les 37 statuts déclarés sont relus.

### Publication (PUB-02, PUB-04)
- **D-07:** La production n'affiche que le thème entièrement relu pour tous les candidats de son périmètre (statuts de candidature relus inclus : en production, seuls les statuts `relu`/`publie` comptent, ADR-041). Garde d'équité existante + liste blanche de publication explicite (quels thèmes sont ouverts).
- **D-08 (précisée) :** PUB-04 : les pages Batho ont changé d'adresse (anciennes URL en 404) : corriger le champ `url` des sources concernées et reprendre la copie Wayback existante de la nouvelle adresse, après vérification que l'extrait archivé correspond. Rohou : garder l'exception (décision d'Erwan « 3a »), pas de lien Wayback vers une page qui affiche des données de particuliers ; mécanisme `archive.wayback_exception {motif, decide_par, decide_le}` accepté par la règle, sans montée de version du schéma si possible.

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

<research_resolutions>
- Droit de réponse : base art. 1-1 III LCEN (trois mois, trois jours), la page actuelle est juste ; ne pas « corriger » vers 6 IV.
- `pilote.relecture_ouverte` doit passer à `true` (premier commit de la phase, deux tests à mettre à jour).
- L'outil de relecture n'écrit que trois champs par insertion aux positions des nœuds YAML, jamais par resérialisation du fichier ; il vérifie que seules ces clés ont changé.
- Transition en deux temps : `relu` (par Erwan, mesure par mesure) puis `publie` (thème entier, quand tout le périmètre est relu).
- Retrait d'urgence : la commande met aussi à jour la case de couverture (sinon `EQUITE_COUVERTURE_INCOHERENTE`), ou repasse le thème en brouillon.
- Date incomplète de Laurent Wauquiez : sans objet pour l'ouverture (statut non relu, décision 2a).
- Les 3 contradictions de dates WR-05 du thème santé (clara-egger, benoit-mathieu, manolo-mlekuz) sont présentées à Erwan dans la relecture.
- Sonde externe (D1) : Erwan a réglé la période et la grâce à 1 jour ; pas de déclencheur externe pour l'instant.
- Liste blanche : `config/publication.yml` (`themes_ouverts`), règle et codes check-dist dédiés.
</research_resolutions>
