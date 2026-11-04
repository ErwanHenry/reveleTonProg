---
phase: 03-import-data-gouv-et-corpus-pilote
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - scripts/import-datagouv.ts
  - scripts/lib/datagouv.ts
  - scripts/archive-source.ts
  - scripts/lib/archive.ts
  - scripts/lib/html-text.ts
  - scripts/lib/fetch-safe.ts
  - scripts/lib/private-store.ts
  - scripts/lib/wayback.ts
  - scripts/couverture-scan.ts
  - scripts/lib/couverture.ts
  - scripts/lib/pilote.ts
  - src/lib/content-core/root.ts
  - .github/workflows/ci.yml
  - package.json
findings:
  critical: 0
  warning: 9
  info: 5
  total: 14
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-04
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The tooling is generally careful. Fetched content is never executed. git is called through `execFile` with an argument array, and candidate and source ids are checked against slugs before they reach any path. The SSRF filter re-checks every redirect hop, and DNS rebinding is documented as accepted, as requested. No blocker found. The warnings concern a gap in the public/private binary separation, a bug in the private sync, SSRF hardening that was not applied to the importer, error-handling holes, and YAML rewrite fidelity.

## Warnings

### WR-01: `syncPrivate` fails or sweeps in unrelated changes when no file was written

**File:** `scripts/lib/private-store.ts:190-196` (called from `scripts/archive-source.ts:376`)
**Issue:** `enregistrer` passes `chemins: ecrits`. On any re-run where the binary and meta already exist, `ecrits` is `[]`. Then no `git add` runs. `git status --porcelain` is called with no pathspec, so it reports any unrelated dirty file in the private clone. `enAttente` is therefore non-empty and `git commit` runs without a pathspec. That commits only what is already staged, or fails with "nothing to commit" and throws `DepotPriveError`. With `--push`, the idempotent re-run therefore errors. If something unrelated was staged, it is committed under the message `archive: <id>`.
**Fix:**
```ts
const filtre = o.chemins !== undefined && o.chemins.length > 0;
if (o.chemins === undefined) await git(o.dossier, ['add', '-A']);
else if (filtre) await git(o.dossier, ['add', '--', ...o.chemins]);
const enAttente = o.chemins !== undefined && !filtre
  ? ''   // aucun chemin demandé : ne rien commiter, pousser seulement les retards
  : (await git(o.dossier, ['status', '--porcelain', ...(filtre ? ['--', ...o.chemins!] : [])])).trim();
```

### WR-02: Nothing prevents the private archive directory from being the public repo

**File:** `scripts/lib/private-store.ts:31-42`; `.gitignore`
**Issue:** `resolveArchivesDir` only checks that `<dir>/.git` exists. With `RTP_ARCHIVES_DIR=.` or `RTP_ARCHIVES_DIR=../reveleTonProg`, or with a wrong clone at the default neighbour path, PDFs and HTML are written under `<candidat>/` and `syncPrivate` runs `git push` to whatever `origin` is. The stated invariant is that no binary ever enters the public repo. `.gitignore` has no `*.pdf`, `*.html` or `archives/**/*.pdf` guard either.
**Fix:** In `resolveArchivesDir`, refuse a `dossier` equal to or inside `contentRoot`, or equal to `contentRoot` or an ancestor of it. Also check `git remote get-url origin` against `/reveleTonProg-archives(.git)?$`. Add `archives/**` with `!archives/**/*.txt` and `!archives/README.md` to the public `.gitignore`.

### WR-03: The importer downloads with an unguarded `fetch` (redirect follow, no SSRF check)

**File:** `scripts/import-datagouv.ts:79`
**Issue:** `--url` accepts any https URL. `fetch(url, { redirect: 'follow' })` bypasses `fetchSafe`, so redirects to private addresses or literal internal IPs are followed. This is inconsistent with the T-03-08 mitigation applied to archive-source. The size cap is counted during the read, which is good. The `content-length` header is not used. The timeout signal also does not cover errors thrown mid-read in a typed way.
**Fix:** Reuse `fetchSafe(url, { maxOctets: PLAFOND_OCTETS })`. Take `finalUrl`, `bytes` and `contentType` from the result, and map `FetchSafeError` to `fail(...)`. Etag is lost (`fetchSafe` returns `lastModified` only), so add `etag` to the `Reponse` if it is needed.

### WR-04: `fetchSafe.lireCorps` does not wrap read errors, so timeouts and resets surface as raw exceptions

**File:** `scripts/lib/fetch-safe.ts:160`; consumer `scripts/archive-source.ts:264-267`
**Issue:** `await lecteur.read()` rejects with a `TimeoutError`/`AbortError` DOMException, or a `TypeError` on a connection reset, when the shared timeout fires mid-body or the stream fails. It is not converted to `FetchSafeError('DELAI'|'RESEAU')`. `obtenir` only catches `FetchSafeError` and otherwise rethrows. The CLI then prints a stack trace with exit code 1 instead of the intended message and code.
**Fix:** Wrap the loop body in `try { ... } catch (e) { if (e instanceof FetchSafeError) throw e; throw (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError' ? new FetchSafeError('DELAI', ...) : new FetchSafeError('RESEAU', ...); }`.

### WR-05: The Wayback client does not check that the snapshot is of the submitted URL

**File:** `scripts/lib/wayback.ts:6, 22-24, 58-60`
**Issue:** `parseSnapshotLocation` accepts any `https://web.archive.org/web/<14 digits>/…`. If Save Page Now redirects to a snapshot of another address (the target site redirected, or an error page), that URL is recorded as `archive.wayback_url` for the source, and nothing links it to the cited document. `Content-Location` and 200 responses (a common SPN anonymous response shape) are also treated as failure, which is only a robustness limit.
**Fix:** After the match, extract the remainder of the path (`url.slice(m[0].length)`) and compare it to the submitted URL, normalised (trailing slash, fragment, `http`/`https`). Warn, or reject, when they differ. Optionally also read `content-location`.

