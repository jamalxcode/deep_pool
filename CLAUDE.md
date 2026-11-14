# CLAUDE.md

This file guides Claude Code when working in this repository.

## Hard rules

- **Never commit `.env` or put real passwords in any file.** Secrets live only in `.env` files
  (gitignored) or in GitHub Actions secrets. Example files (`.env.example`, `bitcoin.conf.example`)
  hold placeholders only.
- **Anything in `app/` becomes the public website, so never put keys there.** Anyone visiting the
  site can read every file in it, including `config.js`.
- **If a secret ever gets pushed, rotate it right away.** Deleting the file afterwards doesn't hide
  it: it stays in the commit history. Change the password or token first, then clean up.

## Overview

deep pool is a Bitcoin mempool explorer: a static site (vanilla HTML/CSS/JS, no framework, no
dependencies) on GitHub Pages, with five routes (`/`, `/signet`, `/testnet`, `/testnet4`, `/acceleration`).

**Direction (v3):** no server and no node of our own. The browser reads the blockchain through about
10 public, keyless providers, with a router (health scores, circuit breaker, hedging, budgets), a
verifier (proof of work and block links checked in the browser) and an offline cache.
**The code is still v2:** a fixed fallback chain plus the superseded own-node kit in `node/`.
**[docs/DESIGN.md](docs/DESIGN.md) has the architecture and the 5-step build plan: read it before
any work**, and [docs/LESSONS.md](docs/LESSONS.md) for traps already hit.

## Commands

```sh
cd app && npm install                # once: Playwright + Chromium (dev-only; the site has no deps)
cd app && npm run build              # copies src/ to dist/ and makes one index.html per route; no deps
cd app && npm run dev                # build + http://localhost:8000 + rebuild on change
cd app && npm test                   # build + 13 browser scenarios with all APIs mocked
cd app && npm run test:live          # probe the 10 candidate providers (writes src/providers.json) + live browser smoke test
git config core.hooksPath .githooks  # once per clone: pre-push runs both test suites
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
- `node/` (**superseded by v3; removed in build step 5**): `docker-compose.yml` (MariaDB, mempool backend with `MEMPOOL_BACKEND=none`, Caddy
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
- **The data layer must survive any single failure**: a provider down, blocked, slow, stale, rate
  limited or returning bad data. A provider that can't do something declares it (capabilities), so
  its 404 doesn't stop the chain. A 404 on a lookup is confirmed by a second source before the
  page says "not found".
- **Keyless providers only.** A provider that needs an API key can't be used (see the hard rules).
- `toast()` uses `textContent`: write `…`, not `&hellip;`, in toast messages.
- New `data.js` behaviour needs a scenario in `app/tests/live-data.test.js`, with an expectation in `check()`.
- Gateway changes go in both Caddyfiles, then run `node/tests/gateway.test.sh`. The allowlist must
  match exactly the calls `data.js` makes to a site node with `lookups: false`. Update it when
  `mempoolSnapshot()` or `subscribe()` start using a new path.
- No secrets anywhere in the repo or the site: everything in `app/` is public by nature. The node's
  passwords and tunnel token live only in `node/.env` (gitignored).
- Keep the swimmer logo and the "deep pool" name; don't add the original site's trademarks or logo.

## Git workflow

- **Development and testing happen locally** (on the owner's Mac, set up with
  [LOCAL-SETUP.md](LOCAL-SETUP.md)). **Only work that passed `npm test` and `npm run test:live`
  locally is synced to GitHub.** `.githooks/pre-push` enforces this
  (`git config core.hooksPath .githooks`).
- **Then merge to `main`** (the owner's standing instruction): fast-forward `main` and push. Don't
  wait for a pull request unless asked for one.
- **Fetch before working:** other sessions push to `main` too. Start from the latest `origin/main`.
- **Cloud sessions can't reach the providers**, so they can't run the live tests. From a cloud
  session, push only docs or changes the owner will verify locally, and say which tests were not run.

## Deployment

- `.github/workflows/pages.yml` builds `app/` and publishes `app/dist` to GitHub Pages on every
  push to `main` that touches `app/` (and on manual dispatch). The site lives at
  `https://jamalxcode.github.io/deep_pool/` (a project site, so in a subfolder; all links are relative).
- One-time setup in the repo: Settings → Pages → Source: **GitHub Actions**. The repo is private,
  and Pages for a private repo needs a paid GitHub plan. The published site is public either way.
- GitHub only stores the code and hosts the site; nothing is built or decided there beyond
  publishing. An optional provider-monitor workflow may open issues, but must never commit.
