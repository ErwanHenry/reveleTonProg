---
phase: 03-import-data-gouv-et-corpus-pilote
plan: 02
subsystem: archiving
tags: [cont-03, archive, wayback, ssrf, pdftotext, private-repo]
requires:
  - phase: 02-regles-editoriales-et-pieges
    provides: "validateYamlText, loadAll, ARCHIVE_* and TEXTE_SOURCE_HORS_ARCHIVE rules, checkContained"
provides:
  - "scripts/archive-source.ts: capture | --refresh | --wayback-only | --wayback-missing | --sync-private"
  - "five modules under scripts/lib (archive, html-text, fetch-safe, wayback, private-store)"
  - "private GitHub repo ErwanHenry/reveleTonProg-archives (PRIVATE, pushed) with local clone next to the project"
  - "RUNBOOK section Archiver une source"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09]
tech-stack:
  added: []
  patterns:
    - "pure modules with injected fetch/clock; IO only in fetch-safe, private-store and the CLI"
    - "git and pdftotext through execFile argument arrays, never a shell"
key-files:
  created:
    - scripts/archive-source.ts
    - scripts/lib/archive.ts
    - scripts/lib/html-text.ts
    - scripts/lib/fetch-safe.ts
    - scripts/lib/wayback.ts
    - scripts/lib/private-store.ts
    - tests/archive/archive.test.ts
    - tests/archive/html-text.test.ts
    - tests/archive/wayback.test.ts
    - tests/archive/fetch-safe.test.ts
    - tests/archive/private-store.test.ts
    - tests/archive/archive-e2e.test.ts
    - tests/fixtures/archive/page-utf8.html
    - tests/fixtures/archive/page-latin1.html
    - tests/fixtures/archive/coquille-js.html
  modified:
    - docs/RUNBOOK.md
    - archives/README.md
    - tests/repo/docs.test.ts
key-decisions:
  - "Playwright not added: fetch plus pdftotext covers every crawled site; client-rendered shells and 403 go to a manual --file capture"
  - "Private clone resolved from --root (RTP_ARCHIVES_DIR relative values too), never from process.cwd()"
  - "Wayback and every network problem are warnings with a resume command, never blocking"
  - "--refresh accepts --file so a manually captured source can be refreshed from a new saved file"
requirements-completed: [CONT-03]
duration: ~2h
completed: 2026-11-03
---

# Phase 3 Plan 02: Archiving tool Summary

One command archives a source: normalized text extract + sha256 in the public repo, binary in the private repo `ErwanHenry/reveleTonProg-archives`, optional Wayback snapshot, and a source YAML the Phase 2 validator accepts. Zero new dependency.

## Tasks and commits

| Task | Commit | Content |
|------|--------|---------|
| 1 | `05380f7` | Pure modules (html-text, archive, wayback), fixtures, unit tests, e2e test written RED |
| 2 | `0a21434` | fetch-safe, private-store, CLI, unit tests; e2e GREEN |
| 3 | `d06112a` | RUNBOOK section, archives/README.md, docs test; private repo created outside this repo |

Private repo commit: `24f60f3` on `origin/main` of `ErwanHenry/reveleTonProg-archives` (README.md and `.gitattributes` with `* -text`).

## Verification

- `node --test tests/archive/*.test.ts tests/repo/docs.test.ts`: 109 pass, 0 fail. The e2e test runs offline (file capture, local bare remote as private repo): archive, `loadAll` preview with 0 errors on a measure citing the new source, one appended byte gives `ARCHIVE_SHA256_DIVERGENT`, coquille JS exits 1 with `--file` hint and writes nothing, non-https exits 2, missing clone exits 2 naming `reveleTonProg-archives`, default clone resolved from `--root` (not cwd), refresh (unchanged, text changed with Wayback dropped and re-check warning, manual source skipped), PDF through real `pdftotext`, `--sync-private` push.
- `npm run check`: 0 errors, 0 warnings. `package.json` and lockfile untouched.
- `gh repo view ErwanHenry/reveleTonProg-archives --json visibility`: `PRIVATE`; `origin/main` has 1 commit; clone clean (`git status --porcelain` empty).
- Acceptance greps: no `node:fs|child_process|dns|net|http(s)` import in archive.ts, html-text.ts, wayback.ts; `web.archive.org/save/` appears in wayback.ts; no `exec(` or `shell: true` in scripts; no `process.cwd()` in private-store.ts; `grep "rendu manuel" .planning/REQUIREMENTS.md` = 1 (CONT-03 wording already amended at 207c75b, not re-edited).

## Live smoke (not committed to either repo)

`https://attalpresident.fr/programme`, `--candidat gabriel-attal --source-id smoke-attal-programme --type programme --auteur candidat --date-publication 2026-11 --wayback`, temp root, `RTP_ARCHIVES_DIR` set:

