# deep pool node on macOS with Homebrew (no Docker)

The same setup as [README.md](README.md) (Bitcoin Core, Electrs, MariaDB, the mempool backend, a
Caddy gateway and a Cloudflare Tunnel), but installed natively. That means no VM and faster disk
access for Electrs. Read README.md first for the hardware and the Cloudflare caching and rate-limit rules.

Everything runs as your macOS user and starts when that user logs in, so turn on
**System Settings → Users & Groups → Automatically log in as** (this needs FileVault off), or log in
after each restart. Commands assume the SSD is mounted at `/Volumes/BitcoinSSD`. Change `SSD` below if not.

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
brew install bitcoin rust mariadb node@22 caddy cloudflared jq git
```

Keep the Mac awake, and have it restart after a power cut:

```bash
sudo pmset -a sleep 0 disksleep 0 autorestart 1
```

## 2. Bitcoin Core

```bash
mkdir -p "$SSD/Bitcoin" "$HOME/Library/Application Support/Bitcoin" ~/Library/Logs/deep-pool
```

```bash
cat > "$HOME/Library/Application Support/Bitcoin/bitcoin.conf" <<EOF
datadir=$SSD/Bitcoin
prune=0
txindex=1
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

## 3. Electrs (address index)

Build it (about 15-20 minutes):

```bash
cargo install electrs --locked
```

```bash
mkdir -p ~/.electrs "$SSD/electrs"
cat > ~/.electrs/config.toml <<EOF
network = "bitcoin"
db_dir = "$SSD/electrs"
daemon_rpc_addr = "127.0.0.1:8332"
daemon_p2p_addr = "127.0.0.1:8333"
electrum_rpc_addr = "127.0.0.1:50001"
auth = "$RPCUSER:$RPCPASS"
log_filters = "INFO"
EOF
chmod 600 ~/.electrs/config.toml
```

Run it as a background service that restarts itself:

```bash
cat > ~/Library/LaunchAgents/company.deeppool.electrs.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>company.deeppool.electrs</string>
  <key>ProgramArguments</key><array><string>$HOME/.cargo/bin/electrs</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/deep-pool/electrs.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/deep-pool/electrs.log</string>
</dict></plist>
EOF
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/company.deeppool.electrs.plist
```

It waits for Bitcoin Core to finish syncing, then indexes for several hours:

```bash
tail -f ~/Library/Logs/deep-pool/electrs.log
```

## 4. MariaDB

```bash
brew services start mariadb
```

```bash
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS mempool; CREATE USER IF NOT EXISTS 'mempool'@'localhost' IDENTIFIED BY '$DBPASS'; GRANT ALL PRIVILEGES ON mempool.* TO 'mempool'@'localhost'; FLUSH PRIVILEGES;"
```

## 5. The mempool backend

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
  .MEMPOOL.NETWORK = "mainnet" | .MEMPOOL.BACKEND = "electrum" | .MEMPOOL.HTTP_PORT = 8999 |
  .CORE_RPC.HOST = "127.0.0.1" | .CORE_RPC.PORT = 8332 | .CORE_RPC.USERNAME = $u | .CORE_RPC.PASSWORD = $p |
  .ELECTRUM.HOST = "127.0.0.1" | .ELECTRUM.PORT = 50001 | .ELECTRUM.TLS_ENABLED = false |
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

## 6. The gateway (Caddy)

This writes the same file as `Caddyfile.macos` in this folder, with your `ORIGIN` filled in:

```bash
cat > "$(brew --prefix)/etc/Caddyfile" <<'EOF'
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
		@preflight method OPTIONS
		respond @preflight 204

		@notget not method GET
		respond @notget "Read-only" 405

		@ws path /api/v1/ws
		reverse_proxy @ws 127.0.0.1:8999

		@immutable path_regexp ^/api/(v1/)?block/[0-9a-f]{64}(/txs(/[0-9]+)?|/txids|/header)?$
		header @immutable {
			Cache-Control "public, max-age=86400"
			defer
		}
		@moving {
			path /api/*
			not path_regexp ^/api/(v1/)?block/[0-9a-f]{64}(/txs(/[0-9]+)?|/txids|/header)?$
		}
		header @moving {
			Cache-Control "public, max-age=10"
			defer
		}

		@esplora {
			path /api/*
			not path /api/v1/*
		}
		uri @esplora replace /api/ /api/v1/ 1

		reverse_proxy /api/v1/* 127.0.0.1:8999

		respond "Not found" 404
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

## 7. The Cloudflare Tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**,
name it `deep-pool-node`, choose **macOS**, and copy the token from the command it shows. Under
**Public Hostname** add subdomain `node` on your domain, service **HTTP**, URL **`localhost:8080`**.
Then install the connector as a system service (paste your token):

```bash
sudo cloudflared service install PASTE-YOUR-TOKEN-HERE
```

Add the cache and rate-limit rules from README.md, steps 4 and 5.

## 8. Check it

On the Mac (once Electrs has finished indexing):

```bash
curl -s http://127.0.0.1:8080/api/v1/blocks/tip/height
```

From anywhere (should show `access-control-allow-origin` and `cache-control`):

```bash
curl -sI https://node.YOUR-DOMAIN/api/v1/fees/recommended
```

Then set `node: 'https://node.YOUR-DOMAIN'` in `app/src/config.js` and redeploy deep pool.

## Everyday commands

What's running:

```bash
brew services list && launchctl list | grep deeppool
```

Logs:

```bash
tail -f ~/Library/Logs/deep-pool/*.log
```

Restart the mempool backend (or `electrs`):

```bash
launchctl kickstart -k gui/$(id -u)/company.deeppool.mempool
```

## Updating

```bash
brew update && brew upgrade
```

```bash
cargo install electrs --locked --force && launchctl kickstart -k gui/$(id -u)/company.deeppool.electrs
```

```bash
source ~/deep-pool-node.env && cd ~/mempool && git fetch --tags && git checkout "$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)" && cd backend && export PATH="$(brew --prefix node@22)/bin:$PATH" && npm install && npm run build && launchctl kickstart -k gui/$(id -u)/company.deeppool.mempool
```

## If something doesn't work

| Symptom | Fix |
|---|---|
| `brew services start bitcoin` says there's no service | Make a plist like Electrs' with `$(brew --prefix)/bin/bitcoind` as the program, and bootstrap it the same way. |
| `cargo install electrs` fails about `libclang` | `brew install llvm`, then run it again with `LIBCLANG_PATH="$(brew --prefix llvm)/lib"` in front. |
| `npm run build` fails | The backend may want a different Node: check `"engines"` in `~/mempool/backend/package.json`, install that `node@NN`, and use it in the commands and the plist. |
| mempool log: *ECONNREFUSED 127.0.0.1:50001* | Electrs is still indexing; it opens that port when it's done. |
| `sudo mariadb` asks for a password or fails | Try `mariadb -u root`, or `mariadb -u $(whoami)`. |
