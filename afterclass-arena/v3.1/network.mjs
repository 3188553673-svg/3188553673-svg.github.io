import { INPUT_ACTIONS, inputMask } from './input-map.mjs';

export async function getServerInfo() {
  const response = await fetch('/api/info', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取主机的局域网地址');
  return response.json();
}

export function roomCodeFromUrl() {
  return new URL(location.href).searchParams.get('room')?.trim() ?? '';
}

export class ArenaConnection {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.socket = null;
    this.room = null;
    this.sequence = 0;
    this.attempt = 0;
    this.snapshots = [];
    this.pending = new Map();
    this.lastInput = '';
    this.lastSentAt = 0;
  }

  async connect() {
    const url = new URL('/arena', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onmessage = event => {
      if (socket !== this.socket) return;
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'room') {
        const oldPhase = this.room?.phase;
        this.room = msg.room;
        if (this.room.phase !== 'game' || oldPhase !== 'game') this.lastInput = '';
        if (this.room.phase === 'lobby' || (this.room.phase === 'game' && oldPhase !== 'game')) {
          this.snapshots = [];
        }
        this.handlers.onRoom?.(this.room);
      } else if (msg.type === 'state') {
        const previous = this.snapshots[this.snapshots.length - 1]?.state;
        if (previous && msg.state.tick <= previous.tick) this.snapshots = [];
        this.snapshots.push({ state: msg.state, time: performance.now() });
        if (this.snapshots.length > 2) this.snapshots.shift();
        this.handlers.onState?.(msg.state);
      } else if (msg.type === 'error' || msg.type === 'ack') {
        const task = this.pending.get(msg.seq);
        if (task) {
          this.pending.delete(msg.seq); clearTimeout(task.timer);
          if (msg.type === 'error') task.reject(new Error(msg.message)); else task.resolve(this.room);
        }
        if (msg.type === 'error') this.handlers.onError?.(msg.message);
      }
    };
    await new Promise((resolve, reject) => {
      const problem = '无法连接游戏主机，请检查两台设备是否连着同一个局域网';
      const timer = setTimeout(() => { socket.close(); reject(new Error(problem)); }, 5500);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = () => { clearTimeout(timer); reject(new Error(problem)); };
      socket.onclose = () => {
        clearTimeout(timer); reject(new Error(problem));
        if (socket !== this.socket) return;
        this.socket = null; this.room = null;
        this.rejectPending();
        this.handlers.onClose?.('与房间的连接已断开，请重新加入');
      };
    });
  }

  rejectPending() {
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error('连接已关闭')); }
    this.pending.clear();
  }

  request(type, fields) {
    const socket = this.socket;
    if (socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('尚未连接游戏房间'));
    const seq = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq); reject(new Error('房间响应超时，请重新连接'));
      }, 5000);
      this.pending.set(seq, { resolve, reject, timer });
      socket.send(JSON.stringify({ type, seq, ...fields }));
    });
  }

  async enter(type, fields) {
    this.leave();
    const attempt = this.attempt;
    try {
      await this.connect();
      if (attempt !== this.attempt) throw new Error('房间选择已更改');
      return await this.request(type, fields);
    } catch (error) {
      if (attempt === this.attempt) this.leave();
      throw error;
    }
  }

  create(seats = ['doubao']) { return this.enter('create', { seats }); }
  join(code, seats = ['doubao']) { return this.enter('join', { code: String(code).trim(), seats }); }

  send(type, fields = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...fields }));
  }

  setSeats(seats) { this.send('seats', { seats }); }
  start() { this.send('start'); }
  lobby() { this.send('lobby'); }

  input(rows) {
    if (this.room?.phase !== 'game' || !Array.isArray(rows)) return;
    const masks = rows.map(inputMask).join(',');
    const now = performance.now();
    if (this.lastInput === masks && now - this.lastSentAt < 220) return;
    this.lastInput = masks; this.lastSentAt = now;
    this.send('input', { rows: rows.map(row => Object.fromEntries(INPUT_ACTIONS.map(key => [key, !!row?.[key]]))) });
  }

  // The simulation remains authoritative. Interpolate positions only, so
  // round changes, knockouts and hit effects keep their exact server timing.
  sample() {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest || this.snapshots.length < 2) return latest?.state ?? null;
    const previous = this.snapshots[0].state;
    const current = latest.state;
    const ticks = current.tick - previous.tick;
    if (ticks <= 0 || ticks > 8 || current.phase !== previous.phase || current.round !== previous.round) return current;
    const ratio = Math.min(1, (performance.now() - latest.time) / (ticks * 1000 / 60));
    if (ratio >= 1) return current;
    const blinks=current.events.filter(e=>e.kind==='bookmarkBlink' && e.tick>previous.tick);
    const join = (items, past) => items.map(item => {
      const from = past.find(other => other.id === item.id);
      if (!from || blinks.some(e=>e.source===item.id) || (item.hp === 0) !== (from.hp === 0) ||
          Math.abs(from.x - item.x) > 100 || Math.abs(from.y - item.y) > 100) return item;
      return { ...item, x: from.x + (item.x - from.x) * ratio, y: from.y + (item.y - from.y) * ratio };
    });
    return { ...current, players: join(current.players, previous.players), projectiles: join(current.projectiles, previous.projectiles) };
  }

  leave() {
    this.attempt++;
    this.snapshots = [];
    const socket = this.socket;
    this.socket = null; this.room = null; this.lastInput = '';
    this.rejectPending();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }
}
