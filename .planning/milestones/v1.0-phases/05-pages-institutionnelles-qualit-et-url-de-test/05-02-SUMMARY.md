---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 02
subsystem: institutional-pages
tags: [mentions-legales, lcen, footer, config]
requires: []
provides: [mentions-legales page, qui-sommes-nous page, TOURS, CLES_STOCKAGE, PROFIL_4G, loadHebergeurConfig]
affects: [05-04, 05-05]
key-files:
  created:
    - config/hebergeur.yml
    - src/lib/hebergeur-config.ts
    - src/lib/dates-tours.ts
    - src/lib/profil-4g.ts
    - src/lib/stockage-local.ts
    - src/pages/mentions-legales.astro
    - src/pages/qui-sommes-nous.astro
    - tests/dist/cas/institutionnel.cas.ts
    - tests/corpus/hebergeur-config.test.ts
    - tests/ui/constantes-publiques.test.ts
  modified:
    - src/layouts/Base.astro
    - src/styles/pages.css
requirements-completed: [INST-02, INST-03, INST-04]
completed: 2026-11-03
---

# Phase 5 Plan 02: Pages institutionnelles Summary

Mentions légales (LCEN art. 1-1, hôte lu dans config/hebergeur.yml avec garde RTP_DEPLOIEMENT), Qui sommes-nous sans marque tierce ni don, et dates des deux tours dans le pied de page de toutes les pages, plus trois modules de constantes partagés.

## Commits
- 246c8ea test(05-02): RED build cases (institutionnel.cas.ts)
- b3c4898 feat(05-02): pages, config, reader, constants, footer

## Verification
- tests/ui + hebergeur-config: 44 pass; tests/dist/site.test.ts: 112 pass (all pre-existing cases included); `npm run check`: 0 errors.
- Hetzner identity re-verified 2026-11-03 on https://www.hetzner.com/legal/legal-notice/ (Industriestr. 25, 91710 Gunzenhausen, +49 (0)9831 505-0, Ansbach HRB 6089): identical to RESEARCH.
- Round dates source: Service-Public.fr F1939 (https://www.service-public.fr/particuliers/vosdroits/F1939, consulted 2026-11-03) filled in `SOURCE_DATES`; linked from the footer.
- Légifrance returned HTTP 403 to curl, so art. 1-1 was not re-read; the wording relies on the RESEARCH citation (consulted 2026-11-03).

## Deviations
- [Rule 1] Initial padding 1.25rem in pages.css broke the 4/8/16/24/32/48/64 px scale test; changed to 1.5rem.
- Real-corpus preview `check-dist` reports 1 error `THEME_INATTENDU themes/sante/index.html` (and CONTACT_PROVISOIRE warnings, expected). Pre-existing, caused by the Phase 3 sante content versus the couverture list in this base; out of scope (not touched). The acceptance criterion "exits 0" is therefore not met for the real corpus; the fictional M1 builds (site.test.ts) have 0 errors.

## Decisions
- `hebergeur-config` memoises the file content only; the RTP_DEPLOIEMENT guard runs on every call.
- Footer institutional links get `aria-current="page"` on their own page.

## Known Stubs
None. Contact is the existing provisional `.invalid` address (Lot 3).

## Self-Check: PASSED
