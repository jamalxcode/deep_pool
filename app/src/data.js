/* deep pool - live data, straight from the browser (no server of our own).
 *
 * Sources, tried in order:
 *   1. mempool.space  - full data: projected blocks, fees, difficulty, prices, replacements, the
 *                       incoming-transactions chart, plus a WebSocket that pushes new blocks.
 *   2. blockstream.info (Esplora) - blocks, fee estimates, mempool size and fee histogram, recent
 *                       transactions. Projected blocks and the difficulty numbers are worked out here.
 *   3. the snapshot built into app.js - used when neither answers (offline, blocked, rate limited).
 *
 * Both sources speak the same Esplora API for blocks, transactions and addresses, so the block,
 * transaction and address views work against either one.
 *
 * Everything here turns API answers into the shapes app.js already draws. It never touches the page.
 */
(function (root) {
  'use strict';

  var PROVIDERS = {
    mempool: {
      name: 'mempool.space',
      api: {
        mainnet: 'https://mempool.space/api', signet: 'https://mempool.space/signet/api',
        testnet: 'https://mempool.space/testnet/api', testnet4: 'https://mempool.space/testnet4/api'
      },
      ws: {
        mainnet: 'wss://mempool.space/api/v1/ws', signet: 'wss://mempool.space/signet/api/v1/ws',
        testnet: 'wss://mempool.space/testnet/api/v1/ws', testnet4: 'wss://mempool.space/testnet4/api/v1/ws'
      }
    },
    esplora: {
      name: 'blockstream.info',
      api: {
        mainnet: 'https://blockstream.info/api', signet: 'https://blockstream.info/signet/api',
        testnet: 'https://blockstream.info/testnet/api'
        // Blockstream has no Testnet4 explorer, so Testnet4 falls back to the snapshot.
      }
    }
  };
  var ORDER = ['mempool', 'esplora'];
  var TIMEOUT_MS = 12000;
  var BLOCK_VSIZE = 1e6;
  var EPOCH = 2016;

  // ---------- small helpers ----------
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d === undefined ? 0 : d); }
  function last(a) { return a && a.length ? a[a.length - 1] : undefined; }

  function getJSON(url, fetchImpl) {
    var f = fetchImpl || root.fetch;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return f(url, ctl ? { signal: ctl.signal } : undefined).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { var e = new Error('HTTP ' + res.status + ' for ' + url); e.status = res.status; throw e; }
      var type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      return /json/.test(type) ? res.json() : res.text().then(function (t) {
        try { return JSON.parse(t); } catch (err) { return t; }
      });
    }, function (err) { clearTimeout(timer); throw err; });
  }

  function remainingText(ms) {
    var min = ms / 60000;
    if (min < 90) return 'In ~' + Math.max(1, Math.round(min)) + ' minutes';
    var h = min / 60;
    if (h < 48) return 'In ~' + Math.round(h) + ' hours';
    return 'In ~' + Math.round(h / 24) + ' days';
  }
  function dateText(ms, withTime) {
    var d = new Date(ms);
    var day = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    if (!withTime) return day;
    return day + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // ---------- turning API answers into app.js shapes ----------
  var norm = {};

  // mempool.space /api/v1/blocks (with extras) or Esplora /api/blocks
  norm.block = function (b) {
    var x = b.extras || {};
    var range = x.feeRange && x.feeRange.length ? [num(x.feeRange[0]), num(last(x.feeRange))] : null;
    return {
      hash: b.id, height: b.height, timestamp: b.timestamp, txs: num(b.tx_count), size: num(b.size), weight: num(b.weight),
      fullness: Math.max(0.01, Math.min(1, num(b.weight) / 4e6)),
      median: x.medianFee != null ? num(x.medianFee) : null,
      range: range,
      btc: x.totalFees != null ? num(x.totalFees) / 1e8 : null,
      reward: x.reward != null ? num(x.reward) / 1e8 : null,
      pool: x.pool && x.pool.name ? x.pool.name : null,
      version: b.version, bits: b.bits, nonce: b.nonce, merkle: b.merkle_root, difficulty: b.difficulty,
      health: x.matchRate != null ? num(x.matchRate) : null
    };
  };

  // mempool.space /api/v1/fees/mempool-blocks
  norm.mempoolBlocks = function (list) {
    return (list || []).map(function (m) {
      var vsize = num(m.blockVSize);
      var fr = m.feeRange || [];
      return {
        median: num(m.medianFee), range: [num(fr[0]), num(last(fr), num(fr[0]))], btc: num(m.totalFees) / 1e8,
        txs: num(m.nTx), vsize: vsize, fullness: Math.max(0.01, Math.min(1, vsize / BLOCK_VSIZE)),
        blocks: vsize > BLOCK_VSIZE * 1.05 ? Math.ceil(vsize / BLOCK_VSIZE) : 1
      };
    });
  };

  // Esplora /api/mempool fee_histogram: [[feerate, vsize], ...] highest fee first. Cuts it into
  // 1 MvB projected blocks, the way the miners would fill them. Transaction counts are estimated
  // from each block's share of the mempool's virtual size.
  norm.histogramBlocks = function (mp, maxBlocks) {
    maxBlocks = maxBlocks || 8;
    var hist = (mp.fee_histogram || []).slice().sort(function (a, b) { return b[0] - a[0]; });
    var total = num(mp.vsize), count = num(mp.count);
    var blocks = [], cur = null;
    function open() { cur = { hi: null, lo: null, vsize: 0, fee: 0, parts: [] }; }
    function close() {
      if (!cur || !cur.vsize) return;
      var half = cur.vsize / 2, acc = 0, median = cur.lo;
      for (var i = 0; i < cur.parts.length; i++) { acc += cur.parts[i][1]; if (acc >= half) { median = cur.parts[i][0]; break; } }
      blocks.push({
        median: median, range: [cur.lo, cur.hi], btc: cur.fee / 1e8,
        txs: total ? Math.max(1, Math.round(count * cur.vsize / total)) : 0,
        vsize: cur.vsize, fullness: Math.max(0.01, Math.min(1, cur.vsize / BLOCK_VSIZE)), blocks: 1
      });
    }
    open();
    for (var i = 0; i < hist.length; i++) {
      var rate = num(hist[i][0]), left = num(hist[i][1]);
      while (left > 0) {
        var lastBlock = blocks.length === maxBlocks - 1;
        var room = lastBlock ? Infinity : BLOCK_VSIZE - cur.vsize;
        var take = Math.min(room, left);
        if (cur.hi == null) cur.hi = rate;
        cur.lo = rate;
        cur.vsize += take; cur.fee += take * rate; cur.parts.push([rate, take]);
        left -= take;
        if (cur.vsize >= BLOCK_VSIZE && !lastBlock) { close(); open(); }
      }
    }
    close();
    var tail = last(blocks);
    if (tail && tail.vsize > BLOCK_VSIZE * 1.05) tail.blocks = Math.ceil(tail.vsize / BLOCK_VSIZE);
    return blocks;
  };

  // mempool.space /api/v1/fees/recommended
  norm.fees = function (f) {
    return [num(f.economyFee, num(f.minimumFee, 1)), num(f.hourFee), num(f.halfHourFee), num(f.fastestFee)];
  };
  // Esplora /api/fee-estimates: { "1": rate, "3": rate, "6": rate, "144": rate, ... }
  norm.esploraFees = function (e) {
    function at(t) { return num(e[String(t)], NaN); }
    function pick(list) { for (var i = 0; i < list.length; i++) { var v = at(list[i]); if (isFinite(v)) return v; } return 1; }
    return [pick([144, 504, 1008, 25]), pick([6, 10, 12]), pick([3, 4, 5, 2]), pick([1, 2])];
  };

  // mempool.space /api/v1/difficulty-adjustment
  norm.difficulty = function (d, tipHeight) {
    var progress = num(d.progressPercent);
    var expected = d.expectedBlocks != null ? num(d.expectedBlocks) : null;
    var done = EPOCH - num(d.remainingBlocks, EPOCH);
    var ahead = expected != null ? Math.max(-progress, Math.min(100 - progress, (done - expected) / EPOCH * 100)) : 0;
    var remaining = num(d.remainingTime, num(d.estimatedRetargetDate) - Date.now());
    return {
      avg: num(d.timeAvg, 600000) / 60000, change: num(d.difficultyChange), prev: num(d.previousRetarget),
      remaining: remainingText(remaining), date: dateText(num(d.estimatedRetargetDate, Date.now() + remaining), remaining < 2 * 864e5),
      progress: progress, ahead: ahead, height: tipHeight || (num(d.nextRetargetHeight) - num(d.remainingBlocks)) - 1
    };
  };

  // Worked out from Esplora blocks: the first block of this period and of the previous one.
  norm.esploraDifficulty = function (tip, epochStart, prevEpochStart) {
    var done = tip.height - epochStart.height + 1;
    var elapsed = Math.max(1, tip.timestamp - epochStart.timestamp);
    var avgSec = done > 1 ? elapsed / (done - 1) : 600;
    var left = EPOCH - done;
    var remaining = left * avgSec * 1000;
    var change = (600 / avgSec - 1) * 100;
    var prev = 0;
    if (prevEpochStart && epochStart.difficulty && prevEpochStart.difficulty) prev = (epochStart.difficulty / prevEpochStart.difficulty - 1) * 100;
    var progress = done / EPOCH * 100;
    var expectedDone = Math.min(EPOCH, elapsed / 600 + 1);
    return {
      avg: avgSec / 60, change: Math.max(-75, Math.min(300, change)), prev: prev,
      remaining: remainingText(remaining), date: dateText(Date.now() + remaining, remaining < 2 * 864e5),
      progress: progress, ahead: Math.max(-progress, Math.min(100 - progress, (done - expectedDone) / EPOCH * 100)), height: tip.height
    };
  };

  // /api/mempool/recent (both sources): [{ txid, fee, vsize, value }]
  norm.recent = function (list, price) {
    return (list || []).map(function (t) {
      var btc = num(t.value) / 1e8;
      return { txid: t.txid, value: btc, fee: num(t.vsize) ? num(t.fee) / num(t.vsize) : 0, usd: price ? btc * price : null };
    });
  };

  // mempool.space /api/v1/replacements, or the WebSocket's rbfLatest: replacement trees
  norm.replacements = function (list) {
    return (list || []).map(function (tree) {
      var tx = tree.tx || {};
      var rate = tx.rate != null ? num(tx.rate) : (num(tx.vsize) ? num(tx.fee) / num(tx.vsize) : 0);
      var prev = 0;
      (tree.replaces || []).forEach(function (r) {
        var t = r.tx || {};
        var pr = t.rate != null ? num(t.rate) : (num(t.vsize) ? num(t.fee) / num(t.vsize) : 0);
        prev = Math.max(prev, pr);
      });
      var status = [];
      if (tree.mined) status.push('mined');
      status.push(tree.fullRbf || tx.fullRbf ? 'full-rbf' : 'rbf');
      return { txid: tx.txid, prev: prev, fee: rate, status: status };
    }).filter(function (r) { return r.txid; });
  };

  // mempool.space /api/v1/statistics/2h: [{ added, vbytes_per_second, ... }]
  norm.stats = function (list) {
    return (list || []).map(function (s) { return { t: num(s.added) * 1000, v: num(s.vbytes_per_second) }; })
      .filter(function (p) { return p.t; })
      .sort(function (a, b) { return a.t - b.t; });
  };

  // Esplora transaction -> the shape the transaction boxes draw
  norm.tx = function (t) {
    var coinbase = !!(t.vin && t.vin[0] && t.vin[0].is_coinbase);
    var ins = coinbase ? [] : (t.vin || []).map(function (v) {
      var p = v.prevout || {};
      return [p.scriptpubkey_address || (p.scriptpubkey_type || 'unknown').toUpperCase(), num(p.value) / 1e8];
    });
    var outs = (t.vout || []).map(function (o) {
      var data = o.scriptpubkey_type === 'op_return';
      return [data ? 'OP_RETURN' : (o.scriptpubkey_address || (o.scriptpubkey_type || 'unknown').toUpperCase()), num(o.value) / 1e8];
    });
    var vsize = num(t.weight) / 4;
    var st = t.status || {};
    return {
      txid: t.txid, coinbase: coinbase, ins: ins, outs: outs,
      total: outs.reduce(function (s, o) { return s + o[1]; }, 0),
      fee: num(t.fee), rate: vsize ? num(t.fee) / vsize : 0, vsize: vsize, size: num(t.size),
      confirmed: !!st.confirmed, height: st.block_height, time: st.block_time, rbf: (t.vin || []).some(function (v) { return v.sequence < 0xfffffffe; })
    };
  };

  // Esplora /api/address/:a and /api/address/:a/txs -> balance, totals and per-transaction changes
  norm.address = function (addr, info, txs) {
    var cs = info.chain_stats || {}, ms = info.mempool_stats || {};
    var balance = (num(cs.funded_txo_sum) - num(cs.spent_txo_sum)) / 1e8;
    var pending = (num(ms.funded_txo_sum) - num(ms.spent_txo_sum)) / 1e8;
    var list = (txs || []).map(function (t) {
      var got = 0, spent = 0;
      (t.vout || []).forEach(function (o) { if (o.scriptpubkey_address === addr) got += num(o.value); });
      (t.vin || []).forEach(function (v) { if (v.prevout && v.prevout.scriptpubkey_address === addr) spent += num(v.prevout.value); });
      var amount = (got - spent) / 1e8;
      var kind = spent && got ? 'Sent & received' : spent ? 'Sent' : 'Received';
      var st = t.status || {};
      return { tx: norm.tx(t), amount: amount, kind: kind, confirmed: !!st.confirmed, height: st.block_height, time: st.block_time };
    });
    // running balance, newest first, counted back from today's confirmed balance
    var bal = balance;
    list.forEach(function (a) {
      if (!a.confirmed) { a.balance = bal; return; }
      a.balance = bal;
      bal = Math.round((bal - a.amount) * 1e8) / 1e8;
    });
    return {
      addr: addr, balance: balance, pending: pending,
      received: num(cs.funded_txo_sum) / 1e8,
      utxos: Math.max(0, num(cs.funded_txo_count) - num(cs.spent_txo_count)),
      pendingUtxos: num(ms.funded_txo_count) - num(ms.spent_txo_count),
      txCount: num(cs.tx_count) + num(ms.tx_count),
      txs: list
    };
  };

  // ---------- the client ----------
  // A person's own node: the base address of a mempool or Esplora/Electrs instance running on it,
  // for example http://umbrel.local:3006 or https://mempool.mynode.example. Bitcoin Core's own RPC
  // can't be used from a web page (no CORS, needs a password), so it has to be one of those apps.
  function nodeProvider(base, net) {
    base = String(base || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
    if (!/^https?:\/\//i.test(base)) return null;
    var prefix = net === 'mainnet' ? '' : '/' + net;
    var api = {}, ws = {};
    api[net] = base + prefix + '/api';
    ws[net] = base.replace(/^http/i, 'ws') + prefix + '/api/v1/ws';
    return { name: base.replace(/^https?:\/\//i, ''), api: api, ws: ws, own: true };
  }

  function Client(net, opts) {
    opts = opts || {};
    this.net = net;
    this.fetch = opts.fetch;
    this.WebSocket = opts.WebSocket || root.WebSocket;
    this.providers = {};
    for (var k in PROVIDERS) this.providers[k] = PROVIDERS[k];
    var order = (opts.order || ORDER).slice();
    var node = opts.node ? nodeProvider(opts.node, net) : null;
    if (node) { this.providers.node = node; order.unshift('node'); }
    var providers = this.providers;
    this.order = order.filter(function (p) { return providers[p] && providers[p].api[net]; });
    this.current = null;      // provider that answered last
    this.failedAt = {};       // provider -> time it last failed
    this.retryPrimaryMs = opts.retryPrimaryMs || 5 * 60000;
    this.ws = null;
  }

  Client.prototype.url = function (provider, path) { return this.providers[provider].api[this.net] + path; };
  Client.prototype.get = function (provider, path) { return getJSON(this.url(provider, path), this.fetch); };

  // Which providers to try, best first. A provider that failed recently goes to the back of the
  // queue until retryPrimaryMs has passed, so a dead primary doesn't slow every refresh down.
  Client.prototype.queue = function () {
    var now = Date.now(), self = this;
    var fresh = this.order.filter(function (p) { return !(now - (self.failedAt[p] || 0) < self.retryPrimaryMs); });
    var stale = this.order.filter(function (p) { return fresh.indexOf(p) < 0; });
    return fresh.concat(stale);
  };

  // Calls fn(provider) for each provider in turn until one succeeds.
  Client.prototype.tryEach = function (fn) {
    var self = this, list = this.queue(), i = 0, lastErr = null;
    function next() {
      if (i >= list.length) return Promise.reject(lastErr || new Error('no data source for ' + self.net));
      var p = list[i++];
      return Promise.resolve().then(function () { return fn(p); }).then(function (v) {
        delete self.failedAt[p];
        return { provider: p, value: v };
      }, function (err) {
        self.failedAt[p] = Date.now();
        lastErr = err;
        return next();
      });
    }
    return next();
  };

  // One full dashboard snapshot. Resolves with { source, data } where data holds only the fields
  // that source could provide; app.js keeps its own values for the rest.
  Client.prototype.snapshot = function () {
    var self = this;
    return this.tryEach(function (p) {
      if (p === 'esplora') return self.esploraSnapshot(p);
      if (p === 'mempool') return self.mempoolSnapshot(p);
      // your own node: a mempool instance first, a plain Esplora/Electrs one if that fails
      return self.mempoolSnapshot(p).catch(function () { return self.esploraSnapshot(p).then(function (v) { v.plainEsplora = true; return v; }); });
    }).then(function (r) {
      self.current = r.provider;
      var prov = self.providers[r.provider];
      if (r.provider === 'node') prov.plainEsplora = !!r.value.plainEsplora;
      return { source: r.provider, name: prov.name, own: !!prov.own, data: r.value };
    });
  };

  function optional(promise) { return promise.then(function (v) { return v; }, function () { return undefined; }); }

  Client.prototype.mempoolSnapshot = function (provider) {
    var self = this, g = function (path) { return self.get(provider || 'mempool', path); };
    // The block list is required: if it fails, the whole source counts as down.
    return g('/v1/blocks').then(function (first) {
      var tip = first[0];
      var more = tip && first.length ? optional(g('/v1/blocks/' + (last(first).height - 1))) : Promise.resolve([]);
      return Promise.all([
        more, optional(g('/v1/fees/mempool-blocks')), optional(g('/v1/fees/recommended')), optional(g('/v1/difficulty-adjustment')),
        optional(g('/mempool')), optional(g('/mempool/recent')), optional(g('/v1/replacements')), optional(g('/v1/statistics/2h')),
        self.net === 'mainnet' ? optional(g('/v1/prices')) : Promise.resolve(undefined)
      ]).then(function (r) {
        var blocks = first.concat(r[0] || []).slice(0, 28).map(norm.block);
        var prices = r[8];
        var price = prices && prices.USD ? num(prices.USD) : undefined;
        var out = { blocks: blocks };
        if (r[1]) out.mempool = norm.mempoolBlocks(r[1]);
        if (r[2]) { out.fees = norm.fees(r[2]); out.minFee = num(r[2].minimumFee, undefined); }
        if (r[3]) out.difficulty = norm.difficulty(r[3], tip.height);
        if (r[4]) out.mempoolInfo = { count: num(r[4].count), vsize: num(r[4].vsize) };
        if (r[5]) out.recent = norm.recent(r[5], price);
        if (r[6]) out.replacements = norm.replacements(r[6]);
        if (r[7]) out.stats = norm.stats(r[7]);
        if (price) { out.price = price; out.rates = prices; }
        return out;
      });
    });
  };

  Client.prototype.esploraSnapshot = function (provider) {
    var self = this, g = function (path) { return self.get(provider || 'esplora', path); };
    return g('/blocks').then(function (first) {
      var tip = first[0];
      if (!tip) throw new Error('empty block list');
      var startH = tip.height - tip.height % EPOCH;
      function blockAt(h) { return g('/block-height/' + h).then(function (hash) { return g('/block/' + String(hash).trim()); }); }
      return Promise.all([
        optional(g('/blocks/' + (last(first).height - 1))), optional(g('/blocks/' + (last(first).height - 11))),
        optional(g('/fee-estimates')), optional(g('/mempool')), optional(g('/mempool/recent')),
        optional(blockAt(startH)), startH >= EPOCH ? optional(blockAt(startH - EPOCH)) : Promise.resolve(undefined)
      ]).then(function (r) {
        var blocks = first.concat(r[0] || [], r[1] || []).slice(0, 28).map(norm.block);
        var out = { blocks: blocks };
        if (r[2]) out.fees = norm.esploraFees(r[2]);
        if (r[3]) {
          out.mempool = norm.histogramBlocks(r[3]);
          out.mempoolInfo = { count: num(r[3].count), vsize: num(r[3].vsize) };
          var rates = (r[3].fee_histogram || []).map(function (h) { return num(h[0]); }).filter(function (v) { return v > 0; });
          if (rates.length) out.minFee = Math.min.apply(null, rates);
        }
        if (r[4]) out.recent = norm.recent(r[4]);
        if (r[5]) out.difficulty = norm.esploraDifficulty(tip, r[5], r[6]);
        return out;
      });
    });
  };

  // Block, transaction and address lookups use the shared Esplora API, so either source works.
  Client.prototype.lookup = function (path) {
    var self = this;
    var list = this.current ? [this.current].concat(this.order.filter(function (p) { return p !== self.current; })) : this.queue();
    var i = 0, lastErr;
    function next() {
      if (i >= list.length) return Promise.reject(lastErr || new Error('not found'));
      var p = list[i++];
      return self.get(p, path).catch(function (err) {
        lastErr = err;
        if (err && (err.status === 400 || err.status === 404)) throw err; // a real "not found": don't ask the next source
        return next();
      });
    }
    return next();
  };
  Client.prototype.blockByHeight = function (h) {
    var self = this;
    return this.lookup('/block-height/' + h).then(function (hash) { return self.block(String(hash).trim()); });
  };
  Client.prototype.block = function (hash) {
    var self = this;
    // mempool.space's v1 block has the fee and pool details; plain Esplora's doesn't
    var cur = this.current || this.order[0];
    var hasV1 = cur === 'mempool' || (cur === 'node' && !this.providers.node.plainEsplora);
    var v1 = hasV1
      ? this.get(cur, '/v1/block/' + hash).catch(function () { return self.lookup('/block/' + hash); })
      : this.lookup('/block/' + hash);
    return v1.then(norm.block);
  };
  Client.prototype.blockTxs = function (hash, start) {
    return this.lookup('/block/' + hash + '/txs/' + (start || 0)).then(function (list) { return list.map(norm.tx); });
  };
  Client.prototype.tx = function (txid) { return this.lookup('/tx/' + txid).then(norm.tx); };
  Client.prototype.address = function (addr) {
    var self = this;
    return Promise.all([this.lookup('/address/' + addr), this.lookup('/address/' + addr + '/txs')])
      .then(function (r) { return norm.address(addr, r[0], r[1]); });
  };

  // mempool.space WebSocket: pushes new blocks, projected blocks, fees, difficulty, prices, the
  // mempool's size and the latest transactions and replacements. Calls onData(partial data) with the
  // same field names as snapshot(). Reconnects with a growing delay; gives up quietly if it can't.
  Client.prototype.subscribe = function (onData, onState) {
    var self = this;
    var wsProv = this.current === 'node' && !this.providers.node.plainEsplora ? 'node' : 'mempool';
    if (this.current === 'node' && wsProv !== 'node') wsProv = null; // a plain Esplora node has no WebSocket
    var wsUrl = wsProv && this.providers[wsProv].ws && this.providers[wsProv].ws[this.net];
    if (!this.WebSocket || !wsUrl) return function () {};
    var stopped = false, delay = 2000, tip = 0;
    function connect() {
      if (stopped) return;
      var ws;
      try { ws = new self.WebSocket(wsUrl); } catch (e) { return retry(); }
      self.ws = ws;
      ws.onopen = function () {
        delay = 2000;
        ws.send(JSON.stringify({ action: 'init' }));
        ws.send(JSON.stringify({ action: 'want', data: ['blocks', 'stats', 'mempool-blocks', 'live-2h-chart'] }));
        ws.send(JSON.stringify({ 'track-rbf': 'all' }));
        if (onState) onState('open');
      };
      ws.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        var out = {};
        if (m.blocks && m.blocks.length) { out.blocks = m.blocks.slice().sort(function (a, b) { return b.height - a.height; }).map(norm.block); tip = out.blocks[0].height; }
        if (m.block) { out.newBlock = norm.block(m.block); tip = Math.max(tip, m.block.height); }
        if (m['mempool-blocks']) out.mempool = norm.mempoolBlocks(m['mempool-blocks']);
        if (m.fees) { out.fees = norm.fees(m.fees); if (m.fees.minimumFee != null) out.minFee = num(m.fees.minimumFee); }
        if (m.da) out.difficulty = norm.difficulty(m.da, tip);
        if (m.mempoolInfo) {
          var mi = m.mempoolInfo;
          out.mempoolInfo = { count: num(mi.size), vsize: num(mi.bytes), usage: num(mi.usage, undefined), max: num(mi.maxmempool, undefined), minFee: mi.mempoolminfee != null ? num(mi.mempoolminfee) * 1e5 : undefined };
        }
        if (m.transactions) out.recent = norm.recent(m.transactions);
        if (m.rbfLatest) out.replacements = norm.replacements(m.rbfLatest);
        if (m.conversions && m.conversions.USD) { out.price = num(m.conversions.USD); out.rates = m.conversions; }
        if (m['live-2h-chart']) out.stats = norm.stats([m['live-2h-chart']]);
        if (m.vBytesPerSecond != null) out.vBytesPerSecond = num(m.vBytesPerSecond);
        for (var k in out) { onData(out); break; }
      };
      ws.onclose = function () { if (onState) onState('closed'); retry(); };
      ws.onerror = function () { try { ws.close(); } catch (e) { /* closing anyway */ } };
    }
    function retry() {
      if (stopped) return;
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 120000);
    }
    connect();
    return function () { stopped = true; if (self.ws) try { self.ws.close(); } catch (e) { /* gone */ } };
  };

  var api = { Client: Client, norm: norm, PROVIDERS: PROVIDERS, nodeProvider: nodeProvider, remainingText: remainingText };
  root.DeepPoolData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
