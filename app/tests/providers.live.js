// Live provider probe (build step 1). Calls every candidate provider for real, on every network it
// claims, and records what works: answers, CORS for a web page, latency, tip height and hash, and
// whether each answer has the fields deep pool needs. Then it compares tips across providers.
//
//   npm run test:live            (runs this, then the live browser smoke test)
//   node tests/providers.live.js [--write]
//
// Output:
//   tests/out/providers-report.json   full report of this run (not committed)
//   src/providers.json                the published list. Rewritten only when the picture changes
//                                     (a provider, network or capability passes or fails differently),
//                                     or always with --write, so routine runs don't churn git.
//
// Exits non-zero only when fewer than 3 mainnet providers work (the router needs spares, and the
// verifier needs two to cross-check the tip). Everything else is reported, not failed: a provider
// that is down or rate-limits this machine is expected, and routing around it is the whole point.
// Whether each test network still shows live data is the smoke test's job (tests/smoke.live.js).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORIGIN = 'https://jamalxcode.github.io'; // the origin browsers send for the published site
const TIMEOUT_MS = 12000;
const NETWORKS = ['mainnet', 'signet', 'testnet', 'testnet4'];
const REQUIRED = { mainnet: 3 }; // working providers needed to pass; other networks are only reported
const OUT = path.join(__dirname, 'out');
const PUBLISHED = path.join(__dirname, '..', 'src', 'providers.json');

// The candidates from docs/DESIGN.md. gapMs spaces out this probe's own calls so it stays inside
// each free tier (bitaps blocks an IP for 5 minutes after 3 calls in 5 seconds).
const CANDIDATES = [
  { id: 'mempool-space', name: 'mempool.space', type: 'mempool',
    api: { mainnet: 'https://mempool.space/api', signet: 'https://mempool.space/signet/api', testnet: 'https://mempool.space/testnet/api', testnet4: 'https://mempool.space/testnet4/api' },
    ws: { mainnet: 'wss://mempool.space/api/v1/ws', signet: 'wss://mempool.space/signet/api/v1/ws', testnet: 'wss://mempool.space/testnet/api/v1/ws', testnet4: 'wss://mempool.space/testnet4/api/v1/ws' },
    budget: { perMinute: 60 }, attribution: null },
  { id: 'mempool-emzy', name: 'mempool.emzy.de', type: 'mempool',
    api: { mainnet: 'https://mempool.emzy.de/api', signet: 'https://mempool.emzy.de/signet/api', testnet: 'https://mempool.emzy.de/testnet/api', testnet4: 'https://mempool.emzy.de/testnet4/api' },
    ws: { mainnet: 'wss://mempool.emzy.de/api/v1/ws' },
    budget: { perMinute: 30 }, attribution: null },
  { id: 'mempool-bisq', name: 'mempool.bisq.services', type: 'mempool',
    api: { mainnet: 'https://mempool.bisq.services/api' },
    ws: { mainnet: 'wss://mempool.bisq.services/api/v1/ws' },
    budget: { perMinute: 30 }, attribution: null },
  { id: 'blockstream', name: 'blockstream.info', type: 'esplora',
    api: { mainnet: 'https://blockstream.info/api', signet: 'https://blockstream.info/signet/api', testnet: 'https://blockstream.info/testnet/api' },
    budget: { perMinute: 60 }, attribution: null },
  { id: 'publicnode', name: 'publicnode.com', type: 'bitcoind-rpc',
    api: { mainnet: 'https://bitcoin-rpc.publicnode.com', testnet: 'https://bitcoin-testnet-rpc.publicnode.com' },
    budget: { perMinute: 60 }, attribution: null },
  { id: 'drpc', name: 'dRPC', type: 'bitcoind-rpc',
    api: { mainnet: 'https://bitcoin.drpc.org', testnet: 'https://bitcoin-testnet.drpc.org' },
    budget: { perMinute: 30 }, attribution: null },
  { id: 'blockchair', name: 'Blockchair', type: 'blockchair', gapMs: 1500,
    api: { mainnet: 'https://api.blockchair.com/bitcoin', testnet: 'https://api.blockchair.com/bitcoin/testnet' },
    budget: { perMinute: 1 }, attribution: 'Blockchair' },
  { id: 'blockcypher', name: 'BlockCypher', type: 'blockcypher', gapMs: 500,
    api: { mainnet: 'https://api.blockcypher.com/v1/btc/main', testnet: 'https://api.blockcypher.com/v1/btc/test3' },
    budget: { perMinute: 1 }, attribution: 'BlockCypher' },
  { id: 'blockchain-info', name: 'blockchain.com', type: 'blockchaininfo',
    api: { mainnet: 'https://blockchain.info' },
    budget: { perMinute: 20 }, attribution: null },
  { id: 'bitaps', name: 'Bitaps', type: 'bitaps', gapMs: 2200,
    api: { mainnet: 'https://api.bitaps.com/btc/v1', testnet: 'https://api.bitaps.com/btc/testnet/v1' },
    budget: { perMinute: 20 }, attribution: null }
];

