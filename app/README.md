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

1. **Your own node**, if you set one (footer link "Use your own node"). Paste the address of the
   **mempool** or **Electrs/Esplora** app on your node, e.g. `http://umbrel.local:3006`. Bitcoin Core's
   own RPC can't be used from a web page (no CORS, needs a password). If the site is served over
   https, the node needs an https address too, or the browser blocks it.
2. **mempool.space**: everything, including projected blocks, fee bands, difficulty, prices,
   replacements, the incoming-transactions chart and a WebSocket that pushes new blocks.
3. **blockstream.info** (Esplora): blocks, fee estimates, recent transactions, mempool size.
   Projected blocks are cut from its fee histogram and the difficulty numbers are worked out
   from block times. It has no replacements, chart, prices or pool names, so those say so. No Testnet4.
4. **The recorded snapshot** built into `app.js`, used when nothing answers (offline, blocked,
   rate limited). It keeps itself moving with simulated activity, as before.

A source that fails is skipped for 5 minutes, then tried again. The footer always says which
source is in use. Block pages list a block's real transactions, and searching works for any block
height, block hash, transaction ID or address. Lookups go to whichever source is answering.

Still sample data: the Pool Goggles heatmap (coloured by the real fee range), the Accelerator
statistics, and the Mining, Lightning and Graphs tabs.

Settings (currency, theme, timezone, closed banners, your node's address) are kept in the browser's local storage only.
