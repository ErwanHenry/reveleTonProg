# Phase 6: Diagnostic du VPS et décision - Context

**Gathered:** 2026-11-07
**Status:** Executed by the orchestrator (small phase, standard patterns, no dedicated research)

<domain>
Erwan sait ce que le VPS peut porter et a tranché par écrit, sans modification de la machine avant un instantané. Exigences : HEB-03, HEB-04.
</domain>

<decisions>
- **D-01:** Script versionné `ops/diagnostic-vps.sh`, envoyé par `ssh <hôte> 'bash -s'`, en lecture seule ; un test de dépôt refuse toute commande qui modifie la machine et toute redirection hors de `/dev/null`.
- **D-02:** Le rapport brut nomme d'autres sites et services d'Erwan : il ne va jamais dans le dépôt public. Le dépôt reçoit un rapport chiffré anonymisé (`06-RAPPORT-VPS.md`).
- **D-03:** Aucune action sur la machine dans cette phase (ni nettoyage, ni mise à jour, ni instantané) : l'instantané Hetzner et la décision sont des actions d'Erwan.
</decisions>