// Mainnet test data that never changes: block 170 (the first bitcoin payment) and its receiver.
const MAINNET_REF = { txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', address: '12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S' };

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isHash = (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
const isHeight = (n) => Number.isInteger(n) && n > 0;
const isNum = (n) => typeof n === 'number' && isFinite(n);
function dsha256Hex(headerHex) {
  const once = crypto.createHash('sha256').update(Buffer.from(headerHex, 'hex')).digest();
  return Buffer.from(crypto.createHash('sha256').update(once).digest()).reverse().toString('hex');
}
function expect(cond, what) { if (!cond) throw new Error(what); }

// One provider's HTTP calls, spaced by gapMs. Records CORS from every answer.
function makeHttp(c, rec) {
  let lastAt = 0;
  return async function http(url, opts = {}) {
    const wait = lastAt + (c.gapMs || 0) - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const headers = Object.assign({ origin: ORIGIN }, opts.headers || {});
      const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body, signal: ctl.signal, redirect: 'follow' });
      const text = await res.text();
      const ms = Date.now() - t0;
      const acao = res.headers.get('access-control-allow-origin');
      const cors = acao === '*' || acao === ORIGIN;
      rec.calls.push({ url, status: res.status, ms, cors });
      if (!cors) rec.corsMissing.add(url.replace(/[0-9a-f]{64}|\b\d{3,}\b/g, ':id'));
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + text.replace(/\s+/g, ' ').slice(0, 120));
      let body = text;
      try { body = JSON.parse(text); } catch (e) { /* plain text answer */ }
      return { body, ms, cors };
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('timeout after ' + TIMEOUT_MS + ' ms');
      throw new Error(e.cause ? e.message + ' (' + (e.cause.code || e.cause.message) + ')' : e.message);
    } finally { clearTimeout(timer); }
  };
}

