# deep pool

A Bitcoin mempool explorer with its own branding: the swimmer-sign logo and the name "deep pool".
It's a static website (plain HTML, CSS and JavaScript, no build tools, no server code) with live
data loaded straight from the browser. Optionally it runs on its own Bitcoin node: a Mac mini
behind a Cloudflare Tunnel, with the home IP never exposed.

**Setting up the node? Start with [MINI-INSTALL.md](MINI-INSTALL.md)**: 24 plain steps.

```
Visitors ──▶ GitHub Pages (deep pool, static files in app/dist)
    │
    ├─ dashboard data ──▶ deep pool's node: Cloudflare → tunnel → Mac mini   (if configured)
    │                     then mempool.space → blockstream.info → built-in snapshot
    │
    └─ block / transaction / address lookups ──▶ mempool.space → blockstream.info
```

## What's in this repo

| Path | What it is |
|---|---|
| [MINI-INSTALL.md](MINI-INSTALL.md) | The node setup in 24 plain steps |
| [app/](app/) | The website. `src/` is the source, `dist/` the built site to publish. See [app/README.md](app/README.md) |
| [node/](node/) | The Mac mini side: Docker Compose, gateway config, Bitcoin Core config, the full guide ([node/README.md](node/README.md)) and a no-Docker version ([node/MACOS-NATIVE.md](node/MACOS-NATIVE.md)) |
| [docs/DESIGN.md](docs/DESIGN.md) | How it's built, why, and what's planned next |
| [docs/LESSONS.md](docs/LESSONS.md) | Things learned the hard way while building it |
| [CLAUDE.md](CLAUDE.md) | Notes for Claude Code (and any developer) working on the repo |
| `capture/`, `checks/`, `investigation/`, `attachments/`, `inbox/`, `usage.json` | Output of the AI site-recreation tool that made the first version (screenshots of the original, comparison runs, its notes). Reference only; the site doesn't use them. |

## Run it locally

```bash
cd app && npm run build
```

```bash
python3 -m http.server -d app/dist 8000
```

Open http://localhost:8000. The footer says where the numbers come from ("Live data from
mempool.space", or "Offline: showing a recorded snapshot" when no source answers).

## Test it

The website, in Chromium with every API mocked (needs Playwright):

```bash
cd app && npm test
```

The node gateway's rules, against a stand-in backend (needs `caddy` and `node`):

```bash
sh node/tests/gateway.test.sh
```

## Where the data comes from

The browser tries these in order (details in [app/README.md](app/README.md)):

1. a visitor's own node, if they set one in the footer
2. deep pool's own node (`node:` in [app/src/config.js](app/src/config.js); empty until the Mac mini is up)
3. mempool.space
4. blockstream.info
5. the snapshot built into the site

A source that fails is skipped for 5 minutes. With the recommended node (`nodeLookups: false`),
lookups always go to the public explorers.

## Status

- **Working:** the dashboard, block strip, block pages with real transactions, the transaction
  window, address pages, and search (height, block hash, txid, address). All five routes work:
  `/`, `/signet`, `/testnet`, `/testnet4`, `/acceleration`.
- **Still sample data:** the Pool Goggles heatmap (coloured by real fees), the Accelerator
  statistics, and the Mining, Lightning and Graphs tabs.
- **Not yet checked against the real APIs:** everything was built and tested offline with mocked
  answers. The first real-browser run should confirm the API field names.
- **Publishing:** every push to `main` that changes `app/` publishes the site to GitHub Pages
  (`https://jamalxcode.github.io/deep_pool/`) through `.github/workflows/pages.yml`. One-time setup:
  Settings → Pages → Source: GitHub Actions. The repo is private, so Pages needs a paid GitHub plan.
