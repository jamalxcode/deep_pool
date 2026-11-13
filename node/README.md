# deep pool's own Bitcoin node: the recommended setup

Goals: **maximum safety for the Mac mini**, **anyone on the internet can use deep pool**, **easy to
install**, **as few things as possible that can break**.

```
Visitors ──▶ GitHub Pages (deep pool, static files)
    │
    ├─ dashboard data ──▶ Cloudflare (HTTPS, firewall rule, cache, rate limit)
    │                        ▲ outbound tunnel only: no open ports, home IP never shown
    │                        │
    │                 Mac mini (dedicated, no wallet)
    │                   OrbStack: cloudflared → Caddy gateway → mempool backend → MariaDB
    │                   Native:   Bitcoin Core (its RPC listens on this Mac only)
    │
    └─ address / transaction lookups ──▶ mempool.space → blockstream.info  (never the Mac)

You (admin) ──▶ Tailscale ──▶ Mac mini   (private; nothing public)
```

## Why it's built this way

**Safety**
- **Nothing connects in.** The Mac mini opens an outbound tunnel to Cloudflare. The router forwards
  no ports, and your home IP never appears in DNS, in deep pool or anywhere public.
- **Nothing to steal.** Bitcoin Core runs with `disablewallet=1`. There are no coins on the machine,
  and its RPC (the control port) only listens on the Mac itself.
- **A tiny, read-only public surface, checked twice.** Cloudflare's firewall lets only `GET /api/...`
  through. Then the gateway allows only the dozen calls deep pool's dashboard makes and answers
  everything else with "Not found". Address and transaction lookups, the heavy queries someone
  could abuse, never reach the Mac.
- **Most traffic never reaches the Mac.** Cloudflare caches every answer for 10 seconds, so a
  thousand visitors cost the Mac about the same as one.
- **The public-facing parts are boxed in.** They run in containers. Only the gateway is reachable,
  and only through the tunnel.

**Fewer things to break**
- **Five parts:** Bitcoin Core, the mempool backend, MariaDB, the Caddy gateway and cloudflared.
  No Electrs: it's the largest, slowest and most fragile piece (hours of indexing, 60 GB, heavy queries).
- **One command** starts, stops or updates everything except Bitcoin Core.
- **deep pool never depends on the Mac.** If the node is down, visitors' browsers quietly use
  mempool.space, then blockstream.info, then deep pool's built-in snapshot.

**The trade-off:** block transaction lists, transaction and address lookups come from mempool.space
and blockstream.info. Everything on the dashboard (blocks, fees, projected blocks, difficulty,
mempool size, replacements, the incoming-transactions chart, prices, the live stream) comes from
your node.

## Shopping list

- **Mac mini** used only for this, 16 GB memory or more.
- **External SSD, 2 TB** (USB-C / Thunderbolt). The blockchain is about 750 GB in late 2026, plus
  about 60 GB for the transaction index. It grows roughly 60-80 GB a year.
- **A small UPS** (battery backup). With FileVault on, a power cut means someone has to type the
  password at the Mac before it starts again. A UPS rides through short cuts.
- **A domain on Cloudflare** (the free plan is enough), e.g. `sala.company`. The node becomes
  `node.sala.company`.

## 1. Prepare the Mac (once, as the admin user)

1. Finish macOS setup, install all updates, and create two accounts: your **admin** account, and a
   **standard** (non-admin) account called `node` that will run everything.
2. **FileVault on**: System Settings → Privacy & Security → FileVault.
3. **Firewall on, in stealth mode** (the Mac ignores probes from the local network):
   ```bash
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on --setstealthmode on
   ```
4. **Automatic updates**: System Settings → General → Software Update → Automatic updates →
   turn everything on.
5. **Sharing off**: System Settings → General → Sharing → turn off everything (File Sharing, Screen
   Sharing, Remote Login, Remote Management, Media Sharing, AirPlay Receiver). You'll manage it
   through Tailscale instead (step 6).
6. **Never sleep, restart after power cuts**:
   ```bash
   sudo pmset -a sleep 0 disksleep 0 autorestart 1
   ```
7. **Router**: turn **UPnP off**, make sure there are **no port forwards** to the Mac, and set a
   strong router admin password.
