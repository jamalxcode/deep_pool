# deep pool node on macOS with Homebrew (no Docker)

The same five parts as the recommended setup in [README.md](README.md) (Bitcoin Core, MariaDB,
the mempool backend, the Caddy gateway and a Cloudflare Tunnel), but installed with Homebrew instead
of containers. That means no VM, but more to update by hand. Do README.md's step 1 (preparing the
Mac, skipping the `node` account and OrbStack), step 3 (Cloudflare) and step 6 (Tailscale); this
file replaces steps 2 and 4.

**One difference in safety:** Homebrew's files belong to the account that installed it, so here
everything runs as your **admin** account instead of a separate standard `node` account. That's one
of the reasons the Docker setup is the recommended one. Everything starts when that account logs in
(after a restart, log in to unlock FileVault). Commands assume the SSD is mounted at `/Volumes/BitcoinSSD`. Change `SSD` below if not.

## 0. Settings file (passwords are generated for you)

```bash
cat > ~/deep-pool-node.env <<EOF
SSD=/Volumes/BitcoinSSD
RPCUSER=deeppool
RPCPASS=$(openssl rand -hex 24)
DBPASS=$(openssl rand -hex 24)
ORIGIN=https://jamalxcode.github.io
EOF
chmod 600 ~/deep-pool-node.env
```

`ORIGIN` is deep pool's published address (scheme + host, no path). Load the settings into each new
Terminal window before running the commands below:

```bash
source ~/deep-pool-node.env
```

## 1. Homebrew and the tools

```bash
xcode-select --install
```

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

```bash
brew install bitcoin mariadb node@22 caddy cloudflared jq git
```

Keep the Mac awake, and have it restart after a power cut:

```bash
sudo pmset -a sleep 0 disksleep 0 autorestart 1
```

