# Technology Stack — v1.1 Lot 3 (hébergement et mise en ligne)

**Project:** reveleTonProg
**Researched:** 2026-11-06
**Scope:** only what is NEW for hosting, deploy, monitoring, backups, inlining. The v1.0 stack (Node 24, Astro 7.4.5, ajv, yaml, Playwright, axe) is unchanged.
**Bottom line:** **zero new npm dependency.** One new Astro config option (`security.csp`), a few lines of Caddy, a `ops/` folder in the repo, plain `ssh`/`rsync` in the workflow, Healthchecks.io (hosted) for alerting. Nothing new runs permanently on the VPS except what Caddy already is.

## Recommended Stack

### Server side (the VPS, already has Caddy)
| Technology | Version (verified 2026-11-06) | Purpose | Why |
|---|---|---|---|
| Caddy (existing) | latest release **v2.11.9** (2026-11-05); keep whatever apt installed, `apt upgrade caddy` is enough | Static file server, automatic HTTPS, logs, headers | Already installed and shared with other services. Add the site as a separate file `/etc/caddy/sites/reveletonprog.caddy` pulled in by one `import /etc/caddy/sites/*.caddy` line, so the existing Caddyfile is touched once. Apply with `caddy validate` then `systemctl reload caddy` (graceful, no downtime for the other sites). HIGH |
| rsync (existing) + `rrsync` | Ubuntu 24.04 runner has rsync 3.2.7 (runner-images readme). Same on the VPS if Ubuntu 24.04 (CHECK `rsync --version`) | Receiving side of the deploy, locked to one directory | `rrsync` ships with the rsync package and is the standard way to restrict an SSH key to rsync into one directory. MEDIUM: confirm `/usr/bin/rrsync` exists on the VPS and that your flags (`--delete-after`) pass through `rrsync -wo`. |
| OpenSSH (existing) | n/a | Transport | Dedicated user + ed25519 key + `restrict` option. HIGH |
| restic (ONLY if no VPS backup exists yet) | **0.19.1** (2026-07-05) | Encrypted, deduplicated backup of config and certs | Single static Go binary, no daemon, runs from a systemd timer or cron, nothing resident in RAM. See Backups. |

### CI side (GitHub Actions)
| Action / tool | Version | Purpose | Why |
|---|---|---|---|
| `actions/checkout` | v7.0.1, already pinned `3d3c42e5aac5ba805825da76410c181273ba90b1` | Checkout in the deploy job | Reuse the existing pin, with `persist-credentials: false`. |
| `actions/setup-node` | v7.1.0, already pinned `949feb2413d6458794dcd2491c4babbbce0c15c1` | Node 24 | Reuse. |
| `actions/upload-artifact` | v7.0.2, already pinned `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | Hand `dist/` from a build job to the deploy job | Reuse. |
| `actions/download-artifact` | **v8.0.2** (2026-10-07). Commit `9000827ccba6bdab643e8b6fd33ac0654aef8333` (resolved from the tag ref via the API; re-check that the tag is a commit, not an annotated tag object) | Deploy job downloads exactly the dist that `check-dist` approved | Only if build and deploy are separate jobs (recommended: the deploy job gets `environment: production`, and nothing else does). Note the version mismatch: upload-artifact is v7 and download-artifact v8. Both are first-party, and the artifact format is compatible, but run once on a branch before trusting it. MEDIUM |
| `ssh` + `rsync` + `curl` on `ubuntu-24.04` | preinstalled | Deploy | **No third-party deploy action** (no `webfactory/ssh-agent`, no `burnett01/rsync-deployments`, no `appleboy/ssh-action`). Reason: ~15 lines of shell are fully auditable, every third-party action is a supply-chain dependency that must be justified and re-pinned, and the project already forbids unjustified dependencies. If you prefer an action, `webfactory/ssh-agent` v0.10.0 (`e83874834305fe9a4a2997156cb26c5de65a8555`, 2026-03-11) is the only one worth considering. HIGH |

### Monitoring and alerting
| Technology | Version | Purpose | Why |
|---|---|---|---|
| **Healthchecks.io** (hosted, free "Hobbyist" plan: 20 checks, 100 log entries each) | SaaS; the code is healthchecks/healthchecks v5.0.3 (2026-10-27) but do not self-host it | Dead-man's-switch monitoring with Telegram alerts | It is a *heartbeat* monitor, it does not probe URLs. That is the point: a 5-minute cron **on the VPS** does `curl -fsS --max-time 10 https://$DOMAINE/ -o /dev/null && curl -fsS -m 10 https://hc-ping.com/$UUID`. If the site fails to answer, or the VPS or Caddy or the cron dies, the ping stops and Telegram fires. It detects "VPS down", which a self-hosted Kuma on the same box cannot. Cost on the VPS: one `curl` every 5 min (nothing resident). Telegram is a native Healthchecks integration (page 404'd when fetched; the pricing page confirms the free plan limits. MEDIUM, confirm in the UI). The ping UUID is a secret-ish token: keep it in the cron file (root-only, mode 600) and in Vaultwarden, not in the repo. |
| A second heartbeat for the deploy itself | same account | Optional: the deploy job pings a second check on success | Cheap way to know the last deploy ran. Use a GitHub Secret. Low priority. |

