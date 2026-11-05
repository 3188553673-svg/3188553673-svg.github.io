import http from 'node:http';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WALL, TARGET_BOUNDS, POSES, hitTarget, targetVisible } from '../rules.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES_ORIGIN = 'https://3188553673-svg.github.io';
const PUBLIC_FILES = new Set(['index.html', 'app.js', 'style.css', 'rules.js', 'scene.js', 'engine.js', 'p2p-transport.js', 'cloud-transport.js', 'network-config.js', 'connection.json']);
const MAX_MESSAGE = 64 * 1024;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function frame(opcode, payload = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Small RFC 6455 server transport. Clients always mask; fragmented text and control frames are supported. */
function websocket(socket, onMessage, onClose) {
  let buffer = Buffer.alloc(0);
  let fragments = [];
  let fragmentLength = 0;
  let fragmented = false;
  let closed = false;
  let reported = false;
  const report = () => { if (!reported) { reported = true; onClose(); } };
  const connection = {
    send(value) {
      if (closed || socket.destroyed || socket.writableLength > 1024 * 1024) return;
      socket.write(frame(1, JSON.stringify(value)));
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      const message = Buffer.from(reason).subarray(0, 123);
      const data = Buffer.alloc(message.length + 2);
      data.writeUInt16BE(code);
      message.copy(data, 2);
      socket.end(frame(8, data));
      const timer = setTimeout(() => socket.destroy(), 500);
      timer.unref();
      report();
    },
    feed(chunk) {
      if (closed) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_MESSAGE + 1024) return connection.close(1009, 'Message too large');
      while (buffer.length >= 2 && !closed) {
        const first = buffer[0], second = buffer[1];
        const fin = Boolean(first & 0x80), opcode = first & 0x0f;
        if ((first & 0x70) || !(second & 0x80)) return connection.close(1002, 'Invalid frame');
        let length = second & 0x7f, offset = 2;
        if (length === 126) {
          if (buffer.length < 4) return;
          length = buffer.readUInt16BE(2);
          offset = 4;
          if (length < 126) return connection.close(1002, 'Invalid length');
        } else if (length === 127) {
          if (buffer.length < 10) return;
          const big = buffer.readBigUInt64BE(2);
          if (big > BigInt(MAX_MESSAGE)) return connection.close(1009, 'Message too large');
          length = Number(big);
          offset = 10;
          if (length <= 65535) return connection.close(1002, 'Invalid length');
        }
        if (length > MAX_MESSAGE || fragmentLength + length > MAX_MESSAGE) return connection.close(1009, 'Message too large');
        if (opcode >= 8 && (!fin || length > 125)) return connection.close(1002, 'Invalid control frame');
        if (buffer.length < offset + 4 + length) return;
        const mask = buffer.subarray(offset, offset + 4);
        offset += 4;
        const data = Buffer.from(buffer.subarray(offset, offset + length));
        buffer = buffer.subarray(offset + length);
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        if (opcode === 8) {
          if (data.length === 1) return connection.close(1002, 'Invalid close');
          closed = true;
          socket.end(frame(8, data));
          report();
          return;
        }
        if (opcode === 9) { socket.write(frame(10, data)); continue; }
        if (opcode === 10) continue;
        if (opcode === 2) return connection.close(1003, 'Text messages only');
        if (opcode !== 0 && opcode !== 1) return connection.close(1002, 'Unknown opcode');
        if (opcode === 0 && !fragmented || opcode === 1 && fragmented) return connection.close(1002, 'Invalid continuation');
        if (opcode === 1 && !fin) { fragmented = true; fragments = [data]; fragmentLength = data.length; continue; }
        if (opcode === 0) { fragments.push(data); fragmentLength += data.length; if (!fin) continue; }
        const message = opcode === 0 ? Buffer.concat(fragments, fragmentLength) : data;
        fragments = []; fragmentLength = 0; fragmented = false;
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(message); }
        catch { return connection.close(1007, 'Invalid UTF-8'); }
        onMessage(text);
      }
    },
  };
  socket.on('data', connection.feed);
  socket.on('error', report);
  socket.on('close', report);
  socket.setNoDelay(true);
  return connection;
}

function sanitizeName(value) {
  return String(value || '匿名狙击手').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14) || '匿名狙击手';
}

/** Render terminates TLS before forwarding the request to this process. */
function publicOrigin(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwarded === 'https' ? 'https:' : forwarded === 'http' ? 'http:' : req.socket.encrypted ? 'https:' : 'http:';
  const parsed = new URL(`${protocol}//${req.headers.host || 'localhost'}`);
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Invalid host');
  return parsed.origin;
}