- Dry run then real run: final URL `https://attalpresident.fr/programme`, HTTP 200, extract 10 694 characters, sha12 `44bb4569d09d`, no warning other than the missing candidate file in the temp root.
- Wayback: submission succeeded, `https://web.archive.org/web/20261103163823/https://attalpresident.fr/programme` (seconds after the capture, so no old-snapshot warning).
- `--refresh smoke-attal-programme` live: extract identical (same sha256), **binary hash different** (`655c8ebe781d` then `639dd02a0d1e`): this site's HTML changes on every fetch (dynamic fragments). The tool classifies it `binaire_modifie`, stores the new binary and keeps the Wayback URL. Documented in the RUNBOOK as normal.
- Personal data grep on the extract: no e-mail, no phone number. The only hit for "assistant" is programme content (« assistant médical IA »), not an instruction. No suspicious content to list.
- Cleanup: temp root deleted, smoke binaries removed from the clone (clean), nothing committed from the smoke.

## Secret scan (gitleaks dry run): NOT RUN

Task 3 step 4 asked to download the pinned gitleaks 8.30.1 binary (checksum-verified) and scan `tests/fixtures/archive/` and the smoke extract. The auto-mode permission classifier denied the download-and-execute command and I did not work around it. A weak fallback was done instead: grep for private keys, `AKIA`, `ghp_`, `xox`, 40+ hex strings, "api key/secret/token" on the smoke extract and the three fixtures: no match. **`.gitleaks.toml` was not created** (no false positive observed, none exercised). The same denial will hit step 5 of 03-REDACTION.md §8 in the content plans; Erwan should either allow that exact command once or pre-install gitleaks 8.30.1 outside the repo. The RUNBOOK documents the procedure.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] `--refresh <id> --file <fichier>`**
- Found during: Task 2. A `fichier-manuel` source (403 sites, client-rendered sites) could otherwise never be refreshed, and the refresh semantics (unchanged / binary changed / text changed) could not be tested offline.
- Fix: `--refresh` accepts `--file` (and `--capture-le`); without `--file` a manual source is skipped with a warning, as specified.
- Files: scripts/archive-source.ts. Commit: 0a21434.

**2. [Rule 1 - Bug] `<title>` leaked into the extract when `<head>` had no closing tag**
- Fix: `title` added to the ignored elements in html-text.ts. Covered by a test. Commit: 0a21434.

**3. Client-rendered check also applies to `--file` input.** A page saved from a browser as « HTML seul » can still be a shell; the refusal message names `--file` with instructions to save the rendered page (PDF or complete page). Spec said "exits 1 with a message containing --file" for `coquille-js.html`, which the e2e test feeds through `--file`.

**4. Paragraph spacing.** Block elements give a blank line between paragraphs (`Titre\n\nParagraphe`), not a single newline. Quotes are unaffected (the Phase 2 matcher collapses whitespace).

No architectural change, no auth gate, no package install.

## Known limits

- **SSRF, DNS rebinding:** `fetchSafe` checks the DNS answer then calls the global `fetch`, which resolves the name again. A hostile DNS could answer differently the second time. Pinning needs undici's dispatcher (a new dependency) or `node:https` with a custom lookup. Accepted: the tool is run by hand on URLs chosen by Erwan; documented in fetch-safe.ts.
- `date_publication` is never inferred (the CLI requires it); the executor finds it per 03-REDACTION.md §2.
- The wayback modes (`--wayback-only`, `--wayback-missing`) are exercised live (single submission) but not in `npm test` (network). `submitWayback` and its parsing are unit-tested with injected fetch.
- A stale lock in the private clone (> 10 min) stops the tool with a message; it is never removed automatically.
- Old extracts stay in `archives/` after a text-changing refresh (reported; remove by hand when no longer cited).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-03-08 to T-03-16 mitigated as listed; T-03-13 asserted by `visibility == PRIVATE`).

## Notes for the next plans

- Every shell that runs the tool needs `RTP_ARCHIVES_DIR=/Users/erwanhenry/claude-projects/reveleTonProg-archives` (the clone now exists there; worktrees have no sibling clone).
- `--root .` is the default; the tool refuses to default into `tests/fixtures/`.
- The sibling clone is clean and at `origin/main` (24f60f3). Run `--sync-private` at the end of every batch (Règle d'or).

## Self-Check: PASSED

Checked: created files exist (scripts/archive-source.ts, scripts/lib/{archive,html-text,fetch-safe,wayback,private-store}.ts, tests/archive/*, tests/fixtures/archive/*), commits `05380f7`, `0a21434`, `d06112a` present in `git log`, private repo PRIVATE with `24f60f3` pushed, 109 tests pass, `npm run check` clean.
