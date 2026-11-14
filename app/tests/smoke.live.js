// Live smoke test (build step 1). Opens the built site (dist/) in Chromium against the REAL APIs,
// no mocks, and checks that every dashboard panel shows live data rather than the recorded snapshot,
// on all four networks. On mainnet it also opens a block, and searches a transaction, a block height
// and an address. The browser enforces CORS, so this also proves the calls work from a web page.
//
//   npm run test:live            (provider probe first, then this; build first)
//   node tests/smoke.live.js [dist dir] [screenshot dir]
//   SMOKE_RATE_LIMIT=mempool.space node tests/smoke.live.js   (simulated rate limit: must only warn)
//   SMOKE_DOWN=mempool.space,blockstream.info node tests/smoke.live.js   (simulated outage: must fail)
//
// What fails (exit 1): a page that doesn't go live, a panel without real data, a broken block view or
// search, or a JavaScript error. What only warns: the same data problems on a route where a provider
// answered this machine with a rate limit (HTTP 429/430). Visitors call from their own IP addresses,
// so a limit on this Mac says nothing about the site. JavaScript errors fail regardless.
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'out'));
fs.mkdirSync(OUT, { recursive: true });

const TXID = 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16'; // block 170, the first payment
const ADDR = '12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S';
const ROUTES = [{ net: 'mainnet', path: '/' }, { net: 'signet', path: '/signet/' }, { net: 'testnet', path: '/testnet/' }, { net: 'testnet4', path: '/testnet4/' }];
// where the test itself reads the tip, to compare with what the page shows
const TIP_SOURCES = {
  mainnet: ['https://mempool.space/api', 'https://blockstream.info/api'],
  signet: ['https://mempool.space/signet/api', 'https://blockstream.info/signet/api'],
  testnet: ['https://mempool.space/testnet/api', 'https://blockstream.info/testnet/api'],
  testnet4: ['https://mempool.space/testnet4/api']
};
async function referenceTip(net) {
  for (const base of TIP_SOURCES[net]) {
    try { const r = await fetch(base + '/blocks/tip/height', { signal: AbortSignal.timeout(10000) }); if (r.ok) return Number(await r.text()); } catch (e) { /* next */ }
  }
  return null;
}

