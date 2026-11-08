---
phase: 06-diagnostic-du-vps-et-d-cision
plan: 01
subsystem: ops
tags: [vps, diagnostic]
requirements-completed: [HEB-03, HEB-04]
key-files:
  created:
    - ops/diagnostic-vps.sh
    - tests/repo/diagnostic-vps.test.ts
    - .planning/phases/06-diagnostic-du-vps-et-d-cision/06-RAPPORT-VPS.md
metrics:
  completed: 2026-11-07
---

# Phase 6 Plan 01: Diagnostic du VPS Summary

Script de diagnostic en lecture seule, testé par liste blanche, lancé sur `ubuntu-4gb-nbg1-2` (identité vérifiée par `hostname` avant le relevé). Rapport chiffré dans `06-RAPPORT-VPS.md` : disque système à 58 % (42 % de marge, au-dessus des 30 % de HEB-04 sans rien supprimer), RAM disponible 1,27 Go avec 1 Go de swap utilisé, rsync 3.2.7 et rrsync présents, IPv6 présente. Caddy tourne dans un conteneur Docker sans dossier de site monté : la Phase 8 devra ajouter un montage et recréer le conteneur une fois (courte coupure des sites qu'il sert).

Recommandation : garder l'instance pour le Lot 3 ; nettoyage Docker et journaux possible mais non requis ; instantané Hetzner par Erwan avant toute modification.

## En attente (Erwan)

- Décision écrite dans `06-RAPPORT-VPS.md` (garder, nettoyer, monter en gamme) : HEB-03 complet, HEB-04 conditionné à l'instantané.
- Vérifier les sauvegardes Hetzner dans la console et prendre l'instantané avant la Phase 8.

## Verification

- `node --test tests/repo/diagnostic-vps.test.ts` : 3/3.
- `bash -n ops/diagnostic-vps.sh` : syntaxe valide ; exécution sur le VPS : code 0.
