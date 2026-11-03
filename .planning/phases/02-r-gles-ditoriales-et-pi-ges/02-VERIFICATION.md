---
phase: 02-r-gles-ditoriales-et-pi-ges
verified: 2026-11-03T18:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Ouvrir une PR de test qui retire la ligne `source:` de la mesure fictive et laisser tourner le workflow `.github/workflows/ci.yml`"
    expected: "Le job échoue et GitHub affiche une annotation `SOURCE_ABSENTE` sur le fichier et la ligne de la mesure. Dans la même PR, retirer un id d'`ids.lock` fait échouer l'étape « ids.lock en ajout seul »."
    why_human: "Le format `::error file=,line=,col=,title=` est vérifié ici en local, mais l'affichage de l'annotation et l'étape `git merge-base` / `git show` ne s'exécutent que sur GitHub Actions (le dépôt local n'a pas de CI exécutable)."
---

# Phase 2 : Règles éditoriales et pièges, rapport de vérification

**Objectif :** La CI refuse toute donnée qui viole les règles éditoriales du §5 ou un piège applicable du §12, avec fichier, ligne et code. Livrable du Lot 1 : « la CI refuse une mesure sans source ».
**Vérifié le :** 2026-11-03
**Statut :** human_needed (tous les critères vérifiés par exécution ; une confirmation sur une vraie PR GitHub reste à faire)
**Re-vérification :** Non, vérification initiale (code après correctifs de 02-REVIEW-FIX.md)

Remarque de mode : le ROADMAP marque la phase `mode: mvp`, mais son objectif n'est pas une User Story (`user-story.validate` renvoie `false`). La vérification a donc suivi la méthode goal-backward standard sur les 5 critères du ROADMAP, sans tableau « User Flow Coverage ». À corriger dans le ROADMAP (retirer `mode: mvp` ou réécrire l'objectif).

## Réalisation de l'objectif

J'ai exécuté moi-même le validateur (`scripts/validate.ts`, CLI réelle, `--format github`) sur chaque overlay de `tests/fixtures/pieges/` et sur 22 mutations de mon cru du corpus `corpus-valide`. Les résumés de SUMMARY.md n'ont pas été utilisés comme preuve.

### Vérités observables

| # | Vérité (critère ROADMAP) | Statut | Preuve |
|---|---|---|---|
| 1 | Mesure sans source / source inconnue / presse / archive invalide fait échouer la CI, annotation avec fichier, ligne, code | VERIFIED | Overlay `SOURCE_ABSENTE` : exit 1, `encadrement-loyers.yaml:7:1 SOURCE_ABSENTE` + `::error file=…,line=7,col=1,title=SOURCE_ABSENTE::…`. Mutations : `source: nulle-part` donne `SOURCE_INCONNUE` (l.8) ; `type: presse` donne `SOURCE_NON_PRIMAIRE` (l.3) ; archive supprimée donne `ARCHIVE_ABSENTE` (l.12) ; sha256 faux donne `ARCHIVE_SHA256_DIVERGENT` (l.13) ; `wayback_url` retiré donne `ARCHIVE_WAYBACK_ABSENTE`. Tous exit 1. |
| 2 | Rédactions fautives rejetées (mot interdit, longueur, chiffre, citation, `texte_source`, phrase enfant > 15 mots) ; verbe connoté et Kandel-Moles = avertissement seulement | VERIFIED | `MOT_INTERDIT` (« enfin », « populiste »), y compris avec caractère invisible inséré (`CARACTERE_SUSPECT` + `MOT_INTERDIT`) ; `CHIFFRE_HORS_SOURCE` l.14 (30000 absent) ; `LONGUEUR_HORS_BORNES` (résumé > 25) ; `CITATION_HORS_SOURCE` l.12 ; `TEXTE_SOURCE_HORS_ARCHIVE` l.7 ; `PHRASE_ENFANT_LONGUE` en `publie`. Exemption des citations : `MOT_INTERDIT--dans-citation-ok` exit 0. `prétend` donne `VERBE_CONNOTE` avec exit 0 (avertissement). `LISIBILITE_ENFANT_FAIBLE` catalogué en avertissement. |
| 3 | Erreurs de corpus et de thème bloquées (ids.lock, références, équité, `bloc`/`extdroite`/`propositions`) | VERIFIED | Candidat supprimé : `ID_VERROUILLE_DISPARU` + 2 `REFERENCE_CASSEE`. Ligne retirée d'`ids.lock` : `ID_NON_VERROUILLE`. `theme: inexistant` : `REFERENCE_CASSEE`. `bloc`, `extdroite`, `propositions` : `CHAMP_NON_IMPORTABLE` (l'ajout d'un champ inconnu déclenche aussi `SCHEMA_UNEVALUATEDPROPERTIES`). `EQUITE_CANDIDAT_MANQUANT` : erreur exit 1 en production, avertissement exit 0 en preview. `ids --check --base` avec une base contenant un id absent du lock courant : `ID_VERROUILLE_DISPARU`, exit 1. |
| 4 | Sondages pièges rejetés (notice, somme 95-105 %, tour 2 en tour 1, fenêtres 17-18 avril / 1-2 mai, heure de Paris) | VERIFIED | Overlays `SONDAGE_NOTICE_ABSENTE`, `SONDAGE_SOMME_HORS_BORNES` (112,0 %), `SONDAGE_TOUR2_EN_TOUR1`, `SONDAGE_FENETRE_BLOCAGE` : tous exit 1 avec le bon code et la bonne ligne. Bornes de fenêtre testées : 2027-04-17T23:00+02 bloqué ; 2027-05-02T19:59+02 bloqué ; 2027-04-18T20:01+02 accepté (exit 0) ; 2027-04-16T22:30Z (= 17 avril 00:30 Paris) bloqué. |
| 5 | Chaque piège §12 est une fixture avec son code attendu ; `npm test` échoue si un piège passe | VERIFIED | 7 pièges §12 = 7 dossiers canoniques (`SOURCE_ABSENTE`, `MOT_INTERDIT`, `SONDAGE_NOTICE_ABSENTE`, `SONDAGE_SOMME_HORS_BORNES`, `SONDAGE_TOUR2_EN_TOUR1`, `CHIFFRE_HORS_SOURCE`, `SONDAGE_FENETRE_BLOCAGE`) + 3 variantes. `tests/pieges/couverture.test.ts` verrouille la liste et vérifie que chaque dossier attend son code en erreur ; `pieges.test.ts` rejoue les overlays et compare exactement. `npm test` : 994 pass, 0 fail (relancé par moi). |

