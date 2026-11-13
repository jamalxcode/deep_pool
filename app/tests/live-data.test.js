// Drives deep pool's built site (dist/) in Chromium with every API mocked, so each data path can be
// checked offline: mempool.space, the Blockstream fallback, the snapshot, a visitor's own node,
// deep pool's own node (including dashboard-only), Testnet4 and a phone-width layout.
//
//   npm test            (builds first; needs Playwright: npm i -g playwright && npx playwright install chromium)
//   node tests/live-data.test.js <dist dir> [screenshot dir]
//
// The fake answers follow the shapes of the mempool.space / Esplora APIs as far as they're known;
// they were written without network access, so a check against the real APIs is still worthwhile.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'out'));
fs.mkdirSync(OUT, { recursive: true });
const results = [];

const TIP = 1000100;
const now = Math.floor(Date.now() / 1000);
const hash = (h) => h.toString(16).padStart(64, '0');
function mpBlock(h) {
  return { id: hash(h), height: h, timestamp: now - (TIP - h) * 600 - 120, tx_count: 3000 + h % 500, size: 1600000, weight: 3990000,
    version: 0x20000000, bits: 386000000, nonce: 12345, merkle_root: 'ab'.repeat(32), difficulty: 1.5e14,
    extras: { medianFee: 2 + h % 4, feeRange: [1, 2, 3, 50 + h % 9], totalFees: 3000000 + h, reward: 315000000, pool: { name: h % 2 ? 'Foundry USA' : 'AntPool' }, matchRate: 99.5 } };
}
function esBlock(h) { const b = mpBlock(h); delete b.extras; return b; }
function tx(id, confirmed) {
  return { txid: id, size: 250, weight: 600, fee: 1500, status: confirmed ? { confirmed: true, block_height: TIP, block_time: now - 300 } : { confirmed: false },
    vin: [{ is_coinbase: false, sequence: 0xfffffffd, prevout: { scriptpubkey_address: 'bc1qsender0000000000000000000000000000000', value: 101500 } }],
    vout: [{ scriptpubkey_address: 'bc1qtestaddr0000000000000000000000000000', scriptpubkey_type: 'v0_p2wpkh', value: 60000 }, { scriptpubkey_type: 'op_return', value: 0 }, { scriptpubkey_address: 'bc1qchange000000000000000000000000000000', value: 40000 }] };
}
const TXID = 'f'.repeat(63) + '1';
const ADDR = 'bc1qtestaddr0000000000000000000000000000';

