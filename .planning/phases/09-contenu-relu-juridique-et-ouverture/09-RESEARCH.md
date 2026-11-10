# Phase 9: Contenu relu, juridique et ouverture - Research

**Researched:** 2026-11-10
**Domain:** relecture éditoriale d'un corpus YAML statique, garde de publication, droit français de l'édition en ligne (LCEN / SREN, RGPD, Code électoral), mise en production sur un Caddy partagé
**Confidence:** MEDIUM-HIGH (code et état du dépôt : HIGH, vérifié par exécution ; droit : MEDIUM, textes lus sur Légifrance via un résumeur, jamais mot pour mot ; deux points juridiques à trancher par Erwan)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Implementation Decisions (Erwan, 2026-11-10)**

*Contact (LEG-01)*
- **D-01:** Adresse publique `contact@reveletonprog.fr`, boîte ou redirection créée par Erwan chez IONOS (les enregistrements MX, SPF, DKIM, DMARC IONOS du domaine sont conservés). `config/site.yml` passe de l'adresse provisoire à celle-ci ; test de bout en bout (envoi depuis l'extérieur, réception, réponse) consigné avant l'ouverture.

*Régime d'éditeur (LEG-01)*
- **D-02:** Nom publié : les Mentions légales nomment « Erwan Henry » éditeur et directeur de la publication (déjà le cas), sans adresse postale. Ne pas basculer vers le régime « éditeur non professionnel ». L'identité d'Erwan n'a pas besoin d'être transmise à Hetzner pour ce régime ; vérifier ce que dit le texte en vigueur (LCEN art. 1-1 et 6) et l'écrire exactement.

*Juridique (LEG-02)*
- **D-03:** Pas de juriste avant l'ouverture : l'orchestrateur rédige une note de risques (`docs/RISQUES-JURIDIQUES.md` ou équivalent) couvrant au moins : régime et identification de l'éditeur, base légale exacte du droit de réponse en ligne après la loi SREN (article à vérifier sur Légifrance : 6 IV ou 1-1 LCEN), délais (trois mois, trois jours), journaux serveur et IP (RGPD, durée, masquage, journal d'erreurs du conteneur IN-06), `localStorage` (exemption CNIL), périodes électorales (sondages loi 77-808 art. 11, propagande L49 et gel), neutralité et droit de réponse des candidats. Erwan la signe (date et mention « risque accepté ») ; un juriste pourra relire après l'ouverture.

*Relecture (PUB-01, PUB-03)*
- **D-04:** Page de relecture locale (jamais déployée, jamais dans le dist public) : servie sur le Mac d'Erwan, elle montre pour chaque mesure du thème santé les quatre rédactions à côté du `texte_source` et de l'extrait archivé ; Erwan valide ou écrit une note de correction. Une commande écrit le statut `relu` avec relecteur et date dans le YAML de la mesure (et la couverture si besoin), sans autre modification ; les corrections de texte restent des modifications YAML manuelles ou proposées, jamais automatiques. Liste « ce qui reste à relire » disponible en terminal.
- **D-05:** Chaque mesure publiée affiche son relecteur et sa date de relecture (PUB-03).
- **D-06:** Un seul thème (santé) pour l'ouverture ; travail et Europe et monde suivent après.

*Publication (PUB-02, PUB-04)*
- **D-07:** La production n'affiche que le thème entièrement relu pour tous les candidats de son périmètre (statuts de candidature relus inclus : en production, seuls les statuts `relu`/`publie` comptent, ADR-041). Garde d'équité existante + liste blanche de publication explicite (quels thèmes sont ouverts).
- **D-08:** PUB-04 : relancer Wayback pour les sources Batho (W9) ; exception motivée pour Rohou (données personnelles), acceptée par la règle `ARCHIVE_WAYBACK_ABSENTE`.

*Ouverture (LEG-03, DETTE-04)*
- **D-09:** `config/hebergeur.yml` passe à `actif` ; `RTP_DEPLOIEMENT=1` pour la cible production ; bloc Caddy du site public (nom nu et `www`) installé (validate puis reload, avec l'accord d'Erwan pour chaque écriture serveur, comme en Phase 8) ; HSTS allongé après stabilisation ; `RTP_HOTE` du battement passé au domaine public ; hôte technique `essai` retiré à l'ouverture (ou gardé protégé : à trancher dans le plan).
- **D-10:** RUNBOOK : retrait d'urgence d'une mesure en moins d'une heure ; calendrier de gel 2027 (déjà dans le workflow) ; le journal d'audit et ses empreintes sont refaits sur la build déployée.
- **D-11:** Points reportés de la Phase 8 à traiter ici : phrase des Mentions légales sur le journal d'erreurs du conteneur (IN-06) ; dates de couverture contradictoires (8 cas WR-05 de la Phase 7) dans la relecture ; sonde externe (D1) si Erwan choisit un déclencheur externe ; `favicon.ico`.

### Claude's Discretion
- Technologie de la page de relecture (petit serveur Node sans dépendance, comme `e2e/serveur.ts`), découpage en plans, ordre (relecture d'Erwan en parallèle du juridique et de l'infra).

### Deferred Ideas (OUT OF SCOPE)
- Aucune section « Deferred Ideas » dans CONTEXT.md. D-06 repousse après l'ouverture les thèmes travail et Europe et monde (ne rien relire ni publier pour eux en Phase 9). La Phase 10 (import de décembre) est hors périmètre.

### Contraintes (section `<constraints>` de CONTEXT.md)
- Le contenu (`src/content/**`) n'est modifié que par l'outil de relecture (statut, relecteur, date) ou par des corrections qu'Erwan valide ; aucun agent ne corrige un texte de mesure de lui-même.
- Aucun secret dans le dépôt public ; écritures serveur par la session principale avec l'accord d'Erwan.
- Node 24 via `fnm exec --using=24` ; pas de nouvelle dépendance npm sans justification.
- Un push qui touche le site demande une approbation de déploiement (cible `essai` jusqu'à l'ouverture).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Commande qui liste ce qui reste à relire et passe une mesure en `relu` avec relecteur et date | §1 (champs déjà dans les schémas, aucun bump), §2 (outil `scripts/relecture.ts`), piège `PILOTE_NON_BROUILLON` |
| PUB-02 | Un thème entièrement relu est publié en production, aucun brouillon ; garde d'équité + liste blanche | §3 (`config/publication.yml`, règle, check-dist), dry-run mené : 0 erreur après 3 corrections |
| PUB-03 | Chaque mesure publiée affiche relecteur et date | §3 (`Mesure.astro` n'affiche rien aujourd'hui ; code check-dist à ajouter) |
| PUB-04 | Sources publiées : copie Wayback ou exception motivée acceptée par la règle | §6 (Batho : URL changée, snapshot existant ; Rohou : snapshot déjà présent ; mécanisme d'exception) |
| LEG-01 | Mentions finales : régime d'éditeur, hébergeur actif, contact testé, politique de journal, base du droit de réponse | §4 (conflit D-02 / LCEN art. 1-1 I 1° à trancher), §5 |
| LEG-02 | Relecture juridique ou risque accepté par écrit | §4 (structure de `docs/RISQUES-JURIDIQUES.md`) |
| LEG-03 | RUNBOOK : retrait d'urgence < 1 h et calendrier de gel | §5 (piège : retrait de la seule mesure d'un candidat fait échouer la CI), §7 |
| DETTE-04 | Journal d'audit et empreintes refaits sur la build réellement en ligne | §5.7 |
</phase_requirements>

## Summary

L'essentiel de la mécanique existe déjà et a été vérifié par un **dry-run réel** (copie de `src/content` dans `/tmp/rtp-dry`, santé passée en `publie`, 37 statuts `declare` en `relu`, build production et `check-dist`) : après seulement trois corrections, `validate --mode production` donne 0 erreur et `check-dist` 0 erreur (66 pages, un seul thème). Les trois blocages sont (1) `ARCHIVE_WAYBACK_ABSENTE` pour `delphine-batho-priorite-1` et `erwan-rohou-programme-mei` (seules sources de santé concernées), (2) un statut `renonce` de Wauquiez à date partielle `2026-07` (un statut non brouillon exige une date complète ; sans objet si les statuts `renonce` restent en brouillon), (3) rien d'autre. Les 15 avertissements `LISIBILITE_ENFANT_FAIBLE` de santé et les 3 `COUVERTURE_VERIFIEE_AVANT_SOURCE` de santé ne bloquent pas la CI.

Le modèle de données **n'exige aucune montée de `version_schema`** : `statut_relecture`, `relecteur`, `date_relecture` existent déjà sur les mesures, les thèmes et chaque entrée de `statuts[]` (avec les `if/then` qui les exigent dès `relu`). La couverture utilise `verifie_le` / `verifie_par`. En revanche trois points structurants sont absents ou piégeux : (a) en production seules les mesures `publie` sont affichées, donc il faut une **deuxième transition `relu` vers `publie`** après la relecture (D-04 ne parle que de `relu`) ; (b) `data/couverture-themes.yaml` porte `pilote.relecture_ouverte: false` et la règle `PILOTE_NON_BROUILLON` refuse tout statut non brouillon tant que ce drapeau est faux (deux tests l'épinglent à `false`) ; (c) l'écriture YAML par `Document.toString()` **n'est pas stable octet pour octet** (25 mesures sur 134 sont reformatées même avec `lineWidth: 0`), il faut donc une édition ciblée par offsets, pas une re-sérialisation.

