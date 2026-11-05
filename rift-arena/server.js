import http from 'node:http';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { websocket } from './server/websocket.js';
import { createRoom, addPlayer, removePlayer, applyAction, step, snapshot } from './server/engine.js';
import { CHAMPIONS } from './shared/definitions.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES_ORIGIN = 'https://3188553673-svg.github.io';
const SNAPSHOT_WINDOW = 2;
const SNAPSHOT_ACK_TIMEOUT_MS = 20000;
const PUBLIC = new Set(['index.html', 'app.js', 'style.css', 'scene.js', 'scene-performance.js', 'arena-environment.js', 'original-heroes.js', 'hero-assets.js', 'network.js', 'client-movement.js', 'ui-art.js', 'connection.json', 'shared/definitions.js']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

function publicOrigin(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'https' ? 'https:' : forwarded === 'http' ? 'http:' : req.socket.encrypted ? 'https:' : 'http:';
  const url = new URL(`${protocol}//${req.headers.host || 'localhost'}`);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid host');
  return url.origin;
}
function validOrigin(req) {
  if (!req.headers.origin) return true;
  try { return req.headers.origin === PAGES_ORIGIN || req.headers.origin === publicOrigin(req); }
  catch { return false; }
}
function playerName(value) {
  return String(value || '召唤师').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14) || '召唤师';
}

