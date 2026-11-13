# CLAUDE.md

This file guides Claude Code when working in this repository.

## Overview

deep pool is a Bitcoin mempool explorer: a static site (vanilla HTML/CSS/JS, no framework, no
dependencies) with five routes (`/`, `/signet`, `/testnet`, `/testnet4`, `/acceleration`). Live data
is fetched by the visitor's browser, with a fallback chain ending in a snapshot built into the site.
`node/` holds the optional self-hosted Bitcoin node (Mac mini, Docker/OrbStack, Cloudflare Tunnel).
Read [docs/DESIGN.md](docs/DESIGN.md) before changing the data flow or the node, and
[docs/LESSONS.md](docs/LESSONS.md) for traps already hit.

## Commands

```sh
cd app && npm run build              # copies src/ to dist/ and makes one index.html per route; no deps
cd app && npm test                   # build + 13 browser scenarios with all APIs mocked (needs Playwright)
python3 -m http.server -d app/dist 8000
sh node/tests/gateway.test.sh        # node gateway rules vs a stand-in backend (needs caddy + node)
cd node && cp .env.example .env && docker compose config --quiet   # compose syntax check (no daemon needed)
```

## Architecture

- `app/src/index.html`: a 15-line shell. `{{ROOT}}` is replaced by `./` or `../` per route at build time.
- `app/src/config.js`: site settings (`window.DEEP_POOL_CONFIG`): `node`, `nodeName`, `nodeNetworks`, `nodeLookups`.
- `app/src/data.js`: the data layer (`window.DeepPoolData`, also `module.exports`). It turns API
  answers into the shapes `app.js` draws (`norm.*`). `Client` holds the provider order (visitor
  node → site node → mempool → esplora), `snapshot()` (one full dashboard read), `subscribe()`
  (mempool WebSocket), and lookups (`block`, `blockTxs`, `tx`, `address`, which use the shared
  Esplora API and skip providers with `lookups: false`). It never touches the DOM.
- `app/src/app.js`: one IIFE. It renders everything from the object `D` (the current network's data).
  Snapshot data (`S.mainnet` etc.) comes first, then the live-data section at the end: `applyLive()`
  merges `data.js` results into `D`, `refresh()`/`schedule()` poll, and `want()` caches async lookups
  for views. Views are pure string builders re-rendered by `renderContent()`/`renderBlockchain()`.
  The simulated activity (`tick`) runs only in snapshot mode.
- `app/src/style.css`: all styles. Colours are CSS variables; colour-blind-safe Okabe-Ito tones in the branding.
- `node/`: `docker-compose.yml` (MariaDB, mempool backend with `MEMPOOL_BACKEND=none`, Caddy
  gateway, cloudflared; Bitcoin Core runs natively), `Caddyfile` (allowlist gateway) and
  `Caddyfile.macos` (same rules for Homebrew, which must stay in sync: the gateway test checks
  this), `bitcoin.conf.example`, `.env.example`, `README.md`, `MACOS-NATIVE.md`, `tests/`.

## Conventions and gotchas

- **`app/dist/` is committed.** Run `npm run build` after every change in `app/src/` and commit both.
- Plain ES5-style JavaScript (`var`, function expressions), no modules, no dependencies, no build
  step beyond copying. Keep it that way: the site must work from any static host and from `file://`.
- **Never present invented data as live.** When a source lacks something (Blockstream has no
  replacements, chart or pool names), say "not available from <source>" rather than keeping
  snapshot values.
- **The fallback chain must survive any single failure**, including deep pool's own node being
  down, blocked, rate limited or misconfigured. A provider that can't do something gets a
  capability flag (like `lookups: false`), so its 404 doesn't stop the chain.
- `toast()` uses `textContent`: write `…`, not `&hellip;`, in toast messages.
- New `data.js` behaviour needs a scenario in `app/tests/live-data.test.js`, with an expectation in `check()`.
- Gateway changes go in both Caddyfiles, then run `node/tests/gateway.test.sh`. The allowlist must
  match exactly the calls `data.js` makes to a site node with `lookups: false`. Update it when
  `mempoolSnapshot()` or `subscribe()` start using a new path.
- No secrets anywhere in the repo or the site: everything in `app/` is public by nature. The node's
  passwords and tunnel token live only in `node/.env` (gitignored).
- Keep the swimmer logo and the "deep pool" name; don't add the original site's trademarks or logo.

## Git workflow

- **Always merge finished work to `main`** (the owner's standing instruction). Work on a branch,
  then fast-forward `main` to it and push both. Don't wait for a pull request unless asked for one.

## Deployment

Not wired up yet. GitHub Pages can only serve a repo's root or `/docs` from a branch, and the site
lives in `app/dist`, so publishing needs a GitHub Actions workflow (planned in docs/DESIGN.md).
Pushing to `main` triggers nothing today.
