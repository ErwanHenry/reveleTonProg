---
phase: 01-fondations-sch-mas-v1-et-content-core
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/dependabot.yml
  - astro.config.mjs
  - package.json
  - schemas/defs/common.schema.json
  - schemas/candidat.schema.json
  - schemas/mesure.schema.json
  - schemas/source.schema.json
  - schemas/theme.schema.json
  - schemas/couverture.schema.json
  - schemas/glossaire.schema.json
  - schemas/sondage.schema.json
  - schemas/journal.schema.json
  - scripts/validate.ts
  - scripts/migrate.ts
  - scripts/migrations/index.ts
  - src/content.config.ts
  - src/lib/content-core/ajv.ts
  - src/lib/content-core/astro-loader.ts
  - src/lib/content-core/collections.ts
  - src/lib/content-core/diagnostics.ts
  - src/lib/content-core/load.ts
  - src/lib/content-core/migrate.ts
  - src/lib/content-core/root.ts
  - src/lib/corpus/index.ts
  - src/lib/corpus/types.ts
  - src/pages/index.astro
findings:
  critical: 2
  warning: 7
  info: 8
  total: 17
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard (key claims reproduced by running the CLI on Node 24 against temporary copies of the fixture corpus)
**Files Reviewed:** 27
**Status:** issues_found

## Summary

The core is well built. The YAML parser is configured strictly: core schema, `uniqueKeys`, `merge: false`, and aliases refused both by `visit` and by `maxAliasCount: 0`. Ajv runs with `strict: true`. The CI actions are pinned to SHAs, and I confirmed with `gh api` that both SHAs match the tags `v7.0.1` and `v7.1.0`. The gitleaks SHA-256 matches the upstream `gitleaks_8.30.1_checksums.txt` for `linux_x64`. Dependabot has cooldowns and major-version ignores.

Two gaps defeat controls the code claims to provide:

- The validation gate passes silently when the content root does not exist.
- The symlink refusal is bypassed when the symlink sits on `src/` or `src/content/`, which `listContentFiles` never checks.

Several rules the code presents as guaranteed are not enforced:

- Mesure id and `candidat` against the directory name.
- Reviewer requirements for themes and polls.
- Atomicity of `migrate --write`.
- Neutralisation of untrusted text before it is printed to GitHub Actions logs.

## Structural Findings (fallow)

Not provided for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A nonexistent or mistyped content root validates as "0 errors" and exits 0

**File:** `src/lib/content-core/load.ts:105-106` (also `scripts/validate.ts:35-45`, `scripts/migrate.ts:49-66`, `.github/workflows/ci.yml:39-48`)
**Issue:** `listContentFiles` returns `{ files: [], diagnostics: [] }` when `src/content` does not exist. Reproduced:
- `node scripts/validate.ts --root nope/typo` prints `0 fichier(s), 0 erreur(s)` and exits 0.
- `RTP_CONTENT_ROOT=.` does the same today, because `src/content/` is empty and git does not track empty directories.

So the two "corpus réel" CI steps (`migrate --check` and `validate`) pass vacuously. A typo in `RTP_CONTENT_ROOT` or `--root`, or a deleted `src/content`, turns the whole gate into a no-op. A production `astro build` would then produce an empty site with exit 0, since `astro-loader` only fails on errors.
**Fix:**
```ts
// load.ts, listContentFiles
if (!existsSync(base)) {
  return { files, diagnostics: [diag('RACINE_INTROUVABLE', base, 1, 1, 'dossier src/content introuvable sous la racine de contenu')] };
}
```
For the "corpus réel" CI steps, which run before real content exists, either gate them on `[ -d src/content ]` explicitly or add a `--require-files` flag. A zero-file result must never be silent. Consider making `validate` exit 1 when `files === 0` unless `--allow-empty` is given.

### CR-02: The symlink refusal is bypassed at `src/` and `src/content/`, so reads and migration writes can escape the content root

**File:** `src/lib/content-core/load.ts:105-125` (also `src/lib/content-core/migrate.ts:136`)
**Issue:** `listContentFiles` lstat-checks the collection directories, their entries and the files. It never checks `contentRoot/src` or `contentRoot/src/content` (`base`). `existsSync(base)` and `readdirSync` follow symlinks.

Reproduced: a root whose `src` is a symlink to a directory elsewhere, and a root whose `src/content` is a symlink, both validate normally (10 files, exit 0, no `FICHIER_LIEN_SYMBOLIQUE`).

