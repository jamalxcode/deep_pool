# deep pool

A Bitcoin mempool explorer site: dashboard (`/`), Signet (`/signet`), Testnet3 (`/testnet`),
Testnet4 (`/testnet4`) and Accelerator (`/acceleration`).

## Servers and background jobs

There are none. The site is plain static files (HTML, CSS and one JavaScript file):

- No server code, no database, no scheduled or background jobs, no accounts.
- `npm run build` only copies `src/` (including `data.js`) into `dist/` and gives each page its own `index.html`.
  It installs nothing and needs no dependencies.
- Any static file host can serve `dist/` (GitHub Pages, Netlify, an S3 bucket, `python3 -m http.server`).

### Where the numbers come from

The browser fetches live data itself; there is still no server of our own. `src/data.js` tries these in order:

1. **A visitor's own node**, if they set one (footer link "Use your own node"). Paste the address of the
   **mempool** or **Electrs/Esplora** app on your node, e.g. `http://umbrel.local:3006`. Bitcoin Core's
   own RPC can't be used from a web page (no CORS, needs a password). If the site is served over
   https, the node needs an https address too, or the browser blocks it.
2. **deep pool's own node**, if `src/config.js` names one: a Bitcoin node on a Mac mini behind a
   Cloudflare Tunnel, which keeps its IP hidden. Setup: [`../node/README.md`](../node/README.md).
   Pages for networks it doesn't serve skip it. With `nodeLookups: false` (the recommended node has
   no Electrs) it serves the dashboard only, and block, transaction and address lookups go to the
   public explorers below.
3. **mempool.space**: everything, including projected blocks, fee bands, difficulty, prices,
   replacements, the incoming-transactions chart and a WebSocket that pushes new blocks.
4. **blockstream.info** (Esplora): blocks, fee estimates, recent transactions, mempool size.
   Projected blocks are cut from its fee histogram and the difficulty numbers are worked out
   from block times. It has no replacements, chart, prices or pool names, so those say so. No Testnet4.
5. **The recorded snapshot** built into `app.js`, used when nothing answers (offline, blocked,
   rate limited). It keeps itself moving with simulated activity, as before.

A source that fails is skipped for 5 minutes, then tried again. The footer always says which
source is in use. Block pages list a block's real transactions, and searching works for any block
height, block hash, transaction ID or address. Lookups go to whichever source is answering.

Still sample data: the Pool Goggles heatmap (coloured by the real fee range), the Accelerator
statistics, and the Mining, Lightning and Graphs tabs.

Settings (currency, theme, timezone, closed banners, your node's address) are kept in the browser's local storage only.

## Local development

Needs Node 22 (`node -v`). The site itself has no dependencies; Playwright is a development-only
dependency for the tests.

```bash
cd app
npm install          # once: installs Playwright and its Chromium (into ~/Library/Caches/ms-playwright)
npm run dev          # builds, serves http://localhost:8000/ and rebuilds when src/ changes (reload to see it)
npm test             # offline: builds, then 13 browser scenarios with every API mocked
npm run test:live    # online: probes every candidate provider, then opens the site against the real APIs
npm run check        # both
```

Switch on the push gate once per clone, from the repo folder: `git config core.hooksPath .githooks`.
`.githooks/pre-push` then runs `npm test` and `npm run test:live` before every push and stops the push
on any failure, or when `app/dist` doesn't match the commit (run `npm run build` and commit it).

### The mocked suite (`npm test`)

Drives the built site in Chromium with every API mocked: 13 scenarios covering each data source,
the fallbacks, a visitor's node, deep pool's own node (also dashboard-only), Testnet4 and a
phone-width layout. Exits non-zero if anything fails. Screenshots go to `tests/out/`.

### The live tests (`npm run test:live`)

1. `tests/providers.live.js` calls each of the 10 candidate providers in
   [DESIGN.md](../docs/DESIGN.md#providers) on every network it claims: tip, a settled block, its
   80-byte header (hashed to check it really is that block), fees, mempool, a transaction and an
   address lookup, plus the mempool extras and WebSocket. It records the CORS header (sent with the
   published site's origin), latency, tip height and hash, then compares tips (2+ blocks behind =
   stale). It writes the full report to `tests/out/providers-report.json`, and rewrites
   `src/providers.json` only when a provider, network or capability passes or fails differently
   (`--write` forces it). It fails only if fewer than 3 mainnet providers work. Anything else (a
   provider down, or rate-limiting this machine, which it labels `[rate-limited this machine]`) is
   reported, not failed.
2. `tests/smoke.live.js` opens the built site on all four networks with nothing mocked, and checks
   that every dashboard panel shows live data (tip matching the API, fees, projected blocks, mempool,
   difficulty, chart, recent transactions, replacements). On mainnet it also opens a block and
   searches a transaction, a block height and an address. Screenshots go to `tests/out/live-*.png`.
   It fails when a page doesn't go live, a panel lacks real data, a view or search breaks, or a
   JavaScript error happens. If a provider answered this machine with a rate limit (HTTP 429/430)
   during a page's checks, that page's data problems become warnings: visitors call from their own
   IP addresses, so a limit on your Mac isn't a site problem. JavaScript errors fail regardless.
   `SMOKE_RATE_LIMIT=mempool.space` and `SMOKE_DOWN=mempool.space,blockstream.info` simulate both
   cases to check this logic (the first must warn, the second must fail).

The probe calls each provider gently (bitaps blocks an IP for 5 minutes after 3 calls in 5 seconds),
but running it many times in a row can still get this machine rate-limited by the strictest free tiers.

See also the repo's [README](../README.md), [design notes](../docs/DESIGN.md) and [lessons learned](../docs/LESSONS.md).
