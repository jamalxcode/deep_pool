# deep pool

A Bitcoin mempool explorer site: dashboard (`/`), Signet (`/signet`), Testnet3 (`/testnet`),
Testnet4 (`/testnet4`) and Accelerator (`/acceleration`).

## Servers and background jobs

There are none. The site is plain static files (HTML, CSS and one JavaScript file):

- No server code, no database, no scheduled or background jobs, no accounts.
- `npm run build` only copies `src/` into `dist/` and gives each page its own `index.html`.
  It installs nothing and needs no dependencies.
- Any static file host can serve `dist/` (GitHub Pages, Netlify, an S3 bucket, `python3 -m http.server`).

### Where the numbers come from

- Everything is built into the site itself: the blocks, fees and transactions start from a recorded snapshot.
- After the page has been open for about 45 seconds it simulates activity on its own: new transactions arrive,
  replacements appear, and roughly every ten minutes the next waiting block is mined.
- The site never connects to mempool.space or any other outside service, so it runs completely independently.
- Settings (currency, theme, timezone, closed banners) are kept in the browser's local storage only.