const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(f)];
  res.writeHead(200, { 'content-type': type || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const problems = [];
const warnings = [];
const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

async function checkRoute(browser, route) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failedCalls = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (q) => { if (!/^http:\/\/127\.0\.0\.1/.test(q.url())) failedCalls.push(q.url() + ' (' + (q.failure() || {}).errorText + ')'); });
  // checks of this test itself: SMOKE_RATE_LIMIT=host,… answers 429 (must only warn), SMOKE_DOWN=host,… answers 503 (must fail)
  const fake = (v) => (process.env[v] || '').split(',').filter(Boolean);
  const fakeLimit = fake('SMOKE_RATE_LIMIT'), fakeDown = fake('SMOKE_DOWN');
  if (fakeLimit.length || fakeDown.length) await page.route((u) => fakeLimit.includes(u.host) || fakeDown.includes(u.host),
    (q) => fakeLimit.includes(new URL(q.request().url()).host) ? q.fulfill({ status: 429, body: 'simulated rate limit' }) : q.fulfill({ status: 503, body: 'simulated outage' }));
  const limitedBy = new Set(); // providers that answered this machine with a rate limit
  page.on('response', (res) => { if (res.status() === 429 || res.status() === 430) limitedBy.add(new URL(res.url()).host); });
  const refBefore = await referenceTip(route.net);
  const name = route.net;
  const dataProblems = [];
  const bad = (what) => dataProblems.push(what);
  const note = (what) => warnings.push(name + ': ' + what);
  const r = {};
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + route.path);
    await page.waitForFunction(() => !/Connecting/.test(document.getElementById('data-source').textContent), null, { timeout: 30000 });
    r.source = (await page.textContent('#data-source')).replace(/\s+/g, ' ').trim();
    if (!/Live data from/.test(r.source)) bad('not live: "' + r.source + '"');
    r.tip = num(await page.$eval('.mined-block .block-height a', (a) => a.textContent));
    // read the tip again after the page did: testnet can mine several blocks in a minute
    const refAfter = await referenceTip(route.net);
    const refs = [refBefore, refAfter].filter((x) => x != null);
    r.ref = refs.length ? (refs[0] === refs[refs.length - 1] ? String(refs[0]) : refs.join('→')) : null;
    if (!refs.length) note('could not read a reference tip from the test (tip not compared)');
    else if (r.tip < Math.min(...refs) - 2 || r.tip > Math.max(...refs) + 2) bad('page shows tip ' + r.tip + ', the API says ' + r.ref);
    r.blocks = await page.$$eval('.mined-block', (e) => e.length);
    if (r.blocks < 4) bad('only ' + r.blocks + ' mined blocks shown');
    // test networks can have a near-empty mempool: zero fees, transactions or projected blocks can be real there
    const main = route.net === 'mainnet';
    r.fees = await page.$$eval('.fee-text', (els) => els.map((e) => e.textContent.trim()));
    if (r.fees.length !== 4 || !r.fees.every((f) => /\d/.test(f) && (main ? num(f) > 0 : num(f) >= 0))) bad('fee panel: ' + JSON.stringify(r.fees));
    r.mempool = (await page.textContent('.mempool-info-data')).replace(/\s+/g, ' ').trim();
    const count = /Unconfirmed\s*([\d,]+)/.exec(r.mempool);
    const pending = count ? num(count[1]) : NaN;
    if (!count || (main && pending <= 0)) bad('mempool panel has no unconfirmed count: "' + r.mempool.slice(0, 120) + '"');
    r.projected = await page.$$eval('.mempool-block', (e) => e.length);
    if (r.projected < 1 && pending > 0) bad('no projected blocks');
    r.difficulty = (await page.textContent('.difficulty-stats')).replace(/\s+/g, ' ').trim();
    if (!/minutes/.test(r.difficulty)) bad('difficulty panel: "' + r.difficulty.slice(0, 120) + '"');
    r.chart = await page.$eval('#incoming-chart', (e) => e.children.length + ' elements, "' + e.textContent.trim().slice(0, 60) + '"');
    if (/^0 elements/.test(r.chart)) bad('incoming-transactions chart is empty');
    r.recent = await page.$$eval('table.recent tbody tr', (e) => e.length);
    if (r.recent < 1 && pending > 0) bad('no recent transactions');
    r.replacements = await page.$$eval('table.replacements tbody tr', (e) => e.length + ' rows: ' + e.map((x) => x.textContent.trim()).join(' | ').slice(0, 80));
    await page.screenshot({ path: path.join(OUT, 'live-' + name + '.png') });

    if (route.net === 'mainnet') {
      await page.click('.mined-block .block-link');
      await page.waitForSelector('.tx-box', { timeout: 20000 });
      r.blockTxs = await page.$$eval('.tx-box', (e) => e.length);
      if (r.blockTxs < 1) bad('block view lists no transactions');
      await page.screenshot({ path: path.join(OUT, 'live-blockview.png') });
      await page.fill('.search input', TXID); await page.press('.search input', 'Enter');
      await page.waitForSelector('#dp-modal', { timeout: 20000 });
      await page.waitForFunction(() => /Confirmed|not found|Couldn/i.test(document.querySelector('#dp-modal').textContent), null, { timeout: 20000 });
      r.txModal = (await page.textContent('#dp-modal')).replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!/Confirmed/.test(r.txModal)) bad('transaction search: "' + r.txModal + '"');
      await page.keyboard.press('Escape');
      await page.fill('.search input', '170'); await page.press('.search input', 'Enter');
      await page.waitForFunction(() => { const e = document.querySelector('.blk-num'); return e && e.textContent === '170'; }, null, { timeout: 20000 });
      r.searchedBlock = await page.textContent('.blk-num');
      await page.fill('.search input', ADDR); await page.press('.search input', 'Enter');
      await page.waitForSelector('.address-view .blk-box', { timeout: 20000 });
      r.address = (await page.textContent('.address-view .blk-box')).replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!/BTC|sats/.test(r.address)) bad('address view: "' + r.address + '"');
      await page.screenshot({ path: path.join(OUT, 'live-address.png') });
    }
  } catch (e) { bad(e.message.split('\n')[0]); }
  r.failedCalls = failedCalls;
  await page.close();
  // a rate limit on this machine turns data problems into warnings; JavaScript errors always fail
  const limited = limitedBy.size > 0;
  const prefix = limited ? '[rate-limited by ' + [...limitedBy].join(', ') + ' from this machine] ' : '';
  dataProblems.forEach((p) => (limited ? warnings : problems).push(name + ': ' + prefix + p));
  if (errors.length) problems.push(name + ': page errors: ' + errors.join('; '));
  if (limited && !dataProblems.length) note('rate-limited by ' + [...limitedBy].join(', ') + ' from this machine, but the page still showed live data');
  const mine = problems.filter((p) => p.startsWith(name + ':'));
  const mineWarn = warnings.filter((p) => p.startsWith(name + ':'));
  console.log((mine.length ? 'FAIL ' : mineWarn.length ? 'warn ' : 'ok   ') + name.padEnd(9) + ' ' + (r.source || '').replace(/ · .*/, ''));
  console.log('       tip ' + r.tip + ' (API ' + r.ref + '), ' + r.blocks + ' blocks, fees ' + (r.fees || []).join(' / ') + ', ' + r.projected + ' projected, ' + r.recent + ' recent txs');
  console.log('       mempool: ' + (r.mempool || '').slice(0, 110));
  console.log('       difficulty: ' + (r.difficulty || '').slice(0, 110));
  console.log('       replacements: ' + r.replacements + ' · chart: ' + r.chart);
  if (r.blockTxs != null) console.log('       block view: ' + r.blockTxs + ' txs · tx search: ' + r.txModal + '\n       block search: ' + r.searchedBlock + ' · address: ' + r.address);
  if (failedCalls.length) console.log('       calls that failed in the browser (fallbacks may have covered them): ' + failedCalls.slice(0, 5).join(', '));
  mine.forEach((p) => console.log('       ✗ ' + p.slice(name.length + 2)));
  mineWarn.forEach((p) => console.log('       ! ' + p.slice(name.length + 2)));
}

server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch();
  try { for (const r of ROUTES) await checkRoute(browser, r); } finally { await browser.close(); server.close(); }
  if (warnings.length) console.log('\n' + warnings.length + ' warning(s), not failures:\n- ' + warnings.join('\n- '));
  if (problems.length) { console.log('\n' + problems.length + ' problem(s) in the live smoke test:\n- ' + problems.join('\n- ')); process.exit(1); }
  const unchecked = ROUTES.filter((r) => warnings.some((w) => w.startsWith(r.net + ': [rate-limited'))).map((r) => r.net);
  console.log('\nlive smoke test passed' + (unchecked.length ? ' with warnings: ' + unchecked.join(', ') + ' could not be fully checked (rate-limited from this machine)' : ' (' + ROUTES.length + ' networks against the real APIs)'));
});
