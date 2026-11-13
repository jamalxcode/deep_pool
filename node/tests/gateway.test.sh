#!/bin/sh
# Checks the node gateway (../Caddyfile and ../Caddyfile.macos) against a stand-in backend:
# the allowlist, read-only, CORS, query stripping, cache headers and the WebSocket.
# Needs caddy and node on the PATH (brew install caddy node). Run from anywhere:
#   sh node/tests/gateway.test.sh
set -u
cd "$(dirname "$0")"
TMP=$(mktemp -d)
trap 'kill $BP $CP 2>/dev/null; rm -rf "$TMP"' EXIT
export DEEPPOOL_ORIGIN=https://deeppool.example
fails=0
ok() { printf 'ok   %s\n' "$1"; }
bad() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }

sed 's/mempool:8999/127.0.0.1:8999/g' ../Caddyfile > "$TMP/Caddyfile"
sed "s#DEEPPOOL_ORIGIN_HERE#$DEEPPOOL_ORIGIN#" ../Caddyfile.macos > "$TMP/Caddyfile.macos"
for f in Caddyfile Caddyfile.macos; do
  if caddy validate --config "$TMP/$f" --adapter caddyfile >/dev/null 2>&1; then ok "$f is valid"; else bad "$f is valid"; fi
done
# the two files must keep the same rules
if [ "$(grep -v -e '^#' -e 'bind 127' ../Caddyfile | sed 's/mempool:8999/127.0.0.1:8999/; s/{\$DEEPPOOL_ORIGIN}/X/' | grep -v '^$')" = \
     "$(grep -v -e '^#' -e 'bind 127' ../Caddyfile.macos | sed 's/DEEPPOOL_ORIGIN_HERE/X/' | grep -v '^$')" ]; then ok "Caddyfile and Caddyfile.macos have the same rules"; else bad "Caddyfile and Caddyfile.macos have the same rules"; fi

node fake-backend.js & BP=$!
caddy run --config "$TMP/Caddyfile" --adapter caddyfile >"$TMP/caddy.log" 2>&1 & CP=$!
sleep 2
G=http://127.0.0.1:8080

code() { curl -s -o "$TMP/body" -D "$TMP/head" -X "${2:-GET}" "$G$1" -w '%{http_code}'; }
for p in /api/v1/blocks /api/v1/blocks/975000 /api/v1/blocks/tip/height /api/v1/fees/mempool-blocks /api/v1/fees/recommended \
         /api/v1/difficulty-adjustment /api/v1/replacements /api/v1/statistics/2h /api/v1/prices /api/mempool /api/mempool/recent; do
  c=$(code "$p")
  if [ "$c" = 200 ] && grep -qi "^access-control-allow-origin: $DEEPPOOL_ORIGIN" "$TMP/head" && grep -qi '^cache-control: public, max-age=10' "$TMP/head"; then ok "allowed $p"; else bad "allowed $p ($c)"; fi
done
c=$(code /api/mempool/recent); grep -q '"path":"/api/v1/mempool/recent"' "$TMP/body" && ok "/api/mempool/recent reaches the backend as /api/v1/mempool/recent" || bad "rewrite of /api/mempool/recent"
for p in /api/tx/abc /api/address/bc1qx /api/v1/block/00ab /api/block-height/1 /api/v1/mining/pools /api/mempool/txids / /api/v1/blocks/1/../../tx; do
  c=$(curl -s --path-as-is -o /dev/null -w '%{http_code}' "$G$p")
  [ "$c" = 404 ] && ok "refused $p" || bad "refused $p ($c)"
done
c=$(code /api/v1/blocks POST); [ "$c" = 405 ] && ok "POST refused" || bad "POST refused ($c)"
c=$(code /api/v1/blocks OPTIONS); [ "$c" = 204 ] && ok "OPTIONS answered" || bad "OPTIONS answered ($c)"
code '/api/v1/blocks?bust=123' >/dev/null; grep -q '"path":"/api/v1/blocks"' "$TMP/body" && ok "query string dropped" || bad "query string dropped"
grep -qi '^server:' "$TMP/head" && bad "Server header hidden" || ok "Server header hidden"
node -e "const ws=new WebSocket('ws://127.0.0.1:8080/api/v1/ws');ws.onmessage=()=>process.exit(0);ws.onerror=()=>process.exit(1);setTimeout(()=>process.exit(1),4000)" && ok "WebSocket passes" || bad "WebSocket passes"

[ $fails -eq 0 ] && echo "all gateway checks passed" || { echo "$fails gateway check(s) failed"; exit 1; }
