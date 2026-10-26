const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { gzipSync, deflateSync } = require('node:zlib');
const express = require('express');

// Exercise the parser used in src/index.js without a database or real devices.
// Trailing-byte fixtures follow the upstream GHSA-27r3-jxmh-p828 regressions.
async function withServer(t, { waitForEnd = false } = {}) {
  const app = express();
  let finishBody;
  app.use(express.json({ limit: '10mb' }));
  app.post('/', (req, res) => {
    if (waitForEnd && !req.complete) {
      req.once('end', () => res.json(req.body));
      finishBody();
    } else {
      res.json(req.body);
    }
  });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.type }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  function request(body, encoding, trailing) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1', port: server.address().port, agent: false,
        method: body ? 'POST' : 'GET', path: body ? '/' : '/health',
        headers: body ? {
          'Content-Type': 'application/json',
          ...(encoding ? { 'Content-Encoding': encoding } : {}),
          'Content-Length': body.length + (trailing?.length || 0)
        } : {}
      }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.setTimeout(2000, () => req.destroy(new Error('Request did not finish')));
      if (trailing) {
        finishBody = () => req.end(trailing);
        req.write(body);
      } else {
        req.end(body);
      }
    });
  }
  return request;
}

test('plain and compressed JSON still parse correctly', { timeout: 5000 }, async t => {
  const request = await withServer(t);
  const json = Buffer.from('{"a":1}');
  for (const [body, encoding] of [[json], [gzipSync(json), 'gzip'], [deflateSync(json), 'deflate']]) {
    assert.deepEqual(await request(body, encoding), { status: 200, body: { a: 1 } });
  }
});

test('trailing gzip bytes do not crash the server', { timeout: 5000 }, async t => {
  const request = await withServer(t);
  const payload = Buffer.concat([gzipSync('{"a":1}'), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]);
  assert.deepEqual(await request(payload, 'gzip'), { status: 200, body: { a: 1 } });
  // Allow asynchronous decoder errors to surface before checking liveness.
  await delay(200);
  assert.deepEqual(await request(), { status: 200, body: { ok: true } });
});

test('early deflate completion drains the remaining HTTP request', { timeout: 5000 }, async t => {
  const request = await withServer(t, { waitForEnd: true });
  const first = Buffer.concat([deflateSync('{"a":1}'), Buffer.from([0])]);
  assert.deepEqual(await request(first, 'deflate', Buffer.alloc(1024)), { status: 200, body: { a: 1 } });
  assert.deepEqual(await request(), { status: 200, body: { ok: true } });
});

test('invalid compressed JSON returns an error without stopping the server', { timeout: 5000 }, async t => {
  const request = await withServer(t);
  assert.equal((await request(Buffer.from('not gzip'), 'gzip')).status, 400);
  assert.deepEqual(await request(), { status: 200, body: { ok: true } });
});
