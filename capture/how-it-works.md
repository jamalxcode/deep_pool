# How it works

Deep mode: what the site's JavaScript is made of and what its start page did while we watched.

## Its JavaScript

Analysed 19 script(s) from https://mempool.space/: 18 module(s), 83 endpoint(s), 4 route(s), bundled with webpack.

Evidence ev_2f7a7dfa72ca01355433a454eb9ea1eee16b496d26bcefe9c12621ab428e2621.

```json
{
  "api_operations": [],
  "app_kind": "unknown",
  "bundlers": [
    "webpack"
  ],
  "edges": [
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3664"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#2476@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#B@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#I@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#J@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#R@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#T@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#W@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#Y@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#consts@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#e@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#f@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#k@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#template@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476",
      "kind": "defines",
      "to": "fn:mempool.space/140.797e6a55a6771247.js#this.ɵfac@1"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1010"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1220"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1413"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1512"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#152"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1618"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1620"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1625"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1777"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1784"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1807"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1870"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1886"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1943"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1966"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#1979"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2040"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2074"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2083"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2126"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2191"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2200"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2253"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2265"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2273"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2344"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2404"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2476"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2498"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2528"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2615"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2681"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#2691"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#272"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3103"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3190"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3294"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3386"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#345"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3583"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3664"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3726"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#3881"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4090"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4262"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#436"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4363"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4412"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4437"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4512"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4668"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#4972"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5060"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5118"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5154"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5327"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5381"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5558"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5676"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5756"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5873"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5929"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#5964"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6024"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6110"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6204"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#634"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6345"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6354"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6977"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#6995"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7083"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7089"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7454"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7468"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7647"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7673"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#77"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7705"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7733"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7764"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7786"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7896"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#7926"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8039"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8132"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8141"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8220"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8235"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8273"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8359"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8374"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8672"
    },
    {
      "from": "bundle-module:mempool.space/140.797e6a55a6771247.js#7140",
      "kind": "requires",
      "to": "bundle-module:mempool.space/140.797e6a55a6771247.js#8793"
    },
    {
     
```

## Ten seconds of it

Watched https://mempool.space/ for 10000ms: 1 request outline(s), 0 console entr(y/ies).

Evidence ev_ae96bcd945be40cf63f37f1a73dd703c78ea05ad569a82558c52f2f2860beab6.

