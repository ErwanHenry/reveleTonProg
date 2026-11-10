# Note de risques juridiques de reveleTonProg

- Version : 1
- Date : 2026-11-10
- Auteur : l'orchestrateur du projet, un agent d'IA (Claude), à partir de la recherche de la Phase 9 (`.planning/phases/09-contenu-relu-juridique-et-ouverture/09-RESEARCH.md`, section 4)
- Signataire : Erwan Henry, éditeur et directeur de la publication
- Statut : risque accepté le 2026-11-11

Cette note remplace, pour l'ouverture, la relecture des Mentions légales par un juriste (décision D-03). Elle reste dans le dépôt. Elle n'est pas liée depuis le site.

## Périmètre et limites

- Cette note n'est pas un avis juridique. Elle a été écrite par un agent d'IA, pas par un juriste.
- Les textes ont été lus sur Légifrance par un outil de résumé, avec des citations courtes, jamais le texte intégral. La confiance d'ensemble est donc **moyenne**. Chaque citation ci-dessous est donnée « tel que lu le 2026-11-10 ».
- Légifrance refuse les requêtes automatiques : les liens s'ouvrent dans un navigateur.
- Avant de signer, le signataire lit lui-même, dans son navigateur, les textes suivants :
  1. LCEN, article 1-1 (éditeur, hébergeur, droit de réponse) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614
  2. LCEN, article 1-2 (sanctions) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049568616
  3. Décret n° 2007-1527 du 24 octobre 2007 (droit de réponse en ligne) : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000428279
  4. Code électoral, article L49 (propagande la veille et le jour du scrutin) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215
  5. Loi n° 77-808 du 19 juillet 1977, article 11 (sondages) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547
  6. Lignes directrices de la CNIL sur les cookies et autres traceurs (délibération 2020-091) : https://www.cnil.fr/sites/default/files/atoms/files/lignes_directrices_de_la_cnil_sur_les_cookies_et_autres_traceurs.pdf
- Points à regarder en priorité dans ces textes : le mot « domicile » du I 1° de l'article 1-1 et la condition du II (régime retenu) ; le montant et le champ de l'article 1-2 ; l'article 5 du décret (suppression du contenu dans les trois jours) ; la fin de l'interdiction de l'article 11 de la loi de 1977.

## Tableau des risques

Probabilité et gravité sur trois niveaux : faible, moyenne, forte. Les montants sont ceux des textes, tels que lus le 2026-11-10.

