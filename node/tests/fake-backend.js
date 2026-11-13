// Stand-in for the mempool backend in gateway.test.sh: echoes the path it was asked for and
// answers WebSocket upgrades with one "hi" message.
const http = require('http'), crypto = require('crypto');
const s = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', server: 'backend' }); res.end(JSON.stringify({ path: req.url, method: req.method })); });
s.on('upgrade', (req, sock) => {
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\nX-Path: ' + req.url + '\r\n\r\n');
  sock.write(Buffer.from([0x81, 2, 0x68, 0x69])); // text frame "hi"
});
s.listen(8999);
