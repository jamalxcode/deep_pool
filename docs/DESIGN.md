# Design: how deep pool is built, why, and what's next

## The shape of the system

```
Visitors ──▶ GitHub Pages (static files)
    │
    ├─ dashboard data ──▶ Cloudflare (HTTPS, WAF GET-only rule, cache 10 s, rate limit)
    │                        ▲ outbound tunnel only: no open ports, home IP hidden
    │                 Mac mini (dedicated, no wallet, FileVault, standard user "node")
    │                   OrbStack: cloudflared → Caddy gateway (allowlist) → mempool backend → MariaDB
    │                   Native:   Bitcoin Core (RPC on 127.0.0.1 only)
    │                   fallback: mempool.space → blockstream.info → snapshot
    │
    └─ lookups (block txs, tx, address) ──▶ mempool.space → blockstream.info

Admin ──▶ Tailscale ──▶ Mac mini (key-only SSH)
```

## Decisions

### The site

| Decision | Why | Alternatives considered |
|---|---|---|
| **Static site, data fetched by the browser** | Free hosting (GitHub Pages), nothing to run or patch, works from `file://`. | A backend of our own: more to run, and a single point of failure. |
| **Fallback chain:** visitor node → site node → mempool.space → blockstream.info → snapshot | No single failure (the node, a provider, the network) can take the site down. Visitors always see something. | mempool.space only: simplest, but depends on one company. |
| **A failed provider is skipped for 5 minutes** | A dead primary would otherwise slow every refresh by a timeout. | Retry every time. |
| **Fields a source can't give are shown as unavailable** (Blockstream: no replacements, chart, prices or pools) | Never show invented numbers as live. | Keep snapshot values: looks fuller, but it's misleading. |
| **Projected blocks on Blockstream are cut from the fee histogram in 1 MvB slices**, and difficulty is worked out from block times | Esplora has no such endpoints. Transaction counts per slice are estimates (the vsize share of the mempool count). | Leave those panels empty. |
| **WebSocket for mempool-style sources, plus polling** (60 s without the stream, 3 min with it) | The stream gives instant blocks and fees; the poll covers replacements and the chart, and recovers from any stream failure. | Polling only. |
| **Per-provider capability flags** (`lookups: false`) | A dashboard-only node answers 404 to lookups, and a 404 normally means "really not found" and stops the chain. | Treat 404 as "try the next one": would retry every genuinely unknown txid on every source. |
| **Lookups use the shared Esplora API** (`/tx`, `/block/:hash/txs/:start`, `/address`) | mempool.space and Blockstream both speak it, so one code path covers both. Block pages show 25 transactions per page because that's the API's page size. | Separate code per provider. |
| **The visitor's own node comes first, set per browser** (footer link, `localStorage`) | People with their own node get private data without anyone else's node load. | A site-wide setting only. |
| **Settings in `localStorage` only** | No accounts, no server. | — |

### The node

| Decision | Why | Alternatives considered |
|---|---|---|
| **Public access through a Cloudflare Tunnel** | The Mac connects outbound, so there are no router ports, the home IP is never shown, nothing changes when the IP changes, and Cloudflare adds HTTPS, caching, a WAF and rate limits. | **Tailscale** (private, only your devices: right for "just me"). Announcing the IP / dynamic DNS + port forward (exposes the home IP, opens the router). Tor (browsers can't reach .onion addresses). |
| **No IP announcement, no secrets in the site** | GitHub Pages is public static files. It can't receive anything or keep a secret: whatever the browser can read, anyone can. | — |
| **Dashboard-only node (no Electrs), lookups go to public explorers** | Electrs is the largest, slowest and most fragile part (hours of indexing, ~60 GB), and address lookups are the heaviest, most abusable queries. Dropping it leaves 5 parts and a much smaller public surface. | Full node with Electrs (`nodeLookups: true`), kept in git history (commit `8ec62e9`). |
| **mempool backend (`MEMPOOL_BACKEND=none`) as the middleware** | It's the software behind mempool.space and serves the exact API the site already speaks. Bitcoin Core's RPC can't be used from a browser (no CORS, needs a password). | A custom proxy translating RPC: less data (no address index, no projected blocks) and more code to own. |
| **Caddy gateway as an allowlist** | Only the dozen paths the dashboard calls get through, read-only, deep pool's origin only. Query strings are dropped (so they can't bypass the cache), and the `Server` header is removed. | Exposing the backend directly through the tunnel. |
| **Cache everything for 10 s at Cloudflare** | The data changes every few seconds anyway. A crowd costs the Mac about the same as one visitor. | No cache: load grows with visitors. |
| **Bitcoin Core native, everything else in containers (OrbStack)** | Containers give one-command start/stop/update and isolation. Bitcoin Core's 750 GB chain stays out of the VM for speed. OrbStack is lighter than Docker Desktop. | All native via Homebrew ([node/MACOS-NATIVE.md](../node/MACOS-NATIVE.md)): faster, but more to update, and it has to run as the admin user. |
| **`disablewallet=1`, RPC on 127.0.0.1** | Nothing on the machine to steal, and nothing outside can reach the control port. | — |
| **Mac hardening:** standard `node` user, FileVault, firewall stealth mode, sharing off, auto-updates, UPS, router UPnP off | Defence in depth for a machine that serves the public. The UPS covers the one FileVault downside: after a power cut someone must type the password. | Auto-login (requires FileVault off). |
| **Admin over Tailscale with key-only SSH** | Remote access without opening anything to the internet. | Public SSH or screen sharing. |

## Plans and next steps

Ordered by value:

1. **Check against the real APIs.** Everything was built offline with mocked answers. Open the
   built site in a normal browser, confirm the footer says "Live data from mempool.space", and
   check the WebSocket messages and replacements list (`data.js` `subscribe()` / `norm.replacements`).
2. **Publish to GitHub Pages.** Add a workflow (`actions/upload-pages-artifact` with `app/dist`, then
   `actions/deploy-pages`), set Pages to "GitHub Actions", and set `DEEPPOOL_ORIGIN` on the node to the
   published origin. Optionally a custom domain (e.g. `deeppool.sala.company`).
3. **Bring the node up** following [MINI-INSTALL.md](../MINI-INSTALL.md), pin the image versions to
   the newest tags, then set `node:` in `config.js`.
4. **Apply the colour-blind palette for real.** The brief asked for it, but the fee colours, block
   gradients and chart still use the original's red/green/purple scale. Only the logo and network
   colours use Okabe-Ito.
5. **Remove leftover original branding** in the footer: "Explore the full Bitcoin ecosystem®",
   "Trademark Policy", "Liquid Explorer", and the original's social links and version strings.
6. **Make the Goggles heatmap real** from the mempool WebSocket's projected-block transactions
   (`track-mempool-block`). It's simulated today.
7. **Live data for the Mining and Graphs tabs** (mempool's `/v1/mining/*` and `/v1/statistics/*`) and
   the Accelerator page. This would need the gateway allowlist widened.
8. **Uptime monitor** on `https://node.<domain>/api/v1/blocks/tip/height` (optional: the site already
   falls back on its own).
9. **CI:** run `npm test` and `node/tests/gateway.test.sh` on pull requests.