function validSocketOrigin(req) {
  if (!req.headers.origin) return true; // Native clients do not send browser Origin headers.
  try { return req.headers.origin === PAGES_ORIGIN || req.headers.origin === publicOrigin(req); }
  catch { return false; }
}

export function createGameServer({ port = 10000, host = '0.0.0.0' } = {}) {
  const rooms = new Map();
  const clients = new Set();
  let timer;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (pathname === '/api/health') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Vary', 'Origin');
      if (req.headers.origin === PAGES_ORIGIN) res.setHeader('Access-Control-Allow-Origin', PAGES_ORIGIN);
      if (req.method === 'OPTIONS') {
        if (req.headers.origin !== PAGES_ORIGIN) { res.writeHead(403); res.end(); return; }
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' }); res.end(); return;
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (pathname === '/api/health' || pathname === '/api/info' || pathname === '/connection.json') {
      let serverUrl;
      try { serverUrl = publicOrigin(req); }
      catch { res.writeHead(400); res.end('Bad request'); return; }
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      const body = pathname === '/api/health' ? { ok: true, mode: 'relay' } : { mode: 'relay', serverUrl };
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
      return;
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(ROOT, `./${relativePath}`);
    if (pathname.includes('\0') || filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    const isVendorAsset = filePath.startsWith(path.join(ROOT, 'vendor') + path.sep);
    if (!PUBLIC_FILES.has(relativePath) && !isVendorAsset) { res.writeHead(404); res.end('没有找到这个文件'); return; }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('Not a file');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream', 'Content-Length': info.size });
      if (req.method === 'HEAD') res.end();
      else createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404, { 'Content-Type': MIME['.txt'] }); res.end('没有找到这个文件'); }
  });

  const error = (client, code, message) => client.ws.send({ type: 'error', code, message });
  const broadcast = (room, message) => { for (const player of room.players.values()) player.client.ws.send(message); };
  const active = room => ['hiding', 'shooting', 'switching'].includes(room.phase);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function snapshot(room, viewerId) {
    const role = room.shooterId === viewerId ? 'shooter' : room.hiderId === viewerId ? 'hider' : null;
    const visible = role === 'hider' || room.phase === 'switching' || room.phase !== 'hiding' && room.phase !== 'lobby' && targetVisible(room.target, room.holes);
    return {
      phase: room.phase, room: room.code, hostId: room.hostId, turn: room.turn,
      shooterId: room.shooterId, hiderId: room.hiderId, role,
      shotsLeft: room.shotsLeft, countdown: active(room) ? Math.max(0, (room.deadline - Date.now()) / 1000) : 0,
      holes: room.holes.map(h => ({ ...h })),
      target: room.target && visible && room.phase !== 'lobby' ? { ...room.target } : null,
      players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, wins: p.wins, headshots: p.headshots, bodyHits: p.bodyHits, shots: p.shots })),
      winnerId: room.winnerId, reason: room.reason,
    };
  }
  function publish(room) {
    for (const player of room.players.values()) player.client.ws.send({ type: 'state', state: snapshot(room, player.id) });
  }

  function finish(room, winnerId, reason) {
    if (room.phase === 'finished') return;
    room.phase = 'finished';
    room.winnerId = winnerId;
    room.reason = reason;
    room.deadline = 0;
    const winner = room.players.get(winnerId);
    if (winner) winner.wins++;
  }

  function leave(client) {
    const room = client.room;
    if (!room) return;
    room.players.delete(client.id);
    client.room = null;
    if (room.players.size === 0) { rooms.delete(room.code); return; }
    if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
    if (active(room)) finish(room, room.players.keys().next().value, 'opponent_left');
    publish(room);
  }

  function resetLobby(room) {
    room.phase = 'lobby';
    room.shooterId = null; room.hiderId = null; room.target = null;
    room.winnerId = null; room.reason = null; room.deadline = 0;
  }

  function join(client, message) {
    const code = message.room == null ? '' : String(message.room).trim();
    let room;
    if (!code || message.create === true) {
      if (rooms.size >= 500) return error(client, 'FULL', '房间已满，请稍后再试');
      let newCode;
      do { newCode = String(randomInt(1000, 10000)); } while (rooms.has(newCode));
      room = { code: newCode, players: new Map(), hostId: client.id, phase: 'lobby', turn: 0, shooterId: null, hiderId: null, target: null, shotsLeft: 3, holes: [], nextHoleId: 1, deadline: 0, lastShotAt: 0, moveAt: 0, winnerId: null, reason: null };
      rooms.set(newCode, room);
    } else {
      if (!/^\d{4}$/.test(code)) return error(client, 'ROOM', '请输入四位房间码');
      room = rooms.get(code);
      if (!room) return error(client, 'ROOM', '没有找到房间，请检查房间码');
      if (room.players.size >= 2 && !room.players.has(client.id)) return error(client, 'FULL', '这是双人对决，房间已满');
      if (active(room) && client.room !== room) return error(client, 'PLAYING', '对决进行中');
    }
    if (client.room === room) {
      room.players.get(client.id).name = sanitizeName(message.name);
      client.ws.send({ type: 'welcome', id: client.id, room: room.code, hostId: room.hostId });
      publish(room);
      return;
    }
    leave(client);
    if (room.phase === 'finished') resetLobby(room);
    client.room = room;
    room.players.set(client.id, { id: client.id, client, name: sanitizeName(message.name), wins: 0, headshots: 0, bodyHits: 0, shots: 0 });
    client.ws.send({ type: 'welcome', id: client.id, room: room.code, hostId: room.hostId });
    publish(room);
  }

  function beginHiding(room, switchRoles = false) {
    if (switchRoles) {
      [room.shooterId, room.hiderId] = [room.hiderId, room.shooterId];
      room.turn++;
    }
    room.phase = 'hiding';
    room.shotsLeft = 3;
    room.reason = null;
    room.target = { x: randomInt(-6500, 6501) / 1000, y: randomInt(1800, 8201) / 1000, pose: 'stand' };
    room.deadline = Date.now() + 6000;
    room.moveAt = Date.now();
    room.lastShotAt = 0;
  }

  function beginShooting(room) {
    room.phase = 'shooting';
    room.deadline = Date.now() + 30000;
    room.moveAt = Date.now();
  }

  function beginSwitching(room, reason) {
    room.phase = 'switching';
    room.reason = reason;
    room.deadline = Date.now() + 1500;
  }

  function start(client, restart) {
    const room = client.room;
    if (!room) return error(client, 'JOIN', '请先加入房间');
    if (room.hostId !== client.id) return error(client, 'HOST', '等待房主开始对决');
    if (room.players.size !== 2) return error(client, 'PLAYERS', '需要两位玩家才能开始');
    if (restart ? room.phase !== 'finished' : room.phase !== 'lobby') return error(client, 'PHASE', '当前不能开始对决');
    room.turn = 1;
    room.shooterId = room.hostId;
    room.hiderId = [...room.players.keys()].find(id => id !== room.hostId);
    room.holes = [];
    room.nextHoleId = 1;
    room.winnerId = null;
    for (const player of room.players.values()) { player.headshots = 0; player.bodyHits = 0; player.shots = 0; }
    beginHiding(room);
    publish(room);
  }

  function move(client, message) {
    const room = client.room;
    if (!room || !['hiding', 'shooting'].includes(room.phase)) return error(client, 'PHASE', '当前不能移动');
    if (room.hiderId !== client.id) return error(client, 'ROLE', '只有躲藏者可以移动外星人');
    const x = message.x === undefined ? room.target.x : message.x;
    const y = message.y === undefined ? room.target.y : message.y;
    if (![x, y].every(v => typeof v === 'number' && Number.isFinite(v))) return error(client, 'MOVE', '移动坐标无效');
    if (message.pose !== undefined && !POSES.includes(message.pose)) return error(client, 'MOVE', '姿势无效');
    let nextX = clamp(x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX);
    let nextY = clamp(y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY);
    const now = Date.now();
    if (room.phase === 'shooting') {
      const dx = nextX - room.target.x, dy = nextY - room.target.y;
      const distance = Math.hypot(dx, dy);
      const maxDistance = Math.min(0.25, Math.max(0, (now - room.moveAt) / 1000)) * 4;
      if (distance > maxDistance && distance > 0) {
        nextX = room.target.x + dx / distance * maxDistance;
        nextY = room.target.y + dy / distance * maxDistance;
      }
    }
    room.target = { x: nextX, y: nextY, pose: message.pose ?? room.target.pose };
    room.moveAt = now;
  }

  function ready(client) {
    const room = client.room;
    if (!room || room.phase !== 'hiding') return error(client, 'PHASE', '当前不能确认躲藏');
    if (room.hiderId !== client.id) return error(client, 'ROLE', '等待对手完成躲藏');
    beginShooting(room);
    publish(room);
  }

  function shoot(client, message) {
    const room = client.room, player = room?.players.get(client.id);
    if (!room || !player || room.phase !== 'shooting') return error(client, 'PHASE', '等待射击回合');
    if (room.shooterId !== client.id) return error(client, 'ROLE', '当前是对手的射击回合');
    const now = Date.now();
    if (now - room.lastShotAt < 700) return error(client, 'COOLDOWN', '拉栓中');
    const { x, y } = message;
    if (![x, y].every(v => typeof v === 'number' && Number.isFinite(v)) || x < -WALL.width / 2 || x > WALL.width / 2 || y < 0 || y > WALL.height) return error(client, 'AIM', '请瞄准墙面');
    if (room.shotsLeft <= 0) return error(client, 'EMPTY', '本轮三发已经用完');
    room.shotsLeft--;
    room.lastShotAt = now;
    player.shots++;
    room.holes.push({ id: room.nextHoleId++, x, y });
    const result = hitTarget(room.target, x, y);
    if (result === 'head') player.headshots++;
    if (result === 'body') player.bodyHits++;
    broadcast(room, { type: 'shot', playerId: client.id, shotId: typeof message.shotId === 'string' || typeof message.shotId === 'number' ? message.shotId : null, x, y, result, shotsLeft: room.shotsLeft });
    if (result === 'head') finish(room, client.id, 'headshot');
    else if (result === 'body') beginSwitching(room, 'body');
    else if (room.shotsLeft === 0) beginSwitching(room, 'three_misses');
    publish(room);
  }

  function onMessage(client, text) {
    const now = Date.now();
    if (now - client.rateAt >= 1000) { client.rateAt = now; client.rateCount = 0; }
    if (++client.rateCount > 80) { client.ws.close(1008, 'Too many messages'); return; }
    let message;
    try { message = JSON.parse(text); } catch { error(client, 'JSON', '消息格式无效'); return; }
    if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') return error(client, 'MESSAGE', '消息格式无效');
    client.lastSeen = now;
    switch (message.type) {
      case 'join': join(client, message); break;
      case 'start': start(client, false); break;
      case 'restart': start(client, true); break;
      case 'move': move(client, message); break;
      case 'ready': ready(client); break;
      case 'shoot': shoot(client, message); break;
      case 'leave': leave(client); client.ws.send({ type: 'left' }); break;
      case 'ping': client.ws.send({ type: 'pong', at: typeof message.at === 'number' && Number.isFinite(message.at) ? message.at : now }); break;
      default: error(client, 'MESSAGE', '未知操作');
    }
  }

  server.on('upgrade', (req, socket, head) => {
    if (!validSocketOrigin(req)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    const key = req.headers['sec-websocket-key'];
    if (req.url !== '/ws' || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || Buffer.from(key, 'base64').length !== 16 || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return;
    }
    if (clients.size >= 1000) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { id: randomUUID().slice(0, 8), room: null, ws: null, rateAt: Date.now(), rateCount: 0, lastSeen: Date.now() };
    client.ws = websocket(socket, text => onMessage(client, text), () => { leave(client); clients.delete(client); });
    clients.add(client);
    if (head.length) client.ws.feed(head);
  });

  function tick() {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.players.size !== 2) continue;
      if (now >= room.deadline) {
        if (room.phase === 'hiding') beginShooting(room);
        else if (room.phase === 'shooting') beginSwitching(room, 'timeout');
        else if (room.phase === 'switching') beginHiding(room, true);
      }
      publish(room);
    }
    for (const client of clients) if (now - client.lastSeen > 90000) client.ws.close(1001, 'Idle timeout');
  }

  return {
    server, rooms,
    address: () => server.address(),
    async listen() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); });
      timer = setInterval(tick, 1000 / 15);
      timer.unref();
      return this;
    },
    async close() {
      clearInterval(timer);
      for (const client of [...clients]) client.ws.close(1001, 'Server stopping');
      await new Promise(resolve => server.close(resolve));
    },
  };
}

const launchedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) {
  const port = Number(process.env.PORT) || 10000;
  const game = createGameServer({ port, host: '0.0.0.0' });
  game.listen().then(() => {
    console.log(`Alien sniper relay listening on 0.0.0.0:${game.address().port}`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => game.close().finally(() => process.exit()));
}