8. Install the two apps (they need admin once):
   ```bash
   brew install --cask orbstack tailscale
   ```
   (Install Homebrew first from https://brew.sh if it isn't there.)
9. Download **Bitcoin Core** for macOS from https://bitcoincore.org/en/download/ and drag it to
   Applications. To check the download, compare `shasum -a 256 ~/Downloads/bitcoin-*.dmg` with the
   `SHA256SUMS` file on that page.

Then log out, and **log in as `node`** for everything below. From now on, unlocking the Mac after a
restart means logging in as `node`, which starts everything.

## 2. Bitcoin Core (as `node`)

1. Copy `bitcoin.conf.example` to `~/Library/Application Support/Bitcoin/bitcoin.conf`. Set
   `datadir` to your SSD and choose a long random `rpcpassword`. This makes one:
   ```bash
   openssl rand -hex 24
   ```
2. Open Bitcoin Core. In **Settings → Main**, tick **Start Bitcoin Core on system login**.
3. Let it sync to 100%. That takes **1-3 days**; the rest can be set up meanwhile.

## 3. Cloudflare (in the browser, any computer)

1. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, name it `deep-pool-node`.
   On the "Install connector" step copy the long **token** (the text after `--token`); you only need
   the token, not the command.
2. **Public Hostname**: subdomain `node`, your domain, service type **HTTP**, URL **`gateway:8080`**.

Then, in your domain's dashboard:

3. **Security → WAF → Custom rules → Create rule** "Read-only node", action **Block**, expression:
   ```
   (http.host eq "node.YOUR-DOMAIN" and (http.request.method ne "GET" or not starts_with(http.request.uri.path, "/api/")))
   ```
4. **Security → WAF → Rate limiting rules → Create rule**: when *Hostname equals*
   `node.YOUR-DOMAIN`, **Block** an IP that sends more than **100 requests per 10 seconds**, for 10 seconds.
   An open deep pool page sends about a dozen requests a minute.
5. **Caching → Cache Rules → Create rule**: when *Hostname equals* `node.YOUR-DOMAIN`, set
   **Eligible for cache**, **Edge TTL: use cache-control header if present**, and under **Cache key**
   turn on **Ignore query string**.
6. **SSL/TLS → Edge Certificates**: **Always Use HTTPS** on, **Minimum TLS Version** 1.2.

## 4. Start the node services (as `node`, in this folder)

Open OrbStack once (if it asks for an administrator password, enter the admin account's) and turn on **Start at login** in its settings. Then:

```bash
cp .env.example .env && chmod 600 .env
```

Edit `.env`:
- the SSD path
- the RPC user and password from `bitcoin.conf`
- two database passwords (`openssl rand -hex 24` each)
- deep pool's address as `DEEPPOOL_ORIGIN`
- the tunnel token

When Bitcoin Core has finished syncing:

```bash
docker compose up -d
```

The mempool backend needs a few minutes to load the mempool. Check it from the Mac:

```bash
curl -s http://localhost:8080/api/v1/blocks/tip/height
```

and from anywhere:

```bash
curl -sI https://node.YOUR-DOMAIN/api/v1/fees/recommended
```

The answer should show `access-control-allow-origin` with your deep pool address, and
`cache-control: public, max-age=10`. This one should be refused, which proves the allowlist works:

```bash
curl -s https://node.YOUR-DOMAIN/api/tx/0000000000000000000000000000000000000000000000000000000000000000
```

## 5. Point deep pool at it

In `app/src/config.js` set `node: 'https://node.YOUR-DOMAIN'` (keep `nodeLookups: false`), then
rebuild (`npm run build` in `app/`) and publish. The footer reads **"Live data from the deep pool
node (our own Bitcoin node), streaming"**.

## 6. Private admin access (Tailscale)

Open Tailscale on the Mac mini and sign in, then do the same on your laptop or phone. To get a
terminal on the Mac mini from anywhere, turn on **Remote Login** for the `node` user only
(System Settings → General → Sharing → Remote Login → "Only these users"), with keys instead of a
password:

```bash
sudo tee /etc/ssh/sshd_config.d/100-deep-pool.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
```

Put your laptop's public key in `~node/.ssh/authorized_keys`, then connect with
`ssh node@<mac-mini-name>` over Tailscale. The router still forwards nothing, so this is reachable
only from your own devices on Tailscale and your home network.

## Running it

| Task | How |
|---|---|
| Status | `docker compose ps`, and Bitcoin Core's window |
| Logs | `docker compose logs -f mempool` (or `gateway`, `tunnel`, `db`) |
| Update the services (monthly) | change the image tags in `docker-compose.yml` to the newest (links in the file), then `docker compose pull && docker compose up -d` |
| Update Bitcoin Core | download the new version from bitcoincore.org, quit Bitcoin Core, replace the app, open it |
| Planned restart (FileVault) | `sudo fdesetup authrestart`: restarts without asking for the password once |
| Know when it's down | optional: a free uptime monitor on `https://node.YOUR-DOMAIN/api/v1/blocks/tip/height`. deep pool keeps working either way. |

## When something's wrong

| Symptom | Likely cause |
|---|---|
| mempool log: *connection refused* to `host.docker.internal:8332` | Bitcoin Core isn't running or still starting. If it is running and Docker Desktop is used instead of OrbStack, Docker may not reach services bound to `127.0.0.1`: use `rpcbind=0.0.0.0` and add `rpcallowip=192.168.65.0/24`. The router forwards nothing, and stealth mode is on. |
| *401 Unauthorized* in the mempool log | `BITCOIN_RPC_USER` / `BITCOIN_RPC_PASSWORD` in `.env` don't match `bitcoin.conf`. |
| deep pool falls back to mempool.space, browser console says *CORS* | `DEEPPOOL_ORIGIN` doesn't match deep pool's address exactly (scheme + host, no path, no trailing slash). Fix it, run `docker compose up -d gateway`, and purge the Cloudflare cache. |
| Tunnel shows *Inactive* in Cloudflare | `docker compose logs tunnel`: the token is wrong or the container isn't running. |
| Everything stopped after a power cut | The Mac is waiting for the FileVault password: log in as `node`. |

## Other options

- **Short version**: [MINI-INSTALL.md](MINI-INSTALL.md), the whole setup in 24 plain steps.
- **Without Docker**: [MACOS-NATIVE.md](MACOS-NATIVE.md) installs the same five parts with Homebrew.
  It's faster and lighter, but there are more things to update by hand.
- **With address lookups on your own node**: add Electrs (an address index) and set
  `nodeLookups: true` in `config.js`. That means more disk, hours of indexing and a heavier public
  surface, so it isn't part of the recommended setup. The Electrs version of these files is in this
  folder's git history (commit `8ec62e9`).