### Inlining (Astro, no new package)
| Mechanism | Version | Purpose | Why |
|---|---|---|---|
| `build.inlineStylesheets: 'always'` | Astro 7.4.5 (documented values `always`/`auto`/`never`) | CSS into `<style>` in each page | Removes the CSS round trip (see 4G math). Verified by a throwaway build: `index.html` 22 821 B raw / 7 240 B gzip with inlined CSS. |
| `security.csp` | Astro 7.4.5, option added in 6.0.0, documented without an experimental label | Per-page `<meta http-equiv="content-security-policy">` with SHA-256 hashes of every `<style>` | Verified in the same build: emits `style-src 'self' 'sha256-…'` per page. CSS differs per page (scoped component styles), so a single header hash set cannot work; the meta tag is the only maintainable way to keep `unsafe-inline` out. |
| `scriptDirective: { hashes: [...] }` | same | Whitelists the two small scripts | Documented API (hashes must start with `sha256-`). Compute the two hashes in `astro.config.mjs` from the files with `node:crypto`, so they cannot drift. |
| `import x from '../scripts/niveau.js?raw'` + `<script is:inline set:html={x}>` | Vite built-in | Inline the two scripts byte-identically | See the data: URI trap below. No plugin needed. |

## The three inlining traps (verified by a build, not from docs)

1. **Do not just drop `assetsInlineLimit: 0`.** The two scripts are imported as `?url` and written as `<script is:inline src={url}>`. With Vite's default limit, those 923 B and 1.7 KB files become `src="data:text/javascript;base64,…"`. That fails `SCRIPT_DATA_URI` and defeats CSP. The existing config comment says exactly this. Keep `assetsInlineLimit: 0` if CSS inlining is done via `inlineStylesheets: 'always'` (it does not depend on that limit; confirm after the change that the CSS is still inlined, since my test also removed the limit).
2. **Scripts need a different mechanism than CSS.** Astro has no `inlineScripts` option. Use `?raw` and `set:html`. Both pages that need scripts then carry the code; the "byte-identical" check becomes: every inline `<script>` body must equal, byte for byte, one of the files in `src/scripts/` (and its sha256 must be in the CSP list). Wrap the markup so that no whitespace or newline is added around `set:html` content.
3. **Astro `security.csp` hashes the scripts and styles it processes; I did not verify that it hashes `is:inline` scripts.** That is why the recommended approach passes `scriptDirective.hashes` explicitly. Test: build, extract each inline script body, `sha256`, compare with the meta tag.

