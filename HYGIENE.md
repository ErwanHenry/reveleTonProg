# Les 10 règles d'hygiène

Chaque règle a : **Pourquoi**, **Comment**, **Signal d'échec**.

---

## 1. Code versionné sur Git distant — toujours

**Pourquoi.** Une VM se supprime, un disque casse. Git distant (GitHub privé) est la source de vérité.

**Comment.**
- `git init` dès la première ligne, push sur GitHub privé dans la première heure
- 1 repo par projet, branche `main` protégée
- Commits petits et descriptifs (Conventional Commits : `feat:`, `fix:`, `chore:`)

**Signal d'échec.** Plus de 24 h sans push.

---

## 2. Secrets jamais en clair, jamais commités

**Pourquoi.** Un secret leak = compte cramé, client cramé, parfois RGPD.

**Comment.**
- `.env` dans `.gitignore` dès la création du repo
- `.env.example` commité avec des placeholders explicites
- Secrets stockés dans **Vaultwarden** (ou Trousseau macOS)
- Pour le VPS : variables d'environnement systemd ou Docker secrets
- Audit `git log -p | grep -iE "key|token|password|secret"` avant chaque push de branche sensible

**Signal d'échec.** Une clé apparaît dans un `git log`.

---

## 3. README qui répond à 5 questions

**Pourquoi.** Quand je reviens dans 6 mois, je ne dois pas réfléchir.

**Comment.** Le README répond *toujours* à :

1. **À quoi sert ce projet ?** (1 phrase)
2. **Pour qui ?** (client, moi-même)
3. **Quelle stack ?** (n8n, Node, Python, VPS, etc.)
4. **Comment le lancer en local ?** (commandes copier-coller)
5. **Où sont les secrets et la doc d'archi ?**

**Signal d'échec.** Quelqu'un lit le README et doit me poser une question pour démarrer.

---

## 4. ARCHITECTURE.md à jour

**Pourquoi.** Comprendre les choix techniques sans relire tout le code.

**Comment.**
- Schéma simple en ASCII ou Mermaid
- Liste des composants (scraper, queue, db, notifs)
- Décisions clés en format ADR court (Contexte / Décision / Conséquence)

**Signal d'échec.** Un nouveau composant ajouté sans mention dans `ARCHITECTURE.md`.

---

## 5. RUNBOOK.md pour l'opérationnel

**Pourquoi.** Quand un cron casse à 3h du mat', je veux la procédure, pas la réflexion.

**Comment.** Le runbook contient :
- Comment redémarrer le service
- Où sont les logs
- Comment relancer un job manuellement
- Comment restaurer un backup
- Numéros utiles (host VPS, DNS, etc.)

**Signal d'échec.** Un incident où je perds plus de 15 min à chercher où sont les logs.

---

## 6. Backups réguliers et testés

**Pourquoi.** Un backup non testé n'est pas un backup.

**Comment.**
- Données critiques (DB, configs n8n) → dump quotidien automatisé
- Stockage chiffré hors VPS (S3, Backblaze, ou même Drive perso chiffré)
- **Test de restauration tous les 1er du mois** (ajouter au calendrier)
- Rétention : 7 daily, 4 weekly, 3 monthly

**Signal d'échec.** Plus de 30 jours sans tester une restauration.

---

## 7. Logs structurés et centralisés

**Pourquoi.** Sans logs, debugger c'est deviner.

**Comment.**
- Format JSON ligne par ligne (`pino` en Node, `loguru` en Python)
- Niveaux : `debug` / `info` / `warn` / `error`
- Rotation : 7 jours sur disque, plus long en archive si critique
- En option : centraliser via Loki / Grafana ou Better Stack

**Signal d'échec.** Un bug en prod et impossible de retracer la cause.

---

## 8. Monitoring + alerting basique

**Pourquoi.** Apprendre par le client qu'un service est down = perdre un client.

