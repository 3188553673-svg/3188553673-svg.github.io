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
