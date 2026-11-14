# deep pool

A Bitcoin mempool explorer with its own branding: the swimmer-sign logo and the name "deep pool".
It's a static website on GitHub Pages (plain HTML, CSS and JavaScript, no server) that reads the
Bitcoin blockchain through public providers, straight from each visitor's browser.

**Developing on your Mac? Start with [LOCAL-SETUP.md](LOCAL-SETUP.md)**: 20 plain steps.

## Architecture (v3, being built)

No server and no node of our own. The browser picks among about 10 public Bitcoin providers per
kind of data, routes around outages, slow answers and stale data, and checks the blocks itself
(proof of work, block links, agreement between sources).

```
GitHub Pages (static site + providers.json)
        │  loaded by each visitor's browser
        ▼
  Provider registry (~10 public sources, no API keys)
        │
  Router: healthiest source per data type · skip failures for 5 min
          · ask a second source if the first is slow · per-source request budgets
        │
  Verifier: proof of work + block links checked in the browser · tip cross-checked
        │
  Cache: immutable blocks and txs kept in the browser · last real data for offline use
        │
  Adapters → one common shape → the UI
```

Development is local: changes are tested on the Mac against mocked and real providers, and only
work that passed is pushed to GitHub, which hosts the site. The full design, the provider
candidates and the 5-step build plan are in **[docs/DESIGN.md](docs/DESIGN.md)**.

## Status

- **The code is still v2:** a fixed fallback chain (a visitor's own node → deep pool's own node →
  mempool.space → blockstream.info → built-in snapshot). Build steps 1-5 in docs/DESIGN.md turn it into v3.
- **Working today:** the dashboard, block strip, block pages with real transactions, the
  transaction window, address pages, and search (height, block hash, txid, address). All five
  routes work: `/`, `/signet`, `/testnet`, `/testnet4`, `/acceleration`.
- **Still sample data:** the Pool Goggles heatmap (coloured by real fees), the Accelerator
  statistics, and the Mining, Lightning and Graphs tabs.
- **Not yet checked against the real APIs:** everything so far was built and tested offline with
  mocked answers. Build step 1's `npm run test:live` is the first real check.
- **Publishing:** every push to `main` that changes `app/` publishes the site to GitHub Pages
  (`https://jamalxcode.github.io/deep_pool/`) through `.github/workflows/pages.yml`. One-time setup:
  Settings → Pages → Source: GitHub Actions. The repo is private, so Pages needs a paid GitHub plan.

## What's in this repo

| Path | What it is |
|---|---|
| [LOCAL-SETUP.md](LOCAL-SETUP.md) | Setting up a Mac to develop with Claude Code, in 20 plain steps |
| [docs/DESIGN.md](docs/DESIGN.md) | The architecture, decisions, providers and build plan |
| [docs/LESSONS.md](docs/LESSONS.md) | Things learned the hard way |
| [CLAUDE.md](CLAUDE.md) | Rules and notes for Claude Code (and any developer) |
| [app/](app/) | The website. `src/` is the source, `dist/` the built site that gets published. See [app/README.md](app/README.md) |
| [.github/workflows/pages.yml](.github/workflows/pages.yml) | Publishes `app/dist` to GitHub Pages |
| [node/](node/), [MINI-INSTALL.md](MINI-INSTALL.md) | **Superseded** v2 own-node kit (Mac mini + Cloudflare Tunnel). Kept until build step 5, then only in git history |
| `capture/`, `checks/`, `investigation/`, `attachments/`, `inbox/`, `usage.json` | Output of the AI site-recreation tool that made the first version. Reference only |

## Run it locally

```bash
cd app && npm run build
```

```bash
python3 -m http.server -d app/dist 8000
```

Open http://localhost:8000. The footer says where the numbers come from. Build step 1 adds
`npm run dev`, which rebuilds on save.

## Test it

Offline, with every API mocked (needs Playwright):

```bash
cd app && npm test
```

Build step 1 adds `npm run test:live` (the real providers, from your machine) and a pre-push hook
that runs both before anything reaches GitHub.