function mempoolApi(p) {
  let m;
  if (p === '/v1/blocks') return Array.from({ length: 15 }, (_, i) => mpBlock(TIP - i));
  if ((m = /^\/v1\/blocks\/(\d+)$/.exec(p))) return Array.from({ length: 15 }, (_, i) => mpBlock(+m[1] - i));
  if (p === '/v1/fees/mempool-blocks') return [
    { blockSize: 1.5e6, blockVSize: 997000, nTx: 3100, totalFees: 5100000, medianFee: 7, feeRange: [5, 6, 7, 120] },
    { blockSize: 1.5e6, blockVSize: 997000, nTx: 2800, totalFees: 3000000, medianFee: 4, feeRange: [3, 4, 5] },
    { blockSize: 9e6, blockVSize: 5.5e6, nTx: 20000, totalFees: 900000, medianFee: 1, feeRange: [1, 1, 2] }];
  if (p === '/v1/fees/recommended') return { fastestFee: 11, halfHourFee: 8, hourFee: 6, economyFee: 3, minimumFee: 1 };
  if (p === '/v1/difficulty-adjustment') return { progressPercent: 40, difficultyChange: 2.5, estimatedRetargetDate: Date.now() + 6 * 864e5, remainingBlocks: 1210, remainingTime: 6 * 864e5, previousRetarget: -1.2, nextRetargetHeight: TIP + 1210, timeAvg: 590000, expectedBlocks: 790 };
  if (p === '/mempool') return { count: 54321, vsize: 7.2e6, total_fee: 1e8, fee_histogram: [] };
  if (p === '/mempool/recent') return [{ txid: TXID, fee: 1500, vsize: 150, value: 100000 }, { txid: 'e'.repeat(64), fee: 500, vsize: 200, value: 2e8 }];
  if (p === '/v1/replacements') return [{ tx: { txid: 'd'.repeat(64), fee: 2000, vsize: 200, rate: 10 }, replaces: [{ tx: { txid: 'c'.repeat(64), rate: 5 } }], mined: false, fullRbf: false }];
  if (p === '/v1/statistics/2h') return Array.from({ length: 60 }, (_, i) => ({ added: now - i * 120, vbytes_per_second: 1000 + (i % 7) * 150 }));
  if (p === '/v1/prices') return { time: now, USD: 100000, EUR: 92000, GBP: 79000, CAD: 140000, CHF: 88000, AUD: 155000, JPY: 15000000 };
  return esploraApi(p, true);
}
function esploraApi(p, mp) {
  let m;
  if (p === '/blocks') return Array.from({ length: 10 }, (_, i) => esBlock(TIP - i));
  if ((m = /^\/blocks\/(\d+)$/.exec(p))) return Array.from({ length: 10 }, (_, i) => esBlock(+m[1] - i));
  if (p === '/fee-estimates') return { 1: 12.5, 2: 10, 3: 9, 6: 7, 144: 2.2, 504: 1.5, 1008: 1 };
  if (p === '/mempool') return { count: 40000, vsize: 2.6e6, total_fee: 1e8, fee_histogram: [[50, 100000], [10, 600000], [5, 900000], [2, 500000], [1, 500000]] };
  if (p === '/mempool/recent') return [{ txid: TXID, fee: 1500, vsize: 150, value: 100000 }];
  if ((m = /^\/block-height\/(\d+)$/.exec(p))) return hash(+m[1]);
  if ((m = /^\/(?:v1\/)?block\/([0-9a-f]{64})$/.exec(p))) { const h = parseInt(m[1], 16); return mp && p.startsWith('/v1') ? mpBlock(h) : esBlock(h); }
  if ((m = /^\/block\/([0-9a-f]{64})\/txs\/(\d+)$/.exec(p))) return Array.from({ length: 25 }, (_, i) => tx((+m[2] + i).toString(16).padStart(64, 'a'), true));
  if (p === '/tx/' + TXID) return tx(TXID, true);
  if (p === '/address/' + ADDR) return { address: ADDR, chain_stats: { funded_txo_count: 3, funded_txo_sum: 180000, spent_txo_count: 1, spent_txo_sum: 50000, tx_count: 3 }, mempool_stats: { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0 } };
  if (p === '/address/' + ADDR + '/txs') return [tx(TXID, true)];
  return undefined;
}

const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(f)];
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(f).pipe(res);
});

