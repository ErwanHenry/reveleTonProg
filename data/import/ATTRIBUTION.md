# Attribution des données importées

Source : 2027 et moi (https://2027etmoi.fr), jeu de données « Candidatures à l'élection présidentielle 2027 — statuts sourcés » publié sur data.gouv.fr (https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources), données mises à jour le 28/10/2026, Licence Ouverte 2.0.

Ressource stable utilisée par l'importeur : https://www.data.gouv.fr/api/1/datasets/r/06237c53-76bd-4224-9805-418e125f0493 (redirige vers https://2027etmoi.fr/data/candidats.json).

La date « mise à jour » ci-dessus est celle du dernier instantané versionné dans ce dossier (champ `mise_a_jour` de son fichier `.meta.json`). Le pied de page des pages candidat et la page Méthode la lisent dans ce fichier.

## Ce qui est réutilisé

- l'identité des personnes (le découpage prénom, nom, nom de tri est fait à la main dans `correspondances.yaml`) ;
- le statut (`declare`, `primaire`, `pressenti`, `empeche`, `renonce`) et la date de la source qui l'établit ;
- la source du statut (titre, URL, date de publication) ; la date de consultation reprend la date de vérification (`verifie_le`) du jeu amont ;
- l'étiquette de parti, uniquement quand une page du parti ou le site de campagne du candidat la corrobore ;
- le lien vers le site de campagne (`liens.campagne`).

## Ce qui n'est jamais réutilisé

- `bloc` (classement politique attribué par le producteur) ;
- `propositions` ;
- `statut_detail` (phrase rédigée par le producteur) ;
- les autres liens (réseaux sociaux, Wikipédia).

Ces champs ne subsistent que dans l'instantané brut de ce dossier, qui n'est ni publié ni affiché.

## Trace par fiche

Chaque fiche candidat porte `ids_externes.2027etmoi` : l'identifiant du jeu amont de la personne.

## Écart de comptage

La description du jeu sur data.gouv.fr annonce 51 personnes ; le fichier du 28/10/2026 en contient 59. Cet écart est constaté, pas expliqué : le dépôt compte les lignes du fichier, jamais la description.
