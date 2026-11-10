---
phase: 09-contenu-relu-juridique-et-ouverture
plan: 04
subsystem: juridique, pages institutionnelles, configuration
tags: [mentions-legales, lcen, rgpd, journaux, note-de-risques, contact]

requires:
  - phase: 08
    provides: src/lib/journal-acces.ts, deploy/compose/docker-compose.override.yml (json-file 10m x 3), check-dist HEBERGEUR_PREVU
  - phase: 07
    provides: config/site.yml strict reader, CONTACT_PROVISOIRE guard
provides:
  - Final Mentions légales for regime II (LCEN art. 1-1 II), host-status aware
  - phraseSortieErreur(), TAILLE_SORTIE_ERREUR_MIO, FICHIERS_SORTIE_ERREUR (tied by test to the compose override)
  - Real public contact in config/site.yml (contact@ of the site domain)
  - docs/RISQUES-JURIDIQUES.md (R1 to R9, unsigned) and its structure test
affects: [09-08, 09-09, 09-11, 09-12]

tech-stack:
  added: []
  patterns:
    - "Legal sentences that depend on the server being live render only under heb.statut === 'actif'; a source-level test pins their branch while the repository is prevu"
    - "Signature-block test accepts both the unsigned (« à compléter ») and the signed (AAAA-MM-JJ + « risque accepté ») states"

key-files:
  created:
    - tests/dist/cas/mentions-finales.cas.ts
    - docs/RISQUES-JURIDIQUES.md
    - tests/repo/risques-juridiques.test.ts
  modified:
    - src/pages/mentions-legales.astro
    - src/lib/journal-acces.ts
    - config/site.yml
    - tests/ui/journal-acces.test.ts
    - tests/corpus/site-config.test.ts
    - tests/dist/cas/institutionnel.cas.ts

key-decisions:
  - "The « Relecture juridique » section is a plain section in both host states (not data-hebergeur=prevu); HEBERGEUR_PREVU still fires on the two remaining prevu elements"
  - "The RGPD paragraph sits after the CNIL localStorage paragraph (not between the list and it) so « Ces réglages » keeps its referent"
  - "The two evidence lines of the note carry Erwan's dates (2026-11-10) instead of « à compléter », per the orchestrator's facts; the fifth « à compléter » comes from two extra signature lines (date the texts were read, later lawyer review)"
  - "The note links only Légifrance and CNIL URLs; L163-2 is cited without a link because the research did not record one"

requirements-completed: [LEG-01]

duration: 45min
completed: 2026-11-10
---

# Phase 9 Plan 04: Mentions légales finales et note de risques Summary

**The Mentions légales now state the non-professional publisher regime (LCEN art. 1-1 II). The identity sentence, both server log sentences (14-day access log with truncated IP; error output with full IP, capped at 30 Mio and not in time) and an RGPD paragraph appear only once the host is `actif`. The public contact is the real address. `docs/RISQUES-JURIDIQUES.md` lists R1 to R9 and is ready for Erwan to sign.**

## Accomplishments

- `src/lib/journal-acces.ts`: `TAILLE_SORTIE_ERREUR_MIO = 10`, `FICHIERS_SORTIE_ERREUR = 3`, `phraseSortieErreur()` (one sentence, figure computed from the constants). A test reads `deploy/compose/docker-compose.override.yml` and compares `max-size` and `max-file` with them.
- Mentions légales: link to art. 1-1 on Légifrance in Éditeur; `data-identite-hebergeur` paragraph under `actif` only; décret 2007-1527 sentence (passages contestés, texte de la réponse, 200 lignes au plus); `data-sortie-erreur` item after the access-log item; `data-rgpd` paragraph (responsable, finalité, base légale art. 6.1.f, droits, réclamation CNIL with link); section `data-relecture-juridique` replacing « relues par un juriste avant la mise en ligne »; `REVISION = '2026-11-10'`; Phase 9 deferral comment removed. No « 6 IV », no `tel:`, no address, no link to or mention of the risk note.
- `config/site.yml`: `contact: contact@reveletonprog.fr`, comment rewritten. The build no longer warns about a provisional contact; `check-dist` on a production build shows no CONTACT_PROVISOIRE and still shows HEBERGEUR_PREVU (warning) on mentions-legales and methode.
- Risk note: header, scope and limits (medium confidence, summariser reading, six texts to read in a browser), table R1 to R9 with eight columns, known limitation (replies from the publisher's personal mailbox, remedy: real IONOS mailbox or « envoyer en tant que »), linked procedures, domiciliation switch (three triggers, regime I with domiciliation address and dedicated number, only for the future, first point for a lawyer), A1 to A10, follow-up, unsigned signature block with the two dated evidence lines.

## Task Commits

1. **Task 1: final Mentions légales, both log sentences, real contact**: `08a5690` (feat)
2. **Task 2: legal risk note R1 to R9 with its signature block**: `8e7e21b` (docs)

## Verification

- Task 1 verify: journal-acces, site-config, hote-en-dur: 81 pass, 0 fail; dist pattern `mentions|institutionnel`: 18 pass, 0 fail. Acceptance greps: contact line 1, « 6 IV » 0, phraseSortieErreur 2, RISQUES-JURIDIQUES 0.
- Task 2 verify: risques-juridiques + docs: 68 pass, 0 fail. `^\| R[1-9] ` = 9; « à compléter » on 5 lines; 103 lines.
- `npm test`: 2384 tests, 2375 pass, 0 fail, 9 skipped. `npm run check`: 0 errors, 0 warnings, 0 hints. `npm run validate -- --mode production`: 391 files, 0 errors, 25 warnings (unchanged). `npm run e2e -- --jeu m1`: 259 passed. Full `npm run e2e`: 1177 passed (m1 OK, reel OK).
- `git status --porcelain src/content archives`: empty.

## Deviations from Plan

**1. [Orchestrator facts] Evidence lines filled with dates instead of « à compléter »**
- The plan asked for two evidence lines with « à compléter ». Erwan's facts (09-08-NOTES.md) give the dates, and the orchestrator asked for the exact line « Identité transmise à l'hébergeur le 2026-11-10 ». The lines carry the dates; the proofs stay outside the repository. To keep at least five « à compléter », the signature block has two extra lines (date the texts were read on Légifrance, later lawyer review). Signataire, Date and Mention stay « à compléter ».

**2. [Rule 1 - Bug in my own test, fixed before commit] Signature-block reader**
- The first version read `Date :` from the whole note and would have picked the header date. The reader now works on the signature section only.

No other deviation. `config/hebergeur.yml`, `docs/RUNBOOK.md`, `src/content/**` and `archives/**` were not touched. No new dependency.

## Known Stubs

None. The `actif` branches are dormant by design until 09-11 sets the host to `actif`; they are covered by source-level tests now and by `mentions-finales.cas.ts` once the repository is `actif`.

## Notes for later plans

- 09-09: `docs/RUNBOOK.md` « Droit de réponse » still says the contact is the `.invalid` value; it now is the real address.
- 09-08: Erwan reads the six linked texts and the points listed under « Périmètre et limites », then fills Signataire, Date, Mention and the reading date.

## Threat Flags

None beyond the plan's threat model (T-09-17 to T-09-22 mitigated as planned).

## Self-Check: PASSED

Created files exist; commits 08a5690 and 8e7e21b exist.
