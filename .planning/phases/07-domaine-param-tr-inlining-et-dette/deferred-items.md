# Phase 7 deferred items

## From 07-04

- **Resolved in 07-06.** With `RTP_DEPLOIEMENT=1` exported in the developer's shell, a full `npm test` still fails in test-side reads of the repo config that use `process.env`: `tests/dist/cas/institutionnel.cas.ts` (`loadSiteConfig(ctx.repoRoot)` in the « mentions légales » suite), `tests/repo/astro-config.test.ts` (imports astro.config.mjs) and the repo case of `tests/corpus/site-config.test.ts`. This predates 07-04 (the provisional contact already triggered it). Test builds no longer inherit the variable. Possible fix: pass `{}` as env in those reads, as `tests/dist/cas/domaine.cas.ts` does.
  - Resolution (07-06): `institutionnel.cas.ts` and the repo cases of `site-config.test.ts` read with `loadSiteConfig(…, {})`; `astro-config.test.ts` deletes the inherited `RTP_DEPLOIEMENT` before importing astro.config.mjs (it checks the config shape; the guard is covered by `domaine.cas.ts` HEB-06). New 07-06 test-side reads (`check-dist.test.ts`, `source.cas.ts`, `hote-en-dur.test.ts`) also pass `{}`.

## From 07-06

- Observation, not fixed (out of scope, no current impact): `loadSiteConfig` returns a memoized config before evaluating the deployment guard, so in one process a first read with `{}` followed by a read with `RTP_DEPLOIEMENT=1` does not throw. Each real consumer (astro build via astro.config.mjs, the check-dist CLI which now reads with `{}` on purpose and reports DOMAINE_PROVISOIRE itself) reads once per process, so no guard is bypassed today. Possible fix: evaluate the guard on the memoized value too.
