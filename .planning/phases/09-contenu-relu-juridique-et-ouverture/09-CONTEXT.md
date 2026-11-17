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

<revision date="2026-11-17">
## Relecture par un agent (décision d'Erwan, 2026-11-17)

Erwan, après une première validation à la main (statut de François Asselineau), a écrit : « Je ne vais pas valider les 120 à la main », puis, à la question de l'orchestrateur sur la façon de procéder : « Ne pas relire ou alors tu fais relire par un agent ».

Conséquences retenues par l'orchestrateur, à confirmer par Erwan avant toute écriture dans le contenu :
- D-04 et PUB-01 changent de sens : la relecture du thème santé est faite par un agent d'IA distinct de celui qui a rédigé, à partir de la source archivée, avec un verdict motivé par cible (conforme, doute, erreur).
- La mention publique reste vraie : une mesure relue par un agent ne porte jamais « Relue par Erwan Henry ». Le champ `relecteur` et la ligne affichée (PUB-03, D-05) nomment l'agent ; la page Méthode, qui dit aujourd'hui « relues par l'éditeur avant leur publication », est corrigée dans le même sens.
- La note de risques signée le 2026-11-11 s'appuie sur une « relecture humaine avant publication » (R6) : elle doit être amendée et acceptée de nouveau par Erwan.
- Les cas classés « doute » ou « erreur » par l'agent sont soumis à Erwan : aucune correction de texte sans sa validation (règle inchangée).
- « Ne pas relire » du tout n'est pas retenu : la publication exige le statut `relu` (garde d'équité, liste blanche), et publier sans aucune relecture retirerait la seule vérification entre un texte rédigé par un modèle et le public.
- Mention publique (question de l'orchestrateur du 2026-11-17 : « Quelle mention sous chaque mesure publiée ? », proposition « Relue par un agent d'IA (Claude) le … ») ; réponse d'Erwan : « Agent d'IA, nommé ». Valeur retenue pour le champ `relecteur` des cibles relues par un agent : `Claude (agent d'IA)`, ce qui affiche « Relue par Claude (agent d'IA) le <date>. ». La validation faite par Erwan lui-même (statut de François Asselineau, 2026-11-17) garde son nom.
</revision>

<revision date="2026-11-17" suite="résultats de la relecture par agent">
## Corrections et statuts : décisions d'Erwan du 2026-11-17

Résultat de la relecture par trois agents (rapports dans `relecture-agent/`) : mesures 12 conformes, 29 doutes, 6 erreurs ; statuts 17 conformes, 20 doutes ; cases 29 conformes, 5 doutes, 3 erreurs de date.

Questions posées par l'orchestrateur, réponses d'Erwan (choix cochés) :
- « Qui applique et valide ces corrections de texte ? » : « Agent corrige, autre agent revérifie ». Un agent applique les corrections proposées, un second agent indépendant relit chaque mesure corrigée contre la source ; Erwan ne voit que les désaccords entre les deux et la règle « parti ou candidat ». **Cette décision lève, pour ces corrections, la règle « aucun agent ne modifie le texte d'une mesure de lui-même ».** Restent interdits : modifier `texte_source` (citation mot pour mot), `archives/**`, et toute correction non rattachée à un constat de relecture.
- « Que fait le site des 20 statuts douteux ? » : « Suivre le jeu, le dire, signaler les doutes ». Le site affiche le statut du jeu de données public en le disant, au lieu d'affirmer en son nom « déclarée depuis le … » ; l'orchestrateur vérifie les cinq sources que l'agent n'a pas pu lire ; les cas sans déclaration formelle sont signalés au responsable du jeu ; les 37 candidats restent affichés.

Règle « parti ou candidat » : la règle existante de `docs/COUVERTURE-THEMES.md` (un document du parti vaut pour le parti, pas pour la parole du candidat) s'applique aux rédactions. Formulation par défaut retenue par l'orchestrateur, à montrer à Erwan : le sujet de la phrase est le parti (« Son parti, <nom>, propose … »), jamais le candidat, quand le document est celui du parti et ne nomme pas le candidat.

Encore à faire accepter par Erwan : la phrase de la Méthode sur la relecture, la nouvelle formulation publique d'un statut, et l'amendement de la note de risques (R5, R6).
</revision>

<revision date="2026-11-17" suite="cinq points éditoriaux">
## Cinq points éditoriaux après la seconde relecture : décision d'Erwan

L'orchestrateur a soumis cinq recommandations ; réponse d'Erwan le 2026-11-17 : « Suis ton avis ». Retenu :

1. **Deux mesures d'Erwan Rohou sans lien établi avec le mouvement cité** : l'orchestrateur cherche une page primaire qui établit le lien et l'archive ; à défaut, les deux mesures sortent et la case de couverture passe à « rien de précisé ». Rappel : la page du programme de ce mouvement n'est jamais soumise à Wayback (données de particuliers, décision 3a).
2. **Chiffrages des candidats absents de la citation** (trois mesures) : publication sans chiffre à l'ouverture ; un champ dédié au chiffrage est une amélioration à planifier après l'ouverture.
3. **Document d'un parti publié sur le site de campagne du candidat** (deux mesures de Jean-Luc Mélenchon) : même règle que pour les autres candidats, le sujet est le parti (« Son parti, La France insoumise, propose … » ; au niveau enfant « Son parti … » sans le nom).
4. **Revendications sur l'emploi où l'hôpital est un exemple** (Nathalie Arthaud, Selma Labib) : elles restent dans le thème santé, la portée étant dite dans les quatre niveaux.
5. **Dates de publication de sources** : les deux dates vérifiables dans l'archive sont corrigées ; la page de parti non datée est citée comme non datée (le champ `date_publication`, obligatoire au schéma et jamais affiché au public, garde une valeur par défaut expliquée par un commentaire ; le titre de la source, lui affiché, dit « page non datée »).

Règle du niveau enfant (constat de CI du même jour) : un parti n'y est pas nommé (« Son parti veut … »), faute de quoi la règle `PILOTE_PARTI_NON_MARQUE` exige une définition de glossaire par parti, que le second relecteur déconseille pour la neutralité.
</revision>

