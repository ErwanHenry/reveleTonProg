# Phase 7 deferred items

## From 07-04

- With `RTP_DEPLOIEMENT=1` exported in the developer's shell, a full `npm test` still fails in test-side reads of the repo config that use `process.env`: `tests/dist/cas/institutionnel.cas.ts` (`loadSiteConfig(ctx.repoRoot)` in the « mentions légales » suite), `tests/repo/astro-config.test.ts` (imports astro.config.mjs) and the repo case of `tests/corpus/site-config.test.ts`. This predates 07-04 (the provisional contact already triggered it). Test builds no longer inherit the variable. Possible fix: pass `{}` as env in those reads, as `tests/dist/cas/domaine.cas.ts` does.
