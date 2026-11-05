import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { createGameServer } from '../server.js';
import { WALL, getTargetParts, hitTarget, targetVisible } from '../../rules.js';

async function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages = [];
  ws.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  return {
    ws, messages,
    send: message => ws.send(JSON.stringify(message)),
    mark: () => messages.length,
    async wait(predicate, since = 0, timeout = 2500) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const match = messages.slice(since).find(predicate);
        if (match) return match;
        await sleep(10);
      }
      throw new Error(`Timed out waiting for message; received ${JSON.stringify(messages.slice(since).slice(-3))}`);
    },
    close: () => ws.close(),
  };
}

async function setup(t) {
  const game = await createGameServer({ port: 0, host: '127.0.0.1' }).listen();
  t.after(() => game.close());
  return { game, port: game.address().port };
}

test('HTTP info and secure static file resolution', async t => {
  const { port } = await setup(t);
  const response = await fetch(`http://127.0.0.1:${port}/api/info`);
  assert.equal(response.status, 200);
  const info = await response.json();
  assert.equal(info.mode, 'relay');
  assert.equal(info.serverUrl, `http://127.0.0.1:${port}`);
  assert.equal('addresses' in info, false);
  assert.equal('port' in info, false);
  assert.equal((await fetch(`http://127.0.0.1:${port}/%2e%2e%2fserver.js`)).status, 403);
  assert.equal((await fetch(`http://127.0.0.1:${port}/server.js`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/info`, { method: 'POST' })).status, 405);
});

async function pair(t, name = '房主') {
  const { game, port } = await setup(t);
  const a = await client(port), b = await client(port);
  t.after(() => { a.close(); b.close(); });
  a.send({ type: 'join', name });
  const wa = await a.wait(m => m.type === 'welcome');
  b.send({ type: 'join', name: '朋友', room: wa.room });
  const wb = await b.wait(m => m.type === 'welcome');
  await a.wait(m => m.type === 'state' && m.state.players.length === 2);
  return { game, port, a, b, wa, wb, room: game.rooms.get(wa.room) };
}

async function beginDuel(a, b, target = { x: 0, y: 5, pose: 'stand' }) {
  const startA = a.mark(), startB = b.mark();
  a.send({ type: 'start' });
  await a.wait(m => m.type === 'state' && m.state.phase === 'hiding', startA);
  await b.wait(m => m.type === 'state' && m.state.phase === 'hiding', startB);
  const moveMark = b.mark();
  b.send({ type: 'move', ...target });
  await b.wait(m => m.type === 'state' && m.state.target?.x === target.x && m.state.target?.y === target.y && m.state.target?.pose === target.pose, moveMark);
  const shootA = a.mark(), shootB = b.mark();
  b.send({ type: 'ready' });
  await a.wait(m => m.type === 'state' && m.state.phase === 'shooting', shootA);
  await b.wait(m => m.type === 'state' && m.state.phase === 'shooting', shootB);
}

async function fire(player, x, y, shotId) {
  const mark = player.mark();
  player.send({ type: 'shoot', x, y, shotId });
  return player.wait(m => m.type === 'shot' && m.shotId === shotId, mark);
}

test('private two-player role snapshots, headshot victory and rematch wins', async t => {
  const { port, a, b, wa, wb, room } = await pair(t);
  const c = await client(port);
  t.after(c.close);
  c.send({ type: 'join', name: '第三人', room: wa.room });
  await c.wait(m => m.type === 'error' && m.code === 'FULL');
  assert.equal(c.messages.some(m => m.type === 'state'), false);
  b.send({ type: 'start' });
  await b.wait(m => m.type === 'error' && m.code === 'HOST');
  a.send({ type: 'start' });
  const hiddenA = await a.wait(m => m.type === 'state' && m.state.phase === 'hiding');
  const hiddenB = await b.wait(m => m.type === 'state' && m.state.phase === 'hiding');
  assert.equal(hiddenA.state.role, 'shooter');
  assert.equal(hiddenB.state.role, 'hider');
  assert.equal(hiddenA.state.target, null, 'shooter must not receive hidden coordinates');
  assert.ok(hiddenB.state.target);
  a.send({ type: 'move', x: 0, y: 4 });
  await a.wait(m => m.type === 'error' && m.code === 'ROLE');
  a.send({ type: 'ready' });
  await a.wait(m => m.type === 'error' && m.code === 'ROLE');
  b.send({ type: 'shoot', x: 0, y: 0 });
  await b.wait(m => m.type === 'error' && m.code === 'PHASE');
  const moved = b.mark();
  b.send({ type: 'move', x: 0, y: 5, pose: 'stand' });
  await b.wait(m => m.type === 'state' && m.state.target?.x === 0, moved);
  b.send({ type: 'ready' });
  const shooting = await a.wait(m => m.type === 'state' && m.state.phase === 'shooting');
  assert.equal(shooting.state.target, null);
  b.send({ type: 'shoot', x: 0, y: 5.85 });
  await b.wait(m => m.type === 'error' && m.code === 'ROLE');
  a.send({ type: 'shoot', x: 1000, y: 5 });
  await a.wait(m => m.type === 'error' && m.code === 'AIM');
  assert.equal(room.holes.length, 0);
  const hit = await fire(a, 0, 5.85, 'winning-shot');
  assert.equal(hit.result, 'head');
  assert.equal(hit.shotsLeft, 2);
  await b.wait(m => m.type === 'shot' && m.shotId === 'winning-shot');
  const victory = await a.wait(m => m.type === 'state' && m.state.phase === 'finished');
  assert.equal(victory.state.winnerId, wa.id);
  assert.equal(victory.state.reason, 'headshot');
  assert.equal(victory.state.players.find(p => p.id === wa.id).wins, 1);
  assert.equal(victory.state.players.find(p => p.id === wa.id).headshots, 1);
  assert.equal(victory.state.players.find(p => p.id === wb.id).wins, 0);
  const rematch = a.mark();
  a.send({ type: 'restart' });
  const fresh = await a.wait(m => m.type === 'state' && m.state.phase === 'hiding', rematch);
  assert.equal(fresh.state.holes.length, 0);
  assert.equal(fresh.state.target, null);
  assert.equal(fresh.state.turn, 1);
  assert.equal(fresh.state.players.find(p => p.id === wa.id).wins, 1);
  assert.equal(fresh.state.players.find(p => p.id === wa.id).shots, 0);
});

test('three misses swap roles, body hit switches immediately, and all holes survive turns', async t => {
  const { a, b, wa, wb } = await pair(t);
  await beginDuel(a, b);
  const first = await fire(a, -8.9, 0.01, 'miss1');
  assert.equal(first.result, 'miss');
  assert.equal(first.shotsLeft, 2);
  a.send({ type: 'shoot', x: -8.8, y: 0.01, shotId: 'too-fast' });
  await a.wait(m => m.type === 'error' && m.code === 'COOLDOWN');
  await sleep(710);
  assert.equal((await fire(a, -8.8, 0.01, 'miss2')).shotsLeft, 1);
  await sleep(710);
  const switchMark = a.mark();
  await fire(a, -8.7, 0.01, 'miss3');
  const switching = await a.wait(m => m.type === 'state' && m.state.phase === 'switching', switchMark);
  assert.equal(switching.state.reason, 'three_misses');
  assert.equal(switching.state.shotsLeft, 0);
  assert.equal(switching.state.holes.length, 3);
  assert.deepEqual(switching.state.target, { x: 0, y: 5, pose: 'stand' });
  const second = await a.wait(m => m.type === 'state' && m.state.phase === 'hiding' && m.state.turn === 2, switchMark);
  assert.equal(second.state.role, 'hider');
  assert.equal(second.state.shooterId, wb.id);
  assert.equal(second.state.hiderId, wa.id);
  assert.equal(second.state.holes.length, 3);
  assert.deepEqual(second.state.holes, switching.state.holes);
  const other = await b.wait(m => m.type === 'state' && m.state.phase === 'hiding' && m.state.turn === 2);
  assert.equal(other.state.target, null, 'new shooter gets no preparing coordinates');
  const poseMark = a.mark();
  a.send({ type: 'move', x: 1, y: 4, pose: 'crouch' });
  await a.wait(m => m.type === 'state' && m.state.target?.x === 1 && m.state.target?.pose === 'crouch', poseMark);
  a.send({ type: 'ready' });
  await b.wait(m => m.type === 'state' && m.state.phase === 'shooting' && m.state.turn === 2);
  const bodyMark = b.mark();
  const body = await fire(b, 1, 3.65, 'body-hit');
  assert.equal(body.result, 'body');
  assert.equal(body.shotsLeft, 2);
  const bodySwitch = await b.wait(m => m.type === 'state' && m.state.phase === 'switching', bodyMark);
  assert.equal(bodySwitch.state.reason, 'body');
  assert.equal(bodySwitch.state.holes.length, 4);
  assert.equal(bodySwitch.state.players.find(p => p.id === wb.id).bodyHits, 1);
  b.send({ type: 'shoot', x: 1, y: 3.65, shotId: 'not-your-turn' });
  await b.wait(m => m.type === 'error' && m.code === 'PHASE');
});

test('holes reveal only intersecting target; live movement speed and wall bounds are enforced', async t => {
  const { a, b, room } = await pair(t);
  await beginDuel(a, b);
  const mark = a.mark();
  const near = await fire(a, 0.5, 5.85, 'near-head');
  assert.equal(near.result, 'miss');
  const reveal = await a.wait(m => m.type === 'state' && m.state.target !== null, mark);
  assert.deepEqual(reveal.state.target, { x: 0, y: 5, pose: 'stand' });
  assert.equal(reveal.state.holes.length, 1);
  await sleep(280);
  const before = { ...room.target };
  b.send({ type: 'move', x: 9999, y: 9999, pose: 'stand' });
  await sleep(60);
  assert.ok(Math.hypot(room.target.x - before.x, room.target.y - before.y) <= 1.00001, 'idle teleport is clamped to 4m/s with .25s max allowance');
  assert.ok(room.target.x <= 7.8 && room.target.y <= 8.65);
  for (let i = 0; i < 3; i++) { await sleep(260); b.send({ type: 'move', x: 7.8, y: 8.65, pose: 'stand' }); }
  const hidden = a.mark();
  await a.wait(m => m.type === 'state' && m.state.phase === 'shooting' && m.state.target === null, hidden);
  assert.equal(targetVisible(room.target, room.holes), false);
});

test('timeout switches; disconnect awards remaining player; replacement joins a clean lobby', async t => {
  const { a, b, wa, room, port } = await pair(t);
  await beginDuel(a, b);
  room.deadline = Date.now() - 1;
  const timed = await a.wait(m => m.type === 'state' && m.state.phase === 'switching');
  assert.equal(timed.state.reason, 'timeout');
  b.close();
  const result = await a.wait(m => m.type === 'state' && m.state.phase === 'finished');
  assert.equal(result.state.reason, 'opponent_left');
  assert.equal(result.state.winnerId, wa.id);
  assert.equal(result.state.players[0].wins, 1);
  const replacement = await client(port);
  t.after(replacement.close);
  replacement.send({ type: 'join', name: '新朋友', room: wa.room });
  await replacement.wait(m => m.type === 'welcome');
  const lobby = await replacement.wait(m => m.type === 'state' && m.state.phase === 'lobby');
  assert.equal(lobby.state.target, null);
  assert.equal(lobby.state.players.length, 2);
  const startMark = a.mark();
  a.send({ type: 'start' });
  const next = await a.wait(m => m.type === 'state' && m.state.phase === 'hiding', startMark);
  assert.equal(next.state.players.find(p => p.id === wa.id).wins, 1);
});

test('invalid JSON, room isolation and malformed aim do not alter the match', async t => {
  const { a, b, wa, room, port } = await pair(t);
  const isolated = await client(port);
  t.after(isolated.close);
  isolated.ws.send('{broken');
  await isolated.wait(m => m.type === 'error' && m.code === 'JSON');
  isolated.send({ type: 'join', name: '另一个房间' });
  const own = await isolated.wait(m => m.type === 'welcome');
  assert.notEqual(own.room, wa.room);
  await beginDuel(a, b);
  const marker = a.mark();
  a.send({ type: 'shoot', x: null, y: 3 });
  await a.wait(m => m.type === 'error' && m.code === 'AIM', marker);
  assert.equal(room.holes.length, 0);
  assert.equal(room.shotsLeft, 3);
  assert.equal(isolated.messages.some(m => m.type === 'state' && m.state.phase !== 'lobby'), false);
  isolated.send({ type: 'ping', at: 123 });
  assert.equal((await isolated.wait(m => m.type === 'pong')).at, 123);
});

test('shared geometry agrees on heads, bodies and circle/ellipse visibility for all poses', () => {
  assert.equal(WALL.holeRadius, 0.58);
  for (const pose of ['stand', 'crouch', 'lean']) {
    const target = { x: 0, y: 5, pose };
    const parts = getTargetParts(target);
    const head = parts.find(p => p.kind === 'head');
    const torso = parts.find(p => p.part === 'torso');
    assert.equal(parts.length, 6);
    assert.equal(hitTarget(target, head.x, head.y), 'head');
    assert.equal(hitTarget(target, torso.x, torso.y), 'body');
    assert.equal(hitTarget(target, -8.9, 0.01), 'miss');
    assert.equal(targetVisible(target, []), false);
    assert.equal(targetVisible(target, [{ x: head.x + 0.5, y: head.y }]), true);
    assert.equal(targetVisible(target, [{ x: -8.9, y: 0.01 }]), false);
  }
});

function maskedFrame(opcode, text, fin = true) {
  const data = Buffer.from(text), mask = randomBytes(4);
  assert.ok(data.length < 126);
  const encoded = Buffer.from(data);
  for (let i = 0; i < encoded.length; i++) encoded[i] ^= mask[i % 4];
  return Buffer.concat([Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | data.length]), mask, encoded]);
}

test('wire transport accepts fragmented text with an interleaved ping', async t => {
  const { port } = await setup(t);
  const socket = net.connect(port, '127.0.0.1');
  t.after(() => socket.destroy());
  await new Promise(resolve => socket.once('connect', resolve));
  const key = randomBytes(16).toString('base64');
  let incoming = Buffer.alloc(0);
  socket.on('data', data => { incoming = Buffer.concat([incoming, data]); });
  socket.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  const until = Date.now() + 2000;
  while (!incoming.includes(Buffer.from('\r\n\r\n')) && Date.now() < until) await sleep(10);
  assert.match(incoming.toString(), /101 Switching Protocols/);
  incoming = Buffer.alloc(0);
  socket.write(Buffer.concat([maskedFrame(1, '{"type":"pi', false), maskedFrame(9, 'alive'), maskedFrame(0, 'ng","at":77}') ]));
  while (!incoming.includes(Buffer.from('"pong"')) && Date.now() < until) await sleep(10);
  assert.ok(incoming.includes(Buffer.from('alive')), 'server replies with pong control payload');
  assert.ok(incoming.includes(Buffer.from('"at":77')), 'fragmented message was reassembled');
});
