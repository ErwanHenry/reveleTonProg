---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 08
subsystem: juridique, actes de l'éditeur
tags: [note-de-risques, signature, lcen, contact, hebergeur]

requires:
  - phase: 09
    provides: docs/RISQUES-JURIDIQUES.md non signée et son test de structure (plan 09-04)
provides:
  - Note de risques juridiques signée (statut « risque accepté le 2026-11-11 »)
  - Dates des deux préalables de l'ouverture : identité transmise à l'hébergeur, contact testé de bout en bout
affects: [09-09, 09-11, 09-12]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/RISQUES-JURIDIQUES.md
    - docs/RETROSPECTIVE.md

key-decisions:
  - "Erwan a signé le 2026-11-11 par la phrase « je signe, textes lus le 11/11/27 » ; l'année « 27 » est une faute de frappe pour 2026, confirmée par Erwan le même jour (« Oui, 2026 »)"
  - "La ligne « Relecture par un juriste » dit « prévue après l'ouverture, pas encore faite » : le critère du plan demande zéro « à compléter » dans la note signée"
  - "Les trois actes d'Erwan ont été recueillis par l'orchestrateur dans la conversation, sans agent d'exécution : rien à automatiser"

requirements-completed: [LEG-02]
---

# Plan 09-08 : actes d'Erwan et signature de la note de risques

## Résultat

Le risque juridique de l'ouverture sans juriste est accepté par écrit, daté et signé dans le dépôt (LEG-02, décision D-03). Les deux préalables humains de l'ouverture ont leur date.

## Tâches

| Tâche | Contenu | Résultat |
|---|---|---|
| 1 | Identité transmise à Hetzner, contact testé de bout en bout | Déclarés par Erwan le 2026-11-10 (`09-08-NOTES.md`) ; entité des factures identique à `config/hebergeur.yml` |
| 2 | Décision : signer, corriger ou attendre un juriste | « je signe, textes lus le 11/11/27 », le 2026-11-11, après une réexplication de la note à sa demande |
| 3 | Inscription de la signature et des dates | `docs/RISQUES-JURIDIQUES.md`, une ligne dans `docs/RETROSPECTIVE.md` |

## Vérification

- `tests/repo/risques-juridiques.test.ts` et `tests/repo/docs.test.ts` : 68 sur 68.
- `Mention : risque accepté` : 1 occurrence. « à compléter » : 0 occurrence dans la note.
- Le commit ne touche que `docs/` : aucun déploiement demandé.
- Le diff ne contient ni adresse postale, ni téléphone, ni adresse électronique.

## Écarts

1. **Critère de forme du plan.** Le plan vérifie `^Date : AAAA-MM-JJ$` ; la note écrit ses champs en liste (`- Date : …`). Vérifié avec `^- Date : …$` : 2 lignes (date de la note, date de signature).
2. **Année de la lecture des textes.** Voir la première décision ci-dessus : confirmée par Erwan.
3. **LEG-01 non cochée ici.** Elle demande aussi l'hébergeur `actif`, qui arrive au plan 09-11.

## Points ouverts

- Relecture par un juriste après l'ouverture, en commençant par R1 (régime d'éditeur).
- Réponses au contact envoyées depuis la boîte personnelle d'Erwan : limite acceptée, à revoir si le site prend de l'audience.