Consequences:
- A PR that commits `src/content -> /some/path` makes CI read files outside the checkout.
- `migrate --write` writes through the link. The comment at `migrate.ts:136` ("toujours sous la racine de contenu") is therefore false.
- Lstat at list time followed by `readFileSync`/`writeFileSync` by path leaves a TOCTOU window.

**Fix:**
```ts
const srcDir = path.join(contentRoot, 'src');
for (const p of [srcDir, base]) {
  if (existsSync(p) && lstatSync(p).isSymbolicLink()) {
    return { files, diagnostics: [diag('FICHIER_LIEN_SYMBOLIQUE', p, 1, 1, 'lien symbolique refusé (jamais suivi)')] };
  }
}
```
Optionally add a `realpathSync(file).startsWith(realpathSync(contentRoot) + path.sep)` containment check before each read or write. Also reject non-regular files with `e.isFile()`. A FIFO named `x.yaml` currently passes the listing and `readFileSync` blocks forever.

## Warnings

### WR-01: Untrusted YAML content is printed unsanitised, allowing GitHub Actions workflow-command injection through the log

**File:** `src/lib/content-core/diagnostics.ts:72-74, 95-99` (called from `scripts/validate.ts:38-39`, `scripts/migrate.ts:54-55`)
**Issue:** `formatText` interpolates `d.message` and `d.pointer` raw. These embed contributor-controlled strings: unknown property names (`propriété inconnue : « <clé> »`), enum values, YAML error excerpts, and the JSON pointer. `formatGithub` also prints every text line unescaped before the annotations. Only the `::error` line is escaped.

Reproduced: a double-quoted YAML key such as `"x\n::warning title=PWNED::injected\n::stop-commands::abc"` produces output lines that begin with `::warning title=PWNED::injected` and `::stop-commands::abc`. The Actions runner executes both, so a fork PR can spoof annotations or use `::stop-commands::` to suppress the genuine error annotations. The exit code stays correct, so impact is limited to log and annotation integrity, but it is untrusted-input injection into the CI channel.
**Fix:** neutralise control characters in `formatText`, for example:
```ts
const safe = (s: string): string => s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
// formatText: use safe(d.message) and safe(d.pointer); also safe(relPosix(...)) for file names
```
Alternatively print `::stop-commands::<random-token>` before the text block and resume after it.

### WR-02: `migrate --write` is not atomic; a failure mid-run leaves the corpus half-migrated

**File:** `src/lib/content-core/migrate.ts:120-139`
**Issue:** `runMigrations` interleaves compute and write per file. Reproduced: with two files and a migration that throws on the second, the first file is already rewritten at v1 while the second stays at v0, and the error propagates as an uncaught exception.
- Any non-`MIGRATION_CHAINE_MANQUANTE` error is rethrown with no file context.
- `writeFileSync` truncates then writes, so a crash mid-write corrupts the file.
- The "version is never advanced if the migration fails" guarantee (comment at line 106) holds per file, not per run.

**Fix:** two phases. Compute `migrateText` for every outdated file into a `Map<file, text>` and catch all errors into diagnostics with the file path. Write only if no error occurred, using write-to-temp-then-`renameSync`.

### WR-03: Nothing ties a mesure or entry to its path, so a measure can be attributed to the wrong candidate

**File:** `src/lib/content-core/load.ts:137, 150, 161-173`; `src/lib/corpus/index.ts:22-26, 29-31`; `schemas/mesure.schema.json:11`
**Issue:** `loadAll` derives `id` from the filename and never compares it to `data.id`. For mesures it also never compares the `candidat` directory with `data.candidat`.

Reproduced: moving `mesures/marie-fictive/encadrement-loyers.yaml` to `mesures/jean-imaginaire/autre-nom.yaml`, with content still saying `id: marie-fictive/encadrement-loyers` and `candidat: marie-fictive`, validates clean.

`getMesuresDe` filters on `data.candidat`, while `getSource` and `getEntry` use the filename-derived store id. On a site whose core promise is neutrality and sourcing, a silent mis-attribution is the worst failure mode. The `index.astro` and `corpus/index.ts` comments defer cross-reference rules to Phase 2, but this per-file invariant belongs in the loader. The filename-derived id is also never validated against the slug pattern.
**Fix:** after `validateYamlText`, emit `ID_CHEMIN_INCOHERENT` when `data.id !== f.id` (and when `data.candidat !== dirname(f.id)` for mesures). Validate `f.id` against `^[a-z0-9]+(-[a-z0-9]+)*(/…)?$`.

