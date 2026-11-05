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
  for(const route of ['/client-movement.js','/scene-performance.js','/original-heroes.js','/arena-environment.js','/hero-assets.js','/vendor/GLTFLoader.js','/vendor/SkeletonUtils.js','/vendor/BufferGeometryUtils.js']) {
    const response=await fetch(base+route);assert.equal(response.status,200,route);
    assert.match(response.headers.get('content-type'),/javascript/,route);
  }
  for(const [route,mime] of [['/assets/portraits/knight-v1.jpg','image/jpeg'],['/assets/original-heroes/metal-paint.png','image/png']]){const response=await fetch(base+route);assert.equal(response.status,200,route);assert.equal(response.headers.get('content-type'),mime,route);await response.arrayBuffer();}
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

test('sequenced input receives lightweight acknowledgements while snapshots retain one tick cadence', async t => {
  const {base,connect}=await setup(t),p=await connect();
  assert.equal((await fetch(base+'/client-movement.js')).status,200);
  p.send({type:'join',create:true,practice:true,name:'预测回归',champion:'lux'});
  const w=await p.wait(m=>m.type==='welcome');await p.wait(m=>m.type==='state'&&m.state.phase==='playing');
  const from=p.messages.length;
  for(let seq=1;seq<=20;seq++)p.send({type:'move',x:-30+seq*.1,z:-4,seq});
  await p.wait(m=>m.type==='input_ack'&&m.seq===20&&m.accepted===true);
  const synced=(await p.wait(m=>m.type==='state'&&m.state.heroes.some(h=>h.id===w.id&&h.lastInputSeq===20))).state;
  assert.deepEqual(synced.heroes.find(h=>h.id===w.id).moveTarget,{x:-28,z:-4});
  await delay(220);
  const states=p.messages.slice(from).filter(m=>m.type==='state');
  assert.ok(states.length<12,`a burst must not emit a full snapshot per action (${states.length})`);
  assert.equal(new Set(states.map(m=>m.state.tick)).size,states.length,'playing snapshots have unique simulation ticks');
  p.send({type:'move',x:25,z:0,seq:20});
  const duplicate=await p.wait(m=>m.type==='input_ack'&&m.seq===20&&m.duplicate===true);
  assert.equal(Object.hasOwn(duplicate,'accepted'),false,'a repeated command is not falsely reaccepted');
  p.send({type:'ability',slot:'r',x:10,z:0,seq:21});
  await p.wait(m=>m.type==='input_ack'&&m.seq===21&&m.accepted===false);
  assert.equal((await p.wait(m=>m.type==='error'&&m.seq===21)).code,'LEVEL');
  await p.wait(m=>m.type==='state'&&m.state.heroes.some(h=>h.id===w.id&&h.lastInputSeq===21));
});

test('a short event-loop stall catches up through bounded fixed simulation steps',async t=>{
  const {arena,connect}=await setup(t),p=await connect();
  p.send({type:'join',create:true,practice:true,name:'步进回归',champion:'garen'});
  const w=await p.wait(m=>m.type==='welcome');await p.wait(m=>m.type==='state'&&m.state.phase==='playing');
  const room=arena.rooms.get(w.room),before=room.time;
  const until=performance.now()+220;while(performance.now()<until) { /* Simulate one bounded scheduling stall. */ }
  await delay(15);
  assert.ok(room.time-before>=.2-1e-8,`220ms stall advanced only ${room.time-before}s`);
  assert.ok(room.time-before<=.3+1e-8,'catch-up work remains bounded');
});
