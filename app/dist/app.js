/* deep pool — a Bitcoin mempool explorer.
   One script renders every route (/, /signet, /testnet, /testnet4, /acceleration).
   Everything it shows comes from data built into this file; it never contacts
   another server, and keeps itself moving with simulated activity. */
(function () {
  'use strict';

  // ---------- route ----------
  // The page's own folder name says which route it is, so the site works at the top of a domain,
  // inside a sub-folder, or opened straight from the files on disk.
  var segments = location.pathname.split('/').filter(function (x) { return x && x !== 'index.html'; });
  var last = segments[segments.length - 1] || '';
  var ROUTES = ['signet', 'testnet', 'testnet4', 'acceleration'];
  var route = ROUTES.indexOf(last) >= 0 ? last : '';
  var FILE = location.protocol === 'file:';
  var ROOT = route ? '../' : './';
  function L(p) {
    if (p.charAt(0) !== '/') return p;
    var r = p.slice(1);
    return ROOT + (r ? r + (FILE ? '/index.html' : '') : (FILE ? 'index.html' : ''));
  }
  var NETWORKS = ['mainnet', 'signet', 'testnet', 'testnet4'];
  var net = 'mainnet';
  var page = 'dashboard';
  if (route === 'acceleration') page = 'acceleration';
  else if (route) net = route;
  var netPrefix = net === 'mainnet' ? '' : '/' + net;
  var unit = { mainnet: 'BTC', signet: 'sBTC', testnet: 'tBTC', testnet4: 'tBTC' }[net];
  var NET_LABEL = { mainnet: 'Mainnet', signet: 'Signet', testnet: 'Testnet3', testnet4: 'Testnet4' };
  var NET_COLOR = { mainnet: '#e69f00', signet: '#cc79a7', testnet: '#009e73', testnet4: '#56b4e9' };

  // ---------- small helpers ----------
  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = seeded({ mainnet: 11, signet: 23, testnet: 37, testnet4: 41 }[net] + (page === 'acceleration' ? 7 : 0));
  function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(rand() * 16)]; return s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }
  function feeFmt(v) {
    if (v >= 100) return commas(v);
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  function btcFmt(v) {
    var s = v.toFixed(3);
    if (s.slice(-1) === '0') s = s.slice(0, -1);
    return s;
  }
  function amountFmt(v) {
    if (v >= 100) return v.toFixed(3);
    if (v === 0) return '0.00';
    var s = v.toFixed(4).replace(/0+$/, '');
    if (/\.\d?$/.test(s)) s = v.toFixed(2);
    return s;
  }
  function ago(minutes) {
    if (minutes < 1) return 'Just now';
    if (minutes < 120) return Math.round(minutes) + ' minute' + (Math.round(minutes) === 1 ? '' : 's') + ' ago';
    var h = Math.floor(minutes / 60);
    if (h < 48) return h + ' hours ago';
    return Math.floor(h / 24) + ' days ago';
  }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem('deeppool.' + key);
      localStorage.setItem('deeppool.' + key, val);
    } catch (e) { return null; }
  }

  // fee scale: green for cheap, olive and amber for busy, red and purple for very high fees
  var FEE_STOPS = [
    [0, [0, 125, 61]], [1, [0, 125, 61]], [2, [30, 125, 40]], [3, [80, 125, 15]], [5, [109, 125, 4]],
    [8, [125, 125, 0]], [15, [150, 110, 0]], [40, [180, 80, 0]], [100, [180, 40, 40]], [300, [140, 30, 120]]
  ];
  function feeColor(fee) {
    var x = Math.log(1 + Math.max(0, fee));
    for (var i = 1; i < FEE_STOPS.length; i++) {
      var a = FEE_STOPS[i - 1], b = FEE_STOPS[i];
      var xa = Math.log(1 + a[0]), xb = Math.log(1 + b[0]);
      if (x <= xb) {
        var t = (x - xa) / (xb - xa);
        return 'rgb(' + a[1].map(function (c, k) { return Math.round(c + (b[1][k] - c) * t); }).join(',') + ')';
      }
    }
    return 'rgb(' + FEE_STOPS[FEE_STOPS.length - 1][1].join(',') + ')';
  }

  // ---------- icons (drawn for this project) ----------
  var I = {
    gauge: '<svg role="img" focusable="false" viewBox="0 0 24 21"><path fill="currentColor" d="M12 1a11 11 0 0 0-9.5 16.5c.4.7 1.1 1 1.9 1h15.2c.8 0 1.5-.3 1.9-1A11 11 0 0 0 12 1z"/><g fill="#11131f"><circle cx="12" cy="13" r="2.1"/><circle cx="6" cy="12.5" r="1.1"/><circle cx="7.8" cy="7.6" r="1.1"/><circle cx="12" cy="5.6" r="1.1"/><circle cx="18" cy="12.5" r="1.1"/></g><path d="M12 13l4.6-5.6" stroke="#11131f" stroke-width="2.2" stroke-linecap="round"/></svg>',
    rocket: '<svg role="img" focusable="false" viewBox="0 0 24 24"><g fill="currentColor"><path d="M21.6 2.4c-4.7-.6-8.6 1.2-11.3 4.8L6.6 8 3 11.5l4.1 1.3 4.1 4.1 1.3 4.1 3.5-3.6.8-3.7c3.6-2.7 5.4-6.6 4.8-11.3zM15.5 10.2a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z"/><path d="M6.4 15.4c-1.7.3-3 1.9-3.2 5.4 3.5-.2 5.1-1.5 5.4-3.2z"/></g></svg>',
    pickaxe: '<svg role="img" focusable="false" viewBox="0 0 24 24"><path d="M3.5 20.5l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path fill="currentColor" d="M8.6 3.2c4.5-1.6 9.3-.4 12.2 3l-1.9 1.9c-2.3-2.4-5.6-3.5-8.9-3zM20.8 15.4c1.6-4.5.4-9.3-3-12.2l-1.9 1.9c2.4 2.3 3.5 5.6 3 8.9z"/><path fill="currentColor" d="M12.6 7.6l3.8 3.8 1.6-1.6-3.8-3.8z"/></svg>',
    bolt: '<svg role="img" focusable="false" viewBox="0 0 24 24"><path fill="currentColor" d="M14.5 1.5L4.5 13.6h6.3l-1.6 8.9 10.3-12.4h-6.4z"/></svg>',
    chart: '<svg role="img" focusable="false" viewBox="0 0 24 24"><path d="M2.5 2.5v19h19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path fill="currentColor" d="M6 18.5v-5.2l3.8-4.4 3.6 3.3 3.6-6.2 3.5 4.4v8.1z"/></svg>',
    layers: '<svg role="img" focusable="false" viewBox="0 0 24 24"><g fill="currentColor"><path d="M12 1.8l10 4.9-10 4.9L2 6.7z"/><path d="M4.3 10.6L12 14.4l7.7-3.8L22 11.7l-10 4.9-10-4.9z"/><path d="M4.3 15.5L12 19.3l7.7-3.8 2.3 1.1-10 4.9-10-4.9z"/></g></svg>',
    info: '<svg role="img" focusable="false" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="currentColor"/><circle cx="12" cy="7" r="1.6" fill="#11131f"/><path d="M9.8 10.3h3.2v6.5h1.4v1.6H9.8v-1.6h1.4v-4.9H9.8z" fill="#11131f"/></svg>',
    faucet: '<svg role="img" focusable="false" viewBox="0 0 24 24"><g fill="currentColor"><path d="M10 3h4v2h3v3h-3v1h5a3 3 0 0 1 3 3v2h-4v-1H7.5L5 13V8h5V5H7V3z"/><path d="M19.5 16.5c.9 1.3 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.6-1.9 1.5-3.2z"/><rect x="1.5" y="7.5" width="2.5" height="6" rx="1"/></g></svg>',
    search: '<svg role="img" focusable="false" viewBox="0 0 20 20"><circle cx="8.2" cy="8.2" r="5.8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12.6 12.6l5 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    ext: '<svg role="img" focusable="false" class="ext" viewBox="0 0 16 16"><path d="M7 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 1.8h4.7v4.7M14 2L7.6 8.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    upDown: '<svg role="img" focusable="false" viewBox="0 0 16 16"><path d="M4.5 14V2.5M1.8 5.2l2.7-2.7 2.7 2.7M11.5 2v11.5M8.8 10.8l2.7 2.7 2.7-2.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    swap: '<svg role="img" focusable="false" viewBox="0 0 16 16"><path d="M2 4.5h11.5M10.8 1.8l2.7 2.7-2.7 2.7M14 11.5H2.5M5.2 8.8l-2.7 2.7 2.7 2.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg role="img" focusable="false" viewBox="0 0 16 16"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    user: '<img class="pool-logo" alt="Unknown mining pool" src="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3.2" fill="#d8d8d8"/><path d="M2.2 15c.4-3.4 2.8-5.4 5.8-5.4s5.4 2 5.8 5.4z" fill="#d8d8d8"/></svg>') + '">'
  };
  function coin(color) {
    return '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="' + color + '"/><path d="M7.6 5.2v9.6M6.4 5.2h4.2a2.3 2.3 0 0 1 0 4.6H7.6M7.6 9.8h3.6a2.5 2.5 0 0 1 0 5H6.4M9 3.6v1.6M11 3.6v1.6M9 14.8v1.6M11 14.8v1.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  // The deep pool mark: a "no lifeguard on duty" style swimmer sign, in colour-blind safe orange and sky blue.
  function logo() {
    return '<svg viewBox="0 0 140 35" role="img" aria-label="deep pool">' +
      '<circle cx="17.5" cy="17.5" r="15.5" fill="#0b2a44" stroke="#e69f00" stroke-width="3"/>' +
      '<path d="M5.5 22.6c2.2-1.8 4.2-1.8 6.4 0s4.2 1.8 6.4 0 4.2-1.8 6.4 0 3.4 1.6 5.4.4M7.5 27.2c2-1.4 3.8-1.4 5.6 0s3.8 1.4 5.6 0 3.8-1.4 5.6 0" fill="none" stroke="#56b4e9" stroke-width="1.9" stroke-linecap="round"/>' +
      '<circle cx="23" cy="11.6" r="2.7" fill="#fff"/>' +
      '<path d="M9.6 19.6l5.2-4.3 3.3 2.7 3.6-2.5M14.8 15.3l2.7-4.6 4.2 1.7" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7.1 7.1l20.8 20.8" stroke="#e69f00" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="43" y="16.5" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="20.5" font-weight="500" fill="#fff" letter-spacing=".2">deep</text>' +
      '<text x="43" y="32" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="19" font-weight="500" fill="#56b4e9" letter-spacing=".2">pool</text>' +
      '</svg>';
  }
  function footerLogo() {
    function cube(x, front, top, side) {
      return '<g transform="translate(' + x + ',14)"><path d="M0 6l6-6h32l-6 6z" fill="' + top + '"/><path d="M0 6l6-6v34l-6 6z" fill="' + side + '"/><rect x="0" y="6" width="32" height="34" fill="' + front + '"/></g>';
    }
    return '<svg viewBox="0 0 220 55" role="img" aria-label="deep pool">' +
      cube(0, '#a08a0a', '#4a4330', '#2f2b20') + cube(40, '#c07a10', '#4d3f2e', '#30281e') + cube(80, '#d0580e', '#4f3a2c', '#32251c') +
      '<path d="M128 6v46" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" opacity=".6"/>' +
      cube(140, '#6a4cd8', '#2c2f4a', '#1c1e30') + cube(180, '#5a55e0', '#2c2f4a', '#1c1e30') +
      '</svg>';
  }
  var SOCIAL = [
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><path fill="currentColor" d="M10 .8a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6.9.1 1.4 1 1.4 1 .8 1.4 2.2 1 2.8.8 0-.6.3-1 .6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a8.8 8.8 0 0 1 4.7 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.2.1 2.5.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.8.6 1.6v2.4c0 .3.2.6.7.5A9.4 9.4 0 0 0 10 .8z"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><path d="M3 2.5l14 15M17 2.5L3 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><path fill="currentColor" d="M12.6 2.6c1 .2 1.6.9 1.6 1.7l-2.4 1.2 1.3 4.6c.4 1.8-.6 3.4-2.4 4l-.8 3.4H8.6l.6-3.1c-1.2-.1-2.4-.7-3.2-1.6L3 13.8l2-1.6c1.3 1 2.8 1.4 4.3 1.2 1.2-.2 1.9-1.1 1.6-2.3L9.3 5.7c-.3-1.6 1.4-3.4 3.3-3.1z"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.5 10a4.5 4.5 0 1 1-4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><rect x="1" y="4" width="18" height="12.5" rx="3.5" fill="currentColor"/><path d="M8.2 7.4v5.8l4.8-2.9z" fill="#11131f"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 2.5l3 2.5 3-2.5M6 18h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    '<svg role="img" focusable="false" viewBox="0 0 20 20"><path d="M3.5 2.5h-2v15h2M16.5 2.5h2v15h-2" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="10" y="13.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" font-family="Arial">m</text></svg>'
  ];

  // ---------- sample data (shaped like the original's start page) ----------
  function blk(height, median, lo, hi, btc, txs, minutes, pool, fullness) {
    return { height: height, median: median, range: [lo, hi], btc: btc, txs: txs, minutes: minutes, pool: pool, fullness: fullness == null ? 1 : fullness };
  }
  function mp(median, lo, hi, btc, txs, fullness, blocks) {
    return { median: median, range: [lo, hi], btc: btc, txs: txs, fullness: fullness == null ? 1 : fullness, blocks: blocks || 1 };
  }
  function moreBlocks(list, count, base) {
    var last = list[list.length - 1];
    var n = list.length;
    for (var i = n; i < count; i++) {
      var k = i - n + 1;
      list.push(blk(last.height - k, Math.round(rand() * base.maxMedian * 10) / 10, base.lo, base.hi * (0.3 + rand()),
        base.btc * (0.4 + rand()), Math.max(1, Math.round(base.txs * (0.4 + rand()))), last.minutes + k * base.gap,
        base.pools[Math.floor(rand() * base.pools.length)], base.fullness ? Math.min(1, base.fullness * (0.5 + rand())) : 1));
    }
    return list;
  }
  // transaction ids as recorded from the original's start pages
  var TXIDS = {"mainnet": ["6aec8c08762a0107c9f6102bdc1038117aed8fde08d7e8fe045050903ade5ee3", "1cc643712b757c3af2ef0f517555b8493dd3bde875603dbdf553708c32c8eeee", "4fafb0dd33879aff31e62232d382772192b0040e8af6b1d5e7526429ffa4fad0", "70dae07b35ae98737d7c0b49fc29596d09c2bd5065cfa462dc0b5e58a545dd9c", "c00d2343ad6542cef5136fc621b375d5072ffd34d5102e5103cdf7248c2b87a3", "22657323fdbd37f362b1a405be815a7354e162e334d4e0caceba03cea8c3ffc2", "9911e34caf76c85196a53ca42add7809a596f998348c869bc6473b1da4d15470", "07b1167ccf73e3a05dfadde3b30d9d54722223178c4f7ee88dbf0b7ae0ed5191", "3426bdaa1a81ccd3f75e0969b5416be6aca2bbe7f99fafb550e0eefe06cc6ec9", "6aec8c08762a0107c9f6102bdc1038117aed8fde08d7e8fe045050903ade5ee3", "dc7ed0bea447db61241eb5794e72dfc0022d64e7aa6b5f908c1f8d51d28bb0aa", "1cc643712b757c3af2ef0f517555b8493dd3bde875603dbdf553708c32c8eeee"], "signet": ["c1ec0aaa18ef5ef0e47061db15f5cf580fcd7c51120e14dcd714257a6233535e", "7c5896a5b9ecae1ef2ce2d5255aaaca1d99b512473f40b40086781b07ff5a80a", "c41986d3ceba76bb64e43989569ab83af01c7f2297121e9a3ad089db6e5e23fe", "e9606f91503d62f57e5a9875c208f8ce21ed02590785185721121fa1bfab980a", "0ee75db919220d578ab0c33f5ab2cee714012adb160e38bbe2cac52a3f4343c8", "006f387d06f95ece4542930075cc49e8a43f0eb53de4ee6f2ecb3f7189b96c27", "7dfe68cc9d0d988d3f3fd5476f0674996378a7e3d095e5cdc1ae05a0577e8324", "717e7c5cbabe709f7c4cad185dea7f2c57b23b5206107c9c777af53a475c83f0", "000b71c880795f2dcd624024f9aa30532db40f0bc06bd6a2dc5328b07a6a253a", "42727f3e2aa1a2cd0aa2cc7ccdd5aaab3d3c44336d80b3bdc6d6196122e80301", "606e167c4b87025ea8ece23775d9169b29ef5c571315ff820c5e6a3adcfb542b", "337297fdbc370054112401afb066d47adf19e3a0c11d608907b7f01b6435a3cf"], "testnet": ["2afc16eb4d0fa833057a18d7537f13068d4008f3b707fba568f8bfdc522d7aa1", "25f13e51d6f655454426e8ba6b1432bf94498ef337bcd59574a17ab6a7889ef9", "1736c8f1dd4e6e5f62efbfaa047e01f6a2ed96fcea09b9bd3b25fcec419807b2", "af128f797bf500bed60a310e1e2b25cc521ce74052e5b3f24ada63c677492b3b", "0eaa7b703d4e82a7d67d0042d0c250507c6be057b6ebd472adcc9d4f76b5fb01", "25e4da2ff1df4cd0b979adfe31dc31a64ef465ab7c5605ba5993eef2bf2078f4", "2db7a27d88084485de8d596b1504b37fc3b98998475bbec60aeb4ca9a5636277", "4431d0f6dbbba34f782f285036f9d66c0a4d923b67ce17d4c2845cc5df6ffa4a", "967fa16ee516999ddd0de85b962a8454d82da87554eb69a75c43690277ee9c8d", "9b49b5c473509497321fc692ce339c251cf5593d6ef61cdba855fd4700df1654", "ac3e82b49f8acaf60e4dea4b8222dc1d3fa4533c910376bae126a93061754a47", "21022b1385ead903406fc0c3edcc55566834cb52f5d3f5a196144fca769ac514"], "testnet4": ["debc4def6d413d6009e2b0dac44c574a6da3665c1d3246b94793659404577775", "fdb34b20dfa46430bfcb96af6a0ac0dd80fe71916d9ee1bb654a60e13cb85285", "fe2ed17da0d59f58626a3f710edf31f6d4ff7fff2b47bdf1bd3681083fab97ba", "21dbf971c44bc7edc051e9e22d8213b5f27ad63f86c92f311f69f62a751d1504", "e0d2728efa0b3abf0e2fe9f6577e0063aaa6d4d3defa74a8ddd4386a284ede3a", "f418e4f64a784242d345beb6a2cdf4f52ff4def25583dd9882889a35cbb0cdce", "95738a320a5e3ea2a53e56bcb230f935cd50fc25da3a3d05541bd9006a604424", "36135b1fdc8c9d7d7ccb85e30e6edcb2d4ef395c8040ee640d926fdaecb8484d", "4779e9db7c1ab5f13e3db495c76223f575bea9cf636af9fc1ae12ed4cf54e7c1", "a9ae1213114b63ffe3f7cb7c26144c3ff4fb18b8ae01cb6a5f58873460310448", "9945ae6fe5ba260ba399f7b85f453a1ee942ace2eb98ef8acf33d1232e6010f7", "dd876c093c5179d64ea2ab51749c61b4d5ce9ad13b04f29ae57b2605e57c9dd7"], "acc": ["8bac623118c14db766b675c1616589911e590e8537240235ca70d24b42a5d016", "e8567d15f4cc3bdbb926993ce09392d7c1b1280985a64de2ee91a1aaa44e280f", "b650d677df68a88c6eaa51fe683b0edc2ab308dce24d7fc0c786da18e62f6ade", "e0d8ecdc18a573f5a30be617d7d8a8881a93f26f61b827fa484585b85127f217", "01ff48269aa6c925cb35e3ab7a0f26c9408558e8cdd22daa01c1338699d93afc", "6cd4f28b7ef2976dd589190276a3d0bcb077afde28c2af3217f92782f8323bed"]};
  function rbfRows(rows, ids) { return rows.map(function (r, i) { return { txid: ids[i] || hex(64), prev: r[0], fee: r[1], status: r[2] || ['rbf'] }; }); }
  function txRows(rows, ids) { return rows.map(function (r, i) { return { txid: ids[6 + i] || hex(64), value: r[0], fee: r[1], usd: r[2] }; }); }

  // mined blocks as recorded from the original (height, median fee, fee range, reward, tx count, age, pool)
  var RECORDED = {"mainnet":[[975639,3,2.03,405.0,0.04,3140,"31 minutes ago","AntPool"],[975638,4,2.51,300.0,0.047,3765,"49 minutes ago","AntPool"],[975637,2,1.85,101.0,0.033,2474,"85 minutes ago","AntPool"],[975636,3,2.0,151.0,0.038,3493,"2 hours ago","SpiderPool"],[975635,0,0.12,200.0,0.005,7161,"2 hours ago","AntPool"],[975634,0,1.0,202.0,0.013,1536,"2 hours ago","Sympatheia"],[975633,1,1.0,68.3,0.011,1503,"2 hours ago","ViaBTC"],[975632,4,1.51,213.0,0.043,2610,"2 hours ago","F2Pool"],[975631,1,0.12,101.0,0.017,4496,"3 hours ago","F2Pool"],[975630,1,0.12,30.4,0.013,3548,"3 hours ago","Braiins Pool"],[975629,2,1.47,60.0,0.027,3436,"3 hours ago","Luxor"],[975628,5,3.49,521.0,0.058,2939,"3 hours ago","F2Pool"],[975627,0,0.12,60.1,0.004,7326,"4 hours ago","Foundry USA"],[975626,0,0.12,60.0,0.008,6354,"4 hours ago","MARA Pool"],[975625,1,0.12,149.0,0.025,4347,"4 hours ago","MARA Pool"],[975624,2,0.13,312.0,0.028,3508,"4 hours ago","Foundry USA"],[975623,0,0.12,100.0,0.006,6397,"5 hours ago","Foundry USA"],[975622,0,1.0,50.6,0.008,909,"5 hours ago","ViaBTC"],[975621,1,0.13,476.0,0.018,3634,"5 hours ago","ViaBTC"],[975620,2,1.0,60.2,0.018,2421,"5 hours ago","F2Pool"],[975619,3,2.01,241.0,0.031,3730,"5 hours ago","SpiderPool"],[975618,4,3.02,2010.0,0.054,3723,"5 hours ago","Foundry USA"],[975617,4,3.01,265.0,0.056,3535,"6 hours ago","ViaBTC"],[975616,1,0.92,140.0,0.024,3592,"7 hours ago","AntPool"],[975615,2,1.03,265.0,0.033,3451,"7 hours ago","Foundry USA"],[975614,2,1.2,101.0,0.027,3213,"7 hours ago","F2Pool"],[975613,4,2.33,302.0,0.066,3529,"7 hours ago","SpiderPool"],[975612,1,0.12,302.0,0.018,5145,"8 hours ago","AntPool"]],"signet":[[330637,0,0.1,149.0,0.003,119,"12 minutes ago",null],[330636,0,1.0,3900.0,0.03,514,"15 minutes ago",null],[330635,0,0.15,3900.0,0.017,98,"36 minutes ago",null],[330634,0,0.78,3900.0,0.043,296,"39 minutes ago",null],[330633,0,0.14,3900.0,0.016,70,"50 minutes ago",null],[330632,0,0.1,149.0,0.002,22,"51 minutes ago",null],[330631,0,0.2,3900.0,0.011,108,"52 minutes ago",null],[330630,0,0.1,149.0,0.002,34,"55 minutes ago",null],[330629,0,1.0,3900.0,0.035,389,"56 minutes ago",null],[330628,0,1.0,3900.0,0.035,220,"74 minutes ago",null],[330627,0,0.79,3900.0,0.036,259,"80 minutes ago",null],[330626,0,0.1,149.0,0.016,115,"90 minutes ago",null],[330625,0,0.1,3900.0,0.02,147,"2 hours ago",null],[330624,0,0.1,149.0,0.002,61,"2 hours ago",null],[330623,0,1.0,3900.0,0.018,425,"2 hours ago",null],[330622,0,1.0,3900.0,0.021,213,"2 hours ago",null],[330621,0,0.75,149.0,0.003,127,"2 hours ago",null],[330620,0,1.0,3900.0,0.033,166,"2 hours ago",null],[330619,0,0.1,4.01,0.0,18,"2 hours ago",null],[330618,0,0.94,246.0,0.004,194,"2 hours ago",null],[330617,0,0.1,3900.0,0.017,175,"2 hours ago",null],[330616,0,0.1,149.0,0.001,34,"2 hours ago",null],[330615,0,1.0,3900.0,0.02,400,"2 hours ago",null],[330614,0,0.83,3900.0,0.012,188,"3 hours ago",null],[330613,0,1.0,3900.0,0.013,282,"3 hours ago",null],[330612,0,1.0,3900.0,0.019,473,"3 hours ago",null],[330611,0,1.0,3900.0,0.019,225,"3 hours ago",null],[330610,0,0.11,17.2,0.001,101,"3 hours ago",null]],"testnet":[[5346560,0,1.0,25.2,0.0,18,"Just now",null],[5346559,0,1.01,265.0,0.002,14,"Just now",null],[5346558,0,0.0,0.0,0.0,1,"Just now",null],[5346557,0,0.0,0.0,0.0,1,"Just now",null],[5346556,0,265.0,265.0,0.0,2,"Just now",null],[5346555,0,1.51,1.51,0.0,2,"Just now",null],[5346554,0,1.01,1.01,0.0,3,"Just now",null],[5346553,0,0.0,0.0,0.0,1,"Just now",null],[5346552,0,2.0,2.0,0.0,2,"Just now",null],[5346551,0,0.0,0.0,0.0,1,"Just now",null],[5346550,0,0.0,0.0,0.0,1,"Just now",null],[5346549,0,1.0,1.51,0.0,6,"Just now",null],[5346548,0,1.0,1.0,0.0,3,"Just now",null],[5346547,0,0.0,0.0,0.0,1,"Just now",null],[5346546,0,3.43,3.85,0.0,4,"Just now",null],[5346545,0,0.0,0.0,0.0,1,"Just now",null],[5346544,0,1.0,265.0,0.003,9,"Just now",null],[5346543,0,0.0,0.0,0.0,1,"Just now",null],[5346542,0,0.0,0.0,0.0,1,"Just now",null],[5346541,0,1.01,1.01,0.0,3,"Just now",null],[5346540,0,0.0,0.0,0.0,1,"Just now",null],[5346539,0,1.01,2.01,0.0,4,"12 minutes ago",null],[5346538,0,0.0,0.0,0.0,1,"Just now",null],[5346537,0,0.0,0.0,0.0,1,"12 minutes ago",null],[5346536,0,0.0,0.0,0.0,1,"Just now",null],[5346535,0,0.0,0.0,0.0,1,"12 minutes ago",null],[5346534,0,0.0,0.0,0.0,1,"Just now",null],[5346533,0,0.0,0.0,0.0,1,"12 minutes ago",null]],"testnet4":[[161024,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161023,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161022,0,1.0,5.0,0.0,16,"Just now","SoloPool.com"],[161021,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161020,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161019,0,1.0,2.13,0.0,9,"Just now","MARA Pool"],[161018,0,1.0,1.14,0.0,5,"Just now",null],[161017,0,0.0,0.0,0.0,1,"Just now",null],[161016,0,0.0,0.0,0.0,1,"Just now",null],[161015,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161014,0,0.0,0.0,0.0,1,"Just now","SoloPool.com"],[161013,0,1.0,5.02,0.0,11,"12 minutes ago","SoloPool.com"],[161012,0,0.0,0.0,0.0,1,"Just now",null],[161011,1,1.0,3.0,0.0,31,"Just now","SoloPool.com"],[161010,0,0.5,573.0,0.002,18,"Just now","SoloPool.com"],[161009,0,0.0,0.0,0.0,1,"Just now",null],[161008,0,1.02,2.01,0.0,10,"Just now","SoloPool.com"],[161007,0,0.0,0.0,0.0,1,"13 minutes ago","SoloPool.com"],[161006,0,1.0,101.0,0.0,7,"33 minutes ago","SoloPool.com"],[161005,0,0.0,0.0,0.0,1,"12 minutes ago",null],[161004,0,101.0,101.0,0.0,2,"32 minutes ago",null],[161003,0,1.0,30.1,0.001,7,"52 minutes ago","MARA Pool"],[161002,0,0.0,0.0,0.0,1,"12 minutes ago","SoloPool.com"],[161001,0,0.0,0.0,0.0,1,"32 minutes ago","SoloPool.com"],[161000,0,0.0,0.0,0.0,1,"52 minutes ago","SoloPool.com"],[160999,0,0.5,55.3,0.001,16,"73 minutes ago","SoloPool.com"],[160998,0,0.0,0.0,0.0,1,"13 minutes ago",null],[160997,0,0.0,0.0,0.0,1,"33 minutes ago",null]],"acc":[[975639,3,2.03,405.0,0.04,3140,"32 minutes ago","AntPool"],[975638,4,2.51,300.0,0.047,3765,"50 minutes ago","AntPool"],[975637,2,1.85,101.0,0.033,2474,"86 minutes ago","AntPool"],[975636,3,2.0,151.0,0.038,3493,"2 hours ago","SpiderPool"],[975635,0,0.12,200.0,0.005,7161,"2 hours ago","AntPool"],[975634,0,1.0,202.0,0.013,1536,"2 hours ago","Sympatheia"],[975633,1,1.0,68.3,0.011,1503,"2 hours ago","ViaBTC"],[975632,4,1.51,213.0,0.043,2610,"2 hours ago","F2Pool"],[975631,1,0.12,101.0,0.017,4496,"3 hours ago","F2Pool"],[975630,1,0.12,30.4,0.013,3548,"3 hours ago","Braiins Pool"],[975629,2,1.47,60.0,0.027,3436,"3 hours ago","Luxor"],[975628,5,3.49,521.0,0.058,2939,"3 hours ago","F2Pool"],[975627,0,0.12,60.1,0.004,7326,"4 hours ago","Foundry USA"],[975626,0,0.12,60.0,0.008,6354,"4 hours ago","MARA Pool"],[975625,1,0.12,149.0,0.025,4347,"4 hours ago","MARA Pool"],[975624,2,0.13,312.0,0.028,3508,"4 hours ago","Foundry USA"],[975623,0,0.12,100.0,0.006,6397,"5 hours ago","Foundry USA"],[975622,0,1.0,50.6,0.008,909,"5 hours ago","ViaBTC"],[975621,1,0.13,476.0,0.018,3634,"5 hours ago","ViaBTC"],[975620,2,1.0,60.2,0.018,2421,"5 hours ago","F2Pool"],[975619,3,2.01,241.0,0.031,3730,"5 hours ago","SpiderPool"],[975618,4,3.02,2010.0,0.054,3723,"5 hours ago","Foundry USA"],[975617,4,3.01,265.0,0.056,3535,"6 hours ago","ViaBTC"],[975616,1,0.92,140.0,0.024,3592,"7 hours ago","AntPool"],[975615,2,1.03,265.0,0.033,3451,"7 hours ago","Foundry USA"],[975614,2,1.2,101.0,0.027,3213,"7 hours ago","F2Pool"],[975613,4,2.33,302.0,0.066,3529,"7 hours ago","SpiderPool"],[975612,1,0.12,302.0,0.018,5145,"8 hours ago","AntPool"]]};
  function ageMinutes(text) {
    var m = /(\d+) (minute|hour|day)/.exec(text);
    if (!m) return 0;
    return +m[1] * { minute: 1, hour: 60, day: 1440 }[m[2]];
  }
  function recordedBlocks(key, fullBlocks) {
    return RECORDED[key].map(function (r) {
      var b = blk(r[0], r[1], r[2], r[3], r[4], r[5], 0, r[7], fullBlocks ? 1 : Math.max(0.01, Math.min(1, r[5] / 3000)));
      b.ageText = r[6];
      b.minutes = ageMinutes(r[6]);
      return b;
    });
  }
  var S = {};
  S.mainnet = {
    mempool: [mp(4, 3.01, 505, 0.058, 3460), mp(2, 1.77, 3.01, 0.022, 2294), mp(1, 1.00, 1.77, 0.012, 1461), mp(1, 0.12, 1.00, 0.006, 2594),
      mp(0, 0.12, 0.13, 0.001, 7922), mp(0, 0.12, 0.12, 0.001, 7984), mp(0, 0.12, 0.12, 0.001, 4819), mp(0, 0.10, 0.12, 0.03, 40389, 1, 27)],
    blocks: recordedBlocks(page === 'acceleration' ? 'acc' : 'mainnet', true),
    fees: [0.2, 2.17, 3.41, 4.86],
    difficulty: { avg: 10.9, change: -8.43, prev: 5.54, remaining: 'In ~19 hours', date: 'November 14 at 5:23 AM', progress: 94.8, ahead: -5.2, height: 975639 },
    info: { minFee: 0.10, usage: 183e6, max: 300e6, count: 70925 },
    chart: { max: 2409, base: 860, spread: 260, spikes: [[0.01, 2409], [0.26, 2050], [0.63, 2409], [0.76, 1900]] },
    replacements: rbfRows([[3.01, 4.12], [3.27, 4.35], [1.83, 3.52], [1.84, 3.52], [1.82, 3.53], [1.84, 3.52]], TXIDS.mainnet),
    recent: txRows([[0.1736, 11.3, 12003], [1.469, 5.01, 101538], [0.0145, 4.00, 999.79], [0.0111, 4.12, 766.51], [0.0612, 6.03, 4233], [0.0346, 4.35, 2392]], TXIDS.mainnet),
    price: 69141
  };
  S.signet = {
    eta0: 9.5,
    mempool: [mp(0, 0.97, 30.2, 0.005, 317, 0.1)],
    blocks: recordedBlocks('signet', false),
    fees: [0.1, 0.1, 0.5, 1],
    difficulty: { avg: 7.7, change: 1.73, prev: -0.88, remaining: 'In ~13 days', date: 'November 27', progress: 0.4, ahead: 0.4, height: 330637 },
    info: { minFee: 0.10, usage: 899e3, max: 300e6, count: 317 },
    chart: { base: 380, spread: 120, spikes: [[0.17, 760], [0.92, 700]] },
    replacements: rbfRows([[1.35, 1.44], [0.44, 0.51], [32.0, 32.1, ['mined', 'rbf']], [0.11, 0.20, ['mined', 'rbf']], [1.17, 27.8], [0.20, 0.28]], TXIDS.signet),
    recent: txRows([[0.0011, 2.00], [0.001, 2.00], [0.00, 4.01], [0.0682, 2.00], [0.0683, 2.00], [1.00, 3.63]], TXIDS.signet),
    price: 0
  };
  S.testnet = {
    eta0: 3.5,
    mempool: [mp(0, 0.10, 133, 0.00, 27, 0.08)],
    blocks: recordedBlocks('testnet', false),
    fees: [0.1, 0.1, 0.5, 1],
    difficulty: { avg: 2.3, change: 172.83, prev: 300.00, remaining: 'In ~4 days', date: 'November 18', progress: 1.4, ahead: 5.2, height: 5346560 },
    info: { minFee: 0.10, usage: 35.8e3, max: 300e6, count: 27 },
    chart: { base: 8, spread: 6, spikes: [] },
    replacements: rbfRows([[1.43, 302], [1.01, 2.53], [37.0, 37.1], [1.00, 5.03], [6.13, 9.19, ['mined', 'rbf']], [2.01, 3.27, ['full-rbf']]], TXIDS.testnet),
    recent: txRows([[7.6016, 2.01], [0.0028, 1.00], [0.8468, 1.01], [0.8469, 1.00], [0.0002, 1.20], [0.847, 1.01]], TXIDS.testnet),
    price: 0
  };
  S.testnet4 = {
    eta0: 5.5,
    mempool: [mp(0, 0.50, 30.1, 0.00, 17, 0.06)],
    blocks: recordedBlocks('testnet4', false),
    fees: [0.1, 0.1, 0.5, 1],
    difficulty: { avg: 5.9, change: 68.36, prev: -6.20, remaining: 'In ~25 hours', date: 'November 14 at 11:37 AM', progress: 51.5, ahead: 35.5, height: 161024 },
    info: { minFee: 0.10, usage: 44.3e3, max: 300e6, count: 17 },
    chart: { base: 9, spread: 7, spikes: [[0.62, 40]] },
    replacements: rbfRows([[363, 573], [363, 572], [363, 573], [4.01, 5.01, ['mined', 'rbf']], [363, 573], [364, 573]], TXIDS.testnet4),
    recent: txRows([[642.977, 0.50], [49.9636, 2.01], [0.0031, 1.00], [0.0011, 0.68], [0.0121, 1.15], [49.7937, 2.01]], TXIDS.testnet4),
    price: 0
  };
  if (page === 'acceleration') {
    S.mainnet.mempool = [mp(4, 3.02, 505, 0.059, 3365), mp(2, 1.69, 3.02, 0.022, 2381), mp(1, 1.01, 1.85, 0.013, 1378), mp(1, 0.12, 1.01, 0.006, 2473),
      mp(0, 0.12, 0.13, 0.001, 7922), mp(0, 0.12, 0.12, 0.001, 7984), mp(0, 0.12, 0.12, 0.001, 5346), mp(0, 0.10, 0.12, 0.031, 40209, 1, 27)];
  }
  var D = S[net];
  D.minutesBase = Date.now();
  var ACC = {
    active: { requests: 0, avgBid: 0, vsize: 0 },
    stats: {
      '24h': { requests: 22, boost: 0.0000545, vsize: '10.8', vunit: 'kvB', share: '0.01%' },
      '1m': { requests: 734, boost: 0.0211, vsize: '388', vunit: 'kvB', share: '0.01%' },
      '1y': { requests: 9416, boost: 0.3874, vsize: '4.62', vunit: 'MvB', share: '0.01%' },
      'all': { requests: 15208, boost: 0.6921, vsize: '7.35', vunit: 'MvB', share: '0.01%' }
    },
    recent: [[199, 975639, 'Completed'], [921, 975628, 'Completed'], [408, 975628, 'Completed'], [2252, 975628, 'Completed'], [0, 975617, 'Mined'], [0, 975614, 'Completed']]
      .map(function (r, i) { return { txid: TXIDS.acc[i], boost: r[0], block: r[1], status: r[2] }; })
  };

  // ---------- settings ----------
  var settings = {
    currency: store('currency') || 'USD',
    denomination: store('denomination') || 'BTC',
    theme: ['wiz', 'bluematt', 'softsimon', 'nymkappa', 'contrast'].indexOf(store('theme')) >= 0 ? store('theme') : 'wiz',
    timezone: store('timezone') || 'local',
    timeLtr: store('timeLtr') === '1',
    sizeView: false,
    goggles: 'All',
    widget: 'difficulty',
    accWindow: '24h'
  };
  var RATES = { USD: 1, EUR: 0.86, GBP: 0.76, CAD: 1.40, CHF: 0.80, AUD: 1.53, JPY: 154 };
  var SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', CHF: 'CHF ', AUD: 'A$', JPY: '¥' };
  function fiat(btc) {
    var rate = D.rates && D.rates[settings.currency] ? D.rates[settings.currency] / (D.rates.USD || 1) : RATES[settings.currency];
    var v = btc * (D.price || 0) * rate;
    var sym = SYMBOLS[settings.currency];
    if (settings.currency === 'JPY' || v >= 1000) return sym + commas(v);
    return sym + v.toFixed(2);
  }

  function usdFmt(v) { return '$' + (v >= 1000 ? commas(v) : v.toFixed(2)); }

  // ---------- header ----------
  var NAV = {
    mainnet: [['gauge', '/', 'Dashboard'], ['rocket', '/acceleration', 'Accelerator'], ['pickaxe', '#mining', 'Mining'], ['bolt', '#lightning', 'Lightning'], ['chart', '#graphs', 'Graphs'], ['layers', '#enterprise', 'Services'], ['info', '#about', 'About']],
    signet: [['gauge', '/signet', 'Dashboard'], ['pickaxe', '#mining', 'Mining'], ['bolt', '#lightning', 'Lightning'], ['chart', '#graphs', 'Graphs'], ['layers', '#docs', 'Documentation'], ['info', '#about', 'About']],
    testnet: [['gauge', '/testnet', 'Dashboard'], ['pickaxe', '#mining', 'Mining'], ['bolt', '#lightning', 'Lightning'], ['chart', '#graphs', 'Graphs'], ['layers', '#docs', 'Documentation'], ['info', '#about', 'About']],
    testnet4: [['gauge', '/testnet4', 'Dashboard'], ['pickaxe', '#mining', 'Mining'], ['chart', '#graphs', 'Graphs'], ['faucet', '#faucet', 'Faucet'], ['layers', '#docs', 'Documentation'], ['info', '#about', 'About']]
  };
  function header() {
    var activeHref = page === 'acceleration' ? '/acceleration' : (netPrefix || '/');
    var items = NAV[net].map(function (n) {
      return '<li class="nav-item' + (n[1] === activeHref ? ' active' : '') + '"><a class="nav-link" href="' + L(n[1]) + '" title="' + n[2] + '" aria-label="' + n[2] + '"><span class="svg-wrapper">' + I[n[0]] + '</span></a></li>';
    }).join('');
    var menu = NETWORKS.map(function (n) {
      var href = L(n === 'mainnet' ? '/' : '/' + n);
      return '<a href="' + href + '" role="menuitem" class="' + (n === net ? 'active' : '') + '">' + coin(NET_COLOR[n]) + NET_LABEL[n] + '</a>';
    }).join('');
    return '<header class="sticky-header"><nav class="navbar" aria-label="Main">' +
      '<a class="brand" href="' + L(netPrefix || '/') + '" aria-label="deep pool home">' + logo() + '</a>' +
      '<div class="net-dropdown"><button class="net-toggle" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Select network. Current: ' + NET_LABEL[net] + '" title="Select network. Current: ' + NET_LABEL[net] + '">' + coin(NET_COLOR[net]) + '<span class="caret"></span></button>' +
      '<div class="net-menu" role="menu">' + menu + '</div></div>' +
      '<ul class="navbar-nav">' + items + '</ul>' +
      '<div class="search-form-container"><form class="search" role="search" autocomplete="off"><input type="text" aria-label="Search" placeholder="Explore the full Bitcoin ecosystem"><button type="submit" aria-label="Search">' + I.search + '</button></form></div>' +
      '</nav></header>';
  }
  function sidenav() {
    var links = NAV[net].map(function (n) { return '<a href="' + L(n[1]) + '" tabindex="-1">' + n[2] + '</a>'; }).join('');
    return '<div class="sidenav" aria-hidden="true"><nav class="scrollable" aria-label="Side menu">' + links + '</nav></div>';
  }
  function alertBanner() {
    if (net === 'mainnet') return '';
    if (store('alert-' + net) === 'closed') return '';
    var text = 'This is a test network. Coins have no value.';
    if (net === 'testnet') text += '<br>Testnet3 is deprecated, and will soon be replaced by <a href="' + L('/testnet4') + '">Testnet4</a>';
    return '<div class="net-alert" role="alert">' + text + '<button class="close" type="button" aria-label="Close">' + I.close + '</button></div>';
  }

  // ---------- blockchain strip ----------
  var drag = { offset: 0 };
  function mempoolBlockStyle(b) {
    // left edge: the cheapest fee in the block; right edge: the fees most of it pays
    var lo = feeColor(b.range[0]);
    var hi = feeColor(b.fullness < 1 ? Math.min(b.range[1], 8) : Math.max(b.median, b.range[0]) * 2.5);
    if (b.fullness >= 1) return 'background:linear-gradient(to right,' + lo + ',' + hi + ')';
    var e = Math.round((1 - b.fullness) * 100);
    return 'background:linear-gradient(to right,var(--mempool-block-empty) ' + e + '%,' + lo + ' ' + e + '%,' + hi + ' 100%)';
  }
  function minedBlockStyle(b) {
    var e = Math.round((1 - Math.min(1, b.fullness)) * 100);
    return 'background:linear-gradient(var(--mined-empty) ' + e + '%,var(--mined-top) ' + e + '%,var(--mined-bottom) 100%)';
  }
  function poolBadge(name) {
    if (!name) return '<a href="#mining" data-section="Mining pool pages">' + I.user + 'Unknown</a>';
    var palette = ['#009e73', '#e69f00', '#56b4e9', '#cc79a7', '#0072b2', '#f0e442', '#d55e00'];
    var known = { AntPool: '#14a37f', SpiderPool: '#f4b400', 'Foundry USA': '#ff8c00', F2Pool: '#2f6fdf', ViaBTC: '#f5a623',
      'MARA Pool': '#1d4ed8', Luxor: '#bdbdbd', 'Braiins Pool': '#e53935', Sympatheia: '#00bcd4', 'SoloPool.com': '#3b82f6' };
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    if (known[name]) { palette = [known[name]]; h = 0; }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="7.5" fill="' + palette[h % palette.length] + '"/><text x="7.5" y="11" text-anchor="middle" font-size="9.5" font-weight="700" fill="#11131f" font-family="Arial">' + esc(name.charAt(0).toUpperCase()) + '</text></svg>';
    var mark = '<img class="pool-logo" alt="Logo of ' + esc(name) + ' mining pool" src="data:image/svg+xml,' + encodeURIComponent(svg) + '">';
    return '<a href="#mining" data-section="Mining pool pages">' + mark + esc(name) + '</a>';
  }
  function avgMinutes() { return D.difficulty.avg || 10; }
  function blockBody(b, size, when) {
    return '<div class="block-body"><div class="fees">~' + Math.round(b.median) + ' sat/vB</div>' +
      '<div class="fee-span">' + feeFmt(b.range[0]) + ' - ' + feeFmt(b.range[1]) + ' sat/vB</div>' +
      '<div class="block-size">' + size + '</div><div class="transaction-count">' + commas(b.txs) + ' transaction' + (b.txs === 1 ? '' : 's') + '</div>' +
      '<div class="time-difference">' + when + '</div></div>';
  }
  var MEMPOOL_SPAN = 1400; // the waiting blocks sit in a box that spans the left side of the strip
  function blockchain() {
    var mempool = D.mempool.map(function (b, i) {
      var eta = (D.eta0 && !D.live ? D.eta0 - avgMinutes() : 0) + avgMinutes() * (i + 1);
      var when = b.blocks > 1 ? '(' + b.blocks + ' blocks)' : 'In ~' + Math.max(1, Math.floor(eta)) + ' minutes';
      var size = settings.sizeView ? ((b.vsize || b.fullness * 1e6) / 1e6).toFixed(2) + ' MvB' : btcFmt(b.btc) + ' ' + unit;
      var on = selected && selected.kind === 'projected' && +selected.id === i;
      return '<div class="bitcoin-block mempool-block' + (on ? ' selected' : '') + '" style="left:' + (MEMPOOL_SPAN - 165 - 155 * i) + 'px;' + mempoolBlockStyle(b) + '">' + (on ? '<div class="spotlight"></div>' : '') +
        '<a class="block-link" href="#mempool-block-' + i + '" aria-label="Projected block ' + (i + 1) + '">' + blockBody(b, size, when) + '</a></div>';
    }).join('');
    var now = Date.now();
    var mined = D.blocks.map(function (b, i) {
      var minutes = b.timestamp ? (now - b.timestamp * 1000) / 60000 : b.minutes + (now - D.minutesBase) / 60000;
      var size = settings.sizeView ? ((b.size || b.fullness * 1.6e6) / 1e6).toFixed(2) + ' MB' : btcFmt(b.btc) + ' ' + unit;
      var on = selected && selected.kind === 'block' && String(selected.id) === String(b.height);
      return '<div class="bitcoin-block mined-block' + (on ? ' selected' : '') + '" data-height="' + b.height + '" style="left:' + (40 + 155 * i) + 'px;' + minedBlockStyle(b) + '">' + (on ? '<div class="spotlight"></div>' : '') +
        '<div class="block-height"><a href="#block-' + b.height + '">' + b.height + '</a></div>' +
        '<a class="block-link" href="#block-' + b.height + '" aria-label="Block ' + b.height + '">' + blockBody(b, size, b.ageText && !D.live ? b.ageText : ago(minutes)) + '</a>' +
        '<div class="pool-badge">' + poolBadge(b.pool) + '</div></div>';
    }).join('');
    var dash = '<svg class="dash" width="2" height="200"><line x1="1" y1="5" x2="1" y2="200" stroke="#fff" stroke-width="2" stroke-dasharray="13 11"/></svg>';
    return '<div class="blocks-wrapper"><div class="mempool-blocks-container">' + mempool + '</div><div class="blocks-container">' + mined + '</div></div>' +
      '<div id="divider">' + dash + '</div>' +
      '<button class="block-display-toggle" type="button" title="Show ' + (settings.sizeView ? 'fees' : 'sizes') + '" aria-label="Toggle block details">' + I.upDown + '</button>' +
      '<button class="time-toggle" type="button" title="Flip time direction" aria-label="Flip time direction">' + I.swap + '</button>';
  }
  function dividerX() {
    var w = document.documentElement.clientWidth;
    return (w >= 768 ? Math.round(w / 2) : w - 18) + drag.offset;
  }
  function renderBlockchain() {
    var wrap = document.getElementById('blockchain');
    if (!wrap) return;
    wrap.classList.toggle('time-ltr', settings.timeLtr);
    var pc = wrap.querySelector('.position-container');
    pc.innerHTML = blockchain();
    pc.style.left = dividerX() + 'px';
    updateReset();
  }
  function updateReset() {
    var btn = document.getElementById('reset-scroll');
    if (btn) btn.classList.toggle('hidden', Math.abs(drag.offset) < 20);
  }

  // ---------- dashboard cards ----------
  function feeShown(v) {
    if (v < 1) return (Math.round(v * 10) / 10).toString();
    return Math.round(v).toString();
  }
  function feeCard() {
    var f = D.fees, labels = ['No Priority', 'Low Priority', 'Medium Priority', 'High Priority'];
    var items = f.map(function (v) {
      return '<div class="item"><div class="card-text"><div class="fee-text">' + feeShown(v) + ' <span class="unit">sat/vB</span></div>' +
        '<span class="fiat">' + fiat(v * 140 / 1e8) + '</span></div></div>';
    }).join('');
    return '<div class="col card-wrapper"><div class="main-title">Transaction Fees</div><div class="card"><div class="card-body">' +
      '<div class="fee-bands"><div class="fee-progress-bar nopriority" style="background:' + feeColor(f[0]) + '"><span class="fee-label">' + labels[0] + '</span></div>' +
      '<div class="band-separator"></div>' +
      '<div class="fee-progress-bar priority" style="background:linear-gradient(to right,' + feeColor(f[1]) + ',' + feeColor(f[2]) + ',' + feeColor(f[3]) + ')">' +
      '<span class="fee-label">' + labels[1] + '</span><span class="fee-label">' + labels[2] + '</span><span class="fee-label">' + labels[3] + '</span></div></div>' +
      '<div class="fee-estimation-container">' + items + '</div></div></div></div>';
  }
  function signed(v, small) {
    var up = v >= 0;
    return '<span class="' + (up ? 'up' : 'down') + '"><span class="sign' + (small ? ' small' : '') + '" aria-label="' + (up ? 'up' : 'down') + '">' + (up ? '&#9650;' : '&#9660;') + '</span>' + Math.abs(v).toFixed(2) + '</span>';
  }
  function difficultyBody() {
    var d = D.difficulty;
    if (settings.widget === 'halving') {
      var next = Math.ceil((d.height + 1) / 210000) * 210000, left = next - d.height;
      var pct = 100 - left / 2100;
      var days = left * avgMinutes() / 1440;
      var when = new Date(Date.now() + days * 864e5);
      return '<div class="epoch-progress halving"><div class="seg mined" style="width:' + pct.toFixed(2) + '%"></div><span class="label">' + pct.toFixed(2) + '% complete</span></div>' +
        '<div class="difficulty-stats"><div class="item first"><div class="card-text bigger">' + commas(left) + '</div><div class="shared-block">blocks remaining</div></div>' +
        '<div class="item"><div class="card-text bigger">' + (days > 400 ? 'In ~' + (days / 365).toFixed(1) + ' years' : 'In ~' + Math.round(days) + ' days') + '</div>' +
        '<div class="shared-block">' + when.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div></div></div>';
    }
    var segs = '<div class="seg mined" style="width:' + d.progress + '%"></div>';
    if (d.ahead > 0) segs += '<div class="seg ahead" style="left:' + d.progress + '%;width:' + d.ahead + '%"></div>';
    if (d.ahead < 0) segs += '<div class="seg behind" style="left:' + d.progress + '%;width:' + (-d.ahead) + '%"></div>';
    return '<div class="epoch-progress" title="' + d.progress.toFixed(1) + '% of this difficulty period">' + segs + '</div>' +
      '<div class="difficulty-stats">' +
      '<div class="item first"><div class="card-text bigger">~' + d.avg.toFixed(1) + ' minutes</div><div class="shared-block">Average block time</div></div>' +
      '<div class="item"><div class="card-text bigger">' + signed(d.change) + ' <span class="pct">%</span></div><div class="shared-block">Previous: ' + signed(d.prev, true) + ' <span class="pct" style="font-size:12px">%</span></div></div>' +
      '<div class="item"><div class="card-text bigger">' + d.remaining + '</div><div class="shared-block">' + d.date + '</div></div></div>';
  }
  function difficultyCard() {
    var dOn = settings.widget === 'difficulty';
    return '<div class="col card-wrapper diff"><div class="main-title">' + (dOn ? 'Difficulty Adjustment' : 'Halving Countdown') + '</div>' +
      '<div class="card"><div class="widget-toggler"><a href="#" data-widget="difficulty" class="' + (dOn ? 'inactive' : '') + '">difficulty</a><span class="sep">|</span><a href="#" data-widget="halving" class="' + (dOn ? '' : 'inactive') + '">halving</a></div>' +
      '<div class="card-body">' + difficultyBody() + '</div></div></div>';
  }
  function gogglesCard(title, withFilters) {
    var filters = withFilters ? '<div class="btn-group goggles-filter" role="radiogroup" aria-label="Goggles filter">' + ['All', 'Consolidation', 'Coinjoin', 'Data'].map(function (f, i) {
      return '<input type="radio" name="goggles" id="goggles-' + i + '" value="' + f + '" data-goggles="' + f + '"' + (settings.goggles === f ? ' checked' : '') + '><label for="goggles-' + i + '">' + f + '</label>';
    }).join('') + '</div>' : '';
    return '<div class="col"><div class="card graph-card goggles-card' + (withFilters ? '' : ' no-filters') + (settings.gogglesOpen ? ' has-open' : '') + '"><div class="card-body">' +
      '<a class="title-link mb-0" href="#goggles">' + title + (withFilters ? ' : ' + settings.goggles : '') + I.ext + '</a>' +
      filters + '<button type="button" class="goggles-show" aria-expanded="' + !!settings.gogglesOpen + '">' + (settings.gogglesOpen ? 'Hide heatmap' : 'Show heatmap') + '</button>' +
      '<div class="goggles-canvas' + (settings.gogglesOpen ? ' open' : '') + '"></div></div></div></div>';
  }
  function sizeFmt(bytes) {
    if (bytes >= 1e6) return Math.round(bytes / 1e6) + ' MB';
    return (bytes / 1e3).toFixed(bytes >= 1e5 ? 0 : 1) + ' kB';
  }
  function mempoolInfoCard() {
    var m = D.info, pct = Math.max(0.3, m.usage / m.max * 100);
    return '<div class="col"><div class="card graph-card"><div class="card-body">' +
      '<div class="mempool-info-data">' +
      '<div class="item"><h5 class="card-title">Minimum fee</h5><p class="card-text">' + m.minFee.toFixed(2) + ' <span class="unit">sat/vB</span></p></div>' +
      '<div class="item bar"><h5 class="card-title">Memory Usage</h5><div class="progress"><div class="progress-bar" style="width:' + pct.toFixed(2) + '%"></div><span class="progress-label">' + sizeFmt(m.usage) + ' / ' + sizeFmt(m.max) + '</span></div></div>' +
      '<div class="item count"><h5 class="card-title">Unconfirmed</h5><p class="card-text">' + commas(m.count) + ' <span class="unit">TXs</span></p></div>' +
      '</div><h5 class="card-title chart-title"><a href="#graphs" style="color:inherit">Incoming Transactions</a></h5>' +
      '<div class="mempool-graph" id="incoming-chart"></div></div></div></div>';
  }
  function trunc(txid) {
    return '<a class="truncate" href="#tx-' + txid + '" title="' + txid + '"><span class="first">' + txid.slice(0, -5) + '</span><span class="last">' + txid.slice(-5) + '</span><span class="hidden-content">' + txid + '</span></a>';
  }
  function feeCell(v) { return feeFmt(v) + ' <span class="symbol">sat/vB</span>'; }
  function replacementsCard() {
    var names = { rbf: 'RBF', mined: 'Mined', 'full-rbf': 'Full RBF' };
    var rows = D.replacements.slice(0, 6).map(function (r) {
      var badges = r.status.map(function (s) { return '<span class="badge ' + s + '">' + names[s] + '</span>'; }).join('');
      return '<tr><td class="txid">' + trunc(r.txid) + '</td><td class="col-old end">' + feeCell(r.prev) + '</td><td class="col-new end">' + feeCell(r.fee) + '</td><td class="col-status end">' + badges + '</td></tr>';
    }).join('');
    return '<div class="col"><div class="card"><div class="card-body">' +
      '<a class="title-link" href="#rbf">Recent Replacements' + I.ext + '</a>' +
      '<table class="table replacements"><thead><tr><th class="txid">TXID</th><th class="col-old end">Previous fee</th><th class="col-new end">New fee</th><th class="col-status end">Status</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div></div></div>';
  }
  function amountCell(v) {
    if (settings.denomination === 'sats') return commas(v * 1e8) + ' <span class="symbol">sats</span>';
    if (settings.denomination === 'Fiat' && D.price) return '<span class="fiat">' + fiat(v) + '</span>';
    return amountFmt(v) + ' <span class="symbol">' + unit + '</span>';
  }
  function recentCard() {
    var hasFiat = net === 'mainnet';
    var rows = D.recent.slice(0, 6).map(function (r) {
      return '<tr><td class="txid">' + trunc(r.txid) + '</td>' + (hasFiat ? '<td class="col-fiat end"><span class="fiat">' + (r.usd && settings.currency === 'USD' ? usdFmt(r.usd) : fiat(r.value)) + '</span></td>' : '') +
        '<td class="col-amount end">' + amountCell(r.value) + '</td><td class="col-fee end">' + feeCell(r.fee) + '</td></tr>';
    }).join('');
    return '<div class="col"><div class="card recent-card"><div class="card-body">' +
      '<a class="title-link" href="#txs">Recent Transactions' + I.ext + '</a>' +
      '<table class="table recent"><thead><tr><th class="txid">TXID</th>' + (hasFiat ? '<th class="col-fiat end">' + settings.currency + '</th>' : '') +
      '<th class="col-amount end">Amount</th><th class="col-fee end">Fee</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div></div></div>';
  }
  function dashboard() {
    return '<div class="container-xl dashboard-container"><div class="row">' +
      feeCard() + difficultyCard() + gogglesCard('Pool Goggles', true) + mempoolInfoCard() + replacementsCard() + recentCard() +
      '</div></div>';
  }

  // ---------- acceleration page ----------
  function accStatsBody() {
    var s = ACC.stats[settings.accWindow];
    return '<div class="item"><h5 class="card-title">Requests</h5><div class="card-text">' + commas(s.requests) + '</div><div class="sub">accelerated</div></div>' +
      '<div class="item"><h5 class="card-title">Total Bid Boost</h5><div class="card-text">' + s.boost.toFixed(4) + ' <span class="unit">BTC</span></div><div class="sub fiat">' + fiat(s.boost) + '</div></div>' +
      '<div class="item third"><h5 class="card-title">Total vSize</h5><div class="card-text">' + s.vsize + ' <span class="unit">' + s.vunit + '</span></div><div class="sub">' + s.share + ' of blocks</div></div>';
  }
  function accelerationPage() {
    var a = ACC.active;
    var labels = { '24h': '1 day', '1m': '1 month', '1y': '1 year', all: 'all time' };
    var windows = ['24h', '1m', '1y', 'all'].map(function (w) {
      return '<a href="#" data-acc="' + w + '" class="' + (settings.accWindow === w ? 'inactive' : '') + '">' + w + '</a>';
    }).join('<span class="sep">|</span>');
    var rows = ACC.recent.map(function (r) {
      return '<tr><td class="txid">' + trunc(r.txid) + '</td><td class="col-boost end">' + commas(r.boost) + ' <span class="symbol">sats</span></td>' +
        '<td class="col-block end"><a href="#block-' + r.block + '">' + r.block + '</a></td>' +
        '<td class="col-status end"><span class="badge ' + r.status.toLowerCase() + '">' + r.status + '</span></td></tr>';
    }).join('');
    return '<div class="container-xl dashboard-container"><div class="row">' +
      '<div class="col card-wrapper acc"><div class="main-title">Active Accelerations</div><div class="card"><div class="card-body"><div class="acc-stats">' +
      '<div class="item"><h5 class="card-title">Requests</h5><div class="card-text">' + a.requests + '</div><div class="sub">pending</div></div>' +
      '<div class="item"><h5 class="card-title">Avg Max Bid</h5><div class="card-text">' + a.avgBid.toFixed(4) + ' <span class="unit">BTC</span></div><div class="sub fiat">' + fiat(a.avgBid) + '</div></div>' +
      '<div class="item third"><h5 class="card-title">Total vSize</h5><div class="card-text">' + a.vsize + ' <span class="unit">vB</span></div><div class="sub">0.00% of block</div></div>' +
      '</div></div></div></div>' +
      '<div class="col card-wrapper acc"><div class="main-title">Acceleration stats&nbsp; <span style="text-transform:none;font-size:8px;color:var(--transparent-fg)">(' + labels[settings.accWindow] + ')</span></div>' +
      '<div class="card"><div class="widget-toggler">' + windows + '</div><div class="card-body"><div class="acc-stats">' + accStatsBody() + '</div></div></div></div>' +
      gogglesCard('Pool Goggles : Accelerations', false) +
      '<div class="col"><div class="card graph-card"><div class="card-body" style="display:flex;flex-direction:column">' +
      '<h5 class="card-title" style="margin-bottom:4px">Historical Trend</h5><div class="trend-chart" id="trend-chart"></div>' +
      '<div><a class="view-more" href="#accelerator">View more &raquo;</a></div></div></div></div>' +
      '<div class="col"><div class="card acc-empty"><div class="card-body" style="display:flex;flex-direction:column">' +
      '<h5 class="card-title" style="line-height:1.5;margin-bottom:10px">Active Accelerations</h5><div class="empty-note">There are no active accelerations</div></div></div></div>' +
      '<div class="col"><div class="card"><div class="card-body"><a class="title-link" href="#accelerations">Recent Accelerations' + I.ext + '</a>' +
      '<table class="table acc-table"><thead><tr><th class="txid">TXID</th><th class="col-boost end">Bid Boost</th><th class="col-block end">Block</th><th class="col-status end">Status</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div></div></div>' +
      '</div></div>';
  }

  // ---------- charts ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function getVar(n) { return getComputedStyle(document.body).getPropertyValue(n).trim() || '#56b4e9'; }
  function el(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function incomingSeries() {
    if (D.stats && D.stats.length > 10) return D.stats;
    if (D.series) return D.series;
    var r = seeded({ mainnet: 5, signet: 9, testnet: 13, testnet4: 17 }[net]);
    var c = D.chart, pts = [], n = 80, end = Date.UTC(2026, 10, 13, 7, 17);
    for (var i = 0; i < n; i++) {
      var v = c.base + (r() - 0.5) * 2 * c.spread;
      if (r() < 0.12) v = c.base - c.spread * 1.3;
      c.spikes.forEach(function (s) {
        var d = Math.abs(i / (n - 1) - s[0]) * n;
        if (d < 2.5) v = Math.max(v, s[1] - d * (s[1] - c.base) / 2.6);
      });
      pts.push({ t: end - (n - 1 - i) * 90000, v: Math.max(0, v) });
    }
    D.series = pts;
    return pts;
  }
  function timeLabel(t) {
    var opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (settings.timezone !== 'local') opts.timeZone = settings.timezone;
    return new Date(t).toLocaleTimeString('en-GB', opts);
  }
  function drawIncoming() {
    var box = document.getElementById('incoming-chart');
    if (!box) return;
    box.innerHTML = '';
    var W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    var pts = incomingSeries();
    var maxV = 0;
    pts.forEach(function (p) { maxV = Math.max(maxV, p.v); });
    var full = 1667, top, step;
    if (D.chart.max) maxV = Math.max(maxV, D.chart.max);
    if (maxV <= 1800) { top = 1800; step = 300; } else { top = Math.ceil(maxV); step = 500; }
    var narrow = W < 400;
    var L = narrow ? 50 : 55, R = W - (narrow ? 22 : 16), T = H < 300 ? 31 : 23, B = H - 46;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Incoming transactions, virtual bytes per second' });
    function y(v) { return B - (v / top) * (B - T); }
    var ticks = [];
    for (var v = 0; v < top; v += step) ticks.push(v);
    ticks.push(top);
    ticks.forEach(function (v) {
      svg.appendChild(el('line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: v === 0 ? '#6e7079' : '#ffffff22', 'stroke-dasharray': v === 0 ? 'none' : '1 3' }));
      svg.appendChild(el('text', { x: L - 12, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'sans-serif', fill: '#ffffffaa' }, String(Math.round(v))));
    });
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    function x(t) { return L + (t - t0) / (t1 - t0) * (R - L); }
    var q = (R - L) / ((t1 - t0) / 9e5) < 48 ? 30 * 60000 : 15 * 60000;
    for (var t = Math.ceil(t0 / q) * q; t <= t1; t += q) {
      var lab = timeLabel(t), hour = /:00$/.test(lab);
      svg.appendChild(el('line', { x1: x(t), x2: x(t), y1: B, y2: B + 4, stroke: '#6e7079' }));
      svg.appendChild(el('text', { x: x(t), y: B + 30, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'sans-serif', 'font-weight': hour ? 'bold' : 'normal', fill: hour ? '#ffffffdd' : '#ffffffaa' }, lab));
    }
    var defs = el('defs', {});
    var grad = el('linearGradient', { id: 'inc-grad', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: y(top), y2: y(0) });
    var cut = Math.max(0, Math.min(1, (y(full) - y(top)) / (y(0) - y(top))));
    var hi = getVar('--chart-high'), lo = getVar('--chart-low');
    [[0, hi], [cut, hi], [cut, lo], [1, lo]].forEach(function (s) { grad.appendChild(el('stop', { offset: s[0], 'stop-color': s[1] })); });
    defs.appendChild(grad);
    svg.appendChild(defs);
    var xy = pts.map(function (p) { return [x(p.t), y(p.v)]; });
    var d = 'M' + xy[0][0].toFixed(1) + ' ' + xy[0][1].toFixed(1);
    for (var k = 0; k < xy.length - 1; k++) {
      var p0 = xy[k - 1] || xy[k], p1 = xy[k], p2 = xy[k + 1], p3 = xy[k + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: 'url(#inc-grad)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    svg.appendChild(el('line', { x1: L, x2: R, y1: y(full), y2: y(full), stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
    box.appendChild(svg);
  }
  function drawTrend() {
    var box = document.getElementById('trend-chart');
    if (!box) return;
    box.innerHTML = '';
    var W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    var r = seeded(77), n = 132, bars = [], boost = [];
    for (var i = 0; i < n; i++) {
      var b = r() < 0.55 ? Math.floor(r() * 3) : Math.floor(r() * 6);
      if (r() < 0.08) b = 4 + Math.floor(r() * 7);
      if (i === 84 || i === 103) b = 12;
      if (i === 114) b = 10;
      bars.push(b);
      boost.push(i === 99 ? 19.5 : b * (0.05 + r() * 0.1));
    }
    var L = 34, R = W - 74, T = 30, B = H - 22, top = 21;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Accelerations over the last month' });
    function y(v) { return B - v / top * (B - T); }
    svg.appendChild(el('text', { x: 0, y: 12, 'font-size': 11, 'font-style': 'italic', 'font-family': 'sans-serif', fill: '#ffffff88' }, 'Accelerated'));
    svg.appendChild(el('text', { x: W, y: 12, 'text-anchor': 'end', 'font-size': 11, 'font-style': 'italic', 'font-family': 'sans-serif', fill: '#ffffff88' }, 'Total bid boost'));
    for (var v = 0; v <= top; v += 3) {
      svg.appendChild(el('line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: '#ffffff22', 'stroke-dasharray': v ? '1 3' : 'none' }));
      svg.appendChild(el('text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, 'font-family': 'sans-serif', fill: '#ffffffaa' }, String(v)));
    }
    var right = ['0 sats', '20000 sats', '40000 sats', '60000 sats', '80000 sats', '0.001 BTC', '0.001 BTC'];
    right.forEach(function (lab, k) {
      svg.appendChild(el('text', { x: R + 8, y: y(k * 3.5) + 4, 'font-size': 11, 'font-family': 'sans-serif', fill: '#ffffffaa' }, lab));
    });
    var bw = (R - L) / n;
    bars.forEach(function (b, i) {
      if (b) svg.appendChild(el('rect', { x: L + i * bw + bw * 0.2, y: y(b), width: Math.max(1, bw * 0.6), height: B - y(b), fill: getVar('--mined-top') }));
    });
    var d = boost.map(function (b, i) { return (i ? 'L' : 'M') + (L + (i + 0.5) * bw).toFixed(1) + ' ' + y(b).toFixed(1); }).join(' ');
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: '#f7931a', 'stroke-width': 1.2, opacity: 0.9 }));
    var dates = R - L < 320 ? ['October 17', 'November 1', 'November 13'] : ['October 17', 'October 25', 'November 1', 'November 9'];
    dates.forEach(function (lab, i) {
      svg.appendChild(el('text', { x: L + (0.12 + i * (0.76 / (dates.length - 1))) * (R - L), y: B + 18, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'sans-serif', fill: '#ffffffaa' }, lab));
    });
    box.appendChild(svg);
  }

  // ---------- footer ----------
  var TIMEZONES = [[-12, 'Anywhere on Earth (AoE)'],[-11, 'Samoa Standard Time (SST)'],[-10, 'Hawaii Standard Time (HST)'],[-9, 'Alaska Standard Time (AKST)'],[-8, 'Pacific Standard Time (PST)'],[-7, 'Mountain Standard Time (MST)'],[-6, 'Central Standard Time (CST)'],[-5, 'Eastern Standard Time (EST)'],[-4, 'Atlantic Standard Time (AST)'],[-3, 'Argentina Time (ART)'],[-2, 'Fernando de Noronha Time (FNT)'],[-1, 'Azores Time (AZOT)'],[1, 'Central European Time (CET)'],[2, 'Eastern European Time (EET)'],[3, 'Moscow Standard Time (MSK)'],[4, 'Armenia Time (AMT)'],[5, 'Pakistan Standard Time (PKT)'],[6, 'Xinjiang Time (XJT)'],[7, 'Indochina Time (ICT)'],[8, 'Hong Kong Time (HKT)'],[9, 'Japan Standard Time (JST)'],[10, 'Australian Eastern Standard Time (AEST)'],[11, 'Norfolk Time (NFT)'],[12, 'New Zealand Standard Time (NZST)'],[13, 'Tonga Time (TOT)'],[14, 'Line Islands Time (LINT)']];
  function footer() {
    var explore = ['Mining Dashboard', 'Lightning Explorer', 'Recent Blocks', 'Broadcast Transaction', 'Test Transaction', 'Preview Transaction', 'Connect to our Nodes', 'API Documentation'];
    if (net === 'testnet4') explore = explore.filter(function (x) { return x !== 'Lightning Explorer'; });
    var learn = ['What is a mempool?', 'What is a block explorer?', 'What is a mempool explorer?', "Why isn't my transaction confirming?", 'Be your own explorer&trade;', 'More FAQs &raquo;', 'Research'];
    var nets = [['Mainnet Explorer', '/', 'mainnet'], ['Testnet3 Explorer', '/testnet', 'testnet'], ['Testnet4 Explorer', '/testnet4', 'testnet4'], ['Signet Explorer', '/signet', 'signet']]
      .filter(function (n) { return n[2] !== net; })
      .map(function (n) { return [n[0], L(n[1])]; })
      .concat([['Liquid Testnet Explorer', '#liquid-testnet'], ['Liquid Explorer', '#liquid']]);
    var legal = ['Terms of Service', 'Privacy Policy', 'Trademark Policy', 'Third-party Licenses'];
    function col(title, list) {
      return '<div class="links"><p class="category">' + title + '</p>' + list.map(function (x) {
        var label = Array.isArray(x) ? x[0] : x;
        var target = { 'Mining Dashboard': '#mining', 'Lightning Explorer': '#lightning', 'Recent Blocks': '#mining', 'Connect to our Nodes': '#lightning', 'API Documentation': '#docs',
          'What is a mempool?': '#docs', 'What is a block explorer?': '#docs', 'What is a mempool explorer?': '#docs', "Why isn't my transaction confirming?": '#docs', 'More FAQs &raquo;': '#docs', 'Research': '#about' }[label];
        var href = Array.isArray(x) ? x[1] : target || '#' + label.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return '<p><a href="' + href + '">' + label + '</a></p>';
      }).join('') + '</div>';
    }
    function select(name, width, options, value) {
      return '<div class="selector"><select class="form-select" data-setting="' + name + '" aria-label="' + name + '" style="width:' + width + 'px">' +
        options.map(function (o) {
          var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
          return '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + l + '</option>';
        }).join('') + '</select></div>';
    }
    var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').replace(/_/g, ' ');
    var offset = -new Date().getTimezoneOffset() / 60;
    var tzLabel = 'UTC' + (offset >= 0 ? '+' : '') + offset + ' - ' + tz;
    var tagline = 'Explore the full Bitcoin ecosystem<sup>&reg;</sup>';
    return '<footer><div class="row main"><div class="branding">' +
      '<div class="main-logo"><a class="footer-logo-wrapper" href="' + L(netPrefix || '/') + '" aria-label="deep pool">' + footerLogo() + '</a></div>' +
      '<p class="explore-tagline-mobile">' + tagline + '</p>' +
      '<div class="site-options language-selector">' +
      select('language', 120, [['ar', 'العربية'], ['cs', 'Čeština'], ['da', 'Dansk'], ['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['fa', 'فارسی'], ['fr', 'Français'], ['ko', '한국어'], ['hr', 'Hrvatski'], ['hi', 'हिन्दी'], ['ne', 'नेपाली'], ['it', 'Italiano'], ['he', 'עברית'], ['ka', 'ქართული'], ['lt', 'Lietuvių'], ['hu', 'Magyar'], ['mk', 'Македонски'], ['nl', 'Nederlands'], ['ja', '日本語'], ['nb', 'Norsk'], ['pl', 'Polski'], ['pt', 'Português'], ['ro', 'Română'], ['ru', 'Русский'], ['sl', 'Slovenščina'], ['fi', 'Suomi'], ['sv', 'Svenska'], ['th', 'ไทย'], ['tr', 'Türkçe'], ['uk', 'Українська'], ['vi', 'Tiếng Việt'], ['zh', '中文']], 'en') +
      select('currency', 85, ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'USD'], settings.currency) +
      select('timezone', 110, [['local', tzLabel], ['UTC', 'UTC - Greenwich Mean Time (GMT)']].concat(TIMEZONES.map(function (z) {
        // Etc/GMT zones count the other way round: Etc/GMT-3 is UTC+3
        return ['Etc/GMT' + (z[0] > 0 ? '-' : '+') + Math.abs(z[0]), 'UTC' + (z[0] > 0 ? '+' : '') + z[0] + ' - ' + z[1]];
      })), settings.timezone) +
      select('denomination', 75, ['BTC', 'sats', 'Fiat'], settings.denomination) +
      select('theme', 108, [['wiz', 'wiz'], ['bluematt', 'BlueMatt'], ['softsimon', 'softsimon'], ['nymkappa', 'nymkappa'], ['contrast', 'contrast']], settings.theme) +
      '<button class="sponsor" type="button" data-section="Sign In">Sign In</button></div>' +
      '<p class="explore-tagline-desktop">' + tagline + '</p>' +
      '</div></div>' +
      '<div class="row link-tree">' + col('Explore', explore) + col('Learn', learn) + col('Networks', nets) + col('Legal', legal) + '</div>' +
      '<div class="row social-links">' + ['GitHub', 'X', 'Nostr', 'Primal', 'YouTube', 'BitcoinTV', 'Matrix'].map(function (n, i) {
        return '<a href="#' + n.toLowerCase() + '" title="' + n + '" aria-label="' + n + '">' + SOCIAL[i] + '</a>';
      }).join('') + '</div>' +
      '<div class="row version"><p>node208.fra.deep.pool (v3.4-dev) <a href="#changelog">[04c299c3]</a>[ca77acb1]</p></div>' +
      '</footer>';
  }

  // ---------- mount ----------
  document.body.className = 'net-' + net + (settings.theme !== 'wiz' ? ' theme-' + settings.theme : '');
  if (net !== 'mainnet') document.title = 'deep pool - ' + NET_LABEL[net] + ' Explorer';
  if (page === 'acceleration') document.title = 'deep pool - Accelerator Dashboard';
  var app = document.getElementById('app');
  app.innerHTML = header() + alertBanner() +
    sidenav() + '<main><div class="main-inner"><div class="blockchain-wrapper" id="blockchain"><div class="position-container"></div>' +
    '<button class="reset-scroll hidden" id="reset-scroll" type="button" title="Back to the newest blocks" aria-label="Back to the newest blocks"><svg viewBox="0 0 63 50"><path d="M38 10L23 25l15 15" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
    '<div id="content">' + (page === 'acceleration' ? accelerationPage() : dashboard()) + '</div></div></main>' + footer();

  function setNavActive() {
    var key = selected && selected.kind === 'tab' ? '#' + selected.id : L(page === 'acceleration' ? '/acceleration' : (netPrefix || '/'));
    Array.prototype.forEach.call(document.querySelectorAll('.navbar-nav .nav-item'), function (li) {
      var a = li.querySelector('a');
      li.classList.toggle('active', a && a.getAttribute('href') === key);
    });
  }
  function drawCharts() { drawIncoming(); drawTrend(); if (typeof drawGoggles === 'function') drawGoggles(); }
  function renderContent() {
    var tab = selected && selected.kind === 'tab';
    var html = selected && (tab ? tabView(selected.id) : selected.kind === 'address' ? addressView() : blockView());
    document.getElementById('content').innerHTML = html || (page === 'acceleration' ? accelerationPage() : dashboard());
    // tab pages other than Mining have no block strip, like the original
    document.getElementById('blockchain').style.display = tab && selected.id !== 'mining' ? 'none' : '';
    setNavActive();
    drawCharts();
  }
  renderBlockchain();
  drawCharts();

  // network menu
  var toggle = app.querySelector('.net-toggle'), menu = app.querySelector('.net-menu');
  function setMenu(open) { menu.classList.toggle('open', open); toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  toggle.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // test-network banner
  var alertEl = app.querySelector('.net-alert');
  if (alertEl) alertEl.querySelector('.close').addEventListener('click', function () { alertEl.classList.add('hidden'); store('alert-' + net, 'closed'); });

  // search: a block height on screen jumps to that block; anything else flags the box
  var form = app.querySelector('.search'), input = form.querySelector('input');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    var idx = -1;
    D.blocks.forEach(function (b, i) { if (String(b.height) === q) idx = i; });
    if (idx >= 0) {
      drag.offset = -Math.max(0, idx * 155 - 200) * (settings.timeLtr ? -1 : 1);
      renderBlockchain();
      go('#block-' + q);
    } else if (isAddress(q)) {
      go('#address-' + q);
    } else if (/^[0-9a-f]{64}$/i.test(q)) {
      showTx(q.toLowerCase());
    } else {
      toast(q ? 'Nothing found for "' + q + '". Try a block height from the strip, a Bitcoin address or a transaction ID from the lists.' : 'Type a block height or a transaction ID.');
      input.style.borderColor = 'var(--down)';
      input.setAttribute('aria-invalid', 'true');
      setTimeout(function () { input.style.borderColor = ''; input.removeAttribute('aria-invalid'); }, 1500);
    }
  });

  // blockchain: drag to scroll, and the two toggles
  var bc = document.getElementById('blockchain');
  var start = null, justDragged = false;
  bc.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button')) return;
    start = { x: e.clientX, offset: drag.offset };
  });
  window.addEventListener('pointermove', function (e) {
    if (!start) return;
    var dx = e.clientX - start.x;
    if (Math.abs(dx) > 4) bc.classList.add('dragging');
    drag.offset = start.offset + dx;
    bc.querySelector('.position-container').style.left = dividerX() + 'px';
    updateReset();
  });
  window.addEventListener('pointerup', function () {
    if (!start) return;
    justDragged = bc.classList.contains('dragging');
    bc.classList.remove('dragging');
    start = null;
    setTimeout(function () { justDragged = false; }, 0);
  });
  bc.addEventListener('click', function (e) {
    if (justDragged) { e.preventDefault(); justDragged = false; return; }
    if (e.target.closest('#reset-scroll')) { drag.offset = 0; renderBlockchain(); return; }
    if (e.target.closest('.time-toggle')) { settings.timeLtr = !settings.timeLtr; store('timeLtr', settings.timeLtr ? '1' : '0'); renderBlockchain(); }
    if (e.target.closest('.block-display-toggle')) { settings.sizeView = !settings.sizeView; renderBlockchain(); }
  });

  // dashboard controls
  app.addEventListener('click', function (e) {
    var w = e.target.closest('[data-widget]');
    if (w) { e.preventDefault(); settings.widget = w.getAttribute('data-widget'); renderContent(); return; }
    var g = e.target.closest('input[data-goggles]');
    if (g) { settings.goggles = g.getAttribute('data-goggles'); renderContent(); return; }
    var a = e.target.closest('[data-acc]');
    if (a) { e.preventDefault(); settings.accWindow = a.getAttribute('data-acc'); renderContent(); }
  });
  app.addEventListener('change', function (e) {
    var s = e.target.getAttribute('data-setting');
    if (!s || s === 'language') return;
    settings[s] = e.target.value;
    store(s, e.target.value);
    if (s === 'theme') document.body.className = 'net-' + net + (settings.theme !== 'wiz' ? ' theme-' + settings.theme : '');
    renderContent();
  });
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderBlockchain(); if (selected) renderContent(); else drawCharts(); }, 80);
  });
  setInterval(renderBlockchain, 60000); // keeps "minutes ago" fresh

  // ---------- block view, details window and notices ----------
  // Clicking a block opens its own view under the strip (like a block page), a transaction opens a
  // details window, and sections that don't exist yet say so. Every click on the site does something.
  var selected = null; // { kind: 'block' | 'projected', id }
  var view = { page: 1, details: false };
  var lastFocus = null;

  function closeModal() {
    var m = document.getElementById('dp-modal');
    if (!m) return;
    m.parentNode.removeChild(m);
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openModal(title, rows, note) {
    closeModal();
    lastFocus = document.activeElement;
    var body = rows.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('');
    var wrap = document.createElement('div');
    wrap.id = 'dp-modal';
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dp-modal-title">' +
      '<div class="modal-head"><h2 id="dp-modal-title">' + title + '</h2><button type="button" class="modal-close" aria-label="Close">' + I.close + '</button></div>' +
      '<table class="modal-table"><tbody>' + body + '</tbody></table>' + (note ? '<p class="modal-note">' + note + '</p>' : '') + '</div>';
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('.modal-close')) closeModal(); });
    wrap.querySelector('.modal-close').focus();
  }
  var toastTimer;
  function toast(text) {
    var t = document.getElementById('dp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'dp-toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  // made-up but stable details for a block: the same height always gives the same hash and transactions
  function hexFrom(r, n) { var h = ''; for (var i = 0; i < n; i++) h += '0123456789abcdef'[Math.floor(r() * 16)]; return h; }
  var B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function address(r) {
    var pre = net === 'mainnet' ? 'bc1q' : 'tb1q', s = pre;
    var len = r() < 0.8 ? 38 : 58;
    for (var i = 0; i < len; i++) s += B32[Math.floor(r() * 32)];
    return s;
  }
  function shortAddr(a, head) { return a.length > head + 10 ? a.slice(0, head) + '&hellip; ' + a.slice(-7) : a; }
  function blockHash(h) { var r = seeded(h * 7919 + 13); return '00000000000000000000' + hexFrom(r, 44); }
  function stamp(minutesAgo) {
    var d = new Date(Date.now() - minutesAgo * 60000);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function blockMinutes(b) {
    return b.timestamp ? (Date.now() - b.timestamp * 1000) / 60000 : b.minutes + (Date.now() - D.minutesBase) / 60000;
  }
  function blockAge(b) { return b.ageText && !D.live ? b.ageText : ago(blockMinutes(b)); }
  var SUBSIDY = 3.125;
  function btcAmount(v) { return v.toFixed(8) + ' <span class="symbol">' + unit + '</span>'; }
  function fiatTag(btc) { return D.price ? ' <span class="fiat">' + fiat(btc) + '</span>' : ''; }
  function featureBadges() { return '<span class="badge rbf">SegWit</span><span class="badge rbf">Taproot</span>'; }
  function arrow(dir) {
    return '<span class="io-arrow ' + dir + '" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4 8h7M8 4.8L11.2 8 8 11.2" fill="none" stroke="#11131f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function blockTransactions(b, page, perPage, blockMins) {
    var start = (page - 1) * perPage, count = Math.min(perPage, Math.max(0, b.txs - start));
    var list = [];
    for (var i = 0; i < count; i++) {
      var idx = start + i, r = seeded(b.height * 100003 + idx * 31 + 7);
      var txid = hexFrom(r, 64), ins = [], outs = [];
      if (idx === 0) {
        var reward = SUBSIDY + b.btc;
        outs.push([address(r), reward]);
        outs.push(['OP_RETURN', 0]);
        outs.push(['OP_RETURN', 0]);
        list.push({ txid: txid, coinbase: true, ins: [], outs: outs, total: reward });
        continue;
      }
      var nin = 1 + Math.floor(Math.pow(r(), 2) * 5), nout = 1 + Math.floor(r() * 3), total = 0;
      for (var k = 0; k < nin; k++) ins.push([address(r), Math.round((0.0005 + r() * 0.02) * 1e8) / 1e8]);
      var sumIn = ins.reduce(function (a, x) { return a + x[1]; }, 0);
      var vsize = 110 + nin * 68 + nout * 31;
      var lo = Math.max(b.range[0], 0.1), hi = Math.max(lo, Math.min(b.range[1], 80));
      var rate = Math.round((hi - (hi - lo) * Math.pow(idx / Math.max(1, b.txs), 0.35)) * 10) / 10;
      var fee = Math.round(rate * vsize);
      var left = sumIn - fee / 1e8;
      for (var o = 0; o < nout; o++) {
        var part = o === nout - 1 ? left - total : Math.round(left * (0.2 + r() * 0.5) * 1e8) / 1e8;
        total += part;
        outs.push([address(r), Math.max(0, part)]);
      }
      list.push({ txid: txid, ins: ins, outs: outs, total: Math.max(0, total), rate: rate, fee: fee });
    }
    return list;
  }
  function txCard(t, when, narrow) {
    var head = narrow ? 13 : 29;
    var ins = t.coinbase
      ? '<div class="io-row">' + arrow('grey') + '<span class="io-addr plain">Coinbase (Newly Generated Coins)</span></div>'
      : t.ins.map(function (x) {
        return '<div class="io-row">' + arrow('in') + '<a class="io-addr" href="#address-' + x[0] + '" title="' + x[0] + '">' + shortAddr(x[0], head) + '</a><span class="io-amt">' + btcAmount(x[1]) + '</span></div>';
      }).join('');
    var outs = t.outs.map(function (x) {
      var isData = x[0] === 'OP_RETURN';
      return '<div class="io-row">' + (isData ? '<span class="io-addr plain">OP_RETURN</span>' : '<a class="io-addr" href="#address-' + x[0] + '" title="' + x[0] + '">' + shortAddr(x[0], head) + '</a>') +
        '<span class="io-amt">' + btcAmount(x[1]) + '</span>' + arrow(isData ? 'grey' : 'out') + '</div>';
    }).join('');
    var feeLine = t.coinbase ? '' : '<span class="tx-fee">' + feeFmt(t.rate) + ' <span class="symbol">sat/vB</span> &ndash; ' + commas(t.fee) + ' <span class="symbol">sats</span>' + fiatTag(t.fee / 1e8) + '</span>';
    return '<div class="tx-box"><div class="tx-head"><a href="#tx-' + t.txid + '" class="tx-id">' + (narrow ? t.txid.slice(0, 16) + '&hellip; ' + t.txid.slice(-4) : t.txid) + '</a><span>' + when + '</span></div>' +
      '<div class="tx-body"><div class="tx-ins">' + ins + '</div><div class="tx-outs">' + outs + '</div>' +
      '<div class="tx-foot">' + feeLine + '<span class="tx-total">' + btcAmount(t.total) + '</span></div></div></div>';
  }
  function pager(pages) {
    var cur = view.page, nums = [];
    var span = document.documentElement.clientWidth < 576 ? 3 : 5;
    var from = Math.max(1, Math.min(cur - Math.floor(span / 2), pages - span + 1));
    for (var p = from; p < from + span && p <= pages; p++) nums.push(p);
    function btn(label, p, extra) {
      var off = p < 1 || p > pages || p === cur;
      return '<button type="button" class="pg' + (extra || '') + '" data-page="' + p + '"' + (off && !extra ? ' disabled' : '') + '>' + label + '</button>';
    }
    return '<div class="pager" role="navigation" aria-label="Pages">' + btn('&laquo;&laquo;', 1) + btn('&laquo;', cur - 1) +
      nums.map(function (p) { return btn(String(p), p, p === cur ? ' active' : ''); }).join('') +
      btn('&raquo;', cur + 1) + btn('&raquo;&raquo;', pages) + '</div>';
  }
  function detailRows(rows) {
    return '<table class="block-table"><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function blockView() {
    var narrow = document.documentElement.clientWidth < 576;
    var b = null, idx = -1;
    if (selected.kind === 'block') D.blocks.forEach(function (x, i) { if (String(x.height) === String(selected.id)) { b = x; idx = i; } });
    else { idx = +selected.id; b = D.mempool[idx]; }
    if (!b) return '';
    var projected = selected.kind === 'projected';
    var title, left, right, prev, next;
    if (projected) {
      var etaMin = Math.max(1, Math.floor(avgMinutes() * (idx + 1)));
      title = (idx === 0 ? 'Next block' : 'Projected block ' + (idx + 1));
      prev = idx > 0 ? '#mempool-block-' + (idx - 1) : null;
      next = idx < D.mempool.length - 1 ? '#mempool-block-' + (idx + 1) : null;
      left = [['Expected', b.blocks > 1 ? 'After the next ' + idx + ' blocks' : 'In ~' + etaMin + ' minutes'],
        ['Transactions', commas(b.txs)], ['Size', ((b.vsize || b.fullness * 1e6) / 1e6).toFixed(2) + ' <span class="symbol">MvB</span>'],
        ['Fullness', Math.round(Math.min(1, b.fullness) * 100) + '%']];
      right = [['Fee span', feeFmt(b.range[0]) + ' - ' + feeFmt(b.range[1]) + ' <span class="symbol">sat/vB</span>'],
        ['Median fee', '~' + Math.round(b.median) + ' <span class="symbol">sat/vB</span>' + fiatTag(b.median * 140 / 1e8)],
        ['Total fees', btcFmt(b.btc) + ' <span class="symbol">' + unit + '</span>' + fiatTag(b.btc)]];
    } else {
      var hash = blockHash(b.height), mins = blockMinutes(b);
      title = 'Block <a class="blk-nav" href="' + (D.blocks[idx + 1] ? '#block-' + D.blocks[idx + 1].height : '#') + '" aria-label="Older block">&lsaquo;</a> <span class="blk-num">' + b.height + '</span>' +
        ' <a class="blk-nav" href="' + (idx > 0 ? '#block-' + D.blocks[idx - 1].height : '#mempool-block-0') + '" aria-label="Newer block">&rsaquo;</a>';
      var sizeMb = Math.min(1.99, 0.05 + b.fullness * 1.6 + (b.height % 7) / 100);
      left = [['Hash', '<a href="#hash" class="hash-link" title="' + hash + '">' + hash.slice(0, 6) + '&hellip;' + hash.slice(-7) + '</a> <button type="button" class="copy" data-copy="' + hash + '" aria-label="Copy block hash">' + COPY_ICON + '</button>'],
        ['Timestamp', stamp(mins) + ' <i class="ago">(' + blockAge(b) + ')</i>'],
        ['Size', sizeMb.toFixed(2) + ' <span class="symbol">MB</span>'],
        ['Weight', Math.min(4, b.fullness * 3.99).toFixed(2) + ' <span class="symbol">MWU</span>'],
        ['Health', '<span class="badge rbf">' + (99 + (b.height % 100) / 100).toFixed(2) + '%</span>']];
      right = [['Fee span', feeFmt(b.range[0]) + ' - ' + feeFmt(b.range[1]) + ' <span class="symbol">sat/vB</span>'],
        ['Median fee', '~' + Math.round(b.median) + ' <span class="symbol">sat/vB</span>' + fiatTag(b.median * 140 / 1e8)],
        ['Total fees', btcFmt(b.btc) + ' <span class="symbol">' + unit + '</span>' + fiatTag(b.btc)],
        ['Subsidy + fees', (SUBSIDY + b.btc).toFixed(3) + ' <span class="symbol">' + unit + '</span>' + fiatTag(SUBSIDY + b.btc)],
        ['Miner', '<span class="miner">' + poolBadge(b.pool) + '</span>'],
        ['Features', featureBadges()]];
      if (view.details) {
        var r = seeded(b.height * 3 + 1);
        left = left.concat([['Version', '0x' + hexFrom(r, 8)], ['Bits', hexFrom(r, 8)], ['Merkle root', '<span class="mono">' + hexFrom(r, 12) + '&hellip;</span>']]);
        right = right.concat([['Difficulty', (net === 'mainnet' ? '149.30 T' : '1.00')], ['Nonce', '0x' + hexFrom(r, 8)], ['Block reward', SUBSIDY.toFixed(3) + ' <span class="symbol">' + unit + '</span>']]);
      }
    }
    var head = projected
      ? '<h1 class="blk-title">' + (prev ? '<a class="blk-nav" href="' + prev + '" aria-label="Previous">&lsaquo;</a> ' : '') + title + (next ? ' <a class="blk-nav" href="' + next + '" aria-label="Next">&rsaquo;</a>' : '') + '</h1>'
      : '<h1 class="blk-title">' + title + '</h1>';
    var perPage = 10, pages = Math.max(1, Math.ceil(b.txs / perPage));
    if (view.page > pages) view.page = pages;
    var txs = projected ? [] : blockTransactions(b, view.page, perPage);
    var when = projected ? '' : stamp(blockMinutes(b));
    var txList = projected
      ? '<p class="proj-note">These transactions are still waiting. Any transaction paying at least ' + feeFmt(b.range[0]) + ' sat/vB is expected to be in this block.</p>'
      : txs.map(function (t) { return txCard(t, when, narrow); }).join('');
    return '<div class="container-xl block-view">' +
      '<div class="blk-header">' + head + '<button type="button" class="blk-close" aria-label="Close block view">' + I.close + '</button></div>' +
      '<div class="blk-box"><div class="blk-col">' + detailRows(left) + '</div><div class="blk-col">' + detailRows(right) + '</div></div>' +
      (projected ? txList : '<div class="tx-header"><h2>' + commas(b.txs) + ' transactions</h2><button type="button" class="details-btn" aria-pressed="' + view.details + '">Details</button>' + pager(pages) + '</div>' + txList +
        (pages > 1 ? '<div class="tx-header bottom">' + pager(pages) + '</div>' : '')) +
      '</div>';
  }
  var COPY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 11V2.5A1.5 1.5 0 0 1 4.5 1H11" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

  function showTx(txid) {
    var tx = null, kind = '';
    D.recent.forEach(function (t) { if (t.txid === txid && !tx) { tx = t; kind = 'recent'; } });
    D.replacements.forEach(function (t) { if (t.txid === txid && !tx) { tx = t; kind = 'rbf'; } });
    ACC.recent.forEach(function (t) { if (t.txid === txid && !tx) { tx = t; kind = 'acc'; } });
    var rows = [['Transaction ID', '<span class="mono">' + txid + '</span>']];
    if (kind === 'recent') {
      rows.push(['Amount', amountFmt(tx.value) + ' <span class="symbol">' + unit + '</span>' + (D.price ? ' <span class="fiat">' + (tx.usd && settings.currency === 'USD' ? usdFmt(tx.usd) : fiat(tx.value)) + '</span>' : '')]);
      rows.push(['Fee rate', feeCell(tx.fee)]);
      rows.push(['Status', 'Unconfirmed, waiting in the mempool']);
    } else if (kind === 'rbf') {
      rows.push(['Previous fee rate', feeCell(tx.prev)]);
      rows.push(['New fee rate', feeCell(tx.fee)]);
      rows.push(['Status', tx.status.indexOf('mined') >= 0 ? 'Replaced, and the new version is mined' : 'Replaced by a higher-fee version (RBF)']);
    } else if (kind === 'acc') {
      rows.push(['Bid boost', commas(tx.boost) + ' <span class="symbol">sats</span>']);
      rows.push(['Block', String(tx.block)]);
      rows.push(['Status', tx.status]);
    } else if (selected && selected.kind === 'block') {
      rows.push(['Status', 'Confirmed in block ' + selected.id]);
    } else {
      return toast('That transaction is no longer in the list.');
    }
    openModal('Transaction', rows);
  }

  // ---------- address view (opened by searching or clicking an address) ----------
  // Like the block view, an address gets made-up but stable details: the same address always shows the
  // same balance, history and transactions.
  function strSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function isAddress(q) {
    return /^(bc1|tb1|bcrt1)[02-9ac-hj-np-z]{8,87}$/i.test(q) || /^[13mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(q);
  }
  function addressType(a) {
    var l = a.toLowerCase();
    if (/^(bc1p|tb1p|bcrt1p)/.test(l)) return 'P2TR';
    if (/^(bc1q|tb1q|bcrt1q)/.test(l)) return a.length > 50 ? 'P2WSH' : 'P2WPKH';
    if (/^[32]/.test(a)) return 'P2SH';
    return 'P2PKH';
  }
  var addrView = { range: 'all' };
  function addressData(addr) {
    var r = seeded(strSeed(addr));
    var top = D.blocks[0] ? D.blocks[0].height : 975639;
    var n = 4 + Math.floor(r() * 9), acts = [], height = top - Math.floor(r() * 4), minutesAgo = 0;
    for (var i = 0; i < n; i++) {
      if (i > 0) { var gap = i < 3 ? 1 + Math.floor(r() * 8) : 200 + Math.floor(r() * 4000); height -= gap; }
      var b = null;
      D.blocks.forEach(function (x) { if (x.height === height) b = x; });
      minutesAgo = b ? blockMinutes(b) : (top - height) * 10 + r() * 9;
      acts.push({ height: height, minutes: minutesAgo, r: r() });
    }
    // oldest first to build the running balance, then flip back to newest first
    acts.reverse();
    var bal = 0, received = 0, utxos = 0;
    acts.forEach(function (a, i) {
      var kind;
      if (i === 0 || bal < 0.0005 || a.r < 0.45) kind = 'Received';
      else if (a.r < 0.75) kind = 'Sent';
      else kind = 'Sent & received';
      var amt;
      if (kind === 'Received') { amt = Math.round((0.00003 + Math.pow(a.r, 3) * 2.2) * 1e8) / 1e8; received += amt; utxos++; }
      else if (kind === 'Sent') { amt = -Math.round(bal * (0.4 + a.r * 0.6) * 1e8) / 1e8; utxos = Math.max(0, utxos - 1); }
      else { var back = Math.round(bal * a.r * 0.5 * 1e8) / 1e8; amt = -Math.round((bal - back) * 0.9 * 1e8) / 1e8; received += back; }
      bal = Math.max(0, Math.round((bal + amt) * 1e8) / 1e8);
      a.kind = kind; a.amount = amt; a.balance = bal;
    });
    acts.reverse();
    return { addr: addr, acts: acts, balance: bal, received: received, utxos: Math.max(bal > 0 ? 1 : 0, Math.min(utxos, 6)), type: addressType(addr) };
  }
  function shortAmount(v) {
    var a = Math.abs(v), sign = v >= 0 ? '+' : '-';
    if (a < 0.001) {
      var sats = a * 1e8;
      return sign + (sats >= 1000 ? (sats / 1000).toFixed(sats >= 10000 ? 0 : 1) + 'k' : Math.round(sats)) + ' <span class="symbol">sats</span>';
    }
    return sign + (a >= 1 ? a.toFixed(2) : a.toFixed(3).replace(/0+$/, '')) + ' <span class="symbol">' + unit + '</span>';
  }
  function shortDate(minutesAgo) {
    var d = new Date(Date.now() - minutesAgo * 60000);
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return m + ' ' + d.getDate() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function addressTxs(data) {
    return data.acts.map(function (a, i) {
      var r = seeded(strSeed(data.addr) + i * 977);
      var txid = hexFrom(r, 64), ins = [], outs = [], amt = Math.abs(a.amount);
      var rate = Math.round((1 + r() * 6) * 100) / 100, fee = Math.round(rate * (140 + r() * 120));
      if (a.kind === 'Received') {
        ins.push([address(r), Math.round((amt + fee / 1e8 + r() * 0.01) * 1e8) / 1e8]);
        outs.push([data.addr, amt]);
        outs.push([address(r), Math.max(0, Math.round((ins[0][1] - amt - fee / 1e8) * 1e8) / 1e8)]);
      } else {
        ins.push([data.addr, Math.round((amt + fee / 1e8) * 1e8) / 1e8]);
        outs.push([address(r), amt]);
        if (a.kind === 'Sent & received') outs.push([data.addr, Math.round(r() * amt * 0.3 * 1e8) / 1e8]);
      }
      var total = outs.reduce(function (s, o) { return s + o[1]; }, 0);
      return { txid: txid, ins: ins, outs: outs, total: total, rate: rate, fee: fee, when: stamp(a.minutes) };
    });
  }
  function balanceChart(data) {
    // a step chart of the balance after each transaction, oldest on the left
    var W = 1000, H = 320, L = 70, R = W - 20, T = 20, B = H - 40;
    var acts = data.acts.slice().reverse();
    var now = 0, start = acts.length ? acts[0].minutes : 60;
    if (addrView.range === 'recent') start = Math.min(start, 24 * 60);
    var max = 0;
    acts.forEach(function (a) { max = Math.max(max, a.balance); });
    max = max > 0 ? max * 1.15 : 0.01;
    function x(minutesAgo) { return L + (1 - Math.min(minutesAgo, start) / start) * (R - L); }
    function y(v) { return B - v / max * (B - T); }
    var prev = 0;
    acts.forEach(function (a) { if (a.minutes > start) prev = a.balance; });
    var d = 'M' + L + ' ' + y(prev).toFixed(1);
    acts.forEach(function (a) {
      if (a.minutes > start) return;
      d += ' L' + x(a.minutes).toFixed(1) + ' ' + y(prev).toFixed(1) + ' L' + x(a.minutes).toFixed(1) + ' ' + y(a.balance).toFixed(1);
      prev = a.balance;
    });
    d += ' L' + R + ' ' + y(prev).toFixed(1);
    var area = d + ' L' + R + ' ' + B + ' L' + L + ' ' + B + ' Z';
    var grid = '';
    for (var k = 0; k <= 6; k++) {
      var v = max / 6 * k;
      grid += '<line x1="' + L + '" x2="' + R + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#ffffff1a" stroke-dasharray="' + (k ? '1 3' : '0') + '"/>' +
        '<text x="' + (L - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#ffffffaa" font-family="sans-serif">' + (v === 0 ? '0' : v < 0.1 ? v.toFixed(4) : v < 10 ? v.toFixed(3) : v.toFixed(1)) + ' ' + unit + '</text>';
    }
    var labels = '';
    for (var j = 0; j <= 5; j++) {
      var m = start * (1 - j / 5);
      labels += '<text x="' + x(m) + '" y="' + (B + 22) + '" text-anchor="middle" font-size="11" fill="#ffffffaa" font-family="sans-serif">' + (start > 2 * 1440 ? shortDate(m).split(',')[0] : shortDate(m).split(', ')[1]) + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Balance history">' +
      '<defs><linearGradient id="bal-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a7a22"/><stop offset="1" stop-color="#8a5a24"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#bal-grad)" opacity=".9"/><path d="' + d + '" fill="none" stroke="#fdd835" stroke-width="2"/>' + labels + '</svg>';
  }
  function addressView() {
    var data = addressData(selected.id);
    var narrow = document.documentElement.clientWidth < 576;
    var left = [['Confirmed balance', data.balance.toFixed(8) + ' <span class="symbol">' + unit + '</span>' + fiatTag(data.balance)],
      ['Confirmed UTXOs', String(data.utxos)],
      ['Total received', data.received.toFixed(8) + ' <span class="symbol">' + unit + '</span>']];
    var right = [['<i>Pending</i>', '<i>+0.00000000 <span class="symbol">' + unit + '</span></i>' + (D.price ? ' <i class="fiat">' + fiat(0) + '</i>' : '')],
      ['<i>Pending UTXOs</i>', '<i>0</i>'],
      ['Type', '<span class="badge full-rbf">' + data.type + '</span>']];
    var blocks = data.acts.map(function (a, i) {
      return '<a class="addr-block" href="#block-' + a.height + '" title="Block ' + a.height + '">' +
        '<span class="addr-height">' + a.height + '</span>' +
        '<span class="addr-face"><span class="addr-kind">' + a.kind + '</span><span class="addr-amt">' + shortAmount(a.amount) + '</span>' +
        '<span class="addr-count">1 transaction</span><span class="addr-date">' + shortDate(a.minutes) + '</span></span></a>' +
        (i < data.acts.length - 1 ? '<span class="addr-gap" aria-hidden="true">&middot;&middot;&middot;</span>' : '');
    }).join('');
    var txs = addressTxs(data);
    var perPage = 10, pages = Math.max(1, Math.ceil(txs.length / perPage));
    var shown = txs.slice((view.page - 1) * perPage, view.page * perPage);
    var toggler = ['all', 'recent'].map(function (k) {
      return '<a href="#" data-balrange="' + k + '" class="' + (addrView.range === k ? 'inactive' : '') + '">' + k + '</a>';
    }).join('<span class="sep">|</span>');
    return '<div class="container-xl block-view address-view">' +
      '<div class="blk-header"><h1 class="blk-title addr-title">Address <span class="addr-full">' + data.addr + '</span> ' +
      '<button type="button" class="copy" data-copy="' + data.addr + '" aria-label="Copy address">' + COPY_ICON + '</button></h1>' +
      '<button type="button" class="blk-close" aria-label="Close address view">' + I.close + '</button></div>' +
      '<div class="blk-box"><div class="blk-col">' + detailRows(left) + '</div><div class="blk-col">' + detailRows(right) + '</div></div>' +
      '<div class="addr-section"><h2>Balance History</h2><div class="widget-toggler addr-toggler">' + toggler + '</div></div>' +
      '<div class="addr-chart"><div class="addr-legend"><span class="sw btc"></span>' + unit + '</div>' + balanceChart(data) + '</div>' +
      '<div class="addr-section"><h2>Activity by block</h2></div>' +
      '<div class="addr-activity"><div class="addr-strip">' + blocks + '</div></div>' +
      '<div class="tx-header"><h2>' + data.acts.length + ' transaction' + (data.acts.length === 1 ? '' : 's') + '</h2>' + (pages > 1 ? pager(pages) : '') + '</div>' +
      shown.map(function (t) { return txCard(t, t.when, narrow); }).join('') +
      '</div>';
  }

  // ---------- pool goggles (heatmap of the next block) ----------
  // Every square is one waiting transaction: its size is how much block space it takes and its colour is
  // the fee it pays. The squares are packed into a grid, and new transactions keep arriving.
  var GRID = 75;
  var goggles = { txs: null, seed: 1 };
  function buildGoggles() {
    var r = seeded(1000 + goggles.seed * 7 + (net === 'mainnet' ? 0 : net.length * 13));
    var used = new Uint8Array(GRID * GRID), txs = [];
    var next = D.mempool[0] || { range: [1, 10], median: 2 };
    var lo = Math.max(0.1, next.range[0]), hi = Math.max(lo + 0.5, Math.min(next.range[1], 40));
    function free(x, y, s) {
      if (x + s > GRID || y + s > GRID) return false;
      for (var j = y; j < y + s; j++) for (var i = x; i < x + s; i++) if (used[j * GRID + i]) return false;
      return true;
    }
    function take(x, y, s) { for (var j = y; j < y + s; j++) for (var i = x; i < x + s; i++) used[j * GRID + i] = 1; }
    function add(x, y, s) {
      take(x, y, s);
      var big = s >= 4;
      txs.push({ x: x, y: y, s: s, rate: Math.round((lo + (hi - lo) * Math.pow(r(), big ? 2.2 : 3.5)) * 10) / 10,
        consolidation: r() < (big ? 0.18 : 0.05), coinjoin: r() < 0.035, data: r() < 0.09, acc: r() < 0.02, id: hexFrom(r, 64) });
    }
    // a few large transactions first, placed at random spots, then smaller ones, then fill every gap
    var sizes = [];
    for (var k = 0; k < 7; k++) sizes.push(9 + Math.floor(r() * 7));
    for (k = 0; k < 18; k++) sizes.push(4 + Math.floor(r() * 4));
    for (k = 0; k < 120; k++) sizes.push(2 + Math.floor(r() * 2));
    sizes.forEach(function (s) {
      for (var t = 0; t < 60; t++) {
        var x = Math.floor(r() * (GRID - s + 1)), y = Math.floor(r() * (GRID - s + 1));
        if (free(x, y, s)) { add(x, y, s); return; }
      }
    });
    for (var y = 0; y < GRID; y++) for (var x = 0; x < GRID; x++) if (!used[y * GRID + x]) add(x, y, 1);
    goggles.txs = txs;
  }
  function gogglesMatch(t) {
    if (page === 'acceleration') return t.acc;
    var f = settings.goggles;
    if (f === 'Consolidation') return t.consolidation;
    if (f === 'Coinjoin') return t.coinjoin;
    if (f === 'Data') return t.data;
    return true;
  }
  function drawGoggles() {
    var box = document.querySelector('.goggles-canvas');
    if (!box || !goggles) return; // the first call can come before this section has run
    if (!goggles.txs) buildGoggles();
    var w = box.clientWidth, h = box.clientHeight;
    var size = Math.floor(Math.min(w, h > 40 ? h : w, 410));
    if (size < 40) return;
    var canvas = box.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Transactions waiting for the next block, sized by space and coloured by fee');
      if (!goggles.faded) { canvas.className = 'fade-in'; goggles.faded = true; } // fade in once, when the page first loads
      box.appendChild(canvas);
    }
    var dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var cell = size / GRID, filtered = page === 'acceleration' || settings.goggles !== 'All';
    goggles.txs.forEach(function (t) {
      var on = gogglesMatch(t);
      ctx.globalAlpha = filtered && !on ? 0.18 : 0.78; // the original's squares are muted against the card
      ctx.fillStyle = t.flash ? '#ffffff' : feeColor(t.rate);
      var gap = t.s > 1 ? 1 : 0.6;
      ctx.fillRect(t.x * cell + gap / 2, t.y * cell + gap / 2, t.s * cell - gap, t.s * cell - gap);
    });
    ctx.globalAlpha = 1;
    canvas.dataset.cell = cell;
  }
  // new transactions keep arriving: a few small squares change each moment
  function gogglesPulse() {
    if (!goggles.txs || document.hidden) return;
    var small = goggles.txs.filter(function (t) { return t.s <= 2; });
    goggles.txs.forEach(function (t) { t.flash = false; });
    var next = D.mempool[0] || { range: [1, 10] };
    for (var i = 0; i < 10; i++) {
      var t = small[Math.floor(Math.random() * small.length)];
      if (!t) break;
      t.rate = Math.max(0.1, Math.round((next.range[0] + Math.random() * Math.min(10, next.range[1])) * 10) / 10);
      t.flash = i < 3;
    }
    drawGoggles();
  }
  setInterval(gogglesPulse, 1600);
  drawGoggles();
  document.addEventListener('click', function (e) {
    var canvas = e.target.closest && e.target.closest('.goggles-canvas canvas');
    if (!canvas || !goggles.txs) return;
    var rect = canvas.getBoundingClientRect(), cell = rect.width / GRID;
    var cx = Math.floor((e.clientX - rect.left) / cell), cy = Math.floor((e.clientY - rect.top) / cell);
    var hit = null;
    goggles.txs.forEach(function (t) { if (cx >= t.x && cx < t.x + t.s && cy >= t.y && cy < t.y + t.s) hit = t; });
    if (!hit) return;
    var vsize = hit.s * hit.s * 140;
    var kind = [hit.consolidation && 'Consolidation', hit.coinjoin && 'Coinjoin', hit.data && 'Data', hit.acc && 'Accelerated'].filter(Boolean).join(', ') || 'Standard payment';
    openModal('Waiting transaction', [['Transaction ID', '<span class="mono">' + hit.id + '</span>'],
      ['Fee rate', feeCell(hit.rate)], ['Size', commas(vsize) + ' <span class="symbol">vB</span>'],
      ['Fee', commas(hit.rate * vsize) + ' <span class="symbol">sats</span>' + fiatTag(hit.rate * vsize / 1e8)],
      ['Type', kind], ['Status', 'Waiting for the next block']]);
  });

  // ---------- tab pages (mining, lightning, graphs, enterprise, about, docs, faucet) ----------
  // Every button in the tab bar opens its own page. The numbers are built into the site (made up but
  // stable), like the rest of deep pool, so nothing is fetched from anywhere.
  var TABS = { mining: 'Mining', lightning: 'Lightning', graphs: 'Graphs', enterprise: 'Services', about: 'About', docs: 'Documentation', faucet: 'Faucet' };
  var tabState = { lnStat: 'avg', graphRange: '24h', faq: -1 };
  function card(title, body, extra) { return '<div class="col card-wrapper' + (extra || '') + '"><div class="main-title">' + title + '</div><div class="card"><div class="card-body">' + body + '</div></div></div>'; }
  function stat(title, value, sub, subClass) {
    return '<div class="item"><h5 class="card-title">' + title + '</h5><div class="card-text">' + value + '</div>' + (sub ? '<div class="sub ' + (subClass || '') + '">' + sub + '</div>' : '') + '</div>';
  }
  function svgText(x, y, text, opts) {
    opts = opts || {};
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (opts.size || 11) + '" font-family="sans-serif" fill="' + (opts.fill || '#ffffffaa') + '"' +
      (opts.anchor ? ' text-anchor="' + opts.anchor + '"' : '') + (opts.weight ? ' font-weight="' + opts.weight + '"' : '') + '>' + text + '</text>';
  }
  var PIE_COLORS = ['#e3125d', '#9b23b0', '#6a2cb4', '#3a46b0', '#1e7fe0', '#0aa2e8', '#00b8c4', '#00917a', '#3aa64a', '#8bc34a', '#c0ca33', '#7e7e7e'];
  function donut(slices, w, h) {
    // slices: [label, value]; labels sit left or right of the ring with a short leader line
    var cx = w / 2 + 10, cy = h / 2, R = Math.min(w, h) * 0.36, r = R * 0.27, total = 0;
    slices.forEach(function (s) { total += s[1]; });
    var a = -Math.PI / 2, out = '';
    slices.forEach(function (s, i) {
      var da = s[1] / total * Math.PI * 2, a2 = a + da, large = da > Math.PI ? 1 : 0;
      var p = function (rad, ang) { return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]; };
      var o1 = p(R, a), o2 = p(R, a2), i1 = p(r, a2), i2 = p(r, a);
      out += '<path d="M' + o1[0].toFixed(1) + ' ' + o1[1].toFixed(1) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + o2[0].toFixed(1) + ' ' + o2[1].toFixed(1) +
        ' L' + i1[0].toFixed(1) + ' ' + i1[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + i2[0].toFixed(1) + ' ' + i2[1].toFixed(1) + ' Z" fill="' + PIE_COLORS[i % PIE_COLORS.length] + '" stroke="#11131f" stroke-width="1"><title>' + esc(s[0]) + ': ' + (s[1] / total * 100).toFixed(1) + '%</title></path>';
      var mid = a + da / 2, e = p(R + 8, mid), right = Math.cos(mid) >= 0;
      var lx = right ? w - 6 : 6, ly = Math.max(14, Math.min(h - 6, e[1]));
      out += '<polyline points="' + e[0].toFixed(1) + ',' + e[1].toFixed(1) + ' ' + (right ? cx + R + 22 : cx - R - 22).toFixed(1) + ',' + ly.toFixed(1) + ' ' + (right ? lx - 70 : lx + 70) + ',' + ly.toFixed(1) + '" fill="none" stroke="' + PIE_COLORS[i % PIE_COLORS.length] + '" stroke-width="1"/>';
      out += svgText(right ? lx - 68 : lx, ly - 3, esc(s[0]), { size: 12, fill: '#ffffffcc' });
      a = a2;
    });
    return '<svg class="pie" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Share chart">' + out + '</svg>';
  }
  function lineChart(series, w, h, opts) {
    // series: [{ values: [...], color, fill, step }]; values are spread evenly across the width
    var L = opts.left || 50, R = w - (opts.right || 20), T = 14, B = h - 26, max = opts.max, min = opts.min || 0, out = '';
    for (var k = 0; k <= 4; k++) {
      var v = min + (max - min) * k / 4, y = B - (v - min) / (max - min) * (B - T);
      out += '<line x1="' + L + '" x2="' + R + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#ffffff1a" stroke-dasharray="' + (k ? '1 3' : '0') + '"/>';
      out += svgText(L - 8, y + 4, opts.fmt(v), { anchor: 'end' });
    }
    series.forEach(function (s) {
      var n = s.values.length, d = '';
      s.values.forEach(function (v, i) {
        var x = L + i / (n - 1) * (R - L), y = B - (Math.max(min, v) - min) / (max - min) * (B - T);
        d += (i ? (s.step ? 'H' + x.toFixed(1) + 'V' : 'L' + x.toFixed(1) + ' ') : 'M' + x.toFixed(1) + ' ') + y.toFixed(1);
      });
      if (s.fill) out += '<path d="' + d + ' L' + R + ' ' + B + ' L' + L + ' ' + B + ' Z" fill="' + s.fill + '"/>';
      out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 1.5) + '"/>';
    });
    (opts.xLabels || []).forEach(function (lab, i, arr) { out += svgText(L + (i + 0.5) / arr.length * (R - L), h - 6, lab, { anchor: 'middle' }); });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + (opts.label || 'Chart') + '">' + out + '</svg>';
  }
  function series(seed, n, base, spread, drift) {
    var r = seeded(seed), v = base, out = [];
    for (var i = 0; i < n; i++) { v = Math.max(0, v + (r() - 0.5) * spread + (drift || 0)); out.push(v); }
    return out;
  }

  function miningView() {
    var blocks = D.blocks.slice(0, 6);
    var avgFees = D.blocks.reduce(function (s, b) { return s + b.btc; }, 0) / Math.max(1, D.blocks.length);
    var avgTx = D.blocks.reduce(function (s, b) { return s + b.txs; }, 0) / Math.max(1, D.blocks.length);
    var reward = 144 * (3.125 + avgFees), d = D.difficulty;
    var left = 2016 - Math.round(d.progress / 100 * 2016);
    var pools = [['Foundry USA', 29], ['AntPool', 18], ['ViaBTC', 11], ['F2Pool', 10], ['SpiderPool', 8], ['MARA Pool', 6], ['Luxor', 4], ['OCEAN', 3], ['SECPOOL', 3], ['Braiins Pool', 2], ['Other', 6]];
    var hash = series(41, 160, 980, 160, 0.4).map(function (v) { return Math.max(780, Math.min(1230, v)); });
    var diff = []; var dv = 126; for (var i = 0; i < 160; i++) { if (i % 14 === 13) dv += (i % 28 === 13 ? 4 : -1.5); diff.push(dv); }
    var adj = [[973728, '15 days ago', '148.36T', 5.54], [971712, '28 days ago', '140.58T', 5.92], [969696, '6 weeks ago', '132.72T', -0.03],
      [967680, '8 weeks ago', '132.76T', 4.16], [965664, '10 weeks ago', '127.45T', 1.31], [963648, '12 weeks ago', '125.81T', -1.31]];
    var blockRows = blocks.map(function (b) {
      return '<tr><td><a href="#block-' + b.height + '">' + b.height + '</a></td><td class="pool-cell">' + poolBadge(b.pool) + '</td>' +
        '<td class="end"><span class="badge rbf">' + (99.9 + (b.height % 10) / 100).toFixed(2) + '%</span></td><td class="end">' + (3.125 + b.btc).toFixed(2) + ' <span class="symbol">' + unit + '</span></td></tr>';
    }).join('');
    var adjRows = adj.map(function (a) {
      return '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td class="end">' + a[2] + '</td><td class="end ' + (a[3] >= 0 ? 'up' : 'down') + '">' + (a[3] >= 0 ? '+' : '') + a[3].toFixed(2) + '%</td></tr>';
    }).join('');
    return '<div class="container-xl dashboard-container"><div class="row">' +
      card('Reward stats&nbsp; <span style="text-transform:none">(144 blocks)</span>', '<div class="acc-stats">' +
        stat('Miners Reward', reward.toFixed(2) + ' <span class="unit">' + unit + '</span>', D.price ? fiat(reward) : '', 'fiat') +
        stat('Avg Block Fees', avgFees.toFixed(4) + ' <span class="unit">' + unit + '/block</span>', D.price ? fiat(avgFees) : '', 'fiat') +
        stat('Avg Tx Fee', commas(avgFees * 1e8 / Math.max(1, avgTx)) + ' <span class="unit">sats/tx</span>', D.price ? fiat(avgFees / Math.max(1, avgTx)) : '', 'fiat third-sub') + '</div>', ' acc') +
      card('Difficulty adjustment', '<div class="acc-stats">' +
        stat('Remaining', commas(left) + ' <span class="unit">blocks</span>', d.remaining) +
        stat('Estimate', signed(d.change) + ' <span class="pct">%</span>', 'Previous: ' + signed(d.prev, true) + ' %') +
        stat('Next Halving', 'Apr 12, 2028', 'In ~1 year, 151 days') + '</div>', ' acc') +
      '<div class="col"><div class="card graph-card"><div class="card-body tab-chart-card"><div class="mempool-info-data">' +
        '<div class="item"><h5 class="card-title">Pools Luck</h5><p class="card-text">85.42%</p></div><div class="item"><h5 class="card-title">Blocks (1w)</h5><p class="card-text">861</p></div>' +
        '<div class="item"><h5 class="card-title">Pools Count</h5><p class="card-text">15</p></div></div>' +
        '<div class="tab-chart">' + donut(pools, 500, 340) + '</div><a class="view-more" href="#graphs">View more &raquo;</a></div></div></div>' +
      '<div class="col"><div class="card graph-card"><div class="card-body tab-chart-card"><div class="mempool-info-data">' +
        '<div class="item"><h5 class="card-title">Hashrate (1w)</h5><p class="card-text">925 EH/s</p></div><div class="item"><h5 class="card-title">Difficulty</h5><p class="card-text">148.36T</p></div></div>' +
        '<div class="tab-chart">' + lineChart([{ values: hash, color: '#c9b52b', width: 1 }, { values: series(43, 160, 980, 40, 0.4).map(function (v) { return Math.max(800, Math.min(1180, v)); }), color: '#8bc34a', width: 2 }, { values: diff.map(function (v) { return 780 + (v - 120) * 15; }), color: '#e3125d', step: true, width: 2 }],
          500, 340, { max: 1250, min: 750, fmt: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + ' ZH/s' : Math.round(v) + ' EH/s'; }, xLabels: ['2026', 'Mar', 'May', 'Jul', 'Sep', 'Nov'], left: 62, label: 'Hashrate and difficulty' }) +
        '</div><a class="view-more" href="#graphs">View more &raquo;</a></div></div></div>' +
      '<div class="col"><div class="card"><div class="card-body"><a class="title-link" href="#mining">Recent Blocks' + I.ext + '</a><table class="table mining-table"><thead><tr><th>Height</th><th>Pool</th><th class="end">Health</th><th class="end">Reward</th></tr></thead><tbody>' + blockRows + '</tbody></table></div></div></div>' +
      '<div class="col"><div class="card"><div class="card-body"><a class="title-link" href="#mining">Adjustments' + I.ext + '</a><table class="table mining-table"><thead><tr><th>Height</th><th>Adjusted</th><th class="end">Difficulty</th><th class="end">Change</th></tr></thead><tbody>' + adjRows + '</tbody></table></div></div></div>' +
      '</div></div>';
  }

  function networkMap() {
    // a stylised map of nodes and channels, drawn fresh from a fixed seed
    var r = seeded(97), W = 1440, H = 210, nodes = [], hubs = [[260, 170], [300, 120], [740, 150], [760, 175], [1100, 120], [1225, 228], [420, 200], [880, 120]];
    for (var i = 0; i < 160; i++) {
      var hub = hubs[Math.floor(r() * hubs.length)];
      nodes.push([hub[0] + (r() - 0.5) * 220, hub[1] + (r() - 0.5) * 90]);
    }
    var lines = '';
    for (var k = 0; k < 260; k++) {
      var a = nodes[Math.floor(r() * nodes.length)], b = hubs[Math.floor(r() * hubs.length)];
      lines += '<line x1="' + a[0].toFixed(0) + '" y1="' + a[1].toFixed(0) + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="#7fb2ff" stroke-opacity=".28" stroke-width=".8"/>';
    }
    var dots = nodes.map(function (n) { return '<circle cx="' + n[0].toFixed(0) + '" cy="' + n[1].toFixed(0) + '" r="2" fill="#fff"/>'; }).join('');
    return '<div class="ln-map"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of lightning nodes and channels">' +
      '<rect width="' + W + '" height="' + H + '" fill="#06070c"/><ellipse cx="720" cy="150" rx="640" ry="120" fill="#11152a"/>' + lines + dots + '</svg></div>';
  }
  function lightningView() {
    var med = tabState.lnStat === 'med';
    var hosts = [['Cloud North', 30], ['Cloud West', 12], ['Hosting Co.', 9], ['DataCentre One', 7], ['Edge Net', 6], ['Metro Fibre', 5], ['Rack Space Ltd', 4], ['Island Hosting', 3], ['Valley ISP', 3], ['Other', 21]];
    var aliases = ['tidewater-01', 'Harbor Node', 'deepchannel', 'tidewater-02', 'reef-east-1', 'Lantern Hub'];
    var liq = [425.37, 368.08, 366.37, 277.54, 276.1, 256.68];
    var conn = [['Harbor Node', 1845, 'United States'], ['Lantern Hub', 1684, 'New York'], ['Driftwood', 1315, 'Frankfurt am Main'], ['Coral.Thailand', 1209, 'Bangkok'], ['Kelp.chengdu', 804, 'Chengdu'], ['reef-east-1', 598, 'Ashburn']];
    var toggler = ['avg', 'med'].map(function (k) { return '<a href="#" data-lnstat="' + k + '" class="' + (tabState.lnStat === k ? 'inactive' : '') + '">' + k + '</a>'; }).join('<span class="sep">|</span>');
    var cap = series(51, 120, 52000, 4000).map(function (v) { return Math.min(78000, Math.max(30000, v)); });
    return networkMap() + '<div class="container-xl dashboard-container"><div class="row">' +
      card('Network statistics', '<div class="acc-stats">' + stat('Capacity', '3,795.49 <span class="unit">' + unit + '</span>') + stat('Nodes', '16,244') + stat('Channels', '32,679') + '</div>', ' acc') +
      '<div class="col card-wrapper acc"><div class="main-title">Channels statistics</div><div class="card"><div class="widget-toggler">' + toggler + '</div><div class="card-body"><div class="acc-stats">' +
        stat('Avg Capacity'.replace('Avg', med ? 'Med' : 'Avg'), (med ? '2,000,000' : '11,614,456') + ' <span class="unit">sats</span>') +
        stat(med ? 'Med Fee Rate' : 'Avg Fee Rate', (med ? '100' : '824') + ' <span class="unit">ppm</span>') +
        stat(med ? 'Med Base Fee' : 'Avg Base Fee', (med ? '1,000' : '902') + ' <span class="unit">mSats</span>') + '</div></div></div></div>' +
      '<div class="col"><div class="card graph-card"><div class="card-body tab-chart-card"><div class="mempool-info-data">' +
        '<div class="item"><h5 class="card-title">Clearnet Capacity</h5><p class="card-text">3,191.24 <span class="unit">' + unit + '</span></p></div><div class="item"><h5 class="card-title">Tor Capacity</h5><p class="card-text">65.78 <span class="unit">' + unit + '</span></p></div>' +
        '<div class="item"><h5 class="card-title">Unknown Capacity</h5><p class="card-text">487.13 <span class="unit">' + unit + '</span></p></div></div>' +
        '<div class="tab-chart">' + donut(hosts, 500, 340) + '</div><a class="view-more" href="#graphs">View more &raquo;</a></div></div></div>' +
      '<div class="col"><div class="card graph-card"><div class="card-body tab-chart-card"><h5 class="card-title">Lightning Network History</h5>' +
        '<div class="tab-chart two">' + lineChart([{ values: cap, color: '#e3125d', fill: 'rgba(227,18,93,.45)' }, { values: series(52, 120, 3600, 160, -6).map(function (v) { return v * 12; }), color: '#ffc107', width: 2 }], 500, 175,
          { max: 80000, fmt: function (v) { return v ? Math.round(v / 1000) + 'k' : '0'; }, xLabels: ['2024', 'Jul', '2025', 'Jul', '2026', 'Jul'], label: 'Lightning network capacity' }) +
        lineChart([{ values: series(53, 120, 15000, 900, 25).map(function (v) { return Math.min(17500, v); }), color: '#9b23b0', fill: 'rgba(155,35,176,.45)' }, { values: series(54, 120, 4000, 300, 30).map(function (v) { return Math.min(9000, v); }), color: '#ffc107', fill: 'rgba(255,193,7,.35)' }], 500, 175,
          { max: 18000, fmt: function (v) { return v ? Math.round(v / 1000) + 'k' : '0'; }, xLabels: ['2024', 'Jul', '2025', 'Jul', '2026', 'Jul'], label: 'Lightning nodes per network' }) +
        '</div><a class="view-more" href="#graphs">View more &raquo;</a></div></div></div>' +
      '<div class="col"><div class="card"><div class="card-body"><a class="title-link" href="#lightning">Liquidity Ranking' + I.ext + '</a><table class="table mining-table"><thead><tr><th>Alias</th><th class="end">Liquidity</th><th class="end">' + settings.currency + '</th></tr></thead><tbody>' +
        aliases.map(function (a, i) { return '<tr><td><a href="#lightning" data-section="Lightning node pages">' + a + '</a></td><td class="end">' + liq[i].toFixed(2) + ' <span class="symbol">' + unit + ' (' + (liq[i] / 37.95).toFixed(1) + '%)</span></td><td class="end fiat">' + fiat(liq[i]) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>' +
      '<div class="col"><div class="card"><div class="card-body"><a class="title-link" href="#lightning">Connectivity Ranking' + I.ext + '</a><table class="table mining-table"><thead><tr><th>Alias</th><th class="end">Channels</th><th class="end">Location</th></tr></thead><tbody>' +
        conn.map(function (c) { return '<tr><td><a href="#lightning" data-section="Lightning node pages">' + c[0] + '</a></td><td class="end">' + commas(c[1]) + ' <span class="symbol">(' + (c[1] / 326.8).toFixed(1) + '%)</span></td><td class="end">' + c[2] + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>' +
      '</div></div>';
  }

  function graphsView() {
    var ranges = ['2h', '24h', '1w', '1m', '3m', '6m', '1y', '2y', '3y'];
    var points = { '2h': 60, '24h': 96, '1w': 84, '1m': 90, '3m': 90, '6m': 90, '1y': 104, '2y': 104, '3y': 108 }[tabState.graphRange];
    var bands = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100];
    var r = seeded(ranges.indexOf(tabState.graphRange) * 31 + 7);
    var base = series(60 + ranges.indexOf(tabState.graphRange), points, 120, 30).map(function (v) { return Math.max(40, Math.min(220, v)); });
    var W = 1000, H = 420, L = 70, R = W - 20, T = 16, B = H - 30, max = 300, stack = [], prev = base.map(function () { return 0; });
    bands.forEach(function (bnd, k) {
      var share = Math.pow(0.72, k) * (0.8 + r() * 0.4);
      var cur = base.map(function (v, i) { return prev[i] + v * share * 0.32; });
      stack.push({ fee: bnd, lo: prev, hi: cur });
      prev = cur;
    });
    var paths = '', x = function (i) { return L + i / (points - 1) * (R - L); }, y = function (v) { return B - Math.min(v, max) / max * (B - T); };
    stack.slice().reverse().forEach(function (s) {
      var d = 'M' + x(0) + ' ' + y(s.hi[0]);
      for (var i = 1; i < points; i++) d += ' L' + x(i).toFixed(1) + ' ' + y(s.hi[i]).toFixed(1);
      for (var j = points - 1; j >= 0; j--) d += ' L' + x(j).toFixed(1) + ' ' + y(s.lo[j]).toFixed(1);
      paths += '<path d="' + d + ' Z" fill="' + feeColor(s.fee) + '"><title>' + s.fee + ' sat/vB and up</title></path>';
    });
    var grid = '';
    for (var k = 0; k <= 6; k++) { var v = max / 6 * k; grid += '<line x1="' + L + '" x2="' + R + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#ffffff1a" stroke-dasharray="1 3"/>' + svgText(L - 8, y(v) + 4, v + ' MvB', { anchor: 'end' }); }
    var legend = bands.map(function (b) { return '<span class="lg"><i style="background:' + feeColor(b) + '"></i>' + b + '</span>'; }).join('');
    var tps = series(70 + ranges.indexOf(tabState.graphRange), points, 900, 260).map(function (v) { return Math.max(300, Math.min(2600, v)); });
    var btns = ranges.map(function (rg) { return '<button type="button" class="pg' + (rg === tabState.graphRange ? ' active' : '') + '" data-range="' + rg + '">' + rg.toUpperCase() + '</button>'; }).join('');
    return '<div class="container-xl tab-page">' +
      '<div class="graph-head"><h1>Mempool by vBytes <span class="symbol">(sat/vB)</span></h1><div class="pager ranges">' + btns + '</div></div>' +
      '<div class="graph-box"><div class="legend">' + legend + '</div><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Mempool size by fee rate">' + grid + paths + '</svg></div>' +
      '<div class="graph-head"><h1>Transactions <span class="symbol">vBytes per second (vB/s)</span></h1></div>' +
      '<div class="graph-box small">' + lineChart([{ values: tps, color: '#8bc34a', width: 2 }, { values: tps.map(function () { return 1667; }), color: '#ffffff', width: 1.5 }], 1000, 300,
        { max: 2800, fmt: function (v) { return commas(v); }, left: 70, label: 'Transactions per second' }) + '</div></div>';
  }

  function enterpriseView() {
    var items = [['Your own instance', 'Run a private deep pool for your team, with your own branding and nothing shared with anyone else.'],
      ['Higher limits', 'Look up as many blocks, addresses and transactions as your work needs, without waiting.'],
      ['Priority help', 'Talk to people who know the explorer inside out, whenever something needs a closer look.']];
    return '<div class="container-xl tab-page enterprise">' +
      '<div class="ent-hero"><h1>deep pool for teams</h1><p>Everything the explorer shows, set up for businesses that watch the Bitcoin network all day.</p>' +
      '<button type="button" class="sponsor big" data-section="Enterprise sign-up">Get in touch</button></div>' +
      '<div class="ent-grid">' + items.map(function (it) { return '<div class="ent-card"><h3>' + it[0] + '</h3><p>' + it[1] + '</p></div>'; }).join('') + '</div></div>';
  }
  function aboutView() {
    return '<div class="container-xl tab-page about">' +
      '<div class="about-logo">' + logo() + '</div>' +
      '<p class="about-lead">deep pool is a Bitcoin explorer: a window onto the transactions waiting to be confirmed, the blocks being mined and the fees people pay to get in.</p>' +
      '<div class="ent-grid">' +
      '<div class="ent-card"><h3>What it shows</h3><p>The strip of blocks at the top: waiting blocks on the left, mined blocks on the right. Click any block, transaction or address to see its details.</p></div>' +
      '<div class="ent-card"><h3>Built to be read</h3><p>Rises and falls always carry an arrow as well as a colour, and a high-contrast theme is one click away in the footer.</p></div>' +
      '<div class="ent-card"><h3>Runs on its own</h3><p>deep pool needs no server and talks to no outside service. Everything it shows is built in, and it keeps itself moving while it is open.</p></div>' +
      '</div><p class="about-version">Version 3.4 &middot; deep pool</p></div>';
  }
  function docsView() {
    var faqs = [['What is a mempool?', 'It is the waiting room for transactions that have been sent but not yet put into a block. Miners pick from it, usually the ones paying the highest fee for their size first.'],
      ['Why isn\'t my transaction confirming?', 'Its fee rate may be lower than what others are paying right now. Compare it with the fee ranges on the waiting blocks: if it is below the last block\'s range it will wait until the queue clears.'],
      ['What are the blocks at the top?', 'On the right are recently mined blocks, newest first. On the left are the blocks the waiting transactions would make if they were mined now.'],
      ['What does RBF mean?', 'Replace-by-fee: a transaction was swapped for a new version paying a higher fee, so it gets mined sooner.'],
      ['Is this a test network?', net === 'mainnet' ? 'No, these pages show the main Bitcoin network.' : 'Yes. Coins on ' + NET_LABEL[net] + ' have no value and are only used for testing.']];
    return '<div class="container-xl tab-page docs"><h1>Documentation</h1><p class="about-lead">Answers to the questions people ask most.</p>' +
      faqs.map(function (f, i) {
        var open = tabState.faq === i;
        return '<div class="faq' + (open ? ' open' : '') + '"><button type="button" class="faq-q" data-faq="' + i + '" aria-expanded="' + open + '">' + f[0] + '<span aria-hidden="true">' + (open ? '&minus;' : '+') + '</span></button>' + (open ? '<div class="faq-a">' + f[1] + '</div>' : '') + '</div>';
      }).join('') + '</div>';
  }
  function faucetView() {
    return '<div class="container-xl tab-page faucet"><h1>' + NET_LABEL[net] + ' Faucet</h1>' +
      '<p class="about-lead">Get a small amount of test coins to try things out. Test coins have no value.</p>' +
      '<form class="faucet-form" autocomplete="off"><input type="text" name="addr" placeholder="Your ' + NET_LABEL[net] + ' address (tb1...)" aria-label="Address">' +
      '<select name="amount" aria-label="Amount"><option>0.001</option><option selected>0.005</option><option>0.01</option></select>' +
      '<button type="submit" class="sponsor big">Send</button></form><div class="faucet-log" id="faucet-log"></div></div>';
  }
  function tabView(id) {
    if (id === 'mining') return miningView();
    if (id === 'lightning') return lightningView();
    if (id === 'graphs') return graphsView();
    if (id === 'enterprise') return enterpriseView();
    if (id === 'about') return aboutView();
    if (id === 'docs') return docsView();
    if (id === 'faucet') return faucetView();
    return '';
  }
  document.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('.goggles-show'))) { settings.gogglesOpen = !settings.gogglesOpen; renderContent(); return; }
    if ((t = e.target.closest('[data-lnstat]'))) { e.preventDefault(); tabState.lnStat = t.getAttribute('data-lnstat'); renderContent(); return; }
    if ((t = e.target.closest('[data-range]'))) { tabState.graphRange = t.getAttribute('data-range'); renderContent(); return; }
    if ((t = e.target.closest('[data-faq]'))) { var i = +t.getAttribute('data-faq'); tabState.faq = tabState.faq === i ? -1 : i; renderContent(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('.faucet-form');
    if (!f) return;
    e.preventDefault();
    var addr = f.addr.value.trim(), log = document.getElementById('faucet-log');
    if (!/^tb1[02-9ac-hj-np-z]{8,87}$/i.test(addr) && !/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) { toast('That doesn\'t look like a ' + NET_LABEL[net] + ' address.'); return; }
    var txid = hexFrom(seeded(strSeed(addr) + Date.now() % 1000), 64);
    log.insertAdjacentHTML('afterbegin', '<p>Sent ' + f.amount.value + ' ' + unit + ' to <span class="mono">' + esc(addr) + '</span>: transaction <span class="mono">' + txid.slice(0, 16) + '&hellip;</span></p>');
    f.addr.value = '';
    toast('Test coins sent.');
  });

  // which view is open follows the address, so the browser's back button works
  function readHash() {
    var h = location.hash, m;
    if ((m = /^#block-(\d+)$/.exec(h))) return { kind: 'block', id: m[1] };
    if ((m = /^#mempool-block-(\d+)$/.exec(h))) return { kind: 'projected', id: m[1] };
    if ((m = /^#(mining|lightning|graphs|enterprise|about|docs|faucet)$/.exec(h))) return { kind: 'tab', id: m[1] };
    if ((m = /^#address-([A-Za-z0-9]{14,90})$/.exec(h)) && isAddress(m[1])) return { kind: 'address', id: m[1] };
    return null;
  }
  function applyHash(scroll) {
    var next = readHash();
    var changed = JSON.stringify(next) !== JSON.stringify(selected);
    if (changed) view.page = 1;
    selected = next;
    if (selected && selected.kind === 'block') {
      var found = false;
      D.blocks.forEach(function (x) { if (String(x.height) === selected.id) found = true; });
      if (!found) { toast('Block ' + selected.id + ' is no longer in view.'); selected = null; }
    }
    renderBlockchain();
    renderContent();
    if (selected && selected.kind === 'tab') window.scrollTo(0, 0);
    else if (selected && scroll) {
      var top = document.getElementById('blockchain').getBoundingClientRect().top + window.pageYOffset - 70;
      if (window.pageYOffset > top + 200) window.scrollTo(0, Math.max(0, top));
    }
  }
  // open a view straight away on click (and still record it in the address for the back button)
  function go(href) {
    var url = href ? href : location.pathname + location.search;
    if (href && location.hash === href) { applyHash(true); return; }
    history.pushState(null, '', url);
    applyHash(true);
  }
  function onAddressChange() { if (JSON.stringify(readHash()) !== JSON.stringify(selected)) applyHash(true); }
  window.addEventListener('hashchange', onAddressChange);
  window.addEventListener('popstate', onAddressChange);

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var section = e.target.closest('[data-section]');
    if (section) { toast(section.getAttribute('data-section') + ' isn\'t part of deep pool yet.'); return; }
    if (e.target.closest('.blk-close')) { go(''); return; }
    var pg = e.target.closest('[data-page]');
    if (pg) { view.page = +pg.getAttribute('data-page'); renderContent(); var bv = document.querySelector('.tx-header'); if (bv) bv.scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('.details-btn')) { view.details = !view.details; renderContent(); return; }
    var br = e.target.closest('[data-balrange]');
    if (br) { e.preventDefault(); addrView.range = br.getAttribute('data-balrange'); renderContent(); return; }
    var cp = e.target.closest('[data-copy]');
    if (cp) {
      var text = cp.getAttribute('data-copy');
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }, function () { toast(text); });
      else toast(text);
      return;
    }
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href === '#') { if (a.classList.contains('blk-nav')) e.preventDefault(); return; }
    if (/^#(block-\d+|mempool-block-\d+|address-[A-Za-z0-9]+|mining|lightning|graphs|enterprise|about|docs|faucet)$/.test(href)) { e.preventDefault(); go(href); return; }
    e.preventDefault();
    var m;
    if ((m = /^#tx-([0-9a-f]{64})$/.exec(href))) return showTx(m[1]);
    if (href === '#address') return toast('Address pages aren\'t part of deep pool yet.');
    if (href === '#hash') return toast(a.getAttribute('title'));
    var name = a.getAttribute('title') || a.getAttribute('aria-label') || a.textContent.trim() || href.slice(1);
    toast(name.replace(/\s+/g, ' ') + ' isn\'t part of deep pool yet. Try the dashboard, the network pages or the Accelerator.');
  });

  // ---------- activity (self-contained, no outside services) ----------
  // The site never contacts another server. After a short pause it keeps itself moving on its own:
  // new transactions arrive, fees drift, and roughly every ten minutes the next waiting block is mined.
  var poolNames = ['AntPool', 'Foundry USA', 'F2Pool', 'ViaBTC', 'SpiderPool', 'MARA Pool', 'Luxor', 'Braiins Pool'];
  var live = seeded(Date.now() % 100000);
  function liveHex() { var h = ''; for (var i = 0; i < 64; i++) h += '0123456789abcdef'[Math.floor(live() * 16)]; return h; }
  function newTransaction() {
    var fee = Math.max(D.fees[0], D.fees[1] * (0.6 + live() * 2));
    var value = Math.pow(10, -3 + live() * 3.5);
    D.recent.unshift({ txid: liveHex(), value: value, fee: fee, usd: null });
    D.recent.length = Math.min(D.recent.length, 6);
    D.info.count += Math.round(1 + live() * 6);
  }
  function newReplacement() {
    var prev = D.fees[1] * (0.5 + live());
    D.replacements.unshift({ txid: liveHex(), prev: prev, fee: prev * (1.1 + live() * 0.6), status: ['rbf'] });
    D.replacements.length = Math.min(D.replacements.length, 6);
  }
  function mineBlock() {
    var next = D.mempool.shift();
    if (!next) return;
    var top = D.blocks[0];
    D.blocks.unshift({ height: top.height + 1, median: next.median, range: next.range.slice(), btc: next.btc, txs: next.txs,
      minutes: -(Date.now() - D.minutesBase) / 60000, fullness: next.fullness, pool: net === 'mainnet' ? poolNames[Math.floor(live() * poolNames.length)] : top.pool });
    D.blocks.length = Math.min(D.blocks.length, 28);
    var last = D.mempool[D.mempool.length - 1] || next;
    D.mempool.push({ median: last.median, range: last.range.slice(), btc: last.btc, txs: last.txs, fullness: last.fullness, blocks: 1 });
    D.info.count = Math.max(0, D.info.count - next.txs);
    D.difficulty.height = top.height + 1;
    D.blocksMined = (D.blocksMined || 0) + 1;
    goggles.seed++;
    goggles.txs = null;
  }
  function tick() {
    D.live = true;
    newTransaction();
    if (live() < 0.35) newReplacement();
    if (live() < 0.025) mineBlock(); // about one block every ten minutes at one tick per 15 s
    renderBlockchain();
    renderContent();
  }
  setTimeout(function () { tick(); setInterval(tick, 15000); }, 45000);
  if (readHash()) applyHash(false);
})();