export function createArenaServer({ port = 9100, host = '0.0.0.0', maxRooms = 30, maxClients = 80 } = {}) {
  const rooms = new Map();
  const clients = new Set();
  let timer = null, previousTime = 0, accumulator = 0, shuttingDown = false;

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
    if (pathname === '/api/health') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Vary', 'Origin');
      if (req.headers.origin === PAGES_ORIGIN) res.setHeader('Access-Control-Allow-Origin', PAGES_ORIGIN);
      if (req.method === 'OPTIONS') {
        res.writeHead(req.headers.origin === PAGES_ORIGIN ? 204 : 403, { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' });
        res.end(); return;
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (pathname === '/api/health' || pathname === '/connection.json') {
      let data;
      try {
        data = pathname === '/api/health'
          ? { ok: !shuttingDown, mode: 'relay', game: 'rift-arena', protocol: 1 }
          : { mode: 'relay', serverUrl: publicOrigin(req) };
      } catch { res.writeHead(400); res.end('Bad request'); return; }
      res.writeHead(shuttingDown ? 503 : 200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data)); return;
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (relative.startsWith('../') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
    const allowed = PUBLIC.has(relative) || relative.startsWith('assets/') || relative.startsWith('vendor/');
    if (!allowed) { res.writeHead(404); res.end('没有找到这个文件'); return; }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      if (relative.startsWith('vendor/')) res.setHeader('Cache-Control', 'public, max-age=604800');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end('没有找到这个文件'); }
  });

  const error = (client, code, message, seq) => client.ws.send({ type: 'error', code, message, ...(Number.isSafeInteger(seq) ? { seq } : {}) });
  function publishState(client) {
    const room = client.room;
    if (!room) return;
    const flow = client.snapshotFlow;
    // An intermediary can accept writes before the browser consumes them.
    // Wait for browser credit and sample the latest room state when it arrives.
    if (flow && client.stateSeq - flow.acknowledged >= SNAPSHOT_WINDOW) {
      flow.pending = true;
      return;
    }
    const state = snapshot(room, client.id);
    const message = client.snapshotEncoding === 'deflate'
      ? { type: 'state', encoding: 'deflate', data: deflateSync(JSON.stringify(state), { level: 1 }).toString('base64') }
      : { type: 'state', state };
    if (flow) {
      if (flow.acknowledged === client.stateSeq) flow.lastProgress = performance.now();
      flow.pending = false;
      message.stateSeq = ++client.stateSeq;
    }
    client.ws.send(message);
  }
  function publish(room) {
    for (const client of clients) if (client.room === room) publishState(client);
  }
  function acknowledgeState(client, stateSeq) {
    const flow = client.snapshotFlow;
    if (!flow || !Number.isSafeInteger(stateSeq) || stateSeq <= flow.acknowledged || stateSeq > client.stateSeq) return;
    flow.acknowledged = stateSeq;
    flow.lastProgress = performance.now();
    if (flow.pending) publishState(client);
  }
  function leave(client) {
    const room = client.room;
    if (!room) return;
    client.room = null;
    client.snapshotEncoding = null;
    client.snapshotFlow = null;
    removePlayer(room, client.id);
    if (!room.players.some(p => !p.isBot)) rooms.delete(room.code);
    else publish(room);
  }
  function join(client, message) {
    if (client.room) return error(client, 'ALREADY_JOINED', '请先离开当前房间');
    const champion = message.champion || 'garen';
    if (typeof champion !== 'string' || !Object.hasOwn(CHAMPIONS, champion)) return error(client, 'CHAMPION', '请选择有效英雄');
    const player = { id: client.id, name: playerName(message.name), champion };
    let room, created = false;
    if (message.create) {
      if (rooms.size >= maxRooms) return error(client, 'BUSY', '房间暂时已满，请稍后重试');
      let code;
      do { code = String(randomInt(1000, 10000)); } while (rooms.has(code));
      room = createRoom(code, player);
      rooms.set(code, room); created = true;
    } else {
      const code = String(message.room || '').trim();
      if (!/^\d{4}$/.test(code)) return error(client, 'ROOM', '请输入四位房间码');
      room = rooms.get(code);
      if (!room) return error(client, 'ROOM', '没有找到房间，请确认房间码或重新创建');
      addPlayer(room, player);
    }
    client.room = room;
    if (created && message.practice === true) {
      try {
        applyAction(room, client.id, { type: 'ready', value: true });
        applyAction(room, client.id, { type: 'bot' });
        applyAction(room, client.id, { type: 'start' });
      } catch (e) { leave(client); throw e; }
    }
    client.snapshotEncoding = message.snapshotEncoding === 'deflate' ? 'deflate' : null;
    client.snapshotFlow = message.snapshotFlow === 'ack'
      ? { acknowledged: client.stateSeq, lastProgress: 0, pending: false }
      : null;
    client.ws.send({ type: 'welcome', id: client.id, room: room.code,
      ...(client.snapshotEncoding ? { snapshotEncoding: client.snapshotEncoding } : {}),
      ...(client.snapshotFlow ? { snapshotFlow: 'ack' } : {}) });
    publish(room);
  }
  function onMessage(client, text) {
    const now = Date.now();
    if (now - client.rateAt >= 1000) { client.rateAt = now; client.rateCount = 0; }
    if (++client.rateCount > 100) { client.ws.close(1008, 'Too many messages'); return; }
    let message;
    try { message = JSON.parse(text); }
    catch { return error(client, 'JSON', '消息格式无效'); }
    if (!message || Array.isArray(message) || typeof message !== 'object' || typeof message.type !== 'string') return error(client, 'MESSAGE', '消息格式无效');
    client.lastSeen = now;
    try {
      if (message.type === 'join') return join(client, message);
      if (message.type === 'ping') return client.ws.send({ type: 'pong', at: Number.isFinite(message.at) ? message.at : now });
      if (message.type === 'state_ack') return acknowledgeState(client, message.stateSeq);
      if (message.type === 'leave') { leave(client); client.ws.send({ type: 'left' }); return; }
      if (!client.room) return error(client, 'ROOM', '请先加入房间');
      const outcome = applyAction(client.room, client.id, message);
      if (Number.isSafeInteger(message.seq)) client.ws.send({ type: 'input_ack', seq: message.seq, ...(outcome?.duplicate ? { duplicate: true } : { accepted: true }) });
      // Simulation snapshots have a single cadence. Lobby changes remain immediate.
      if (client.room.phase !== 'playing') publish(client.room);
    } catch (e) {
      if (Number.isSafeInteger(message.seq)) client.ws.send({ type: 'input_ack', seq: message.seq, accepted: false });
      error(client, e.code || 'ACTION', e.message || '操作未完成', message.seq);
    }
  }

  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (req.url !== '/ws' || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || Buffer.from(key, 'base64').length !== 16 || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return;
    }
    if (!validOrigin(req)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    if (shuttingDown || clients.size >= maxClients) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { id: randomUUID().slice(0, 12), room: null, ws: null, snapshotEncoding: null, snapshotFlow: null, stateSeq: 0, lastSeen: Date.now(), rateAt: Date.now(), rateCount: 0 };
    client.ws = websocket(socket, text => onMessage(client, text), () => { leave(client); clients.delete(client); });
    clients.add(client);
    if (head.length) client.ws.feed(head);
  });

  function tick() {
    const now = performance.now();
    accumulator += Math.max(0, (now - previousTime) / 1000);
    previousTime = now;
    const steps = Math.min(5, Math.floor((accumulator + 1e-6) / .05));
    accumulator -= steps * .05;
    // A long OS pause cannot trigger an unbounded catch-up loop. Ordinary jitter
    // is retained instead of silently deleting simulation time above 100 ms.
    accumulator = Math.min(accumulator, .25);
    for (const room of rooms.values()) {
      if (room.phase !== 'playing') continue;
      try {
        for (let i = 0; i < steps; i++) step(room, .05);
        if (steps > 0) publish(room);
      } catch (e) {
        console.error('Room simulation failed:', e.message);
        for (const client of [...clients]) if (client.room === room) client.ws.close(1011, '对局发生错误，请重新建房');
        rooms.delete(room.code);
      }
    }
    const dateNow = Date.now();
    for (const client of clients) {
      const flow = client.snapshotFlow;
      if (flow && flow.acknowledged < client.stateSeq && now - flow.lastProgress > SNAPSHOT_ACK_TIMEOUT_MS) {
        client.ws.close(1013, '同步超时，请重新加入');
      } else if (dateNow - client.lastSeen > 90000) {
        client.ws.close(1001, '连接超时，请重新加入');
      }
    }
  }
  return {
    server, rooms, clients, address: () => server.address(),
    async listen() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); });
      previousTime = performance.now(); timer = setInterval(tick, 50); timer.unref(); return this;
    },
    async close() {
      if (shuttingDown) return;
      shuttingDown = true; clearInterval(timer);
      for (const client of [...clients]) client.ws.close(1001, '服务器正在重启，请重新创建房间');
      await new Promise(resolve => server.close(resolve));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arena = createArenaServer({ port: Number(process.env.PORT) || 9100 });
  arena.listen().then(() => console.log(`Rift Arena listening on 0.0.0.0:${arena.address().port}`)).catch(e => { console.error(e.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => arena.close().finally(() => process.exit()));
}
