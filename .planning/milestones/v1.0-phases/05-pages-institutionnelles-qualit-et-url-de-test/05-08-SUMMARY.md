---
phase: 05-pages-institutionnelles-qualit-et-url-de-test
plan: 08
subsystem: gate
tags: [gate, test-url, walkthrough]
requires: [05-07]
requirements-completed: [QUAL-05]
provides: [final gate on main, test URL (CI artifact and local preview), walk-through of the pilot corpus]
affects: [src/pages/methode.astro]
key-files:
  modified:
    - src/pages/methode.astro
decisions:
  - "Walk-through performed by the orchestrator on Erwan's behalf (maximum autonomy requested), in the app's built-in browser on the local preview; Erwan's own pass remains welcome before Lot 3"
  - "Méthode now says the coverage table is the theme-selection survey and that a principle-only statement is shown « Non précisé » at writing time (explains 27 surveyed vs 24 and 22 published positions)"
metrics:
  tasks: 2
  completed: 2026-11-04
---

# Phase 5 Plan 08: Final gate, test URL and walk-through Summary

Every gate command passed on main, the test URL exists in two forms (CI artifact `site-preview` and a local gzip preview), and the pilot corpus was walked end to end by the orchestrator for Erwan. One gap found and fixed on Méthode (survey counts versus published counts).

## Task 1: gate and test URL

Gate on `2f77720` (main), run sequentially, every exit code 0:

| Command | Exit |
|---|---|
| `npm run migrate -- --check` | 0 |
| `npm run validate -- --mode production` | 0 |
| `npm run ids -- --check` | 0 |
| `npm run check` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run check-dist` | 0 |
| `npm run build -- --outDir dist-reel` | 0 |
| `npm run check-dist -- --dist dist-reel --mode production` | 0 |
| `RTP_MODE=preview npm run build -- --outDir dist-preview` | 0 |
| `npm run check-dist -- --dist dist-preview --mode preview` | 0 |
| `npm run e2e` | 0 (fixture and real corpus, 1032 passed on the real corpus) |

Test URL:

- CI artifact: `site-preview`, run https://github.com/ErwanHenry/reveleTonProg/actions/runs/41841106109 (head `2f77720`), download `https://api.github.com/repos/ErwanHenry/reveleTonProg/actions/artifacts/13329466328/zip`, 316 599 bytes, expires 2026-11-18T13:48:45Z.
- Local preview: `node e2e/serveur.ts dist-preview 4173`, `http://127.0.0.1:4173/`: 200 with `content-encoding: gzip`, `noindex` present once, the three institutional pages answer 200.

## Task 2: walk-through (orchestrator, for Erwan, 2026-11-04)

| Step | Expected | Seen |
|---|---|---|
| 1. Hall | preview banner, footer dates | « Version de prévisualisation : contenus non relus, ne pas diffuser. » ; footer « 18 avril 2027 » and « 2 mai 2027 » |
| 2. Themes | each perimeter candidate has a card or a typed dated empty state; levels switch; source and archived copy open | santé, travail, Europe et monde: 37 cards each, 0 card without a measure or a dated empty state (santé 27 + 10, travail 24 + 13, Europe 22 + 15). « Pour les enfants »: 27 child texts shown, others hidden, `rtp:niveau` stored. « Gros caractères »: text at 22 px, « Ce qui me concerne » shown. Arthaud source: original PDF, Wayback copy, extract link; the local extract's sha256 starts with `df65b7989e57` and contains the quotation (across a line break, normalised by the validator) |
| 3. Candidate page and back | opens and returns | `/candidats/nathalie-arthaud/#sante` (sections Ce qui me concerne, Santé, Travail, Europe et monde), back to `/themes/sante/` with the level kept |
| 4. Méthode | forbidden words, word bounds, 59/51 gap, pilot ranking, limits, neutral tone | all present; no judgement word found. Gap: the coverage table shows 27 positions for travail and Europe, the pages publish 24 and 22 (see below) |
| 5. Mentions légales | publisher and director, no personal address, Hetzner and « pas mise en ligne », right of reply, storage keys, no cookie | all present: « Cette version de test n'est pas mise en ligne … », `rtp:niveau`, `rtp:ordre`, « trois jours »; no street address of the publisher |
| 6. Qui sommes-nous | no third-party brand, no donation | none; « ne demande aucun argent aux visiteurs » |
| 7. Audit verdict | read | « prêt pour la relecture du Lot 2, pas prêt pour une publication » with content list C1 to C6 |

Resume signal: « approved » by the orchestrator acting for Erwan, with one gap fixed:

- **Gap (Méthode, fixed).** 8 candidates surveyed « partiel » on 2026-11-03 were written « non précisé » under the rule « énoncé de principe sans engagement concret → non_precise » (03-08-LOTS: travail Batho, Mikolajczak, Polony; Europe Dubuisson, Labib, Mélenchon, Mikolajczak, Polony). The rule was applied but Méthode did not say it, so a reader saw 27 in the table and 24 or 22 on the page. A sentence after the pilot list now explains it. Erwan may still review these 8 cases (content, not changed here).

Local server stopped after the walk-through.

## Deviations

- `src/pages/methode.astro` edited although the plan lists no file: fix of the walk-through gap, a Phase 5 page.

## Self-Check: PASSED
