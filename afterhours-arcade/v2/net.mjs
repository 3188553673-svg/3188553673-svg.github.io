export async function getServerInfo() {
  const response = await fetch('/api/info', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法连接房间主机');
  const info = await response.json();
  if (info.app !== 'afterhours-rogue') throw new Error('请打开《放学后禁止加练》的局域网主机地址');
  return info;
}

export class LanClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.socket = null;
    this.room = null;
    this.serial = 0;
    this.attempt = 0;
    this.pending = new Map();
    this.frames = [];
    this.lastInput = '';
    this.lastSent = 0;
  }

  async connect() {
    const endpoint = new URL('/coop', location.href);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(endpoint.href);
    this.socket = socket;
    socket.onmessage = event => {
      if (this.socket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'room') {
        const was = this.room?.phase;
        this.room = message.room;
        if (this.room.phase === 'lobby' || (this.room.phase === 'playing' && was !== 'playing')) {
          this.frames = []; this.lastInput = '';
        }
        this.handlers.onRoom?.(this.room);
      } else if (message.type === 'state') {
        const state = message.state;
        this.send('stateAck', { tick: state.tick });
        if (this.frames.length && this.frames.at(-1).state.tick >= state.tick) this.frames = [];
        this.frames.push({ state, time: performance.now() });
        if (this.frames.length > 2) this.frames.shift();
        this.handlers.onState?.(state);
      } else if (message.type === 'ack' || message.type === 'error') {
        const request = this.pending.get(message.seq);
        if (request) {
          clearTimeout(request.timer);
          this.pending.delete(message.seq);
          if (message.type === 'error') request.reject(new Error(message.message));
          else request.resolve(this.room);
        } else if (message.type === 'error') this.handlers.onError?.(message.message);
      }
    };
    await new Promise((resolve, reject) => {
      const problem = '连接失败，请在同一 Wi-Fi 下打开房主的邀请链接';
      const timer = setTimeout(() => { socket.close(); reject(new Error(problem)); }, 6000);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = () => { clearTimeout(timer); reject(new Error(problem)); };
      socket.onclose = () => {
        clearTimeout(timer);
        reject(new Error(problem));
        if (this.socket !== socket) return;
        const wasInRoom = !!this.room;
        this.close();
        if (wasInRoom) this.handlers.onClose?.('主机连接已断开，请打开邀请链接重新加入');
      };
    });
  }

  send(type, fields = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...fields }));
  }

  request(type, fields) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('尚未连接局域网房间'));
    const seq = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq); reject(new Error('主机没有回应，请重新加入房间'));
      }, 7000);
      this.pending.set(seq, { resolve, reject, timer });
      this.send(type, { ...fields, seq });
    });
  }

  async enter(type, fields) {
    this.close();
    const attempt = this.attempt;
    try {
      await this.connect();
      if (this.attempt !== attempt) throw new Error('房间选择已更改');
      return await this.request(type, fields);
    } catch (error) {
      if (this.attempt === attempt) this.close();
      throw error;
    }
  }

  create(characters = ['kobe']) { return this.enter('create', { seats: characters }); }
  join(code, characters = ['kobe']) { return this.enter('join', { code: String(code).trim(), seats: characters }); }
  setCharacters(characters) { return this.request('seats', { seats: characters }); }
  start() { return this.request('start', {}); }
  backToLobby() { return this.request('lobby', {}); }

  input(rows) {
    if (this.room?.phase !== 'playing' || !rows || typeof rows !== 'object') return;
    const now = performance.now(), signature = JSON.stringify(rows);
    if (this.lastInput === signature && now - this.lastSent < 200) return;
    this.lastInput = signature; this.lastSent = now;
    this.send('input', { rows });
  }

  sample() {
    const latest = this.frames.at(-1);
    if (!latest || this.frames.length < 2) return latest?.state ?? null;
    const older = this.frames[0].state, current = latest.state;
    const ticks = current.tick - older.tick;
    if (current.phase !== older.phase || current.stage !== older.stage || current.roomId !== older.roomId || current.roomTick < older.roomTick || ticks <= 0 || ticks > 9) return current;
    const mix = Math.min(1, Math.max(0, (performance.now() - latest.time) / (ticks * 1000 / 60)));
    if (mix === 1) return current;
    const result = { ...current };
    for (const key of ['players', 'enemies', 'shots']) {
      if (!Array.isArray(older[key]) || !Array.isArray(current[key])) continue;
      const previous = new Map(older[key].map(item => [item.id, item]));
      result[key] = current[key].map(item => {
        const from = previous.get(item.id);
        if (!from || item.id == null || !Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(from.x) || !Number.isFinite(from.y) || Math.hypot(item.x - from.x, item.y - from.y) > 86) return item;
        return { ...item, x: from.x + (item.x - from.x) * mix, y: from.y + (item.y - from.y) * mix };
      });
    }
    const boss = current.boss, prior = older.boss;
    if (boss && prior && boss.id === prior.id && boss.kind === prior.kind &&
        Math.hypot(boss.x - prior.x, boss.y - prior.y) < 86) {
      result.boss = { ...boss, x: prior.x + (boss.x - prior.x) * mix, y: prior.y + (boss.y - prior.y) * mix };
    }
    return result;
  }

  close() {
    this.attempt++;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error('连接已关闭')); }
    this.pending.clear();
    const socket = this.socket;
    this.room = null; this.socket = null; this.frames = []; this.lastInput = '';
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }
}