### WR-04: Themes and polls can be `publie` with no reviewer, unlike mesures

**File:** `schemas/theme.schema.json:49-51`, `schemas/sondage.schema.json:84-86`
**Issue:** `mesure.schema.json` requires `relecteur` and `date_relecture` for `relu` and `publie`. The theme and sondage schemas declare `statut_relecture`, `relecteur` and `date_relecture` but have no `if/then`, so `statut_relecture: publie` with no reviewer validates. The project's "publié = relu par un humain" guarantee is only enforced for one of three reviewable collections. The `candidat.statuts` schema does enforce it.
**Fix:** copy the `allOf` block from `mesure.schema.json` (relu or publie then requires `relecteur` and `date_relecture`) into both schemas. Add fixtures for the negative case.

### WR-05: Watcher callbacks and the shared memo can crash the Astro dev server on any I/O error

**File:** `src/lib/content-core/astro-loader.ts:16-29, 58-83, 86-91`
**Issue:**
- `fingerprintDir` calls `lstatSync(full)` with no try/catch. If a file is deleted or renamed between `readdirSync` and `lstatSync`, which is routine with editor save-via-rename, it throws `ENOENT`.
- `loadAll` can also throw: `readFileSync` ENOENT or EACCES, an Ajv compile or strict error, a missing `schemas/`.
- Both run inside `again()`, a chokidar event handler. An uncaught exception there takes the dev server down, contradicting the stated intent: "Dev : on garde les données précédentes pour ne pas tuer le serveur".

Also, `watcher.add` covers only `src/content`, so schema edits do not invalidate anything, and `ajv.ts`'s module-level `cache` would keep serving the stale compiled schemas anyway.
**Fix:** wrap the body of `run()` in try/catch. In dev, `logger.error` and return; in build, rethrow. Make `fingerprintDir` tolerant (`try { st = lstatSync(full) } catch { continue }`). Either watch `schemas/` and clear the Ajv cache, or document that schema edits need a dev-server restart.

### WR-06: Schema load and compile errors are uncaught, and compilation is lazy

**File:** `src/lib/content-core/ajv.ts:41-63, 174`
**Issue:**
- `readdirSync(schemasDir)`, `JSON.parse` and `addSchema` throw raw exceptions. Reproduced: `migrate --check --schemas nope` dies with a Node stack trace (exit 1, indistinguishable from "validation errors") rather than a diagnostic.
- `ajv.addSchema` only checks the schema against the meta-schema. Strict-mode errors, such as unknown keywords, a `required` entry not in `properties`, or a bad `$ref`, surface only at `getSchema()`, i.e. when the first file of that collection is validated. A schema typo in a collection with no file in the corpus is never caught.
- A schema file missing `$id` or using a wrong URN prefix is silently ignored by the `schemas` map and surfaces only as `SCHEMA_INCONNU` for that collection.

**Fix:** in `context()`, eagerly call `ajv.compile`/`getSchema` for every `schemas.get(...)` entry and wrap the whole thing in a try/catch that rethrows a typed `SchemaLoadError`. Have the CLIs print it and exit with code 2. Assert that every `COLLECTIONS[*].schema` is registered.

### WR-07: `npm ci` runs dependency lifecycle scripts in CI with no justification, and the workflow runs twice per PR

**File:** `.github/workflows/ci.yml:3-5, 33-34`; `.npmrc`
**Issue:**
- `.npmrc` sets only `engine-strict`. `npm ci` therefore executes every dependency's `postinstall` (esbuild, sharp, etc. via Astro) in a job that handles fork PRs. This is acceptable only if deliberate. For a supply-chain-sensitive project, `ignore-scripts=true` plus an explicit allowlist (`npm rebuild esbuild`) is the safer baseline. `npm audit signatures` only proves registry provenance, not script safety.
- `on: push:` plus `on: pull_request:` with no branch filter runs the full pipeline twice for every PR branch push. This costs minutes and doubles gitleaks full-history scans.

**Fix:** restrict `push` to `branches: [main]` and keep `pull_request`. Evaluate `npm ci --ignore-scripts` and add only the rebuilds that the build actually needs.

## Info

### IN-01: Migration rewrite reformats more than the version line

**File:** `src/lib/content-core/migrate.ts:107-108`
**Issue:** Comments, key order and quote styles survive (verified), but `doc.toString` normalises other layout:
- Sequences under a key are re-indented (`liste:\n- un` becomes `liste:\n  - un`).
- Flow sequences are re-spaced (`[1,   2]` becomes `[ 1, 2 ]`).
- Folded `>` blocks are re-wrapped, which is semantically equivalent.
- CRLF files become LF.
- Inline comment spacing changes.