**Score :** 5/5

### Artefacts requis

| Artefact | Attendu | Statut | Détails |
|---|---|---|---|
| `src/lib/content-core/rules/*.ts` (archives, champs, citations, corpus, equite, redaction, references, sondages, config, index, types) | Moteur de règles et config exportable | VERIFIED | Substantiels, appelés par `loadAll` après Ajv (comportement observé par CLI). |
| `src/lib/content-core/rules/text/*.ts` | Normalisation, mots, nombres, phrases, syllabes, verbatim | VERIFIED | Couverts par `tests/text/*` (994 tests au total). |
| `src/lib/content-core/ids-lock.ts`, `scripts/ids.ts`, `ids.lock` | Verrou en ajout seul | VERIFIED | `--check` et `--check --base` exécutés. |
| `scripts/validate.ts` (`--mode`, `--format github`) | Annotations fichier/ligne/code | VERIFIED | Sortie `::error file=,line=,col=,title=` constatée. |
| `.github/workflows/ci.yml` | Validate en production + étape ids.lock | VERIFIED (lecture) | Étapes présentes, échec fermé sur base absente ; exécution réelle = point humain. |
| `tests/fixtures/pieges/<CODE>/attendu.json` + `tests/helpers/overlay.ts` | 7 pièges + harnais | VERIFIED | 10 dossiers rejoués. |
| `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md` | Codes, modes, ADR A1-A12 | VERIFIED | Existent ; `HYPOTHESES` A1-A12 contrôlées par `couverture.test.ts`. |

### Liens clés

| De | Vers | Via | Statut |
|---|---|---|---|
| `loadAll` | règles (3 niveaux) | appel après Ajv ; `REGLE_ECHEC` si une règle lève | WIRED (effets observés en CLI) |
| `validate.ts --mode` | sévérité équité / `TEXTE_SOURCE_TROP_LONG` / phrase enfant | `selon_mode`, `selon_statut` | WIRED (preview exit 0, production exit 1) |
| `config.ts` | `CATALOGUE` | méta-test : tout code émis est catalogué, tout code catalogué est exercé | WIRED |
| CI | `ids --check --base` | `git merge-base` puis `git show` | WIRED (lecture du workflow) |

### Spot-checks comportementaux

| Comportement | Commande | Résultat | Statut |
|---|---|---|---|
| Corpus valide, production et preview | `node scripts/validate.ts --mode production` / `preview` | 0 erreur, 0 avertissement | PASS |
| Corpus réel `.` | `RTP_CONTENT_ROOT=. … --mode production` | 0 fichier, 0 erreur (import en Phase 3) | PASS |
| Suite de tests | `npm test` (Node 24.22.2) | 994 pass / 0 fail | PASS |
| Types | `npm run check` | 0 erreur | PASS |
| 10 overlays de pièges | CLI avec `--format github` | codes et lignes conformes aux `attendu.json` | PASS |
| 22 mutations ad hoc | CLI | codes attendus, exit 1 sauf avertissement/accepté (exit 0) | PASS |

### Couverture des exigences