```json
{
  "accessibility": null,
  "console": {
    "count": 0,
    "entries": [],
    "has_text": false
  },
  "dom": {
    "attribute_names": [
      "_echarts_instance_",
      "_ngcontent-ng-c1382388028",
      "_ngcontent-ng-c1443874937",
      "_ngcontent-ng-c2192815938",
      "_ngcontent-ng-c2598743293",
      "_ngcontent-ng-c2741729318",
      "_ngcontent-ng-c2884767479",
      "_ngcontent-ng-c2895046731",
      "_ngcontent-ng-c3287113362",
      "_ngcontent-ng-c3373896953",
      "_ngcontent-ng-c3649927487",
      "_ngcontent-ng-c3820069795",
      "_ngcontent-ng-c3831017027",
      "_ngcontent-ng-c3899631452",
      "_ngcontent-ng-c41619706",
      "_ngcontent-ng-c4249110604",
      "_ngcontent-ng-c4559980",
      "_ngcontent-ng-c807445222",
      "_ngcontent-ng-c865266907",
      "_ngcontent-ng-c974448397",
      "_ngcontent-serverapp-c90",
      "_nghost-ng-c1382388028",
      "_nghost-ng-c1443874937",
      "_nghost-ng-c2192815938",
      "_nghost-ng-c2211218697",
      "_nghost-ng-c2598743293",
      "_nghost-ng-c2741729318",
      "_nghost-ng-c2884767479",
      "_nghost-ng-c2895046731",
      "_nghost-ng-c3287113362",
      "_nghost-ng-c3373896953",
      "_nghost-ng-c3649927487",
      "_nghost-ng-c3820069795",
      "_nghost-ng-c3831017027",
      "_nghost-ng-c3899631452",
      "_nghost-ng-c41619706",
      "_nghost-ng-c4249110604",
      "_nghost-ng-c4559980",
      "_nghost-ng-c807445222",
      "_nghost-ng-c865266907",
      "_nghost-ng-c974448397",
      "alt",
      "aria-expanded",
      "aria-haspopup",
      "aria-hidden",
      "aria-label",
      "attributename",
      "attributetype",
      "baseprofile",
      "charset",
      "class",
      "clip-path",
      "clip-rule",
      "content",
      "cx",
      "cy",
      "d",
      "data-bs-popper",
      "data-cy",
      "data-icon",
      "data-name",
      "data-prefix",
      "defer",
      "digitsinfo",
      "dir",
      "disabled",
      "dominant-baseline",
      "draggable",
      "dur",
      "echarts",
      "fill",
      "fill-rule",
      "focusable",
      "for",
      "formcontrolname",
      "fragment",
      "gradienttransform",
      "gradientunits",
      "height",
      "hidden",
      "href",
      "id",
      "kind",
      "lang",
      "location",
      "mask",
      "maskunits",
      "minunit",
      "name",
      "ng-version",
      "ngbdropdown",
      "ngbdropdownitem",
      "ngbdropdownmenu",
      "ngbdropdowntoggle",
      "ngbtooltip",
      "novalidate",
      "offset",
      "opacity",
      "placeholder",
      "placement",
      "points",
      "preserveaspectratio",
      "property",
      "rel",
      "repeatcount",
      "role",
      "rounding",
      "routerlinkactive",
      "rx",
      "ry",
      "shape-rendering",
      "sizes",
      "src",
      "stop-color",
      "stroke",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-opacity",
      "stroke-width",
      "style",
      "tabindex",
      "target",
      "text-anchor",
      "title",
      "transform",
      "type",
      "unitclass",
      "value",
      "values",
      "version",
      "viewbox",
      "width",
      "x",
      "x1",
      "x2",
      "xmlns",
      "xmlns:cc",
      "xmlns:dc",
      "xmlns:rdf",
      "xmlns:xlink",
      "y",
      "y1",
      "y2"
    ],
    "elements_by_name": {
      "a": 125,
      "animate": 1,
      "app-acceleration-sparkles": 1,
      "app-amount": 32,
      "app-amount-selector": 2,
      "app-blockchain": 1,
      "app-blockchain-blocks": 3,
      "app-dashboard": 1,
      "app-difficulty": 1,
      "app-fee-rate": 101,
      "app-fees-box": 1,
      "app-fiat": 10,
      "app-fiat-selector": 1,
      "app-global-footer": 1,
      "app-incoming-transactions-graph": 1,
      "app-language-selector": 1,
      "app-master-page": 1,
      "app-mempool-blocks": 1,
      "app-menu": 1,
      "app-mining-pool": 18,
      "app-recent-transactions-list": 1,
      "app-root": 1,
      "app-search-form": 1,
      "app-search-results": 1,
      "app-start": 1,
      "app-svg-images": 15,
      "app-theme-selector": 2,
      "app-time": 27,
      "app-timezone-selector": 1,
      "app-truncate": 12,
      "b": 1,
      "base": 1,
      "body": 1,
      "button": 6,
      "clippath": 3,
      "defs": 6,
      "div": 386,
      "ellipse": 2,
      "fa-icon": 9,
      "footer": 1,
      "form": 1,
      "g": 10,
      "h5": 7,
      "head": 1,
      "header": 1,
      "html": 1,
      "img": 18,
      "input": 5,
      "label": 4,
      "li": 7,
      "lineargradient": 7,
      "link": 7,
      "main": 1,
      "mask": 1,
      "meta": 23,
      "nav": 2,
      "option": 82,
      "p": 33,
      "path": 113,
      "polygon": 10,
      "rect": 13,
      "router-outlet": 3,
      "script": 6,
      "select": 7,
      "small": 2,
      "span": 240,
      "stop": 22,
      "style": 21,
      "sup": 2,
      "svg": 33,
      "table": 2,
      "tbody": 2,
      "td": 48,
      "text": 14,
      "th": 8,
      "thead": 2,
      "title": 4,
      "tr": 12,
      "ul": 1
    },
    "text_nodes": 681,
    "total_nodes": 5222,
    "truncated": false
  },
  "dropped_events": 0,
  "frame_origins": [
    "https://mempool.space"
  ],
  "network": {
    "request_count": 1,
    "requests": [
      {
        "initiator": "script",
        "method": "POST",
        "mime_type": "",
        "response_headers": {
          "credentials_present": [],
          "kept": {
            "access-control-allow-origin": {
              "value_length": 1
            },
            "cache-control": "no-cache, private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            "content-length": "0",
            "date": {
              "value_length": 29
            },
            "expires": {
              "value_length": 29
            },
            "pragma": {
              "value_length": 8
            },
            "server": {
              "value_length": 5
            }
          }
        },
        "status": 200,
        "type": "Fetch",
        "url": "https://mempool.space/t"
      }
    ]
  },
  "origin": "https://mempool.space/",
  "resources": [
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/marapool.svg"
    },
    {
      "mime_type": "application/javascript",
      "type": "Script",
      "url": "https://mempool.space/scripts.ceed198d5342d328.js"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='104%25' height='100%25' fill='none' stroke='white' stroke-width='4' stroke-dasharray='10%2c17' stroke-dashoffset='18' stroke-linecap='square'/%3e%3c/svg%3e"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/antpool.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/foundryusa.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/ocean.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/spiderpool.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/viabtc.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/braiinspool.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/f2pool.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://mempool.space/resources/mining-pools/luxor.svg"
    }
  ],
  "scripts": [
    {
      "length": 42,
      "source_map_url": null,
      "url": "https://mempool.space/"
    },
    {
      "length": 3582,
      "source_map_url": null,
      "url": "https://mempool.space/runtime.b7bf16dc95bb684f.js"
    },
    {
      "length": 34900,
      "source_map_url": null,
      "url": "https://mempool.space/polyfills.6fd0602505b2941d.js"
    },
    {
      "length": 2299688,
      "source_map_url": null,
      "url": "https://mempool.space/main.57eeaac0977fafe3.js"
    },
    {
      "length": 177853,
      "source_map_url": null,
      "url": "https://mempool.space/scripts.ceed198d5342d328.js"
    },
    {
      "length": 827100,
      "source_map_url": null,
      "url": "https://mempool.space/83.842089a2982991b3.js"
    },
    {
      "length": 21243,
      "source_map_url": null,
      "url": "https://mempool.space/187.38c6d9b29c262182.js"
    },
    {
      "length": 16905,
      "source_map_url": null,
      "url": "https://mempool.space/234.aad687241d2f92ef.js"
    },
    {
      "length": 29735,
      "source_map_url": null,
      "url": "https://mempool.space/166.93f5be546380d220.js"
    },
    {
      "length": 672954,
      "source_map_url": null,
      "url": "https://mempool.space/140.797e6a55a6771247.js"
    },
    {
      "length": 21874,
      "source_map_url": null,
      "url": "https://mempool.space/225.4b75c7013e456bea.js"
    },
    {
      "length": 9767,
      "source_map_url": null,
      "url": "https://mempool.space/220.cc78b6ca312c6170.js"
    },
    {
      "length": 67857,
      "source_map_url": null,
      "url": "https://mempool.space/377.c619db5718a461f1.js"
    },
    {
      "length": 672,
      "source_map_url": null,
      "url": "https://mempool.space/617.0222b36960147791.js"
    },
    {
      "length": 51642,
      "source_map_url": null,
      "url": "https://mempool.space/640.2f640bdf6ae17933.js"
    },
    {
      "length": 319136,
      "source_map_url": null,
      "url": "https://mempool.space/875.33c7d90135573fe3.js"
    },
    {
      "length": 73604,
      "source_map_url": null,
      "url": "https://mempool.space/207.5ab1ebb81482cf48.js"
    },
    {
      "length": 500368,
      "source_map_url": null,
      "url": "https://mempool.space/320.8495b1ff3ee4fcab.js"
    },
    {
      "length": 165688,
      "source_map_url": null,
      "url": "https://mempool.space/562.b612e21f51d26778.js"
    }
  ],
  "scripts_truncated": false,
  "secret_redactions": 0,
  "storage_keys": null,
  "watch_ms": 10000,
  "websockets": {
    "connections": [],
    "frames": [
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3899
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3911
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3927
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3932
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 4950
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3942
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3913
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 4959
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3922
      },
      {
        "direction": "received",
        "opcode": 1,
        "payload_length": 3921
      }
    ]
  }
}
```
