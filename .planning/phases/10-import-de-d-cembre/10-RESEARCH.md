# Phase 10: Import de décembre - Research

**Researched:** 2026-11-12
**Domain:** outillage d'import YAML/JSON d'un jeu data.gouv, cohérence instantané/fichiers candidats, garde d'équité, procédure d'import en pull request relue
**Confidence:** HIGH pour le code et l'état du dépôt (lu et exécuté en lecture seule sous Node 24) ; HIGH pour l'état du jeu data.gouv au 2026-11-12 (API consultée) ; MEDIUM pour les dates réelles de l'import (aucune source ne les garantit : le jeu est « weekly »)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ordre et dépendances**
- **D-01:** La phase dépend de la Phase 9 pour l'import réel (site ouvert), mais le code (IMP-01, IMP-02, outil de répétition à blanc d'IMP-03) se fait dès maintenant, pendant la relecture d'Erwan. Rien de cette phase ne touche `src/content/**` avant la pull request d'import.

**IMP-01, lectures YAML plafonnées (dette W6 de l'audit v1.0)**
- **D-02:** Toute lecture YAML des outils d'import et d'archivage (`scripts/import-datagouv.ts`, `scripts/archive-source.ts`, `scripts/lib/{datagouv,archive,couverture}.ts`, et tout autre appel direct trouvé par la recherche) passe par l'analyseur plafonné de content-core (alias plafonnés, clés en double refusées). Un fichier piégé est refusé avec un message clair, fichier et ligne.
- **D-03:** Un test de dépôt interdit tout nouvel appel direct à `yaml.parse` ou `parseDocument` hors d'une liste blanche courte et motivée (content-core lui-même, l'éditeur de relecture qui travaille sur les positions des nœuds, les lecteurs de configuration s'ils ont déjà leur propre plafond). La recherche établit cette liste à partir du code réel.

**IMP-02, cohérence de l'instantané et piège**
- **D-04:** La CI vérifie que l'instantané data.gouv versionné (`data/dataset-datagouv.yaml`, `data/import/`) et les fichiers candidats sont cohérents : même ensemble d'identifiants, mêmes statuts et dates pour les champs que l'import possède. Une incohérence fait échouer `npm test` ou `validate` avec la liste des écarts.
- **D-05:** Un piège (fixture) prouve que « l'import ajoute un candidat déclaré à un thème publié » est détecté : la garde d'équité ou une règle dédiée signale que le thème publié n'a ni mesure ni case de couverture pour ce candidat. La recherche dit ce que le code fait aujourd'hui dans ce cas, avec le filtre de production du plan 09-15 (une personne au statut non relu est absente de la production) : le piège doit couvrir le moment où ce statut est relu.

**IMP-03, répétition à blanc et import réel**
- **D-06:** La répétition à blanc (`--dry-run` ou équivalent) n'écrit rien et produit un rapport lisible : nouveaux, retirés, changés (champ par champ), plus les conséquences sur les thèmes publiés (périmètre d'équité, cases manquantes). Le même rapport sert de corps à la pull request.
- **D-07:** L'import réel se fait sur une branche dédiée (`import/statuts-2026-12`) et une pull request relue par Erwan, jamais par un commit direct sur `main`. Les statuts importés arrivent non relus : avec le filtre du plan 09-15, ils n'apparaissent pas en production tant qu'Erwan ne les a pas relus.
- **D-08 (à confirmer par Erwan):** Quand l'import change le statut d'une personne déjà relue et publiée (par exemple un retrait de candidature), le statut repasse « à relire ». La recherche décrit l'effet exact sur le thème publié (la personne sort-elle de la production, la garde d'équité bloque-t-elle la build) et propose la règle la plus sûre ; Erwan tranche avec les plans sous les yeux.
- **D-09 (à confirmer par Erwan):** Le « gel du 13 au 15 décembre » est une règle d'exploitation écrite au RUNBOOK (aucune fusion ni déploiement sauf retrait d'urgence), pas une nouvelle fenêtre dans `scripts/garde-gel.ts`. À revoir si Erwan préfère une garde technique.

### Claude's Discretion
- Découpage en plans et vagues, noms des fonctions et des codes d'erreur, forme exacte du rapport de répétition à blanc.

### Deferred Ideas (OUT OF SCOPE)
Hors périmètre (section « Phase Boundary » de CONTEXT.md, pas de section « Deferred Ideas » dédiée) : pipeline quotidien et re-import par cron (Lot 5), sondages (Lot 4), relecture des thèmes travail et Europe et monde, relecture des 22 statuts « ne se présente pas » et « pressenti ».

### Contraintes (section `<constraints>` de CONTEXT.md)
- Aucun agent ne modifie `src/content/**`, `archives/**`, `data/**` hors de la branche d'import ; la PR d'import n'est fusionnée que par Erwan ou avec son accord écrit.
- Aucun secret ni donnée personnelle dans le dépôt public. Aucune écriture serveur dans cette phase.
- Node 24 via `fnm exec --using=24` ; **aucune nouvelle dépendance npm**.
- Un push qui touche le site demande une approbation de déploiement ; vérifier la CI après chaque push.
- La relecture d'Erwan se fait sur `relecture/sante` (worktree `../reveleTonProg-relecture`) : ne pas y toucher ; un plan qui modifie des fichiers lus par l'outil de relecture le signale.
- Sous-agents sur Opus ou Sonnet ; exécution un plan à la fois sur `main`.

### Directives de CLAUDE.md (projet) applicables
- Zéro dépendance ajoutée sans justification par écrit ; chaque PR justifie ses dépendances (ici : aucune).
- Neutralité, sourçage, vie privée : le rapport d'import et le corps de PR ne contiennent que des faits du jeu amont (ids, codes de statut, dates, URL) ; jamais de qualificatif sur une personne.
- Données en YAML/JSON dans Git, validées par JSON Schema en CI ; pas de BDD ; aucun secret dans le dépôt.
- Workflow GSD : toute modification passe par une commande GSD (cette recherche n'écrit que ce fichier).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | Lectures YAML des outils d'import et d'archivage par un analyseur plafonné (alias, clés en double), comme content-core | §1 (inventaire de 17 sites d'appel), §2 (`parseYaml` réutilisable tel quel, mesures de message), §3 (liste blanche et test de dépôt) |
| IMP-02 | CI : cohérence instantané data.gouv / fichiers candidats ; piège « l'import ajoute un candidat déclaré à un thème publié » | §4 (ce qu'est l'instantané), §5 (0 écart aujourd'hui, ce qui manque), §6 (trace des deux modes, piège à écrire) |
| IMP-03 | Répétition à blanc puis PR dédiée dont le diff (nouveaux, retirés, changés) est relu ; production affectée seulement après relecture | §7 (outil actuel et manques), §8 (D-08), §9 (D-09), §10 (ordre de fusion), §11 (calendrier) |
</phase_requirements>

## Summary

L'import data.gouv existe déjà de bout en bout (`scripts/import-datagouv.ts`, 321 lignes, plus `scripts/lib/datagouv.ts`) et possède déjà un `--dry-run` qui n'écrit rien (vérifié dans le code : toute écriture passe par `ecrireAtomique`, appelée seulement hors `dryRun`). Ce qui manque est de trois ordres. (1) IMP-01 : 17 sites d'appel YAML directs dans `scripts/**` et `src/**`. Seuls 3 outils d'import/archivage n'ont pas le plafond de content-core, et un fichier candidat avec un alias est aujourd'hui accepté sans un mot par l'import (prouvé : « 1 inchangé »), alors que content-core le refuse en `YAML_ALIAS_INTERDIT 12:13`. `parseYaml` de `src/lib/content-core/load.ts` est réutilisable tel quel ; il suffit d'une enveloppe fine qui lève une erreur française avec `fichier:ligne:col`. (2) IMP-02 : il n'existe aucune règle de validateur entre l'instantané et les candidats ; seul `tests/corpus/fiches.test.ts` vérifie le nombre de fiches et la bijection des `ids_externes`. L'instantané et les 59 fiches sont cohérents aujourd'hui (0 écart sur identifiants, code, motif, date, source, parti, site ; calcul en lecture seule). (3) IMP-03 : le rapport actuel ne sait pas dire « champ par champ », ne parle pas des thèmes publiés, et **s'arrête net au premier identifiant amont inconnu** sans rien lister d'autre.