Les 12 identifiants sont déclarés dans les `requirements:` des 7 plans et présents dans REQUIREMENTS.md. Aucun identifiant orphelin (REQUIREMENTS.md n'attribue à la Phase 2 que REGLE-01 à REGLE-12).

| Exigence | Plans | Statut | Preuve |
|---|---|---|---|
| REGLE-01 | 02-01, 02-02, 02-04 | SATISFIED | SOURCE_ABSENTE/INCONNUE/NON_PRIMAIRE, ARCHIVE_ABSENTE/SHA256_DIVERGENT/WAYBACK_ABSENTE exécutés |
| REGLE-02 | 02-03 | SATISFIED | MOT_INTERDIT, exemption des citations, VERBE_CONNOTE en avertissement, CARACTERE_SUSPECT |
| REGLE-03 | 02-03 | SATISFIED | LONGUEUR_HORS_BORNES exécuté |
| REGLE-04 | 02-06 | SATISFIED | CHIFFRE_HORS_SOURCE, CITATION_HORS_SOURCE exécutés |
| REGLE-05 | 02-06 | SATISFIED | TEXTE_SOURCE_HORS_ARCHIVE exécuté |
| REGLE-06 | 02-03 | SATISFIED | PHRASE_ENFANT_LONGUE (erreur en publie) ; LISIBILITE_ENFANT_FAIBLE en avertissement |
| REGLE-07 | 02-01, 02-04, 02-06 | SATISFIED | ids.lock, REFERENCE_CASSEE, ID_CHEMIN_INCOHERENT, `--base` |
| REGLE-08 | 02-04, 02-06 | SATISFIED | EQUITE_CANDIDAT_MANQUANT erreur/avertissement selon le mode |
| REGLE-09 | 02-05 | SATISFIED | 4 codes sondage, bornes de fenêtre au fuseau de Paris |
| REGLE-10 | 02-02, 02-05, 02-06 | SATISFIED | 7 fixtures + méta-test de couverture |
| REGLE-11 | 02-02, 02-05, 02-06 | SATISFIED (rendu GitHub : point humain) | format `::error file=,line=,col=,title=` constaté |
| REGLE-12 | 02-04 | SATISFIED | CHAMP_NON_IMPORTABLE pour bloc, extdroite, propositions |

REQUIREMENTS.md mis à jour : REGLE-01 à REGLE-12 cochées et marquées `Complete` dans la table de traçabilité.

### Anti-patterns

Aucun `TBD`, `FIXME` ou `XXX` dans `src/lib/content-core`, `scripts`, `tests/helpers`, `tests/pieges`, `tests/rules`, `.github`, `docs/RUNBOOK.md` (la seule occurrence est un exemple `\uXXXX` dans un commentaire de `diagnostics.ts`). Aucun stub détecté.

### Écarts résiduels, non bloquants (WARNING)

- **WR-10 reporté au Lot 4** (par conception, consigné ADR-033 A10 et testé dans `tests/repo/docs.test.ts`) : la règle contrôle la date de publication du sondage, pas son affichage pendant une fenêtre. Le critère 4 du ROADMAP parle de « publication dans les fenêtres », donc il est satisfait. L'affichage reste à traiter au Lot 4.
- **IN-01 à IN-08 non corrigés** (hors périmètre `critical_warning`). Les plus utiles à reprendre : IN-08 (`RTP_MODE=preview` fait passer l'équité en avertissement lors d'un build de déploiement) et IN-03 (l'étape build de la CI ne passe pas `RTP_CONTENT_ROOT: "."`).
- **WR-07 résiduel** (consigné A7) : un duel 47 + 46 + 7 % « autres » au premier tour est encore accepté.
- Les avertissements (`VERBE_CONNOTE`, `CHIFFRE_DETAILLE_HORS_SOURCE`, `NOMBRE_LETTRES_HORS_SOURCE`, `LISIBILITE_ENFANT_FAIBLE`) ne font pas échouer la CI, conformément à CONTEXT.
- Le ROADMAP marque la phase `mode: mvp` sans User Story (voir plus haut).

### Vérification humaine requise

1. **Première PR sur GitHub Actions**
   - **Test :** ouvrir une PR de test qui supprime `source:` de la mesure fictive, et une autre qui retire un id d'`ids.lock`.
   - **Attendu :** le job `verifier` échoue ; l'annotation `SOURCE_ABSENTE` apparaît sur le bon fichier et la bonne ligne ; l'étape « ids.lock en ajout seul » échoue sur la seconde.
   - **Pourquoi humain :** le workflow ne peut pas s'exécuter localement, et seul GitHub confirme l'affichage des annotations et le comportement de `git merge-base` sur une vraie PR.

## Synthèse

Aucun écart bloquant. Les 5 critères du ROADMAP sont satisfaits par exécution du validateur, et les 12 REGLE sont tracées. Le statut est `human_needed` uniquement parce que le rendu en CI réelle n'a pas pu être observé depuis ce poste.

---

_Vérifié : 2026-11-03_
_Vérificateur : Claude (gsd-verifier)_


## Human verification — resolved 2026-11-03

Probe draft PR https://github.com/ErwanHenry/reveleTonProg/pull/3 (measure without `source:`): CI run failed with annotation `tests/fixtures/corpus-valide/src/content/mesures/marie-fictive/encadrement-loyers.yaml:7 SOURCE_ABSENTE`. PR closed, branch deleted. The ids.lock base step ran green on push of e83eb8f; a removal probe is meaningful once Phase 3 populates the root ids.lock (covered by tests/content-core/ids-cli.test.ts locally).
