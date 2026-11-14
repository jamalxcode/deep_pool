#!/bin/sh
# Static build: no dependencies. Copies the site into dist/ and gives every
# route its own index.html so the pages work when served as plain files.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp src/style.css src/config.js src/data.js src/app.js src/favicon.svg src/providers.json dist/
sed "s#{{ROOT}}#./#g" src/index.html > dist/index.html
for route in signet testnet testnet4 acceleration; do
  mkdir -p "dist/$route"
  sed "s#{{ROOT}}#../#g" src/index.html > "dist/$route/index.html"
done
echo "built dist/ (index + signet, testnet, testnet4, acceleration)"
