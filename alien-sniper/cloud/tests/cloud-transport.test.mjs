import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudTransport } from '../../cloud-transport.js';
import { createGameServer } from '../server.js';
import { getTargetParts } from '../../rules.js';

// Node 22 exposes WebSocket but not the browser's global CloseEvent.
// Supply only the test DOM primitive; browser transport code stays unchanged.
if (typeof globalThis.CloseEvent === 'undefined') {
  globalThis.CloseEvent = class CloseEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      Object.defineProperties(this, {
        code: { value: init.code ?? 0, enumerable: true },
        reason: { value: init.reason ?? '', enumerable: true },
        wasClean: { value: init.wasClean ?? false, enumerable: true },
      });
    }
  };
}

const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };

function sandbox(t, health) {
  const original = { fetch: globalThis.fetch, WebSocket: globalThis.WebSocket, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now, timeout: AbortSignal.timeout };
  let now = 0, seq = 0;
  const timers = new Map(), sockets = [];
  Date.now = () => now;
  globalThis.setTimeout = (fn, ms = 0) => { timers.set(++seq, { fn, at: now + ms }); return seq; };
  globalThis.clearTimeout = id => timers.delete(id);
  AbortSignal.timeout = ms => { const c = new AbortController(); setTimeout(() => c.abort(new DOMException('Timeout', 'TimeoutError')), ms); return c.signal; };
  globalThis.fetch = health;
  class Socket extends EventTarget {
    static OPEN = 1;
    constructor(url) { super(); this.url = String(url); this.readyState = 0; this.sent = []; this.closes = 0; sockets.push(this); }
    open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
    send(value) { this.sent.push(value); }
    close() { this.closes++; this.readyState = 3; this.dispatchEvent(new CloseEvent('close')); }
  }
  globalThis.WebSocket = Socket;
  t.after(() => { globalThis.fetch = original.fetch; globalThis.WebSocket = original.WebSocket; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; Date.now = original.now; AbortSignal.timeout = original.timeout; });
  return { sockets, timers, get now() { return now; }, async advance(ms) { const end = now + ms; for (;;) { const next = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; next[1].fn(); await tick(); } now = end; await tick(); } };
}

test('cold start retries failures and wrong service; opens WSS once then relays messages', async t => {
  let calls = 0;
  const s = sandbox(t, async url => { assert.equal(String(url), 'https://relay.example/api/health'); calls++; if (calls === 1) throw new Error('sleeping'); if (calls === 2) return { ok: true, json: async () => ({ ok: true, mode: 'direct' }) }; return { ok: true, json: async () => ({ ok: true, mode: 'relay' }) }; });
  const c = new CloudTransport('https://relay.example');
  const progress = [], messages = []; let opens = 0;
  c.addEventListener('progress', e => progress.push(e.data)); c.addEventListener('open', () => opens++); c.addEventListener('message', e => messages.push(e.data));
  await tick(); assert.equal(s.sockets.length, 0);
  await s.advance(3000); assert.equal(calls, 3); assert.equal(s.sockets.length, 1); assert.equal(s.sockets[0].url, 'wss://relay.example/ws');
  s.sockets[0].open(); c.send('{"type":"join"}');
  s.sockets[0].dispatchEvent(new MessageEvent('message', { data: 'welcome' }));
  assert.equal(opens, 1); assert.equal(c.readyState, 1); assert.deepEqual(s.sockets[0].sent, ['{"type":"join"}']); assert.deepEqual(messages, ['welcome']); assert.match(progress[1], /唤醒/);
  c.close(); c.send('late'); assert.equal(s.sockets[0].sent.length, 1);
});

test('closing during pending health aborts and emits one close with no later socket', async t => {
  let aborted = false;
  const s = sandbox(t, (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); })));
  const c = new CloudTransport('https://relay.example'); let closes = 0; c.addEventListener('close', () => closes++);
  await tick(); c.close('cancelled'); c.close('duplicate'); await tick(); await s.advance(120000);
  assert.equal(aborted, true); assert.equal(closes, 1); assert.equal(s.sockets.length, 0); assert.equal(c.readyState, 3);
});

test('closing during backoff cancels retry; later fresh transport can retry successfully', async t => {
  let healthy = false, calls = 0;
  const s = sandbox(t, async () => { calls++; if (!healthy) throw new Error('sleeping'); return { ok: true, json: async () => ({ ok: true, mode: 'relay' }) }; });
  const first = new CloudTransport('https://relay.example'); await tick(); first.close(); await s.advance(20000); assert.equal(calls, 1); assert.equal(s.sockets.length, 0);
  healthy = true; const second = new CloudTransport('https://relay.example'); await tick(); assert.equal(s.sockets.length, 1); s.sockets[0].open(); assert.equal(second.readyState, 1); second.close();
});