**Comment.**
- Healthcheck HTTP sur chaque service
- Uptime monitor externe (Uptime Kuma, Better Stack, ou Healthchecks.io)
- Alerte sur Telegram/WhatsApp/email
- Pour les jobs cron : utiliser **Healthchecks.io** (ping après chaque exécution)

**Signal d'échec.** Apprendre une panne via le client.

---

## 9. Documentation du déploiement reproductible

**Pourquoi.** Si le VPS crame, je dois pouvoir le reconstruire en 1 h.

**Comment.**
- `docker-compose.yml` versionné OU script bash idempotent `bootstrap.sh`
- Variables d'env documentées dans `.env.example`
- DNS et certificats (Caddy / Let's Encrypt) dans le compose
- Sauvegarde du compose et des configs n8n exportées

**Signal d'échec.** Reconstruire un service prend plus de 2 h.

---

## 10. Revue mensuelle d'hygiène (15 min)

**Pourquoi.** L'hygiène se dégrade silencieusement.

**Comment.** Le 1er de chaque mois, parcourir `CHECKLIST.md` pour chaque projet actif.
Notes dans `docs/RETROSPECTIVE.md` :
- Ce qui s'est cassé
- Ce que j'ai appris
- 1 amélioration à appliquer le mois suivant

**Signal d'échec.** Plus de 2 mois sans rétro = je sais que la dette s'accumule.

---

## Bonus — règles spécifiques Cowork / Claude

### Modèle mental : la VM Cowork est jetable

**Différence clé avec Windows** : sur Windows, les outils de nettoyage (Storage Sense, Cleanmgr, CCleaner) ont des cibles précises (caches, temp, corbeille) et ne touchent **jamais** ton dossier `C:\Users\…\Projets\`. Le nettoyage est granulaire et tes fichiers personnels sont sanctuarisés.

Sur Cowork, ce qui s'appelle "supprimer la VM" ou "libérer l'espace" détruit **l'intégralité du filesystem** de la VM Linux côté Anthropic. Il n'y a pas de distinction interne entre "fichiers système jetables" et "mes projets précieux" — tout vit dans `/sessions/<nom>/` et part ensemble. C'est l'équivalent de formater C:\ entier sur Windows.

→ **Règle d'or** : traiter chaque VM Cowork comme un **espace de travail temporaire**, jamais comme un stockage. Si quelque chose doit survivre à la prochaine suppression, il est :
- soit committé dans un **repo Git distant** (GitHub privé)
- soit dans un **workspace local monté** (`request_cowork_directory` sur un dossier de ta machine)
- soit dans un **skill** (qui vit en stockage persistant côté Anthropic, lecture seule, indépendant de la VM)

### Avant de supprimer une VM Cowork

Checklist mentale obligatoire :
- [ ] Tous les fichiers utiles sont dans un repo Git pushé
- [ ] Les skills custom modifiés sont synchronisés (`~/.claude/skills/<nom>/`)
- [ ] Les outputs récents sont copiés dans un workspace local
- [ ] Les credentials utilisés en session sont dans Vaultwarden (pas seulement en mémoire VM)

### Autres règles Cowork

- Tout skill custom (comme `jarvi`) est **versionné dans son propre repo Git** et synchronisé dans `~/.claude/skills/`
- Les outputs Cowork importants sont sauvegardés dans un dossier workspace **local** sélectionné, jamais laissés dans la VM
- Les configs `.claude.json` et plugins activés sont notés dans `docs/COWORK-SETUP.md` du projet
- En fin de session importante : `git status && git push` est le **dernier réflexe** avant de fermer

### Pourquoi le skill `jarvi` a survécu (apprentissage 2026-04-19)

Lors de la suppression de la VM, tous les transcripts et outputs ont disparu, mais `~/.claude/skills/jarvi/` est resté intact. La raison : les skills sont montés en `dr-x------` (lecture seule) depuis un stockage persistant côté Anthropic, **séparé** du filesystem de la VM. C'est leur principal avantage : capturer la connaissance procédurale là où elle est résiliente.
