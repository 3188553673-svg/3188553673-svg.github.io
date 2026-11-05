import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaServer } from '../server.js';
import { setTimeout as delay } from 'node:timers/promises';

async function setup(t) {
  const arena = await createArenaServer({ port: 0, host: '127.0.0.1' }).listen();
  const sockets = [];
  t.after(async () => { for (const s of sockets) s.close(); await arena.close(); });
  const base = `http://127.0.0.1:${arena.address().port}`;
  async function connect() {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws'); sockets.push(ws);
    const messages = [];
    ws.addEventListener('message', e => messages.push(JSON.parse(e.data)));
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    return {
      ws, messages,
      send: message => ws.send(JSON.stringify(message)),
      latest: () => messages.filter(m => m.type === 'state').at(-1)?.state,
      async wait(predicate, timeout = 3500) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) { const result = messages.find(predicate); if (result) return result; await delay(10); }
        throw new Error('Message not received: ' + JSON.stringify(messages.slice(-3)));
      },
    };
  }
  return { arena, base, connect };
}

test('HTTP identifies this game, supports Pages health CORS, and blocks server source', async t => {
  const { base } = await setup(t);
  const health = await fetch(base + '/api/health', { headers: { origin: 'https://3188553673-svg.github.io' } });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, mode: 'relay', game: 'rift-arena', protocol: 1 });
  assert.equal(health.headers.get('access-control-allow-origin'), 'https://3188553673-svg.github.io');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const config = await fetch(base + '/connection.json', { headers: { 'x-forwarded-proto': 'https' } });
  assert.deepEqual(await config.json(), { mode: 'relay', serverUrl: base.replace('http:', 'https:') });
  const definitions = await fetch(base + '/shared/definitions.js');
  assert.equal(definitions.status, 200);
  assert.match(await definitions.text(), /CHAMPIONS/);
  for (const route of ['/server.js', '/server/engine.js', '/package.json', '/tests/server.test.mjs', '/assets/%2e%2e%2fserver.js']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  assert.equal((await fetch(base + '/%2e%2e%2fsecret')).status, 403);
  assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 405);
});

test('real WebSockets enforce room selection, readiness and host start while syncing both views', async t => {
  const { connect } = await setup(t);
  const a = await connect(), b = await connect(), c = await connect();
  a.send({ type: 'join', create: true, name: '<甲>', champion: 'garen' });
  const aw = await a.wait(m => m.type === 'welcome'); assert.match(aw.room, /^\d{4}$/);
  b.send({ type: 'join', room: aw.room, name: '乙', champion: 'ashe' });
  const bw = await b.wait(m => m.type === 'welcome');
  await a.wait(m => m.type === 'state' && m.state.players.length === 2);
  assert.equal(a.latest().players[0].name, '甲');
  c.send({ type: 'join', room: aw.room, name: '第三人', champion: 'lux' });
  assert.equal((await c.wait(m => m.type === 'error')).code, 'FULL');
  b.send({ type: 'start' }); await b.wait(m => m.type === 'error');
  assert.equal(a.latest().phase, 'lobby');
  a.send({ type: 'ready', value: true }); b.send({ type: 'ready', value: true });
  await a.wait(m => m.type === 'state' && m.state.players.every(p => p.ready));
  a.send({ type: 'start' });
  const s1 = (await a.wait(m => m.type === 'state' && m.state.phase === 'playing')).state;
  const s2 = (await b.wait(m => m.type === 'state' && m.state.phase === 'playing')).state;
  assert.equal(s1.heroes.length, 2); assert.equal(s2.heroes.length, 2);
  assert.equal(s1.heroes.find(h => h.id === aw.id).champion, 'garen');
  assert.equal(s2.heroes.find(h => h.id === bw.id).champion, 'ashe');
  assert.equal(s1.structures.length, 4);
  const startX = s1.heroes.find(h => h.id === aw.id).x;
  a.send({ type: 'move', x: -22, z: 2 });
  await b.wait(m => m.type === 'state' && m.state.heroes.some(h => h.id === aw.id && h.x > startX + .2));
  a.send({ type: 'ability', slot: 'w', x: -25, z: 0 });
  await b.wait(m => m.type === 'state' && m.state.heroes.some(h => h.id === aw.id && h.shield > 0));
  b.send({ type: 'leave' });
  const finish = (await a.wait(m => m.type === 'state' && m.state.phase === 'finished')).state;
  assert.equal(finish.winnerTeam, 0);
  c.send({ type: 'join', room: aw.room, name: '替补', champion: 'lux' });
  await c.wait(m => m.type === 'welcome');
  await c.wait(m => m.type === 'state' && m.state.phase === 'lobby' && m.state.players.length === 2);
});

test('one-click practice starts a server-run bot and closing the human removes the empty room', async t => {
  const { arena, connect } = await setup(t);
  const p = await connect();
  p.send({ type: 'join', create: true, practice: true, name: '练习', champion: 'lux' });
  const w = await p.wait(m => m.type === 'welcome');
  const s = (await p.wait(m => m.type === 'state' && m.state.phase === 'playing')).state;
  assert.equal(s.players.length, 2); assert.equal(s.players.filter(p => p.isBot).length, 1);
  p.send({ type: 'ping', at: 123 }); assert.equal((await p.wait(m => m.type === 'pong')).at, 123);
  p.ws.close();
  for (let i = 0; i < 50 && arena.rooms.has(w.room); i++) await delay(10);
  assert.equal(arena.rooms.has(w.room), false);
});
