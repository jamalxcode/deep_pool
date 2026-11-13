# deep pool's own Bitcoin node (Mac mini + Cloudflare Tunnel)

deep pool itself stays a static site on GitHub Pages. This folder is the other half: the Mac mini
runs a Bitcoin node plus the mempool backend, and a Cloudflare Tunnel gives it a public `https://`
address **without exposing your home IP or opening any port on the router**.

```
visitor's browser ── loads deep pool ──▶ GitHub Pages (static files)
       │
       └── asks for data ──▶ https://node.<your-domain>  (Cloudflare: HTTPS, cache, rate limit)
                                   │ outbound tunnel, started by the Mac mini
                                   ▼
             Mac mini: gateway (Caddy) ─▶ mempool backend ─▶ Electrs ─▶ Bitcoin Core
                                                     └─▶ MariaDB
```

- **Your IP stays hidden.** The Mac mini connects *out* to Cloudflare; nobody connects in. There's
  nothing to announce when your IP changes, and the router needs no changes.
- **Read-only.** The gateway passes on GET requests under `/api/` only. Bitcoin Core's RPC (the
  part that can spend or change things) is bound to the Mac itself and never reachable.
- **If the node is down**, deep pool quietly uses mempool.space, then blockstream.info, then its
  built-in snapshot. Visitors always see something.

Nothing in deep pool is secret: the node address is in `app/src/config.js` for anyone to read. That's
fine. The node only serves public blockchain data, and Cloudflare's cache and rate limit keep the
load down.

## What you need

- **Mac mini** that stays on (16 GB memory or more is comfortable).
- **External SSD, 2 TB** (USB-C / Thunderbolt). The blockchain is about 750 GB in late 2026 and grows
  roughly 60-80 GB a year. Electrs adds about 60 GB, the rest is small. A pruned node won't work.
- **Docker Desktop** for Mac.
- **A domain on Cloudflare** (free plan is fine), for example `sala.company`. The node gets a
  subdomain such as `node.sala.company`.
- Patience for the first sync: Bitcoin Core takes **1-3 days**, then Electrs **several hours** more.

## 1. Bitcoin Core

1. Install Bitcoin Core from https://bitcoincore.org/en/download/ (the macOS `.dmg`).
2. Copy `bitcoin.conf.example` to `~/Library/Application Support/Bitcoin/bitcoin.conf`, set
   `datadir` to your SSD and choose a long random `rpcpassword`.
3. Start Bitcoin Core and let it sync to 100%. Keep the Mac awake:
   **System Settings → Energy → Prevent automatic sleeping**, and turn on **Start up automatically
   after a power failure**. Add Bitcoin Core to **Login Items** so it starts after a restart.

## 2. The Cloudflare Tunnel

1. In the Cloudflare dashboard open **Zero Trust → Networks → Tunnels → Create a tunnel →
   Cloudflared**, and name it `deep-pool-node`.
2. On the "Install connector" step, copy the long **token** (the part after `--token`). It goes into
   `.env` in the next step. You don't need to run the command they show; Docker does that.
3. Under **Public Hostname**, add one: subdomain `node`, your domain, service type **HTTP**,
   URL **`gateway:8080`**.

Then, in the dashboard for your domain:

4. **Caching → Cache Rules → Create rule**: when *Hostname equals* `node.<your-domain>`, set
   **Eligible for cache**, with **Edge TTL: use cache-control header if present**. The gateway marks
   blocks as cacheable for a day and everything else for 10 seconds, so a busy day costs the Mac
   mini very little.
5. **Security → WAF → Rate limiting rules → Create rule**: for *Hostname equals*
   `node.<your-domain>`, block an IP that sends more than **100 requests per 10 seconds** for 10 seconds.
   (An open deep pool page sends about a dozen requests a minute, fewer while the live stream is connected, plus a few per block or address someone opens.)

## 3. Start the node services

In Terminal, in this `node` folder:

```bash
cp .env.example .env
```

Edit `.env`: the SSD path, the same RPC user and password as in `bitcoin.conf`, two database
passwords, deep pool's address (`DEEPPOOL_ORIGIN`) and the tunnel token. Then:

```bash
docker compose up -d
```

```bash
docker compose logs -f electrs
```

Electrs indexes the whole chain the first time (several hours). When its log says it's finished,
check the API from the Mac itself:

```bash
curl -s http://localhost:8080/api/v1/blocks/tip/height
```

and from anywhere, through the tunnel:

```bash
curl -sI https://node.<your-domain>/api/v1/fees/recommended
```

The second answer should include `access-control-allow-origin: https://jamalxcode.github.io` (your
`DEEPPOOL_ORIGIN`) and `cache-control: public, max-age=10`.

In Docker Desktop's settings, turn on **Start Docker Desktop when you sign in**. The services
restart by themselves after that.

## 4. Point deep pool at it

In `app/src/config.js`, set:

```js
node: 'https://node.<your-domain>',
```

then rebuild (`npm run build` in `app/`) and publish. The footer then reads
**"Live data from the deep pool node (our own Bitcoin node), streaming"**. If it says mempool.space
instead, the browser couldn't reach the node: open the browser's developer console to see why.

## When something's wrong

| Symptom | Likely cause |
|---|---|
| Electrs or mempool log: *connection refused* to `host.docker.internal:8332` | Bitcoin Core isn't running, or still starting. If it is running, Docker Desktop may not reach services bound to `127.0.0.1` on your setup: in `bitcoin.conf` use `rpcbind=0.0.0.0` and add `rpcallowip=192.168.65.0/24` (Docker Desktop's network). Port 8332 still isn't reachable from outside, since the router forwards nothing. |
| *401 Unauthorized* in the logs | `BITCOIN_RPC_USER` / `BITCOIN_RPC_PASSWORD` in `.env` don't match `bitcoin.conf`. |
| deep pool falls back to mempool.space, console says *CORS* | `DEEPPOOL_ORIGIN` doesn't match deep pool's address exactly (scheme + host, no path, no trailing slash). After changing it, run `docker compose up -d gateway` and purge the Cloudflare cache. |
| Tunnel shows *Inactive* in Cloudflare | The `tunnel` container isn't running or the token is wrong: `docker compose logs tunnel`. |
| Address lookups are slow | Normal for the first queries after a restart; Electrs warms up. |

## Updating

Check each image's page on Docker Hub for newer versions (the links are in `docker-compose.yml`),
change the tag, then:

```bash
docker compose pull
```

```bash
docker compose up -d
```