`scripts/lib/check-dist.ts` must be changed in step (ADR-037 is superseded, record a new ADR):
- `SCRIPT_EN_LIGNE`: allow an inline script only when its sha256 is on an allow-list derived from `src/scripts/*.js`. Keep the ban on inline handlers (`on*=`) and on `src=data:`.
- `STYLE_EN_LIGNE`: allow `<style>` elements without a `style=` attribute. Keep rejecting `style=` attributes (CSP `style-src-attr` would block them).
- Count the inlined bytes in the weight budget (currently HTML plus linked assets; it already adds both, so the sum is unchanged).
- Require the CSP meta tag on every page, and fail if it contains `unsafe-inline`, `unsafe-eval`, `data:` or a non-self host.
- The 2 KB script cap stays.

## 4G reality check (read before promising "< 1 s")
- The existing e2e test already encodes two budgets (1 s at 150 ms RTT / 1.6 Mbit/s; 1.5 s at 562.5 ms / 1.44 Mbit/s). With a local server there is no DNS or TLS. On a real Slow 4G (562.5 ms RTT), DNS + TCP + TLS 1.3 + request is already ~4 RTT, about 2.2 s, before a single byte of HTML. Lighthouse's simulated throttling does not model this as strictly, but a real-device test will show it. Report the target as "Lighthouse simulated Slow 4G", and measure the real URL once with `lighthouse` run by hand (not as a project dependency).
- What actually helps: one request only (inline CSS and scripts, as planned), HTTP/2 and HTTP/3 (Caddy default, nothing to configure), `encode zstd gzip`, no webfont, HTML under ~15 KB gzip so it fits in the initial congestion window (10 segments, about 14 KB). Current `index.html` is 7.2 KB gzip with inlined CSS: fine. Check the heaviest page, which is what the e2e `4g` test already picks.
- Per-page inlining duplicates the CSS bytes on every page, so repeat visitors lose cache benefit. At ~10 KB gzip this is the right trade for a cold-load goal. Watch the heaviest page against the 100 KB gzip budget in `check-dist`.

## Caddy site block (template to commit in `ops/caddy/reveletonprog.caddy`)

```caddyfile
{$RTP_DOMAINE} {
	root * /srv/reveletonprog/site
	encode zstd gzip
	file_server

	header {
		-Server
		Strict-Transport-Security "max-age=300"            # raise to 31536000 after one clean week; no preload, no includeSubDomains (other services share the VPS)
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
		Cross-Origin-Opener-Policy "same-origin"
		# CSP: see below, only directives NOT covered by the per-page meta tag
		Content-Security-Policy "base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self'; font-src 'self'; connect-src 'none'; manifest-src 'self'"
	}
	@assets path /_astro/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@html not path /_astro/*
	header @html Cache-Control "no-cache"

	log {
		output file /var/log/caddy/reveletonprog.log {
			roll_size 10MiB
			roll_keep 14
			roll_keep_for 336h
		}
		format filter {
			request>remote_ip ip_mask 24 48
			request>client_ip ip_mask 24 48
			request>headers delete
			request>tls delete
			wrap json
		}
	}
}
```