| ID | Texte applicable | Ce que fait le site | Probabilité | Gravité | Mesure en place | Risque résiduel | Décision |
|---|---|---|---|---|---|---|---|
| R1 Identification de l'éditeur | LCEN art. 1-1 I et II, art. 1-2 ([art. 1-1](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614), [art. 1-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049568616)). Tel que lu le 2026-11-10 : une personne physique publie « nom, prénoms, domicile et numéro de téléphone » (I 1°) ; l'éditeur non professionnel peut ne publier que l'hébergeur s'il lui a communiqué ces éléments (II). | Le site se déclare édité à titre non professionnel (II). Il nomme l'hébergeur et affiche le nom « Erwan Henry » comme directeur de la publication, sans adresse ni téléphone. La phrase sur la transmission de l'identité n'est affichée qu'une fois l'hébergeur marqué actif. | moyenne : un freelance qui édite un site suivi peut être jugé « professionnel » | forte : un an d'emprisonnement et 75 000 euros d'amende (art. 1-2, tel que lu le 2026-11-10) | Régime II retenu (D-02 révisée). Identité transmise à l'hébergeur le 2026-11-10 (compte client vérifié, message écrit au support), preuve datée gardée par l'éditeur hors du dépôt. Entité Hetzner Online GmbH lue sur une facture, identique à `config/hebergeur.yml`. Aucun revenu, aucun lien avec l'activité de freelance. | La qualification « non professionnel » reste incertaine (A1). Bascule prévue vers une domiciliation (section dédiée). | À accepter par la signature |
| R2 Droit de réponse | LCEN art. 1-1 III et [décret n° 2007-1527](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000428279). Tel que lu le 2026-11-10 : demande dans les trois mois de la mise à disposition du message ; insertion dans les trois jours de la réception, « sous peine d'une amende de 3 750 euros » ; réponse de 200 lignes au plus. Le droit de réponse ne repose plus sur l'ancien IV de l'article 6. | Les Mentions légales citent le III de l'article 1-1, les délais et le décret. Aucune adresse postale n'est publiée : la demande arrive par courriel, à l'adresse de contact. | faible : site neutre et sourcé, peu de personnes nommées hors candidats | moyenne : 3 750 euros d'amende par refus d'insertion | Procédure écrite (RUNBOOK, « Droit de réponse »). Adresse de contact testée de bout en bout le 2026-11-10. Le décret admet, tel que lu le 2026-11-10, tout moyen prouvant l'identité de l'auteur et la réception. | Une demande perdue (redirection en panne, courriel filtré) ferait courir le délai de trois jours sans le savoir. Réponses envoyées depuis la boîte personnelle de l'éditeur (limite connue, ci-dessous). | À accepter par la signature |
| R3 Journaux du serveur et adresses IP | RGPD (base légale supposée : intérêt légitime, article 6, paragraphe 1, f) ; recommandation CNIL de journalisation (délibération 2021-122, non relue). | Journal d'accès : 14 jours au plus, IP tronquée (/24 en IPv4, /48 en IPv6), en-têtes non enregistrés. Sortie d'erreur du conteneur : IP complète des requêtes en échec, plafonnée à 30 Mio au total, sans limite de durée. Les Mentions légales décrivent les deux journaux et les droits dès que l'hébergeur est actif. | faible : aucune finalité commerciale, données réduites | moyenne : sanction CNIL possible en cas de manquement d'information | Valeurs tirées d'une seule source (`src/lib/journal-acces.ts`), liées par test au bloc Caddy et au fichier de composition. Paragraphe RGPD (responsable, finalité, base légale, droits, réclamation CNIL). | La sortie d'erreur n'est pas bornée dans le temps. Un filtre global (`include http.log.error`) toucherait la configuration partagée des autres sites : reporté. Base légale non vérifiée (A2). | À accepter par la signature |
| R4 Stockage local du navigateur | [Lignes directrices CNIL 2020-091](https://www.cnil.fr/sites/default/files/atoms/files/lignes_directrices_de_la_cnil_sur_les_cookies_et_autres_traceurs.pdf). Tel que lu le 2026-11-10 (résumé) : les traceurs de personnalisation de l'interface sont exemptés de consentement quand cette personnalisation est un élément intrinsèque et attendu du service. | Deux clés (`rtp:niveau`, `rtp:ordre`), écrites seulement à l'action du visiteur, sans identifiant, jamais transmises. Aucun cookie, aucun script extérieur. | faible : usage couvert par l'exemption | faible : mise en demeure possible, sans donnée transmise | Mentions légales : les deux clés, leurs valeurs et le lien vers les règles de la CNIL. | Formulation exacte de l'exemption non relue. Toute nouvelle clé ou finalité demande de revoir ce point. | À accepter par la signature |
| R5 Données sur des tiers et opinions politiques | RGPD article 9 (données manifestement rendues publiques par la personne), non relu. | Le site publie les positions de candidats déclarés, tirées de leurs propres publications, avec la source. | faible : données publiées par les intéressés eux-mêmes | moyenne : plainte d'une personne citée | Seuls les candidats déclarés sont relus et publiés à l'ouverture (D-06). Les 22 personnes qui ne se présentent pas ou sont pressenties restent hors de la production (filtre prévu par le plan 09-15, condition de l'ouverture). Sources primaires et date de consultation. | Statut d'une personne qui change sans mise à jour du site. Analyse de l'article 9 lue en résumé seulement. | À accepter par la signature |
| R6 Neutralité, erreur factuelle, référé | Code électoral article L163-2 (référé de 48 heures contre une information inexacte diffusée massivement, dans les trois mois avant le premier jour du mois de l'élection, soit dès le 1er janvier 2027). Lien non relevé par la recherche ; application à la présidentielle contredite par une source secondaire. | Le site résume des programmes avec une règle de neutralité écrite (mots interdits, étiquette revendiquée, chiffrage du candidat seulement). | faible : contenu sourcé, pas de diffusion massive | forte : retrait ordonné en 48 heures en pleine campagne | Source primaire datée et archivée pour chaque mesure, relecture humaine avant publication, signalement d'erreur en un clic, retrait d'urgence en moins d'une heure (RUNBOOK). | Une erreur de résumé reste possible. Champ d'application du référé non vérifié (A3). | À accepter par la signature |
| R7 Sondages et propagande en période électorale | [Loi n° 77-808, art. 11](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547) : tel que lu le 2026-11-10, aucun sondage publié, diffusé ou commenté la veille et le jour de chaque scrutin. [Code électoral L49](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215) : tel que lu le 2026-11-10, interdiction de diffuser un message de propagande électorale à partir de la veille du scrutin à zéro heure, amende de 3 750 euros. | Le site ne publie aucun sondage dans cette version. Il ne fait pas de propagande, mais une modification de contenu ces jours-là pourrait être mal interprétée. | faible : aucun sondage, contenu neutre | moyenne : 3 750 euros (L49), sanction de la Commission des sondages | Gel des déploiements du 17 au 19 avril 2027 et du 1er au 3 mai 2027 (`scripts/garde-gel.ts`), retrait d'urgence possible avec justification écrite. | Interprétation d'un retrait d'urgence pendant le gel. Articles L52-1 et L52-8 non étudiés (A4). | À accepter par la signature |
| R8 Citation d'extraits de programmes et copies archivées | Droit de citation : non étudié par la recherche, aucun article relu. | Le site cite des extraits courts des programmes (champ `texte_source`, 120 mots au plus, erreur en production au delà). Il garde une copie des sources dans un dépôt d'archives et renvoie vers des copies Wayback. | faible : extraits courts, sources nommées, usage d'information | moyenne : demande de retrait d'un ayant droit | Extraits plafonnés, source et date affichées. Exception Rohou (décision 3a) : aucun lien Wayback vers une page qui affiche des données de particuliers. | Risque de droit d'auteur non étudié (A6). | À accepter par la signature |
| R9 Hébergeur et continuité | LCEN art. 1-1 I 4° (identité de l'hébergeur à publier). | Le site est servi par un serveur de Hetzner Online GmbH. Les Mentions légales nomment l'hébergeur avec son adresse, son téléphone et son registre, relevés sur sa page officielle. | faible : hébergeur établi, adresse vérifiée | moyenne : site indisponible ou mention fausse | Entité lue par l'éditeur sur une facture le 2026-11-10, identique à `config/hebergeur.yml`. Contenu reconstruit depuis Git. Sauvegarde quotidienne de la configuration du serveur, test de restauration le 1er de chaque mois (RUNBOOK, « Restauration »). | Serveur unique, partagé avec d'autres services. | À accepter par la signature |

### Limite connue acceptée

- Les réponses aux messages reçus à l'adresse de contact partent de la boîte personnelle de l'éditeur : la redirection IONOS ne réécrit pas l'expéditeur. Une personne qui écrit au contact voit donc cette adresse dans la réponse. Accepté par l'éditeur le 2026-11-10.
- Remède, si le site prend de l'audience : une vraie boîte IONOS pour le domaine du site, ou la fonction « envoyer en tant que » de la messagerie de l'éditeur, configurée avec l'adresse de contact.

## Procédures liées

- `docs/RUNBOOK.md`, section « Droit de réponse » : réception, accusé de réception le jour même, insertion dans les trois jours, suivi sans donnée personnelle du demandeur.
- `docs/RUNBOOK.md`, section « Gel des scrutins et retrait d'urgence » : fenêtres de gel, retrait d'urgence avec justification écrite.
- `docs/RUNBOOK.md`, section « Restauration » : sauvegardes et test mensuel.
- Le droit de réponse repose sur le III de l'article 1-1 de la LCEN (résolution de la recherche de la Phase 9). Il ne repose plus sur l'ancien IV de l'article 6, qui traite désormais des prestataires intermédiaires. Ne pas « corriger » la page vers cet ancien article.

## Bascule vers une domiciliation

Le régime II est retenu pour l'ouverture (D-02 révisée). La bascule est prévue si l'un de ces déclencheurs survient :

1. audience notable ou reprise par la presse ;
2. tout revenu : don, partenariat, publicité ;
3. lien avec l'activité de freelance de l'éditeur.

La bascule consiste à passer au régime I avec une adresse de domiciliation et un numéro dédié, publiés dans les Mentions légales, jamais le domicile personnel.

Limite : la bascule ne vaut que pour l'avenir. Elle ne couvre pas la période passée sous le régime II si cette période était déjà jugée professionnelle.

Ce choix de régime est le premier point à faire relire par un juriste.

## Points non vérifiés

Points de la recherche marqués moyens, faibles ou supposés (journal des hypothèses A1 à A10), une ligne chacun :

- A1 : un freelance qui édite un projet civique bénévole peut ou non être « éditeur non professionnel » ; la décision du tribunal de Caen sur un blog politique est connue de seconde main.
- A2 : base légale des journaux (intérêt légitime) et durée recommandée par la CNIL (délibération 2021-122, six mois à un an) non revérifiées.
- A3 : l'application du référé de l'article L163-2 à l'élection présidentielle est contredite par une source secondaire.
- A4 : les articles L52-1 et L52-8 du Code électoral sont supposés sans objet pour un site éditorial neutre et non commercial.
- A5 : limites de débit de Let's Encrypt et du service d'archivage Wayback non vérifiées (risque de blocage temporaire, pas juridique).
- A6 : droit de citation et copies Wayback d'extraits de programmes non étudiés au regard du droit d'auteur.
- A7 : entité qui héberge le serveur : lue par l'éditeur sur une facture le 2026-11-10 (Hetzner Online GmbH), non vérifiable depuis le dépôt.
- A8 : le décret n° 2007-1527 n'a pas été vu modifié par la loi n° 2024-449 ; ses visas citent encore « le IV de l'article 6 » et l'historique des versions n'a pas été lu.
- A9 : retrait de l'hôte technique à l'ouverture plutôt que son maintien protégé (choix d'exploitation, réversible).
- A10 : le mot « domicile » du I 1° de l'article 1-1 est supposé s'appliquer tel quel, sans dérogation pour une adresse de domiciliation.

Autres points lus en résumé seulement : le montant de l'article 1-2, l'article 5 du décret (contenu supprimé ou corrigé dans les trois jours), la formulation exacte de l'exemption de la CNIL, l'analyse de l'article 9 du RGPD pour les candidats déclarés.

## Suivi après l’ouverture

- Faire relire cette note et les Mentions légales par un juriste après l'ouverture, en commençant par le choix du régime (R1).
- Revoir la note à chaque déclencheur de bascule, à toute nouvelle donnée stockée ou tout nouveau journal, et avant chaque tour (17 avril et 1er mai 2027).
- Consigner chaque révision dans `docs/RETROSPECTIVE.md` (date, version, ce qui change).

## Signature

J'ai lu cette note et j'accepte les risques résiduels décrits ci-dessus.

- Signataire : Erwan Henry
- Date : 2026-11-11
- Mention : risque accepté
- Textes lus par le signataire sur Légifrance, date : 2026-11-11
- Relecture par un juriste : prévue après l'ouverture, pas encore faite

Preuves (dates seulement, les preuves restent hors du dépôt) :

- Identité transmise à l'hébergeur le 2026-11-10, preuve conservée hors dépôt
- Adresse de contact testée de bout en bout le 2026-11-10