(Homebrew's Bitcoin Core replaces the bitcoincore.org app from README.md; use one or the other.)

## 2. Bitcoin Core

```bash
mkdir -p "$SSD/Bitcoin" "$HOME/Library/Application Support/Bitcoin" ~/Library/Logs/deep-pool
```

```bash
cat > "$HOME/Library/Application Support/Bitcoin/bitcoin.conf" <<EOF
datadir=$SSD/Bitcoin
prune=0
txindex=1
disablewallet=1
server=1
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcuser=$RPCUSER
rpcpassword=$RPCPASS
dbcache=4000
listen=1
EOF
chmod 600 "$HOME/Library/Application Support/Bitcoin/bitcoin.conf"
```

```bash
brew services start bitcoin
```

Watch the sync (1.0 = done; it takes 1-3 days):

```bash
bitcoin-cli getblockchaininfo | jq '{blocks, verificationprogress}'
```

## 3. MariaDB

```bash
brew services start mariadb
```

```bash
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS mempool; CREATE USER IF NOT EXISTS 'mempool'@'localhost' IDENTIFIED BY '$DBPASS'; GRANT ALL PRIVILEGES ON mempool.* TO 'mempool'@'localhost'; FLUSH PRIVILEGES;"
```

## 4. The mempool backend

```bash
git clone https://github.com/mempool/mempool ~/mempool
```

Check out the newest release:

```bash
cd ~/mempool && git checkout "$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)"
```

```bash
cd ~/mempool/backend && export PATH="$(brew --prefix node@22)/bin:$PATH" && npm install && npm run build
```

Write its settings from the sample file:

```bash
cd ~/mempool/backend && jq --arg u "$RPCUSER" --arg p "$RPCPASS" --arg d "$DBPASS" '
  .MEMPOOL.NETWORK = "mainnet" | .MEMPOOL.BACKEND = "none" | .MEMPOOL.HTTP_PORT = 8999 |
  .CORE_RPC.HOST = "127.0.0.1" | .CORE_RPC.PORT = 8332 | .CORE_RPC.USERNAME = $u | .CORE_RPC.PASSWORD = $p |
  .DATABASE.ENABLED = true | .DATABASE.HOST = "127.0.0.1" | .DATABASE.PORT = 3306 |
  .DATABASE.DATABASE = "mempool" | .DATABASE.USERNAME = "mempool" | .DATABASE.PASSWORD = $d |
  .STATISTICS.ENABLED = true' mempool-config.sample.json > mempool-config.json && chmod 600 mempool-config.json
```

Run it as a background service:

```bash
cat > ~/Library/LaunchAgents/company.deeppool.mempool.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>company.deeppool.mempool</string>
  <key>ProgramArguments</key><array>
    <string>$(brew --prefix node@22)/bin/node</string>
    <string>--max-old-space-size=2048</string>
    <string>dist/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME/mempool/backend</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/deep-pool/mempool.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/deep-pool/mempool.log</string>
</dict></plist>
EOF
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/company.deeppool.mempool.plist
```

## 5. The gateway (Caddy)

This writes the same file as `Caddyfile.macos` in this folder, with your `ORIGIN` filled in:

```bash
cat > "$(brew --prefix)/etc/Caddyfile" <<'EOF'
# deep pool node gateway, native macOS version (Homebrew Caddy): the same rules as ./Caddyfile,
# listening on this Mac only, with the mempool backend on 127.0.0.1. Installed as
# $(brew --prefix)/etc/Caddyfile. Replace DEEPPOOL_ORIGIN_HERE with deep pool's address.
# The only service the Cloudflare tunnel can reach.
#  - allowlist: only the calls deep pool makes to its node; everything else is 404
#  - read-only: GET (and the browser's OPTIONS check) only
#  - Bitcoin Core's RPC is never reachable from outside
#  - browsers may call it only from deep pool's address (DEEPPOOL_ORIGIN in .env)
#  - tells Cloudflare it may cache answers for 10 seconds, so most visitors never reach the Mac
{
	admin off
	auto_https off
}

:8080 {
	bind 127.0.0.1

	header {
		Access-Control-Allow-Origin DEEPPOOL_ORIGIN_HERE
		Access-Control-Allow-Methods "GET, OPTIONS"
		Access-Control-Allow-Headers "Content-Type"
		Access-Control-Max-Age "86400"
		X-Content-Type-Options "nosniff"
		-Server
	}

	route {
		# deep pool's dashboard calls, and nothing else
		@denied not path_regexp ^/api/(v1/(blocks(/[0-9]{1,8}|/tip/height)?|fees/(mempool-blocks|recommended)|difficulty-adjustment|replacements|statistics/2h|prices|ws)|mempool(/recent)?)$
		respond @denied "Not found" 404

		# drop any query string: deep pool never sends one, and random ones would bypass the cache
		rewrite * {path}?

		@preflight method OPTIONS
		respond @preflight 204

		@notget not method GET
		respond @notget "Read-only" 405

		# live stream (WebSocket) for new blocks, fees and the mempool
		@ws path /api/v1/ws
		reverse_proxy @ws 127.0.0.1:8999

		header {
			Cache-Control "public, max-age=10"
			defer
		}

		# the backend serves /api/mempool and /api/mempool/recent under /api/v1/
		@esplora {
			path /api/*
			not path /api/v1/*
		}
		uri @esplora replace /api/ /api/v1/ 1

		reverse_proxy 127.0.0.1:8999
	}
}
EOF
sed -i '' "s#DEEPPOOL_ORIGIN_HERE#$ORIGIN#" "$(brew --prefix)/etc/Caddyfile"
```

```bash
caddy validate --config "$(brew --prefix)/etc/Caddyfile" --adapter caddyfile
```

```bash
brew services start caddy
```

## 6. The Cloudflare Tunnel

Create the tunnel as in README.md step 3, but give the public hostname the URL
**`localhost:8080`** (not `gateway:8080`). Then install the connector as a system service (paste
your token):

```bash
sudo cloudflared service install PASTE-YOUR-TOKEN-HERE
```


## 7. Check it

On the Mac (a few minutes after the mempool backend starts):

```bash
curl -s http://127.0.0.1:8080/api/v1/blocks/tip/height
```

From anywhere (should show `access-control-allow-origin` and `cache-control`):

```bash
curl -sI https://node.YOUR-DOMAIN/api/v1/fees/recommended
```

The allowlist should refuse this one:

```bash
curl -s https://node.YOUR-DOMAIN/api/tx/0000000000000000000000000000000000000000000000000000000000000000
```

Then set `node: 'https://node.YOUR-DOMAIN'` in `app/src/config.js` (keep `nodeLookups: false`) and redeploy deep pool.

## Everyday commands

What's running:

```bash
brew services list && launchctl list | grep deeppool
```

Logs:

```bash
tail -f ~/Library/Logs/deep-pool/*.log
```

Restart the mempool backend:

```bash
launchctl kickstart -k gui/$(id -u)/company.deeppool.mempool
```

## Updating

```bash
brew update && brew upgrade
```

```bash
source ~/deep-pool-node.env && cd ~/mempool && git fetch --tags && git checkout "$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)" && cd backend && export PATH="$(brew --prefix node@22)/bin:$PATH" && npm install && npm run build && launchctl kickstart -k gui/$(id -u)/company.deeppool.mempool
```

## If something doesn't work

| Symptom | Fix |
|---|---|
| `brew services start bitcoin` says there's no service | Make a plist like the mempool backend's with `$(brew --prefix)/bin/bitcoind` as the program, and bootstrap it the same way. |
| `npm run build` fails | The backend may want a different Node: check `"engines"` in `~/mempool/backend/package.json`, install that `node@NN`, and use it in the commands and the plist. |
| `sudo mariadb` asks for a password or fails | Try `mariadb -u root`, or `mariadb -u $(whoami)`. |