Notes and rationale:
- **Do not put `default-src` in the Caddy CSP.** Browsers enforce every CSP separately and intersect them. A header `default-src 'self'` would make `style-src` fall back in that policy and block the inline `<style>` that the meta policy allows. List only directives the meta tag does not set. `frame-ancestors` and `report-uri` are ignored in a meta CSP, which is why the header is still needed. (HIGH, spec behaviour; confirm with the Playwright suite: add a test that loads the page behind the real header with `javaScriptEnabled` on and asserts no CSP violation.)
- **Domain not bought**: the site address is `{$RTP_DOMAINE}`, read from the environment. Safer than relying on a systemd `EnvironmentFile` I could not verify for the Debian unit: have `ops/bootstrap.sh` render the file with `envsubst` from a variable and then `caddy validate`. Until the domain exists, nothing deploys anyway (the `.invalid` guard). For a smoke test over IP, use a separate `http://<ip>:8080` block and delete it afterwards.
- **Log policy**: `ip_mask 24 48` keeps the network, not the host. `request>headers delete` drops User-Agent, Accept-Language, Referer (Cookie, Authorization are already redacted by default). Kept fields: time, method, URI, status, size, duration, masked IP. Keep 14 days at most, max about 140 MB, which matters with the disk at 90 %. The privacy page and `config/hebergeur.yml` text must say exactly this (masked IP /24 and /48, no User-Agent, 14 days). IP masking by `ip_mask` is documented for `request>remote_ip` and `request>client_ip`; the exact JSON paths changed in past Caddy versions, so **after the first request, read one log line and confirm no full IP and no header field appears** (acceptance test). Also note: the default runtime/error log goes to journald and can contain client IPs on errors; set `journald` `SystemMaxUse` and `MaxRetentionSec=14d` if not already.
- `log` output file changes take effect only after a Caddy **restart**, not a reload (Caddy docs). Plan one restart; the other sites on the VPS will blip once.
- Log directory: `install -d -o caddy -g caddy -m 750 /var/log/caddy`.
- `trusted_proxies` not needed (no CDN in front). Do not add Cloudflare: it is a third party that would see all traffic and contradicts the privacy promise.
- Not needed: `precompressed` (files tiny), `try_files` (Astro `trailingSlash: 'always'` with `build.format: directory` gives `dir/index.html`; `file_server` serves it), a custom 404 only if the site has `dist/404.html` (add `handle_errors` then).

## Deploy (GitHub Actions, rsync over SSH)

Server (once, by `ops/bootstrap.sh`, idempotent):
- `useradd --system --create-home --shell /usr/sbin/nologin rtp-deploy`? A nologin shell breaks rsync-over-ssh only if `command=` is absent; with `command="rrsync ..."` the forced command runs regardless of the shell setting. Use `/bin/sh` shell and `restrict,command=` to be safe, then test.
- `/srv/reveletonprog/site` owned by `rtp-deploy`, readable by `caddy` (group or `o+rx`).
- `~rtp-deploy/.ssh/authorized_keys`: `restrict,command="/usr/bin/rrsync -wo /srv/reveletonprog/site" ssh-ed25519 AAAA… github-actions-rtp`. `restrict` turns off pty, port, agent and X11 forwarding. No `from=` (GitHub runner ranges are too broad and change).
- No sudo for this user. Compromise of the key = write access to a static folder, nothing else.

Workflow (new job `deployer`, needs `verifier`, `e2e`; runs on tag `v*` or `workflow_dispatch` from `main` only):
- `environment: production` with a required reviewer: gives manual approval and scopes secrets to that environment. `permissions: contents: read`. `concurrency: { group: deploy, cancel-in-progress: false }`.
- Build with `RTP_DEPLOIEMENT=1`, run `npm run check-dist`, upload artifact; deploy job downloads it.
- Key handling: write `DEPLOY_SSH_KEY` to a `mktemp` file with `umask 077`, `trap rm`. Never `ssh-keyscan` in CI (trust on first use defeats pinning).
- **Pinning**: store the server's host key line(s) as the repository **variable** `DEPLOY_KNOWN_HOSTS` (public data, not a secret; verified once by comparing `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the VPS with `ssh-keyscan -t ed25519 host`). Use `-o UserKnownHostsFile=$RUNNER_TEMP/kh -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o BatchMode=yes`.
- Command: `rsync -rlt --delete-after --human-readable --stats -e "ssh …" dist/ "$DEPLOY_USER@$DEPLOY_HOST:./"` (with `rrsync` the remote path is relative to the locked root). Use `-rlt`, not `-a` (do not try to set owner/group/perm on a locked-down user). Two passes are better for the hashed assets: first `dist/_astro/` (no delete), then the rest with `--delete-after`, so a page never references a file that is not there yet.
- Secrets/variables (GitHub, environment `production`): `DEPLOY_SSH_KEY` (secret), `DEPLOY_KNOWN_HOSTS` (variable), `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` as variables. Store the private key in Vaultwarden too. Rotation: new key pair, replace line in `authorized_keys`, update secret.
- Post-deploy smoke step: `curl -fsS --retry 5 --retry-delay 3 https://$DOMAINE/ | grep -q reveleTonProg` and check headers (HSTS present, CSP present). Fails the run loudly (existing practice: watch `gh run list` after push).
- Rollback = re-run the workflow on the previous tag (matches RUNBOOK). Not atomic (a `current` symlink would need more than a locked `rrsync`); acceptable for a ~65-page static site, and the two-pass order above removes the realistic failure.
- Why not Docker/Watchtower, Ansible, Capistrano: heavier than the problem.

