// npm run dev: builds the site, serves dist/ on http://localhost:8000 (PORT=… to change it) and
// rebuilds whenever a file in src/ changes. Reload the browser to see the change. No dependencies.
'use strict';
const { execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8000;

function build() {
  try { execFileSync('sh', [path.join(__dirname, 'build.sh')], { stdio: 'inherit' }); }
  catch (e) { console.error('build failed; fix the error and save again'); }
}
build();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); return res.end(); } // like GitHub Pages
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('deep pool on http://localhost:' + PORT + '/ (Ctrl+C to stop); rebuilding on changes in src/'));

let timer = null;
fs.watch(SRC, { recursive: true }, (event, file) => {
  clearTimeout(timer);
  timer = setTimeout(() => { console.log('changed: ' + file); build(); }, 150);
});