Quatre constats changent le plan. **A.** Le jeu en ligne a déjà bougé : au 2026-11-12 il contient 61 lignes (59 au dépôt), dont 2 nouveaux (Teddy Riner, `declare`, source franceinfo du 2026-11-09 ; Christine Lagarde, `renonce`) et six sources modifiées sans changement de statut ; la répétition à blanc réelle (`--file <jeu en ligne> --dry-run`) échoue aujourd'hui sur « identifiants absents de correspondances.yaml : lagarde, riner ». C'est la répétition de décembre en vrai, utilisable dès maintenant. **B.** Le piège D-05 est déjà couvert aux trois quarts par les garde-fous existants : `marquer statut` valide en mode production après écriture et **restaure le fichier** si une nouvelle erreur `EQUITE_CANDIDAT_MANQUANT` apparaît (le relecteur est donc forcé d'ajouter la case de couverture avant de relire le statut), la build de production lève ensuite deux fois (content-core puis `construireCorpus`). Ce qui manque, c'est une fixture qui le prouve (la harnais `overlay` sait ajouter un fichier) et une alerte *avant* la relecture. **C.** D-08 est déjà vrai par construction : l'import ajoute toujours une nouvelle entrée `brouillon` en fin de `statuts[]` et ne touche jamais l'ancienne ; l'ancienne reste `relu`, donc la production **continue d'afficher l'ancien statut** (la personne ne sort pas, rien ne bloque, aucun diagnostic) jusqu'à ce que le nouveau soit relu. Le risque n'est pas un blocage mais un affichage périmé silencieux. **D.** Une comparaison stricte des dates dans D-04 échouerait dès décembre : pour un statut inchangé, l'import garde volontairement l'ancienne source et l'ancienne date (6 cas dans le jeu actuel). Le contrôle doit porter sur identifiants, `ids_externes`, `(code, motif)` du statut le plus récent, et traiter la dérive de source comme information, pas comme erreur.

**Primary recommendation:** 4 plans, 3 vagues. Vague 1 (maintenant, indépendante) : IMP-01 (enveloppe `lireYamlPlafonne` dans un nouveau fichier, migration de 5 sites, test de dépôt avec liste blanche de 7 fichiers) et le module pur de cohérence `scripts/lib/instantane.ts` avec son test IMP-02. Vague 2 (avant l'ouverture, pendant la relecture) : rapport de répétition à blanc (module pur `rapportImport`, tolérant aux identifiants inconnus, format Markdown) et piège D-05 ; répétition réelle dans un worktree jetable. Vague 3 (10 au 13 décembre) : import réel sur `import/statuts-2026-12` depuis un `main` à jour **après** la fusion de la relecture, RUNBOOK (D-09, texte seulement).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lecture YAML plafonnée | Outillage Node (content-core, `src/lib/content-core/`) | Scripts (`scripts/**`) | Une seule définition du plafond (DATA-07) ; les scripts l'appellent, ne la recopient pas |
| Cohérence instantané / candidats | Outillage Node (module pur testé) | CI (`npm test`) | `validate` ne lit que `src/content/` ; l'instantané vit sous `data/`, hors du chargeur |
| Garde d'équité et filtre de production | Règles content-core + view-model Astro + `check-dist` | — | Défense en profondeur existante (ADR-041, ADR-060) ; la phase ne l'étend pas, elle la prouve |
| Rapport de répétition à blanc | Outillage Node (module pur + CLI mince) | PR GitHub (corps) | Même texte pour le terminal et la PR ; aucun accès disque dans le module pur |
| Import réel | Branche Git + PR relue | CI GitHub (verifier, deploy sur approbation) | La production n'est touchée que par fusion + approbation de déploiement |
| Règle de gel 13-15 décembre | Documentation d'exploitation (RUNBOOK) | Approbation GitHub du job `deploy` | Le bouton d'approbation d'Erwan est déjà la garde humaine |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yaml` (eemeli) | ^2.9.1, déjà au `package.json` | `parseDocument`, `LineCounter`, `visit`, `Document.toString` | Déjà utilisé par Astro et content-core ; aucun ajout [VERIFIED: `package.json`, `src/lib/content-core/load.ts`] |
| `node:test` + `node:assert` | Node 24 (24.22.2 local) | Tests unitaires et de dépôt | Convention du dépôt (`npm test` = `node --test "tests/**/*.test.ts"`) [VERIFIED: `package.json`] |
| `ajv` | ^8.20.0 déjà installé | Validation JSON Schema des fiches (via `validateYamlText`) | Utilisé par l'import avant écriture [VERIFIED: `scripts/import-datagouv.ts:200`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:util` `parseArgs` | stdlib | Options `--dry-run`, `--format`, `--check` | Convention de tous les CLI du dépôt |
| `node:child_process` `spawnSync` + `git ls-files` | stdlib | Lister les fichiers suivis pour le test de dépôt | Même technique que `tests/repo/hote-en-dur.test.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Enveloppe dans un nouveau fichier `src/lib/content-core/yaml-plafonne.ts` | Ajouter l'export à `load.ts` | `load.ts` est importé par l'outil de relecture (branche `relecture/sante`) : un nouveau fichier évite de toucher un fichier que la relecture lit (contrainte CONTEXT) |
| Test `npm test` pour D-04 | Nouvelle règle de validateur `REGLE-xx` | Le validateur ne voit que `src/content/` ; une règle y lirait `data/` et casserait l'isolation des fixtures (`--root`). Le test lit le vrai dépôt, comme `fiches.test.ts` |

**Installation:** aucune. `npm install` n'est pas à lancer.

**Version verification:** `yaml` ^2.9.1 et `ajv` ^8.20.0 déjà verrouillés dans `package.json` ; aucun nouveau paquet. [VERIFIED: `package.json` lu]

## Package Legitimacy Audit

Aucun paquet externe n'est ajouté ou mis à jour par cette phase (contrainte CONTEXT : « aucune nouvelle dépendance npm »). Audit sans objet ; `slopcheck` non lancé.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 data.gouv.fr (API 302) ──► 2027etmoi.fr/data/candidats.json
        │  fetchSafe (https, IP publiques, 5 Mo, 30 s)           [seul accès réseau de la phase]
        ▼
 scripts/import-datagouv.ts  ──(octets bruts, sha256)──► checkUpstream (forme, 59→61 lignes)
        │
        ├─► lireYamlPlafonne(correspondances.yaml)   ◄── IMP-01 (aujourd'hui : yaml.parse direct, ligne 124)
        ├─► ids amont absents de la table ? ── oui ──► [AUJOURD'HUI : arrêt total ; CIBLE : rapport « nouveaux à mapper »]
        ▼
   pour chaque ligne amont :
     lireYamlPlafonne(fiche existante)               ◄── IMP-01 (ligne 165 et 295)
     mapRow → mergeFiche ──► cree | statut_ajoute | inchange (+ notes de dérive)
        │ statut_ajoute : ajouterStatutYaml = ajout en fin de statuts[] (préfixe conservé, vérifié sur 59 fichiers)
        │ validateYamlText(preview) avant toute écriture
        ▼
   rapportImport(plan, instantané précédent, corpus) ──► Markdown : nouveaux / retirés / changés / conséquences thèmes publiés
        │                                              (même texte = corps de la PR, D-06)
        ├─ --dry-run : stdout seulement, 0 écriture
        └─ réel (branche import/statuts-2026-12) : data/import/*.json + .meta.json, src/content/candidats/*.yaml, ids.lock
                  + à la main : correspondances.yaml, ATTRIBUTION.md, LICENSE, data/dataset-datagouv.yaml, README, tests à compteurs
        ▼
   PR ──► CI verifier : validate(prod) · ids --check · npm test (+ cohérence D-04) · build · check-dist
        ▼
   Erwan relit le diff ; `relecture marquer statut <id>` sur la branche ; merge ; job deploy sur approbation
        ▼
   Production : statutRetenu('production') = plus récent des statuts relu|publie  → ancien statut tant que le nouveau est brouillon
```

### Recommended Project Structure
```
scripts/
├── import-datagouv.ts              # CLI (modifié : lireYamlPlafonne, --format markdown, --check)
└── lib/
    ├── datagouv.ts                 # mapping pur (modifié : ajouterStatutYaml plafonné)
    ├── instantane.ts               # NOUVEAU : comparerInstantane(rows, table, fiches) -> écarts[] (pur)
    └── rapport-import.ts           # NOUVEAU : rapportImport(...) -> Markdown + structure (pur)
src/lib/content-core/
└── yaml-plafonne.ts                # NOUVEAU : lireYamlPlafonne(text, file) ; ne modifie pas load.ts
tests/
├── repo/yaml-plafonne.test.ts      # NOUVEAU : D-03 (fonction pure + balayage du dépôt)
├── corpus/instantane-coherence.test.ts   # NOUVEAU : D-04 sur le vrai dépôt
├── import/rapport.test.ts          # NOUVEAU : D-06
└── fixtures/pieges/IMPORT_...      # NOUVEAU : D-05 (surcouches a et b, voir §6)
```

### Pattern 1: Enveloppe plafonnée qui lève une erreur française
**What:** `lireYamlPlafonne(texte, fichier)` appelle `parseYaml` (déjà exporté de `load.ts`), regroupe les diagnostics et lève `YamlRefuse` dont le message commence par `fichier:ligne:col CODE message`. Elle limite l'affichage à 3 alias (la bombe d'alias de 45 alias produit aujourd'hui 45 lignes).
**When to use:** tout script qui lit un fichier YAML du dépôt pour en tirer des données.
**Example:**
```typescript
// Source: src/lib/content-core/load.ts:60-95 (parseYaml existant, non modifié)
import { parseYaml } from './load.ts';
export class YamlRefuse extends Error {
  constructor(readonly diagnostics: Diagnostic[], message: string) { super(message); this.name = 'YamlRefuse'; }
}
export function lireYamlPlafonne(texte: string, fichier: string): Record<string, unknown> {
  const r = parseYaml(texte, fichier);
  const erreurs = r.diagnostics.filter((d) => d.severity === 'error');
  if (erreurs.length > 0) {
    const montres = erreurs.slice(0, 3).map((d) => `${path.basename(d.file)}:${d.line}:${d.col} ${d.code} ${d.message}`);
    const reste = erreurs.length - montres.length;
    throw new YamlRefuse(erreurs, `${montres.join(' ; ')}${reste > 0 ? ` (+${reste} autre(s))` : ''}`);
  }
  return r.data as Record<string, unknown>;
}
```

### Pattern 2: Module pur + CLI mince (convention Phase 3)
**What:** logique sans accès disque ni réseau dans `scripts/lib/*.ts`, CLI qui lit et écrit. `scripts/lib/datagouv.ts` s'annonce « Module PUR » ; `comparerInstantane` et `rapportImport` suivent.
**When to use:** D-04 et D-06, pour que test, CLI et rapport de PR partagent la même logique.

### Pattern 3: Piège par surcouche de répertoire
**What:** `tests/helpers/overlay.ts` copie `tests/fixtures/corpus-valide`, superpose les fichiers d'un dossier `tests/fixtures/pieges/<CODE>--<variante>/` (y compris des fichiers **nouveaux**, `copierSurcouche`, lignes 70-82), puis applique `remplacer`/`supprimer`. Je l'ai exécuté avec une surcouche ajoutant un candidat (résultats en §6).

### Anti-Patterns to Avoid
- **Comparer les dates de statut strictement dans D-04** : fausse alerte permanente dès décembre (voir §5 et pitfall 1).
- **Réécrire les anciennes entrées de `statuts[]`** pour « repasser à relire » : viole l'ajout seul et casse `empreinteStatut` du journal ; l'import n'a aucun besoin de le faire (§8).
- **Importer sur un `main` en retard sur la branche de relecture** : conflit garanti sur les fichiers relus (§10).
- **Appeler `yaml.parse` avec les options par défaut** : `maxAliasCount` vaut 100 (pas 0), les alias légers sont acceptés en silence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plafond d'alias et clés en double | Un second analyseur « léger » dans les scripts | `parseYaml` de `load.ts` (via `lireYamlPlafonne`) | `PARSE_OPTIONS` + visite des alias donne ligne et colonne ; une copie diverge (3 variantes existent déjà dans `src/lib/*-config.ts`) |
| Ajout d'un statut dans un fichier existant | Réserialisation complète du fichier | `ajouterStatutYaml` (`scripts/lib/datagouv.ts:275`) | Vérifié : sur les 59 fichiers, avec champs de relecture insérés par `definirChamps`, la sortie est exactement l'entrée suivie du bloc ajouté |
| Statut qui fait foi | Un nouveau calcul du « dernier statut » | `statutRetenu` / `dansPerimetre` (`src/lib/content-core/rules/equite.ts:35-46`) | Une seule définition (ADR-041, W5) ; un test refuse déjà toute copie de `PERIMETRE_EQUITE` |
| Écriture atomique avec garde de racine | `fs.writeFileSync` direct | `ecrireAtomique` de l'import (tmp + rename, realpath) | Garde déjà testée (symlink, hors racine) |
| Téléchargement du jeu | `fetch` brut | `fetchSafe` (`scripts/lib/fetch-safe.ts`) | https seul, IP publiques, redirections revérifiées, plafond 5 Mo, délai 30 s |
| Liste des fichiers suivis dans un test | `readdirSync` récursif sur tout le dépôt | `git ls-files -z` (comme `hote-en-dur.test.ts`) | Ignore `node_modules`, `dist*`, caches |

**Key insight:** tout l'outillage nécessaire existe. La phase consiste à relier des briques (plafond, statut retenu, harnais de pièges, `marquer`) et à les prouver par des tests, pas à construire de nouvelles machines.

## Runtime State Inventory

Phase d'import (migration de données), pas de renommage. Les cinq catégories, explicitement :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `src/content/candidats/*.yaml` (59 fichiers, tous `statut_relecture: brouillon` sur `main`), `ids.lock` (61 lignes dont 2 d'en-tête = 59 ids), `data/import/*.json` + `.meta.json`, `relecture/journal.jsonl` et `notes.jsonl` (absents de `main`, vivent sur la branche de relecture) | Édition de données par l'import (nouvelles entrées `statuts[]`, nouveaux fichiers, nouveaux ids) ; **aucune** migration des anciennes entrées ; le journal n'est jamais écrit par l'import |
| Live service config | Jeu data.gouv (ressource `06237c53-76bd-4224-9805-418e125f0493`, mis à jour chaque semaine, `last_update` 2026-11-12 05:42 UTC) | Aucune config à modifier ; vérifier à nouveau l'identifiant de ressource avant l'import réel |
| OS-registered state | Aucun (pas de cron, import manuel : le re-import par cron est hors périmètre, Lot 5) | None, vérifié par la CONTEXT (hors périmètre) |
| Secrets/env vars | Aucun ; `RTP_CONTENT_ROOT` est volontairement ignorée par l'import (`--root` seul) | None |
| Build artifacts / installed packages | `dist*` (non suivis), `.astro` ; aucun artefact portant un identifiant de candidat en dur | None |

**Fichiers non générés par l'outil mais qui portent la date ou le nombre de lignes de l'instantané** (à mettre à jour à la main dans la PR d'import, sinon `npm test` échoue) : `data/dataset-datagouv.yaml` (`instantane:`, `description_consultee_le:`), `data/import/ATTRIBUTION.md` (« mises à jour le 28/10/2026 »), `LICENSE` ligne 81 (même date), `data/import/README.md` (liste « lignes à relire »), tests à compteurs en dur : `tests/corpus/dataset-datagouv.test.ts:58-77` (51, 59, 37/17/5), `tests/dist/cas/methode.cas.ts:133`. Voir §4.

## 1. Inventaire des lectures YAML directes (question 1)

Recherche : `grep` de `parseDocument|parseAllDocuments|new Document|yaml.parse|parse(|from 'yaml'` dans `scripts/`, `src/`, `e2e/`, `astro.config.*`. `new Document` et `parseAllDocuments` : **aucun** appel. Les `stringify` (écriture) ne sont pas des lectures. [VERIFIED: grep du dépôt, 2026-11-12]

| # | Fichier:ligne | Ce qu'il lit | Plafond actuel | Action |
|---|---------------|--------------|----------------|--------|
| 1 | `scripts/import-datagouv.ts:124` `parse(corrLue.text, {schema:'core', uniqueKeys:true})` | `data/import/correspondances.yaml` (fichier du dépôt, écrit à la main) | `maxAliasCount` par défaut 100 ; doublons refusés en anglais (« Map keys must be unique at line 24, column 1: ») ; pas d'`merge:false` explicite | **Migrer** |
| 2 | `scripts/import-datagouv.ts:165` `parse(lu.text, {schema:'core', uniqueKeys:true})` | `src/content/candidats/<id>.yaml` existant | idem ; **un alias est accepté sans message** | **Migrer** |
| 3 | `scripts/import-datagouv.ts:295` `parse(lu.text, {schema:'core'})` | mêmes fichiers, pour le rapport « absent en amont » | idem ; erreur avalée dans `illisibles` sans raison | **Migrer** |
| 4 | `scripts/archive-source.ts:514` `parseYamlText(readFileSync(...), {schema:'core'})` | tous les `src/content/sources/*.yaml` (`sourcesSansWayback`) | défaut 100 ; une bombe ou un doublon donne « `bomb.yaml illisible : ignorée` », la source est **écartée en silence de la liste** | **Migrer** (et ne plus ignorer en silence) |
| 5 | `scripts/lib/datagouv.ts:276` `parseDocument(texte, {schema:'core', uniqueKeys:true})` dans `ajouterStatutYaml` | fichier candidat existant (édition en place) | doublons seulement ; ni `merge:false`, ni contrôle d'alias, ni `LineCounter` ; message `errors[0].message` brut | **Migrer le contrôle** (la `Document` reste nécessaire pour `seq.add` : appeler d'abord `lireYamlPlafonne` sur le texte, puis `parseDocument`) |
| 6 | `scripts/lib/couverture.ts:88` `parseDocument(texte, {schema:'core', uniqueKeys:true, merge:false})` + `toJS({maxAliasCount:0})` | `data/couverture-themes.yaml` (1 800 lignes, dépôt) | **A déjà son plafond équivalent** (alias refusés par `toJS`, doublons refusés) mais sans ligne/colonne ni code | D-02 le nomme : **migrer** (l'API `lireCouverture(texte)` ne reçoit pas de nom de fichier : ajouter un paramètre optionnel `fichier = 'data/couverture-themes.yaml'`) |
| 7 | `scripts/lib/archive.ts:4` | `stringify` seulement (écriture) | n.a. | Aucune lecture : D-02 est satisfait ; aucune action |
| 8 | `scripts/lib/relecture/editer.ts:106` `parseDocument(texte, {...PARSE_OPTIONS, keepSourceTokens:false})` + visite des alias | fichiers `src/content/**` pour l'éditeur par positions | **Plafond identique** (importe `PARSE_OPTIONS` de `load.ts`, refuse tout alias) | **Liste blanche** (travaille sur les nœuds, besoin du `Document`) ; ne pas toucher (fichier lu par la relecture) |
| 9 | `src/lib/content-core/load.ts:65` | tout `src/content/**` | définition du plafond | **Liste blanche** |
| 10 | `src/lib/content-core/migrate.ts:43` `parseDocument(text, {...PARSE_OPTIONS, lineCounter})` | idem, pour `migrate` | `PARSE_OPTIONS` | **Liste blanche** (content-core) |
| 11 | `src/lib/site-config.ts:81` | `config/site.yml` (dépôt) | `{schema:'core', uniqueKeys:true, merge:false}` + `visit(Alias)` refuse tout alias, ligne 89 | **Liste blanche** (plafond propre) |
| 12 | `src/lib/hebergeur-config.ts:59` | `config/hebergeur.yml` | idem, alias refusés ligne 67 | **Liste blanche** |
| 13 | `src/lib/publication-config.ts:34` | `config/publication.yml` | idem, alias refusés ligne 42 | **Liste blanche** |
| 14 | `src/lib/dataset-datagouv.ts:51` | `data/dataset-datagouv.yaml` | idem | **Liste blanche** |
| 15 | `scripts/lib/fetch-safe.ts:64` `parse(...)` | analyse d'adresse IPv6 (fonction locale `parse`, **pas YAML**) | n.a. | Faux positif du grep ; le test de dépôt doit se baser sur l'import depuis `'yaml'`, pas sur le mot `parse` |
| 16 | `src/lib/content-core/diagnostics.ts:2`, `rules/champs.ts:1`, `rules/index.ts`, `rules/types.ts`, `ajv.ts` | `isMap`/`isPair`/`visit`, types | n.a. (aucun appel de lecture) | Importent `yaml` sans lire : le test ne doit viser que les imports de **`parse`, `parseDocument`, `parseAllDocuments`, `Document` (valeur)** |
| 17 | `tests/**` (21 fichiers importent `parse` de `yaml`) | fixtures et fichiers du dépôt de confiance | défaut | Hors périmètre du test de dépôt (D-03 vise le code livré) ; le test le dit explicitement |

**Tous les fichiers lus sont dans le dépôt (de confiance, édités par Erwan ou par outil).** Il n'y a pas de chemin fourni par l'utilisateur lu comme YAML (`--file` de l'import est du JSON ; `--file` de `archive-source` est du HTML/texte). Le seul contenu téléchargé est le JSON amont (`JSON.parse`, pas YAML). Le risque réel est donc l'erreur de l'éditeur (alias, doublon) et la dérive de messages, pas une attaque ; mais D-02 est clair et la règle coûte peu. [VERIFIED: lecture des appels ci-dessus]

## 2. L'analyseur plafonné de content-core (question 2)

`src/lib/content-core/load.ts` [VERIFIED: lecture complète]
- `PARSE_OPTIONS = { schema: 'core', uniqueKeys: true, merge: false }` (ligne 20), `TO_JS_OPTIONS = { maxAliasCount: 0 }` (ligne 22). Schéma YAML 1.2 « core » : `2026-11-03` reste une chaîne, `no` n'est pas un booléen.
- `parseYaml(text, file)` (ligne 60) exporté : `new LineCounter()` + `parseDocument(text, {...PARSE_OPTIONS, lineCounter})`, puis :
  - chaque erreur et chaque **avertissement** de `doc.errors`/`doc.warnings` devient un `Diagnostic` `YAML_<code>` (`YAML_DUPLICATE_KEY`, `YAML_MULTIPLE_DOCS`, `YAML_TAG_RESOLVE_FAILED`, `YAML_BAD_INDENT`, tout autre code yaml avec son message brut) avec ligne et colonne ;
  - `visit(doc, {Alias})` ajoute **un** `YAML_ALIAS_INTERDIT` par alias (ligne:col) : « les alias YAML (*nom) sont interdits : répéter la valeur » ;
  - `doc.toJS(TO_JS_OPTIONS)` seulement s'il n'y a aucun alias ; racine non objet : `YAML_RACINE_NON_OBJET` (1:1).
- Retour : `{ doc, lc, data, diagnostics }`. Ne lève jamais pour une erreur de contenu. `validateYamlText(schemaName, text, file, opts)` ajoute la validation Ajv (déjà utilisée par l'import ligne 200 et par `archive-source` lignes 170, 189, 196).
- **Réutilisable tel quel par les scripts** : `import-datagouv.ts` et `archive-source.ts` importent déjà `load.ts` (`readContained`, `validateYamlText`) : aucun poids ajouté. Il manque seulement l'enveloppe qui transforme les diagnostics en exception lisible (Pattern 1). `parseYaml` ne doit pas être modifié (les `src/lib/*-config.ts` n'en dépendent pas ; l'outil de relecture dépend de `PARSE_OPTIONS`).

**Messages observés** (fichiers temporaires sous `/tmp`, supprimés ensuite ; aucune écriture dans le dépôt) [VERIFIED: exécutions du 2026-11-12] :

| Cas | content-core (`parseYaml`) | `import:datagouv --dry-run` | `archive --wayback-missing --dry-run` |
|-----|---------------------------|----------------------------|---------------------------------------|
| Clé en double dans un fichier candidat | `YAML_DUPLICATE_KEY 24:1 clé en double dans le même objet (Map keys must be unique)` | `conflit : anasse-kazib — fichier existant illisible (Map keys must be unique at line 24, column 1:)` ; sortie 1 « rien n'a été écrit » (nom d'id, pas de chemin, message anglais) | `AVERTISSEMENT : dup.yaml illisible : ignorée` (ni ligne, ni raison ; la source est écartée de la liste) |
| Bombe d'alias (6 niveaux, 9 alias par niveau) | 45 diagnostics `YAML_ALIAS_INTERDIT 2:8 …` (un par alias) | non testée dans l'import (même `parse` que ci-dessus, défaut 100) | `AVERTISSEMENT : bomb.yaml illisible : ignorée` |
| **Un seul alias bénin** (`parti: &p …` + `x: *p`) | `YAML_ALIAS_INTERDIT 12:13 les alias YAML (*nom) sont interdits` | **accepté sans un mot** : `59 ligne(s), 58 créé(s), 0 … 1 inchangé(s)` (le fichier existant n'est même pas validé quand l'action est `inchange`, ligne 197) | non testé |

Conséquence pour D-02 : « refusé avec un message clair, fichier et ligne » est vrai pour content-core et faux pour l'import et l'archive. Le cas « un alias bénin accepté » est le seul écart de comportement réel ; les autres sont des écarts de message.

## 3. Liste blanche et test de dépôt (question 3)

**Liste blanche proposée (7 fichiers, chacun avec sa raison dans le test)** :

| Fichier | Raison |
|---------|--------|
| `src/lib/content-core/load.ts` | Définit le plafond (`PARSE_OPTIONS`, `parseYaml`) |
| `src/lib/content-core/migrate.ts` | Part de content-core, mêmes `PARSE_OPTIONS`, réécrit par positions |
| `scripts/lib/relecture/editer.ts` | Éditeur par positions de nœuds ; importe `PARSE_OPTIONS`, refuse tout alias |
| `src/lib/site-config.ts` | Lecteur de configuration, plafond propre (alias refusés, `uniqueKeys`, `merge:false`) |
| `src/lib/hebergeur-config.ts` | idem |
| `src/lib/publication-config.ts` | idem |
| `src/lib/dataset-datagouv.ts` | idem |

Les quatre lecteurs de configuration sont importés au chargement d'`astro.config.mjs` ou par la CI ; les migrer vers `load.ts` ferait entrer `ajv` et les règles dans ce chemin : **les laisser sur la liste blanche** est la décision proportionnée (D-03 le prévoit). Les 5 sites des scripts (lignes 1 à 6 du tableau §1) sortent de la liste : ils n'y sont **pas**.

**Forme du test** (`tests/repo/yaml-plafonne.test.ts`), même style que `tests/repo/hote-en-dur.test.ts` : une fonction pure exportée `trouverLecturesYamlDirectes(fichiers: {chemin, contenu}[])`, testée sur des textes synthétiques, puis un cas qui balaie le vrai dépôt (`git ls-files -z` filtré sur `scripts/`, `src/`, `e2e/`, `astro.config.mjs`, extensions `.ts .mjs .astro .js`) avec `LISTE_BLANCHE` exportée.
- Détection : un fichier est fautif s'il **importe depuis `'yaml'`** (ou `require('yaml')`, `import('yaml')`, `import * as X from 'yaml'`) l'un de `parse`, `parseDocument`, `parseAllDocuments`, `Document` (hors `import type`), alias `as` compris, et n'est pas sur la liste. Ne pas chercher le mot `parse` seul (faux positif `fetch-safe.ts:64`).
- Quatre auto-contrôles : (a) `import { parse as p } from 'yaml'` est détecté ; (b) `import type { Document } from 'yaml'` ne l'est pas ; (c) `import { stringify } from 'yaml'` ne l'est pas ; (d) chaque entrée de liste blanche **existe encore et appelle toujours** l'API (sinon test rouge : liste périmée).
- Hors périmètre déclaré dans l'en-tête : `tests/**` (21 fichiers parsent des fixtures de confiance).
- Quand ajouter un 8e fichier : la liste est une décision, pas un contournement ; le message d'échec le dit.

## 4. Ce qu'est l'instantané versionné et comment l'import le projette (question 4)

[VERIFIED: lecture de `scripts/import-datagouv.ts`, `scripts/lib/datagouv.ts`, `data/import/README.md`, `.planning/milestones/v1.0-phases/03-*/03-01-SUMMARY.md`]

**Fichiers**
- `data/import/2027etmoi-candidats-<mise_a_jour>-<sha12>.json` : octets bruts reçus (62 986 octets, 59 lignes, sha256 `9f2fbc79…`) ; `.meta.json` voisin (URL initiale/finale, ETag, `fetched_at`, sha256, `bytes`, `mise_a_jour`, `rows`, licence, producteur) ; `-text` dans `.gitattributes` pour garder le sha256.
- `data/import/correspondances.yaml` : table **faite à la main** (59 entrées) amont → `{id, prenom, nom, nom_tri, motif?, type_source_statut}`. L'identifiant du candidat vient de cette table, jamais d'un découpage du nom amont.
- `data/dataset-datagouv.yaml` : faits sur le jeu (`page`, `producteur`, `licence`, `annonce: 51`, `description_consultee_le: 2026-11-03`, `instantane:` chemin du JSON). `loadDatasetDatagouv` (`src/lib/dataset-datagouv.ts`) vérifie le sha256 contre la méta et **calcule** les comptes (total, par statut) ; la page Méthode les affiche. **L'import n'écrit jamais ce fichier** : après l'import il pointe encore l'ancien instantané et la Méthode afficherait l'ancien total.
- `ids.lock` : identifiants verrouillés en ajout seul ; l'import l'étend (`ajouterIds`) ; `ID_NON_VERROUILLE` (erreur) sinon (vérifié par ma surcouche §6).

**Ce que l'import possède** (écrit à la création, jamais modifié ensuite) : `id`, `prenom`, `nom`, `nom_tri`, `parti` (null sans source de revendication, A4), `parti_source`, `site_officiel`, `ids_externes.2027etmoi`, et `statuts[0]` : `code`, `motif` (renonce seulement, de la table), `date` (= `source.date` amont), `source{type (de la table), titre, url, date_publication, date_consultation (= `verifie_le` amont, A3)}`, `statut_relecture: brouillon`.
**Éditorial** (jamais touché par l'import) : `relecteur`, `date_relecture`, `statut_relecture` des entrées existantes, `mandats_en_cours`, `ordre_cc`, `ids_externes.wikidata`, et toute modification manuelle (par exemple `parti`).
**Fusion append-only** (`mergeFiche`, `datagouv.ts:232-263`) : fiche absente → `cree` ; sinon compare `(code, motif)` du statut le plus récent par date (`statutLePlusRecent`) avec l'amont :
- identique → `inchange`, avec la note « source amont modifiée (non appliquée : même statut) » si l'URL ou la date diffère ;
- différent et date amont non antérieure → **ajout en fin de `statuts[]`** (`statut_ajoute`) ; ancienne entrée jamais modifiée ni supprimée ;
- date amont antérieure (au niveau de précision commun) → `conflit` (tout l'import s'arrête, rien n'est écrit) ;
- `parti` ou `site_officiel` amont différent → note, jamais appliqué.
**Personne retirée du jeu** : la fiche reste, son id reste verrouillé, le rapport ajoute « absent en amont : id, … » (calculé via `ids_externes.2027etmoi` des fiches, lignes 285-304 ; une fiche sans `ids_externes` n'est jamais signalée).
**Historique** : `statuts[]` croît par ajout ; le statut qui fait foi est calculé (`statutRetenu`), pas stocké.

Note de documentation : `data/import/README.md` dit « Une fiche modifiée est réécrite par l'importeur dans son rendu canonique » ; faux depuis WR-07 (le code fait une édition en place par `ajouterStatutYaml`). À corriger dans la PR d'import.

## 5. Contrôles de cohérence existants, manques pour D-04, état réel (question 5)

**Existant** (aucune règle de validateur ne lit `data/import/`) :
- `tests/corpus/fiches.test.ts` : une fiche par ligne du plus récent instantané (`newestSnapshot()` = dernier nom de fichier par ordre alphabétique), ids uniques, bijection des `ids_externes.2027etmoi`, `renonce` porte un motif, aucune clé `bloc|propositions|statut_detail|extdroite`, ATTRIBUTION.md et `LICENSE` portent la date du dernier instantané, « tout statut est brouillon » tant que `pilote.relecture_ouverte` n'est pas vrai (il l'est déjà : `data/couverture-themes.yaml:1786`, test inactif).
- `tests/corpus/dataset-datagouv.test.ts` : le fichier du dépôt donne 51 annoncés, 59 lignes, 37/17/5.
- `tests/import/*.test.ts` (31 cas) : mapping, fusion, CLI en répertoire temporaire.

**Manque pour D-04** : (a) `(code, motif)` du statut le plus récent de chaque fiche contre la ligne amont ; (b) `ids_externes` ↔ table `correspondances.yaml` ↔ ids de fiches (trois ensembles, pas deux) ; (c) `data/dataset-datagouv.yaml:instantane` = l'instantané le plus récent (sinon la Méthode décrit un autre fichier) ; (d) choix de « le plus récent » : le nom de fichier trie sur `mise_a_jour`, or **le jeu en ligne a `mise_a_jour: 2026-11-01` alors que ses lignes ont `verifie_le: 2026-11-09`** : le champ n'est pas un marqueur de fraîcheur fiable. Définir le plus récent comme celui que `data/dataset-datagouv.yaml` désigne, et tester que ce désigné est aussi le maximum par `(mise_a_jour, fetched_at)`.

**État réel au 2026-11-12** (calcul en lecture seule avec `checkUpstream`, `lireCorrespondances`, `mapRow`, `statutLePlusRecent` sur les 59 fichiers) [VERIFIED] : amont 59, table 59, fichiers 59, ids dérivés 59 ; fichiers sans amont : aucun ; amont sans fichier : aucun ; **0 écart** sur `ids_externes`, `code`, `motif`, `date`, `source.url`, `source.type`, `date_consultation`, `parti`, `site_officiel` ; statuts les plus récents : 37 `declare`, 17 `renonce`, 5 `pressenti` ; les 59 statuts sont `brouillon` ; aucun fichier n'a plus d'un statut. `import --file <instantané> --dry-run` : « 59 inchangé(s), 0 conflit(s) ». Ces lectures sont cohérentes avec les tests existants (101 tests verts relancés : import, fiches, dataset, garde-gel, équité).

**Définition recommandée du contrôle (module pur `comparerInstantane`)** — erreurs : (1) id de fiche sans ligne amont mappée, ou ligne amont mappée sans fiche (note : une personne **retirée** du jeu reste légitimement en fiche : l'erreur ne vaut que si la table ne la connaît pas ; sinon information « absent en amont ») ; (2) `ids_externes.2027etmoi` ≠ id amont de la table ; (3) `(code, motif)` du statut le plus récent ≠ amont, **sauf** si la fiche a un statut plus récent que l'amont (cas d'un retrait amont puis ré-annonce : conflit) ; (4) date de fiche plus récente que celle de l'amont pour le même `(code, motif)` = incohérence ; (5) pointeur de `dataset-datagouv.yaml` ≠ instantané le plus récent. **Information (jamais une erreur)** : même `(code, motif)` mais `source.url` ou `date` différents (dérive de source connue, 6 cas dans le jeu en ligne actuel : hollande, tondelier, philippe, attal, villepin, wauquiez). Sortie : liste d'écarts, un par ligne, `id : champ : fichier=… amont=…`, comme le demande D-04. Mettre le contrôle dans `npm test` (cohérent avec `fiches.test.ts`) ; l'exposer aussi en `import:datagouv -- --check` (aucun réseau, instantané local le plus récent) pour le RUNBOOK.

## 6. Le piège de D-05 : ce que fait le code aujourd'hui (question 6)

Cas : un nouveau candidat `declare` apparaît dans le jeu ; thème (ici santé) publié et dans `themes_ouverts` ; aucune mesure ni case pour cette personne. Trace faite en lisant le code **et** en l'exécutant (surcouche de fixture temporaire ajoutant `nouvelle-personne.yaml` au corpus de test, hors dépôt, harnais `executerPiege`) [VERIFIED] :

| Statut de la nouvelle personne | Mode `production` | Mode `preview` |
|-------------------------------|-------------------|----------------|
| (a) `brouillon` | **aucun diagnostic d'équité** : `statutRetenu(…, 'production')` est `undefined` (aucun `relu|publie`), donc hors périmètre (`equite.ts:35-46`) ; le filtre 09-15 écarte la personne (`vue.ts:284`) ; `check-dist` la contrôle par `CANDIDAT_NON_RELU_EN_PRODUCTION` (silencieux : elle n'est pas dans le dist) ; `cellulesAttendues` ne la compte pas | `EQUITE_CANDIDAT_MANQUANT` en **avertissement** (`equite.ts:107-115`, sévérité `warning` hors production) |
| (b) `relu` (relecteur et date posés) | `EQUITE_CANDIDAT_MANQUANT` **erreur** (`pointer /statut_relecture`, fichier du thème). Dans la build Astro, le chargeur échoue d'abord (« content-core : 1 erreur(s) de contenu, build interrompu », `astro-loader.ts:93`) ; s'il était contourné, `construireCorpus` lève (« aucune mesure visible ni case de couverture pour … », `vue.ts:330`) ; `check-dist` `CELLULES_INCOHERENTES` (`check-dist.ts:758`) si le dist avait été produit | `EQUITE_CANDIDAT_MANQUANT` en avertissement |

(`ID_NON_VERROUILLE` en erreur apparaît dans les deux cas si `ids.lock` n'est pas complété : l'import le complète lui-même.)

**Ce qui protège déjà le moment de la relecture** : `relecture marquer statut <id>` (`marquer.ts:140-155`) recharge le corpus en mode `production` après écriture et, si une erreur **nouvelle** apparaît, **restaure le fichier d'origine** (« 1 nouvelle(s) erreur(s) de validation après écriture : fichier restauré »). Marquer `relu` le statut de Riner sur un thème santé publié est donc refusé tant que `couverture/sante.yaml` n'a pas de case pour lui. `publier` (thème pas encore publié) refuse aussi « ni mesure ni case de couverture pour ce candidat du périmètre ». Ce que le code ne fait pas : prévenir **avant** la relecture, ni expliquer au relecteur pourquoi ; et aucun test ne le fige pour le cas « nouvelle personne ».

**Fixtures et tests existants à réutiliser**
- `tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT/attendu.json` (production, erreur) et `…--preview` (avertissement) : retirent la case d'un candidat **déjà relu** (`jean-imaginaire`) du corpus `tests/fixtures/corpus-valide`.
- `tests/rules/equite.test.ts` : ADR-041 (« un statut `declare` en brouillon ne fait pas entrer … ») lignes 65-80, WR-01 (renoncement brouillon plus récent) lignes 82-93 ; helper `equite(remplacer, mode)`.
- Harnais `tests/helpers/overlay.ts` : `construireRacine(spec, dossierSurcouche)` copie les fichiers d'un dossier de piège (nouveaux fichiers compris), `executerPiege`, `comparer`.
- `tests/pieges/pieges.test.ts` : rejoue **tout** dossier `tests/fixtures/pieges/<CODE>[--variante]` et exige un `attendu.json` bien formé ; `tests/pieges/couverture.test.ts:94` énumère les codes de pièges attendus.

**Piège à écrire (D-05)** : dossiers `tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-brouillon` et `--import-relu`, chacun avec une surcouche `src/content/candidats/nouvelle-personne.yaml` **et** une surcouche `ids.lock` complétée (sinon `ID_NON_VERROUILLE` pollue l'attendu). Attendus : `--import-brouillon` mode `production` → `[]` (le piège prouve que le brouillon est invisible) ; même surcouche en mode `preview` → `[EQUITE_CANDIDAT_MANQUANT warning]` (dossier séparé `--import-brouillon-preview`) ; `--import-relu` mode `production` → `[EQUITE_CANDIDAT_MANQUANT error]`. Un test unitaire dans `tests/rules/equite.test.ts` complète : même cas via `executerPiege` avec la surcouche. Note de nommage : le test `pieges.test.ts` accepte `<CODE>--<variante>` avec variante en minuscules et tirets ; une nouvelle variante n'exige aucun nouveau code dans le catalogue (`CATALOGUE`).
**Règle dédiée facultative** (recommandée, simple) : avertissement `STATUT_IMPORTE_SANS_COUVERTURE` (mode `production` et `preview`, toujours `warning`) : candidat dont le statut **le plus récent tous statuts confondus** est `declare|primaire` mais qui n'est pas dans le périmètre de production, sur un thème publié sans mesure ni case. Il rend visible *avant* la relecture ce que `marquer` refusera ensuite. Coût : une règle dans `rules/equite.ts` + entrée de catalogue + fixture ; à confier au planificateur comme tâche optionnelle (le piège D-05 est satisfait sans elle).

## 7. Ce que fait `import:datagouv` aujourd'hui et ce qui manque pour D-06 (question 7)

**Arguments** (`parseArgs` strict) : `--file <json>` (hors ligne, ≤ 5 Mo), `--url <https>` (défaut : la ressource stable `…/datasets/r/06237c53-…`), `--dry-run`, `--root <dossier>` (défaut cwd ; `RTP_CONTENT_ROOT` ignorée ; refuse `tests/fixtures` sans `--root`). Codes : 0, 1 (contenu refusé), 2 (usage).
**Réseau** : seulement sans `--file`, via `fetchSafe` (https, IP publiques, redirection 302 data.gouv → `2027etmoi.fr/data/candidats.json`, ETag lu). Aucun autre accès.
**Écritures** (hors `--dry-run`) : `data/import/<nom>.json` + `.meta.json` (sauf si l'instantané est déjà dans `data/import/`), `src/content/candidats/<id>.yaml` pour `cree` et `statut_ajoute`, `ids.lock`. Tout passe par `ecrireAtomique` (tmp + rename, garde realpath). Rien n'est écrit tant que tout n'est pas valide (conflits, fiche invalide, `ids.lock` refusé : sortie 1).
**Dry-run existant** : oui, `--dry-run` ; il charge tout, calcule les plans, valide, et n'écrit rien (vérifié dans le code ; exécuté sur le vrai dépôt : `git status` inchangé). Sortie réelle : `import : 59 ligne(s), 0 créé(s), 0 statut(s) ajouté(s), 59 inchangé(s), 0 absent(s) en amont, 0 conflit(s) — instantané 9f2fbc7930c0 du 2026-10-28, racine .` puis `simulation (--dry-run) : aucun fichier écrit`. Lignes intermédiaires : `créé : id (statut, date)`, `statut ajouté : id -> code (date)`, `note : id — …`, `absent en amont : …`, `conflit : id — …`, `avertissement : …`.
**Comment il a été lancé en Phase 3** : `npm run import:datagouv` en direct le 2026-11-03 (sha identique à celui de la recherche), 59 créés, second passage 59 inchangés, puis `validate` et `ids --check` (03-01-SUMMARY). Aucun statut n'avait changé : **le chemin `statut_ajoute` n'a jamais tourné sur le vrai corpus**, seulement en tests (`import-cli.test.ts:168`).

**Répétition réelle faite pour cette recherche** (lecture seule ; le JSON en ligne téléchargé dans un répertoire temporaire neuf, puis supprimé) [VERIFIED 2026-11-12] : `import:datagouv --file <jeu en ligne> --dry-run` → `import : identifiant(s) amont absent(s) de data/import/correspondances.yaml : lagarde, riner` puis « rien n'a été écrit », sortie 1. Le rapport est inutilisable tant que la table n'est pas complétée.

**Ce qui manque pour D-06**
1. **Tolérance aux identifiants inconnus** : en mode rapport, lister les « nouveaux (à ajouter à `correspondances.yaml`) » avec leurs champs amont (nom, parti, statut, date, source, `verifie_le`) et continuer sur les autres lignes ; le mode réel garde l'arrêt total.
2. **Changés, champ par champ** : afficher pour chaque fiche touchée `champ : ancien → nouveau` (statut `(code, motif, date)` ancien → nouveau ; dérive de source `url`, `date` ; `parti`/`site` non appliqués). Aujourd'hui seule la ligne « statut ajouté : id -> code (date) » et des notes en prose existent.
3. **Retirés** : « absent en amont » existe mais seulement pour les fiches ayant `ids_externes.2027etmoi` ; comparer aussi à l'**instantané précédent** (retirés entre deux instantanés), pas seulement aux fichiers.
4. **Conséquences sur les thèmes publiés** : rien aujourd'hui. À produire : pour chaque thème dans `themes_ouverts` et `publie`, (i) personnes dont le statut le plus récent (preview) entre dans le périmètre (`declare|primaire`) sans mesure ni case → « case à créer avant relecture » ; (ii) personnes déjà relues dont le nouveau statut les sortirait du périmètre → mesures publiées concernées et état de la case ; (iii) nombre de cellules attendu avant/après (même calcul que `cellulesAttendues`). Appeler `statutRetenu` et `dansPerimetre` avec le mode `preview` (ce que la relecture va voir) **et** `production` (ce que le site montre aujourd'hui).
5. **Sorties** : `--format markdown` (corps de PR, aucun qualificatif, seulement ids, codes, dates, URL) ; code de sortie 0 même si des nouveaux attendent une correspondance (le rapport est une information) mais 1 pour un vrai conflit.
6. **Nom de l'instantané à écrire** (`snapshotName`) et sha256 dans l'en-tête du rapport (la PR cite l'octet exact importé).

## 8. D-08 : un statut déjà relu change en amont (question 8)

**Ce que fait le code aujourd'hui** [VERIFIED: lecture + exécution de la simulation `ajouterStatutYaml` sur 59 fichiers] :
- `mergeFiche` renvoie `statuts: [...anciens, amont]` ; l'entrée amont naît `statut_relecture: brouillon`, sans `relecteur` ni `date_relecture` (`mapRow`, `datagouv.ts:187`). **L'ancienne entrée n'est jamais modifiée** : elle reste `relu`/`publie` avec son relecteur et sa date. Le journal `relecture/journal.jsonl` n'est pas écrit par l'import (clé `statut:<id>` : hachage de l'entrée retenue en preview, sans les champs de relecture).
- Outil de relecture (`etat.ts:241-252`) : cible `statut:<id>` = `statutRetenu(statuts, 'preview')` = la **nouvelle** entrée (plus récente) ; elle est `brouillon` → état « à relire », le reste augmente de 1. Si Erwan marque `relu`, l'entrée est modifiée sur place et le journal reçoit une nouvelle ligne (la dernière gagne). L'ancienne entrée n'est jamais « à revoir » (l'état « à revoir » vaut quand le **hachage du contenu relu diffère** de celui du journal, pas quand une entrée est ajoutée).
- **Production** : `statutRetenu(statuts, 'production')` ne retient que les `relu|publie` : l'ancienne entrée fait toujours foi. La personne **reste** dans le périmètre et sur le thème publié avec l'ancien statut. Aucun diagnostic ne s'allume (`EQUITE_*` : périmètre inchangé ; `PUBLICATION_*` : sans objet ; `check-dist` : cohérent). La build n'est pas bloquée. Le test `tests/rules/equite.test.ts:82-93` (WR-01) fige ce comportement : « un renoncement en brouillon plus récent ne sort pas un candidat relu du périmètre en production ».
- Preview : la nouvelle entrée fait foi ; un `renonce` fait sortir la personne du périmètre (la preview et la production divergent pendant ce temps : voulu par ADR-041).
- Quand Erwan marque `relu` un statut `renonce` : `marquer` refuse hors périmètre sans `--hors-perimetre` (D-06 de Phase 9) ; avec l'option, la personne sort du périmètre, **aucune erreur d'équité** (elle n'est plus attendue), la page du thème la liste parmi les personnes qui ne se présentent pas (`vue.ts:319`), ses mesures publiées ne s'affichent plus dans les cellules (seulement les cellules des personnes du périmètre) ; `publier` refuserait ensuite « candidat hors du périmètre d'équité (à retirer du thème …) » pour un thème non encore publié, mais pas pour un thème déjà publié.
- `EQUITE_COUVERTURE_INCOHERENTE` : ne se déclenche que si la case dit `mesures` sans mesure publiée, ou l'inverse. Un retrait de personne n'en provoque aucune (la case et les mesures restent cohérentes entre elles).

**Donc la formule de D-08 (« le statut repasse à relire ») est vraie pour l'outil de relecture, mais pas pour le site** : la production affiche l'ancien statut jusqu'à la relecture du nouveau. Risque : affichage périmé silencieux (par exemple une personne qui s'est retirée reste présentée comme déclarée), pas un blocage.

**Options et conséquences** (à trancher par Erwan)

| Option | Règle | Production avant relecture | Risques |
|--------|-------|---------------------------|---------|
| **A (état actuel)** | Ajout d'une entrée `brouillon`, rien d'autre | Ancien statut affiché, aucun blocage | Périmé en silence ; rien n'alerte la CI |
| **B (recommandée)** | A + signalement visible + règle d'exploitation : **tout changement de statut d'une personne d'un thème publié est relu dans la PR d'import avant fusion** | Idem A jusqu'à la fusion ; ensuite le statut relu fait foi au même moment que la fusion | Demande une relecture avant le 13 ; ne touche à aucun code de rendu |
| C | Erreur de production tant qu'un statut plus récent n'est pas relu (échec de build) | Build bloquée | Bloque **tous** les déploiements, retrait d'urgence compris, et la fusion de la PR brouillon que D-07 veut précisément pouvoir faire ; rejeté |
| D | Pastille « statut en cours de mise à jour » en production pour les personnes ayant un statut plus récent non relu | Visible au lecteur | Change le rendu des pages (src, tests dist, e2e) en pleine échéance ; à reporter après l'import |

**Règle la plus sûre recommandée : B**. Éléments : (1) le rapport d'import range ces personnes dans une section dédiée « statut déjà relu qui change » avec le thème et les mesures publiées concernées ; (2) un avertissement de validateur (toujours `warning`, jamais `error`, comme la sévérité asymétrique de l'ADR-060) `STATUT_PLUS_RECENT_NON_RELU` : « le statut le plus récent de X (`renonce`, 2026-12-11) n'est pas relu : la production affiche encore `declare` du 2026-10-14 » ; (3) RUNBOOK : ces personnes sont relues (`marquer statut <id> --hors-perimetre` pour un retrait) sur la branche d'import avant la fusion, puis seule une fusion unique change la production, derrière l'approbation du déploiement. Cette règle n'affaiblit ni D-07 (les nouvelles personnes restent invisibles) ni la garde d'équité. **Ne jamais** écrire sur l'ancienne entrée pour « repasser à relire » (rompt l'ajout seul, l'empreinte du journal et ADR-041).

## 9. D-09 : le gel du 13 au 15 décembre (question 9)

`scripts/garde-gel.ts` (lu en entier) calcule `FENETRES_GEL` à partir de `TOURS` (`src/lib/dates-tours.ts` : 2027-04-18 et 2027-05-02), une fenêtre = veille et lendemain de chaque tour, avec le champ numérique `tour`. Il est utilisé par le job `gel` de `.github/workflows/ci.yml` (ligne 262-290, nom « Garde de gel des scrutins (17-19 avril, 1-3 mai 2027) »), rejoué en première étape de `deploy` après approbation (ligne 399-408), et par `.github/workflows/rollback.yml`. Les tests : `tests/scripts/garde-gel.test.ts` (ligne 19 `deepEqual(FENETRES_GEL, [...])`, ligne 23 `length === TOURS.length`) ; `tests/repo/docs.test.ts` (lignes 11, 453, 633) lit `FENETRES_GEL` et la section « Gel des scrutins et retrait d'urgence » du RUNBOOK.

**Coût d'une fenêtre technique 13-15 décembre** : changer le type (`tour: number | null` + libellé), mettre à jour 2 assertions de `garde-gel.test.ts` et celles de `docs.test.ts`, le nom du job et le résumé (`tour ${f.tour}`), le RUNBOOK, et prévoir la **suppression** de la fenêtre après le 15 (une fenêtre morte dans un fichier de gel électoral). Elle bloquerait aussi les retours arrière (`rollback.yml`) sauf retrait d'urgence, et surtout **ne peut pas empêcher une fusion** : la garde ne coupe que le job `deploy`. L'approbation GitHub d'Erwan est déjà un frein humain par déploiement. Le seul effet réel d'une garde technique serait de faire échouer un déploiement approuvé par erreur le 14.
**Recommandation : RUNBOOK seul (D-09 tel quel)**, avec (a) une courte section « Gel d'import (13 au 15 décembre 2026) » dans le RUNBOOK : aucune fusion ni déploiement sauf retrait d'urgence par la voie existante (`retrait_urgence` + justification) ; (b) une assertion dans `tests/repo/docs.test.ts` qui exige la section et les trois dates, pour que la règle ne disparaisse pas ; (c) rappel que le job `deploy` demande une approbation (`Review deployments`) et qu'on **rejette** un run en attente le 13 (le RUNBOOK dit déjà de ne jamais le laisser pendre). Attention : `docs/RUNBOOK.md` est **modifié dans l'arbre de travail** par un autre agent au moment de cette recherche (`git status`) : faire cette édition en dernier, après commit de l'autre.

## 10. Interaction avec la relecture en cours (question 10)

**Comment l'import écrit le YAML** : `cree` → `renderYaml` (`stringify` avec `schema:'core', indent:2, indentSeq:true, lineWidth:0`, sans commentaire) pour un nouveau fichier ; `statut_ajoute` → `ajouterStatutYaml` (`parseDocument` + `seq.add` + `doc.toString`). **Préservation des champs de relecture démontrée** : j'ai appliqué `definirChamps` (le même écrivain que `relecture marquer`) à la dernière entrée de chacun des 59 fichiers (`statut_relecture: relu`, `relecteur`, `date_relecture`), puis `ajouterStatutYaml` : pour **les 59**, la sortie commence exactement par le texte relu (préfixe conservé octet pour octet) et ne fait qu'ajouter le nouveau bloc. Les champs de relecture des anciennes entrées sont donc intacts, et les commentaires aussi.

**Conflits probables.** Sur `relecture/sante`, `marquer statut` remplace la ligne `statut_relecture: brouillon` de l'entrée par `relu` et insère deux lignes (`relecteur`, `date_relecture`) ; pour un fichier à un seul statut cette ligne est **la dernière du fichier**. L'import ajoute son bloc juste après cette même ligne. Essai avec `git merge-file` (copies temporaires, hollande) : **conflit textuel certain** pour tout fichier à la fois relu sur la branche et modifié par l'import (hunks adjacents, résultat : conflit sur trois lignes) ; **aucun conflit** pour les fichiers que l'import ne modifie pas (59 − les changés) et pour les fichiers créés (nouveaux). Autres fichiers touchés par les deux : `couverture/sante.yaml` (cases, relecture) et éventuellement `ids.lock` (si la relecture l'étend : non), `relecture/journal.jsonl` (l'import ne le touche pas). `data/**`, `ATTRIBUTION.md`, `LICENSE`, `correspondances.yaml`, `dataset-datagouv.yaml` : jamais touchés par la relecture.
**Ordre qui évite tout conflit** : (1) fusionner la branche de relecture dans `main` d'abord (elle est censée l'être vers le 1er décembre) ; (2) créer `import/statuts-2026-12` depuis ce `main` ; (3) **lancer l'import sur cette branche** (il ajoute en fin de fichier, après les champs de relecture : propre) ; (4) si `main` avance après, ne pas fusionner `main` dans la branche : **réinitialiser la branche sur `main` et relancer l'import** (idempotent : même instantané, mêmes octets, même résultat), puis re-poser le `correspondances.yaml` et les fichiers édités à la main. Si la relecture n'est pas fusionnée avant l'import, ne pas importer : relire d'abord.
**Signalement exigé par CONTEXT** : un plan de cette phase qui modifie `src/lib/content-core/load.ts` (lu par l'outil de relecture) ou `scripts/lib/relecture/*` doit le dire. Les plans recommandés ici **ne touchent ni `load.ts` ni `scripts/lib/relecture/*`** (enveloppe dans un nouveau fichier ; `editer.ts` reste sur la liste blanche). Ils modifient `scripts/lib/datagouv.ts`, `scripts/import-datagouv.ts`, `scripts/archive-source.ts`, `scripts/lib/couverture.ts` et ajoutent des tests : aucun de ces fichiers n'est lu par l'outil de relecture, qui lit `src/content/**` et `config/publication.yml`. `docs/RUNBOOK.md` (modifié par un autre agent) : seulement en dernier.

## 11. Risques de calendrier (question 11)

**État du jeu** [VERIFIED: API data.gouv, 2026-11-12] : le jeu existe (id `6abf8836bbebbc5488a27e4e`, titre inchangé, créé le 2026-10-02, organisation `2027etmoi`, licence `lov2`) ; `frequency: weekly` ; `last_update` 2026-11-12 05:42 UTC ; une seule ressource, **même identifiant** `06237c53-76bd-4224-9805-418e125f0493` que dans `scripts/import-datagouv.ts:URL_PAR_DEFAUT`, format json, `schema: null` (le producteur ne déclare aucun schéma : la forme n'est garantie par aucun contrat, d'où l'utilité de `checkUpstream` strict), `filesize`/`checksum` null ; `quality.update_fulfilled_in_time: true`. Description (résumé) : 51 personnes, entrées = candidatures annoncées, pas validées, jusqu'à la liste du Conseil constitutionnel vers la mi-mars 2027. Le contenu réel : `mise_a_jour 2026-11-01`, **61 lignes**, clés de ligne identiques à celles du dépôt (aucun avertissement de `checkUpstream`), 2 nouveaux (`lagarde` `renonce`, `riner` `declare`), 0 retiré, 0 changement de code de statut, 6 sources/dates changées (même statut). Le schéma et l'identifiant de ressource n'ont donc **pas** changé depuis l'instantané du dépôt.

**À répéter avant l'ouverture (possible dès maintenant, rien à attendre)**
1. Dans un **worktree jetable** hors du dépôt de travail (`git worktree add /tmp/rtp-import-essai main`), sur une copie de `correspondances.yaml` complétée pour `lagarde` (motif à décider, par exemple `non_candidat`) et `riner`, lancer l'import réel avec `--file` sur le jeu en ligne, puis `validate --mode production`, `ids --check`, `npm test`, `build`, `check-dist`. Objectif : voir toute la CI de décembre en vrai (échecs des tests à compteurs 59/37/17/5, `ATTRIBUTION.md`, `LICENSE`, `dataset-datagouv.yaml`). Supprimer le worktree ensuite.
2. Le rapport `--dry-run` (nouveau format) sur ce jeu, pour relire sa forme avec Erwan.
3. La relecture simulée du cas Riner dans ce worktree : `marquer statut riner` doit être **refusé** sans case `santé`, puis réussir après ajout de la case (preuve de bout en bout de D-05).
4. Un essai de `git merge`/rebase d'une copie de `relecture/sante` avec la branche d'import jetable (§10).
5. Le retrait d'urgence existant (RUNBOOK, déjà exercé en Phase 9) reste la voie du gel.

**Ne peut se faire qu'aux vraies dates (10 au 13 décembre)** : télécharger l'instantané final (le jeu bouge chaque semaine ; celui de décembre n'existe pas encore) ; décider la table pour chaque nouvelle personne (nom, nom de tri, motif, type de source : décisions éditoriales d'Erwan) ; ouvrir la PR ; relecture d'Erwan du diff et `marquer` des statuts qui changent ; fusion ; approbation du déploiement ; mise à jour des compteurs en dur.
**Risques** : (1) 10 → 13 laisse 3 jours pour des décisions éditoriales sur un nombre inconnu de nouveaux (2 aujourd'hui, 4 semaines de dérive d'ici là) : prévoir une **marche de repli** : si le 13 au soir il reste des nouveaux non décidés, importer quand même (ils restent invisibles en production : D-07) ou différer ; (2) la fusion déclenche une demande d'approbation de déploiement (les chemins `src/` et `data/` comptent comme site) : approuver ou rejeter le jour même ; (3) le jeu peut régresser ou changer de forme entre l'essai et le jour J : relancer `--dry-run` le matin du 10 ; (4) le champ `mise_a_jour` n'est pas fiable (voir §5) ; (5) l'ouverture vers le 5 décembre (HEB-12/14, approbation) ne doit pas attendre l'import : l'import est après, et sans effet visible tant qu'il n'est pas relu.

## Common Pitfalls

### Pitfall 1: Contrôle de cohérence trop strict (dates, sources)
**What goes wrong:** D-04 compare la date et l'URL de source de chaque fiche à celles de l'amont ; dès l'import de décembre, 6 personnes (au moins) ont la même `(code, motif)` mais une source plus récente que la fiche, que l'import ne met volontairement pas à jour. Le test échoue en permanence.
**Why it happens:** `mergeFiche` ne réécrit jamais une source pour un statut inchangé (ajout seul, ne pas fausser l'historique).
**How to avoid:** comparer ids, `ids_externes`, `(code, motif)` ; traiter la dérive de source comme information imprimée.
**Warning signs:** note « source amont modifiée (non appliquée : même statut) » dans le rapport.

### Pitfall 2: Arrêt total sur un identifiant inconnu rend la répétition inutile
**What goes wrong:** `scripts/import-datagouv.ts:130-135` sort en 1 au premier jeu de nouveaux ids ; on n'obtient ni rapport ni diff.
**How to avoid:** mode rapport tolérant (§7.1) ; mode réel inchangé (jamais de découpage deviné).

### Pitfall 3: Tests et fichiers qui portent un compteur ou une date de l'instantané
**What goes wrong:** après l'import (61 lignes), `tests/corpus/dataset-datagouv.test.ts:58-77` (59, 37/17/5), `tests/dist/cas/methode.cas.ts:133`, `ATTRIBUTION.md`, `LICENSE:81` et `data/dataset-datagouv.yaml` échouent ou mentent.
**How to avoid:** les lister dans la tâche d'import ; idéalement faire lire ces nombres au lieu de les coder (le test méthode lit déjà `loadDatasetDatagouv`, seul le test du dataset code les nombres en dur).

### Pitfall 4: Conflit avec la branche de relecture
**What goes wrong:** voir §10. **How to avoid:** relecture fusionnée d'abord ; import relancé, jamais fusionné.

### Pitfall 5: Une nouvelle personne déclarée bloque la build le jour où on la relit
**What goes wrong:** `EQUITE_CANDIDAT_MANQUANT` en production (erreur) dès que le statut est `relu` sans case ; en plein gel, le déploiement serait bloqué.
**How to avoid:** créer la case de couverture (`programme_non_publie` ou `non_precise` avec sources) **avant** de relire le statut ; `marquer` le refuse sinon (restaure le fichier). La répétition §11.3 le prouve.

### Pitfall 6: Alias bénin accepté en silence
**What goes wrong:** voir §2 : `import` n'examine pas un fichier `inchange`. **How to avoid:** `lireYamlPlafonne` sur **chaque** fichier lu, y compris ceux dont l'action sera `inchange`.

## Code Examples

### Recherche des écarts D-04 (module pur)
```typescript
// scripts/lib/instantane.ts — forme proposée ; réutilise statutLePlusRecent et mapRow existants
export interface Ecart { id: string; champ: string; fichier: string; amont: string }
export function comparerInstantane(rows: UpstreamRow[], table: Record<string, Correspondance>, fiches: Map<string, Record<string, unknown>>): { erreurs: Ecart[]; infos: Ecart[] } {
  const erreurs: Ecart[] = [];
  const infos: Ecart[] = [];
  for (const row of rows) {
    const m = mapRow(row, table);                 // lève UnknownUpstreamIdsError si la table ne connaît pas l'id
    const id = String(m.id);
    const f = fiches.get(id);
    if (f === undefined) { erreurs.push({ id, champ: 'fiche', fichier: '(absente)', amont: row.statut }); continue; }
    const dernier = statutLePlusRecent(f.statuts as unknown[]);
    const a = (m.statuts as Record<string, unknown>[])[0]!;
    if (dernier.code !== a.code || dernier.motif !== a.motif) erreurs.push({ id, champ: 'statut', fichier: `${dernier.code}/${dernier.motif ?? '-'}`, amont: `${a.code}/${a.motif ?? '-'}` });
    else if (dernier.date !== a.date || (dernier.source as Record<string, unknown>).url !== (a.source as Record<string, unknown>).url) infos.push({ id, champ: 'source', fichier: String(dernier.date), amont: String(a.date) });
  }
  return { erreurs, infos };
}
```

### Piège D-05 (attendu.json, variante relu)
```json
{
  "piege": "D-05 : l'import ajoute un candidat déclaré, relu, à un thème publié sans mesure ni case",
  "regle": "REGLE-08",
  "mode": "production",
  "remplacer": [],
  "supprimer": [],
  "attendu": [
    { "code": "EQUITE_CANDIDAT_MANQUANT", "severite": "error", "fichier": "src/content/themes/logement.yaml", "pointer": "/statut_relecture", "ligne": 11 }
  ]
}
```
(avec `src/content/candidats/nouvelle-personne.yaml` et un `ids.lock` complété dans le dossier du piège ; ma surcouche de simulation a donné exactement ce diagnostic, plus `ID_NON_VERROUILLE` quand `ids.lock` n'était pas complété.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `yaml.parse` direct avec défaut `maxAliasCount: 100` dans les outils | `PARSE_OPTIONS` + visite des alias (0 alias) de content-core | Phase 1 (content-core, DATA-07) ; dette W6 signalée à l'audit v1.0 | Un seul plafond ; IMP-01 ferme l'écart côté scripts |
| Statut périmètre = dernier statut de la liste | `statutRetenu` : le plus récent par date, brouillons exclus en production | ADR-041 (WR-01/WR-12), Phase 7 à 9 | Un statut importé est invisible tant qu'il n'est pas relu |
| Relecture manuelle dans le YAML | `relecture marquer` par insertion de lignes aux positions des nœuds + validation de production avec restauration | Phase 9, ADR-059 | `marquer` est lui-même un garde-fou d'équité |
| Instantané lu « tel quel » | `loadDatasetDatagouv` : sha256 vérifié contre la méta, comptes calculés | Phase 5 (WR-07) | Seul le pointeur `instantane:` est manuel |

**Deprecated/outdated:** la phrase du README d'import « Une fiche modifiée est réécrite par l'importeur dans son rendu canonique » (le code édite en place) ; le test `fiches.test.ts` « tant que la relecture n'est pas ouverte » est mort (`relecture_ouverte: true`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lagarde recevra le motif `non_candidat` (aucune décision éditoriale n'existe) | §11 | Mauvais motif affiché plus tard ; décision d'Erwan à la table, pas du code |
| A2 | Le jeu data.gouv continuera de changer chaque semaine ; à la date réelle il contiendra un nombre de nouveaux supérieur à 2 | §11 | Plus de décisions de table le 10 au 13 |
| A3 | La relecture santé sera fusionnée dans `main` avant le 10 décembre | §10 | Si non, l'import doit attendre ou se faire en double ; le plan de fusion change |
| A4 | Une fusion de PR touchant `data/` ou `src/` déclenche une demande d'approbation de déploiement (chemins hors `CHEMINS_HORS_SITE`) | §11 | Lu dans le RUNBOOK et le workflow, pas exécuté ici |
| A5 | `marquer statut` pour un retrait demande `--hors-perimetre` ; Erwan est d'accord pour l'utiliser dans la PR d'import | §8 | Procédure RUNBOOK à adapter |
| A6 | Les sources de statut (`statuts[].source`) n'ont pas à être archivées (champ `archive` optionnel) | §4 | Si la politique change, l'import devrait archiver Riner/Lagarde ; non vérifié auprès d'Erwan |

## Open Questions (RESOLVED)

1. **D-08 : quelle règle pour un statut déjà relu qui change ?** — Ce que l'on sait : l'ancien reste affiché en production jusqu'à la relecture du nouveau (aucun blocage). — Ce qui manque : préférence d'Erwan entre A (état actuel), B (recommandée : relire dans la PR + avertissement) et D (pastille, après l'import). — Recommandation : B.
   - RESOLVED : défaut retenu B (relecture dans la PR d'import avant fusion + avertissement `STATUT_PLUS_RECENT_NON_RELU`), CONTEXT `research_resolutions` ; Erwan confirme en 10-04 T1 (par silence au 2026-12-07 : B).
2. **D-09 : RUNBOOK seul ou garde technique ?** — La garde technique ne bloque que le déploiement, pas la fusion, et coûte 6 fichiers. — Recommandation : RUNBOOK + assertion de test.
   - RESOLVED : défaut retenu RUNBOOK seul + assertion dans `tests/repo/docs.test.ts`, `scripts/garde-gel.ts` inchangé ; Erwan confirme en 10-04 T1 (par silence au 2026-12-07 : RUNBOOK seul).
3. **Table pour les nouveaux** : Erwan valide-t-il `riner` (nom_tri `Riner`, type de source `presse`) et `lagarde` (`renonce` + motif) ? — À décider le jour de l'import ; peut être préparé dès maintenant dans une copie.
   - RESOLVED : aucune valeur par défaut ; chaque entrée est écrite par Erwan lui-même le jour de l'import, en 10-05 T2 ; la répétition de 10-03 n'utilise que des valeurs d'essai fictives, jamais conservées.
4. **Avertissement `STATUT_PLUS_RECENT_NON_RELU` et règle `STATUT_IMPORTE_SANS_COUVERTURE`** : les inclure dans le lot de cette phase (touchent `rules/equite.ts` et le catalogue, donc le validateur lu par la relecture) ou se contenter du rapport ? — Recommandation : une seule règle d'avertissement, dans la vague 2, avec fixture.
   - RESOLVED : une seule règle d'avertissement, `STATUT_PLUS_RECENT_NON_RELU`, construite en 10-04 T2 si Erwan retient B en 10-04 T1 ; `STATUT_IMPORTE_SANS_COUVERTURE` non retenue (la section « Conséquences sur les thèmes publiés » du rapport de 10-03 la remplace).
5. **Fusion de la PR brouillon avant relecture** (D-07 la veut) : acceptable alors que chaque fusion exige une approbation de déploiement ? — Recommandation : oui, mais approuver le jour même ou rejeter.
   - RESOLVED : défaut retenu oui (fusion avec statuts brouillon invisibles, déploiement approuvé ou rejeté le jour même) ; Erwan confirme en 10-04 T1 (par silence : non, valeur la plus restrictive).
6. **Le test D-04 doit-il aussi échouer pour une personne « absente en amont »** ? — Recommandation : non, information (la fiche reste, son id est verrouillé).
   - RESOLVED : défaut retenu non, information seulement (CONTEXT `research_resolutions`, D-04 précisée) ; appliqué en 10-02 T1, sans décision d'Erwan requise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 via fnm | tous les scripts et tests | ✓ | 24.22.2 | — |
| `git` (worktree, merge-file) | essai de répétition, ordre de fusion | ✓ | local | — |
| Accès réseau à data.gouv.fr / 2027etmoi.fr | import réel, répétition en ligne | ✓ (consulté le 2026-11-12) | HTTP 200, 66 922 octets | `--file` sur un instantané local |
| `gh` CLI | vérifier la CI après push | non testé ici | — | — |
| Playwright / Chromium | seulement pour `npm run e2e` (non requis par la phase) | non testé | — | — |

**Missing dependencies with no fallback:** aucune.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24.22.2) ; Playwright inutile pour cette phase |
| Config file | aucun ; `package.json` : `"test": "TZ=Europe/Paris node --test \"tests/**/*.test.ts\""` |
| Quick run command | `fnm exec --using=24 node --test tests/import/*.test.ts tests/repo/yaml-plafonne.test.ts tests/corpus/instantane-coherence.test.ts tests/rules/equite.test.ts tests/pieges/pieges.test.ts` |
| Full suite command | `fnm exec --using=24 npm test` |
| Validation du corpus | `fnm exec --using=24 node scripts/validate.ts --root . --mode production` ; `node scripts/ids.ts --root . --check` |

Base de départ vérifiée : 101 tests verts en 13,6 s (import, fiches, dataset, garde-gel, équité) ; `validate` production : 391 fichiers, 0 erreur, 25 avertissements.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | `lireYamlPlafonne` refuse alias (1 seul), bombe, doublon, racine non objet, avec `fichier:ligne:col` ; limite l'affichage à 3 | unit | `node --test tests/content-core/yaml-plafonne.test.ts` | ❌ Wave 0 |
| IMP-01 | l'import refuse un fichier candidat avec un alias (sortie 1, aucun fichier écrit) et un doublon (message français avec ligne) | intégration CLI (tmp) | `node --test tests/import/import-cli.test.ts` (cas à ajouter) | ✅ à étendre |
| IMP-01 | `archive --wayback-missing` signale une source illisible avec raison au lieu de l'ignorer | intégration CLI (tmp) | `node --test tests/archive/archive-e2e.test.ts` (cas à ajouter) | ✅ à étendre |
| IMP-01 | `lireCouverture` donne ligne et colonne ; `data/couverture-themes.yaml` toujours sans problème | unit + corpus | `node --test tests/corpus/couverture-themes.test.ts tests/couverture/*.test.ts` | ✅ à étendre |
| IMP-01 | aucun nouvel appel direct de parse hors liste blanche, liste sans entrée périmée | repo | `node --test tests/repo/yaml-plafonne.test.ts` | ❌ Wave 0 |
| IMP-02 | `comparerInstantane` : 0 erreur sur le dépôt réel ; erreurs sur id manquant, `ids_externes` faux, statut différent, pointeur périmé ; dérive de source = info | unit + corpus | `node --test tests/corpus/instantane-coherence.test.ts` | ❌ Wave 0 |
| IMP-02 | piège D-05 : brouillon invisible en production, avertissement en preview, erreur dès que relu | piège | `node --test tests/pieges/pieges.test.ts tests/rules/equite.test.ts` | ✅ à étendre (dossiers + cas) |
| IMP-02 | `marquer statut` refuse un statut `relu` de nouvelle personne sans case et restaure le fichier | intégration | `node --test tests/relecture/marquer.test.ts` | ✅ à étendre |
| IMP-03 | rapport : nouveaux inconnus listés sans arrêt, changés champ par champ, retirés, conséquences thèmes publiés, sortie Markdown déterministe | unit | `node --test tests/import/rapport.test.ts` | ❌ Wave 0 |
| IMP-03 | `--dry-run` n'écrit aucun octet (arbre temporaire comparé avant/après) y compris avec nouveaux ids | intégration CLI | `node --test tests/import/import-cli.test.ts` | ✅ à étendre (cas existant ligne 143) |
| IMP-03 | l'import ajoute en fin de fichier sans modifier un octet du préfixe, champs de relecture compris | unit | `node --test tests/import/datagouv.test.ts` (cas à ajouter, déjà vérifié à la main sur 59 fichiers) | ✅ à étendre |
| IMP-03 | RUNBOOK contient la section du gel d'import et ses trois dates | repo | `node --test tests/repo/docs.test.ts` | ✅ à étendre |
| IMP-03 | PR d'import : `validate` production 0 erreur, `ids --check`, `npm test`, build + `check-dist` production | CI | job `verifier` de `.github/workflows/ci.yml` | ✅ |

### Sampling Rate
- **Per task commit:** `fnm exec --using=24 node scripts/validate.ts --root . --mode production && node --test <fichiers touchés>`
- **Per wave merge:** `fnm exec --using=24 npm test` puis `npm run check`
- **Phase gate:** `npm test`, `check-dist` en production sur une build du vrai corpus, CI verte sur la PR d'import, répétition en worktree jetable jouée de bout en bout (§11.1), avant `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/content-core/yaml-plafonne.test.ts` : IMP-01 (unité)
- [ ] `tests/repo/yaml-plafonne.test.ts` : D-03
- [ ] `tests/corpus/instantane-coherence.test.ts` : D-04
- [ ] `tests/import/rapport.test.ts` : D-06
- [ ] dossiers `tests/fixtures/pieges/EQUITE_CANDIDAT_MANQUANT--import-*` (surcouches candidat + `ids.lock`) : D-05
- [ ] Aucune installation de framework.

## Security Domain

`security_enforcement` n'est pas désactivé dans `.planning/config.json` : section incluse.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Aucune authentification ; pas d'écriture serveur dans la phase |
| V3 Session Management | no | — |
| V4 Access Control | yes (dépôt) | PR relue par Erwan ; fusion par lui ou accord écrit ; Environment `production` avec relecteur requis (approbation de déploiement) |
| V5 Input Validation | yes | `checkUpstream` (forme stricte du JSON amont, caractères de contrôle refusés, URL https), `lireCorrespondances`, `lireYamlPlafonne`, Ajv `validateYamlText` avant écriture |
| V6 Cryptography | yes (intégrité) | SHA-256 de l'instantané (`node:crypto`), vérifié contre la méta par `loadDatasetDatagouv` ; aucune cryptographie maison |
| V12 Files/Resources | yes | `readContained` / `checkContained` (symlink, hors racine, non régulier), `ecrireAtomique` (tmp + rename), plafond 5 Mo |
| V14 Config / SSRF | yes | `fetchSafe` : https seul, adresses publiques, redirections revérifiées, délai 30 s |

### Known Threat Patterns for ce stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bombe d'alias / « billion laughs » dans un YAML édité | Denial of service | `lireYamlPlafonne` (0 alias) ; test de dépôt D-03 |
| Jeu amont malformé ou hostile (caractères de contrôle, URL non https, clés inconnues) | Tampering | `checkUpstream` strict ; `bloc`/`propositions`/`statut_detail` jamais lus ; `CHAMP_NON_IMPORTABLE` |
| SSRF par `--url` | Information disclosure | `fetchSafe` (`ADRESSE_PRIVEE`) |
| Écriture hors racine, lien symbolique | Tampering | `ecrireAtomique` + `checkContained` |
| Publication d'un statut non relu | Tampering / réputation | ADR-041 (production ne retient que `relu|publie`) ; `CANDIDAT_NON_RELU_EN_PRODUCTION` dans `check-dist` |
| Données personnelles dans le dépôt public (corps de PR, rapport) | Information disclosure | Le rapport ne cite que ids, codes, dates, URL publiques du jeu ; aucun qualificatif ; pas d'adresse ni de contact |
| Surprise de gel (fusion le 14) | Repudiation / disponibilité | RUNBOOK + approbation de déploiement ; retrait d'urgence existant |

## Plan / Wave Split

Le chemin critique est humain (décisions de table et relecture d'Erwan du 10 au 13). Tout le code peut précéder. Un plan à la fois sur `main` (CONTEXT) ; les vagues sont des groupes d'ordre, pas de parallélisme d'exécution.

| Plan | Wave | Contenu | Dépend de | Humain |
|------|------|---------|-----------|--------|
| **10-01 IMP-01 plafond YAML** | 1 | `src/lib/content-core/yaml-plafonne.ts` (+ test unitaire) ; migration des sites 1 à 6 du §1 (import 3 appels, archive 1, `ajouterStatutYaml`, `lireCouverture` avec nom de fichier) ; l'import valide aussi les fichiers `inchange` ; `sourcesSansWayback` signale la raison ; `tests/repo/yaml-plafonne.test.ts` avec la liste blanche de 7 ; cas CLI (alias bénin, doublon) | — | — |
| **10-02 IMP-02 cohérence et piège** | 1 (après 10-01 : même fichiers de test import) | `scripts/lib/instantane.ts` + `tests/corpus/instantane-coherence.test.ts` + option `import:datagouv -- --check` ; fixtures `EQUITE_CANDIDAT_MANQUANT--import-*` ; cas `tests/rules/equite.test.ts` ; cas `marquer` refusé sans case ; **optionnel** : règle d'avertissement `STATUT_PLUS_RECENT_NON_RELU` + catalogue (touche le validateur : le signaler) | — | Question 4 d'Erwan |
| **10-03 IMP-03 répétition et rapport** | 2 (avant l'ouverture) | `scripts/lib/rapport-import.ts`, mode rapport tolérant aux ids inconnus, `--format markdown`, section « conséquences sur les thèmes publiés » et « statut déjà relu qui change » ; tests ; corrections du README d'import ; **répétition en worktree jetable** sur le jeu en ligne (rapport joint au SUMMARY) | 10-01, 10-02 | Erwan relit la forme du rapport |
| **10-04 Import réel et gel** | 3 (10 au 13 décembre, après l'ouverture et la fusion de la relecture) | RUNBOOK (« Gel d'import », procédure d'import, ordre de fusion) + assertion `docs.test.ts` (dernière édition, après les autres agents) ; branche `import/statuts-2026-12` depuis `main` à jour ; `correspondances.yaml` ; import réel ; mise à jour de `ATTRIBUTION.md`, `LICENSE`, `data/dataset-datagouv.yaml`, tests à compteurs ; PR avec le rapport pour corps ; CI verte ; relecture d'Erwan (`marquer` pour les statuts qui changent, cases créées avant) ; fusion et approbation | 10-03 ; Phase 9 ouverte | **Erwan : table, relecture du diff, fusion, approbation** |

**Peut tourner maintenant (pendant la relecture)** : 10-01, 10-02, 10-03 (code et tests seulement ; aucun fichier de `src/content/**`, `data/**` ni `archives/**` modifié ; la répétition se fait hors du dépôt de travail). **Doit attendre le 10 décembre** : l'import réel, la table des nouveaux, la mise à jour des compteurs en dur et des fichiers d'attribution, la relecture et la fusion.

Sorties de checkpoint : après 10-03, un SUMMARY avec le rapport de répétition ; avant 10-04, accord d'Erwan sur D-08 (B) et D-09 (RUNBOOK).

## Sources

### Primary (HIGH confidence)
- Code du dépôt lu en entier : `scripts/import-datagouv.ts`, `scripts/lib/datagouv.ts`, `src/lib/content-core/load.ts`, `src/lib/content-core/rules/equite.ts`, `publication.ts`, `src/lib/corpus/vue.ts`, `src/lib/dataset-datagouv.ts`, `scripts/lib/relecture/{editer,etat,registre}.ts`, `commandes/{marquer,publier}.ts`, `scripts/garde-gel.ts`, `scripts/lib/check-dist.ts` (extraits), `scripts/archive-source.ts` (extraits), `scripts/lib/couverture.ts` (extrait)
- Documents du dépôt : `.planning/phases/10-import-de-d-cembre/10-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `CLAUDE.md`, `data/import/README.md`, `docs/RUNBOOK.md` (sections import et gel), `docs/ARCHITECTURE.md` (ADR-041, 059, 060), `.planning/research/PITFALLS.md` (Pitfall 14), `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (W6), `03-01-SUMMARY.md`, `09-15-SUMMARY.md`, `09-RESEARCH.md` (modèle)
- Exécutions en lecture seule sous Node 24 (2026-11-12) : `import:datagouv --dry-run` sur le vrai dépôt et sur le jeu en ligne ; `validate` (production et preview) ; 101 tests ciblés ; comparaison instantané/fiches ; simulations dans `/tmp` supprimées (bombe d'alias, doublon, alias bénin, surcouche D-05, `ajouterStatutYaml` sur 59 fichiers, `git merge-file`)
- API data.gouv.fr `GET /api/1/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources/` (consultée le 2026-11-12) et ressource `06237c53-76bd-4224-9805-418e125f0493` (téléchargée en lecture seule)

### Secondary (MEDIUM confidence)
- Fréquence de mise à jour « weekly » : champ du jeu, non garanti par un engagement du producteur

### Tertiary (LOW confidence)
- Aucune

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (aucun nouveau paquet ; versions lues dans `package.json`)
- Architecture: HIGH (tout est tracé dans le code et exécuté)
- Pitfalls: HIGH pour 1 à 6 (reproduits) ; MEDIUM pour les risques de calendrier (dépendent du jeu amont)

**Research date:** 2026-11-12
**Valid until:** 2026-11-26 pour l'état du jeu amont (il change chaque semaine) ; 30 jours pour le code (sous réserve des commits des autres plans de Phase 9)
