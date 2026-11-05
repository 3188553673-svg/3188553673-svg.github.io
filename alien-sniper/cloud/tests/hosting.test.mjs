import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { createGameServer } from '../server.js';

const PAGES_ORIGIN = 'https://3188553673-svg.github.io';

async function setup(t) {
  const game = await createGameServer({ port: 0, host: '127.0.0.1' }).listen();
  t.after(() => game.close());
  const port = game.address().port;
  return { port, base: `http://127.0.0.1:${port}` };
}

async function requestWithHost(url, headers) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on('error', reject);
  });
}

test('cloud configuration uses the external HTTPS origin and never exposes local interfaces', async t => {
  const { base } = await setup(t);
  const headers = { host: 'duel.example.onrender.com', 'x-forwarded-proto': 'https, http' };
  for (const route of ['/connection.json', '/api/info']) {
    const response = await requestWithHost(base + route, headers);
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['content-type'], /^application\/json/);
    assert.deepEqual(JSON.parse(response.body), { mode: 'relay', serverUrl: 'https://duel.example.onrender.com' });
  }
  const local = await fetch(base + '/connection.json');
  assert.deepEqual(await local.json(), { mode: 'relay', serverUrl: base });
  const head = await fetch(base + '/connection.json', { method: 'HEAD', headers });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const badHost = await requestWithHost(base + '/connection.json', { host: 'bad host' });
  assert.equal(badHost.status, 400);
});

test('only health checks grant credential-free CORS to the existing GitHub Pages site', async t => {
  const { base } = await setup(t);
  const response = await fetch(base + '/api/health', { headers: { origin: PAGES_ORIGIN } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, mode: 'relay' });
  assert.equal(response.headers.get('access-control-allow-origin'), PAGES_ORIGIN);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Origin');
  const options = await fetch(base + '/api/health', {
    method: 'OPTIONS', headers: { origin: PAGES_ORIGIN, 'access-control-request-method': 'GET' },
  });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), PAGES_ORIGIN);
  assert.match(options.headers.get('access-control-allow-methods'), /GET/);
  for (const route of ['/connection.json', '/api/info', '/index.html']) {
    const other = await fetch(base + route, { headers: { origin: PAGES_ORIGIN } });
    assert.equal(other.headers.get('access-control-allow-origin'), null, route);
  }
  const unknown = await fetch(base + '/api/health', { headers: { origin: 'https://unrelated.example' } });
  assert.equal(unknown.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(base + '/api/health', { method: 'OPTIONS', headers: { origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await fetch(base + '/connection.json', { method: 'OPTIONS', headers: { origin: PAGES_ORIGIN } })).status, 405);
});

test('static hosting permits front-end assets and blocks server source and encoded traversal', async t => {
  const { base } = await setup(t);
  for (const route of ['/', '/app.js', '/rules.js', '/style.css', '/vendor/peerjs.min.js', '/vendor/THREE-LICENSE.txt']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    await response.arrayBuffer();
  }
  const head = await fetch(base + '/rules.js', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get('content-length')) > 0);
  assert.equal(await head.text(), '');
  for (const route of ['/cloud/server.js', '/cloud/package.json', '/cloud/tests/server.test.mjs', '/README.md', '/.github/workflows/pages.yml', '/vendor/%2e%2e%2fcloud/server.js']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404, route);
    assert.doesNotMatch(await response.text(), /import http from/);
  }
  assert.equal((await fetch(base + '/%2e%2e%2fserver.js')).status, 403);
  assert.equal((await fetch(base + '/%00')).status, 403);
  assert.equal((await fetch(base + '/%zz')).status, 400);
});

async function handshake(port, origin, forwarded = false) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const timeout = setTimeout(() => { socket.destroy(); reject(new Error('Handshake timeout')); }, 2000);
    let data = '';
    socket.once('error', reject);
    socket.on('data', chunk => {
      data += chunk.toString();
      if (!data.includes('\r\n\r\n')) return;
      clearTimeout(timeout); socket.destroy(); resolve(data.split('\r\n')[0]);
    });
    socket.once('connect', () => {
      const extra = `${origin ? `Origin: ${origin}\r\n` : ''}${forwarded ? 'X-Forwarded-Proto: https\r\n' : ''}`;
      const host = forwarded ? 'duel.example.onrender.com' : `127.0.0.1:${port}`;
      socket.write(`GET /ws HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n${extra}\r\n`);
    });
  });
}

test('WebSocket allows same-origin, GitHub Pages and native clients while rejecting unrelated websites', async t => {
  const { port, base } = await setup(t);
  assert.match(await handshake(port), /101 Switching Protocols/);
  assert.match(await handshake(port, base), /101 Switching Protocols/);
  assert.match(await handshake(port, PAGES_ORIGIN), /101 Switching Protocols/);
  assert.match(await handshake(port, 'https://duel.example.onrender.com', true), /101 Switching Protocols/);
  assert.match(await handshake(port, 'https://unrelated.example'), /403 Forbidden/);
});
