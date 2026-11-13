# Lessons learned

Things found out while turning the first version into a working explorer, so nobody has to find
them again.

## Architecture

1. **A GitHub Pages site can't keep a secret or receive anything.** It's public static files, so
   "the node announces its IP only to deep pool" can't work: there's no deep pool server to tell,
   and anything the page can read, anyone can read. It's each visitor's browser that connects, not
   "the site". So a self-hosted node must be reachable by browsers, and the question is only how
   to hide and protect it (a tunnel).
2. **Bitcoin Core's RPC can't be called from a web page.** It has no CORS support and needs a
   password, which would be public in the page. You need middleware next to it: the mempool backend
   (what mempool.space runs) or Electrs/Esplora. These speak the same `/api` that deep pool uses.
3. **An `https://` page can't call an `http://` address** (mixed content). A home node behind plain
   HTTP works only from a locally served deep pool, or behind HTTPS (tunnel, Tailscale certificate,
   reverse proxy).
4. **A tunnel beats announcing an IP.** An outbound tunnel (Cloudflare, Tailscale) needs no router
   changes, never shows the home IP, and doesn't care when the IP changes.
5. **Self-hosting has no rate limits, only hardware and bandwidth.** If a public site points every
   visitor at a home node, the node needs a cache and rate limit in front (Cloudflare), or should
   serve only cheap data (the dashboard-only design).
6. **Fewer parts beat more features for a home server.** Dropping Electrs removed the slowest,
   biggest, most fragile component and the most abusable queries, at the cost of lookups that the
   public explorers already answer well.

## The data layer

7. **A capability gap must not look like "not found".** A dashboard-only node returns 404 for
   lookups. The fallback logic stops on 404 (rightly, for a txid that doesn't exist), so the node
   needed a `lookups: false` flag to be skipped for those calls.
8. **When a source lacks a field, say so.** Keeping snapshot numbers next to live ones (old
   price, fake replacements) would mislead. Blockstream's panels now say "not available from
   blockstream.info".
9. **Esplora can stand in for most of the mempool API.** Projected blocks can be cut from
   `/mempool`'s fee histogram and the difficulty estimate worked out from block times. Only
   replacements, the incoming chart, prices and pool names are truly missing.
10. **`toast()` sets `textContent`**, so HTML entities like `&hellip;` show up literally. Use the
    real character.

## Caddy (the gateway)

11. **`rewrite * {path}` keeps the query string.** When the new URI has no `?`, Caddy keeps the
    original query. `rewrite * {path}?` clears it. That matters because random query strings would
    otherwise bypass Cloudflare's cache and hit the Mac.
12. **To override a header the backend sets** (the mempool backend sends `Cache-Control: no-store`
    on some paths), the `header` block needs `defer`.
13. **Use `route { }` to keep directives in the written order.** Outside it, Caddy sorts directives
    (e.g. `handle` before `respond`), which could let an OPTIONS or POST past a check placed above it. The gateway was written with `route` from the start for this reason.

## Cloudflare

14. **Cloudflare doesn't cache JSON or extensionless URLs by default.** A Cache Rule ("Eligible for
    cache", respect origin TTL, ignore query string) is needed.
15. **Cloudflare ignores `Vary: Origin`**, so a cached response carries whichever
    `Access-Control-Allow-Origin` it was stored with. Allow exactly one origin (deep pool's).

## macOS

16. **Homebrew and a separate standard user don't mix.** Homebrew's prefix belongs to the admin
    who installed it, so a standard `node` user can't run MariaDB from it or write its config.
    That's one reason the recommended setup uses containers (OrbStack) for everything but Bitcoin Core.
17. **FileVault and automatic login exclude each other.** After a power cut, a FileVault Mac waits
    for a password. A UPS avoids most of that, and `sudo fdesetup authrestart` handles planned restarts.
18. **Docker on a Mac runs inside a VM**: it costs memory, and disk access to the Mac's files is
    slower (it matters most for Electrs). OrbStack is lighter than Docker Desktop and runs the same
    compose file.

## Working method

19. **Build offline, verify online.** This sandbox couldn't reach mempool.space or Blockstream, so
    the API field names came from documentation knowledge and were tested only against mocks. Mocked
    tests catch logic errors, not wrong field names. The first real-browser run is still a required step.
20. **Test the real config, not a description of it.** Building the actual Caddy binary and firing
    requests at the actual Caddyfile caught the query-string leak (lesson 11), which reading the
    config hadn't.
21. **Keep tests in the repo.** The browser and gateway tests first lived in a scratch folder. They're
    now `app/tests/live-data.test.js` (`npm test`) and `node/tests/gateway.test.sh`, and both exit
    non-zero on failure.
22. **The first version's 90% "matches the original" score was partly an artefact.** The original
    tool's notes say its check photographed the page while the Goggles heatmap was still fading in,
    so it compared mostly empty cards. Visual scores need a settled page.
23. **A shallow clone that tracks only `main` makes a pushed branch look unpushed.** Add a fetch
    refspec for the branch (`git config --add remote.origin.fetch ...`) and set its upstream.
