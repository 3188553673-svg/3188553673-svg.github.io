import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { inflateSync } from 'node:zlib';
import { createArenaServer } from '../server.js';
import { snapshot } from '../server/engine.js';

async function connect(url) {
  const socket = new WebSocket(url);
  const received = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.type === 'state' && message.encoding === 'deflate') {
      const state = JSON.parse(inflateSync(Buffer.from(message.data, 'base64')).toString('utf8'));
      received.push({ message, state, bytes: Buffer.byteLength(data) });
    } else {
      received.push({ message, state: message.state, bytes: Buffer.byteLength(data) });
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return {
    socket,
    received,
    send: action => socket.send(JSON.stringify(action)),
    async wait(predicate) {
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        const item = received.find(predicate);
        if (item) return item;
        await delay(5);
      }
      throw new Error('Expected WebSocket message was not received');
    },
  };
}

const hasType = type => item => item.message.type === type;
const sharedView = state => ({
  ...state,
  heroes: state.heroes.map(({ lastInputSeq, motionTick, motionRevision, effectiveSpeed, moveTarget, ...hero }) => hero),
});

test('snapshot ACKs bound a proxy backlog while game commands and the latest state still progress', async t => {
  const arena = await createArenaServer({ port: 0, host: '127.0.0.1' }).listen();
  t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.address().port}/ws`;
  const blue = await connect(url);
  const red = await connect(url);
  blue.send({ type: 'join', create: true, snapshotFlow: 'ack', snapshotEncoding: 'deflate' });
  const { message: welcome } = await blue.wait(hasType('welcome'));
  assert.equal(welcome.snapshotFlow, 'ack');
  const first = await blue.wait(item => item.message.stateSeq === 1);
  assert.equal(first.message.encoding, 'deflate');

  red.send({ type: 'join', room: welcome.room });
  const { message: legacy } = await red.wait(hasType('welcome'));
  assert.equal(Object.hasOwn(legacy, 'snapshotFlow'), false);
  await blue.wait(item => item.message.stateSeq === 2);
  blue.send({ type: 'ready', value: true });
  red.send({ type: 'ready', value: true });
  await red.wait(item => item.state?.players.length === 2 && item.state.players.every(player => player.ready));
  blue.send({ type: 'start' });
  const later = await red.wait(item => item.state?.phase === 'playing' && item.state.tick >= 6);
  assert.equal(Object.hasOwn(later.message, 'stateSeq'), false);

  // Both TCP connections are readable. The stalled client's app has consumed
  // no snapshots, as can happen when an intermediary eagerly reads from Node.
  blue.send({ type: 'state_ack', stateSeq: 1000 });
  blue.send({ type: 'stop', seq: 17 });
  blue.send({ type: 'ping', at: 30 });
  await blue.wait(item => item.message.type === 'pong' && item.message.at === 30);
  assert.equal((await blue.wait(hasType('input_ack'))).message.accepted, true);
  assert.deepEqual(blue.received.filter(hasType('state')).map(item => item.message.stateSeq), [1, 2]);

  blue.send({ type: 'state_ack', stateSeq: 2 });
  const resumed = await blue.wait(item => item.message.stateSeq === 3);
  assert.equal(resumed.state.phase, 'playing');
  assert.ok(resumed.state.tick >= later.state.tick);
  assert.equal(resumed.state.heroes.find(hero => hero.id === welcome.id).lastInputSeq, 17);
  await blue.wait(item => item.message.stateSeq === 4);

  red.send({ type: 'leave' });
  await red.wait(hasType('left'));
  blue.send({ type: 'state_ack', stateSeq: 2 });
  blue.send({ type: 'ping', at: 31 });
  await blue.wait(item => item.message.type === 'pong' && item.message.at === 31);
  assert.deepEqual(blue.received.filter(hasType('state')).map(item => item.message.stateSeq), [1, 2, 3, 4]);

  blue.send({ type: 'state_ack', stateSeq: 4 });
  const final = await blue.wait(item => item.message.stateSeq === 5);
  assert.equal(final.state.phase, 'finished');
  assert.equal(final.state.winnerTeam, 0);
  assert.ok(final.state.events.some(event => event.type === 'victory'));

  blue.send({ type: 'leave' });
  await blue.wait(hasType('left'));
  blue.send({ type: 'join', create: true, practice: true, snapshotFlow: 'ack' });
  const nextRoom = await blue.wait(item => item.message.stateSeq === 6);
  assert.equal(nextRoom.state.phase, 'playing');
  await blue.wait(item => item.message.stateSeq === 7);
  blue.send({ type: 'state_ack', stateSeq: 5 });
  blue.send({ type: 'ping', at: 32 });
  await blue.wait(item => item.message.type === 'pong' && item.message.at === 32);
  assert.deepEqual(blue.received.filter(hasType('state')).map(item => item.message.stateSeq), [1, 2, 3, 4, 5, 6, 7]);
});

test('deflate is negotiated per client and preserves the authoritative snapshot with fewer wire bytes', async t => {
  const arena = await createArenaServer({ port: 0, host: '127.0.0.1' }).listen();
  t.after(() => arena.close());
  const url = `ws://127.0.0.1:${arena.address().port}/ws`;
  const blue = await connect(url), red = await connect(url);
  blue.send({ type: 'join', create: true, champion: 'lux', name: '蓝方', snapshotEncoding: 'deflate' });
  const { message: welcome } = await blue.wait(hasType('welcome'));
  assert.equal(welcome.snapshotEncoding, 'deflate');
  const lobby = await blue.wait(hasType('state'));
  assert.deepEqual(Object.keys(lobby.message).sort(), ['data', 'encoding', 'type']);
  assert.deepEqual(lobby.state, JSON.parse(JSON.stringify(snapshot(arena.rooms.get(welcome.room), welcome.id))));

  red.send({ type: 'join', room: welcome.room, champion: 'garen', name: '红方' });
  const { message: legacyWelcome } = await red.wait(hasType('welcome'));
  assert.equal(Object.hasOwn(legacyWelcome, 'snapshotEncoding'), false);
  const legacyLobby = await red.wait(hasType('state'));
  assert.deepEqual(Object.keys(legacyLobby.message).sort(), ['state', 'type']);
  blue.send({ type: 'ready', value: true });
  red.send({ type: 'ready', value: true });
  await blue.wait(item => item.state?.players.length === 2 && item.state.players.every(player => player.ready));
  blue.send({ type: 'start' });

  const packed = await blue.wait(item => item.state?.phase === 'playing' && item.state.minions.length >= 8);
  const plain = await red.wait(item => item.state?.phase === 'playing' && item.state.tick === packed.state.tick);
  assert.deepEqual(sharedView(packed.state), sharedView(plain.state));
  assert.equal(packed.state.heroes.find(hero => hero.id === welcome.id).motionTick, packed.state.tick);
  assert.equal(Object.hasOwn(packed.state.heroes.find(hero => hero.id === legacyWelcome.id), 'moveTarget'), false);
  assert.ok(packed.bytes < plain.bytes * .7, `${packed.bytes} compressed bytes versus ${plain.bytes} plain bytes`);
  t.diagnostic(`Playing snapshot with ${packed.state.minions.length} minions: ${plain.bytes} → ${packed.bytes} bytes (${(100 * packed.bytes / plain.bytes).toFixed(1)}%) including JSON and Base64 envelopes`);

  blue.send({ type: 'ping', at: 123 });
  assert.deepEqual((await blue.wait(hasType('pong'))).message, { type: 'pong', at: 123 });
  blue.send({ type: 'stop', seq: 1 });
  assert.deepEqual((await blue.wait(hasType('input_ack'))).message, { type: 'input_ack', seq: 1, accepted: true });
  await blue.wait(item => item.state?.heroes.find(hero => hero.id === welcome.id)?.lastInputSeq === 1);
  blue.send({ type: 'leave' });
  await blue.wait(hasType('left'));
  blue.send({ type: 'join', create: true, champion: 'lux', snapshotEncoding: 'unsupported' });
  const rejoined = await blue.wait(item => item.message.type === 'welcome' && item.message.room !== welcome.room);
  assert.equal(Object.hasOwn(rejoined.message, 'snapshotEncoding'), false);
  const fallback = await blue.wait(item => item.state?.room === rejoined.message.room);
  assert.deepEqual(Object.keys(fallback.message).sort(), ['state', 'type']);
});
