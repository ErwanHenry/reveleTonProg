---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
plan: 08
subsystem: ui
tags: [astro, order, fisher-yates, crypto, localStorage, css, accessibility]

requires:
  - phase: 04-03
    provides: theme page lists with data-ordonnable / data-rang
  - phase: 04-06
    provides: /candidats/ list with data-ordonnable / data-rang, Base layout
provides:
  - "src/scripts/ordre.js (1722 bytes): classic head script, unbiased random order, rtp:ordre only"
  - "OrdreCandidats component (help text + hidden order control) on theme pages and /candidats/"
  - "ordre.css: pending-shuffle hiding with the rtp-reveler 1.5 s safety net"
affects: [04-09]

tech-stack:
  added: []
  patterns:
    - "Hidden-in-HTML control revealed by script; help text always visible; no-JS sentence hidden through an attribute on <html>"
    - "Pending shuffle: visibility hidden (no layout shift) + CSS animation reveal as a safety net, not gated by prefers-reduced-motion"

key-files:
  created:
    - src/scripts/ordre.js
    - src/components/OrdreCandidats.astro
    - src/styles/ordre.css
    - tests/browser-js/ordre.test.ts
    - tests/dist/cas/ordre.cas.ts
  modified:
    - src/layouts/Base.astro
    - src/pages/themes/[id].astro
    - src/pages/candidats/index.astro

key-decisions:
  - "On change the radio value is normalised: only the exact string aleatoire enables random mode, anything else is alphabetical (the research prototype stored the raw value)"
  - "No DocumentFragment in ordre.js: nodes are re-appended directly in the same synchronous task (saves bytes, no visible difference)"
  - "Theme page DOM: the component emits three direct siblings (two help paragraphs and the hidden control div) so the control sits between p.couverture and the h2 without a wrapper"

patterns-established:
  - "Rejection sampling is tested with a fake crypto.getRandomValues feeding a fixed sequence, plus a chi-squared test (60 000 draws) with the real one"

requirements-completed: [M1-07]

duration: 25min
completed: 2026-11-03
---

# Phase 4 Plan 08: Order of candidates Summary

**Alphabetical order by default and without JavaScript, optional random order with JavaScript through a Fisher-Yates shuffle over `crypto.getRandomValues` with rejection sampling, remembered under `rtp:ordre` only.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2/2
- **Files:** 5 created, 3 modified

## Accomplishments

- `ordre.js` is 1722 bytes (limit 2048), no comment, no `Math.random`, a single `getRandomValues` call, the single storage key `rtp:ordre`.
- vm tests (25): stored value handling (absent, empty, wrong case, trailing space, hostile `"]x`, throwing localStorage), synchronous `data-ordre` before DOMContentLoaded, numeric `data-rang` sort (10 after 9), change events and announcements, chi-squared on positions 1, 5 and 6 over 60 000 draws (threshold 20.52), rejection sampling with a fixed fake sequence (the rejected value never becomes an index).
- `OrdreCandidats.astro`: help paragraph and « L'ordre aléatoire demande JavaScript. » always in the HTML, `div[data-ordre-controle][hidden]` with the fieldset, 2 radios (`ordre-alpha` checked, `ordre-alea`) and a `role="status"` region. Placed after `p.couverture` and before the « Les candidats » h2 on theme pages, after the intro and before the list on `/candidats/`.
- `ordre.css`: `html[data-ordre="aleatoire"] [data-ordonnable]:not([data-ordre-fait])` hidden with `visibility` and revealed by `@keyframes rtp-reveler` after 1.5 s; `html[data-ordre-js] .ordre-aide-sansjs { display: none }`; radio visuals duplicated from the level toggle (does not depend on niveaux.css), forced-colors variant.
- Built-page assertions in `ordre.cas.ts` (production and preview `checkDist`, no error).
- bfcache: nothing to write, a restore keeps the DOM and the script does not run again, so the order is not reshuffled.

## Task Commits

1. **Task 1: ordre.js with vm tests** - `5cb3041` (feat)
2. **Task 2: control, head script, CSS, built-page assertions** - `fe7bd00` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Script/stylesheet order in `<head>`**
- **Found during:** Task 2 (ordre.cas, first build)
- **Issue:** the plan asks for the script « after the stylesheet link ». Astro emits `is:inline` scripts of `<head>` before its own `<link rel="stylesheet">` tags, so the order cannot be obtained without changing Astro's head injection. The script reads no style, so the order has no functional effect: the hiding rule only needs the CSS before first paint, which holds because stylesheets block rendering.
- **Fix:** the cas asserts that the script is in `<head>` (hence before `<body>`), blocking (no async/defer/type), without body, hashed, identical to the source, and that a stylesheet link exists in the same `<head>`.
- **Files modified:** `tests/dist/cas/ordre.cas.ts`
- **Commit:** `fe7bd00`

**2. [Rule 1 - Bug] Minified `animation` shorthand**
- **Found during:** Task 2
- **Issue:** the build reorders the shorthand (`animation: 0s 1.5s forwards rtp-reveler`), so the planned literal match failed.
- **Fix:** the cas checks the four components independently.
- **Commit:** `fe7bd00`

**3. [Rule 2 - Security] Radio value normalised on change (T-04-34)**
- The research prototype assigned `mode = e.target.value`. The shipped script maps anything other than `aleatoire` to `alphabetique`, so the radio lookup and the stored value only ever take the two internal values. Covered by a test with a hostile value.

**Plan trailer:** the plan text names « Claude Opus 5.5 » in its executor rules; commits carry the trailer imposed by the orchestrator (`Claude Sonnet 5.5`).

## Issues Encountered

- A first run of the rejection-sampling « repeated » test was wrong (4294967294 is below the bound for 3 items and is accepted); the test data was fixed, the script was correct.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, no cookie, one storage key (`rtp:ordre`), no package added.

## Verification

- `node --test tests/browser-js/ordre.test.ts tests/ui/styles.test.ts tests/dist/site.test.ts`: 145 pass.
- Full suite `tests/**/*.test.ts`: 1493 pass, 0 fail. `npm run check`: 0 errors.
- Not verified in a real browser (the research prototype was, with the same logic); fake-DOM tests only.

## Self-Check: PASSED

- Files present: `src/scripts/ordre.js`, `src/components/OrdreCandidats.astro`, `src/styles/ordre.css`, `tests/browser-js/ordre.test.ts`, `tests/dist/cas/ordre.cas.ts`.
- Commits present: `5cb3041`, `fe7bd00`.