The first migration will therefore produce noisy diffs on hand-edited files. Re-running is idempotent (a second pass is a no-op, verified).
**Fix:** document this, or pass `indentSeq: false` to match the corpus house style. Add a fixture test with a non-indented sequence.

### IN-02: `https-url` accepts forms that are not what editors expect

**File:** `src/lib/content-core/ajv.ts:37-39`
**Issue:** Verified on Node 24: `https:example.com` (no slashes), `https://user:pw@example.com/` (credentials committed in a URL) and `https://localhost/` all pass. Credentials in a source URL are a secrets-hygiene risk that gitleaks may not catch.
**Fix:** require `u.hostname.includes('.')`, `u.username === '' && u.password === ''`, and `s.startsWith('https://')`.

### IN-03: Default content root silently falls back to the fictional fixtures in production builds

**File:** `src/lib/content-core/root.ts:5-10`; `src/pages/index.astro:19, 46-47`
**Issue:** If `RTP_CONTENT_ROOT` is unset when building for deployment, the site is built from the fake corpus with exit 0. The page banner always says "Données fictives", even when real data is loaded.
**Fix:** require `RTP_CONTENT_ROOT` when `NODE_ENV === 'production'` or when `CI` is set, or fail the deploy job if the build's content root is the fixture path. Derive the banner from the root.

### IN-04: `index.astro` silently omits a missing source, and skips a heading level

**File:** `src/pages/index.astro:36-38, 34`
**Issue:** `source !== undefined &&` hides a dangling `mesure.source` reference rather than failing the build. Until the Phase 2 rule exists, a measure can render with no source, against the "every measure has a dated primary source" requirement. The `<h3>` follows an `<h1>` with no `<h2>`, which is a WCAG heading-order issue.
**Fix:** `if (source === undefined) throw new Error(\`source ${m.source} introuvable\`)` in `getMesuresDe`/the page. Use `<h2>`.

### IN-05: `types.ts` claims a date format the schema does not allow

**File:** `src/lib/corpus/types.ts:3`
**Issue:** The comment says "AAAA-MM-JJ, AAAA-MM ou AAAA", but `dateOuPartielle` accepts only `AAAA-MM-JJ` or `AAAA-MM`. Year-only values are rejected. Types exist only for 4 of the 8 collections, and nothing checks that they stay aligned with the schemas (the header says "alignées", without a test).
**Fix:** correct the comment. Add a drift test, or generate the types from the schemas.

### IN-06: Dirent filtering and sorting quirks in the file lister

**File:** `src/lib/content-core/load.ts:111`
**Issue:**
- `entriesOf` silently drops every entry starting with `.`, so `.brouillon.yaml` is neither validated nor reported.
- The comparator never returns 0 (harmless for distinct names).
- `lstatSync` after `Dirent.isSymbolicLink()` is redundant and can throw on a race.

**Fix:** emit a `FICHIER_CACHE` diagnostic (warning) for dot-files other than `.gitkeep`, and drop the redundant lstat once CR-02 adds a realpath containment check.

### IN-07: Shadowed `unknown` identifier and minor CLI inconsistencies

**File:** `src/lib/content-core/ajv.ts:170`; `scripts/validate.ts:19-36` vs `scripts/migrate.ts`
**Issue:**
- `const unknown = () => …` shadows the TS type name in the value namespace and hurts readability.
- `validate` has no `--schemas` option although `migrate` does.
- Both scripts resolve `projectRoot` from `process.cwd()`, so running `node scripts/validate.ts` from another directory fails with a stack trace.

**Fix:** rename it to `schemaInconnu`. Add `--schemas` to `validate`. Derive `projectRoot` from `import.meta.dirname`, or document that `npm run` is required.

### IN-08: `migrate.ts` types allow migrations the runner will never run

**File:** `src/lib/content-core/migrate.ts:15-20, 101-104`
**Issue:** `Migration` permits `to !== from + 1` and `migrate(): void` accepts an async function whose promise is ignored. The runner only matches `to === v + 1`, so a multi-version migration is silently never found and reports `MIGRATION_CHAINE_MANQUANTE`. Registry shape errors surface only at run time.
**Fix:** type it as `to: number` with a registry-level assertion at import time (`MIGRATIONS.every(m => m.to === m.from + 1)`) and `migrate(doc): void` returning `undefined` (reject thenables at runtime).

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