async function run(name, mode, fn, opts = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const hits = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.routeWebSocket(/.*/, (ws) => ws.close()); // no live stream in tests: exercises the polling path
  await page.route(/^https:\/\/(mempool\.space|blockstream\.info|mynode\.test|node\.test)\//, (route) => {
    const u = new URL(route.request().url());
    const host = u.host;
    const p = u.pathname.replace(/^\/(signet|testnet4|testnet)/, '').replace(/^\/api/, '');
    hits.push(host + u.pathname);
    const up = mode[host];
    if (!up) return route.fulfill({ status: 503, body: 'down' });
    // node.test acts like the recommended node: mempool backend without Electrs (dashboard only)
    const dashOnly = host === 'node.test' && !(/^\/v1\//.test(p) && !/^\/v1\/block\//.test(p) || /^\/mempool/.test(p));
    const body = dashOnly ? undefined : host === 'blockstream.info' ? esploraApi(p) : mempoolApi(p);
    if (body === undefined) return route.fulfill({ status: 404, body: 'not found', headers: { 'access-control-allow-origin': '*' } });
    return route.fulfill({ status: 200, contentType: typeof body === 'string' ? 'text/plain' : 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  });
  if (opts.config) await page.route(/config\.js$/, (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.DEEP_POOL_CONFIG=' + JSON.stringify(opts.config) }));
  if (opts.node) await page.addInitScript((n) => localStorage.setItem('deeppool.node', n), opts.node);
  await page.goto('http://127.0.0.1:' + server.address().port + (opts.route || '/'));
  await page.waitForFunction(() => !/Connecting/.test(document.getElementById('data-source').textContent), null, { timeout: 15000 });
  const result = { name, source: (await page.textContent('#data-source')).trim() };
  try { Object.assign(result, await fn(page)); } catch (e) { result.fail = e.message.split('\n')[0]; }
  result.errors = errors;
  result.hosts = [...new Set(hits.map((h) => h.split('/')[0]))];
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  await browser.close();
  results.push(result);
  console.log((result.fail || result.errors.length ? 'FAIL ' : 'ok   ') + name + ' - ' + result.source);
}

const firstBlock = (page) => page.$eval('.mined-block .block-height a', (a) => a.textContent);
const fees = (page) => page.$$eval('.fee-text', (els) => els.map((e) => e.textContent.trim()));

server.listen(0, async () => {
  await run('mempool-live', { 'mempool.space': 1, 'blockstream.info': 1 }, async (page) => {
    const r = { tip: await firstBlock(page), fees: await fees(page), projected: await page.$$eval('.mempool-block', (e) => e.length),
      rbf: await page.$$eval('table.replacements tbody tr', (e) => e.length), mem: await page.textContent('.mempool-info-data') };
    await page.click('.mined-block .block-link');
    await page.waitForSelector('.tx-box', { timeout: 8000 });
    r.blockTxs = await page.$$eval('.tx-box', (e) => e.length);
    r.blockHash = await page.getAttribute('.hash-link', 'title');
    await page.screenshot({ path: path.join(OUT, 'mempool-blockview.png') });
    await page.fill('.search input', TXID); await page.press('.search input', 'Enter');
    await page.waitForSelector('#dp-modal', { timeout: 8000 });
    r.txModal = (await page.textContent('#dp-modal .modal-table')).replace(/\s+/g, ' ').slice(0, 160);
    await page.keyboard.press('Escape');
    await page.fill('.search input', '900000'); await page.press('.search input', 'Enter');
    await page.waitForSelector('.blk-num', { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.blk-num').textContent === '900000', null, { timeout: 8000 });
    r.searchedBlock = await page.textContent('.blk-num');
    await page.fill('.search input', ADDR); await page.press('.search input', 'Enter');
    await page.waitForSelector('.address-view .blk-box', { timeout: 8000 });
    r.address = (await page.textContent('.address-view .blk-box')).replace(/\s+/g, ' ').slice(0, 140);
    await page.screenshot({ path: path.join(OUT, 'mempool-address.png') });
    return r;
  });
  await run('fallback-esplora', { 'blockstream.info': 1 }, async (page) => ({
    tip: await firstBlock(page), fees: await fees(page), projected: await page.$$eval('.mempool-block .fees', (e) => e.map((x) => x.textContent)),
    rbf: await page.textContent('table.replacements tbody'), chart: await page.textContent('#incoming-chart'), mem: await page.textContent('.mempool-info-data')
  }));
  await run('offline-snapshot', {}, async (page) => ({ tip: await firstBlock(page), fees: await fees(page) }));
  await run('own-node', { 'mynode.test': 1, 'mempool.space': 1 }, async (page) => ({ tip: await firstBlock(page) }), { node: 'https://mynode.test' });
  await run('own-node-down', { 'mempool.space': 1 }, async (page) => ({ tip: await firstBlock(page) }), { node: 'https://mynode.test' });
  await run('testnet4', { 'mempool.space': 1, 'blockstream.info': 1 }, async (page) => ({ tip: await firstBlock(page) }), { route: '/testnet4/' });
  await run('testnet4-no-mempool', { 'blockstream.info': 1 }, async (page) => ({ tip: await firstBlock(page) }), { route: '/testnet4/' });
  await run('mobile-390', { 'mempool.space': 1 }, async (page) => { await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(300); return { overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) }; });
  const SITE = { node: 'https://node.test', nodeName: 'the deep pool node', nodeNetworks: ['mainnet'] };
  await run('site-node', { 'node.test': 1, 'mempool.space': 1 }, async (page) => ({ tip: await firstBlock(page) }), { config: SITE });
  await run('site-node-down', { 'mempool.space': 1 }, async (page) => ({ tip: await firstBlock(page) }), { config: SITE });
  await run('site-node-signet-skips', { 'node.test': 1, 'mempool.space': 1 }, async (page) => ({ tip: await firstBlock(page) }), { config: SITE, route: '/signet/' });
  await run('visitor-node-beats-site-node', { 'mynode.test': 1, 'node.test': 1 }, async (page) => ({ tip: await firstBlock(page) }), { config: SITE, node: 'https://mynode.test' });
  const SITE_DASH = { node: 'https://node.test', nodeName: 'the deep pool node', nodeNetworks: ['mainnet'], nodeLookups: false };
  await run('site-node-dashboard-only', { 'node.test': 1, 'mempool.space': 1 }, async (page) => {
    const r = { tip: await firstBlock(page) };
    const before = new Set();
    page.on('request', (q) => { const u = new URL(q.url()); if (/node\.test|mempool\.space/.test(u.host)) before.add(u.host + ' ' + u.pathname.replace(/[0-9a-f]{64}|bc1q\w+|\d{6,}/g, ':id')); });
    await page.click('.mined-block .block-link');
    await page.waitForSelector('.tx-box', { timeout: 8000 });
    r.blockTxs = await page.$$eval('.tx-box', (e) => e.length);
    await page.fill('.search input', TXID); await page.press('.search input', 'Enter');
    await page.waitForSelector('#dp-modal', { timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.fill('.search input', ADDR); await page.press('.search input', 'Enter');
    await page.waitForSelector('.address-view .blk-box', { timeout: 8000 });
    r.lookups = [...before].sort();
    return r;
  }, { config: SITE_DASH });
  server.close();
  check();
});

// What each scenario must show.
function check() {
  const by = Object.fromEntries(results.map((r) => [r.name, r]));
  const problems = [];
  function expect(name, ok, what) { if (!by[name] || !ok(by[name])) problems.push(name + ': ' + what); }
  results.forEach((r) => { if (r.fail) problems.push(r.name + ': ' + r.fail); if (r.errors.length) problems.push(r.name + ': page errors ' + r.errors.join('; ')); });
  expect('mempool-live', (r) => /mempool\.space/.test(r.source) && r.tip === '1000100' && r.blockTxs === 25 && r.searchedBlock === '900000' && /Confirmed/.test(r.txModal) && /0\.00130000/.test(r.address), 'live data, block transactions, search, tx window and address view');
  expect('fallback-esplora', (r) => /blockstream\.info/.test(r.source) && r.projected.length === 3 && /Not available/.test(r.rbf), 'Blockstream fallback with histogram blocks');
  expect('offline-snapshot', (r) => /Offline/.test(r.source) && r.tip === '975639', 'snapshot when nothing answers');
  expect('own-node', (r) => /your node/.test(r.source) && r.hosts.join() === 'mynode.test', "a visitor's own node first");
  expect('own-node-down', (r) => /mempool\.space/.test(r.source), "falls back when a visitor's node is down");
  expect('testnet4', (r) => r.tip === '1000100', 'Testnet4 live');
  expect('testnet4-no-mempool', (r) => r.tip === '161024', 'Testnet4 snapshot (Blockstream has no Testnet4)');
  expect('mobile-390', (r) => r.overflow === 0, 'no sideways scrolling at 390 px');
  expect('site-node', (r) => /deep pool node/.test(r.source) && r.hosts.join() === 'node.test', "deep pool's own node first");
  expect('site-node-down', (r) => /mempool\.space/.test(r.source), "falls back when deep pool's node is down");
  expect('site-node-signet-skips', (r) => r.hosts.indexOf('node.test') < 0, 'networks the node does not serve skip it');
  expect('visitor-node-beats-site-node', (r) => /your node/.test(r.source), "a visitor's node beats deep pool's node");
  expect('site-node-dashboard-only', (r) => r.blockTxs === 25 && r.lookups.length === 4 && r.lookups.every((l) => l.startsWith('mempool.space')), 'nodeLookups: false sends every lookup to the public explorers');
  if (problems.length) { console.log('\n' + problems.length + ' problem(s):\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log('\nall ' + results.length + ' scenarios passed');
}