// A browser sends a CORS preflight before a JSON POST; JSON-RPC providers must answer it.
async function preflightOk(url) {
  try {
    const res = await fetch(url, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    const acao = res.headers.get('access-control-allow-origin');
    const allowH = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
    return (acao === '*' || acao === ORIGIN) && (allowH === '*' || allowH.includes('content-type'));
  } catch (e) { return false; }
}

// ---------- adapters: one per API style, each returning plain values ----------
// tip -> { height, hash }; blockHash(h) -> hash; header(hash) -> 160 hex chars;
// fees -> { fast } sat/vB; mempool -> { count }; tx(txid) -> txid; address(a) -> { txCount }
const esploraLike = {
  tip: async (get) => {
    const height = Number((await get('/blocks/tip/height')).body);
    const hash = String((await get('/blocks/tip/hash')).body).trim();
    return { height, hash };
  },
  blockHash: async (get, h) => String((await get('/block-height/' + h)).body).trim(),
  header: async (get, hash) => String((await get('/block/' + hash + '/header')).body).trim(),
  fees: async (get, type) => {
    if (type === 'mempool') return { fast: (await get('/v1/fees/recommended')).body.fastestFee };
    return { fast: (await get('/fee-estimates')).body['1'] };
  },
  mempool: async (get) => { const b = (await get('/mempool')).body; return { count: b.count, histogram: Array.isArray(b.fee_histogram) }; },
  recent: async (get) => { const b = (await get('/mempool/recent')).body; expect(Array.isArray(b) && b.length && isHash(b[0].txid), 'no recent txs'); return true; },
  tx: async (get, txid) => (await get('/tx/' + txid)).body.txid,
  address: async (get, a) => { const b = (await get('/address/' + a)).body; return { txCount: b.chain_stats && b.chain_stats.tx_count }; },
  blockTxs: async (get, hash) => (await get('/block/' + hash + '/txs')).body
};
const mempoolExtras = {
  blocks: async (get) => { const b = (await get('/v1/blocks')).body; expect(Array.isArray(b) && b.length >= 10 && b[0].extras, 'no /v1/blocks with extras'); return true; },
  projected: async (get) => { const b = (await get('/v1/fees/mempool-blocks')).body; expect(Array.isArray(b) && b.length && isNum(b[0].medianFee), 'no projected blocks'); return true; },
  difficulty: async (get) => { const b = (await get('/v1/difficulty-adjustment')).body; expect(isNum(b.progressPercent), 'no difficulty'); return true; },
  prices: async (get) => { const b = (await get('/v1/prices')).body; expect(isNum(b.USD) && b.USD > 0, 'no USD price'); return true; },
  replacements: async (get) => { const b = (await get('/v1/replacements')).body; expect(Array.isArray(b), 'no replacements list'); return true; },
  stats: async (get) => { const b = (await get('/v1/statistics/2h')).body; expect(Array.isArray(b) && b.length, 'no statistics'); return true; }
};

function rpcGet(http, base) {
  let id = 0;
  return async (method, params = []) => {
    const r = await http(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const b = r.body;
    if (b && b.error) throw new Error('RPC ' + method + ': ' + (b.error.message || JSON.stringify(b.error)).slice(0, 120));
    expect(b && 'result' in b, 'RPC ' + method + ': no result');
    return b.result;
  };
}
const rpc = {
  tip: async (call) => { const hash = await call('getbestblockhash'); const hd = await call('getblockheader', [hash, true]); return { height: hd.height, hash }; },
  blockHash: async (call, h) => call('getblockhash', [h]),
  header: async (call, hash) => call('getblockheader', [hash, false]),
  fees: async (call) => { const r = await call('estimatesmartfee', [2]); expect(isNum(r.feerate), 'no feerate: ' + JSON.stringify(r.errors || r)); return { fast: r.feerate * 1e5 }; },
  mempool: async (call) => ({ count: (await call('getmempoolinfo')).size }),
  tx: async (call, txid) => (await call('getrawtransaction', [txid, true])).txid
};

// Builds an 80-byte header from parsed fields, for providers that don't serve raw headers.
function headerFromFields(f) {
  const le32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b.toString('hex'); };
  const rev = (h) => Buffer.from(h, 'hex').reverse().toString('hex');
  return le32(f.version) + rev(f.prev) + rev(f.merkle) + le32(f.time) + le32(f.bits) + le32(f.nonce);
}

const ADAPTERS = {
  mempool: esploraLike,
  esplora: esploraLike,
  'bitcoind-rpc': rpc,
  blockchair: {
    tip: async (get) => { const d = (await get('/stats')).body.data; return { height: d.best_block_height, hash: d.best_block_hash }; },
    // one stats call covers fees and mempool too, so the strict free tier isn't spent on repeats
    fees: async (get, type, cache) => ({ fast: (cache.stats || (cache.stats = (await get('/stats')).body.data)).suggested_transaction_fee_per_byte_sat }),
    mempool: async (get, type, cache) => ({ count: (cache.stats || (cache.stats = (await get('/stats')).body.data)).mempool_transactions }),
    tx: async (get, txid) => { const d = (await get('/dashboards/transaction/' + txid)).body.data; return d && d[txid] && d[txid].transaction.hash; },
    address: async (get, a) => { const d = (await get('/dashboards/address/' + a + '?limit=0')).body.data; return { txCount: d && d[a] && d[a].address.transaction_count }; }
  },
  blockcypher: {
    tip: async (get) => { const b = (await get('')).body; return { height: b.height, hash: b.hash }; },
    blockHash: async (get, h, cache) => { const b = (await get('/blocks/' + h + '?limit=1')).body; cache.block = b; return b.hash; },
    header: async (get, hash, cache) => {
      const b = cache.block && cache.block.hash === hash ? cache.block : (await get('/blocks/' + hash + '?limit=1')).body;
      return headerFromFields({ version: b.ver, prev: b.prev_block, merkle: b.mrkl_root, time: Date.parse(b.time) / 1000, bits: b.bits, nonce: b.nonce });
    },
    fees: async (get) => ({ fast: (await get('')).body.high_fee_per_kb / 1000 }),
    mempool: async (get) => ({ count: (await get('')).body.unconfirmed_count }),
    tx: async (get, txid) => (await get('/txs/' + txid + '?limit=1&includeHex=false')).body.hash,
    address: async (get, a) => ({ txCount: (await get('/addrs/' + a + '/balance')).body.n_tx })
  },
  blockchaininfo: {
    // /latestblock sends no CORS header; the /q/ endpoints do (two calls, so the tip may move in between)
    tip: async (get) => ({ height: Number((await get('/q/getblockcount?cors=true')).body), hash: String((await get('/q/latesthash?cors=true')).body).trim() }),
    fees: async (get) => { const r = await fetchJSONAbs('https://api.blockchain.info/mempool/fees', get); return { fast: r.priority }; },
    mempool: async (get) => ({ count: Number((await get('/q/unconfirmedcount?cors=true')).body) }),
    tx: async (get, txid) => (await get('/rawtx/' + txid + '?cors=true')).body.hash,
    address: async (get, a) => { const b = (await get('/balance?active=' + a + '&cors=true')).body; return { txCount: b[a] && b[a].n_tx }; }
  },
  bitaps: {
    tip: async (get) => { const d = (await get('/blockchain/block/last')).body.data; return { height: d.height, hash: d.hash }; },
    blockHash: async (get, h, cache) => { const d = (await get('/blockchain/block/' + h)).body.data; cache.block = d; return d.hash; },
    header: async (get, hash, cache) => {
      const d = cache.block && cache.block.hash === hash ? cache.block : (await get('/blockchain/block/' + hash)).body.data;
      return Buffer.from(d.header, 'base64').subarray(0, 80).toString('hex'); // 80-byte header + tx count
    },
    tx: async (get, txid) => (await get('/blockchain/transaction/' + txid)).body.data.txId,
    address: async (get, a) => ({ txCount: (await get('/blockchain/address/state/' + a)).body.data.receivedTxCount })
  }
};
// blockchain.com serves fees from a second host; reuse the provider's spaced, CORS-recording client.
function fetchJSONAbs(url, get) { return get.abs(url).then((r) => r.body); }

// ---------- reference data per network ----------
// A settled block (tip - 6) plus a transaction and an address from it, taken from the first
// mempool/Esplora provider that answers. Every provider is then asked about the same things.
async function reference(net) {
  for (const c of CANDIDATES.filter((x) => (x.type === 'mempool' || x.type === 'esplora') && x.api[net])) {
    try {
      const get = async (p) => {
        const res = await fetch(c.api[net] + p, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const t = await res.text();
        try { return JSON.parse(t); } catch (e) { return t; }
      };
      const tip = Number(await get('/blocks/tip/height'));
      const height = tip - 6;
      const hash = String(await get('/block-height/' + height)).trim();
      const ref = { from: c.name, height, hash };
      if (net === 'mainnet') return Object.assign(ref, MAINNET_REF);
      const txs = await get('/block/' + hash + '/txs');
      const t = txs.find((x) => !x.vin[0].is_coinbase && x.vout.some((o) => o.scriptpubkey_address)) || txs[0];
      ref.txid = t.txid;
      ref.address = (t.vout.find((o) => o.scriptpubkey_address) || {}).scriptpubkey_address;
      return ref;
    } catch (e) { /* try the next one */ }
  }
  return null;
}

// ---------- probing ----------
async function probe(c, net, ref) {
  const rec = { calls: [], corsMissing: new Set() };
  const http = makeHttp(c, rec);
  const base = c.api[net];
  const ad = ADAPTERS[c.type];
  const get = (p) => http(base + p);
  get.abs = (url) => http(url);
  const arg = c.type === 'bitcoind-rpc' ? rpcGet(http, base) : get;
  const cache = {};
  const passed = [];
  const failed = [];
  let tip = null;
  async function check(name, fn) {
    try { await fn(); passed.push(name); } catch (e) { failed.push({ check: name, reason: e.message }); }
  }
  if (c.type === 'bitcoind-rpc' && !(await preflightOk(base))) failed.push({ check: 'cors', reason: 'CORS preflight for a JSON POST is refused' });

  const t0 = Date.now();
  await check('tip', async () => {
    const t = await ad.tip(arg);
    expect(isHeight(t.height), 'tip height missing: ' + JSON.stringify(t.height));
    expect(isHash(t.hash), 'tip hash missing');
    tip = t;
  });
  const latencyMs = Date.now() - t0;
  if (!tip) return finish();

  if (ref && ad.blockHash) await check('block', async () => {
    const h = await ad.blockHash(arg, ref.height, cache);
    expect(h === ref.hash, 'block ' + ref.height + ' hash ' + String(h).slice(0, 16) + '… differs from ' + ref.from);
  });
  if (ref && ad.header) await check('header', async () => {
    const hex = await ad.header(arg, ref.hash, cache);
    expect(/^[0-9a-f]{160}$/.test(hex), 'header is not 80 bytes of hex');
    expect(dsha256Hex(hex) === ref.hash, 'header does not hash to the block hash');
  });
  if (ad.fees) await check('fees', async () => { const f = await ad.fees(arg, c.type, cache); expect(isNum(f.fast) && f.fast > 0, 'no fee estimate'); });
  if (ad.mempool) await check('mempoolInfo', async () => {
    const m = await ad.mempool(arg, c.type, cache);
    expect(isNum(m.count), 'no mempool count');
    if (m.histogram) passed.push('feeHistogram');
  });
  if (ad.recent) await check('recent', () => ad.recent(arg));
  if (ref && ref.txid && ad.tx) await check('tx', async () => expect((await ad.tx(arg, ref.txid)) === ref.txid, 'tx lookup returned the wrong txid'));
  if (ref && ref.address && ad.address) await check('address', async () => { const a = await ad.address(arg, ref.address); expect(isNum(a.txCount), 'no tx count for the address'); });
  if (ref && ad.blockTxs) await check('blockTxs', async () => { const t = await ad.blockTxs(arg, ref.hash); expect(Array.isArray(t) && t.length && isHash(t[0].txid), 'no block transactions'); });
  if (c.type === 'mempool') for (const k of Object.keys(mempoolExtras)) if (k !== 'prices' || net === 'mainnet') await check(k, () => mempoolExtras[k](get));
  if (c.ws && c.ws[net]) await check('stream', () => wsCheck(c.ws[net]));
  return finish();

  function finish() {
    const cors = rec.corsMissing.size === 0 && !failed.some((f) => f.check === 'cors');
    if (!cors && rec.corsMissing.size) failed.push({ check: 'cors', reason: 'no CORS header on ' + [...rec.corsMissing].slice(0, 3).join(', ') });
    return { tip, latencyMs, cors, passed, failed, calls: rec.calls.length };
  }
}

// mempool-style WebSocket: subscribe to blocks and expect a JSON message within 10 s.
function wsCheck(url) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== 'function') return reject(new Error('no WebSocket in this Node version'));
    const ws = new WebSocket(url);
    const done = (err) => { clearTimeout(timer); try { ws.close(); } catch (e) { /* closed */ } err ? reject(err) : resolve(); };
    const timer = setTimeout(() => done(new Error('no message within 10 s')), 10000);
    ws.onopen = () => { ws.send(JSON.stringify({ action: 'init' })); ws.send(JSON.stringify({ action: 'want', data: ['blocks', 'stats'] })); };
    ws.onmessage = (m) => { try { JSON.parse(m.data); done(); } catch (e) { done(new Error('non-JSON message')); } };
    ws.onerror = () => done(new Error('connection failed'));
  });
}

