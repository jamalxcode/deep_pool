# Design: how deep pool is built, why, and what's next

> **Current direction (v3, decided 2026-11-14):** no server and no node of our own. The site, on
> GitHub Pages, reads the Bitcoin blockchain through about 10 public providers, routing around
> outages, slow answers and stale data, and checks the blocks itself in the browser. Development
> and testing happen locally; only work that passed locally is synced to GitHub.
>
> **The code today is still v2** (a fixed fallback chain: visitor node → site node → mempool.space
> → blockstream.info → snapshot, plus the own-node kit in `node/`). The [build plan](#build-plan)
> below turns it into v3.

## v3 architecture

```
GitHub Pages (static site + providers.json)
        │  loaded by each visitor's browser
        ▼
┌─────────────────────── in the browser ───────────────────────┐
│  Provider registry (~10 public sources, no API keys)         │
│        │                                                     │
│  Router: per data type, picks the healthiest source          │
│   • health score: speed, errors, how far behind the tip      │
│   • circuit breaker: a failing source is skipped for 5 min   │
│   • hedging: no answer in ~1.5 s → ask the next one too      │
│   • per-source request budget (respects free-tier limits)    │
│        │                                                     │
│  Verifier: proof of work + block links checked in the        │
│   browser; tip cross-checked across 2+ sources               │
│        │                                                     │
│  Cache: blocks and confirmed txs never change → browser      │
│   storage; last real data kept for offline use               │
│        │                                                     │
│  Adapters → one common shape → the existing UI               │
└──────────────────────────────────────────────────────────────┘
```

"Reading the blockchain directly" has a limit: a browser can't join the Bitcoin network itself,
because nodes talk over raw TCP (port 8333), which web pages can't open. So the site asks public
nodes and explorers, then **verifies what it can** (proof of work, block links, agreement between
sources), so no single provider has to be trusted.

## Providers

Candidates, chosen from documentation knowledge without network access. Build step 1's live
check (`npm run test:live`, first run 2026-11-14) decides which ones are enabled in `providers.json`.

**First live results (2026-11-14, from the owner's Mac):** usable on mainnet: mempool.space,
blockstream.info, publicnode.com, BlockCypher, blockchain.com (via its `/q/` endpoints; `/latestblock`
has no CORS header), Bitaps, and Blockchair (only when this IP isn't on its temporary blacklist).
Failed: mempool.emzy.de (rate limited, then refusing connections; its testnet/signet paths give 502),
mempool.bisq.services (the domain no longer resolves), dRPC (Bitcoin needs a paid plan).
BlockCypher's `test3` is ~349,000 blocks behind (stale), so it's mainnet only. Testnet4 has one
source (mempool.space). The report in `tests/out/providers-report.json` has every check's reason.

| # | Provider | API style | Expected capabilities |
|---|---|---|---|
| 1 | mempool.space | mempool (+ WebSocket) | everything: blocks, fees, projected blocks, difficulty, prices, replacements, chart, stream, lookups |
| 2 | mempool.emzy.de | mempool (+ WebSocket) | same as 1 (a community instance) |
| 3 | mempool.bisq.services | mempool | same as 1 (Bisq's instance) |
| 4 | blockstream.info | Esplora | blocks, headers, fee estimates, mempool + fee histogram, recent txs, lookups |
| 5 | bitcoin-rpc.publicnode.com | Bitcoin Core JSON-RPC, keyless | tip, blocks, headers, mempool info, fee estimates, transactions; no addresses (Core has no address index) |
| 6 | dRPC public Bitcoin endpoint | Bitcoin Core JSON-RPC, keyless | as 5 |
| 7 | api.blockchair.com | Blockchair REST | blocks, txs, addresses, mempool stats; free tier ~1,440 requests/day per IP |
| 8 | api.blockcypher.com | BlockCypher REST | blocks, txs, addresses, fee levels; free tier ~3 requests/s, ~100/hour per IP |
| 9 | blockchain.info | blockchain.com API (`cors=true`) | latest block, blocks, txs, addresses, unconfirmed txs |
| 10 | api.bitaps.com | Bitaps REST | blocks, txs, addresses, mempool |

Rules for the list:
- **Keyless only.** Anything in `app/` is public (see CLAUDE.md, hard rules), so a provider that
  needs an API key can't be used.
- **Every provider must allow calls from web pages (CORS)** and serve HTTPS.
- **Respect terms:** some free tiers ask for attribution (Blockchair, BlockCypher). The footer gets a
  "Data from …" line naming the providers in use.
- **Rate limits apply per visitor:** every browser calls from its own IP address, so per-IP limits
  are shared out naturally. Per-source budgets keep one visitor under the strictest limit.

### `providers.json`

Published with the site, read at start-up, written by `npm run test:live` (never edited from CI):

```json
{
  "checked": "2026-11-14T10:00:00Z",
  "providers": [
    {
      "id": "mempool-space",
      "name": "mempool.space",
      "type": "mempool",
      "api": { "mainnet": "https://mempool.space/api", "signet": "https://mempool.space/signet/api",
               "testnet": "https://mempool.space/testnet/api", "testnet4": "https://mempool.space/testnet4/api" },
      "ws": { "mainnet": "wss://mempool.space/api/v1/ws" },
      "budget": { "perMinute": 60 },
      "attribution": null,
      "enabled": true,
      "lastCheck": { "mainnet": { "ok": true, "cors": true, "latencyMs": 180, "tip": 975700,
                                  "capabilities": ["address", "block", "fees", "header", "tip", "tx"], "failed": [] } }
    }
  ]
}
```

`app/src/providers.js` keeps a built-in copy of the same list, so the site still works if
`providers.json` can't be loaded (for example from `file://`).

## How the browser side works

### Adapters

One adapter per API style: `mempool`, `esplora`, `bitcoind-rpc`, `blockchair`, `blockcypher`,
`blockchaininfo`, `bitaps`. Each declares its **capabilities** and turns answers into the shapes
`app.js` already draws (today's `norm.*` in `data.js`):

| Capability | Meaning |
|---|---|
| `tip` | newest block height and hash |
| `blocks` | recent blocks with size, tx count, time (fees and pool where available) |
| `header` | raw 80-byte header for a block hash (for verification) |
| `block`, `blockTxs` | one block, and its transactions page by page |
| `tx`, `address` | lookups |
| `mempoolInfo`, `feeHistogram`, `fees`, `recent` | mempool size and count, fee distribution, fee estimates, newest transactions |
| `projected`, `difficulty`, `prices`, `replacements`, `stats`, `stream` | mempool-API extras |

Missing capabilities are filled in when possible, as v2 already does: projected blocks are cut
from a fee histogram, and difficulty is worked out from block times. Otherwise the panel says
"not available" (never invented data).

### Router

For each request: take the enabled providers with that capability, drop those whose circuit
breaker is open or whose budget is spent, and sort by health score. Then:
- **Health score** = smoothed response time + a penalty per recent error + a penalty per block the
  source is behind the highest tip seen. Two or more blocks behind = treated as stale.
- **Circuit breaker:** 3 failures in a row (errors, timeouts, bad shapes) → skipped for 5 minutes,
  then one trial request.
- **Hedging** for time-critical data (`tip`, `blocks`, `fees`): no answer within 1.5 s → the
  next source is asked too, and the first valid answer wins.
- **Budgets:** a token bucket per source from `budget.perMinute`, so the strict free tiers aren't exceeded.
- **"Not found" isn't final from one source:** a just-broadcast transaction can be unknown to some
  nodes. A 404 on `tx` or `address` is confirmed by one more source before the page says "not found".
- **Spread lookups:** among equally healthy sources, pick at random, so no single provider takes all the load.

### Verifier

- For each new block, fetch its 80-byte header (from a source other than the one that reported
  the block when possible) and check:
  - the block hash is the double SHA-256 of the header
  - the hash is at or below the target encoded in the header's `bits`
  - the header's previous-hash field matches the block below it
- The tip height and hash are cross-checked across at least 2 sources. If they disagree, the
  majority wins and the footer shows a warning.
- The footer shows **"Verified: proof of work checked for the last N blocks"**, or why not.
- WebCrypto (`crypto.subtle`) only works on secure pages (https and localhost). From `file://`,
  verification is skipped and the footer says so.

### Live updates, caching and offline

- Live: mempool-style WebSockets first (providers 1-3). Without them, check the tip every 30 s,
  rotating sources. On a new block, refresh the dashboard.
- Cache: blocks by hash and confirmed transactions never change, so they're kept in IndexedDB.
  The last good dashboard is kept in `localStorage`.
- Offline: show the last real data with its time ("as of 14:32"). The recorded snapshot is used
  only on a first visit with no connection.
- A **status page** (`/status/`) shows every provider's health, response time, tip and
  capabilities, measured live from the visitor's browser.

### Security

- No keys, no secrets, nothing to steal: the site is public files.
- All provider data is untrusted: shapes are checked before use and every value is escaped
  (`esc()`) when drawn.
- A Content Security Policy `connect-src` lists exactly the providers in `providers.json`.

## Development workflow (local first)

```
Your Mac (local)                                   GitHub
──────────────────────────────────────────         ─────────────────────────────
edit  →  npm run dev    (local site, rebuilds on save)
      →  npm test       (offline: mocked APIs, fast)
      →  npm run test:live
           • probes every provider for real:
             answers? CORS allowed? expected fields?
             same tip height and block hash?
           • opens the site in Chromium against
             the live APIs and checks every panel
      →  all green?  ── git push (pre-push hook ──▶ main ──▶ Pages workflow ──▶ live site
                         re-runs both, blocks       (storage + hosting only)
                         the push on any failure)
```

- **Only locally tested work reaches GitHub.** `.githooks/pre-push` runs `npm test` and
  `npm run test:live` and refuses the push on any failure. Switch it on once per clone with
  `git config core.hooksPath .githooks`.
- **GitHub stores the code and hosts the site.** The Pages workflow stays. An optional hourly
  workflow may probe the providers and open an issue when one dies, but it never commits.
- **Tooling:** Node 22, Playwright as a development-only dependency (`npm install`). The website
  itself keeps zero dependencies.
- **Cloud sessions can't run the live tests** (their network blocks these providers). Develop with
  Claude Code on the local machine ([LOCAL-SETUP.md](../LOCAL-SETUP.md)), or connect a cloud
  session to the Mac through Remote Control.

## Build plan

Each step ends with `npm test` and `npm run test:live` passing locally, then a push to `main`.

1. **Local tooling**
   - `app/package.json`: `playwright` as a devDependency; scripts `dev` (build + local server +
     rebuild on change), `test` (mocked suite), `test:live` (provider probe + live browser smoke
     test), `check` (both)
   - `app/tests/providers.live.js`: for each candidate and network, call its tip, block, fee and
     lookup endpoints; record status, CORS header, latency, tip height and hash, and shape checks;
     compare tips; write `app/src/providers.json`
   - `app/tests/smoke.live.js`: open the built site against the real APIs and check every
     dashboard panel shows real data
   - `.githooks/pre-push`, and a "Local development" section in `app/README.md`
   - Done when the first `npm run test:live` has produced a `providers.json` naming which candidates passed
2. **Router and adapters**
   - split `data.js` into the registry, the router (health, breaker, hedging, budgets, confirmed
     404s) and one adapter per API style; `app.js` asks for capabilities, not providers
   - mocked scenarios: 10 providers with random failures, a stale provider, a slow provider
     (hedging), a budget running out, disagreeing tips, a 404 confirmed by a second source, all down
3. **Verifier:** header proof-of-work and link checks, tip cross-check, footer verification line;
   tests with real header bytes (block 0 and a recent block) and a tampered header
4. **Cache, offline and status page:** IndexedDB for immutable data, the last good dashboard,
   "as of" offline mode, `/status/`, the "Data from …" credit line, and the CSP
5. **Clean-up:** remove `node/`, `MINI-INSTALL.md`, the site-node setting (`config.js` `node*`)
   and the gateway test (all stay in git history); update README, CLAUDE.md, LESSONS.md

### Product backlog (after the build plan)

- **Apply the colour-blind palette for real.** The brief asked for it, but the fee colours, block
  gradients and chart still use the original's red/green/purple scale. Only the logo and network
  colours use Okabe-Ito.
- **Remove leftover original branding** in the footer: "Explore the full Bitcoin ecosystem®",
  "Trademark Policy", "Liquid Explorer", and the original's social links and version strings.
- **Make the Goggles heatmap real** from the mempool WebSocket's projected-block transactions.
- **Live Mining and Graphs tabs** (mempool `/v1/mining/*`, `/v1/statistics/*`) and the Accelerator page.
- **Custom domain** for Pages (e.g. `deeppool.sala.company`).

## Decisions

### Still valid from v2

| Decision | Why |
|---|---|
| **Static site, data fetched by the browser** | Free hosting, nothing to run or patch, no single point of failure of our own. |
| **Fields a source can't give are shown as unavailable** | Never show invented numbers as live. |
| **Projected blocks cut from a fee histogram** (1 MvB slices), **difficulty from block times** | Fills gaps for Esplora-style sources; transaction counts per slice are estimates. |
| **WebSocket plus polling** | The stream is instant; polling recovers from any stream failure. |
| **Capability flags per provider** | A source that can't do something must not answer "not found" for it and stop the chain. Generalised in v3 into the adapters' capability lists. |
| **Lookups through the shared Esplora API where possible** | mempool and Esplora sources share one code path. |
| **A visitor's own node, set per browser** | Recommended to keep in v3 as the first provider: zero cost, private data for people who run one. |
| **Settings in `localStorage`** | No accounts, no server. |
| **Pages via a GitHub Actions workflow, relative links with trailing slashes** | A project site lives in a subfolder; some hosts don't add the slash. |

### New in v3

| Decision | Why | Alternatives considered |
|---|---|---|
| **No node and no server of our own** | Nothing to buy, run, secure or keep online; fewest moving parts. | v2's Mac mini node (below). |
| **~10 public providers, routed per data type** | One outage, slowdown or stale source only affects what that source was serving. | A fixed fallback order (v2): simple, but slow on failure, and blind to stale data. |
| **Verify proof of work and block links in the browser** | Public data, but a provider can't fake blocks without real work. | Trust the majority only. |
| **Keyless providers only** | Keys in a public site are public; this follows the hard rules. | Origin-locked keys: still visible, and against the rules. |
| **Local development, push only after local tests pass** | The live providers can only be tested from a machine with real internet access; GitHub stays a clean record of working states. | Developing in cloud sessions: their network blocks the providers. |

## Superseded: v2 own-node design

Built and documented on 2026-11-13. It's replaced by v3, and the files stay in the repo until
build step 5 (then in git history). In short:
- **Setup:** a Mac mini (dedicated, no wallet, FileVault, standard user) ran Bitcoin Core plus the
  mempool backend, MariaDB, a Caddy allowlist gateway and cloudflared in OrbStack.
- **Public access:** through a Cloudflare Tunnel (no open ports, home IP hidden, cache, WAF, rate
  limit), with admin access over Tailscale.
- **Scope:** it served the dashboard only; lookups went to public explorers.
- **Files:** `node/`, `MINI-INSTALL.md`, and the commits `8ec62e9` (with Electrs) and `a005b98` (hardened).

Why it was dropped: it needed hardware, a 2 TB disk, a UPS, days of syncing and ongoing upkeep,
for data that public providers already serve. v3 gets the resilience from many providers instead
of one machine, and the trust from in-browser verification.
