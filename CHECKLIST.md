# Checklist hygiène — à cocher par projet

Copie cette checklist dans chaque projet (ou lien symbolique). Coche au fur et à mesure.

## Setup initial (à faire une fois)

- [ ] Repo Git créé sur GitHub (privé) et pushé
- [ ] `.gitignore` inclut `.env`, `node_modules/`, `__pycache__/`, `*.log`, `.DS_Store`
- [ ] `.env.example` créé avec toutes les variables nécessaires (placeholders)
- [ ] Secrets réels stockés dans Vaultwarden sous le coffre du projet
- [ ] `README.md` répond aux 5 questions (voir HYGIENE règle 3)
- [ ] `ARCHITECTURE.md` rédigé avec schéma
- [ ] `RUNBOOK.md` rédigé avec procédures de base
- [ ] `docs/COWORK-SETUP.md` (si projet utilise Claude/Cowork)

## Run / Production

- [ ] Service tourne en `docker-compose` ou systemd (pas en `node app.js` à la main)
- [ ] Logs au format structuré, rotation activée
- [ ] Healthcheck endpoint OU ping Healthchecks.io
- [ ] Uptime monitoring externe configuré
- [ ] Alertes vers canal préféré (Telegram, WhatsApp, email)

## Backups

- [ ] Backup quotidien automatisé (cron)
- [ ] Stockage hors VPS (S3 / Backblaze / Drive)
- [ ] Chiffrement au repos
- [ ] **Restauration testée le _____** (date du dernier test)

## Mensuel (1er du mois)

- [ ] Test de restauration backup
- [ ] Audit secrets (`git log -p | grep -iE "key|token|secret"`)
- [ ] Mise à jour dépendances critiques (`npm audit`, `pip-audit`)
- [ ] Rétro courte dans `docs/RETROSPECTIVE.md`

## Avant d'archiver un projet

- [ ] README contient l'état "ARCHIVÉ le _____"
- [ ] Backup final stocké hors ligne
- [ ] Secrets supprimés des envs actifs
- [ ] Repo passé en archive sur GitHub