### WR-06: `storeBinary` is written after the public source and extract, with no rollback

**File:** `scripts/archive-source.ts:358-373`
**Issue:** `enregistrer` writes the extract and the source YAML (public, containing `binaire_sha256`) before `storeBinary`. If `storeBinary` throws (hash collision on 12 chars, disk error), the public repo references a binary that was never stored. The `.tmp-<pid>` temp file in `ecrireAtomique` is opened without `wx`, so a pre-planted symlink at the temp name would be followed. The risk is local only.
**Fix:** Call `storeBinary` first (it is idempotent), then write the extract and the source. Open the temp file with `{ flag: 'wx' }`, as `import-datagouv.ts` does.

### WR-07: The importer re-serialises existing candidate files, losing comments and hand formatting

**File:** `scripts/import-datagouv.ts:172-184`; `scripts/lib/datagouv.ts:202, 206-208`
**Issue:** For action `statut_ajoute`, the existing YAML is parsed to a JS object, a status is appended, and the whole object is re-emitted with `stringify`. Comments, key order not matching the object, anchors and any hand formatting in the editorial file are lost. The comment on `renderYaml` says "sans commentaire" but the existing files edited by Erwan are not guaranteed to be comment-free. Dates are emitted unquoted only because of `schema: 'core'`, and only a consistent reader keeps that round trip.
**Fix:** Use `parseDocument` and mutate the `statuts` sequence (`doc.get('statuts').add(...)`) so comments survive, or refuse to rewrite a file whose current text does not equal `renderYaml(parse(text))` and report a conflict.

### WR-08: Uncaught YAML parse errors in the importer

**File:** `scripts/import-datagouv.ts:172, 282`
**Issue:** `parse(lu.text, { uniqueKeys: true })` throws on malformed YAML or duplicate keys. Line 172 happens before anything is written (stack trace, exit code 1, no message naming the file), but line 282 happens after all files are written. A single malformed candidate file crashes the report step with a stack trace, after writes, with no summary.
**Fix:** Wrap both in `try/catch` and push a `conflit` or a `continue`. For line 282, report `illisible` and carry on.

### WR-09: `ids_externes`-based "absent en amont" report and merge assume the last list item is the latest status

**File:** `scripts/lib/datagouv.ts:182`; `scripts/lib/pilote.ts:73-79`
**Issue:** `mergeFiche` uses `anciens[anciens.length - 1]` as the current status, while `dernierCode` in pilote and the equity rule use "most recent by date". A hand-ordered or hand-edited `statuts[]` makes the importer compare against the wrong entry. It can then append a duplicate or raise a false date-regression conflict. The comparison also treats a partial upstream date `2026-03` as the first of the month, so a same-month change after `2026-03-15` is reported as a regression.
**Fix:** Pick the latest entry by `dateComparable` with the same tie-break as `dernierCode`. Only declare a regression when the dates are comparable at the same precision.

## Info

### IN-01: The theme ranking ignores the table's own `prioritaire_aine` and accepts an empty or partial table

**File:** `scripts/lib/couverture.ts:129-135, 284-285, 318`
**Issue:** `classer` reads the Aîné flag from `THEMES_SPEC` only. The `prioritaire_aine` key validated in `data/couverture-themes.yaml` is read and then ignored, so a disagreement between the two is silent. With `candidats: []` all positions are 0, `p4 = 0`, and the choice becomes pure Aîné order without any error. The margin rule itself (retain at `P4 + 2`, then the Aîné theme within 2 of the best remaining) is implemented as the comment and `explication` describe, and I found no off-by-one in it.
**Fix:** Add a problem when `themes[i].prioritaire_aine` differs from the spec, and when `candidats` is empty.

### IN-02: Date strings are only pattern-checked in the coverage table

**File:** `scripts/lib/couverture.ts:80, 111, 233`
**Issue:** `DATE_JOUR` accepts `2026-13-45`, and `derogation.date` is only checked for non-empty text.
**Fix:** Reuse a real-calendar-date check, as in `datagouv.ts:dateValide`.

### IN-03: Address filter gaps in IPv6

**File:** `scripts/lib/fetch-safe.ts:86-96`
**Issue:** `64:ff9b:1::/48`, `100::/64` and `fec0::/10` are returned as public. They are low-impact special ranges. IPv4 `192.88.99.0/24` is also open. The rest (mapped, compatible, NAT64, 6to4, ULA, link local, multicast, Teredo, documentation) is handled correctly.
**Fix:** Add the three IPv6 prefixes to the refusals.

### IN-04: HTML text splitter swallows content on a stray quote inside a tag

**File:** `scripts/lib/html-text.ts:77-92`
**Issue:** `finDeBalise` skips to the next matching quote when an apostrophe or quote appears inside a tag, including in an unquoted attribute value such as `title=l'école`. If no closing quote exists it returns `n`, which drops the rest of the document. The extract then fails the minimum length check or is silently truncated, so the failure is safe but misleading.
**Fix:** Only treat a quote as an opener directly after `=` (optionally preceded by whitespace).

### IN-05: Captured URL may differ silently from the requested one

**File:** `scripts/archive-source.ts:430`
**Issue:** In capture mode `url: prise.urlFinale` is stored without any warning when it differs from the requested URL (only refresh warns). The terminal also prints `source.data.titre` and the extract path without the control-character stripping applied to extracts in `couverture-scan.ts`.
**Fix:** Warn on a different final host. Strip `\p{Cc}` and `\p{Cf}` before printing titles.

---

_Reviewed: 2026-11-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
