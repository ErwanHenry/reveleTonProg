---
phase: 04-r-f-rentiel-m1-et-4-niveaux-de-lecture
fixed_at: 2026-11-03T22:25:00Z
review_path: .planning/phases/04-r-f-rentiel-m1-et-4-niveaux-de-lecture/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/04-r-f-rentiel-m1-et-4-niveaux-de-lecture/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

Full gate green after the fixes: `migrate --check`, `validate --mode production` (fixture and `--root .`), `ids --check`, `check` (0 hints), `npm test` (1533/1533), `build` + `check-dist` (fixture and `RTP_CONTENT_ROOT=.`, plus a preview build of the real corpus).

## Fixed Issues

### WR-01: Perimeter and displayed status used different definitions

**Files modified:** `src/lib/content-core/rules/equite.ts`, `src/lib/corpus/vue.ts`, `scripts/lib/check-dist.ts`, `tests/rules/equite.test.ts`, `tests/corpus/vue.test.ts`, `tests/corpus/vue-candidat.test.ts`, `tests/dist/cas/candidat.cas.ts`, `tests/dist/cas/ordre.cas.ts`, `tests/dist/cas/theme.cas.ts`
**Commit:** c8c1881
**Applied fix:** new `statutRetenu(statuts, mode)` in content-core: in production the most recent status among those with `statut_relecture` `relu` or `publie`, in preview the most recent of all. Used by the equity rule (REGLE-08), the view-model (`perimetre` and `statutAffiche`) and `cellulesAttendues` of check-dist. Requires human verification (logic change, and it amends Phase 2's fail-closed hypothesis A6). Phase 2 equity tests that relied on a draft status entering the perimeter were moved to preview, with production counterparts added. Page tests changed because Paul de Villefranche (status `declare` still `brouillon`) is now outside the production grid: 3 cards instead of 4, 2 "autres personnalités", coverage sentence "sur 3".

### WR-02: Statuses at `relu` shown as facts while themes and measures need `publie`

**Files modified:** `docs/ARCHITECTURE.md`, `src/lib/content-core/rules/config.ts`
**Commit:** 447bcef
**Applied fix:** `relu` chosen as reviewed (consistent with ADR-036 A1 and the existing display). Documented as ADR-041, A6 text amended in ARCHITECTURE.md and in `config.ts`. Requires human verification: if Erwan wants `publie` only for statuses, change the `RELUS` list in `equite.ts` (single place) and update the fixtures.

### WR-03: Provisional `.invalid` contact shipped without any gate

**Files modified:** `src/lib/site-config.ts`, `scripts/lib/check-dist.ts`, `scripts/check-dist.ts`, `tests/scripts/check-dist.test.ts`, `tests/corpus/site-config.test.ts`, `docs/RUNBOOK.md`
**Commit:** 580017b
**Applied fix:** with `RTP_DEPLOIEMENT=1`, `astro build` throws and check-dist reports `CONTACT_PROVISOIRE` as an error. Otherwise check-dist reports it as a warning (current CI stays green). Documented in the RUNBOOK. The Lot 3 deploy job must set `RTP_DEPLOIEMENT=1`.

### WR-04: CI built and checked only the fixture corpus

**Files modified:** `.github/workflows/ci.yml`, `tests/repo/ci.test.ts`, `.gitignore`
**Commit:** 0a3aa9a
**Applied fix:** added real-corpus build + check-dist in production (`dist-reel`) and in preview (`dist-preview`, `RTP_MODE=preview`, which now runs the noindex and robots.txt branches). `ci.test.ts` asserts order and env, and `RTP_MODE` is now allowed only on the preview build step. The two output folders are git-ignored.

### WR-05: check-dist link and CSP false negatives

**Files modified:** `scripts/lib/check-dist.ts`, `tests/scripts/check-dist.test.ts`, `docs/RUNBOOK.md`
**Commit:** 5e4d3ba
**Applied fix:** scheme allow-list for `<a href>` (https, mailto, relative); leading and trailing C0 controls stripped before the scheme check; `on*` attributes flagged as `SCRIPT_EN_LIGNE`; new codes `META_REFRESH` and `BASE_INTERDITE`. Note `tel:` links are now flagged too (none exist).

### WR-06: Forbidden-word scan ignored attributes and over-exempted `data-citation`

**Files modified:** `scripts/lib/check-dist.ts`, `tests/scripts/check-dist.test.ts`
**Commit:** 153fc4f
**Applied fix:** scans `title`, `aria-label`, `alt` and `meta` content (description, og and twitter; not viewport, robots or theme-color). Exemption narrowed to `blockquote[data-citation]` and `q[data-citation]`, plus `span[data-citation]` inside a `.source` block (the source title, a deliberate allowance with its own test), and the Méthode list.

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