test('unreachable health eventually closes, and a stalled WebSocket closes after its own deadline', async t => {
  let healthy = false;
  const s = sandbox(t, async () => { if (!healthy) throw new Error('offline'); return { ok: true, json: async () => ({ ok: true, mode: 'relay' }) }; });
  const first = new CloudTransport('https://relay.example'); let firstReason; first.addEventListener('close', e => firstReason = e.reason); await tick(); await s.advance(100000); assert.equal(first.readyState, 3); assert.match(firstReason, /暂时无法连接/); assert.equal(s.sockets.length, 0);
  healthy = true; const second = new CloudTransport('https://relay.example'); let reason; second.addEventListener('close', e => reason = e.reason); await tick(); await s.advance(12000); assert.equal(second.readyState, 3); assert.match(reason, /超时/); s.sockets[0].open(); assert.equal(second.readyState, 3);
});

test('connection does not require AbortSignal.any or AbortSignal.timeout', async t => {
  const s = sandbox(t, async () => ({ ok: true, json: async () => ({ ok: true, mode: 'relay' }) }));
  const any = AbortSignal.any; t.after(() => { AbortSignal.any = any; });
  AbortSignal.any = undefined; AbortSignal.timeout = undefined;
  const c = new CloudTransport('https://relay.example'); await tick(); assert.equal(s.sockets.length, 1); s.sockets[0].open(); assert.equal(c.readyState, 1); c.close();
});

test('real HTTP/WebSocket integration: two clients join, private targets, miss/body/head, leave and new join', async t => {
  const game = await createGameServer({ port: 0, host: '127.0.0.1' }).listen();
  const base = `http://127.0.0.1:${game.address().port}`;
  const all = []; t.after(async () => {
    try { for (const c of all) c.close(); }
    finally { await game.close(); }
  });
  async function player(name, room) {
    const c = new CloudTransport(base); all.push(c); c.messages = [];
    c.addEventListener('message', e => c.messages.push(JSON.parse(e.data)));
    await new Promise((resolve, reject) => { c.addEventListener('open', resolve, { once: true }); c.addEventListener('close', e => reject(new Error(e.reason)), { once: true }); });
    c.send(JSON.stringify({ type: 'join', name, ...(room ? { room } : { create: true }) }));
    c.wait = async predicate => { const end = Date.now() + 4000; while (Date.now() < end) { const found = c.messages.find(predicate); if (found) return found; await new Promise(r => setTimeout(r, 10)); } throw new Error(`message timeout ${name}`); };
    c.latest = () => c.messages.filter(m => m.type === 'state').at(-1)?.state;
    c.action = message => c.send(JSON.stringify(message));
    c.welcome = await c.wait(m => m.type === 'welcome'); return c;
  }
  const host = await player('host'); const guest = await player('guest', host.welcome.room);
  await host.wait(m => m.type === 'state' && m.state.players.length === 2);
  host.action({ type: 'start' }); await guest.wait(m => m.type === 'state' && m.state.phase === 'hiding');
  assert.equal(host.latest().target, null); assert.equal(guest.latest().role, 'hider'); assert.ok(guest.latest().target);
  guest.action({ type: 'ready' }); await host.wait(m => m.type === 'state' && m.state.phase === 'shooting');
  host.action({ type: 'shoot', x: 8.8, y: 9.7 }); await guest.wait(m => m.type === 'state' && m.state.holes.length === 1); assert.equal(host.latest().holes.length, 1);
  await new Promise(r => setTimeout(r, 710)); const torso = getTargetParts(guest.latest().target).find(p => p.part === 'torso'); host.action({ type: 'shoot', x: torso.x, y: torso.y });
  await guest.wait(m => m.type === 'state' && m.state.phase === 'switching' && m.state.reason === 'body'); await host.wait(m => m.type === 'state' && m.state.turn === 2 && m.state.phase === 'hiding');
  assert.equal(host.latest().role, 'hider'); assert.equal(host.latest().holes.length, 2);
  host.action({ type: 'ready' }); await guest.wait(m => m.type === 'state' && m.state.turn === 2 && m.state.phase === 'shooting');
  const head = getTargetParts(host.latest().target).find(p => p.part === 'head'); guest.action({ type: 'shoot', x: head.x, y: head.y });
  await host.wait(m => m.type === 'state' && m.state.phase === 'finished'); assert.equal(host.latest().winnerId, guest.welcome.id);
  guest.action({ type: 'leave' }); guest.close(); await host.wait(m => m.type === 'state' && m.state.players.length === 1);
  const replacement = await player('replacement', host.welcome.room); await replacement.wait(m => m.type === 'state' && m.state.phase === 'lobby' && m.state.players.length === 2);
  assert.equal(replacement.latest().hostId, host.welcome.id);
});