// ---------- main ----------
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const started = new Date();
  console.log('Probing ' + CANDIDATES.length + ' candidate providers from this machine (origin ' + ORIGIN + ')…\n');
  const refs = {};
  await Promise.all(NETWORKS.map(async (n) => { refs[n] = await reference(n); }));

  // providers run in parallel; each one's networks and checks run in order, spaced by gapMs
  const results = {};
  await Promise.all(CANDIDATES.map(async (c) => {
    results[c.id] = {};
    for (const net of NETWORKS) if (c.api[net]) results[c.id][net] = await probe(c, net, refs[net]);
  }));

  // tips: the highest seen per network; 2+ blocks behind it = stale. Same height, different hash = disagreement.
  const summary = {};
  for (const net of NETWORKS) {
    const tips = CANDIDATES.map((c) => results[c.id][net] && results[c.id][net].tip && { id: c.id, ...results[c.id][net].tip }).filter(Boolean);
    const top = Math.max(0, ...tips.map((t) => t.height));
    const hashesAtTop = {};
    tips.filter((t) => t.height === top).forEach((t) => { hashesAtTop[t.hash] = (hashesAtTop[t.hash] || 0) + 1; });
    // a 1-1 tie at the top is a race or a short fork, not a disagreement
    const majority = Object.keys(hashesAtTop).sort((a, b) => hashesAtTop[b] - hashesAtTop[a])[0];
    for (const t of tips) {
      const r = results[t.id][net];
      if (top - t.height >= 2) { r.failed.push({ check: 'fresh', reason: (top - t.height) + ' blocks behind the highest tip (' + top + ')' }); r.passed = r.passed.filter((p) => p !== 'tip'); }
      else if (t.height === top && majority && t.hash !== majority && hashesAtTop[majority] > hashesAtTop[t.hash]) { r.failed.push({ check: 'agree', reason: 'tip hash differs from the majority at height ' + top }); r.passed = r.passed.filter((p) => p !== 'tip'); }
    }
    const usable = CANDIDATES.filter((c) => results[c.id][net] && usableOn(results[c.id][net])).map((c) => c.id);
    summary[net] = { tip: top || null, hash: majority || null, reference: refs[net], usable };
  }

  // print
  for (const net of NETWORKS) {
    const s = summary[net];
    console.log('── ' + net + '  tip ' + (s.tip || '?') + (s.hash ? ' ' + s.hash.slice(0, 20) + '…' : '') + '  (' + s.usable.length + ' usable' + (REQUIRED[net] ? ', need ' + REQUIRED[net] : '') + ')');
    for (const c of CANDIDATES) {
      const r = results[c.id][net];
      if (!r) continue;
      const ok = usableOn(r);
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + c.name.padEnd(22) + (r.tip ? String(r.tip.height).padStart(8) : '       -') + (String(r.latencyMs) + ' ms').padStart(9) + '  ' + (r.cors ? 'cors' : 'NO CORS') + '  ' + r.passed.join(' '));
      for (const f of r.failed) console.log('         ✗ ' + f.check + ': ' + (rateLimited(f.reason) ? '[rate-limited this machine] ' : '') + f.reason);
    }
    console.log('');
  }

  // write the report, and providers.json when the picture changed
  const providers = CANDIDATES.map((c) => {
    const lastCheck = {};
    for (const net of Object.keys(results[c.id])) {
      const r = results[c.id][net];
      lastCheck[net] = { ok: usableOn(r), cors: r.cors, latencyMs: r.latencyMs, tip: r.tip ? r.tip.height : null, capabilities: r.cors ? r.passed.slice().sort() : [], failed: r.failed.map((f) => f.check + ': ' + f.reason) };
    }
    const p = { id: c.id, name: c.name, type: c.type, api: c.api };
    if (c.ws) p.ws = c.ws;
    Object.assign(p, { budget: c.budget, attribution: c.attribution, enabled: Object.values(lastCheck).some((l) => l.ok), lastCheck });
    return p;
  });
  const doc = { checked: started.toISOString().replace(/\.\d+Z$/, 'Z'), providers };
  fs.writeFileSync(path.join(OUT, 'providers-report.json'), JSON.stringify({ ...doc, summary, results }, null, 2) + '\n');
  const prev = fs.existsSync(PUBLISHED) ? JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) : null;
  const changed = !prev || stable(prev) !== stable(doc);
  if (changed || process.argv.includes('--write')) {
    fs.writeFileSync(PUBLISHED, JSON.stringify(doc, null, 2) + '\n');
    console.log((prev ? 'providers.json updated' : 'providers.json created') + (changed ? ' (results changed: review and commit it)' : ' (--write)') + ': ' + path.relative(process.cwd(), PUBLISHED));
  } else console.log('providers.json unchanged (same providers, networks and capabilities as last time)');
  console.log('passed: ' + providers.filter((p) => p.enabled).map((p) => p.name).join(', '));
  console.log('failed: ' + (providers.filter((p) => !p.enabled).map((p) => p.name).join(', ') || 'none'));

  const limited = providers.filter((p) => !p.enabled && Object.values(p.lastCheck).some((l) => l.failed.some(rateLimited))).map((p) => p.name);
  if (limited.length) console.log('rate-limited this machine (not counted as a site problem): ' + limited.join(', '));
  const empty = NETWORKS.filter((n) => !REQUIRED[n] && !summary[n].usable.length);
  if (empty.length) console.log('warning: no working provider for ' + empty.join(', ') + ' (the smoke test shows whether the page still goes live)');
  const short = NETWORKS.filter((n) => REQUIRED[n] && summary[n].usable.length < REQUIRED[n]);
  if (short.length) { console.log('\nFAIL: not enough working providers for ' + short.map((n) => n + ' (' + summary[n].usable.length + ' of ' + REQUIRED[n] + ' needed)').join(', ')); process.exit(1); }
  console.log('\nprovider probe passed');
})().catch((e) => { console.error(e); process.exit(1); });

// HTTP 429, Blockchair's 430 blacklist, and the providers' own wording for the same thing
function rateLimited(reason) { return /HTTP 4(29|30)\b|rate.?limit|too many requests|limits reached|blacklist/i.test(String(reason)); }
function usableOn(r) { return !!(r.tip && r.cors && r.passed.includes('tip')); }
// The parts of providers.json that matter to the site; timings and tip heights are left out.
function stable(doc) {
  return JSON.stringify(doc.providers.map((p) => [p.id, p.enabled, p.api, p.ws || null, p.budget, p.attribution,
    Object.keys(p.lastCheck).sort().map((n) => [n, p.lastCheck[n].ok, p.lastCheck[n].cors, p.lastCheck[n].capabilities])]));
}