Deux points juridiques dépassent la rédaction : **D-02 est contradictoire avec le texte lu** (art. 1-1 I 1° LCEN : une personne physique éditrice doit publier « nom, prénoms, domicile et numéro de téléphone » ; la dispense d'adresse n'existe que par le II, régime non professionnel avec identité remise à l'hébergeur) et le sens de « professionnel » pour un freelance est incertain. Et le droit de réponse repose bien sur l'**art. 1-1 III** (et non 6 IV : la recommandation de `PITFALLS.md` est périmée), le décret 2007-1527 citant encore « IV de l'article 6 » dans ses visas.

**Primary recommendation:** découper en 7 plans, en lançant tout de suite l'outillage de relecture (plan 1) pour que la relecture d'Erwan (23 nov. - 1er déc.) coure en parallèle des plans juridique, W9 et infra ; garder l'ouverture (hébergeur `actif`, contact réel, `publie`, `DEPLOY_CIBLE=production`, bloc Caddy) dans un dernier plan séquentiel, précédé d'une répétition complète sur `essai` (qui construit déjà en mode production). Faire trancher à Erwan, avant d'écrire les Mentions, le conflit D-02 (voir Open Questions Q1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page et commande de relecture | Poste d'Erwan (CLI Node local, 127.0.0.1) | Dépôt (YAML) | Jamais déployée ; écrit uniquement dans `src/content/**` (3 champs) et un registre hors contenu |
| Statut `relu` / `publie`, relecteur, date | Données (YAML dans Git) | content-core (schémas + règles) | Source de vérité unique ; ADR-041 `statutRetenu` |
| Liste blanche de publication | Config versionnée (`config/publication.yml`) | content-core (règle) + `check-dist` | Décision explicite, relue en PR, appliquée au validateur ET au dist |
| Affichage relecteur + date (PUB-03) | Build statique (composant Astro `Mesure.astro`) | `check-dist` (contrôle post-build) | Zéro JS ; contrôlé sur le HTML produit |
| Copies Wayback / exceptions | Données (champs `archive`) + règle `sources` | `scripts/archive-source.ts` | Règle existante `ARCHIVE_WAYBACK_ABSENTE` |
| Mentions légales | Build statique (`mentions-legales.astro`) lisant `config/*.yml` | Tests de cohérence | Le texte suit la config (`hebergeur.yml`, `site.yml`, `journal-acces.ts`) |
| Note de risques juridiques | Documentation (`docs/`) | — | Signée par Erwan, hors build |
| TLS, en-têtes, journaux, redirection `www` | Caddy partagé du VPS (hors CI) | Génération `render-caddy.ts` | ADR-057 : écriture serveur manuelle, approuvée une par une |
| Livraison de la build | CI GitHub (`deploy`) + commande forcée VPS | Environment `production` | ADR-054/055 |
| Supervision | Healthchecks + battement VPS + workflow `sonde` | — | Doivent viser l'hôte public à l'ouverture |
| Journal d'audit sur la build en ligne | Poste d'Erwan / session principale (lecteur hors ligne sur le dist) | VPS (lecture seule) | `audit-lire.ts` lit un dossier, pas une URL |

## Standard Stack

### Core (aucune nouvelle dépendance)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24 LTS (`fnm exec --using=24`) | Outil de relecture, serveur local | Imposé par CLAUDE.md [VERIFIED: CLAUDE.md projet] |
| `node:http`, `node:crypto`, `node:fs`, `node:util` | stdlib | Serveur local, jeton CSRF, E/S, parseArgs | Même approche que `e2e/serveur.ts` [VERIFIED: lecture du fichier] |
| `yaml` | ^2.9.1 (déjà dépendance) | Lecture avec offsets (`parseDocument`, `node.range`) | Déjà utilisé par content-core avec `PARSE_OPTIONS` [VERIFIED: `src/lib/content-core/load.ts`] |
| `ajv` | ^8.20.0 (déjà dépendance) | Validation post-écriture via `loadAll` | Réutiliser `loadAll(root, {schemasDir, mode})` [VERIFIED: load.ts] |
| content-core | dépôt | `loadAll`, `statutRetenu`, `dansPerimetre`, `quoteIn`, `foldKey`, `kandelMoles` | Réutiliser, ne pas recopier [VERIFIED: grep] |

### Supporting / Alternatives
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Édition par offsets (splice de texte) | `Document.toString()` | Rejeté : reformate 25 mesures (voir Pitfall 3) |
| Serveur Node maison | Astro dev + endpoint | Rejeté : risque d'inclusion dans `dist`, dépendance au build |
| Page HTML servie | Interface TUI | Rejeté : D-04 demande une page |

**Installation:** aucune. Toute dépendance ajoutée exigerait une justification écrite dans la PR (CLAUDE.md).

## Package Legitimacy Audit

Aucun paquet externe n'est installé par cette phase (stdlib Node 24 + dépendances déjà présentes `yaml`, `ajv`). Audit : **sans objet**. Packages removed (slopcheck [SLOP]) : none. Packages flagged [SUS] : none. Si le planner ajoute un paquet, il doit gater l'installation derrière un `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
 Poste d'Erwan (127.0.0.1)                         Dépôt Git (main)                          VPS Hetzner (Caddy partagé)
 ───────────────────────                           ─────────────────                         ───────────────────────────
 npm run relecture -- servir                       src/content/**  (YAML)
   │ loadAll(contentRoot) ───────────lit──────────► mesures / candidats / couverture / sources / archives/*.txt
   │ + règles (Kandel-Moles, glossaire, forbidden)
   ▼
 page locale : 4 rédactions | texte_source | extrait archivé | sources | alertes
   │  POST valider / note  (jeton CSRF, Host + Origin contrôlés)
   ▼
 marquer :  splice 3 champs ─────écrit───────────► mesure.yaml (statut_relecture, relecteur, date_relecture)
   │        puis loadAll() : 0 erreur ? sinon restauration                                    
   │        ledger relecture/journal.jsonl (hors contenu) ── hash du texte relu
   └─ notes ► relecture/notes.jsonl (hors contenu)

 npm run relecture -- publier --theme sante   ───► mesures relu→publie, theme sante publie (si tout est relu)
 config/publication.yml  (themes_ouverts: [sante]) ──► règle PUBLICATION_* (validate) + check-dist (dist)

 PR / push main ─► CI : verifier + e2e + construire (RTP_DEPLOIEMENT=1 si DEPLOY_CIBLE=production)
                        │ approbation Erwan (Environment production)
                        ▼
                  deploy : rsync -> incoming/production/<sha> -> activer -> current ──► /srv/reveletonprog/current
                                                                                          ▲ Caddy bloc reveletonprog.fr + www (redir)
 sonde.yml (SONDE_URL) / battement.sh (RTP_HOTE) / smoke (DEPLOY_URL)  ──── HTTPS ───────┘
```

### Recommended Project Structure
```
scripts/
├── relecture.ts                 # CLI : liste | servir | marquer | publier | retirer
└── lib/relecture/
    ├── editer.ts                # splice par offsets + garde structurelle (toJS avant/après)
    ├── vue.ts                   # assemblage d'une fiche de relecture (mesure, source, extrait, alertes)
    ├── serveur.ts               # node:http, 127.0.0.1, Host/Origin/CSRF
    └── registre.ts              # relecture/journal.jsonl, relecture/notes.jsonl
config/publication.yml           # themes_ouverts
relecture/                       # registre et notes (hors src/content)
docs/RISQUES-JURIDIQUES.md
tests/relecture/*.test.ts
```

### Pattern 1: édition ciblée par offsets (Document API sans re-sérialisation)
**What:** lire avec `parseDocument(text, PARSE_OPTIONS)`, récupérer `doc.getIn(['statut_relecture'], true).range` (ou `['statuts', i, 'statut_relecture']`), remplacer le texte de la valeur et insérer les lignes `relecteur:` / `date_relecture:` juste après la paire, à la même indentation. Les commentaires et le reste du fichier restent octet pour octet.
**When to use:** toute écriture de l'outil de relecture.
**Garde :** après écriture, `toJS()` avant/après doit ne différer que par ces trois clés, `git diff --numstat` du fichier doit montrer au plus 3 lignes ajoutées et 1 modifiée, et `loadAll` doit donner 0 erreur ; sinon restaurer le fichier d'origine.
```typescript
// Source : essai local du 2026-11-10 (yaml 2.9.1) + docs yaml (Document, node.range)
const doc = parseDocument(texte, PARSE_OPTIONS);
const noeud = doc.getIn(['statut_relecture'], true) as { range: [number, number, number] };
// remplacer texte.slice(noeud.range[0], noeud.range[1]) par 'relu', puis insérer
// `\nrelecteur: Erwan Henry\ndate_relecture: 2026-11-20` après noeud.range[1]
```

### Pattern 2: état en trois temps (brouillon → relu → publie)
`relu` = relu par Erwan (D-04). `publie` = visible en production (`vue.ts` filtre `statut_relecture === 'publie'` sur thèmes ET mesures, ADR-041 ne vaut que pour les statuts de candidats). La commande `publier --theme sante` fait la seconde transition et refuse si une condition manque (voir §3).

### Anti-Patterns to Avoid
- **`doc.toString()` pour réécrire un fichier de contenu** : reformate des scalaires repliés (25 mesures), produit un diff massif que la contrainte « sans autre modification » interdit.
- **Écrire dans `src/content/` une note ou un hash** : D-04 limite les écritures à statut, relecteur, date. Notes et empreintes vont dans `relecture/`.
- **Passer un chemin de fichier depuis le navigateur** : le client n'envoie que l'identifiant de mesure, résolu côté serveur par la liste de `loadAll`.
- **Lier `0.0.0.0` ou `localhost` seul** : lier explicitement `127.0.0.1` et refuser tout `Host` différent (DNS rebinding).
- **Mettre `www` ou l'essai dans la liste blanche** : la liste blanche porte des identifiants de thèmes, pas des hôtes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validation d'un fichier après écriture | Un validateur ad hoc | `loadAll(contentRoot, {schemasDir, mode:'production'})` | Mêmes règles que la CI |
| Statut qui fait foi / périmètre | Une 2e définition | `statutRetenu`, `dansPerimetre` (`rules/equite.ts`) | ADR-041 : une seule définition |
| Localiser la citation dans l'archive | Recherche naïve `includes` | `foldKey`, `tokens`, `haystack`, `quoteIn` de `rules/text/` | Gère accents, apostrophes, ellipses |
| Lisibilité, mots interdits, glossaire | Recalcul dans l'outil | Diagnostics renvoyés par `loadAll` (par fichier, `pointer`) | Les alertes affichées sont celles de la CI |
| Soumission Wayback | `fetch` maison | `node scripts/archive-source.ts --wayback-only <id>` / `--wayback-missing --candidat <id>` | Écart de 20 s, contrôle de l'instantané (`instantaneDe`) |
| Parseur YAML | `js-yaml` | `yaml` + `PARSE_OPTIONS` (alias refusés, clés uniques) | Cohérence avec la CI |
| Serveur HTTP statique | Framework | `node:http` (modèle `e2e/serveur.ts`) | Zéro dépendance |
| Jeton CSRF | Bibliothèque | `crypto.randomBytes(32)` + `timingSafeEqual` | 10 lignes |

**Key insight:** tout ce que la page de relecture affiche comme « alerte » doit venir des diagnostics du moteur de règles, sinon l'outil et la CI divergent.

## Runtime State Inventory

(Phase de bascule vers la production : état hors dépôt qui doit suivre.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Aucune base. Registre de relecture (`relecture/*.jsonl`) à créer. | Code (création) |
| Live service config | GitHub : variables `DEPLOY_CIBLE=essai`, `SONDE_URL=https://essai.reveletonprog.fr` ; **`DEPLOY_URL` absente** (smoke test sauté) ; Environments `production` et `sonde` ; Healthchecks (`sonde-externe` encore 10 min / 20 min, D1) | Passer `DEPLOY_CIBLE=production`, poser `DEPLOY_URL=https://reveletonprog.fr`, `SONDE_URL=https://reveletonprog.fr` ; vider `SONDE_USER`, `SONDE_PASS`, `DEPLOY_SMOKE_USER`, `DEPLOY_SMOKE_PASS` (l'hôte public n'a pas de `basic_auth`) ; D1 : décision d'Erwan |
| OS-registered state | VPS : cron `rtp-battement` avec `/etc/rtp/battement.env` (`RTP_HOTE` = hôte d'essai, `RTP_SONDE_USER/PASS`), `/opt/vaultwarden/sites.d/reveletonprog-essai.caddy` (seul fichier présent le 2026-11-10 ; `site.caddy` public absent) | Écriture serveur approuvée : `RTP_HOTE=reveletonprog.fr`, retirer les identifiants sonde ; ajouter `reveletonprog.caddy` ; retirer le bloc essai |
| Secrets/env vars | `RTP_ESSAI_HASH`, `RTP_SONDE_HASH` (conteneur Caddy) ; secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `SONDE_PING_URL` | Les deux hash restent (valeur factice si essai retiré) ; aucun nouveau secret |
| Build artifacts | `/srv/reveletonprog/essai/{releases,current}` (version d'essai en `prevu`), `/srv/reveletonprog/{releases,incoming}` vides pour la production ; `dist*`, `playwright-report` locaux | Garder `essai/` quelques jours après retrait du bloc (retour possible), puis nettoyage approuvé ; DNS `essai.` à retirer chez IONOS (Erwan) |

**Nothing found in category:** « Stored data » (aucune base) — vérifié par lecture de `docs/ARCHITECTURE.md` et du dépôt.

## 1. Modèle de données de la relecture

### 1.1 Champs existants (aucun `version_schema` à monter)

| Collection | Champs | Contrainte schéma | Source |
|---|---|---|---|
| `mesures` | `statut_relecture` (obligatoire, enum `brouillon|relu|publie`), `relecteur`, `date_relecture` (date complète) | `relu` ou `publie` exige `relecteur` + `date_relecture` ; `publie` exige `redactions.enfant` et `redactions.aine` | `schemas/mesure.schema.json` [VERIFIED] |
| `themes` | idem | `relu`/`publie` exige relecteur + date | `schemas/theme.schema.json` [VERIFIED] |
| `candidats.statuts[]` | `statut_relecture` obligatoire par entrée, `relecteur`, `date_relecture` | hors brouillon : relecteur + date **et `date` complète** (`AAAA-MM-JJ`) | `schemas/candidat.schema.json` [VERIFIED] |
| `couverture.cases[]` | `verifie_le`, `verifie_par` (obligatoires) ; pas de statut | `non_precise` exige `sources_consultees` | `schemas/couverture.schema.json` [VERIFIED] |

`schemas/CHANGELOG.md` : « ajouter un champ optionnel = pas d'incrément ». Donc :
- **Aucune migration** pour PUB-01/PUB-03.
- Les cases de couverture se « relisent » en mettant à jour `verifie_le` (date de la relecture) et `verifie_par` (aujourd'hui « Claude (agent), à relire par Erwan Henry ») : c'est la même écriture ciblée par offsets, deux champs, sans nouveau champ. Cela règle en même temps WR-05 (voir 1.4).
- Un éventuel champ d'exception Wayback (§6) est un champ **optionnel** de `archive` : pas de bump.

État du corpus au 2026-11-10 : 134 mesures toutes `brouillon`, dont **47 de santé pour 27 candidats** ; les 3 thèmes `brouillon` ; 59 candidats (37 `declare`, 17 `renonce`, 5 `pressenti` comme statut le plus récent), tous statuts `brouillon` ; couverture santé : 37 cases (27 `mesures`, 7 `programme_non_publie`, 3 `non_precise`) [VERIFIED: script de comptage].

### 1.2 Comment `relu` vs `publie` fonctionne réellement (ADR-041 + `vue.ts`)

| Objet | Production (mode par défaut, fail-closed) | Preview |
|---|---|---|
| Thème | visible seulement si `statut_relecture === 'publie'` | tous |
| Mesure | visible seulement si `publie` ET thème visible | toutes, pastille « brouillon, non relu » / « relu, pas encore publié » |
| Statut de candidat | **plus récent des statuts `relu` ou `publie`** (`statutRetenu`) ; un brouillon ne change rien | plus récent de tous |
| Périmètre d'équité | candidats dont le statut retenu est `declare` ou `primaire` | idem en preview |

Conséquences pour la phase :
1. **`relu` seul ne publie rien** pour les mesures et le thème : il faut `publie`. Le « relu » de D-04 est une étape de contrôle ; la mise en ligne est une 2e transition (`publier`).
2. Pour les 37 candidats `declare`, il faut **`relu` sur leur statut `declare`** (sinon `EQUITE_PERIMETRE_VIDE` : périmètre vide). Les 22 autres (`renonce`, `pressenti`) peuvent rester en brouillon : testé, la build et le validateur passent (ils n'apparaissent simplement pas comme « ne se présentent pas » en production). **Question à trancher par Erwan** : veut-il les relire aussi (17 `renonce` donnent la liste « ne se présentent pas »), sachant qu'un statut `relu` exige une date complète et que `laurent-wauquiez` a `2026-07` (SCHEMA_FORMAT) [VERIFIED: dry-run].
3. La garde d'équité (REGLE-08) s'exécute **en erreur en production** : tout candidat du périmètre doit avoir une mesure `publie` OU une case de couverture, et inversement une case `mesures` sans mesure `publie` est `EQUITE_COUVERTURE_INCOHERENTE`.

### 1.3 Le piège `PILOTE_NON_BROUILLON` (bloquant, absent de CONTEXT)

`scripts/lib/pilote.ts:113` : tant que `data/couverture-themes.yaml` porte `pilote.relecture_ouverte: false`, **toute** mesure, tout thème pilote, tout fichier de couverture et tout statut de candidat qui n'est pas `brouillon` (ou qui porte un `relecteur`) est une erreur `PILOTE_NON_BROUILLON` (exécutée par `tests/corpus`). Deux tests figent la valeur : `tests/corpus/couverture-themes.test.ts:95` (`assert.equal(..., false)`) et la lecture dans `tests/corpus/fiches.test.ts:52`. RUNBOOK « Ouvrir la relecture » : Erwan passe la valeur à `true` « dans le commit où il commence à marquer des fichiers `relu` ». [VERIFIED: lecture du code et du RUNBOOK]
**Action du plan 1 :** premier commit de la phase = `relecture_ouverte: true` + mise à jour du test qui l'épingle. Ne jamais la remettre à `false`.

### 1.4 Les 8 contradictions de dates de couverture (WR-05)

`npm run validate` renvoie bien 8 avertissements `COUVERTURE_VERIFIEE_AVANT_SOURCE` [VERIFIED: exécution]. Tous : `verifie_le: 2026-11-03` alors que la source consultée l'a été le `2026-11-04`.

| Thème | Candidat | Source consultée plus tard |
|---|---|---|
| **sante** (ligne 67) | clara-egger | clara-egger-notre-solution |
| **sante** (106) | benoit-mathieu | benoit-mathieu-le-candidat |
| **sante** (121) | manolo-mlekuz | manolo-mlekuz-programme |
| travail (71) | clara-egger | clara-egger-presentation-candidate |
| travail (110) | benoit-mathieu | benoit-mathieu-programme |
| travail (121) | antoine-mikolajczak | antoine-mikolajczak-tract-campagne |
| travail (128) | manolo-mlekuz | manolo-mlekuz-programme |
| travail (147) | natacha-polony | natacha-polony-ma-vision |

**Seuls 3 cas concernent l'ouverture (santé)** : D-06 renvoie travail à plus tard, et la règle n'est qu'un avertissement. Correction éditoriale par Erwan (RUNBOOK « Relire les dates de couverture ») : relire la case dans les sources listées, puis `verifie_le` = date de cette relecture et `verifie_par: Erwan Henry`. L'outil de relecture les traite comme une étape de la relecture de la case (même écriture à 2 champs), jamais par recherche-remplacement. Les 5 cas de travail restent ouverts et doivent être consignés comme tels (liste dans la note de reprise).

### 1.5 Ce que la commande doit écrire, et rien d'autre

| Action | Écriture dans `src/content/` | Hors contenu |
|---|---|---|
| `marquer mesure <id>` | `statut_relecture: relu`, `relecteur`, `date_relecture` (3 lignes) | ligne dans `relecture/journal.jsonl` (id, hash du contenu relu, date) |
| `marquer statut <candidat>` | idem sur `statuts[i]` du statut retenu en preview | idem |
| `marquer case <theme> <candidat>` | `verifie_le`, `verifie_par` | idem |
| `note <id> <texte>` | rien | `relecture/notes.jsonl` (ouverte / résolue) |
| `publier --theme sante` | mesures `relu` → `publie` ; thème `publie` + relecteur + date | journal |
| `retirer <id>` | mesure → `brouillon` (voir §7 pour la couverture) | journal |

Garde-fous : refuser `marquer` si `loadAll` renvoie une erreur sur le fichier, si une note est ouverte (sauf `--malgre-note`), si `date` d'un statut est partielle ; recalculer le hash du texte relu (4 rédactions + titre + `texte_source`) à chaque `liste` et signaler « modifiée depuis la relecture » (un texte corrigé après `relu` doit être relu de nouveau : l'outil ne le sait que grâce au registre hors contenu).

`publier` doit refuser tant que : une mesure du thème n'est pas `relu` ; un statut `declare` du périmètre n'est pas `relu` ; une case de couverture n'est pas relue (`verifie_par` ≠ relecteur) ; une source citée n'a ni Wayback ni exception ; le thème n'est pas dans `config/publication.yml`.

## 2. Page de relecture locale sans dépendance

**Interface.** `npm run relecture -- liste [--theme sante]` (terminal : à relire / relu / à revoir (hash changé) / note ouverte, par candidat) ; `servir [--port]` ; `marquer`, `note`, `publier`, `retirer`. Ajouter l'entrée `relecture` dans `package.json` `scripts` (pas de dépendance).

**Contenu par mesure** (une page par candidat ou une liste filtrable, tout en HTML serveur, JS minimal) :
1. les 4 rédactions (`resume`, `detaille`, `enfant`, `aine`) en colonnes, avec `titre` ;
2. `texte_source` et `source_localisation` ;
3. l'**extrait archivé autour de la citation** : lire `archives/…txt` (déjà exposé par `lireArchive` du moteur) ; localiser la citation avec les utilitaires de `rules/text/verbatim.ts` (`fragments`, `foldKey`) et afficher ±400 caractères autour du premier fragment trouvé, avec la citation surlignée ; si introuvable, afficher le début et le dire (la règle de citation fautive aurait déjà échoué) ;
4. les sources (titre, URL, dates de consultation et de capture, empreinte sha256 complète, `wayback_url`) ;
5. les alertes de la CI pour ce fichier (`loadAll` → diagnostics filtrés sur `file`) : `LISIBILITE_ENFANT_FAIBLE` (Kandel-Moles, seuil 80 ; 15 cas en santé), glossaire, mots interdits, `ARCHIVE_WAYBACK_ABSENTE`, `COUVERTURE_VERIFIEE_AVANT_SOURCE` ;
6. boutons « valider » (POST) et « note » (POST).

Volume à relire pour santé : **47 mesures x 4 rédactions, 37 statuts, 37 cases de couverture** (dont 7 `programme_non_publie` et 3 `non_precise`) : l'estimation de 3 à 4 h de la Piste 0 est optimiste ; prévoir le registre de reprise et un tri par candidat pour pouvoir s'arrêter et reprendre.

**Sécurité (serveur local).**
- `server.listen(port, '127.0.0.1')` explicitement ; échouer si l'adresse d'écoute n'est pas loopback.
- Refuser toute requête dont l'en-tête `Host` n'est pas exactement `127.0.0.1:<port>` ou `localhost:<port>` (anti DNS rebinding) ; refuser un `Origin` présent et différent ; exiger `Sec-Fetch-Site: same-origin` ou `none` si présent.
- Jeton CSRF aléatoire (32 octets) généré au démarrage, injecté dans chaque formulaire, comparé par `timingSafeEqual` sur tout POST ; POST uniquement `application/x-www-form-urlencoded`, corps plafonné (ex. 8 Kio).
- Le client n'envoie jamais de chemin : seulement un identifiant de mesure/candidat/thème validé par expression régulière puis résolu dans la liste chargée par `loadAll`.
- Échappement HTML de tout texte de YAML (les rédactions sont des données non fiables au sens XSS) ; en-têtes `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Jamais servi par Astro ni écrit dans `dist/` ; un test `tests/repo` vérifie que `scripts/relecture.ts` n'est référencé ni par `src/` ni par `astro.config.mjs`, et que `check-dist` rejette tout fichier hors html/txt/xml/json (déjà le cas : `TYPE_FICHIER_INATTENDU`).
- Le nom du relecteur vient de `--relecteur` ou d'une constante `Erwan Henry` (valeur affichée en public, PUB-03).

## 3. Publication : liste blanche, garde d'équité, affichage, check-dist

### 3.1 Ce qui rend un thème « publié » aujourd'hui
Uniquement `themes/<id>.yaml` avec `statut_relecture: publie` (+ relecteur/date). C'est donc déjà un interrupteur par thème, mais **modifiable par la même opération que la relecture** (aucune décision séparée, aucune relecture de PR dédiée). `pilote.livres` (dans `data/couverture-themes.yaml`) ne fait qu'étiqueter « (livré) » sur la Méthode les thèmes visibles ; ce n'est pas une garde.

### 3.2 Recommandation : `config/publication.yml`
```yaml
# Thèmes ouverts au public (D-07). Un thème est visible en production seulement s'il est ici
# ET `statut_relecture: publie`. Modifier ce fichier = décision éditoriale relue en PR.
themes_ouverts:
  - sante
```
- Lecteur strict (même discipline que `site-config.ts` : schéma core, clés uniques, pas d'alias), module pur `src/lib/publication-config.ts`.
- **Règle content-core** `PUBLICATION_LISTE_BLANCHE` (famille corpus, erreur en production, avertissement en preview) : (a) thème `publie` hors liste = erreur ; (b) thème listé non `publie` = erreur ; (c) identifiant inconnu = erreur ; (d) liste vide en production = erreur (un site sans thème n'ouvre pas).
- **Défense en profondeur dans `construireCorpus`** : en production, filtrer aussi `themesVisibles` sur la liste (jamais plus large que `publie`).
- **`check-dist`** (codes nouveaux, même style que `PREVIEW_INDEXABLE`) : `THEME_HORS_LISTE_BLANCHE` (une page `themes/<id>/` hors liste), `THEME_OUVERT_ABSENT` (un thème de la liste sans page) ; la page `themes/` ne liste que la liste blanche. L'e2e `check-dist` actuel sait déjà annoncer « 1 thème(s) attendu(s) ».
- Interaction avec la garde d'équité : la liste blanche dit *quels* thèmes ; REGLE-08 dit *si* un thème listé est complet pour tous les candidats du périmètre. Les deux sont des erreurs en production ; la CI échoue donc si Erwan liste un thème incomplet.
- **Dry-run réalisé** : santé `publie` + 37 statuts `relu` + 2 Wayback + 1 date : `validate` 0 erreur, build production 66 pages, `check-dist` 0 erreur ; variante où les 22 non-déclarés restent en brouillon : idem [VERIFIED: exécution 2026-11-10, copie dans /tmp, dépôt non modifié].

### 3.3 PUB-03 : affichage du relecteur et de la date
Rien ne l'affiche aujourd'hui (`grep` : `relecteur` n'est lu que par `vue.ts` pour la date de mise à jour). Ajouter dans `src/components/Mesure.astro`, hors du bloc des quatre niveaux (il doit rester visible quel que soit le niveau et sans JS) :
```astro
{mesure.relecteur !== undefined && mesure.date_relecture !== undefined && (
  <p class="relecture" data-relecture>Relue par {mesure.relecteur} le <time datetime={mesure.date_relecture}>{formatDate(mesure.date_relecture)}</time>.</p>
)}
```
Contrôles à ajouter : `check-dist` code `RELECTURE_ABSENTE` (en production chaque `article.mesure` porte un `p[data-relecture]` non vide dont la date est valide), et un test e2e/`dist` qui compare au YAML (modèle : le balayage W10 de la Phase 7). Mettre à jour la phrase de la Méthode (« relues par l'éditeur avant leur publication », vraie seulement après cette phase) et ajouter une phrase sur la mention de relecture. Vérifier les budgets de poids/4G (une ligne par mesure, négligeable).

## 4. Juridique

> Méthode : textes lus sur Légifrance par un résumeur (citations limitées à 125 caractères, **jamais le texte intégral**). Chaque claim est donc MEDIUM au mieux. Le texte légal exact doit être relu par Erwan avant signature. Légifrance renvoie 403 à `curl` : ouvrir les liens dans un navigateur.

### 4.1 LCEN après la loi SREN 2024-449 [CITED: legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614, vu le 2026-11-10]
L'article **1-1** (créé par l'art. 48 de la loi 2024-449 du 21 mai 2024, en vigueur le 23 mai 2024) reprend les anciens III, IV et V de l'art. 6.
- **I** : pour toute personne « dont l'activité est d'éditer un service de communication au public en ligne », mettre à disposition en standard ouvert :
  - 1° personne physique : « leurs nom, prénoms, domicile et numéro de téléphone » (+ numéro RCS/RNE si inscrite) ;
  - 2° personne morale : dénomination ou raison sociale, siège social, téléphone (+ RCS, capital) ;
  - 3° le nom du directeur ou codirecteur de la publication et, le cas échéant, du responsable de la rédaction ;
  - 4° nom ou dénomination, adresse et téléphone du **fournisseur de services d'hébergement** ;
  - 5° (le cas échéant) tiers qui stocke des données traitées directement par l'éditeur.
- **II** : l'éditeur **non professionnel** peut ne tenir à disposition que les nom/dénomination/adresse de l'hébergeur, **à condition de lui avoir communiqué** les éléments d'identification du I. Le secret professionnel de l'hébergeur n'est pas opposable à l'autorité judiciaire.
- **III (droit de réponse)** : toute personne nommée ou désignée dans un service de communication au public en ligne dispose d'un droit de réponse ; demande adressée au directeur de la publication (ou à l'hébergeur si l'éditeur est resté anonyme), **dans les trois mois** de la mise à disposition du message ; le directeur est « tenu d'insérer dans les trois jours de leur réception » la réponse, « sous peine d'une amende de 3 750 euros » ; la réponse est gratuite ; un décret en Conseil d'État fixe les modalités. IV = associations (art. 48-1 à 48-6 de la loi de 1881), V = chapitres IV et V de la loi de 1881.
- **Art. 1-2** [CITED: legifrance.gouv.fr/codes/article_lc/LEGIARTI000049568616] : « Est puni d'un an d'emprisonnement et de 75 000 euros d'amende » la personne physique (ou le dirigeant de droit ou de fait d'une personne morale) dont l'activité est d'éditer un service en ligne qui ne respecte pas les I et II de l'art. 1-1 (personnes morales : amende, art. 131-38 du Code pénal, interdictions 131-39 2° et 9°).
- **Conclusion pour « 6 IV ou 1-1 »** : la base du droit de réponse est **l'art. 1-1 III**. Le texte actuel de `mentions-legales.astro` (« III de l'article 1-1 », trois mois, trois jours) est exact. **Ne pas appliquer** la consigne de `.planning/research/PITFALLS.md` (« corriger en art. 6 IV ») : elle date d'avant la vérification. L'art. 6 traite désormais des prestataires intermédiaires.

### 4.2 Décret 2007-1527 du 24 octobre 2007 [CITED: legifrance.gouv.fr/loda/id/JORFTEXT000000428279, vu le 2026-11-10]
Toujours en vigueur ; ses visas citent encore « le IV de l'article 6 » (aucune modification SREN visible sur la page : MEDIUM, à confirmer dans l'historique des versions). Points utiles à l'écrire dans le RUNBOOK : demande par lettre recommandée avec accusé de réception **ou tout moyen prouvant l'identité de l'auteur et la réception** ; contenu de la demande (références du message, conditions d'accès, nom de l'auteur du message s'il est indiqué, nature du message, passages contestés, texte de la réponse demandée) ; réponse écrite d'au plus **200 lignes** (un résultat de recherche secondaire disait 20 : c'est faux, le texte dit 200) ; insertion dans des conditions similaires au message, présentée comme réponse, accessible aussi longtemps que le message ; si le directeur supprime ou corrige le contenu contesté dans les trois jours de la réception, il n'a pas à insérer la réponse (art. 5, MEDIUM) ; le décret ne s'applique pas quand les utilisateurs peuvent répondre directement (sans objet ici). La demande doit pouvoir être faite par un moyen prouvant la réception : une **adresse postale ou électronique réelle** est donc indispensable (voir Q1).

### 4.3 Régime d'éditeur : conflit avec D-02 (à trancher)
D-02 demande : nom publié, éditeur et directeur de la publication « Erwan Henry », **sans adresse postale**, **sans** régime non professionnel, sans transmission d'identité à Hetzner. Or, selon le texte lu :
- **Régime I (professionnel / nom publié)** : une personne physique doit publier nom, prénoms, **domicile et numéro de téléphone**. L'absence de domicile expose à l'art. 1-2 (1 an, 75 000 EUR) [MEDIUM : résumé Légifrance, à relire]. L'identité n'a effectivement pas à être donnée à l'hébergeur dans ce régime.
- **Régime II (non professionnel)** : possible de ne publier que l'hébergeur, mais **à condition d'avoir remis l'identité à Hetzner** (et de pouvoir justifier du caractère non professionnel) ; l'éditeur peut quand même afficher son nom librement (la loi autorise l'anonymat, elle ne l'impose pas) mais pas sa non-adresse sans la condition.
- Le texte actuel de la page dit « à titre non professionnel, au sens du II » **et** nomme Erwan : il se réclame du II alors que D-02 l'écarte. Dans les deux cas la page doit changer.
- Qualification « non professionnel » pour un freelance qui édite un projet civique bénévole : **incertain** [ASSUMED]. Un jugement du TGI/tribunal de Caen aurait requalifié un blog politique très actif (source de seconde main déjà notée MEDIUM dans PITFALLS ; non revérifié ici).

Options à présenter à Erwan (voir Open Questions Q1) :
- **A. Régime I avec adresse professionnelle** : publier nom, prénoms, téléphone et une adresse (siège d'entreprise individuelle / domiciliation / coworking, si c'est son adresse déclarée d'activité), SIREN si inscrit. Aucune transmission à Hetzner exigée. Cohérent avec D-02 sauf « sans adresse postale ».
- **B. Régime II** : nom publié (facultatif), identité complète remise à Hetzner avec preuve datée (Piste 0, ligne « Envoyer l'identité d'éditeur à Hetzner »), mention de l'hébergeur ; risque résiduel sur la qualification.
- **C. Domicile personnel** : à écarter pour la protection de la vie privée (le dépôt est public).
La recommandation de recherche est **A avec une adresse de domiciliation**, car elle ne dépend pas de la qualification et reste compatible avec « nom publié ».

### 4.4 Hébergeur actif
`config/hebergeur.yml` : Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, +49 (0)9831 505-0, HRB 6089 Amtsgericht Ansbach ; page officielle `https://www.hetzner.com/legal/legal-notice/` relue le 2026-11-10 : adresse, téléphone et registre **identiques** [VERIFIED: WebFetch/curl]. Actions : mettre `consulte_le: 2026-11-10` (ou la date du commit), vérifier sur la facture quelle entité du groupe héberge le VPS (hypothèse A5 de la Phase 5, **non vérifiable depuis le dépôt**), puis `statut: actif`. Un test devrait lier `actif` à la présence de la phrase sur le journal d'erreurs (revue IN-06).

### 4.5 Journaux et RGPD
- Journal d'accès Caddy : IP tronquée /24 (IPv4) et /48 (IPv6), en-têtes et TLS supprimés, rotation 00:00 UTC ou 10 MiB, 12 fichiers gardés + celui du jour, donc `RETENTION_MAX_JOURS = 14` (`src/lib/journal-acces.ts`, source unique partagée par `render-caddy.ts` et la page) [VERIFIED: lecture].
- **IN-06** : le journal d'erreurs (`http.log.error`, réponses 5xx) et le journal par défaut (TLS, ACME) partent sur la sortie d'erreur du conteneur, **adresse complète**, plafonnés en **taille** (json-file 10 Mio x 3) mais pas en durée [VERIFIED: RUNBOOK + 08-REVIEW IN-06]. Deux options : (a) filtrer ce flux via un bloc `log` global avec `include http.log.error` : modifie la configuration **partagée** des autres sites, hors périmètre ; (b) **le dire dans les Mentions légales** : « La sortie d'erreur du serveur garde l'adresse IP complète des requêtes en erreur ; elle est plafonnée en taille (environ 30 Mio) et non en durée, … ». Recommandation : (b) maintenant, (a) ultérieurement. Il faut aussi vérifier qu'aucune IP complète n'est écrite ailleurs (`docker logs caddy` sur un échantillon, lecture seule).
- Rétention : recommandation CNIL sur la journalisation (délibération 2021-122 du 14 octobre 2021, 6 mois à 1 an pour les journaux de sécurité) [ASSUMED : relevée dans `.planning/research/FEATURES.md`, non revérifiée ici] ; 14 jours est plus court que cette fourchette, donc non problématique, mais la finalité ne doit pas être étendue.
- Informations RGPD à ajouter à la page : responsable de traitement (Erwan Henry), finalité (fonctionnement et sécurité du serveur), base légale (intérêt légitime) [ASSUMED], durée, droits (accès, effacement, opposition), contact, droit de réclamation auprès de la CNIL. Aujourd'hui la page n'en dit rien.
- **Données de tiers** : les positions de candidats déclarés sont des opinions politiques publiées par les intéressés (art. 9 RGPD, données manifestement rendues publiques) ; les 22 personnalités non déclarées demandent plus de prudence (minimisation). [ASSUMED, repris de PITFALLS point 6]

### 4.6 `localStorage` (CNIL)
Lignes directrices cookies et traceurs, délibération 2020-091 du 17 septembre 2020 : elles couvrent aussi le stockage HTML5/localStorage ; les traceurs de personnalisation de l'interface (ex. choix de présentation) « lorsque cette personnalisation est un élément intrinsèque et attendu du service » sont exemptés de consentement [CITED: https://www.cnil.fr/sites/default/files/atoms/files/lignes_directrices_de_la_cnil_sur_les_cookies_et_autres_traceurs.pdf, via résumé de recherche ; formulation exacte de l'article 5 non relue : MEDIUM]. Les 2 clés (`CLES_STOCKAGE`, niveau et ordre) sont écrites à l'action de l'utilisateur, sans identifiant ni transmission : conforme à l'exemption. La page cite déjà `https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi` (HTTP 200 le 2026-11-10). Ne pas ajouter de clé ni de finalité sans revoir ce point.

### 4.7 Règles électorales (note de risques + RUNBOOK)
- **Sondages, loi 77-808 art. 11** (version issue de la loi 2016-508 du 25 avril 2016) : en cas d'élections générales, **la veille et le jour de chaque scrutin**, aucun sondage ne peut être publié, diffusé ou commenté ; l'interdiction prend fin à la fermeture du dernier bureau de vote en métropole ; les sondages publiés avant la veille peuvent continuer à être diffusés avec date de première publication, média et institut [CITED: https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547, via recherche]. Le milestone ne publie aucun sondage : seulement l'inscrire à la note.
- **Code électoral L49** (version du 30 juin 2020) : « à partir de la veille du scrutin à zéro heure », interdit notamment de « diffuser ou faire diffuser par tout moyen de communication au public par voie électronique tout message ayant le caractère de propagande électorale » ; amende de 3 750 EUR ; la CNCCEP précise que les contenus antérieurs ne doivent pas être rediffusés pendant le week-end, directement ou par lien [CITED: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215 ; https://www.cnccep.fr/pdf-cp15.html]. Un site neutre n'est pas de la propagande, mais une modification de contenu ces jours-là est un risque d'interprétation : d'où le gel de déploiement (17-19 avril et 1er-3 mai 2027, déjà implémenté dans `scripts/garde-gel.ts`).
- **L163-2** (référé « manipulation de l'information », 48 h, trois mois avant le premier jour du mois d'élections générales, donc dès le **1er janvier 2027**) [CITED: loi 2018-1202 ; Lexbase L163-2 ; **l'application à la présidentielle est contredite par une source secondaire : LOW, à vérifier**]. Conséquence pratique : exactitude et sourçage sont la défense.
- **L52-1 / L52-8** : non vérifiés ici ; ne pas affirmer qu'ils s'appliquent. [ASSUMED non pertinents pour un site éditorial neutre non commercial.]

### 4.8 Structure proposée de `docs/RISQUES-JURIDIQUES.md`
1. En-tête : version, date, auteur (orchestrateur), signataire (Erwan Henry), statut (« risque accepté le JJ/MM/AAAA » ou « relu par <juriste> »).
2. Périmètre et limites : lecture de textes via résumés, pas un avis juridique ; liens Légifrance.
3. Tableau des risques : identifiant, texte applicable (article + URL), constat sur le site, probabilité, gravité (amende/peine), mesure en place, risque résiduel, décision.
   R1 identification de l'éditeur (art. 1-1 I/II, 1-2) ; R2 droit de réponse (1-1 III, décret 2007-1527, 3 mois / 3 jours / 200 lignes / 3 750 EUR) ; R3 journaux et IP (RGPD, accès 14 j, erreurs non bornées en durée) ; R4 `localStorage` (CNIL 2020-091) ; R5 données de tiers et opinions politiques (art. 9) ; R6 neutralité, erreur factuelle, référé L163-2 ; R7 sondages (77-808 art. 11) et propagande (L49) ; R8 copie d'extraits de programmes (droit de citation, `texte_source` plafonné) et copies Wayback [ASSUMED non étudié] ; R9 hébergeur et continuité.
4. Procédures liées : renvoi au RUNBOOK (droit de réponse, retrait d'urgence, gel).
5. Points non vérifiés (liste explicite) et recommandation de relecture par un juriste après l'ouverture.
6. Bloc de signature : « J'ai lu cette note et j'accepte les risques résiduels ci-dessus. » Date, nom. Une ligne de journal dans `RETROSPECTIVE.md`.

## 5. Mécanique d'ouverture

Ordre recommandé (chaque écriture serveur demande l'accord d'Erwan, ADR-057) :

1. **Préparation du code (agents, sans effet public)** : `config/site.yml` → `contact@reveletonprog.fr` (après test de bout en bout) ; `config/hebergeur.yml` → `statut: actif`, `consulte_le` à jour ; Mentions finales (§4) ; `config/publication.yml` ; statuts `publie` ; test lié `actif` ↔ phrase IN-06. Tant que la cible est `essai`, ces commits partent en build **sans** `RTP_DEPLOIEMENT` vers l'hôte d'essai : répétition complète sur un hôte privé (la build d'essai est déjà en mode production).
2. **Contrôle local de la garde** : `RTP_DEPLOIEMENT=1 RTP_MODE=production astro build` puis `node scripts/check-dist.ts` : doit échouer avec la config d'aujourd'hui (contact provisoire, hébergeur `prevu`) et réussir après l'étape 1 [VERIFIED : l'erreur est la garde existante `CONTACT_PROVISOIRE` / `HEBERGEUR_PREVU`, vue en avertissement dans le dry-run].
3. **Variables GitHub** (par `gh variable set`, pas de secret) : `DEPLOY_CIBLE=production`, `DEPLOY_URL=https://reveletonprog.fr`, `SONDE_URL=https://reveletonprog.fr`. Avec `DEPLOY_CIBLE=production`, `RTP_DEPLOIEMENT` vaut `1` (ci.yml:312) et la build refuse domaine/contact provisoires et hébergeur `prevu`. **Attention** : une seule cible à la fois ; passer à `production` arrête les déploiements vers `essai`.
4. **Premier déploiement `production` avant le bloc Caddy** : le verbe `activer production` range dans `releases/<sha>/` et bascule `current` sans Caddy (`RACINE=$BASE`, `/srv/reveletonprog/current`) ; `DEPLOY_URL` vide à ce moment = test de fumée sauté, `etat` fait foi. L'approbation vient d'Erwan lui-même (HUMAN-UAT 2 : au moins un déploiement approuvé par lui dans l'interface GitHub).
5. **Bloc Caddy public** : `deploy/caddy/site.caddy` (déjà rendu, test de dérive) copié en `sites.d/reveletonprog.caddy` ; `ops/valider-caddy.sh` (conteneur jetable, avec et sans variables) ; `docker exec caddy caddy validate` ; seulement si valide `caddy reload` (jamais de redémarrage) ; `ops/verifier-sites.sh` avant/après pour les autres sites. DNS vérifié : `reveletonprog.fr`, `www.` et `essai.` → `178.104.105.221`, **pas d'AAAA** [VERIFIED: dig 2026-11-10]. ACME : Caddy obtient deux certificats (apex et `www`) ; ne pas boucler sur des échecs (limite Let's Encrypt de validations échouées par heure et de certificats identiques par semaine : valeurs à reconfirmer sur la doc Let's Encrypt, [ASSUMED]) ; ne pas publier d'AAAA tant que l'IPv6 (ufw, réseaux Docker) n'est pas traitée (gap Phase 8). Contrôles : `curl -I https://reveletonprog.fr`, `curl -I https://www.reveletonprog.fr` (301 vers l'apex), en-têtes (`Strict-Transport-Security: max-age=300`, CSP avec les deux empreintes), `/version.json` = commit, `robots.txt` autorisant, `sitemap.xml`, absence de `noindex`.
6. **HSTS** : démarre à `max-age=300` ; passer à `31536000` **après stabilisation** (proposé : 7 jours sans erreur de certificat ni de redirection, `www` vérifié) en modifiant la constante dans `scripts/render-caddy.ts`, régénérant, validant, rechargeant. **Ne pas** ajouter `includeSubDomains` ni `preload` (le VPS héberge d'autres sites et l'hôte `essai`). Cela peut survenir après le 5 décembre : à inscrire au RUNBOOK avec une date.
7. **Supervision** : `/etc/rtp/battement.env` → `RTP_HOTE=reveletonprog.fr` et retirer `RTP_SONDE_USER/PASS` (le battement fait `curl --resolve host:443:127.0.0.1`, donc indépendant du DNS ; sans utilisateur il n'envoie pas d'identifiant, vérifié dans `ops/battement.sh`) ; secrets `SONDE_USER/PASS` et `DEPLOY_SMOKE_USER/PASS` vidés (les scripts de `sonde.yml` et du job `deploy` ignorent l'absence d'utilisateur) ; relancer `sonde.yml` par `workflow_dispatch`. D1 : toujours en attente d'une décision d'Erwan (OPS-01 partiel).
8. **Retrait de l'hôte `essai`** (SC5 : « hôte technique retiré ») : retirer `reveletonprog-essai.caddy` de `sites.d`, `valider-caddy.sh` puis `reload`, `verifier-sites.sh`. Garder `/srv/reveletonprog/essai/` quelques jours (annulation possible), puis suppression approuvée ; retirer l'enregistrement DNS `essai.` chez IONOS (Erwan). **Ce qui est gardé protégé** (alternative D-09) ne tient pas : `DEPLOY_CIBLE` est unique, `essai` ne recevrait plus de build, et le prévisualiser avant Phase 10 se fait plus sûrement par l'artefact `site-preview` ou un rejeu local. Recommandation : **retirer**.
9. **DETTE-04 (journal d'audit sur la build en ligne)** : `audit-lire.ts` lit un dossier. Obtenir `releases/<sha>` de production en lecture seule (`rsync -rt --dry-run` d'abord, ou `ssh keel-vps` + `rsync` descendant, jamais d'écriture), vérifier `node scripts/audit-lire.ts --dist <copie> --empreinte` égale à l'empreinte de l'artefact `site-deploiement-<n>` du run (la CI vérifie déjà l'empreinte de l'arbre), comparer par échantillon le HTML servi (`curl`) à la copie (sha256), puis rejouer le scénario des trois personas **sur cette copie** dans un nouveau `audit/journal.jsonl` (ou un journal daté séparé : l'ancien est à conserver comme historique, W8 reprochait justement qu'il précède des correctifs). Mettre à jour `docs/AUDIT-TEST-CROISE.md` (empreinte de la build déployée, date, commit). C'est une simulation (ADR-052), pas un test d'usage.
10. **Contact** : test de bout en bout (envoi depuis une adresse extérieure à IONOS, réception, réponse, headers SPF/DKIM/DMARC alignés). MX IONOS, SPF `include:_spf-eu.ionos.com`, DMARC `p=none`, DKIM (CNAME `s1-ionos`) **présents** le 2026-11-10 [VERIFIED: dig] ; pas de CAA. Consigner capture et date dans la note de risques.
11. **`favicon.ico`** (D-11) : fichier statique `public/favicon.ico` (autorisé par `check-dist`, type `.ico` à ajouter à la liste des types admis : actuellement html/txt/xml/json) ; pas d'image d'origine douteuse (CLAUDE.md : Wikimedia Commons vérifié ou aucune).

### Retrait d'urgence < 1 h (LEG-03, D-10)
Chaîne mesurée : CI ≈ 6 min (runs du 2026-11-10 : 5 à 18 min selon la file), approbation (dépend d'Erwan), déploiement quelques minutes, bascule < 1 s. Trois voies à documenter, par ordre :
1. **Retour arrière** `rollback.yml` (< 2 min, ADR-054) si la version précédente ne contient pas la mesure.
2. **Retirer la mesure** : `npm run relecture -- retirer <id>` (→ `brouillon`) + push + approbation. **PIÈGE** : si c'est la seule mesure `publie` du candidat sur le thème, la CI échoue en production par `EQUITE_COUVERTURE_INCOHERENTE` (reproduit sur la copie : « la couverture … dit que « antoine-mikolajczak » a des mesures, mais aucune n'est publiée »). Il faut dans le même commit passer la case à `non_precise` (avec `sources_consultees`) ou `programme_non_publie`, ce qui est une décision éditoriale : l'outil `retirer` doit le signaler et proposer la modification.
3. **Repli le plus rapide sans décision éditoriale** : repasser le thème entier en `brouillon` (une ligne ; la page disparaît, REGLE-08 ne s'applique plus ; la liste blanche doit alors aussi perdre le thème, ou la règle doit être tolérante dans ce cas : à décider dans le plan).
Pendant un gel : `-f retrait_urgence=true -f justification="..."` (déjà implémenté, RUNBOOK « Gel des scrutins »). Un **exercice chronométré sur la cible active** est la preuve de LEG-03 : consigner heure de début, de fin, étapes.

## 6. W9 : Wayback et exception Rohou

**Faits vérifiés le 2026-11-10** (lecture seule ; aucune soumission « Save Page Now » n'a été faite par la recherche) :
- `delphine-batho-priorite-1` : l'URL du dépôt `https://www.delphinebatho.fr/priorites/priorite-1/` répond **404** ; le site a changé de découpage. La page « La pleine santé » vit maintenant à `https://www.delphinebatho.fr/priorites/la-pleine-sante/` (200) et son texte contient bien le passage archivé. L'API de disponibilité d'Internet Archive donne **déjà un instantané de la nouvelle URL** : `20261109220051`. Les 18 paragraphes de l'extrait archivé du dépôt sont **tous présents** dans cet instantané [VERIFIED: comparaison de texte, après décompression gzip]. Même cas probable pour `priorite-2` (« La sécurité climatique et la paix ») et `priorite-4` (« La République terrestre »), hors santé donc hors périmètre d'ouverture.
- `erwan-rohou-programme-mei` : URL inchangée (200) ; **un instantané existe déjà** : `20261104092449` ; les 112 paragraphes de l'extrait archivé y figurent [VERIFIED]. Aucun courriel ni téléphone dans l'extrait du dépôt (grep) ; le « pied de page avec données de tiers » signalé par PITFALLS n'est donc pas visible dans l'extrait versionné.
- Sources de santé concernées par PUB-04 : **seulement ces deux** (les mesures Batho de santé citent `priorite-1`, celles de Rohou citent `erwan-rohou-programme-mei`). Les 2 autres sources Batho ne sont citées que par des mesures hors santé.

**Conséquences.**
1. **Batho** : ce n'est plus un problème de limite de débit mais d'**URL périmée** : la source publiée affiche « Lire le document original » vers une page 404. Corriger `url` de la source (modification de YAML de source validée par Erwan, pas de texte de mesure) puis `node scripts/archive-source.ts --refresh delphine-batho-priorite-1 --wayback` (le script compare texte/binaire : `inchange` conserve l'extrait ; `texte_modifie` retire l'ancienne URL Wayback et signale les mesures à revérifier). Pour obtenir un `wayback_url` : soit adopter l'instantané existant (reformater `http://` en `https://web.archive.org/web/20261109220051/…` ; le schéma exige `^https://web\.archive\.org/web/[0-9]{14}/`), soit soumettre (`--wayback-only`). `submitWayback` journalise `HTTP 429 (plafond quotidien par URL)` ; le script espace ses soumissions de 20 s (`ECART_WAYBACK_MS`). Stratégie de reprise : une soumission à la fois, sur plusieurs jours si 429/520 ; l'instantané déjà présent évite toute dépendance au débit. Limites exactes de Save Page Now : non documentées dans cette recherche [ASSUMED]. La capture du dépôt date du 2026-11-03 et l'instantané du 2026-11-09 : l'écart (6 jours) est signalé par le script si > quelques heures ; le contenu étant identique (vérifié), l'accepter est défendable mais doit être **consigné**.
2. **Rohou et D-08** : D-08 est une décision verrouillée (« exception motivée … acceptée par la règle »). La règle **n'a aujourd'hui aucun mécanisme d'exception** (`regleSources` exige `wayback_url`). Mécanisme minimal recommandé : champ optionnel dans `archive` (pas de bump) `wayback_exception: { motif, decide_par, decide_le }` (motif = texte non vide, `decide_par` = « Erwan Henry », date complète) ; la règle remplace l'erreur par un **avertissement informatif** `ARCHIVE_WAYBACK_EXCEPTION` (le code existe dans le catalogue de la Méthode, à ajouter) ; la Méthode dit déjà « jamais pour une page avec des données personnelles » (`methode.astro` l'a écrit en Phase 5) ; un test de piège vérifie qu'une exception sans motif échoue. **Mais** la recherche montre qu'un instantané Wayback de Rohou existe : proposer à Erwan de **ne pas utiliser l'exception pour Rohou** et d'adopter l'instantané, en gardant le mécanisme (petit) pour de futurs cas. Si Erwan maintient l'exception, il doit écrire le motif exact (le motif « données personnelles » n'est pas démontré par l'extrait versionné).
3. `BlocSource.astro` n'affiche déjà le lien Wayback que s'il existe ; afficher le motif de l'exception serait une amélioration facultative.

## Common Pitfalls

### Pitfall 1 : `PILOTE_NON_BROUILLON` bloque la première relecture
**What goes wrong:** le premier `relu` fait échouer `npm test` et la CI.
**Why:** drapeau `pilote.relecture_ouverte: false` + deux tests qui l'épinglent.
**How to avoid:** premier commit de la phase : drapeau à `true` et test adapté.
**Warning signs:** erreur `PILOTE_NON_BROUILLON` dans `tests/corpus`.

### Pitfall 2 : relu n'est pas publié
**What goes wrong:** Erwan relit tout, la production reste vide.
**Why:** `vue.ts` exige `publie` pour thème et mesures.
**How to avoid:** commande `publier` + plan de bascule explicite ; dry-run en preview ET production.

### Pitfall 3 : réécriture YAML non stable
**What goes wrong:** un `doc.toString()` reformate 25 des 134 mesures (scalaires repliés), même avec `lineWidth: 0`, ce qui viole « sans autre modification ».
**How to avoid:** édition par offsets + garde `toJS` + diff borné (Pattern 1) ; test sur les 303 fichiers réels : l'édition d'un fichier ne change que 3 lignes.

### Pitfall 4 : retrait de la seule mesure d'un candidat = CI rouge
(voir §5) `EQUITE_COUVERTURE_INCOHERENTE`. Documenter et outiller.

### Pitfall 5 : statut `relu` à date partielle
Un statut non brouillon exige `date` complète ; `laurent-wauquiez` (`2026-07`) échoue (`SCHEMA_FORMAT`). Ne concerne que la relecture des statuts `renonce`.

### Pitfall 6 : source Batho en 404
La copie Wayback ne suffit pas : le lien « document original » public serait mort. Corriger l'URL.

### Pitfall 7 : une seule cible de déploiement
`DEPLOY_CIBLE` bascule tout : après `production`, plus de déploiement `essai`. Préparer la répétition avant.

### Pitfall 8 : sonde et déploiement envoient des identifiants à un site public
Les scripts n'envoient d'identifiants que si l'utilisateur est non vide : **vider** les secrets plutôt que de les laisser (un `basic_auth` envoyé à un site sans défi circule inutilement ; les en-têtes de requête sont supprimés du journal, mais autant ne pas l'envoyer).

### Pitfall 9 : `DEPLOY_URL` absente aujourd'hui
Le test de fumée est actuellement sauté : le poser **après** l'installation du bloc, sinon le premier déploiement échoue et déclenche un retour arrière inutile.

### Pitfall 10 : texte de la Méthode et des Mentions écrits au futur
Méthode : « relues par l'éditeur avant leur publication » ; Mentions : branche `prevu`. Relire chaque phrase après `actif` (le test `data-hebergeur` fige la branche `prevu`).

### Pitfall 11 : le mode par défaut est `production` (fail-closed)
`RTP_MODE` absent = production ; la CI preview pose `preview`. Un build local sans variable produit déjà la version publique.

## Code Examples

### Garde de relecture avant écriture (schéma)
```typescript
// Source : modèle des règles content-core, load.ts (loadAll) [VERIFIED]
import { loadAll } from '../../src/lib/content-core/load.ts';
const avant = loadAll(root, { schemasDir, mode: 'production' });
// ... écriture ciblée, puis :
const apres = loadAll(root, { schemasDir, mode: 'production' });
const nouvelles = apres.diagnostics.filter((d) => d.severity === 'error' && !avant.diagnostics.some((a) => a.code === d.code && a.file === d.file && a.message === d.message));
if (nouvelles.length > 0) { /* restaurer le texte d'origine, afficher, code 1 */ }
```

### Serveur local
```typescript
// Source : modèle e2e/serveur.ts (zéro dépendance) [VERIFIED]
const jeton = randomBytes(32).toString('hex');
createServer((req, res) => {
  const hote = String(req.headers.host ?? '');
  if (hote !== `127.0.0.1:${port}` && hote !== `localhost:${port}`) { res.writeHead(421).end(); return; }
  // POST : Origin, Content-Type, taille, jeton (timingSafeEqual)
}).listen(port, '127.0.0.1');
```

### Règle liste blanche (esquisse)
```typescript
export const reglePublication: CorpusRule = {
  id: 'publication',
  run(ctx) {
    const ouverts = new Set(lirePublication(ctx.projectRoot).themes_ouverts);
    // pour chaque thème : publie && !ouverts.has(id) -> PUBLICATION_THEME_NON_OUVERT ; ouverts.has(id) && !publie -> PUBLICATION_THEME_OUVERT_NON_PUBLIE
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LCEN art. 6 III/IV/V | LCEN art. **1-1** I/II/III/IV/V ; pénalités art. 1-2 | 2024-05-23 (loi SREN 2024-449, art. 48) | Mentions et RUNBOOK doivent citer 1-1 ; le décret 2007-1527 cite encore 6 IV dans ses visas |
| Interdiction de commenter tout sondage la veille (ancienne rédaction) | idem mais les sondages publiés avant la veille peuvent rester accessibles avec date, média, institut | loi 2016-508 du 25 avril 2016 | Sans effet ici (pas de sondage) |
| Cookies et traceurs : lignes directrices | délibération 2020-091 + recommandation 2020-092 (révisions ultérieures possibles) | 2020-09-17 | Exemption « personnalisation de l'interface » ; la CNIL publie une recommandation consolidée (le dépôt de FEATURES en cite une de 2026-01 : non lue ici) |

**Deprecated/outdated:** consigne PITFALLS « corriger en art. 6 IV » (périmée) ; mention « à titre non professionnel » de la page actuelle si D-02 est maintenu.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Un freelance qui édite un projet civique bénévole peut ou non être « éditeur non professionnel » (jurisprudence de Caen citée de seconde main) | §4.3 | Mauvais choix de régime = exposition art. 1-2 (1 an, 75 000 EUR) |
| A2 | Base légale RGPD des journaux = intérêt légitime ; rétention CNIL recommandée 6 mois à 1 an (délibération 2021-122) | §4.5 | Mentions inexactes sur la finalité/durée |
| A3 | L163-2 (référé 48 h) ne couvre pas, ou couvre, la présidentielle : sources contradictoires | §4.7 | Sous-estimation du risque en période électorale |
| A4 | L52-1 / L52-8 non pertinents pour un site éditorial neutre | §4.7 | Oubli d'une obligation de période électorale |
| A5 | Limites de débit Let's Encrypt (échecs/heure, identiques/semaine) et de Save Page Now | §5, §6 | Blocage temporaire de la mise en ligne ou de la capture |
| A6 | Droit de citation et copies Wayback d'extraits de programmes ne posent pas de problème de droit d'auteur | §4.8 R8 | Risque non étudié |
| A7 | Hetzner Online GmbH est bien l'entité qui héberge le VPS (hypothèse A5 de la Phase 5) | §4.4 | Mentions fausses sur l'hébergeur |
| A8 | Le décret 2007-1527 n'a pas été modifié par la loi SREN (seule la page, sans historique, a été lue) | §4.2 | Procédure du RUNBOOK légèrement différente |
| A9 | Retirer `essai` plutôt que le garder protégé | §5.8 | Perte d'un hôte de répétition ; réversible |
| A10 | Le texte exact de l'art. 1-1 I 1° (« domicile ») s'applique à Erwan tel quel (pas de dérogation pour adresse de domiciliation) | §4.3 | Option A inadaptée |

## Open Questions

1. **Régime d'éditeur (D-02 vs LCEN 1-1 I 1°)** — Que publie Erwan : (A) régime I avec adresse professionnelle et téléphone, ou (B) régime II avec identité remise à Hetzner ? D-02 « sans adresse postale » n'est pas compatible avec le I tel que lu. À trancher **avant** d'écrire les Mentions (checkpoint humain du plan juridique) ; ne pas avancer sans réponse. Recommandation : A avec adresse de domiciliation ; faire relire par un juriste après l'ouverture.
2. **Statuts `renonce` / `pressenti`** — Les relit-il aussi (liste « ne se présentent pas ») ? Si oui, fixer la date de Wauquiez (`2026-07`).
3. **Rohou** — Adopter l'instantané existant plutôt que l'exception ? Garder le mécanisme d'exception dans tous les cas (D-08) ?
4. **Les 5 cas WR-05 de travail** — consignés comme ouverts (D-06) : confirmation.
5. **Retrait d'un thème en urgence** — la liste blanche doit-elle suivre automatiquement ?
6. **D1** (sonde externe) — déclencheur externe ou override signé dans `08-VERIFICATION.md` ? Demande de décision d'Erwan, hors code.
7. **Texte légal vs résumés** — Légifrance a été lu par résumeur ; Erwan doit relire les articles 1-1, 1-2 et le décret dans son navigateur avant signature.
8. **Volume de relecture** — 47 mesures x 4 niveaux + 37 statuts + 37 cases : la fenêtre 23 nov. - 1er déc. suffit-elle ?

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 (fnm) | relecture, tests | ✓ | `fnm exec --using=24` | — |
| `yaml`, `ajv`, `astro`, `@playwright/test` | outil, build, e2e | ✓ (node_modules) | selon `package.json` | — |
| `gh` CLI | variables, runs, approbations | ✓ | — | interface GitHub |
| `ssh keel-vps` (lecture seule) | état, copie de la build déployée | ✓ | — | — |
| `dig`, `curl` | DNS, contrôles | ✓ | — | — |
| Caddy 2.11.2 dans le conteneur `caddy` | bloc public | ✓ (Phase 8) | 2.11.2 | — |
| DNS `reveletonprog.fr` / `www` / `essai` → 178.104.105.221 | ACME, accès | ✓ | A seulement | — |
| MX/SPF/DKIM/DMARC IONOS | contact | ✓ | DMARC `p=none` | — |
| Boîte `contact@reveletonprog.fr` | LEG-01 | ✗ non vérifiable (action d'Erwan) | — | redirection IONOS |
| IPv6 (AAAA, ufw, réseaux Docker) | — | ✗ non traité | — | ne pas publier d'AAAA |
| Internet Archive (lecture) | W9 | ✓ (disponibilité et instantanés lisibles) | — | — |
| Écriture Save Page Now | W9 | non testée ici (autorisation refusée : envoi public) | — | adopter les instantanés existants |
| `pdftotext` | `archive-source.ts` PDF | non vérifié | — | — |

**Missing dependencies with no fallback:** boîte `contact@` (humain, avant le 2026-11-27).
**Missing dependencies with fallback:** IPv6 (reporté) ; Save Page Now (instantanés existants).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24) + Playwright 1.64.1 pour e2e |
| Config file | aucun (`package.json` : `"test": "TZ=Europe/Paris node --test \"tests/**/*.test.ts\""`) ; `playwright.config.ts` |
| Quick run command | `fnm exec --using=24 node --test tests/relecture/*.test.ts tests/rules/publication.test.ts` |
| Full suite command | `fnm exec --using=24 npm test` ; `npm run e2e -- --jeu reel` pour le navigateur (jamais en même temps, cache `.astro`) |
| Validation du corpus | `fnm exec --using=24 node scripts/validate.ts --mode production` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | `liste` classe à relire / relu / à revoir ; `marquer` n'écrit que 3 lignes ; échec si schéma invalide | unit + intégration (copie de fixture) | `node --test tests/relecture/marquer.test.ts` | ❌ Wave 0 |
| PUB-01 | édition par offsets : 0 octet modifié ailleurs sur les 303 fichiers réels | unit | `node --test tests/relecture/editer.test.ts` | ❌ Wave 0 |
| PUB-01 | serveur : `Host` étranger refusé (421), POST sans jeton refusé, écoute 127.0.0.1, aucun chemin client | intégration | `node --test tests/relecture/serveur.test.ts` | ❌ Wave 0 |
| PUB-01 | l'outil n'est référencé ni par `src/` ni par `astro.config.mjs` | repo | `node --test tests/repo/relecture-hors-site.test.ts` | ❌ Wave 0 |
| PUB-02 | thème `publie` hors liste = erreur ; liste vide = erreur ; liste non publie = erreur | rule (piège) | `node --test tests/rules/publication.test.ts` | ❌ Wave 0 |
| PUB-02 | production : aucune pastille/brouillon ; page thème hors liste refusée ; 0 erreur sur la copie santé | dist + check-dist | `node --test tests/dist/site.test.ts` (cas à ajouter) | ✅ à étendre |
| PUB-02 | `relecture_ouverte` vrai accepté, test adapté | corpus | `node --test tests/corpus/couverture-themes.test.ts` | ✅ à modifier |
| PUB-03 | chaque `article.mesure` en production porte relecteur + date identiques au YAML | dist | `node --test tests/dist/site.test.ts` + code `RELECTURE_ABSENTE` | ✅ à étendre |
| PUB-04 | source publiée sans Wayback ni exception = erreur ; avec exception valide = avertissement ; exception sans motif = erreur | rule (piège) | `node --test tests/rules/sources-wayback.test.ts` | ❌ Wave 0 |
| PUB-04 | schéma accepte `wayback_exception` ; 134 mesures et 104 sources valides | schéma | `node --test tests/schemas/source.test.ts` | ✅ à étendre |
| LEG-01 | `actif` ↔ phrase journal d'erreurs ; contact non provisoire sous `RTP_DEPLOIEMENT=1` ; mention du droit de réponse (art. 1-1 III) | page/dist | `node --test tests/corpus/hebergeur-config.test.ts tests/dist/site.test.ts` | ✅ à étendre |
| LEG-02 | `docs/RISQUES-JURIDIQUES.md` contient bloc de signature daté et la liste des risques R1..R9 | repo | `node --test tests/repo/risques-juridiques.test.ts` | ❌ Wave 0 |
| LEG-03 | RUNBOOK contient retrait d'urgence, piège de couverture, gel 2027 | repo | `node --test tests/repo/docs.test.ts` (cas à ajouter) | ✅ à étendre |
| DETTE-04 | empreinte de la copie déployée = empreinte de l'artefact ; journal d'audit rejoué | manuel + script | `node scripts/audit-lire.ts --dist <copie> --empreinte` | ✅ |
| Go-live | build `RTP_DEPLOIEMENT=1` réussit ; `/version.json` = commit ; en-têtes HSTS/CSP ; `www` → 301 | smoke | job `deploy` + `ops/verifier-sites.sh` | ✅ |

### Sampling Rate
- **Per task commit:** `fnm exec --using=24 node scripts/validate.ts --mode production && node --test <fichiers touchés>`
- **Per wave merge:** `fnm exec --using=24 npm test` (durée non mesurée ici : à relever) ; `npm run check` (astro check)
- **Phase gate:** `npm test`, `npm run e2e -- --jeu reel`, `check-dist` en production sur une build construite avec le vrai corpus, CI verte, déploiement `essai` répété, puis `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/relecture/{editer,marquer,serveur}.test.ts` : outil et serveur
- [ ] `tests/rules/publication.test.ts` : liste blanche (pièges + fixtures)
- [ ] `tests/rules/sources-wayback.test.ts` : exception Wayback
- [ ] `tests/repo/{relecture-hors-site,risques-juridiques}.test.ts`
- [ ] Fixture de corpus de relecture (copie de `tests/fixtures/corpus-m1`) avec un thème prêt à publier
- [ ] Adapter `tests/corpus/couverture-themes.test.ts:95` et `tests/corpus/fiches.test.ts`
- [ ] Aucune installation de framework : l'infrastructure existe.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non (outil local mono-utilisateur) ; oui pour l'accès SSH/GitHub (existant, Phase 8) | Environments GitHub, clé de déploiement forcée |
| V3 Session Management | non | jeton CSRF éphémère par lancement |
| V4 Access Control | oui | écoute loopback, contrôle `Host`, `Origin`, identifiants résolus côté serveur ; Environment `production` à relecteur requis |
| V5 Input Validation | oui | regex d'identifiants, corps plafonné, `loadAll` après écriture, échappement HTML, pas de chemin client |
| V6 Cryptography | oui (limité) | `crypto.randomBytes` + `timingSafeEqual` ; TLS par Caddy/ACME ; sha256 des archives |
| V7/V8 Logging, data | oui | journaux masqués (accès) ; mention du flux d'erreurs ; registre de relecture sans donnée personnelle |
| V14 Configuration | oui | CSP en-tête + meta, HSTS progressif, pas de `includeSubDomains` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF sur la page de relecture locale (une page web tierce poste vers 127.0.0.1) | Tampering | jeton aléatoire + `Origin`/`Sec-Fetch-Site` + POST seulement |
| DNS rebinding vers 127.0.0.1 | Spoofing / Info disclosure | contrôle strict de `Host` |
| XSS stocké (rédactions et citations venant de sites tiers) dans la page de relecture | Tampering | échappement systématique + CSP `default-src 'none'` |
| Traversée de chemin (identifiant de mesure forgé) | Tampering | résolution par liste chargée, regex, `checkContained` |
| Écriture accidentelle d'un texte de mesure | Tampering | édition par offsets + garde `toJS` + `git diff --numstat` |
| Déploiement d'un thème non relu | Elevation | liste blanche + REGLE-08 + `check-dist` + approbation |
| Secret dans le dépôt public | Info disclosure | aucun secret ajouté ; gitleaks en CI ; variables GitHub non secrètes uniquement |
| Mauvaise configuration Caddy qui coupe les autres sites | DoS | `valider-caddy.sh`, `validate` avant `reload`, jamais de redémarrage |
| Envoi d'identifiants de sonde à l'hôte public | Info disclosure | vider les secrets, scripts qui n'envoient rien sans utilisateur |

## Plan / Wave Split

La relecture humaine d'Erwan (3-4 h, plus probablement 6-8 h) est le chemin critique ; tout le reste se parallélise. Dates de la Piste 0 : relecture 23 nov. - 1er déc., risque consigné au plus tard 3 déc., ouverture vers 5 déc.

| Plan | Wave | Contenu | Dépend de | Humain |
|---|---|---|---|---|
| **09-01 Outil de relecture** | 1 | `relecture_ouverte: true` (+ test), `scripts/relecture.ts` (liste, servir, marquer, note, publier, retirer), registre hors contenu, tests, entrée RUNBOOK | — | — |
| **09-02 Garde de publication et PUB-03** | 1 | `config/publication.yml`, règle `PUBLICATION_*`, filtre `construireCorpus`, `check-dist` (`THEME_HORS_LISTE_BLANCHE`, `RELECTURE_ABSENTE`), `Mesure.astro`, Méthode, e2e | — | — |
| **09-03 W9 / PUB-04** | 1 | champ `wayback_exception` + règle + piège ; URL Batho corrigée ; instantanés Batho et Rohou ; consignation de l'écart de date | — | Erwan valide la correction d'URL et la décision Rohou |
| **09-04 Juridique** | 1-2 | checkpoint Q1 (régime), `docs/RISQUES-JURIDIQUES.md`, Mentions finales, phrase IN-06, informations RGPD, droit de réponse RUNBOOK (décret 2007-1527) | décision Q1 | Erwan : décision régime, relecture des articles, **signature** |
| **09-05 Infra et exercice** | 2 | préparation des écritures serveur (blocs, `battement.env`, variables), `favicon.ico`, RUNBOOK retrait d'urgence + gel, exercice chronométré sur `essai`, script de copie de la build déployée pour l'audit | 09-01 (retirer) | Erwan approuve chaque écriture serveur ; test du contact |
| **09-06 Relecture d'Erwan** | 2-3 (humain, en parallèle) | `servir`, relire 47 mesures, 37 statuts, 37 cases (dont 3 WR-05 de santé), notes, `marquer` ; corrections de texte par Erwan seul ; puis `publier --theme sante` | 09-01 ; 09-03 pour `publier` | **Erwan, 23 nov. - 1er déc.** |
| **09-07 Ouverture** | 4 (dernier, séquentiel) | hébergeur `actif`, contact réel, `publication.yml` + `publie`, `DEPLOY_CIBLE=production`, premier déploiement approuvé, bloc Caddy, certificats, `www`, supervision réorientée, retrait `essai`, DETTE-04, VERIFICATION | tout ; signature de la note ; test contact ; relecture terminée | Erwan : approbations, clic final |

Après l'ouverture (hors plan) : HSTS à 31536000 après ≥ 7 jours stables ; suppression de `essai/` ; relecture juridique par un juriste ; D1.

## Sources

### Primary (HIGH confidence)
- Dépôt (lecture et exécution locale, 2026-11-10) : schémas, `rules/equite.ts`, `rules/archives.ts`, `corpus/vue.ts`, `scripts/lib/pilote.ts`, `scripts/validate.ts`, `scripts/check-dist.ts`, `scripts/render-caddy.ts`, `deploy/caddy/*.caddy`, `.github/workflows/ci.yml`, `sonde.yml`, `ops/battement.sh`, `docs/ARCHITECTURE.md` (ADR-041, 049, 053 à 058), `docs/RUNBOOK.md`, `docs/AUDIT-TEST-CROISE.md`, Phase 8 VERIFICATION/HUMAN-UAT/REVIEW.
- Dry-run : copie dans `/tmp/rtp-dry` (validate production, build, check-dist) ; `dig`, `ssh keel-vps` en lecture, `gh run/variable list`, API de disponibilité de web.archive.org, `curl` des pages Batho et MEI.
- Docs `yaml` 2.9.1 (Document, `node.range`) : comportement vérifié par essai local.

### Secondary (MEDIUM confidence)
- LCEN art. 1-1 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614 (résumé par outil, 2026-11-10)
- LCEN art. 1-2 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049568616
- Décret 2007-1527 : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000428279
- Code électoral L49 : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039446215 ; CNCCEP : https://www.cnccep.fr/pdf-cp15.html
- Loi 77-808 art. 11 : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000032454547
- CNIL, lignes directrices 2020-091 : https://www.cnil.fr/sites/default/files/atoms/files/lignes_directrices_de_la_cnil_sur_les_cookies_et_autres_traceurs.pdf ; page citée par le site : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi
- Hetzner mentions légales : https://www.hetzner.com/legal/legal-notice/ (consulté le 2026-11-10)

### Tertiary (LOW confidence)
- Lexbase et cabinets pour L163-2 (applicabilité à la présidentielle contradictoire)
- `.planning/research/FEATURES.md` et `PITFALLS.md` (délibération CNIL 2021-122, jurisprudence de Caen) : non revérifiés

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH (aucune dépendance nouvelle, outils existants lus)
- Modèle de données et publication : HIGH (schémas lus, dry-run exécuté)
- Architecture de l'outil de relecture : HIGH sur le mécanisme (offsets testés), MEDIUM sur le volume réel
- Juridique : MEDIUM (résumés de Légifrance) ; régime d'éditeur et L163-2 : LOW à MEDIUM
- Ouverture : MEDIUM-HIGH (procédure Phase 8 reprise ; limites de débit ACME non reconfirmées)
- Pitfalls : HIGH pour ceux reproduits (PILOTE_NON_BROUILLON, retrait de la seule mesure, reformatage YAML, Batho 404)

**Research date:** 2026-11-10
**Valid until:** 2026-12-05 (ouverture) pour l'état du dépôt, de Batho et de Wayback ; les textes légaux sont stables 30 jours mais à relire avant signature.