## Backups (what actually needs one)
The site is rebuildable from Git (source of truth) plus the workflow, so backing up `dist` is pointless. What is lost if the VPS disappears: Caddy site file, `/var/lib/caddy` (ACME account and certificates, re-issuable but rate-limited), `authorized_keys`, the monitoring cron with the ping UUID, and logs (deliberately not kept).
1. **Infrastructure as code in the repo** (`ops/`: Caddy file template, `bootstrap.sh`, cron, a README). This is what makes the restore real, and it matches Erwan's rule "déploiement reproductible, bootstrap.sh idempotent". Secrets stay out; the script reads them from environment.
2. **Hetzner**: if the VPS already has Hetzner backups or snapshots on, that covers the rest and nothing is added (check in the console first; do not enable a paid option without asking). Otherwise `restic` 0.19.1 to a Storage Box or other off-site target, covering only `/etc/caddy`, `/var/lib/caddy`, the cron files, the `rtp-deploy` `authorized_keys`: a few KB, so negligible disk and RAM.
3. **Test** (the hygiene rule "backups testés le 1er du mois"): monthly, `restic restore` or the snapshot into a temp dir, plus quarterly a dry-run of `bootstrap.sh` on a fresh local container (`docker run ubuntu:24.04`). Put the dated result in `RETROSPECTIVE.md`. The site content itself is re-tested every deploy.
4. `archives/` (source copies) already lives in Git and on GitHub; make sure the repo has a second copy (Erwan's Mac clone counts).

## Alternatives Considered
| Category | Recommended | Alternative | Why not |
|---|---|---|---|
| Alerting | Healthchecks.io heartbeat from a VPS cron | Uptime Kuma 2.5.9 (2026-10-31) self-hosted | Permanent Node + SQLite container, a few hundred MB on a 3.7 GB VPS that is already saturated; and if the VPS dies, the monitor dies with it. |
| Alerting | Healthchecks.io | Self-hosted Healthchecks 5.0.3 | Django + DB + workers: same RAM problem. The hosted free tier is enough. |
| Alerting | Healthchecks.io | UptimeRobot (hosted probe) | Real outside-in HTTP probe, which is attractive. Free tier terms and Telegram availability not verified, and it is another third-party account that sees the URL. Acceptable fallback; not researched further. |
| Alerting | VPS-side cron | Scheduled GitHub Actions workflow as the probe | Scheduled runs are delayed, best-effort, and disabled after 60 days without repo activity. Unreliable for uptime. |
| Deploy | plain `ssh` + `rsync` | `webfactory/ssh-agent`, `burnett01/rsync-deployments`, `appleboy/*` | An extra supply-chain dependency for 15 lines. |
| Deploy | forced-command `rrsync` | A normal shell user with a chown'd directory | A leaked CI key would give a shell. |
| CSP | Astro `security.csp` meta + small Caddy header | Header-only CSP with hashes | CSS hashes differ per page; one global header cannot list them. |
| CSS inlining | `inlineStylesheets: 'always'` | `auto` | `auto` depends on the 4 KB `assetsInlineLimit`, which this project sets to 0 to avoid `data:` URIs; behaviour would be ambiguous. |
| Script inlining | `?raw` + `set:html` | Custom Astro integration rewriting `dist/` after build | More code to keep, and post-processing hides what the source says. |
| Backup | Hetzner snapshot or restic of a few KB | Full-disk image tools, Borg | Overkill; the data is config. |
| Logs | Caddy `format filter` | Logging off | Keeps abuse diagnosis possible; `log` can be removed entirely (Caddy default no access log is only for site blocks without `log`) if the privacy page prefers "no log at all". Simpler legally; ask Erwan. |

## What NOT to add
- No analytics, no CDN, no Cloudflare, no external font, no error tracker (Sentry), no uptime widget on the site.
- No new npm package (no `csp-builder`, `html-minifier`, `critters`, `astro-compress`, `@playform/inline`). Everything needed is in Astro, Vite and `node:crypto`.
- No Docker container for the site, no Uptime Kuma, no Prometheus/Grafana/Netdata, no fail2ban rules for this site (static, no login).
- No `caddy-docker-proxy`, no Caddy plugin build: the stock `apt` binary serves this site.
- No `ssh-keyscan` in CI, no `StrictHostKeyChecking=no`, no `--rsync-path=sudo rsync`.
- No `preload` in HSTS (irreversible-ish, and other services share the host).

## Installation
```bash
# Repo: no npm install. Changes are in astro.config.mjs, src/layouts/Base.astro,
# src/components/LecteurNiveaux.astro, scripts/lib/check-dist.ts, .github/workflows/, ops/.

# VPS (via ops/bootstrap.sh, idempotent)
sudo apt-get install -y rsync            # normally already there; confirm rrsync path
caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
sudo systemctl restart caddy             # only once, to open the new log file
```

## Confidence
| Area | Level | Notes |
|---|---|---|
| Versions (Caddy, restic, actions, Healthchecks, Kuma) | HIGH | GitHub API, 2026-11-06 |
| Astro inline CSS + CSP meta | HIGH | Verified by a throwaway Node 24 build (not committed) |
| Script inlining via `?raw`, CSP hashes of inline scripts | MEDIUM | Mechanism standard, not built end to end yet |
| Caddy log filter paths and `rrsync -wo` flags | MEDIUM | Docs read; must be confirmed on the actual VPS (acceptance tests above) |
| Healthchecks.io Telegram on free tier | MEDIUM | Not confirmed from a docs page |
| Real-device Slow 4G < 1 s | LOW | RTT math says the TLS handshake alone costs about 2 s on the stated profile; the Lighthouse simulated target is reachable |

## Open questions for the roadmap
- VPS OS version, Caddy version and whether Hetzner backups/snapshots are already on (decide backup item 2).
- Access log: keep 14 days with masked IP, or no access log at all? Drives the Mentions légales wording.
- Domain registrar and DNS (A/AAAA to the VPS) are a prerequisite for Caddy to obtain the certificate; ports 80 and 443 must be open for ACME HTTP-01.

## Sources
- GitHub API `repos/caddyserver/caddy`, `restic/restic`, `healthchecks/healthchecks`, `louislam/uptime-kuma`, `actions/download-artifact`, `webfactory/ssh-agent` releases, 2026-11-06. HIGH
- https://caddyserver.com/docs/caddyfile/directives/log (output file rolling, `format filter`, `ip_mask`, default redactions). HIGH
- https://docs.astro.build/en/reference/configuration-reference/ (`build.inlineStylesheets`, `security.csp`, `scriptDirective.hashes`). HIGH
- Local build of the repo with `inlineStylesheets: 'always'` and `security.csp: true` on Node 24.22.2. HIGH (observed)
- https://healthchecks.io/pricing/ (free plan: 20 checks, 100 log entries). MEDIUM
- https://github.com/actions/runner-images (Ubuntu 2404 readme: rsync 3.2.7). HIGH
